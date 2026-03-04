"""Edit history schemas."""
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class EditEventOut(BaseModel):
    id: str
    project_id: str
    document_id: Optional[str] = None
    entity_type: str
    action: str
    entity_id: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None
    user_id: str
    created_at: datetime
