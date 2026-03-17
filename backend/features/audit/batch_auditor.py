from __future__ import annotations

import uuid

from core.database import SessionLocal
from core.models import Code, CodedSegment, AnalysisResult, AgentAlert, ConsistencyScore
from core.config import settings
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from infrastructure.vector_store.store import get_all_segments_for_code
from features.audit.context_builder import build_code_definitions, build_user_code_definitions
from core import events as ev
from features.audit.score_persister import persist_consistency_score, persist_agent_alert
from features.scoring.code_overlap import compute_code_overlap_matrix

logger = get_logger(__name__)


def _get_existing_codes_on_span(db, rep_seg) -> list[str]:
    if not rep_seg:
        return []
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
    return list({c.label for _seg, c in overlapping})


def _apply_audit_to_code(
    db,
    code: Code,
    diverse: list[dict],
    code_definitions: dict,
    user_code_definitions: dict,
    all_code_labels: list[str],
    project_id: str,
    user_id: str,
) -> None:
    
    from features.audit.llm_auditor import run_coding_audit
    from features.scoring.pipeline import compute_stage1_scores

    representative = diverse[-1]
    history = [(s["code"], s["text"]) for s in diverse[:-1]]

    stage1 = None

    try:
        stage1 = compute_stage1_scores(
            user_id=user_id,
            segment_text=representative["text"],
            code_label=code.label,
            all_code_labels=all_code_labels,
            code_definition=code.definition,
        )

    except Exception as e:
        logger.warning("Batch stage1 error", extra={"code": code.label, "error": str(e)})

    rep_seg = db.query(CodedSegment).filter(CodedSegment.id == representative["id"]).first()
    existing_codes_on_span = _get_existing_codes_on_span(db, rep_seg)

    audit_result = run_coding_audit(
        user_history=history,
        code_definitions=code_definitions,
        new_quote=representative["text"],
        proposed_code=code.label,
        user_code_definitions=user_code_definitions,
        existing_codes_on_span=existing_codes_on_span,
        centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
        temporal_drift=stage1["temporal_drift"] if stage1 else None,
        is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
        segment_count=stage1["segment_count"] if stage1 else None,
    )

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

    persist_agent_alert(db=db, user_id=user_id, segment_id=representative["id"], audit_result=audit_result)

    persist_consistency_score(
        db=db, segment_id=representative["id"], code_id=code.id,
        user_id=user_id, project_id=project_id, stage1=stage1, audit_result=audit_result,
    )

    db.commit()

    ws_manager.send_alert_threadsafe(user_id, {
        "type": ev.CODING_AUDIT,
        "segment_id": representative["id"],
        "segment_text": representative["text"],
        "code_id": code.id,
        "code_label": code.label,
        "batch": True,
        "deterministic_scores": stage1,
        "data": audit_result,
    })


def _compute_and_send_overlap(user_id: str, project_id: str, all_code_labels: list[str]) -> None:

    try:
        overlap_matrix = compute_code_overlap_matrix(user_id, all_code_labels)
        ws_manager.send_alert_threadsafe(user_id, {
            "type": ev.CODE_OVERLAP_MATRIX,
            "project_id": project_id,
            "data": overlap_matrix,
        })
    except Exception as e:
        logger.error("Code overlap matrix error", extra={"error": str(e)})


def _send_temporal_drift_warnings(db, project_id: str, user_id: str, all_codes: list[Code]) -> None:

    try:
        threshold = settings.drift_warning_threshold
        for code in all_codes:
            drift_rows = (
                db.query(ConsistencyScore.temporal_drift)
                .filter(
                    ConsistencyScore.project_id == project_id,
                    ConsistencyScore.code_id == code.id,
                    ConsistencyScore.temporal_drift.isnot(None),
                    ConsistencyScore.is_pseudo_centroid == False,
                )
                .all()
            )
            drift_vals = [r.temporal_drift for r in drift_rows]
            if len(drift_vals) >= 2:
                avg_drift = sum(drift_vals) / len(drift_vals)
                if avg_drift > threshold:
                    ws_manager.send_alert_threadsafe(user_id, {
                        "type": ev.TEMPORAL_DRIFT_WARNING,
                        "code_id": code.id,
                        "code_label": code.label,
                        "data": {
                            "avg_drift": round(avg_drift, 4),
                            "sample_count": len(drift_vals),
                            "threshold": threshold,
                            "message": (
                                f"The meaning of '{code.label}' has shifted over time "
                                f"(avg drift={avg_drift:.2f}). Review early vs. recent uses "
                                f"and consider refining the definition or splitting the code."
                            ),
                        },
                    })

    except Exception as e:
        logger.error("Temporal drift warning check error", extra={"error": str(e)})


def run_batch_audit_background(*, project_id: str, user_id: str) -> None:

    db = SessionLocal()
    try:
        all_codes = db.query(Code).filter(Code.project_id == project_id).all()
        total = len(all_codes)

        ws_manager.send_alert_threadsafe(user_id, {"type": ev.BATCH_AUDIT_STARTED, "data": {"total_codes": total}})

        user_code_definitions = build_user_code_definitions(db, project_id)
        code_definitions = build_code_definitions(db, project_id)
        all_code_labels = [c.label for c in all_codes]

        for i, code in enumerate(all_codes):
            diverse = get_all_segments_for_code(user_id=user_id, code_label=code.label)

            if not diverse:
                ws_manager.send_alert_threadsafe(user_id, {
                    "type": ev.BATCH_AUDIT_PROGRESS,
                    "data": {"completed": i + 1, "total": total, "code_label": code.label, "skipped": True},
                })
                continue

            try:
                _apply_audit_to_code(
                    db=db, code=code, diverse=diverse,
                    code_definitions=code_definitions,
                    user_code_definitions=user_code_definitions,
                    all_code_labels=all_code_labels,
                    project_id=project_id, user_id=user_id,
                )
            except Exception as e:
                logger.error("Batch audit error", extra={"code": code.label, "error": str(e)})

            ws_manager.send_alert_threadsafe(user_id, {
                "type": ev.BATCH_AUDIT_PROGRESS,
                "data": {"completed": i + 1, "total": total, "code_label": code.label},
            })

        _compute_and_send_overlap(user_id=user_id, project_id=project_id, all_code_labels=all_code_labels)
        _send_temporal_drift_warnings(db=db, project_id=project_id, user_id=user_id, all_codes=all_codes)

        ws_manager.send_alert_threadsafe(user_id, {"type": ev.BATCH_AUDIT_DONE, "data": {"total_codes": total}})

    except Exception as e:
        logger.error("Batch audit fatal error", extra={"error": str(e)})
        ws_manager.send_alert_threadsafe(user_id, {"type": ev.BATCH_AUDIT_DONE, "data": {"error": str(e)}})
        
    finally:
        db.close()
