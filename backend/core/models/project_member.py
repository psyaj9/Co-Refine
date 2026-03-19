"""
ProjectMember ORM model.

The join table between users and projects. A user gets a ProjectMember row for every project they are part of, with a role indicating their level of access.

Currently two roles exist:
  - "owner": the researcher who created the project, has all permissions
  - "coder": a collaborator who can apply codes but may have restricted access

"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from core.database import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="owner", nullable=False)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")
