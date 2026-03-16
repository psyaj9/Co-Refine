from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Coder ─────────────────────────────────────────────────────────────────────

class CoderInfo(BaseModel):
    user_id: str
    display_name: str
    email: str


# ── Metric ────────────────────────────────────────────────────────────────────

class MetricOut(BaseModel):
    score: Optional[float]
    interpretation: str
    n_units: int


class PairwiseKappaOut(BaseModel):
    coder_a_id: str
    coder_b_id: str
    coder_a_name: str
    coder_b_name: str
    score: Optional[float]
    interpretation: str
    n_units: int


# ── Overview ──────────────────────────────────────────────────────────────────

class DisagreementBreakdownOut(BaseModel):
    code_mismatch: int
    boundary: int
    coverage_gap: int
    split_merge: int


class MetricsOut(BaseModel):
    percent_agreement: MetricOut
    fleiss_kappa: MetricOut
    krippendorffs_alpha: MetricOut
    gwets_ac1: MetricOut
    pairwise_cohens_kappa: list[PairwiseKappaOut]


class ICROverviewOut(BaseModel):
    n_coders: int
    n_units: int
    n_agreements: int
    n_disagreements: int
    disagreement_breakdown: DisagreementBreakdownOut
    metrics: MetricsOut
    coders: list[CoderInfo]


# ── Per-code ──────────────────────────────────────────────────────────────────

class PerCodeMetricOut(BaseModel):
    code_id: str
    code_label: str
    code_colour: str
    alpha: Optional[float]
    interpretation: str
    n_units: int


# ── Agreement matrix ──────────────────────────────────────────────────────────

class AgreementMatrixOut(BaseModel):
    code_labels: list[str]
    code_ids: list[str]
    matrix: list[list[int]]   # matrix[i][j] = count of times code_i confused with code_j


# ── Disagreements ─────────────────────────────────────────────────────────────

class AssignmentOut(BaseModel):
    coder_id: str
    coder_name: str
    code_id: str
    code_label: str
    code_colour: str
    segment_id: str
    start_index: int
    end_index: int


class ICRDisagreementOut(BaseModel):
    unit_id: str
    document_id: str
    document_title: Optional[str]
    span_start: int
    span_end: int
    span_text: Optional[str]     # excerpt from document
    disagreement_type: str       # code_mismatch | boundary | coverage_gap | split_merge | agreement
    assignments: list[AssignmentOut]
    missing_coder_ids: list[str]
    missing_coder_names: list[str]
    resolution_id: Optional[str]
    resolution_status: Optional[str]


class DisagreementListOut(BaseModel):
    items: list[ICRDisagreementOut]
    total: int
    offset: int
    limit: int


# ── Resolution ────────────────────────────────────────────────────────────────

class ICRResolutionCreate(BaseModel):
    unit_id: str
    document_id: str
    span_start: int
    span_end: int
    disagreement_type: str
    chosen_segment_id: Optional[str] = None
    resolution_note: Optional[str] = None


class ICRResolutionUpdate(BaseModel):
    status: Optional[str] = None          # unresolved | resolved | deferred
    chosen_segment_id: Optional[str] = None
    resolution_note: Optional[str] = None


class ICRResolutionOut(BaseModel):
    id: str
    project_id: str
    document_id: Optional[str]
    span_start: int
    span_end: int
    span_text: Optional[str]
    disagreement_type: str
    status: str
    chosen_segment_id: Optional[str]
    resolved_by: Optional[str]
    resolved_by_name: Optional[str]
    resolution_note: Optional[str]
    llm_analysis: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]


# ── LLM analysis ──────────────────────────────────────────────────────────────

class AnalyzeDisagreementRequest(BaseModel):
    unit_id: str
    document_id: str
