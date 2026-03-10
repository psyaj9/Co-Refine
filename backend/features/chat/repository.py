"""Chat repository: pure DB queries for messages and conversations."""
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import ChatMessage


def get_conversation_messages(db: Session, conversation_id: str) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
        .all()
    )


def get_conversation_project_id(db: Session, conversation_id: str) -> str | None:
    """Return the project_id for a conversation, or None if not found."""
    msg = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).first()
    return msg.project_id if msg else None


def create_message(db: Session, message: ChatMessage) -> None:
    db.add(message)
    db.commit()


def delete_conversation_messages(db: Session, conversation_id: str) -> None:
    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).delete()
    db.commit()


def list_conversation_stubs(
    db: Session, project_id: str, user_id: str, limit: int = 20
) -> list[tuple]:
    """Return (conversation_id, started_at) tuples ordered newest first."""
    return (
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
        .limit(limit)
        .all()
    )


def get_first_user_message(db: Session, conversation_id: str) -> ChatMessage | None:
    return (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.role == "user",
        )
        .order_by(ChatMessage.created_at)
        .first()
    )
