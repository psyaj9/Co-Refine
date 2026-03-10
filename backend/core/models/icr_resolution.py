import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey

from core.database import Base


class IcrResolution(Base):
    __tablename__ = "icr_resolutions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    document_id = Column(
        String(36), ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    span_start = Column(Integer, nullable=False)
    span_end = Column(Integer, nullable=False)
    disagreement_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="unresolved")
    chosen_segment_id = Column(
        String(36), ForeignKey("coded_segments.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolved_by = Column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution_note = Column(Text, nullable=True)
    llm_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)
