from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from datetime import datetime, timezone

from core.database import Base


class EditEvent(Base):
    """Audit trail for code/segment mutations — powers the Edit History view."""
    __tablename__ = "edit_events"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    entity_type = Column(String, nullable=False)      # "segment" | "code"
    action = Column(String, nullable=False)            # "created" | "updated" | "deleted"
    entity_id = Column(String, nullable=False)
    field_changed = Column(String, nullable=True)      # e.g. "label", "definition", "colour"
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)        # snapshot context
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
