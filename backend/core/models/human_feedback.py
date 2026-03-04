from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class HumanFeedback(Base):
    """Logs every human decision on AI outputs — challenge, accept, reject, override.

    Part of Feature 6 (Self-Consistency Reflection Loop) and the broader
    human-in-the-loop framework described in the feature spec.
    """
    __tablename__ = "human_feedback"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=True)
    code_id = Column(String, ForeignKey("codes.id"), nullable=True)
    user_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    feedback_type = Column(String, nullable=False)   # "challenge_reflection" | "accept" | "reject" | "override"
    feedback_text = Column(Text, nullable=True)       # the researcher's reasoning
    context_json = Column(JSON, nullable=True)        # snapshot of the audit state
    result_json = Column(JSON, nullable=True)         # 3rd-pass result if challenge
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="human_feedback")
