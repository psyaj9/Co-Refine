import uuid

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import ChatMessage, User
from core.config import settings
from features.chat.schemas import ChatRequest, ChatMessageOut
from features.chat.repository import (
    create_message,
    get_conversation_messages,
    get_conversation_project_id,
    delete_conversation_messages,
    list_conversation_stubs,
    get_first_user_message,
)
from features.chat.service import (
    build_codebook,
    retrieve_segments,
    get_conversation_history_dicts,
    stream_response_background,
)
from features.projects.repository import get_membership
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _require_member(db: Session, project_id: str, user_id: str) -> None:
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


@router.post("/")
async def send_chat_message(
    body: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.azure_api_key:
        raise HTTPException(status_code=503, detail="No API key configured")

    user_id = current_user.id
    conversation_id = body.conversation_id or str(uuid.uuid4())

    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        project_id=body.project_id,
        user_id=user_id,
        role="user",
        content=body.message,
    )
    create_message(db, user_msg)

    codebook = build_codebook(db, body.project_id)
    retrieved = retrieve_segments(user_id, body.message)
    history = get_conversation_history_dicts(db, conversation_id)

    background_tasks.add_task(
        stream_response_background,
        conversation_id=conversation_id,
        project_id=body.project_id,
        user_id=user_id,
        user_message=body.message,
        codebook=codebook,
        retrieved_segments=retrieved,
        conversation_history=history,
    )

    return {"conversation_id": conversation_id, "status": "streaming"}


@router.get("/history/{conversation_id}", response_model=list[ChatMessageOut])
def get_history(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_id = get_conversation_project_id(db, conversation_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _require_member(db, project_id, current_user.id)
    messages = get_conversation_messages(db, conversation_id)
    return [
        ChatMessageOut(id=m.id, conversation_id=m.conversation_id, role=m.role,
                       content=m.content, created_at=m.created_at)
        for m in messages
    ]


@router.get("/conversations")
def list_conversations(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stubs = list_conversation_stubs(db, project_id, current_user.id)
    results = []
    for conv_id, started_at in stubs:
        first_msg = get_first_user_message(db, conv_id)
        preview = ""
        if first_msg:
            preview = (first_msg.content[:80] + "...") if len(first_msg.content) > 80 else first_msg.content
        results.append({
            "conversation_id": conv_id,
            "preview": preview,
            "started_at": started_at.isoformat() if started_at else None,
        })
    return results


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_id = get_conversation_project_id(db, conversation_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _require_member(db, project_id, current_user.id)
    delete_conversation_messages(db, conversation_id)
    return {"status": "deleted"}
