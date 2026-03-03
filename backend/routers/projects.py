from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from database import get_db, Project, Document, Code, CodedSegment
from models import ProjectCreate, ProjectOut, ProjectSettingsOut, ProjectSettingsUpdate, AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
from config import settings as global_settings

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project_to_out(project: Project, doc_count: int = 0, code_count: int = 0) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        document_count=doc_count,
        code_count=code_count,
        created_at=project.created_at,
    )


def _batch_project_counts(db: Session, project_ids: list[str]) -> dict[str, dict]:
    """Return doc_count and code_count for each project in a single query each."""
    doc_rows = (
        db.query(Document.project_id, func.count(Document.id))
        .filter(Document.project_id.in_(project_ids))
        .group_by(Document.project_id)
        .all()
    )
    code_rows = (
        db.query(Code.project_id, func.count(Code.id))
        .filter(Code.project_id.in_(project_ids))
        .group_by(Code.project_id)
        .all()
    )
    doc_counts = {pid: cnt for pid, cnt in doc_rows}
    code_counts = {pid: cnt for pid, cnt in code_rows}
    return {
        pid: {"doc_count": doc_counts.get(pid, 0), "code_count": code_counts.get(pid, 0)}
        for pid in project_ids
    }


@router.post("/", response_model=ProjectOut)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        id=str(uuid.uuid4()),
        name=body.name,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_out(project)


@router.get("/", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    counts = _batch_project_counts(db, [p.id for p in projects])
    return [
        _project_to_out(p, counts[p.id]["doc_count"], counts[p.id]["code_count"])
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    counts = _batch_project_counts(db, [project_id])
    return _project_to_out(project, counts[project_id]["doc_count"], counts[project_id]["code_count"])


@router.delete("/{project_id}")
def delete_project(project_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    """Delete a project and ALL its documents, codes, segments, analyses, alerts."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Batch-delete all segment embeddings from ChromaDB in one call
    seg_ids = [
        row[0]
        for row in db.query(CodedSegment.id)
        .join(Document, CodedSegment.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .all()
    ]
    if seg_ids:
        try:
            from services.vector_store import get_collection
            get_collection(user_id).delete(ids=seg_ids)
        except Exception:
            pass

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
