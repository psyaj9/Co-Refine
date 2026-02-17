from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str


class ProjectOut(BaseModel):
    id: str
    name: str
    document_count: int = 0
    code_count: int = 0
    created_at: datetime


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


class CodeCreate(BaseModel):
    label: str
    definition: Optional[str] = None
    colour: Optional[str] = "#FFEB3B"
    user_id: str
    project_id: str


class CodeOut(BaseModel):
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


class SegmentCreate(BaseModel):
    document_id: str
    text: str
    start_index: int
    end_index: int
    code_id: str
    user_id: str


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


class AnalysisOut(BaseModel):
    code_id: str
    code_label: str
    definition: Optional[str] = None
    lens: Optional[str] = None
    reasoning: Optional[str] = None
    segment_count: int = 0


class AnalysisTrigger(BaseModel):
    code_id: str
    user_id: str


class AlertOut(BaseModel):
    id: str
    alert_type: str
    payload: dict
    segment_id: Optional[str] = None
    is_read: bool
    created_at: datetime
