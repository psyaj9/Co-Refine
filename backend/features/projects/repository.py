"""Project repository: pure DB queries, no business logic."""
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Project, Document, Code


def get_project_by_id(db: Session, project_id: str) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def list_all_projects(db: Session) -> list[Project]:
    return db.query(Project).order_by(Project.created_at.desc()).all()


def create_project(db: Session, project: Project) -> Project:
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()


def update_project(db: Session) -> None:
    db.commit()


def batch_project_counts(db: Session, project_ids: list[str]) -> dict[str, dict]:
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


def get_segment_ids_for_project(db: Session, project_id: str) -> list[str]:
    """Return all CodedSegment IDs that belong to a project (for vector store cleanup)."""
    from core.models import CodedSegment
    return [
        row[0]
        for row in db.query(CodedSegment.id)
        .join(Document, CodedSegment.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .all()
    ]
