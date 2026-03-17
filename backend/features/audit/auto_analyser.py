from __future__ import annotations
import uuid

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models import Code, CodedSegment, AnalysisResult
from core.config import settings
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from core import events as ev
from infrastructure.llm.json_parser import PARSE_FAILED_SENTINEL

logger = get_logger(__name__)


def _persist_analysis_result(
    *,
    db: Session,
    code_id: str,
    code_label: str,
    user_id: str,
    segment_id: str | None,
    analysis_result: dict,
    segment_count: int,
) -> None:
    existing = db.query(AnalysisResult).filter(AnalysisResult.code_id == code_id).first()
    raw_reasoning = analysis_result.get("reasoning")
    reasoning_str = "\n".join(raw_reasoning) if isinstance(raw_reasoning, list) else raw_reasoning
    analysis = AnalysisResult(
        id=existing.id if existing else str(uuid.uuid4()),
        code_id=code_id,
        definition=analysis_result.get("definition"),
        lens=analysis_result.get("lens"),
        reasoning=reasoning_str,
        segment_count_at_analysis=segment_count,
    )
    db.merge(analysis)
    db.commit()
    ws_manager.send_alert_threadsafe(user_id, {
        "type": ev.ANALYSIS_UPDATED,
        "code_id": code_id,
        "code_label": code_label,
        **({"segment_id": segment_id} if segment_id else {}),
        "data": analysis_result,
    })


def run_manual_analysis(
    *,
    code_id: str,
    code_label: str,
    user_id: str,
    user_definition: str | None,
) -> None:
    from features.audit.llm_auditor import analyse_quotes

    db = SessionLocal()
    ws_manager.send_alert_threadsafe(user_id, {"type": ev.AGENTS_STARTED, "data": {"source": "manual_analysis"}})
    ws_manager.send_alert_threadsafe(user_id, {"type": ev.AGENT_THINKING, "agent": "analysis", "data": {}})

    try:
        all_quotes = [
            s.text
            for s in db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .all()
        ]

        analysis_result = analyse_quotes(code_label, all_quotes, user_definition=user_definition)

        if analysis_result.get("definition") == PARSE_FAILED_SENTINEL:
            logger.warning("Analysis parse failure", extra={"code_label": code_label})
            ws_manager.send_alert_threadsafe(user_id, {
                "type": ev.AGENT_ERROR,
                "agent": "analysis",
                "data": {"message": "AI could not generate a definition — please try again."},
            })
        else:
            _persist_analysis_result(
                db=db, code_id=code_id, code_label=code_label,
                user_id=user_id, segment_id=None,
                analysis_result=analysis_result, segment_count=len(all_quotes),
            )

    except Exception as e:
        logger.error("Manual analysis error", extra={"error": str(e), "code_label": code_label})
        ws_manager.send_alert_threadsafe(user_id, {"type": ev.AGENT_ERROR, "agent": "analysis", "data": {"message": str(e)}})

    finally:
        ws_manager.send_alert_threadsafe(user_id, {"type": ev.AGENTS_DONE, "data": {}})
        db.close()


def maybe_run_auto_analysis(
    *,
    db: Session,
    code_id: str,
    code_label: str,
    user_id: str,
    segment_id: str,
) -> None:
    from features.audit.llm_auditor import analyse_quotes

    code_segment_count = (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .count()
    )

    existing_analysis = db.query(AnalysisResult).filter(AnalysisResult.code_id == code_id).first()
    last_count = existing_analysis.segment_count_at_analysis if existing_analysis else 0

    if code_segment_count < settings.auto_analysis_threshold:
        return

    if not (code_segment_count - last_count >= settings.auto_analysis_threshold or last_count == 0):
        return

    ws_manager.send_alert_threadsafe(user_id, {"type": ev.AGENT_THINKING, "agent": "analysis", "segment_id": segment_id, "data": {}})
    try:
        all_quotes = [
            s.text
            for s in db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .all()
        ]

        current_code = db.query(Code).filter(Code.id == code_id).first()
        analysis_result = analyse_quotes(code_label, all_quotes, user_definition=current_code.definition if current_code else None)

        if analysis_result.get("definition") == PARSE_FAILED_SENTINEL:
            logger.warning("Auto-analysis parse failure", extra={"code_label": code_label})
            ws_manager.send_alert_threadsafe(user_id, {
                "type": ev.AGENT_ERROR,
                "agent": "analysis",
                "segment_id": segment_id,
                "data": {"message": "AI could not generate a definition — will retry next time."},
            })
        else:
            _persist_analysis_result(
                db=db, code_id=code_id, code_label=code_label,
                user_id=user_id, segment_id=segment_id,
                analysis_result=analysis_result, segment_count=code_segment_count,
            )

    except Exception as e:
        logger.error("Auto-analysis error", extra={"error": str(e), "code_label": code_label})
        ws_manager.send_alert_threadsafe(user_id, {"type": ev.AGENT_ERROR, "agent": "analysis", "segment_id": segment_id, "data": {"message": str(e)}})
