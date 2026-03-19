"""Segments feature DTOs: request bodies and response payloads."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SegmentCreate(BaseModel):
    """Payload for creating a single coded segment."""

    document_id: str
    text: str
    start_index: int
    end_index: int
    code_id: str
    user_id: Optional[str] = None


class SegmentOut(BaseModel):
    """A single coded segment returned to the frontend."""

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


class BatchSegmentCreate(BaseModel):
    """Payload for creating multiple segments in one request."""

    items: list[SegmentCreate]


class AlertOut(BaseModel):
    """An audit alert returned from GET /segments/alerts."""

    id: str
    alert_type: str
    payload: dict
    segment_id: Optional[str] = None
    is_read: bool
    created_at: datetime
