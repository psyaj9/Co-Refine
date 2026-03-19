"""Segments repository: DB queries."""

from sqlalchemy.orm import Session

from core.models import CodedSegment, Code, Document, AgentAlert


def get_segment_by_id(db: Session, segment_id: str) -> tuple | None:
    """Fetch a (CodedSegment, Code) pair by segment UUID, or None if not found.

    The outer join means this still returns the segment even if the code has been
    deleted — callers should guard against code being None.
    """
    return (
        db.query(CodedSegment, Code)
        .outerjoin(Code, CodedSegment.code_id == Code.id)
        .filter(CodedSegment.id == segment_id)
        .first()
    )


def list_segments(db: Session, document_id: str = "", user_id: str = "") -> list:
    """Return (CodedSegment, Code) tuples, optionally filtered by document and/or user.

    Args:
        db: Active DB session.
        document_id: If provided, only return segments from this document.
        user_id: If provided, only return segments created by this user.
                 Pass empty string to get segments from all coders.

    Returns:
        List of (CodedSegment, Code) tuples ordered by creation time.
    """
    query = db.query(CodedSegment, Code).outerjoin(Code, CodedSegment.code_id == Code.id)
    if document_id:
        query = query.filter(CodedSegment.document_id == document_id)
    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)
    return query.order_by(CodedSegment.created_at).all()


def create_segment(db: Session, segment: CodedSegment) -> CodedSegment:
    """Persist a new CodedSegment and return it refreshed."""
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


def delete_segment_record(db: Session, segment: CodedSegment) -> None:
    """Delete the segment row and commit."""
    db.delete(segment)
    db.commit()


def get_code_for_segment(db: Session, code_id: str) -> Code | None:
    """Fetch the Code being applied to a new segment.

    Validates the code exists before we allow a segment to be created.
    """
    return db.query(Code).filter(Code.id == code_id).first()


def get_document(db: Session, doc_id: str) -> Document | None:
    """Fetch a Document by ID — used to validate the document exists and to
    get the full text for context window extraction."""
    return db.query(Document).filter(Document.id == doc_id).first()


def list_alerts(db: Session, user_id: str, unread_only: bool = True) -> list[AgentAlert]:
    """Return recent audit alerts for a user, newest first.

    Args:
        db: Active DB session.
        user_id: Scopes alerts to this user's coding work.
        unread_only: If True, only returns alerts the user hasn't dismissed.

    Returns:
        Up to 50 AgentAlert rows — hard cap to keep the response reasonable.
    """
    query = db.query(AgentAlert).filter(AgentAlert.user_id == user_id)
    if unread_only:
        # noqa: E712 — intentional == False comparison, SQLAlchemy needs it (not 'is not True')
        query = query.filter(AgentAlert.is_read == False)  # noqa: E712
    return query.order_by(AgentAlert.created_at.desc()).limit(50).all()
