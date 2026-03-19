"""Projects router: HTTP endpoints for project CRUD, settings, and membership.

Prefix: /api/projects

Endpoints:
  POST   /                              Create a new project
  GET    /                              List projects the current user belongs to
  GET    /threshold-definitions         Static catalogue of configurable thresholds
  GET    /{project_id}                  Get a single project
  DELETE /{project_id}                  Delete a project (owner only)
  GET    /{project_id}/settings         Get perspectives + threshold settings
  PUT    /{project_id}/settings         Update settings (owner only)
  GET    /{project_id}/members          List project members
  POST   /{project_id}/members          Invite a user by email (owner only)
  DELETE /{project_id}/members/{uid}    Remove a coder (owner only)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.logging import get_logger
from core.models import User
from features.projects.schemas import (
    ProjectCreate, ProjectOut, ProjectSettingsOut, ProjectSettingsUpdate,
    MemberInvite, MemberOut,
)
from features.projects.constants import AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
from features.projects.repository import (
    get_project_by_id,
    list_projects_for_user,
    delete_project,
    update_project,
    batch_project_counts,
    get_membership,
    add_project_member,
    list_project_members,
    remove_project_member,
)
from features.projects.service import (
    create_new_project,
    project_to_out,
    get_merged_thresholds,
    build_settings_out,
    cleanup_project_vectors,
)
from features.auth.repository import get_user_by_email
from infrastructure.auth.dependencies import get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


# ── Access control helpers ─────────────────────────────────────────────────────

def _require_member(db: Session, project_id: str, user_id: str) -> None:
    """Raise 403 if the user is not a project member."""
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


def _require_owner(db: Session, project_id: str, user_id: str) -> None:
    """Raise 403 if the user is not the project owner."""
    m = get_membership(db, project_id, user_id)
    if not m or m.role != "owner":
        raise HTTPException(status_code=403, detail="Owner permission required")


# ── Project CRUD ───────────────────────────────────────────────────────────────

@router.post("/", response_model=ProjectOut)
def create_project_endpoint(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    created = create_new_project(db, body.name, user_id=current_user.id)
    return project_to_out(created)


@router.get("/", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = list_projects_for_user(db, user_id=current_user.id)
    # Fetch doc/code counts in one batched query rather than N+1
    counts = batch_project_counts(db, [p.id for p in projects])
    return [
        project_to_out(p, counts[p.id]["doc_count"], counts[p.id]["code_count"])
        for p in projects
    ]


@router.get("/threshold-definitions")
def get_threshold_definitions():
    """Return the static threshold catalogue so the frontend can render sliders dynamically."""
    return THRESHOLD_DEFINITIONS


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_member(db, project_id, current_user.id)
    counts = batch_project_counts(db, [project_id])
    return project_to_out(project, counts[project_id]["doc_count"], counts[project_id]["code_count"])


@router.delete("/{project_id}")
def delete_project_endpoint(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a project and ALL its documents, codes, segments, analyses, alerts."""
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_owner(db, project_id, current_user.id)

    # Clean up ChromaDB embeddings before the SQL cascade removes the segment rows
    cleanup_project_vectors(db, project_id, current_user.id)
    delete_project(db, project)
    return {"status": "deleted"}


# ── Settings ───────────────────────────────────────────────────────────────────

@router.get("/{project_id}/settings", response_model=ProjectSettingsOut)
def get_project_settings(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_member(db, project_id, current_user.id)
    return build_settings_out(project)


@router.put("/{project_id}/settings", response_model=ProjectSettingsOut)
def update_project_settings(
    project_id: str,
    body: ProjectSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_owner(db, project_id, current_user.id)

    if body.enabled_perspectives is not None:
        # Reject any IDs the server doesn't know about
        valid_ids = {p["id"] for p in AVAILABLE_PERSPECTIVES}
        invalid = [p for p in body.enabled_perspectives if p not in valid_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid perspectives: {invalid}")
        # At least one perspective must remain active so the audit pipeline has something to run
        if not body.enabled_perspectives:
            raise HTTPException(status_code=400, detail="At least one perspective must be enabled")
        project.enabled_perspectives = body.enabled_perspectives

    if body.thresholds is not None:
        valid_keys = {td["key"] for td in THRESHOLD_DEFINITIONS}
        # Strip unknown keys so we don't persist garbage into thresholds_json
        clean = {k: v for k, v in body.thresholds.items() if k in valid_keys}
        existing = project.thresholds_json or {}
        # Merge rather than replace so an update to one threshold doesn't wipe the others
        project.thresholds_json = {**existing, **clean}

    update_project(db)
    return build_settings_out(project)


# ── Member Management ──────────────────────────────────────────────────────────

@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_member(db, project_id, current_user.id)
    members = list_project_members(db, project_id)
    # Hydrate email/display_name from the related User object (loaded via relationship)
    return [
        MemberOut(
            user_id=m.user_id,
            email=m.user.email,
            display_name=m.user.display_name,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in members
    ]


@router.post("/{project_id}/members", response_model=MemberOut, status_code=201)
def invite_member(
    project_id: str,
    body: MemberInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a user to the project by their email address (owner only)."""
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_owner(db, project_id, current_user.id)

    target = get_user_by_email(db, body.email)
    if not target:
        raise HTTPException(status_code=404, detail="No user with that email address")
    # Prevent the owner from inviting themselves (they're already a member)
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You are already the project owner")

    existing = get_membership(db, project_id, target.id)
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member of this project")

    # Collaborators join as "coder" — they can code but not manage the project
    member = add_project_member(db, project_id, target.id, role="coder")
    return MemberOut(
        user_id=member.user_id,
        email=target.email,
        display_name=target.display_name,
        role=member.role,
        joined_at=member.joined_at,
    )


@router.delete("/{project_id}/members/{member_user_id}", status_code=204)
def remove_member(
    project_id: str,
    member_user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a coder from the project (owner only; owner cannot remove themselves)."""
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _require_owner(db, project_id, current_user.id)

    # Owners can't step down via this endpoint — use project deletion instead
    if member_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot remove themselves from the project")

    target_membership = get_membership(db, project_id, member_user_id)
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")

    remove_project_member(db, project_id, member_user_id)
