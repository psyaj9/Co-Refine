"""Audit pipeline background tasks.

All long-running background work extracted from the segments router lives here.
These functions are called via FastAPI's BackgroundTasks and create their own
DB sessions (except _reaudit_siblings which reuses a caller-supplied session).
"""

import uuid

from sqlalchemy.orm import Session

from database import (
    SessionLocal,
    CodedSegment,
    Code,
    Document,
    AnalysisResult,
    AgentAlert,
    ConsistencyScore,
)
from services.ai_analyzer import run_coding_audit, analyze_quotes
from services.vector_store import add_segment_embedding, find_diverse_segments
from services.scoring import compute_stage1_scores, compute_code_overlap_matrix
from services.ws_manager import ws_manager
from config import settings
from utils import PARSE_FAILED_SENTINEL


def _ws_send(user_id: str, payload: dict):
    """Fire-and-forget send from a background thread via the main event loop."""
    ws_manager.send_alert_threadsafe(user_id, payload)


def _extract_window(full_text: str, start: int, end: int, sentences: int = 2) -> str:
    before = full_text[:start]
    after = full_text[end:]

    before_parts = before.replace("?", ".").replace("!", ".").split(".")
    before_context = ".".join(before_parts[-sentences:]).strip() if before_parts else ""

    after_parts = after.replace("?", ".").replace("!", ".").split(".")
    after_context = ".".join(after_parts[:sentences]).strip() if after_parts else ""

    highlight = full_text[start:end]
    parts = []
    if before_context:
        parts.append(f"...{before_context}")
    parts.append(f">>>{highlight}<<<")
    if after_context:
        parts.append(f"{after_context}...")
    return " ".join(parts)


def _run_analysis_background(
    *,
    code_id: str,
    code_label: str,
    user_id: str,
    user_definition: str | None,
):
    """Background task for manual definition rerun — uses the same WS pipeline."""
    db = SessionLocal()

    _ws_send(user_id, {
        "type": "agents_started",
        "data": {"source": "manual_analysis"},
    })
    _ws_send(user_id, {
        "type": "agent_thinking",
        "agent": "analysis",
        "data": {},
    })

    try:
        all_quotes = [
            s.text
            for s in db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .all()
        ]
        analysis_result = analyze_quotes(code_label, all_quotes, user_definition=user_definition)

        # Don't persist parse failures — keep the old analysis intact
        if analysis_result.get("definition") == PARSE_FAILED_SENTINEL:
            print(f"[Agent] Analysis parse failure for code {code_label}")
            _ws_send(user_id, {
                "type": "agent_error",
                "agent": "analysis",
                "data": {"message": "AI could not generate a definition — please try again."},
            })
        else:
            existing = db.query(AnalysisResult).filter(AnalysisResult.code_id == code_id).first()
            raw_reasoning = analysis_result.get("reasoning")
            reasoning_str = "\n".join(raw_reasoning) if isinstance(raw_reasoning, list) else raw_reasoning
            analysis = AnalysisResult(
                id=existing.id if existing else str(uuid.uuid4()),
                code_id=code_id,
                definition=analysis_result.get("definition"),
                lens=analysis_result.get("lens"),
                reasoning=reasoning_str,
                segment_count_at_analysis=len(all_quotes),
            )
            db.merge(analysis)
            db.commit()

            _ws_send(user_id, {
                "type": "analysis_updated",
                "code_id": code_id,
                "code_label": code_label,
                "data": analysis_result,
            })
    except Exception as e:
        print(f"[Agent] Manual analysis error: {e}")
        _ws_send(user_id, {
            "type": "agent_error",
            "agent": "analysis",
            "data": {"message": str(e)},
        })
    finally:
        _ws_send(user_id, {
            "type": "agents_done",
            "data": {},
        })
        db.close()


def _run_batch_audit_background(
    *,
    project_id: str,
    user_id: str,
):
    """Background task: run Coding Audit for every code in a project using MMR sampling."""
    db = SessionLocal()

    try:
        all_codes = db.query(Code).filter(Code.project_id == project_id).all()
        total = len(all_codes)

        _ws_send(user_id, {
            "type": "batch_audit_started",
            "data": {"total_codes": total},
        })

        # Build shared context: codebook + AI-inferred definitions
        user_code_definitions: dict[str, str] = {
            c.label: (c.definition or "") for c in all_codes
        }

        code_definitions: dict[str, dict] = {
            code.label: {"definition": a.definition or "", "lens": a.lens or ""}
            for a, code in (
                db.query(AnalysisResult, Code)
                .join(Code, AnalysisResult.code_id == Code.id)
                .filter(Code.project_id == project_id)
                .all()
            )
        }

        all_code_labels = [c.label for c in all_codes]

        for i, code in enumerate(all_codes):
            # MMR-sampled diverse segments for this code
            diverse = find_diverse_segments(
                user_id=user_id,
                query_text=code.label,
                code_filter=code.label,
                n=15,
            )

            if not diverse:
                _ws_send(user_id, {
                    "type": "batch_audit_progress",
                    "data": {
                        "completed": i + 1,
                        "total": total,
                        "code_label": code.label,
                        "skipped": True,
                    },
                })
                continue

            # The first (most query-relevant) segment is the "candidate"; the rest are history
            representative = diverse[0]
            history = [(s["code"], s["text"]) for s in diverse[1:]]

            try:
                # Stage 1: deterministic scores for representative segment
                stage1 = None
                try:
                    current_definition = code.definition or None
                    stage1 = compute_stage1_scores(
                        user_id=user_id,
                        segment_text=representative["text"],
                        code_label=code.label,
                        all_code_labels=all_code_labels,
                        code_definition=current_definition,
                        softmax_temperature=settings.softmax_temperature,
                    )
                except Exception as e:
                    print(f"[Scoring] Batch stage1 error for '{code.label}': {e}")

                # --- Query co-applied codes on the same text span ---
                existing_codes_on_span: list[str] = []
                rep_seg = db.query(CodedSegment).filter(
                    CodedSegment.id == representative["id"]
                ).first()
                if rep_seg:
                    overlapping = (
                        db.query(CodedSegment, Code)
                        .join(Code, CodedSegment.code_id == Code.id)
                        .filter(
                            CodedSegment.document_id == rep_seg.document_id,
                            CodedSegment.id != rep_seg.id,
                            CodedSegment.start_index < rep_seg.end_index,
                            CodedSegment.end_index > rep_seg.start_index,
                        )
                        .all()
                    )
                    existing_codes_on_span = list({
                        c.label for _seg, c in overlapping
                    })

                audit_result = run_coding_audit(
                    user_history=history,
                    code_definitions=code_definitions,
                    new_quote=representative["text"],
                    proposed_code=code.label,
                    user_code_definitions=user_code_definitions,
                    existing_codes_on_span=existing_codes_on_span,
                    centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
                    codebook_prob_dist=stage1["codebook_prob_dist"] if stage1 else None,
                    entropy=stage1["entropy"] if stage1 else None,
                    temporal_drift=stage1["temporal_drift"] if stage1 else None,
                    is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
                    segment_count=stage1["segment_count"] if stage1 else None,
                    # Batch audit skips reflection for speed
                    enable_reflection=False,
                )

                # Post-process: filter alternative codes already on span + codebook check
                all_codes_on_span = set(existing_codes_on_span) | {code.label}
                self_lens = audit_result.get("self_lens", {})
                alt_codes = self_lens.get("alternative_codes", [])
                if alt_codes:
                    self_lens["alternative_codes"] = [
                        c for c in alt_codes
                        if c in user_code_definitions and c not in all_codes_on_span
                    ]

                audit_result["code_id"] = code.id
                audit_result["code_label"] = code.label
                audit_result["batch"] = True

                alert = AgentAlert(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    segment_id=representative["id"],
                    alert_type="coding_audit",
                    payload=audit_result,
                )
                db.add(alert)

                # Persist ConsistencyScore
                escalation = audit_result.get("_escalation", {})
                score_row = ConsistencyScore(
                    id=str(uuid.uuid4()),
                    segment_id=representative["id"],
                    code_id=code.id,
                    user_id=user_id,
                    project_id=project_id,
                    centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
                    is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
                    proposed_code_prob=stage1["proposed_code_prob"] if stage1 else None,
                    entropy=stage1["entropy"] if stage1 else None,
                    conflict_score=stage1["conflict_score"] if stage1 else None,
                    temporal_drift=stage1["temporal_drift"] if stage1 else None,
                    codebook_distribution=stage1["codebook_prob_dist"] if stage1 else None,
                    llm_consistency_score=self_lens.get("consistency_score"),
                    llm_intent_score=self_lens.get("intent_alignment_score"),
                    llm_overall_severity=audit_result.get("overall_severity_score"),
                    was_escalated=escalation.get("was_escalated", False),
                    escalation_reason=escalation.get("reason"),
                )
                db.add(score_row)
                db.commit()

                _ws_send(user_id, {
                    "type": "coding_audit",
                    "segment_id": representative["id"],
                    "segment_text": representative["text"],
                    "code_id": code.id,
                    "code_label": code.label,
                    "batch": True,
                    "deterministic_scores": stage1,
                    "escalation": escalation,
                    "data": audit_result,
                })
            except Exception as e:
                print(f"[Agent] Batch audit error for code '{code.label}': {e}")

            _ws_send(user_id, {
                "type": "batch_audit_progress",
                "data": {"completed": i + 1, "total": total, "code_label": code.label},
            })

        # Compute and send code overlap matrix for the project
        try:
            overlap_matrix = compute_code_overlap_matrix(user_id, all_code_labels)
            _ws_send(user_id, {
                "type": "code_overlap_matrix",
                "project_id": project_id,
                "data": overlap_matrix,
            })
        except Exception as e:
            print(f"[Scoring] Code overlap matrix error: {e}")

        _ws_send(user_id, {
            "type": "batch_audit_done",
            "data": {"total_codes": total},
        })
    except Exception as e:
        print(f"[Agent] Batch audit fatal error: {e}")
        _ws_send(user_id, {
            "type": "batch_audit_done",
            "data": {"error": str(e)},
        })
    finally:
        db.close()


def _reaudit_siblings(
    *,
    db: Session,
    document_id: str,
    start_index: int,
    end_index: int,
    exclude_segment_id: str,
    user_id: str,
):
    """Re-run coding audit for every sibling segment on the same text span.

    Called after a code is added or removed so that existing audit cards
    reflect the updated set of co-applied codes. Reuses existing Stage 1
    scores (embeddings don't change when co-applied codes change) and only
    re-runs the Stage 2 LLM audit.

    Sends 'coding_audit' WS messages with ``replaces_segment_id`` and
    ``replaces_code_id`` so the frontend can swap stale cards.
    """

    siblings = (
        db.query(CodedSegment, Code)
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(
            CodedSegment.document_id == document_id,
            CodedSegment.id != exclude_segment_id,
            CodedSegment.start_index < end_index,
            CodedSegment.end_index > start_index,
        )
        .all()
    )
    if not siblings:
        return

    for sib_seg, sib_code in siblings:
        try:
            project_id = sib_code.project_id
            all_codes = (
                db.query(Code).filter(Code.project_id == project_id).all()
                if project_id else []
            )
            user_code_definitions: dict[str, str] = {
                c.label: (c.definition or "") for c in all_codes
            }

            # Current co-applied codes on the span (excluding this sibling itself)
            overlapping = (
                db.query(CodedSegment, Code)
                .join(Code, CodedSegment.code_id == Code.id)
                .filter(
                    CodedSegment.document_id == document_id,
                    CodedSegment.id != sib_seg.id,
                    CodedSegment.start_index < sib_seg.end_index,
                    CodedSegment.end_index > sib_seg.start_index,
                )
                .all()
            )
            existing_codes_on_span: list[str] = list({
                c.label for _s, c in overlapping
            })

            # Reuse existing Stage 1 scores from ConsistencyScore table
            existing_score = (
                db.query(ConsistencyScore)
                .filter(
                    ConsistencyScore.segment_id == sib_seg.id,
                    ConsistencyScore.code_id == sib_code.id,
                )
                .first()
            )
            stage1_centroid = existing_score.centroid_similarity if existing_score else None
            stage1_entropy = existing_score.entropy if existing_score else None
            stage1_drift = existing_score.temporal_drift if existing_score else None
            stage1_pseudo = existing_score.is_pseudo_centroid if existing_score else False
            stage1_dist = existing_score.codebook_distribution if existing_score else None
            # Segment count from scoring table or fallback to DB count
            stage1_seg_count = None
            if existing_score and existing_score.codebook_distribution:
                # Not stored directly — use current count
                stage1_seg_count = (
                    db.query(CodedSegment)
                    .filter(CodedSegment.code_id == sib_code.id, CodedSegment.user_id == user_id)
                    .count()
                )

            # Build history via MMR — shared sample for both audit and reflection passes
            diverse = find_diverse_segments(
                user_id=user_id,
                query_text=sib_seg.text,
                code_filter=sib_code.label,
                n=10,
            )
            user_history = [(s["code"], s["text"]) for s in diverse]
            reflection_history = user_history

            # AI-inferred definitions (scoped to project to avoid full table scan)
            code_definitions: dict[str, dict] = {
                code.label: {"definition": a.definition or "", "lens": a.lens or ""}
                for a, code in (
                    db.query(AnalysisResult, Code)
                    .join(Code, AnalysisResult.code_id == Code.id)
                    .filter(Code.project_id == project_id)
                    .all()
                )
            }

            # Build document context
            doc = db.query(Document).filter(Document.id == document_id).first()
            document_context = ""
            if doc and doc.full_text:
                document_context = _extract_window(
                    doc.full_text, sib_seg.start_index, sib_seg.end_index
                )

            audit_result = run_coding_audit(
                user_history=user_history,
                code_definitions=code_definitions,
                new_quote=sib_seg.text,
                proposed_code=sib_code.label,
                document_context=document_context,
                user_code_definitions=user_code_definitions,
                existing_codes_on_span=existing_codes_on_span,
                centroid_similarity=stage1_centroid,
                codebook_prob_dist=stage1_dist,
                entropy=stage1_entropy,
                temporal_drift=stage1_drift,
                is_pseudo_centroid=stage1_pseudo,
                segment_count=stage1_seg_count,
                # Reflection loop enabled for sibling re-audits
                enable_reflection=True,
                reflection_history=reflection_history,
            )

            # Post-process: filter codes already on span
            all_codes_on_span = set(existing_codes_on_span) | {sib_code.label}
            self_lens = audit_result.get("self_lens", {})
            alt_codes = self_lens.get("alternative_codes", [])
            if alt_codes:
                self_lens["alternative_codes"] = [
                    c for c in alt_codes if c not in all_codes_on_span
                ]

            # Delete stale alert + consistency score
            db.query(AgentAlert).filter(
                AgentAlert.segment_id == sib_seg.id,
                AgentAlert.alert_type == "coding_audit",
            ).delete()
            db.query(ConsistencyScore).filter(
                ConsistencyScore.segment_id == sib_seg.id,
                ConsistencyScore.code_id == sib_code.id,
            ).delete()

            # Persist new alert
            alert = AgentAlert(
                id=str(uuid.uuid4()),
                user_id=user_id,
                segment_id=sib_seg.id,
                alert_type="coding_audit",
                payload=audit_result,
            )
            db.add(alert)

            # Persist new ConsistencyScore
            escalation = audit_result.get("_escalation", {})
            reflection = audit_result.get("_reflection", {})
            score_row = ConsistencyScore(
                id=str(uuid.uuid4()),
                segment_id=sib_seg.id,
                code_id=sib_code.id,
                user_id=user_id,
                project_id=project_id or "",
                centroid_similarity=stage1_centroid,
                is_pseudo_centroid=stage1_pseudo,
                proposed_code_prob=existing_score.proposed_code_prob if existing_score else None,
                entropy=stage1_entropy,
                conflict_score=existing_score.conflict_score if existing_score else None,
                temporal_drift=stage1_drift,
                codebook_distribution=stage1_dist,
                llm_consistency_score=self_lens.get("consistency_score"),
                llm_intent_score=self_lens.get("intent_alignment_score"),
                llm_overall_severity=audit_result.get("overall_severity_score"),
                # Reflection (Feature 6)
                initial_consistency_score=reflection.get("initial_scores", {}).get("consistency_score") if reflection.get("was_reflected") else None,
                initial_intent_score=reflection.get("initial_scores", {}).get("intent_alignment_score") if reflection.get("was_reflected") else None,
                initial_severity_score=reflection.get("initial_scores", {}).get("overall_severity_score") if reflection.get("was_reflected") else None,
                was_reflected=reflection.get("was_reflected", False),
                was_escalated=escalation.get("was_escalated", False),
                escalation_reason=escalation.get("reason"),
            )
            db.add(score_row)
            db.commit()

            is_consistent = self_lens.get("is_consistent", True)

            # Send updated audit card — frontend uses replaces_* to swap stale card
            _ws_send(user_id, {
                "type": "coding_audit",
                "segment_id": sib_seg.id,
                "segment_text": sib_seg.text,
                "code_id": sib_code.id,
                "code_label": sib_code.label,
                "is_consistent": is_consistent,
                "replaces_segment_id": sib_seg.id,
                "replaces_code_id": sib_code.id,
                "deterministic_scores": {
                    "centroid_similarity": stage1_centroid,
                    "entropy": stage1_entropy,
                    "temporal_drift": stage1_drift,
                } if stage1_centroid is not None else None,
                "escalation": escalation,
                "data": audit_result,
            })
            print(f"[Agent] Re-audited sibling segment {sib_seg.id} (code: {sib_code.label})")
        except Exception as e:
            print(f"[Agent] Sibling re-audit error for {sib_seg.id}: {e}")


def _reaudit_siblings_background(
    *,
    document_id: str,
    start_index: int,
    end_index: int,
    exclude_segment_id: str,
    user_id: str,
):
    """Background-task wrapper for _reaudit_siblings (creates its own DB session)."""
    db = SessionLocal()
    try:
        _reaudit_siblings(
            db=db,
            document_id=document_id,
            start_index=start_index,
            end_index=end_index,
            exclude_segment_id=exclude_segment_id,
            user_id=user_id,
        )
    except Exception as e:
        print(f"[Agent] Background sibling re-audit error: {e}")
    finally:
        db.close()


def _run_background_agents(
    *,
    segment_id: str,
    text: str,
    code_label: str,
    code_id: str,
    user_id: str,
    document_id: str,
    document_context: str,
    start_index: int = 0,
    end_index: int = 0,
    created_at: str | None = None,
):
    db = SessionLocal()

    # --- Notify frontend: agents have started ---
    _ws_send(user_id, {
        "type": "agents_started",
        "segment_id": segment_id,
        "data": {},
    })

    try:
        # 1. Embed segment
        try:
            add_segment_embedding(
                user_id=user_id,
                segment_id=segment_id,
                text=text,
                code_label=code_label,
                document_id=document_id,
                created_at=created_at,
            )
        except Exception as e:
            print(f"[Vector] Embedding failed: {e}")

        # Load all codes for the project to build codebook
        current_code = db.query(Code).filter(Code.id == code_id).first()
        project_id = current_code.project_id if current_code else None
        all_codes = (
            db.query(Code).filter(Code.project_id == project_id).all()
            if project_id else []
        )

        # Fetch project-level settings
        user_code_definitions: dict[str, str] = {
            c.label: (c.definition or "") for c in all_codes
        }

        # --- Query co-applied codes on the same text span ---
        overlapping_segments = (
            db.query(CodedSegment, Code)
            .join(Code, CodedSegment.code_id == Code.id)
            .filter(
                CodedSegment.document_id == document_id,
                CodedSegment.id != segment_id,
                CodedSegment.start_index < end_index,
                CodedSegment.end_index > start_index,
            )
            .all()
        )
        existing_codes_on_span: list[str] = list({
            c.label for _seg, c in overlapping_segments
        })

        # 2. Stage 1 — Deterministic embedding scores
        stage1 = None
        try:
            all_code_labels = [c.label for c in all_codes]
            current_definition = (
                current_code.definition
                if current_code and current_code.definition
                else None
            )
            stage1 = compute_stage1_scores(
                user_id=user_id,
                segment_text=text,
                code_label=code_label,
                all_code_labels=all_code_labels,
                code_definition=current_definition,
                softmax_temperature=settings.softmax_temperature,
            )
            _ws_send(user_id, {
                "type": "deterministic_scores",
                "segment_id": segment_id,
                "code_id": code_id,
                "data": stage1,
            })
        except Exception as e:
            print(f"[Scoring] Stage 1 deterministic scoring failed: {e}")

        # 3. Coding Audit — always run using MMR diversity sampling for history
        _ws_send(user_id, {
            "type": "agent_thinking",
            "agent": "coding_audit",
            "segment_id": segment_id,
            "data": {},
        })
        try:
            diverse = find_diverse_segments(
                user_id=user_id,
                query_text=text,
                code_filter=code_label,
                n=10,
            )
            user_history = [(s["code"], s["text"]) for s in diverse]
            # Reuse the same MMR sample for the reflection pass
            reflection_history = user_history

            code_definitions: dict[str, dict] = {
                code.label: {"definition": a.definition or "", "lens": a.lens or ""}
                for a, code in (
                    db.query(AnalysisResult, Code)
                    .join(Code, AnalysisResult.code_id == Code.id)
                    .filter(Code.project_id == project_id)
                    .all()
                )
            } if project_id else {}

            audit_result = run_coding_audit(
                user_history=user_history,
                code_definitions=code_definitions,
                new_quote=text,
                proposed_code=code_label,
                document_context=document_context,
                user_code_definitions=user_code_definitions,
                existing_codes_on_span=existing_codes_on_span,
                # Stage 1 grounding (None-safe — prompt handles missing scores)
                centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
                codebook_prob_dist=stage1["codebook_prob_dist"] if stage1 else None,
                entropy=stage1["entropy"] if stage1 else None,
                temporal_drift=stage1["temporal_drift"] if stage1 else None,
                is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
                segment_count=stage1["segment_count"] if stage1 else None,
                # Reflection loop
                enable_reflection=True,
                reflection_history=reflection_history,
            )

            # Send reflection WS events if reflection occurred
            reflection_meta = audit_result.get("_reflection", {})
            if reflection_meta.get("was_reflected"):
                _ws_send(user_id, {
                    "type": "reflection_complete",
                    "segment_id": segment_id,
                    "data": reflection_meta,
                })

            # Post-process: filter alternative codes already on this span
            all_codes_on_span = set(existing_codes_on_span) | {code_label}
            self_lens = audit_result.get("self_lens", {})
            alt_codes = self_lens.get("alternative_codes", [])
            if alt_codes:
                self_lens["alternative_codes"] = [
                    c for c in alt_codes if c not in all_codes_on_span
                ]

            is_consistent = self_lens.get("is_consistent", True)

            alert = AgentAlert(
                id=str(uuid.uuid4()),
                user_id=user_id,
                segment_id=segment_id,
                alert_type="coding_audit",
                payload=audit_result,
            )
            db.add(alert)

            # Persist ConsistencyScore row (Stage 1 + Stage 2 + Stage 3 + Reflection)
            escalation = audit_result.get("_escalation", {})
            reflection = audit_result.get("_reflection", {})

            score_row = ConsistencyScore(
                id=str(uuid.uuid4()),
                segment_id=segment_id,
                code_id=code_id,
                user_id=user_id,
                project_id=project_id or "",
                # Stage 1
                centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
                is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
                proposed_code_prob=stage1["proposed_code_prob"] if stage1 else None,
                entropy=stage1["entropy"] if stage1 else None,
                conflict_score=stage1["conflict_score"] if stage1 else None,
                temporal_drift=stage1["temporal_drift"] if stage1 else None,
                codebook_distribution=stage1["codebook_prob_dist"] if stage1 else None,
                # Stage 2 (reflected scores if reflection happened, otherwise initial)
                llm_consistency_score=self_lens.get("consistency_score"),
                llm_intent_score=self_lens.get("intent_alignment_score"),
                llm_overall_severity=audit_result.get("overall_severity_score"),
                # Reflection (Feature 6)
                initial_consistency_score=reflection.get("initial_scores", {}).get("consistency_score") if reflection.get("was_reflected") else None,
                initial_intent_score=reflection.get("initial_scores", {}).get("intent_alignment_score") if reflection.get("was_reflected") else None,
                initial_severity_score=reflection.get("initial_scores", {}).get("overall_severity_score") if reflection.get("was_reflected") else None,
                was_reflected=reflection.get("was_reflected", False),
                # Stage 3
                was_escalated=escalation.get("was_escalated", False),
                escalation_reason=escalation.get("reason"),
            )
            db.add(score_row)
            db.commit()

            # ---- Facet Analysis (runs after Stage 1 scores committed) ----
            try:
                from services.facet_clustering import run_facet_analysis
                facet_result = run_facet_analysis(
                    db=db,
                    user_id=user_id,
                    code_id=code_id,
                    project_id=project_id or "",
                )
                if facet_result["status"] == "success":
                    _ws_send(user_id, {
                        "type": "facet_updated",
                        "code_id": code_id,
                        "facet_count": facet_result["facet_count"],
                        "segment_count": facet_result["segment_count"],
                    })
            except Exception as e:
                print(f"[Facet] Facet analysis error: {e}")

            _ws_send(user_id, {
                "type": "coding_audit",
                "segment_id": segment_id,
                "segment_text": text,
                "code_id": code_id,
                "code_label": code_label,
                "is_consistent": is_consistent,
                "deterministic_scores": stage1,
                "escalation": escalation,
                "data": audit_result,
            })
        except Exception as e:
            print(f"[Agent] Coding audit error: {e}")
            _ws_send(user_id, {
                "type": "agent_error",
                "agent": "coding_audit",
                "segment_id": segment_id,
                "data": {"message": str(e)},
            })

        # 3b. Sibling re-audit on CREATE is intentionally omitted:
        # all segments in a batch are committed before any background task runs,
        # so each audit already queries the full set of co-applied codes.
        # Sibling re-audits are only needed on DELETE (see delete_segment route).

        # 4. Auto-analysis
        code_segment_count = (
            db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .count()
        )
        existing_analysis = (
            db.query(AnalysisResult).filter(AnalysisResult.code_id == code_id).first()
        )
        last_count = existing_analysis.segment_count_at_analysis if existing_analysis else 0

        if code_segment_count >= settings.auto_analysis_threshold and (
            code_segment_count - last_count >= settings.auto_analysis_threshold or last_count == 0
        ):
            _ws_send(user_id, {
                "type": "agent_thinking",
                "agent": "analysis",
                "segment_id": segment_id,
                "data": {},
            })
            try:
                all_quotes = [
                    s.text
                    for s in db.query(CodedSegment)
                    .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
                    .all()
                ]
                current_code_def = current_code.definition if current_code else None
                analysis_result = analyze_quotes(code_label, all_quotes, user_definition=current_code_def)

                # Don't persist parse failures — keep old analysis intact
                if analysis_result.get("definition") == PARSE_FAILED_SENTINEL:
                    print(f"[Agent] Auto-analysis parse failure for code {code_label}")
                    _ws_send(user_id, {
                        "type": "agent_error",
                        "agent": "analysis",
                        "segment_id": segment_id,
                        "data": {"message": "AI could not generate a definition — will retry next time."},
                    })
                else:
                    raw_reasoning = analysis_result.get("reasoning")
                    reasoning_str = "\n".join(raw_reasoning) if isinstance(raw_reasoning, list) else raw_reasoning
                    analysis = AnalysisResult(
                        id=existing_analysis.id if existing_analysis else str(uuid.uuid4()),
                        code_id=code_id,
                        definition=analysis_result.get("definition"),
                        lens=analysis_result.get("lens"),
                        reasoning=reasoning_str,
                        segment_count_at_analysis=code_segment_count,
                    )
                    db.merge(analysis)
                    db.commit()

                    _ws_send(user_id, {
                        "type": "analysis_updated",
                        "code_id": code_id,
                        "code_label": code_label,
                        "data": analysis_result,
                    })
            except Exception as e:
                print(f"[Agent] Auto-analysis error: {e}")
                _ws_send(user_id, {
                    "type": "agent_error",
                    "agent": "analysis",
                    "segment_id": segment_id,
                    "data": {"message": str(e)},
                })
    finally:
        # --- Notify frontend: all agents finished ---
        _ws_send(user_id, {
            "type": "agents_done",
            "segment_id": segment_id,
            "data": {},
        })
        db.close()
