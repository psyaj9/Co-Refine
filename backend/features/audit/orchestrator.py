"""Main audit orchestrator: run_background_agents pipeline."""
from __future__ import annotations
import uuid

from core.database import SessionLocal
from core.models import Code, CodedSegment, Document, AnalysisResult
from core.config import settings
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from infrastructure.vector_store.store import add_segment_embedding
from infrastructure.vector_store.mmr import find_diverse_segments
from features.audit.context_builder import build_code_definitions, build_user_code_definitions
from features.audit.score_persister import persist_consistency_score, persist_agent_alert
from features.audit.auto_analyzer import maybe_run_auto_analysis

logger = get_logger(__name__)


def _ws_send(user_id: str, payload: dict) -> None:
    ws_manager.send_alert_threadsafe(user_id, payload)


def run_background_agents(
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
) -> None:
    """Full audit pipeline for a newly created segment."""
    from services.ai_analyzer import run_coding_audit
    from features.scoring.pipeline import compute_stage1_scores

    db = SessionLocal()
    _ws_send(user_id, {"type": "agents_started", "segment_id": segment_id, "data": {}})

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
            logger.error("Embedding failed", extra={"segment_id": segment_id, "error": str(e)})

        current_code = db.query(Code).filter(Code.id == code_id).first()
        project_id = current_code.project_id if current_code else None
        all_codes = db.query(Code).filter(Code.project_id == project_id).all() if project_id else []

        user_code_definitions = {c.label: (c.definition or "") for c in all_codes}

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
        existing_codes_on_span: list[str] = list({c.label for _seg, c in overlapping_segments})

        # 2. Stage 1 — deterministic scores
        stage1 = None
        try:
            all_code_labels = [c.label for c in all_codes]
            current_definition = current_code.definition if current_code and current_code.definition else None
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
            logger.error("Stage 1 scoring failed", extra={"segment_id": segment_id, "error": str(e)})

        # 3. Coding Audit
        _ws_send(user_id, {"type": "agent_thinking", "agent": "coding_audit", "segment_id": segment_id, "data": {}})
        try:
            diverse = find_diverse_segments(
                user_id=user_id, query_text=text, code_filter=code_label, n=10,
            )
            user_history = [(s["code"], s["text"]) for s in diverse]

            code_definitions = build_code_definitions(db, project_id) if project_id else {}

            audit_result = run_coding_audit(
                user_history=user_history,
                code_definitions=code_definitions,
                new_quote=text,
                proposed_code=code_label,
                document_context=document_context,
                user_code_definitions=user_code_definitions,
                existing_codes_on_span=existing_codes_on_span,
                centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
                codebook_prob_dist=stage1["codebook_prob_dist"] if stage1 else None,
                entropy=stage1["entropy"] if stage1 else None,
                temporal_drift=stage1["temporal_drift"] if stage1 else None,
                is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
                segment_count=stage1["segment_count"] if stage1 else None,
                enable_reflection=True,
                reflection_history=user_history,
            )

            reflection_meta = audit_result.get("_reflection", {})
            if reflection_meta.get("was_reflected"):
                _ws_send(user_id, {
                    "type": "reflection_complete",
                    "segment_id": segment_id,
                    "data": reflection_meta,
                })

            all_codes_on_span = set(existing_codes_on_span) | {code_label}
            self_lens = audit_result.get("self_lens", {})
            alt_codes = self_lens.get("alternative_codes", [])
            if alt_codes:
                self_lens["alternative_codes"] = [c for c in alt_codes if c not in all_codes_on_span]

            is_consistent = self_lens.get("is_consistent", True)

            persist_agent_alert(db=db, user_id=user_id, segment_id=segment_id, audit_result=audit_result)
            persist_consistency_score(
                db=db, segment_id=segment_id, code_id=code_id,
                user_id=user_id, project_id=project_id or "",
                stage1=stage1, audit_result=audit_result,
            )
            db.commit()

            # Facet analysis
            try:
                from features.facets.service import run_facet_analysis
                facet_result = run_facet_analysis(db=db, user_id=user_id, code_id=code_id, project_id=project_id or "")
                if facet_result["status"] == "success":
                    _ws_send(user_id, {
                        "type": "facet_updated",
                        "code_id": code_id,
                        "facet_count": facet_result["facet_count"],
                        "segment_count": facet_result["segment_count"],
                    })
            except Exception as e:
                logger.error("Facet analysis error", extra={"code_id": code_id, "error": str(e)})

            escalation = audit_result.get("_escalation", {})
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
            logger.error("Coding audit error", extra={"segment_id": segment_id, "error": str(e)})
            _ws_send(user_id, {"type": "agent_error", "agent": "coding_audit", "segment_id": segment_id, "data": {"message": str(e)}})

        # 4. Auto-analysis
        maybe_run_auto_analysis(
            db=db, code_id=code_id, code_label=code_label, user_id=user_id, segment_id=segment_id,
        )

    finally:
        _ws_send(user_id, {"type": "agents_done", "segment_id": segment_id, "data": {}})
        db.close()
