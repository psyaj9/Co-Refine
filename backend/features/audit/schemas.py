"""Audit feature schemas."""
from typing import Optional, Any
from pydantic import BaseModel


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


class ChallengeMeta(BaseModel):
    was_challenged: bool = False
    researcher_feedback: Optional[str] = None
    pre_challenge_scores: Optional[dict[str, float]] = None
    post_challenge_scores: Optional[dict[str, float]] = None
    score_delta: Optional[dict[str, float]] = None


class ChallengeReflectionRequest(BaseModel):
    feedback: str
    user_id: str


class ChallengeReflectionResponse(BaseModel):
    audit_result: dict
    challenge: ChallengeMeta
    human_feedback_id: str
