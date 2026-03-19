"""
Chat repository, DB access for ChatMessage records.

Conversations are identified by a UUID conversation_id that groups related messages together.
No separate Conversation model, everything is derived from the messages table.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import ChatMessage


def get_conversation_messages(db: Session, conversation_id: str) -> list[ChatMessage]:
    """Return all messages in a conversation, oldest first.

    Args:
        db: Active SQLAlchemy session.
        conversation_id: UUID identifying the conversation thread.

    Returns:
        Ordered list of ChatMessage ORM objects.
    """
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
        .all()
    )


def get_conversation_project_id(db: Session, conversation_id: str) -> str | None:
    """Fetch the project_id that a conversation belongs to.

    Used for access-control checks, before returning history or deleting a
    conversation we need to verify the caller is a member of its project.

    Args:
        db: Active SQLAlchemy session.
        conversation_id: UUID identifying the conversation thread.

    Returns:
        The project_id string, or None if the conversation doesn't exist.
    """
    msg = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).first()
    return msg.project_id if msg else None


def create_message(db: Session, message: ChatMessage) -> None:
    """Persist a new ChatMessage to the DB.

    Args:
        db: Active SQLAlchemy session.
        message: Fully-constructed ChatMessage ORM object.
    """
    db.add(message)
    db.commit()


def delete_conversation_messages(db: Session, conversation_id: str) -> None:
    """Delete all messages in a conversation.

    Args:
        db: Active SQLAlchemy session.
        conversation_id: UUID identifying the conversation to wipe.
    """
    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).delete()
    db.commit()


def list_conversation_stubs(
    db: Session, project_id: str, user_id: str, limit: int = 20
) -> list[tuple]:
    """Return a compact list of conversation IDs, start times for a project/user combo.

    Groups messages by conversation_id so we get one row per conversation.
    Ordered newest-first for the conversation list in the sidebar.

    Args:
        db: Active SQLAlchemy session.
        project_id: Filter to conversations within this project.
        user_id: Filter to conversations started by this user.
        limit: Max number of conversations to return (default 20).

    Returns:
        List of (conversation_id, started_at) tuples.
    """
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
    """Fetch the first user-role message in a conversation.

    Used to generate conversation preview text in the sidebar.

    Args:
        db: Active SQLAlchemy session.
        conversation_id: UUID identifying the conversation thread.

    Returns:
        The first user ChatMessage, or None if none exist yet.
    """
    return (
        db.query(ChatMessage)
        .filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.role == "user",
        )
        .order_by(ChatMessage.created_at)
        .first()
    )
