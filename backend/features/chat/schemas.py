"""
Chat Pydantic schemas 

Request and response models for the chat endpoints.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatRequest(BaseModel):
    """Payload for POST /api/chat/"""
    message: str
    project_id: str
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None


class ChatMessageOut(BaseModel):
    """A single message returned in conversation history."""
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime
