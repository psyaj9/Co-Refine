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
