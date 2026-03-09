from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class HumanFeedback(Base):

    __tablename__ = "human_feedback"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=True)
    code_id = Column(String, ForeignKey("codes.id"), nullable=True)
    user_id = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    feedback_type = Column(String, nullable=False)
    feedback_text = Column(Text, nullable=True)
    context_json = Column(JSON, nullable=True)
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="human_feedback")
