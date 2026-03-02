from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

from database import get_db, CodedSegment, Code, Document, AnalysisResult, AgentAlert, EditEvent, ConsistencyScore
from models import SegmentCreate, SegmentOut, AnalysisOut, AnalysisTrigger, AlertOut, BatchAuditRequest
from services.ai_analyzer import run_coding_audit, analyze_quotes
from services.vector_store import (
    add_segment_embedding,
    find_diverse_segments,
    delete_segment_embedding,
)
from services.scoring import compute_stage1_scores, compute_code_overlap_matrix
from services.ws_manager import ws_manager
from config import settings
from utils import PARSE_FAILED_SENTINEL

router = APIRouter(prefix="/api/segments", tags=["segments"])


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


@router.post("/", response_model=SegmentOut)
async def create_segment(
    body: SegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    code = db.query(Code).filter(Code.id == body.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    doc = db.query(Document).filter(Document.id == body.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    seg_id = str(uuid.uuid4())
    segment = CodedSegment(
        id=seg_id,
        document_id=body.document_id,
        text=body.text,
        start_index=body.start_index,
        end_index=body.end_index,
        code_id=body.code_id,
        user_id=body.user_id,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)

    # Record edit event
    db.add(EditEvent(
        id=str(uuid.uuid4()),
        project_id=code.project_id,
        document_id=body.document_id,
        entity_type="segment",
        action="created",
        entity_id=seg_id,
        metadata_json={
            "code_label": code.label,
            "code_colour": code.colour,
            "code_id": body.code_id,
            "segment_text": body.text[:200],
            "start_index": body.start_index,
            "end_index": body.end_index,
        },
        user_id=body.user_id,
    ))
    db.commit()

    if settings.azure_api_key:
        context_window = _extract_window(doc.full_text, body.start_index, body.end_index)
        background_tasks.add_task(
            _run_background_agents,
            segment_id=seg_id,
            text=body.text,
            code_label=code.label,
            code_id=body.code_id,
            user_id=body.user_id,
            document_id=body.document_id,
            document_context=context_window,
            start_index=body.start_index,
            end_index=body.end_index,
            created_at=segment.created_at.isoformat(),
        )

    return SegmentOut(
        id=seg_id,
        document_id=body.document_id,
        text=body.text,
        start_index=body.start_index,
        end_index=body.end_index,
        code_id=body.code_id,
        code_label=code.label,
        code_colour=code.colour,
        user_id=body.user_id,
        created_at=segment.created_at,
    )


@router.get("/", response_model=list[SegmentOut])
def list_segments(
    document_id: str = "",
    user_id: str = "",
    db: Session = Depends(get_db),
):
    # Single JOIN query — avoids N+1 (one query per segment to fetch its code).
    query = db.query(CodedSegment, Code).outerjoin(Code, CodedSegment.code_id == Code.id)
    if document_id:
        query = query.filter(CodedSegment.document_id == document_id)
    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)
    rows = query.order_by(CodedSegment.created_at).all()

    return [
        SegmentOut(
            id=s.id,
            document_id=s.document_id,
            text=s.text,
            start_index=s.start_index,
            end_index=s.end_index,
            code_id=s.code_id,
            code_label=code.label if code else "?",
            code_colour=code.colour if code else "#ccc",
            user_id=s.user_id,
            created_at=s.created_at,
        )
        for s, code in rows
    ]


@router.delete("/{segment_id}")
def delete_segment(segment_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    seg = db.query(CodedSegment).filter(CodedSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Snapshot before deletion for edit history
    code = db.query(Code).filter(Code.id == seg.code_id).first()
    doc = db.query(Document).filter(Document.id == seg.document_id).first()
    project_id = code.project_id if code else (doc.project_id if doc else None)

    if project_id:
        db.add(EditEvent(
            id=str(uuid.uuid4()),
            project_id=project_id,
            document_id=seg.document_id,
            entity_type="segment",
            action="deleted",
            entity_id=segment_id,
            metadata_json={
                "code_label": code.label if code else "?",
                "code_colour": code.colour if code else "#ccc",
                "code_id": seg.code_id,
                "segment_text": seg.text[:200],
                "start_index": seg.start_index,
                "end_index": seg.end_index,
            },
            user_id=user_id,
        ))

    delete_segment_embedding(user_id, segment_id)
    db.delete(seg)
    db.commit()
    return {"status": "deleted"}


@router.post("/analyze")
async def trigger_analysis(
    body: AnalysisTrigger,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    code = db.query(Code).filter(Code.id == body.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    segment_count = (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == body.code_id, CodedSegment.user_id == body.user_id)
        .count()
    )
    if segment_count < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 segments to analyse")

    background_tasks.add_task(
        _run_analysis_background,
        code_id=body.code_id,
        code_label=code.label,
        user_id=body.user_id,
        user_definition=code.definition,
    )

    return {"status": "analysis_started", "code_id": body.code_id}


@router.get("/analyses", response_model=list[AnalysisOut])
def list_analyses(project_id: str = "", db: Session = Depends(get_db)):
    query = db.query(AnalysisResult)
    if project_id:
        query = query.join(Code, AnalysisResult.code_id == Code.id).filter(
            Code.project_id == project_id
        )
    results = query.all()
    out: list[AnalysisOut] = []
    for r in results:
        code = db.query(Code).filter(Code.id == r.code_id).first()
        if not code:
            continue
        out.append(AnalysisOut(
            code_id=r.code_id,
            code_label=code.label,
            definition=r.definition,
            lens=r.lens,
            reasoning=r.reasoning,
            segment_count=r.segment_count_at_analysis,
        ))
    return out


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(segment_id: str, db: Session = Depends(get_db)):
    """Fetch a single segment by ID."""
    row = (
        db.query(CodedSegment, Code)
        .outerjoin(Code, CodedSegment.code_id == Code.id)
        .filter(CodedSegment.id == segment_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg, code = row
    return SegmentOut(
        id=seg.id,
        document_id=seg.document_id,
        text=seg.text,
        start_index=seg.start_index,
        end_index=seg.end_index,
        code_id=seg.code_id,
        code_label=code.label if code else "?",
        code_colour=code.colour if code else "#ccc",
        user_id=seg.user_id,
        created_at=seg.created_at,
    )


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(user_id: str, unread_only: bool = True, db: Session = Depends(get_db)):
    query = db.query(AgentAlert).filter(AgentAlert.user_id == user_id)
    if unread_only:
        query = query.filter(AgentAlert.is_read == False)
    alerts = query.order_by(AgentAlert.created_at.desc()).limit(50).all()
    return [
        AlertOut(
            id=a.id,
            alert_type=a.alert_type,
            payload=a.payload,
            segment_id=a.segment_id,
            is_read=a.is_read,
            created_at=a.created_at,
        )
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AgentAlert).filter(AgentAlert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"status": "ok"}


@router.post("/batch-audit")
async def batch_audit(
    body: BatchAuditRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Run the Coding Audit agent across ALL codes in a project.

    Uses MMR diversity sampling to pick representative segments per code, then
    runs run_coding_audit on each. Results stream back via WebSocket as
    'coding_audit' events with batch=True.
    """
    if not settings.azure_api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured")

    codes = db.query(Code).filter(Code.project_id == body.project_id).all()
    if not codes:
        raise HTTPException(status_code=404, detail="No codes found for this project")

    background_tasks.add_task(
        _run_batch_audit_background,
        project_id=body.project_id,
        user_id=body.user_id,
    )
    return {"status": "batch_audit_started", "code_count": len(codes)}


def _ws_send(user_id: str, payload: dict):
    """Fire-and-forget send from a background thread via the main event loop."""
    ws_manager.send_alert_threadsafe(user_id, payload)


def _run_analysis_background(
    *,
    code_id: str,
    code_label: str,
    user_id: str,
    user_definition: str | None,
):
    """Background task for manual definition rerun — uses the same WS pipeline."""
    from database import SessionLocal
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
    from database import SessionLocal
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

        analyses = (
            db.query(AnalysisResult)
            .join(Code, AnalysisResult.code_id == Code.id)
            .filter(Code.project_id == project_id)
            .all()
        )
        code_definitions: dict[str, dict] = {}
        for a in analyses:
            code_obj = db.query(Code).filter(Code.id == a.code_id).first()
            if code_obj:
                code_definitions[code_obj.label] = {
                    "definition": a.definition or "",
                    "lens": a.lens or "",
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

                audit_result = run_coding_audit(
                    user_history=history,
                    code_definitions=code_definitions,
                    new_quote=representative["text"],
                    proposed_code=code.label,
                    user_code_definitions=user_code_definitions,
                    existing_codes_on_span=[],
                    centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
                    codebook_prob_dist=stage1["codebook_prob_dist"] if stage1 else None,
                    entropy=stage1["entropy"] if stage1 else None,
                    temporal_drift=stage1["temporal_drift"] if stage1 else None,
                    is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
                    segment_count=stage1["segment_count"] if stage1 else None,
                )

                # Filter alternative codes to only those that exist in the codebook
                self_lens = audit_result.get("self_lens", {})
                alt_codes = self_lens.get("alternative_codes", [])
                if alt_codes:
                    self_lens["alternative_codes"] = [
                        c for c in alt_codes if c in user_code_definitions
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
                inter_rater = audit_result.get("inter_rater_lens", {})
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
                    llm_conflict_severity=inter_rater.get("conflict_severity_score"),
                    llm_overall_severity=audit_result.get("overall_severity_score"),
                    llm_predicted_code=inter_rater.get("predicted_code"),
                    llm_predicted_confidence=inter_rater.get("predicted_code_confidence"),
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
    from database import SessionLocal
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

        # Fetch project-level perspective settings
        enabled_perspectives = None
        if project_id:
            from database import Project
            project_row = db.query(Project).filter(Project.id == project_id).first()
            if project_row and project_row.enabled_perspectives:
                enabled_perspectives = project_row.enabled_perspectives
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

        user_segment_count = (
            db.query(CodedSegment).filter(CodedSegment.user_id == user_id).count()
        )

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

            analyses = db.query(AnalysisResult).all()
            code_definitions: dict[str, dict] = {}
            for a in analyses:
                code_obj = db.query(Code).filter(Code.id == a.code_id).first()
                if code_obj:
                    code_definitions[code_obj.label] = {
                        "definition": a.definition or "",
                        "lens": a.lens or "",
                    }

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
                enabled_perspectives=enabled_perspectives,
            )

            # Post-process: filter alternative codes already on this span
            all_codes_on_span = set(existing_codes_on_span) | {code_label}
            self_lens = audit_result.get("self_lens", {})
            alt_codes = self_lens.get("alternative_codes", [])
            if alt_codes:
                self_lens["alternative_codes"] = [
                    c for c in alt_codes if c not in all_codes_on_span
                ]

            # Post-process: force is_conflict=False if predicted code already applied
            inter_rater = audit_result.get("inter_rater_lens", {})
            predicted = inter_rater.get("predicted_code", "")
            if predicted in all_codes_on_span:
                inter_rater["is_conflict"] = False
                inter_rater["conflict_explanation"] = ""

            # Filter predicted_codes: remove any already applied on this span
            predicted_codes_raw = inter_rater.get("predicted_codes", [])
            if isinstance(predicted_codes_raw, list):
                inter_rater["predicted_codes"] = [
                    pc for pc in predicted_codes_raw
                    if pc.get("code") not in all_codes_on_span
                ]

            is_consistent = self_lens.get("is_consistent", True)
            is_conflict = inter_rater.get("is_conflict", False)

            alert = AgentAlert(
                id=str(uuid.uuid4()),
                user_id=user_id,
                segment_id=segment_id,
                alert_type="coding_audit",
                payload=audit_result,
            )
            db.add(alert)

            # Persist ConsistencyScore row (Stage 1 + Stage 2 + Stage 3)
            escalation = audit_result.get("_escalation", {})

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
                # Stage 2
                llm_consistency_score=self_lens.get("consistency_score"),
                llm_intent_score=self_lens.get("intent_alignment_score"),
                llm_conflict_severity=inter_rater.get("conflict_severity_score"),
                llm_overall_severity=audit_result.get("overall_severity_score"),
                llm_predicted_code=inter_rater.get("predicted_code"),
                llm_predicted_confidence=inter_rater.get("predicted_code_confidence"),
                llm_predicted_codes_json=inter_rater.get("predicted_codes"),
                # Stage 3
                was_escalated=escalation.get("was_escalated", False),
                escalation_reason=escalation.get("reason"),
            )
            db.add(score_row)
            db.commit()

            _ws_send(user_id, {
                "type": "coding_audit",
                "segment_id": segment_id,
                "segment_text": text,
                "code_id": code_id,
                "code_label": code_label,
                "is_consistent": is_consistent,
                "is_conflict": is_conflict,
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

        # 3. Auto-analysis
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
