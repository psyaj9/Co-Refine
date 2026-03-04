from sqlalchemy import Column, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from core.database import Base


class AgentAlert(Base):
    """Persisted AI agent alerts so the frontend can fetch missed ones."""
    __tablename__ = "agent_alerts"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    segment_id = Column(String, ForeignKey("coded_segments.id"), nullable=True)
    alert_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    segment = relationship("CodedSegment", back_populates="alerts")
