from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from database import get_db, Project, Document, Code, CodedSegment, AgentAlert
from models import ProjectCreate, ProjectOut, ProjectSettingsOut, ProjectSettingsUpdate, AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
from services.vector_store import delete_segment_embedding
from config import settings as global_settings

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project_to_out(project: Project, db: Session) -> ProjectOut:
    doc_count = db.query(Document).filter(Document.project_id == project.id).count()
    code_count = db.query(Code).filter(Code.project_id == project.id).count()
    return ProjectOut(
        id=project.id,
        name=project.name,
        document_count=doc_count,
        code_count=code_count,
        created_at=project.created_at,
    )


@router.post("/", response_model=ProjectOut)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        id=str(uuid.uuid4()),
        name=body.name,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_out(project, db)


@router.get("/", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [_project_to_out(p, db) for p in projects]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_out(project, db)


@router.delete("/{project_id}")
def delete_project(project_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    """Delete a project and ALL its documents, codes, segments, analyses, alerts."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    docs = db.query(Document).filter(Document.project_id == project_id).all()
    for doc in docs:
        segments = db.query(CodedSegment).filter(CodedSegment.document_id == doc.id).all()
        for seg in segments:
            delete_segment_embedding(user_id, seg.id)

    db.delete(project)
    db.commit()
    return {"status": "deleted"}


@router.get("/threshold-definitions")
def get_threshold_definitions():
    """Return metadata for all configurable thresholds (labels, ranges, defaults)."""
    return THRESHOLD_DEFINITIONS


def _get_merged_thresholds(project: Project) -> dict[str, float | int]:
    """Merge project overrides on top of global defaults."""
    defaults = {td["key"]: getattr(global_settings, td["key"], td["default"]) for td in THRESHOLD_DEFINITIONS}
    overrides = project.thresholds_json or {}
    return {**defaults, **{k: v for k, v in overrides.items() if k in defaults}}


@router.get("/{project_id}/settings", response_model=ProjectSettingsOut)
def get_project_settings(project_id: str, db: Session = Depends(get_db)):
    """Get project settings including enabled perspectives and thresholds."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    perspectives = project.enabled_perspectives or ["self_consistency"]
    return ProjectSettingsOut(
        enabled_perspectives=perspectives,
        available_perspectives=AVAILABLE_PERSPECTIVES,
        thresholds=_get_merged_thresholds(project),
    )


@router.put("/{project_id}/settings", response_model=ProjectSettingsOut)
def update_project_settings(
    project_id: str, body: ProjectSettingsUpdate, db: Session = Depends(get_db)
):
    """Update project settings (perspectives and/or thresholds)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update perspectives if provided
    if body.enabled_perspectives is not None:
        valid_ids = {p["id"] for p in AVAILABLE_PERSPECTIVES}
        invalid = [p for p in body.enabled_perspectives if p not in valid_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid perspectives: {invalid}")
        if not body.enabled_perspectives:
            raise HTTPException(status_code=400, detail="At least one perspective must be enabled")
        project.enabled_perspectives = body.enabled_perspectives

    # Update thresholds if provided
    if body.thresholds is not None:
        valid_keys = {td["key"] for td in THRESHOLD_DEFINITIONS}
        clean = {k: v for k, v in body.thresholds.items() if k in valid_keys}
        existing = project.thresholds_json or {}
        project.thresholds_json = {**existing, **clean}

    db.commit()
    return ProjectSettingsOut(
        enabled_perspectives=project.enabled_perspectives or ["self_consistency"],
        available_perspectives=AVAILABLE_PERSPECTIVES,
        thresholds=_get_merged_thresholds(project),
    )
