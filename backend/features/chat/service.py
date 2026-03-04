"""Chat service: context building and streaming orchestration.

Extracted from routers/chat.py helper functions.
"""
import uuid
from typing import Generator

from sqlalchemy.orm import Session

from core.models import Code, AnalysisResult, CodedSegment, ChatMessage
from core.logging import get_logger
from infrastructure.websocket.manager import ws_manager
from prompts.chat_prompt import build_chat_messages

logger = get_logger(__name__)


def build_codebook(db: Session, project_id: str) -> list[dict]:
    """Build codebook context from codes + analyses."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    codebook: list[dict] = []
    for code in codes:
        analysis = (
            db.query(AnalysisResult).filter(AnalysisResult.code_id == code.id).first()
        )
        seg_count = db.query(CodedSegment).filter(CodedSegment.code_id == code.id).count()
        codebook.append({
            "label": code.label,
            "user_definition": code.definition or "",
            "ai_definition": analysis.definition if analysis else "",
            "lens": analysis.lens if analysis else "",
            "segment_count": seg_count,
        })
    return codebook


def retrieve_segments(user_id: str, query: str) -> list[dict]:
    """Semantic search over coded segments."""
    try:
        from infrastructure.vector_store.store import find_similar_segments
        return find_similar_segments(user_id=user_id, query_text=query, top_k=8)
    except Exception as e:
        logger.warning("Segment retrieval failed", extra={"error": str(e)})
        return []


def get_conversation_history_dicts(db: Session, conversation_id: str) -> list[dict]:
    from features.chat.repository import get_conversation_messages
    messages = get_conversation_messages(db, conversation_id)
    return [{"role": m.role, "content": m.content} for m in messages]


def stream_response_background(
    *,
    conversation_id: str,
    project_id: str,
    user_id: str,
    user_message: str,
    codebook: list[dict],
    retrieved_segments: list[dict],
    conversation_history: list[dict],
) -> None:
    """Run streaming LLM call in a background task, sending tokens via WS."""
    from core.database import SessionLocal
    from services.ai_analyzer import stream_chat_response

    messages = build_chat_messages(
        user_message=user_message,
        codebook=codebook,
        retrieved_segments=retrieved_segments,
        conversation_history=conversation_history,
    )

    full_response = ""

    try:
        ws_manager.send_alert_threadsafe(user_id, {
            "type": "chat_stream_start",
            "conversation_id": conversation_id,
            "data": {},
        })

        for token in stream_chat_response(messages):
            full_response += token
            ws_manager.send_alert_threadsafe(user_id, {
                "type": "chat_token",
                "conversation_id": conversation_id,
                "token": token,
                "data": {},
            })

        ws_manager.send_alert_threadsafe(user_id, {
            "type": "chat_done",
            "conversation_id": conversation_id,
            "data": {},
        })

    except Exception as e:
        logger.error("Chat streaming error", extra={"error": str(e)})
        ws_manager.send_alert_threadsafe(user_id, {
            "type": "chat_error",
            "conversation_id": conversation_id,
            "data": {"message": str(e)},
        })

    if full_response:
        db = SessionLocal()
        try:
            assistant_msg = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                project_id=project_id,
                user_id=user_id,
                role="assistant",
                content=full_response,
            )
            db.add(assistant_msg)
            db.commit()
        finally:
            db.close()
