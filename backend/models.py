from pydantic import BaseModel
from typing import Optional, Any
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


class BatchAuditRequest(BaseModel):
    project_id: str
    user_id: str


class AlertOut(BaseModel):
    id: str
    alert_type: str
    payload: dict
    segment_id: Optional[str] = None
    is_read: bool
    created_at: datetime


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


class EditEventOut(BaseModel):
    id: str
    project_id: str
    document_id: Optional[str] = None
    entity_type: str
    action: str
    entity_id: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None
    user_id: str
    created_at: datetime


# ── Scoring Pipeline Models ──────────────────────────────────────────


class DeterministicScores(BaseModel):
    """Stage 1 deterministic embedding scores for a single segment."""
    centroid_similarity: Optional[float] = None
    is_pseudo_centroid: bool = False
    codebook_prob_dist: Optional[dict[str, float]] = None
    entropy: Optional[float] = None
    conflict_score: Optional[float] = None
    proposed_code_prob: Optional[float] = None
    temporal_drift: Optional[float] = None
    segment_count: Optional[int] = None


class ConsistencyScoreOut(BaseModel):
    """Full scoring record (Stage 1 + 2 + 3) for a single segment."""
    id: str
    segment_id: str
    code_id: str
    user_id: str
    project_id: str
    # Stage 1
    centroid_similarity: Optional[float] = None
    is_pseudo_centroid: bool = False
    proposed_code_prob: Optional[float] = None
    entropy: Optional[float] = None
    conflict_score: Optional[float] = None
    temporal_drift: Optional[float] = None
    codebook_distribution: Optional[dict[str, float]] = None
    # Stage 2
    llm_consistency_score: Optional[float] = None
    llm_intent_score: Optional[float] = None
    llm_conflict_severity: Optional[float] = None
    llm_overall_severity: Optional[float] = None
    llm_predicted_code: Optional[str] = None
    llm_predicted_confidence: Optional[float] = None
    llm_predicted_codes_json: Optional[list[dict]] = None
    # Stage 3
    was_escalated: bool = False
    escalation_reason: Optional[str] = None
    created_at: datetime


class CodeOverlapEntry(BaseModel):
    """A single cell in the code overlap matrix."""
    code_a: str
    code_b: str
    similarity: float


class DriftTimelineEntry(BaseModel):
    """Temporal drift value for a code over time."""
    code_label: str
    drift: Optional[float] = None


class CooccurrenceEntry(BaseModel):
    """A single cell in the code co-occurrence matrix."""
    code_a: str
    code_b: str
    count: int


class AgreementSummaryEntry(BaseModel):
    """Per-code agreement between user and AI ghost coder."""
    code_id: str
    code_label: str
    colour: str
    total: int
    agree_count: int
    disagree_count: int
    avg_conflict_severity: Optional[float] = None
    avg_confidence: Optional[float] = None


class DocumentStatEntry(BaseModel):
    """Per-document coding statistics."""
    document_id: str
    document_title: str
    segment_count: int
    code_count: int
    codes: list[str]


# ── Perspectives Configuration ───────────────────────────────────────

AVAILABLE_PERSPECTIVES = [
    {
        "id": "self_consistency",
        "label": "Self-Consistency",
        "description": "Did you apply this code consistently with your own past decisions?",
    },
    {
        "id": "inter_rater",
        "label": "Inter-Rater Reliability",
        "description": "What would an independent second researcher code this segment as?",
    },
]


class ProjectSettingsOut(BaseModel):
    enabled_perspectives: list[str]
    available_perspectives: list[dict[str, str]]


class ProjectSettingsUpdate(BaseModel):
    enabled_perspectives: list[str]
