"""
ICR Pydantic schemas — request bodies and response models for the ICR endpoints.

The ICR schema hierarchy mirrors the UI structure:
  Overview → high-level stats + all metrics
  PerCode  → per-code Krippendorff's alpha
  AgreementMatrix → which codes get confused with which
  Disagreements → individual span-level disagreements
  Resolutions → recorded decisions on how to resolve disagreements
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Coder ─────────────────────────────────────────────────────────────────────

class CoderInfo(BaseModel):
    """Basic coder identity information shown in the ICR overview."""
    user_id: str
    display_name: str
    email: str


# ── Metric ────────────────────────────────────────────────────────────────────

class MetricOut(BaseModel):
    """A single reliability metric result.

    score is None when there's insufficient data to compute (< 2 coders, 0 units).
    interpretation gives a human-readable quality band (e.g. "substantial agreement").
    """
    score: Optional[float]
    interpretation: str
    n_units: int   # number of alignment units the metric was computed over


class PairwiseKappaOut(BaseModel):
    """Cohen's kappa between a specific pair of coders.

    Computed for every pair, so you can see which specific coders disagree most.
    """
    coder_a_id: str
    coder_b_id: str
    coder_a_name: str
    coder_b_name: str
    score: Optional[float]
    interpretation: str
    n_units: int


# ── Overview ──────────────────────────────────────────────────────────────────

class DisagreementBreakdownOut(BaseModel):
    """Counts of each disagreement type across the project.

    code_mismatch: Coders covered the same span but with different codes.
    boundary: Coders coded overlapping but not identical spans.
    coverage_gap: One coder coded a span that others didn't touch at all.
    split_merge: One coder split what another merged (or vice versa).
    """
    code_mismatch: int
    boundary: int
    coverage_gap: int
    split_merge: int


class MetricsOut(BaseModel):
    """All project-level reliability metrics in one bundle."""
    percent_agreement: MetricOut
    fleiss_kappa: MetricOut
    krippendorffs_alpha: MetricOut
    gwets_ac1: MetricOut
    pairwise_cohens_kappa: list[PairwiseKappaOut]


class ICROverviewOut(BaseModel):
    """Full ICR overview response for the summary tab."""
    n_coders: int
    n_units: int          # total alignment units considered
    n_agreements: int
    n_disagreements: int
    disagreement_breakdown: DisagreementBreakdownOut
    metrics: MetricsOut
    coders: list[CoderInfo]


# ── Per-code ──────────────────────────────────────────────────────────────────

class PerCodeMetricOut(BaseModel):
    """Krippendorff's alpha for a single code.

    alpha close to 1.0 = strong agreement on this code.
    alpha close to 0.0 or negative = little better than chance.
    """
    code_id: str
    code_label: str
    code_colour: str     # hex colour for the code pill in the UI
    alpha: Optional[float]
    interpretation: str
    n_units: int


# ── Agreement matrix ──────────────────────────────────────────────────────────

class AgreementMatrixOut(BaseModel):
    """Confusion matrix showing which codes get swapped with which.

    matrix[i][j] = number of times code_ids[i] and code_ids[j] were applied
    to the same span by different coders (disagreement count).
    """
    code_labels: list[str]
    code_ids: list[str]
    matrix: list[list[int]]   # matrix[i][j] = count of times code_i confused with code_j


# ── Disagreements ─────────────────────────────────────────────────────────────

class AssignmentOut(BaseModel):
    """A single coder's coding assignment for a disagreement span."""
    coder_id: str
    coder_name: str
    code_id: str
    code_label: str
    code_colour: str
    segment_id: str
    start_index: int
    end_index: int


class ICRDisagreementOut(BaseModel):
    """A single disagreement unit — one span where coders differ."""
    unit_id: str
    document_id: str
    document_title: Optional[str]
    span_start: int
    span_end: int
    span_text: Optional[str]     # excerpt from document (up to 200 chars)
    disagreement_type: str       # code_mismatch | boundary | coverage_gap | split_merge | agreement
    assignments: list[AssignmentOut]
    missing_coder_ids: list[str]    # coders who didn't code this span
    missing_coder_names: list[str]
    resolution_id: Optional[str]
    resolution_status: Optional[str]


class DisagreementListOut(BaseModel):
    """Paginated disagreement list response."""
    items: list[ICRDisagreementOut]
    total: int
    offset: int
    limit: int


# ── Resolution ────────────────────────────────────────────────────────────────

class ICRResolutionCreate(BaseModel):
    """Request body for creating a new resolution record."""
    unit_id: str           # The disagreement unit_id this resolves
    document_id: str
    span_start: int
    span_end: int
    disagreement_type: str
    chosen_segment_id: Optional[str] = None   # Which coder's segment is canonical
    resolution_note: Optional[str] = None     # Free-text explanation


class ICRResolutionUpdate(BaseModel):
    """Request body for updating an existing resolution.

    All fields are optional — only provided fields are updated.
    """
    status: Optional[str] = None          # unresolved | resolved | deferred
    chosen_segment_id: Optional[str] = None
    resolution_note: Optional[str] = None


class ICRResolutionOut(BaseModel):
    """Full resolution record returned to the client."""
    id: str
    project_id: str
    document_id: Optional[str]
    span_start: int
    span_end: int
    span_text: Optional[str]       # excerpt populated server-side for display
    disagreement_type: str
    status: str
    chosen_segment_id: Optional[str]
    resolved_by: Optional[str]
    resolved_by_name: Optional[str]  # human-readable name for the resolver
    resolution_note: Optional[str]
    llm_analysis: Optional[str]      # LLM explanation text if analyze-disagreement was called
    created_at: datetime
    resolved_at: Optional[datetime]


# ── LLM analysis ──────────────────────────────────────────────────────────────

class AnalyzeDisagreementRequest(BaseModel):
    """Request body for the analyze-disagreement endpoint."""
    unit_id: str       # Identifies the specific disagreement to analyse
    document_id: str   # Needed to look up the coders' segments
