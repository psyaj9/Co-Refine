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


class BatchSegmentCreate(BaseModel):
    items: list[SegmentCreate]


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
    temporal_drift: Optional[float] = None
    segment_count: Optional[int] = None


# ── Reflection / Challenge Models (Feature 6) ────────────────────────


class ChallengeReflectionRequest(BaseModel):
    """Request body for POST /segments/{id}/challenge-reflection."""
    feedback: str
    user_id: str


class ScoreDelta(BaseModel):
    consistency_score: float = 0.0
    intent_alignment_score: float = 0.0
    overall_severity_score: float = 0.0


class ReflectionMeta(BaseModel):
    was_reflected: bool = False
    initial_scores: Optional[dict[str, float]] = None
    reflected_scores: Optional[dict[str, float]] = None
    score_delta: Optional[dict[str, float]] = None


class ChallengeMeta(BaseModel):
    was_challenged: bool = False
    researcher_feedback: Optional[str] = None
    pre_challenge_scores: Optional[dict[str, float]] = None
    post_challenge_scores: Optional[dict[str, float]] = None
    score_delta: Optional[dict[str, float]] = None


class ChallengeReflectionResponse(BaseModel):
    """Response from the challenge-reflection endpoint."""
    audit_result: dict
    challenge: ChallengeMeta
    human_feedback_id: str



# ── Perspectives Configuration ───────────────────────────────────────

AVAILABLE_PERSPECTIVES = [
    {
        "id": "self_consistency",
        "label": "Self-Consistency",
        "description": "Did you apply this code consistently with your own past decisions?",
    },
]


class ProjectSettingsOut(BaseModel):
    enabled_perspectives: list[str]
    available_perspectives: list[dict[str, str]]
    thresholds: dict[str, float | int]


class ProjectSettingsUpdate(BaseModel):
    enabled_perspectives: Optional[list[str]] = None
    thresholds: Optional[dict[str, float | int]] = None


# Threshold keys that are user-configurable, with their defaults + metadata
THRESHOLD_DEFINITIONS: list[dict] = [
    {"key": "min_segments_for_consistency", "label": "Min. segments for consistency", "description": "Number of coded segments needed before consistency checks run", "default": 3, "min": 1, "max": 20, "step": 1, "type": "int"},
    {"key": "auto_analysis_threshold", "label": "Auto analysis threshold", "description": "Segment count that triggers automatic analysis for a code", "default": 3, "min": 1, "max": 20, "step": 1, "type": "int"},
    {"key": "vector_search_top_k", "label": "Vector search top K", "description": "How many similar segments to retrieve for comparison", "default": 8, "min": 3, "max": 30, "step": 1, "type": "int"},
    {"key": "consistency_escalation_threshold", "label": "Consistency escalation threshold", "description": "Consistency score above which escalation to reasoning model is triggered", "default": 0.7, "min": 0.0, "max": 1.0, "step": 0.05, "type": "float"},
    {"key": "stage_divergence_threshold", "label": "Stage divergence threshold", "description": "Difference between deterministic and LLM scores that triggers escalation", "default": 0.25, "min": 0.0, "max": 1.0, "step": 0.05, "type": "float"},
    {"key": "drift_warning_threshold", "label": "Drift warning threshold", "description": "Temporal drift score above which a warning is shown", "default": 0.3, "min": 0.0, "max": 1.0, "step": 0.05, "type": "float"},
    {"key": "code_overlap_warning_threshold", "label": "Code overlap warning", "description": "Centroid similarity above which a code-pair overlap warning fires", "default": 0.85, "min": 0.5, "max": 1.0, "step": 0.05, "type": "float"},
]
