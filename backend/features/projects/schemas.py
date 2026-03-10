"""Project CRUD + settings schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str


class MemberInvite(BaseModel):
    email: str


class MemberOut(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: str
    joined_at: datetime


class ProjectOut(BaseModel):
    id: str
    name: str
    document_count: int = 0
    code_count: int = 0
    created_at: datetime


class ProjectSettingsOut(BaseModel):
    enabled_perspectives: list[str]
    available_perspectives: list[dict[str, str]]
    thresholds: dict[str, float | int]


class ProjectSettingsUpdate(BaseModel):
    enabled_perspectives: Optional[list[str]] = None
    thresholds: Optional[dict[str, float | int]] = None
