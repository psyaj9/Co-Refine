from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SegmentCreate(BaseModel):
    document_id: str
    text: str
    start_index: int
    end_index: int
    code_id: str
    user_id: Optional[str] = None


class SegmentOut(BaseModel):
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
    items: list[SegmentCreate]


class AlertOut(BaseModel):
    id: str
    alert_type: str
    payload: dict
    segment_id: Optional[str] = None
    is_read: bool
    created_at: datetime
