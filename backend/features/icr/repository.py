"""
Database query functions for the ICR feature.

ICR (Inter-Coder Reliability) measures agreement between multiple researchers
coding the same documents. This module handles all DB access — loading members,
documents, segments, and resolution records. No business logic here.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.models import CodedSegment, Code, IcrResolution, ProjectMember
from core.models.document import Document
from core.models.user import User


def list_members_for_project(db: Session, project_id: str) -> list[ProjectMember]:
    """Return all members of a project, ordered by join date.

    The member list defines the set of coders we compare when computing ICR.
    Only projects with 2+ members can have meaningful reliability metrics.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to list members for.

    Returns:
        List of ProjectMember ORM objects, oldest member first.
    """
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at)
        .all()
    )


def list_documents_for_project(db: Session, project_id: str) -> list[Document]:
    """Return all documents in a project, ordered by creation date.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to list documents for.

    Returns:
        List of Document ORM objects.
    """
    return (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.created_at)
        .all()
    )


def get_document_text(db: Session, document_id: str) -> str | None:
    """Fetch the full text content of a document.

    Used to extract span text for resolution display — the text at [start:end]
    is shown in the UI so researchers can see what the coders disagreed about.

    Args:
        db: Active SQLAlchemy session.
        document_id: UUID of the document.

    Returns:
        The document's full_text string, or None if not found.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    return doc.full_text if doc else None


def list_segments_for_document_all_coders(
    db: Session,
    document_id: str,
    coder_ids: list[str],
) -> list[tuple[CodedSegment, Code]]:
    """Return (segment, code) pairs for ALL coders of a document.

    This is the primary data source for alignment unit computation — we need
    every coder's segments on a document to detect overlaps and gaps.

    Args:
        db: Active SQLAlchemy session.
        document_id: The document to fetch segments for.
        coder_ids: List of user IDs to include (typically all project members).

    Returns:
        List of (CodedSegment, Code) tuples, ordered by segment start position.
    """
    rows = (
        db.query(CodedSegment, Code)
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(
            CodedSegment.document_id == document_id,
            CodedSegment.user_id.in_(coder_ids),
        )
        .order_by(CodedSegment.start_index)
        .all()
    )
    return rows


def get_user_display_name(db: Session, user_id: str) -> str:
    """Return a human-readable name for a user ID.

    Falls back to showing the first 8 chars of the UUID if the user
    record is missing — shouldn't happen in practice but guards gracefully.

    Args:
        db: Active SQLAlchemy session.
        user_id: UUID of the user.

    Returns:
        display_name if set, otherwise email, otherwise truncated user_id.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return user_id[:8]
    return user.display_name or user.email


def get_users_by_ids(db: Session, user_ids: list[str]) -> dict[str, User]:
    """Batch fetch users by a list of IDs, returning a lookup dict.

    Args:
        db: Active SQLAlchemy session.
        user_ids: List of UUIDs to fetch.

    Returns:
        Dict mapping user_id → User ORM object. Missing IDs are omitted.
    """
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {u.id: u for u in users}


def get_code(db: Session, code_id: str) -> Code | None:
    """Look up a code by ID.

    Args:
        db: Active SQLAlchemy session.
        code_id: UUID of the code.

    Returns:
        Code ORM object, or None if not found.
    """
    return db.query(Code).filter(Code.id == code_id).first()


def get_codes_for_project(db: Session, project_id: str) -> list[Code]:
    """Return all codes in a project, alphabetically sorted.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to fetch codes for.

    Returns:
        List of Code ORM objects, sorted by label.
    """
    return db.query(Code).filter(Code.project_id == project_id).order_by(Code.label).all()


# ── Resolutions ───────────────────────────────────────────────────────────────
# Resolutions track when a team lead has decided how to resolve a disagreement
# between coders. They're linked to a span (doc + start + end) rather than
# a specific segment because the disagreement may involve missing segments.

def create_resolution(
    db: Session,
    project_id: str,
    document_id: str | None,
    span_start: int,
    span_end: int,
    disagreement_type: str,
    chosen_segment_id: str | None,
    resolution_note: str | None,
    user_id: str,
) -> IcrResolution:
    """Create a new resolution record for a disagreement.

    The resolution starts with status="unresolved" — the resolver can update
    it to "resolved" or "deferred" later via the PATCH endpoint.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project the resolution belongs to.
        document_id: Document containing the disagreement span.
        span_start: Character offset of the span start.
        span_end: Character offset of the span end.
        disagreement_type: e.g. "code_mismatch", "boundary", "coverage_gap".
        chosen_segment_id: If one coder's segment is the "right" answer, link it here.
        resolution_note: Free-text explanation of the resolution decision.
        user_id: Who is creating this resolution record.

    Returns:
        The newly created IcrResolution ORM object after commit + refresh.
    """
    import uuid
    res = IcrResolution(
        id=str(uuid.uuid4()),
        project_id=project_id,
        document_id=document_id,
        span_start=span_start,
        span_end=span_end,
        disagreement_type=disagreement_type,
        status="unresolved",
        chosen_segment_id=chosen_segment_id,
        resolved_by=user_id,
        resolution_note=resolution_note,
        created_at=datetime.now(timezone.utc),
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return res


def get_resolution(db: Session, resolution_id: str) -> IcrResolution | None:
    """Fetch a single resolution record by ID.

    Args:
        db: Active SQLAlchemy session.
        resolution_id: UUID of the resolution.

    Returns:
        IcrResolution ORM object, or None if not found.
    """
    return db.query(IcrResolution).filter(IcrResolution.id == resolution_id).first()


def update_resolution(
    db: Session,
    resolution: IcrResolution,
    status: str | None,
    chosen_segment_id: str | None,
    resolution_note: str | None,
    user_id: str,
    llm_analysis: str | None = None,
) -> IcrResolution:
    """Partially update a resolution record.

    Only updates fields that are provided (not None). If status is being set
    to "resolved", also stamps resolved_at and resolved_by.

    Args:
        db: Active SQLAlchemy session.
        resolution: The resolution ORM object to update.
        status: New status string, or None to leave unchanged.
        chosen_segment_id: Updated choice of which segment is canonical.
        resolution_note: Updated free-text note.
        user_id: Who is making this update (used as resolved_by if resolving).
        llm_analysis: LLM-generated analysis text, if available.

    Returns:
        The updated IcrResolution ORM object after commit + refresh.
    """
    if status is not None:
        resolution.status = status
        if status == "resolved":
            resolution.resolved_at = datetime.now(timezone.utc)
            resolution.resolved_by = user_id
    if chosen_segment_id is not None:
        resolution.chosen_segment_id = chosen_segment_id
    if resolution_note is not None:
        resolution.resolution_note = resolution_note
    if llm_analysis is not None:
        resolution.llm_analysis = llm_analysis
    db.commit()
    db.refresh(resolution)
    return resolution


def list_resolutions(
    db: Session,
    project_id: str,
    document_id: str | None = None,
    status: str | None = None,
) -> list[IcrResolution]:
    """Return resolutions for a project, optionally filtered by document or status.

    Args:
        db: Active SQLAlchemy session.
        project_id: Project to query.
        document_id: Optional filter to resolutions for a specific document.
        status: Optional filter by resolution status (unresolved/resolved/deferred).

    Returns:
        List of IcrResolution ORM objects, newest first.
    """
    q = db.query(IcrResolution).filter(IcrResolution.project_id == project_id)
    if document_id:
        q = q.filter(IcrResolution.document_id == document_id)
    if status:
        q = q.filter(IcrResolution.status == status)
    return q.order_by(IcrResolution.created_at.desc()).all()
