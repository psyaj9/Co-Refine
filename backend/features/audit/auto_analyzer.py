"""Auto-analysis and manual analysis triggers."""
from __future__ import annotations
import uuid

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models import CodedSegment, AnalysisResult
from core.config import settings
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from infrastructure.llm.json_parser import PARSE_FAILED_SENTINEL

logger = get_logger(__name__)


def _ws_send(user_id: str, payload: dict) -> None:
    ws_manager.send_alert_threadsafe(user_id, payload)


def run_manual_analysis(
    *,
    code_id: str,
    code_label: str,
    user_id: str,
    user_definition: str | None,
) -> None:
    """Background task for manual analysis trigger."""
    from services.ai_analyzer import analyze_quotes

    db = SessionLocal()
    _ws_send(user_id, {"type": "agents_started", "data": {"source": "manual_analysis"}})
    _ws_send(user_id, {"type": "agent_thinking", "agent": "analysis", "data": {}})

    try:
        all_quotes = [
            s.text
            for s in db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .all()
        ]
        analysis_result = analyze_quotes(code_label, all_quotes, user_definition=user_definition)

        if analysis_result.get("definition") == PARSE_FAILED_SENTINEL:
            logger.warning("Analysis parse failure", extra={"code_label": code_label})
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
        logger.error("Manual analysis error", extra={"error": str(e), "code_label": code_label})
        _ws_send(user_id, {"type": "agent_error", "agent": "analysis", "data": {"message": str(e)}})
    finally:
        _ws_send(user_id, {"type": "agents_done", "data": {}})
        db.close()


def maybe_run_auto_analysis(
    *,
    db: Session,
    code_id: str,
    code_label: str,
    user_id: str,
    segment_id: str,
) -> None:
    """Trigger auto-analysis if segment count threshold is met."""
    from services.ai_analyzer import analyze_quotes

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

    _ws_send(user_id, {"type": "agent_thinking", "agent": "analysis", "segment_id": segment_id, "data": {}})
    try:
        all_quotes = [
            s.text
            for s in db.query(CodedSegment)
            .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
            .all()
        ]
        from core.models import Code
        current_code = db.query(Code).filter(Code.id == code_id).first()
        current_code_def = current_code.definition if current_code else None
        analysis_result = analyze_quotes(code_label, all_quotes, user_definition=current_code_def)

        if analysis_result.get("definition") == PARSE_FAILED_SENTINEL:
            logger.warning("Auto-analysis parse failure", extra={"code_label": code_label})
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
        logger.error("Auto-analysis error", extra={"error": str(e), "code_label": code_label})
        _ws_send(user_id, {"type": "agent_error", "agent": "analysis", "segment_id": segment_id, "data": {"message": str(e)}})
