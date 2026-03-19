"""
AnalysisResult ORM model.

An analysis result is an LLM-generated summary of a code. 
This is automatically triggered when a code accumulates enough segments (controlled by auto_analysis_threshold in settings).

The `lens` field is the AI's interpretation of the code's theoretical or analytical angle;
`definition` is a proposed plain-English definition and `reasoning` is the chain-of-thought
the model used. All three together give researchers something to react to and refine.
"""

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(String, primary_key=True)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    definition = Column(Text, nullable=True)
    lens = Column(Text, nullable=True)
    reasoning = Column(Text, nullable=True)
    segment_count_at_analysis = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    code = relationship("Code", back_populates="analyses")
