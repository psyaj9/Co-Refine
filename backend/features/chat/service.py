"""Chat service: context building and streaming orchestration."""
import uuid
from typing import Generator

from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Code, AnalysisResult, CodedSegment, ChatMessage
from core.config import settings
from core.logging import get_logger
from infrastructure.llm.client import call_llm, get_client
from infrastructure.websocket.manager import ws_manager
from prompts.chat_prompt import build_chat_messages

logger = get_logger(__name__)


def build_codebook(db: Session, project_id: str) -> list[dict]:
    """Build codebook context from codes + analyses.

    Uses a single JOIN query + one aggregation query to avoid N+1.
    """
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    if not codes:
        return []

    code_ids = [c.id for c in codes]

    # Batch fetch all analyses in one query
    analyses = {
        a.code_id: a
        for a in db.query(AnalysisResult).filter(AnalysisResult.code_id.in_(code_ids)).all()
    }
    # Batch fetch all segment counts in one aggregation query
    seg_counts = {
        row.code_id: row.count
        for row in db.query(
            CodedSegment.code_id, func.count(CodedSegment.id).label("count")
        )
        .filter(CodedSegment.code_id.in_(code_ids))
        .group_by(CodedSegment.code_id)
        .all()
    }

    codebook: list[dict] = []
    for code in codes:
        analysis = analyses.get(code.id)
        codebook.append({
            "label": code.label,
            "user_definition": code.definition or "",
            "ai_definition": analysis.definition if analysis else "",
            "lens": analysis.lens if analysis else "",
            "segment_count": seg_counts.get(code.id, 0),
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


def stream_chat_response(
    messages: list[dict],
    model: str | None = None,
) -> Generator[str, None, None]:
    """Stream chat tokens from Azure OpenAI, yielding text chunks as they arrive."""
    client = get_client()
    response = client.chat.completions.create(
        model=model or settings.azure_deployment_fast,
        messages=messages,
        stream=True,
    )
    for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if not delta or not delta.content:
            continue
        yield delta.content


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
    """Run streaming LLM call in a background task, sending tokens via WebSocket."""
    from core.database import SessionLocal

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
