"""Projects repository: DB queries for project management, membership, and related utilities."""

from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Project, Document, Code, ProjectMember


def get_project_by_id(db: Session, project_id: str) -> Project | None:
    """Fetch a single project by its UUID, or None."""
    return db.query(Project).filter(Project.id == project_id).first()


def list_all_projects(db: Session, user_id: str | None = None) -> list[Project]:
    q = db.query(Project)
    if user_id:
        q = q.filter(Project.user_id == user_id)
    return q.order_by(Project.created_at.desc()).all()


def list_projects_for_user(db: Session, user_id: str) -> list[Project]:
    return (
        db.query(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .filter(ProjectMember.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )


def get_membership(db: Session, project_id: str, user_id: str) -> ProjectMember | None:
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )


def add_project_member(db: Session, project_id: str, user_id: str, role: str = "owner") -> ProjectMember:
    member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


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


def list_project_members(db: Session, project_id: str) -> list[ProjectMember]:
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at)
        .all()
    )


def remove_project_member(db: Session, project_id: str, user_id: str) -> None:
    member = get_membership(db, project_id, user_id)
    if member:
        db.delete(member)
        db.commit()


def batch_project_counts(db: Session, project_ids: list[str]) -> dict[str, dict]:
    """Fetch document and code counts for a list of projects in two queries.

    Args:
        db: Active DB session.
        project_ids: List of project UUID strings to count for.

    Returns:
        Dict mapping project_id → {"doc_count": int, "code_count": int}.
    """
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
    from core.models import CodedSegment
    return [
        row[0]
        for row in db.query(CodedSegment.id)
        .join(Document, CodedSegment.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .all()
    ]
