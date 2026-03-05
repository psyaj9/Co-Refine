from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class CodedSegment(Base):
    __tablename__ = "coded_segments"

    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    text = Column(Text, nullable=False)
    start_index = Column(Integer, nullable=False)
    end_index = Column(Integer, nullable=False)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tsne_x = Column(Float, nullable=True)
    tsne_y = Column(Float, nullable=True)
    tsne_z = Column(Float, nullable=True)

    document = relationship("Document", back_populates="segments")
    code = relationship("Code", back_populates="segments")
    alerts = relationship("AgentAlert", back_populates="segment", cascade="all, delete-orphan")
    consistency_scores = relationship("ConsistencyScore", back_populates="segment", cascade="all, delete-orphan")
    human_feedback = relationship("HumanFeedback", back_populates="segment", cascade="all, delete-orphan")
    facet_assignments = relationship("FacetAssignment", back_populates="segment", cascade="all, delete-orphan")
