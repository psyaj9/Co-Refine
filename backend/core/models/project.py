from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    enabled_perspectives = Column(JSON, default=lambda: ["self_consistency"])
    thresholds_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    codes = relationship("Code", back_populates="project", cascade="all, delete-orphan")
    facets = relationship("Facet", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
