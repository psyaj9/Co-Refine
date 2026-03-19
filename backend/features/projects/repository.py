"""Projects repository: pure DB query functions.

No business logic here — just SQLAlchemy queries. The service layer owns all
decisions about what to do with the results.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Project, Document, Code, ProjectMember


def get_project_by_id(db: Session, project_id: str) -> Project | None:
    """Fetch a single project by its UUID, or None if it doesn't exist."""
    return db.query(Project).filter(Project.id == project_id).first()


def list_all_projects(db: Session, user_id: str | None = None) -> list[Project]:
    """List all projects, optionally filtered to a specific owner.

    Note: this returns projects by ownership (user_id column), not by membership.
    Prefer list_projects_for_user for member-aware queries.
    """
    q = db.query(Project)
    if user_id:
        q = q.filter(Project.user_id == user_id)
    return q.order_by(Project.created_at.desc()).all()


def list_projects_for_user(db: Session, user_id: str) -> list[Project]:
    """Return all projects where the user is an owner or member.

    Joins through ProjectMember so we catch collaborators, not just project owners.
    """
    return (
        db.query(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .filter(ProjectMember.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )


def get_membership(db: Session, project_id: str, user_id: str) -> ProjectMember | None:
    """Look up a specific user's membership record for a project.

    Returns None if the user has no access to the project at all.
    """
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )


def add_project_member(db: Session, project_id: str, user_id: str, role: str = "owner") -> ProjectMember:
    """Create a new ProjectMember row and commit it.

    Args:
        db: Active DB session.
        project_id: The project to add the user to.
        user_id: The user being added.
        role: "owner" for the creator, "coder" for invited collaborators.

    Returns:
        The refreshed ProjectMember ORM object.
    """
    member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def create_project(db: Session, project: Project) -> Project:
    """Persist a new Project object and return it refreshed.

    The caller is responsible for constructing the Project with a UUID already set.
    """
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    """Delete the project and commit.

    SQLAlchemy cascade rules on the Project model handle child records (documents,
    codes, segments, etc.) automatically.
    """
    db.delete(project)
    db.commit()


def update_project(db: Session) -> None:
    """Commit any pending changes to the project already attached to the session.

    The router mutates project fields directly on the ORM object, then calls
    this to flush to the DB — no need to pass the object again.
    """
    db.commit()


def list_project_members(db: Session, project_id: str) -> list[ProjectMember]:
    """Return all members of a project ordered by when they joined."""
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at)
        .all()
    )


def remove_project_member(db: Session, project_id: str, user_id: str) -> None:
    """Delete a user's membership record if it exists (no-op if they're not a member)."""
    member = get_membership(db, project_id, user_id)
    if member:
        db.delete(member)
        db.commit()


def batch_project_counts(db: Session, project_ids: list[str]) -> dict[str, dict]:
    """Fetch document and code counts for a list of projects in two queries.

    Much cheaper than N+1 queries per project. Returns a dict keyed by project_id
    so the caller can zip results onto a list of projects.

    Args:
        db: Active DB session.
        project_ids: List of project UUID strings to count for.

    Returns:
        Dict mapping project_id → {"doc_count": int, "code_count": int}.
        Projects with zero documents/codes are included with count 0.
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
    """Collect all coded segment IDs that belong to a project.

    Used during project deletion to clean up orphaned ChromaDB embeddings before
    the SQL cascade removes the rows. The import is deferred to avoid a circular
    dependency at module load time.
    """
    from core.models import CodedSegment
    return [
        row[0]
        for row in db.query(CodedSegment.id)
        .join(Document, CodedSegment.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .all()
    ]
