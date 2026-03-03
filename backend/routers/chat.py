from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

from database import (
    get_db, Code, AnalysisResult, ChatMessage, CodedSegment,
)
from models import ChatRequest, ChatMessageOut
from services.ai_analyzer import stream_chat_response
from services.vector_store import find_similar_segments
from services.ws_manager import ws_manager
from prompts.chat_prompt import build_chat_messages
from config import settings

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/")
async def send_chat_message(
    body: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not settings.azure_api_key:
        raise HTTPException(status_code=503, detail="No API key configured")

    conversation_id = body.conversation_id or str(uuid.uuid4())

    # Persist user message
    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        project_id=body.project_id,
        user_id=body.user_id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    db.commit()

    # Build context
    codebook = _build_codebook(db, body.project_id)
    retrieved_segments = _retrieve_segments(body.user_id, body.message)
    conversation_history = _get_conversation_history(db, conversation_id)

    # Schedule streaming response in background
    background_tasks.add_task(
        _stream_response_background,
        conversation_id=conversation_id,
        project_id=body.project_id,
        user_id=body.user_id,
        user_message=body.message,
        codebook=codebook,
        retrieved_segments=retrieved_segments,
        conversation_history=conversation_history,
    )

    return {"conversation_id": conversation_id, "status": "streaming"}


@router.get("/history/{conversation_id}", response_model=list[ChatMessageOut])
def get_conversation_history(conversation_id: str, db: Session = Depends(get_db)):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [
        ChatMessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.get("/conversations")
def list_conversations(
    project_id: str,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """Return distinct conversation IDs with their first user message."""
    from sqlalchemy import func, distinct

    conversations = (
        db.query(
            ChatMessage.conversation_id,
            func.min(ChatMessage.created_at).label("started_at"),
        )
        .filter(
            ChatMessage.project_id == project_id,
            ChatMessage.user_id == user_id,
        )
        .group_by(ChatMessage.conversation_id)
        .order_by(func.min(ChatMessage.created_at).desc())
        .limit(20)
        .all()
    )

    results = []
    for conv_id, started_at in conversations:
        first_msg = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.conversation_id == conv_id,
                ChatMessage.role == "user",
            )
            .order_by(ChatMessage.created_at)
            .first()
        )
        results.append({
            "conversation_id": conv_id,
            "preview": (first_msg.content[:80] + "...") if first_msg and len(first_msg.content) > 80 else (first_msg.content if first_msg else ""),
            "started_at": started_at.isoformat() if started_at else None,
        })
    return results


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).delete()
    db.commit()
    return {"status": "deleted"}


# ========== Helpers ==========

def _build_codebook(db: Session, project_id: str) -> list[dict]:
    """Build codebook context from codes + analyses."""
    codes = db.query(Code).filter(Code.project_id == project_id).all()
    codebook: list[dict] = []
    for code in codes:
        analysis = (
            db.query(AnalysisResult).filter(AnalysisResult.code_id == code.id).first()
        )
        seg_count = (
            db.query(CodedSegment).filter(CodedSegment.code_id == code.id).count()
        )
        entry: dict = {
            "label": code.label,
            "user_definition": code.definition or "",
            "ai_definition": analysis.definition if analysis else "",
            "lens": analysis.lens if analysis else "",
            "segment_count": seg_count,
        }
        codebook.append(entry)
    return codebook


def _retrieve_segments(user_id: str, query: str) -> list[dict]:
    """Semantic search over coded segments."""
    try:
        return find_similar_segments(user_id=user_id, query_text=query, top_k=8)
    except Exception:
        return []


def _get_conversation_history(db: Session, conversation_id: str) -> list[dict]:
    """Fetch previous messages in this conversation."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in messages]


def _stream_response_background(
    *,
    conversation_id: str,
    project_id: str,
    user_id: str,
    user_message: str,
    codebook: list[dict],
    retrieved_segments: list[dict],
    conversation_history: list[dict],
):
    """Run the streaming LLM call in a background task, sending tokens via WS."""
    from database import SessionLocal

    messages = build_chat_messages(
        user_message=user_message,
        codebook=codebook,
        retrieved_segments=retrieved_segments,
        conversation_history=conversation_history,
    )

    full_response = ""

    try:
        # Notify frontend: streaming started
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

        # Notify frontend: streaming done
        ws_manager.send_alert_threadsafe(user_id, {
            "type": "chat_done",
            "conversation_id": conversation_id,
            "data": {},
        })

    except Exception as e:
        print(f"[Chat] Streaming error: {e}")
        ws_manager.send_alert_threadsafe(user_id, {
            "type": "chat_error",
            "conversation_id": conversation_id,
            "data": {"message": str(e)},
        })

    # Persist assistant message
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
