"""Codes repository: DB query functions for the codebook."""

from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Code, CodedSegment


def get_code_by_id(db: Session, code_id: str) -> Code | None:
    """Fetch a single code by UUID, or None if it doesn't exist."""
    return db.query(Code).filter(Code.id == code_id).first()


def get_code_by_label_and_project(db: Session, label: str, project_id: str) -> Code | None:
    """Look up a code by its label within a specific project.

    Used for duplicate detection when creating or renaming codes, since labels must be unique within a project.
    """
    return (
        db.query(Code)
        .filter(Code.label == label, Code.project_id == project_id)
        .first()
    )


def list_codes(db: Session, project_id: str = "") -> list[Code]:
    """List codes, optionally filtered to a project, sorted alphabetically by label.

    Args:
        db: Active DB session.
        project_id: If provided, only return codes for this project.
                        If empty, returns all codes.
    """
    query = db.query(Code)
    if project_id:
        query = query.filter(Code.project_id == project_id)
    return query.order_by(Code.label).all()


def create_code(db: Session, code: Code) -> None:
    """Persist a new Code row and commit."""
    db.add(code)
    db.commit()
    db.refresh(code)


def update_code(db: Session) -> None:
    """Commit any pending field changes to a Code already attached to the session."""
    db.commit()


def delete_code_record(db: Session, code: Code) -> None:
    """Delete the code row and commit.

    Call cascade_delete_code from the service layer first to clean up segments,
    analyses, and vector embeddings before this fires.
    """
    db.delete(code)
    db.commit()


def segment_counts(db: Session, code_ids: list[str], user_id: str | None = None) -> dict[str, int]:
    """Count coded segments per code ID in a single query.

    Args:
        db: Active DB session.
        code_ids: List of code UUIDs to count for.
        user_id: If provided, only count segments belonging to this user.

    Returns:
        Dict mapping code_id → segment count. Codes with zero segments are absent
        from the result — callers should use .get(code_id, 0).
    """
    query = (
        db.query(CodedSegment.code_id, func.count(CodedSegment.id))
        .filter(CodedSegment.code_id.in_(code_ids))
    )
    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)
    rows = query.group_by(CodedSegment.code_id).all()
    return {code_id: count for code_id, count in rows}


def get_segments_for_code(db: Session, code_id: str, user_id: str) -> list[CodedSegment]:
    """Return all segments a user has applied a specific code to, in creation order.

    Used by the GET /{code_id}/segments endpoint to show every instance of a code.
    """
    return (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .order_by(CodedSegment.created_at)
        .all()
    )
