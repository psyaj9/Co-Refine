"""
ChatMessage ORM model.

Stores the message history for the AI research assistant chat feature. 
Messages are grouped into conversations so researchers can have multiple separate chat threads within a project.

The role column follows the OpenAI convention: 

"user" for researcher messages
"assistant" for AI responses

This makes it easy to reconstruct the message list for the LLM context window without any transformation.
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from datetime import datetime, timezone

from core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
