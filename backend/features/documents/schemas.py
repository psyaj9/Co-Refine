"""Documents feature DTOs: request and response payloads for document endpoints."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    """Lightweight response returned immediately after a successful upload."""

    id: str
    title: str
    doc_type: str
    char_count: int     # lets the UI show a quick summary without re-fetching
    project_id: str


class DocumentOut(BaseModel):
    """Full document payload including the text content."""

    id: str
    title: str
    full_text: str
    doc_type: str
    html_content: Optional[str] = None
    project_id: str
    created_at: datetime
