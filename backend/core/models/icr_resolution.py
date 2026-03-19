"""
IcrResolution ORM model.

Inter-Coder Reliability (ICR) resolutions track disagreements between researchers coding the same span of text differently, and record how those disagreements were resolved. 
When two coders apply different codes to the same passage, a lead researcher needs to decide which interpretation is the best fit.

Each resolution covers a specific character span within a document. 
The disagreement_type distinguishes different kinds of conflict (e.g. "code_mismatch", "boundary_disagreement").
The status field tracks the workflow: "unresolved" → "resolved" or "deferred".

The llm_analysis field stores an optional LLM-generated summary of the disagreement to help the resolver make an informed decision without having to read all the context manually.
"""

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
