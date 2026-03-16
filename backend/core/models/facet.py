from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class Facet(Base):
    __tablename__ = "facets"

    id = Column(String, primary_key=True)
    code_id = Column(String, ForeignKey("codes.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    label = Column(String, nullable=False)
    suggested_label = Column(String, nullable=True)
    label_source = Column(String, default="auto")
    centroid_json = Column(Text, nullable=False)
    segment_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    code = relationship("Code", back_populates="facets")
    project = relationship("Project", back_populates="facets")
    assignments = relationship("FacetAssignment", back_populates="facet", cascade="all, delete-orphan")


class FacetAssignment(Base):

    __tablename__ = "facet_assignments"

    id = Column(String, primary_key=True)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=False)
    facet_id = Column(String, ForeignKey("facets.id"), nullable=False)
    similarity_score = Column(Float, nullable=False)
    is_dominant = Column(Boolean, default=True)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="facet_assignments")
    facet = relationship("Facet", back_populates="assignments")
