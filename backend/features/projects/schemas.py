"""Project CRUD + settings schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    """Payload for POST /api/projects/."""

    name: str


class MemberInvite(BaseModel):
    """Payload for inviting a user to a project by email."""

    email: str


class MemberOut(BaseModel):
    """A single project member as returned to the client."""

    user_id: str
    email: str
    display_name: str
    role: str
    joined_at: datetime


class ProjectOut(BaseModel):
    """Project summary as returned in lists."""

    id: str
    name: str
    document_count: int = 0
    code_count: int = 0
    created_at: datetime


class ProjectSettingsOut(BaseModel):
    """Full settings payload sent to the frontend settings modal."""

    thresholds: dict[str, float | int]


class ProjectSettingsUpdate(BaseModel):

    thresholds: Optional[dict[str, float | int]] = None
