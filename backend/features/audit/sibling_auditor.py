"""Sibling re-audit: re-run audit for overlapping segments after create/delete."""
from __future__ import annotations

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models import CodedSegment, Code, Document, AnalysisResult, ConsistencyScore
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from infrastructure.vector_store.store import get_all_segments_for_code
from features.audit.context_builder import extract_window, build_code_definitions, build_user_code_definitions
from features.audit.score_persister import persist_consistency_score, persist_agent_alert

logger = get_logger(__name__)


def _ws_send(user_id: str, payload: dict) -> None:
    ws_manager.send_alert_threadsafe(user_id, payload)


def reaudit_siblings(
    *,
    db: Session,
    document_id: str,
    start_index: int,
    end_index: int,
    exclude_segment_id: str,
    user_id: str,
) -> None:
    """Re-run audit for every sibling segment on the same text span."""
    from services.ai_analyzer import run_coding_audit

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
            all_codes = db.query(Code).filter(Code.project_id == project_id).all() if project_id else []
            user_code_definitions = {c.label: (c.definition or "") for c in all_codes}

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
            existing_codes_on_span: list[str] = list({c.label for _s, c in overlapping})

            existing_score = (
                db.query(ConsistencyScore)
                .filter(
                    ConsistencyScore.segment_id == sib_seg.id,
                    ConsistencyScore.code_id == sib_code.id,
                )
                .first()
            )

            stage1_centroid = existing_score.centroid_similarity if existing_score else None
            stage1_drift = existing_score.temporal_drift if existing_score else None
            stage1_pseudo = existing_score.is_pseudo_centroid if existing_score else False

            diverse = get_all_segments_for_code(
                user_id=user_id, code_label=sib_code.label, exclude_id=sib_seg.id,
            )
            user_history = [(s["code"], s["text"]) for s in diverse]

            code_definitions = build_code_definitions(db, project_id) if project_id else {}

            doc = db.query(Document).filter(Document.id == document_id).first()
            document_context = ""
            if doc and doc.full_text:
                document_context = extract_window(doc.full_text, sib_seg.start_index, sib_seg.end_index)

            audit_result = run_coding_audit(
                user_history=user_history,
                code_definitions=code_definitions,
                new_quote=sib_seg.text,
                proposed_code=sib_code.label,
                document_context=document_context,
                user_code_definitions=user_code_definitions,
                existing_codes_on_span=existing_codes_on_span,
                centroid_similarity=stage1_centroid,
                temporal_drift=stage1_drift,
                is_pseudo_centroid=stage1_pseudo,
            )

            all_codes_on_span = set(existing_codes_on_span) | {sib_code.label}
            self_lens = audit_result.get("self_lens", {})
            alt_codes = self_lens.get("alternative_codes", [])
            if alt_codes:
                self_lens["alternative_codes"] = [c for c in alt_codes if c not in all_codes_on_span]

            persist_agent_alert(db=db, user_id=user_id, segment_id=sib_seg.id, audit_result=audit_result, delete_existing=True)

            sibling_stage1 = {
                "centroid_similarity": stage1_centroid,
                "is_pseudo_centroid": stage1_pseudo,
                "temporal_drift": stage1_drift,
            } if stage1_centroid is not None else None

            persist_consistency_score(
                db=db, segment_id=sib_seg.id, code_id=sib_code.id,
                user_id=user_id, project_id=project_id or "",
                stage1=sibling_stage1, audit_result=audit_result, delete_existing=True,
            )
            db.commit()

            escalation = audit_result.get("_escalation", {})
            is_consistent = self_lens.get("is_consistent", True)
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
                    "temporal_drift": stage1_drift,
                } if stage1_centroid is not None else None,
                "escalation": escalation,
                "data": audit_result,
            })
            logger.info("Re-audited sibling segment", extra={"segment_id": sib_seg.id, "code": sib_code.label})
        except Exception as e:
            logger.error("Sibling re-audit error", extra={"segment_id": sib_seg.id, "error": str(e)})


def reaudit_siblings_background(
    *,
    document_id: str,
    start_index: int,
    end_index: int,
    exclude_segment_id: str,
    user_id: str,
) -> None:
    """Background-task wrapper for reaudit_siblings."""
    db = SessionLocal()
    try:
        reaudit_siblings(
            db=db,
            document_id=document_id,
            start_index=start_index,
            end_index=end_index,
            exclude_segment_id=exclude_segment_id,
            user_id=user_id,
        )
    except Exception as e:
        logger.error("Background sibling re-audit error", extra={"error": str(e)})
    finally:
        db.close()
