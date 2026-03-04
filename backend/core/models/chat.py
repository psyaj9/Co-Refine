from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from datetime import datetime, timezone

from core.database import Base


class ChatMessage(Base):
    """Persisted chat messages for AI chat conversations."""
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
