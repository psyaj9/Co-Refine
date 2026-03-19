"""
AgentAlert ORM model.

Agent alerts are the primary output of the audit pipeline. After an LLM agent audits
a coded segment, it produces an alert describing what it found.

The payload column stores the full structured result as JSON because alert types have
different structures. 
The alert_type field tells the frontend which React component to render for it.
"""

from sqlalchemy import Column, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class AgentAlert(Base):
    __tablename__ = "agent_alerts"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=True)
    alert_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    segment = relationship("CodedSegment", back_populates="alerts")
