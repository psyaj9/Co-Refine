"""
Chat service

Context assembly and streaming LLM response logic.
"""
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
    """Assemble a structured codebook for use in the chat system prompt.

    Combines code labels, user definitions, AI-inferred definitions, lenses,
    and segment counts.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project whose codes to include.

    Returns:
        List of dicts, one per code, with label/user_definition/ai_definition/lens/segment_count.
        Empty list if the project has no codes.
    """
    codes = db.query(Code).filter(Code.project_id == project_id).all()

    if not codes:
        return []

    code_ids = [c.id for c in codes]

    analyses = {
        a.code_id: a
        for a in db.query(AnalysisResult).filter(AnalysisResult.code_id.in_(code_ids)).all()
    }

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
    """Fetch semantically similar coded segments for use as RAG context.


    Args:
        user_id: Used to scope the ChromaDB collection to this user's segments.
        query: The user's chat message, used as the search query.

    Returns:
        List of segment dicts (text, code, similarity) or empty list on failure.
    """
    try:
        from infrastructure.vector_store.store import find_similar_segments
        return find_similar_segments(user_id=user_id, query_text=query, top_k=8)

    except Exception as e:
        logger.warning("Segment retrieval failed", extra={"error": str(e)})
        return []


def get_conversation_history_dicts(db: Session, conversation_id: str) -> list[dict]:
    """Load conversation history as a list of role/content dicts for the LLM.

    Args:
        db: Active SQLAlchemy session.
        conversation_id: Conversation to load.

    Returns:
        List of {"role": ..., "content": ...} dicts.
    """
    from features.chat.repository import get_conversation_messages

    messages = get_conversation_messages(db, conversation_id)

    return [{"role": m.role, "content": m.content} for m in messages]


def stream_chat_response(
    messages: list[dict],
    model: str | None = None,
) -> Generator[str, None, None]:
    """Call LLM in streaming mode and yield tokens one at a time.

    Args:
        messages: Full messages list (system + history + user message).
        model: Override the default deployment.

    Yields:
        Individual token strings from the stream.
    """
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
    """Run the full LLM streaming loop and persist the assistant reply.


    The assistant message is only written if we actually got a response

    Args:
        conversation_id: Used to tag WS events so the frontend can route them.
        project_id: Used when persisting the assistant message.
        user_id: Used to identify the WS connection and scope the message.
        user_message: The raw text of what the user asked.
        codebook: Assembled codebook context.
        retrieved_segments: RAG results.
        conversation_history: Prior turns in this conversation.
    """
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
