from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class ConsistencyScore(Base):
    """Append-only scoring record — one per coded segment.

    Contains both Stage 1 (deterministic) and Stage 2 (LLM) scores.
    Used for evaluation: export and compute kappa, precision/recall, drift.
    """
    __tablename__ = "consistency_scores"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=False)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    user_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)

    # Stage 1
    centroid_similarity = Column(Float, nullable=True)
    is_pseudo_centroid = Column(Boolean, default=False)
    temporal_drift = Column(Float, nullable=True)

    # Stage 2
    llm_consistency_score = Column(Float, nullable=True)
    llm_intent_score = Column(Float, nullable=True)
    llm_overall_severity = Column(Float, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="consistency_scores")
