"""
Code ORM model.

A code is a researcher defined label applied to text segments during qualitative analysis.
Codes belong to a project and can have a short label and a longer definition
that clarifies the code's intended meaning. 
The definition is what the LLM auditor uses to assess whether a segment was coded consistently.
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class Code(Base):
    __tablename__ = "codes"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    label = Column(String, nullable=False)
    definition = Column(Text, nullable=True)
    colour = Column(String, default="#FFEB3B")
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="codes")
    segments = relationship("CodedSegment", back_populates="code", cascade="all, delete-orphan")
    analyses = relationship("AnalysisResult", back_populates="code", cascade="all, delete-orphan")
    facets = relationship("Facet", back_populates="code", cascade="all, delete-orphan")
