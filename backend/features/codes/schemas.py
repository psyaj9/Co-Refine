"""Codes feature DTOs: request bodies and response payloads for the codebook API."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CodeCreate(BaseModel):
    """Payload for creating a new code."""

    label: str
    definition: Optional[str] = None
    colour: Optional[str] = "#FFEB3B"
    user_id: Optional[str] = None
    project_id: str


class CodeOut(BaseModel):
    """Single code as returned to the frontend."""

    id: str
    label: str
    definition: Optional[str] = None
    colour: str
    created_by: str
    project_id: str
    segment_count: int = 0


class CodeUpdate(BaseModel):
    label: Optional[str] = None
    definition: Optional[str] = None
    colour: Optional[str] = None


class SegmentOut(BaseModel):
    """A coded segment returned from GET /codes/{code_id}/segments."""

    id: str
    document_id: str
    text: str
    start_index: int
    end_index: int
    code_id: str
    code_label: str
    code_colour: str
    user_id: str
    created_at: datetime
