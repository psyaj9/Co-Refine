from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    full_text = Column(Text, nullable=False)
    doc_type = Column(String, default="transcript")
    html_content = Column(Text, nullable=True)
    original_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="documents")
    segments = relationship("CodedSegment", back_populates="document", cascade="all, delete-orphan")
