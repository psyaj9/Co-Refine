"""Project CRUD + settings schemas.

These are the Pydantic DTOs that cross the HTTP boundary — request bodies in,
response payloads out. ORM models never leave the service layer; everything
the router returns is one of these.
"""

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
    role: str           # "owner" or "coder"
    joined_at: datetime


class ProjectOut(BaseModel):
    """Project summary — document and code counts are attached at query time."""

    id: str
    name: str
    document_count: int = 0
    code_count: int = 0
    created_at: datetime


class ProjectSettingsOut(BaseModel):
    """Full settings payload sent to the frontend settings modal.

    Includes both the current state (enabled perspectives, merged thresholds)
    and the static catalogue of all available options so the UI can render
    checkboxes and sliders without a separate lookup.
    """

    enabled_perspectives: list[str]
    # Static catalogue so the frontend doesn't need to know about perspectives
    available_perspectives: list[dict[str, str]]
    # Merged result of global defaults + per-project overrides
    thresholds: dict[str, float | int]


class ProjectSettingsUpdate(BaseModel):
    """Partial update — either field can be omitted to leave it unchanged."""

    enabled_perspectives: Optional[list[str]] = None
    thresholds: Optional[dict[str, float | int]] = None
