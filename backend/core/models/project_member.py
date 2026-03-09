from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from uuid import uuid4

from core.database import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(String, default="coder")
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")
