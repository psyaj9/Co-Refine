"""Project feature router: CRUD + settings + thresholds."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.logging import get_logger
from core.models import User
from features.projects.schemas import ProjectCreate, ProjectOut, ProjectSettingsOut, ProjectSettingsUpdate
from features.projects.constants import AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
from features.projects.repository import (
    get_project_by_id,
    list_all_projects,
    delete_project,
    update_project,
    batch_project_counts,
)
from features.projects.service import (
    create_new_project,
    project_to_out,
    get_merged_thresholds,
    build_settings_out,
    cleanup_project_vectors,
)
from infrastructure.auth.dependencies import get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


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
    projects = list_all_projects(db, user_id=current_user.id)
    counts = batch_project_counts(db, [p.id for p in projects])
    return [
        project_to_out(p, counts[p.id]["doc_count"], counts[p.id]["code_count"])
        for p in projects
    ]


@router.get("/threshold-definitions")
def get_threshold_definitions():
    """Return metadata for all configurable thresholds (labels, ranges, defaults)."""
    return THRESHOLD_DEFINITIONS


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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

    cleanup_project_vectors(db, project_id, current_user.id)
    delete_project(db, project)
    return {"status": "deleted"}


@router.get("/{project_id}/settings", response_model=ProjectSettingsOut)
def get_project_settings(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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

    if body.enabled_perspectives is not None:
        valid_ids = {p["id"] for p in AVAILABLE_PERSPECTIVES}
        invalid = [p for p in body.enabled_perspectives if p not in valid_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid perspectives: {invalid}")
        if not body.enabled_perspectives:
            raise HTTPException(status_code=400, detail="At least one perspective must be enabled")
        project.enabled_perspectives = body.enabled_perspectives

    if body.thresholds is not None:
        valid_keys = {td["key"] for td in THRESHOLD_DEFINITIONS}
        clean = {k: v for k, v in body.thresholds.items() if k in valid_keys}
        existing = project.thresholds_json or {}
        project.thresholds_json = {**existing, **clean}

    update_project(db)
    return build_settings_out(project)
