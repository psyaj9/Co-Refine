"""
EditEvent ORM model.

An edit event is an immutable audit log entry recording every meaningful change a
researcher makes during a coding session.
This includes creating/deleting segments, updating code definitions and renaming codes. 
The history is surfaced in the Edit History panel so researchers can review and reflect on how their codebook evolved.

"""

from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from datetime import datetime, timezone

from core.database import Base


class EditEvent(Base):
    __tablename__ = "edit_events"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    entity_type = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    field_changed = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    user_id = Column(String, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
