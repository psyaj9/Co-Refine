"""
ConsistencyScore ORM model.

Stores the numeric audit scores produced for a segment during the two-stage pipeline:

Stage 1 (deterministic scoring):
  - centroid_similarity: cosine similarity between this segment's embedding and its
    code's centroid vector. Low values suggest the segment is an outlier.
  - is_pseudo_centroid: True when there weren't enough segments to compute a real
    centroid, so we fell back to using the code definition embedding instead.
  - temporal_drift: LOGOS drift score — how far this segment is from the code's
    semantic centre compared to earlier segments in the coding timeline.

Stage 2 (LLM):
  - llm_consistency_score: 0–1 score from the LLM assessing how well the segment
    matches the code definition.
  - llm_intent_score: 0–1 score assessing whether the researcher's apparent intent
    aligns with the code's stated purpose.
  - llm_overall_severity: combined severity for display in the UI.

Keeping scores in a separate table allows for the re-auditing of a segment and the storage of new scores without losing the history.
"""

from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class ConsistencyScore(Base):
    __tablename__ = "consistency_scores"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=False)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    user_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)

    # Stage 1 — deterministic scores
    centroid_similarity = Column(Float, nullable=True)
    is_pseudo_centroid = Column(Boolean, default=False)
    temporal_drift = Column(Float, nullable=True)

    # Stage 2 — LLM scores
    llm_consistency_score = Column(Float, nullable=True)
    llm_intent_score = Column(Float, nullable=True)
    llm_overall_severity = Column(Float, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="consistency_scores")
