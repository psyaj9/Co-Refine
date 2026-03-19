"""Segments feature DTOs: request bodies and response payloads."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SegmentCreate(BaseModel):
    """Payload for creating a single coded segment.

    user_id is optional and kept for backwards compatibility — the router uses
    current_user from the JWT, so this field is ignored if sent.
    """

    document_id: str
    text: str           # the selected text (stored as a snapshot)
    start_index: int    # character offset in document full_text
    end_index: int
    code_id: str
    user_id: Optional[str] = None   # deprecated, ignored by the router


class SegmentOut(BaseModel):
    """A single coded segment returned to the frontend.

    Code label and colour are included so the document viewer can render
    highlight annotations without a codebook lookup.
    """

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
    """Payload for creating multiple segments in one request.

    Used when the frontend needs to apply several codes at once without
    making N individual POST requests (e.g. paste-and-code workflows).
    """

    items: list[SegmentCreate]


class AlertOut(BaseModel):
    """An audit alert returned from GET /segments/alerts.

    The payload is a free-form dict — its structure depends on alert_type
    and is defined by the audit pipeline that generated it.
    """

    id: str
    alert_type: str
    payload: dict
    segment_id: Optional[str] = None   # None for project-level alerts
    is_read: bool
    created_at: datetime
