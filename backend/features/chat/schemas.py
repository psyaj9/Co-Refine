"""Chat feature schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    project_id: str
    user_id: str
    conversation_id: Optional[str] = None


class ChatMessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime
