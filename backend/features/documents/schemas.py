from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    id: str
    title: str
    doc_type: str
    char_count: int
    project_id: str


class DocumentOut(BaseModel):
    id: str
    title: str
    full_text: str
    doc_type: str
    html_content: Optional[str] = None
    project_id: str
    created_at: datetime
