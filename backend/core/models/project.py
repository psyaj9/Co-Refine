from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class Project(Base):
    """A project groups documents and codes together."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    enabled_perspectives = Column(JSON, default=lambda: ["self_consistency"])
    thresholds_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    codes = relationship("Code", back_populates="project", cascade="all, delete-orphan")
    facets = relationship("Facet", back_populates="project", cascade="all, delete-orphan")
