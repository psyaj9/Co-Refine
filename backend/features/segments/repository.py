"""Segments repository: pure DB queries."""
from sqlalchemy.orm import Session

from core.models import CodedSegment, Code, Document, AgentAlert


def get_segment_by_id(db: Session, segment_id: str) -> tuple | None:
    """Returns (CodedSegment, Code) or None."""
    return (
        db.query(CodedSegment, Code)
        .outerjoin(Code, CodedSegment.code_id == Code.id)
        .filter(CodedSegment.id == segment_id)
        .first()
    )


def list_segments(db: Session, document_id: str = "", user_id: str = "") -> list:
    """Returns list of (CodedSegment, Code) tuples."""
    query = db.query(CodedSegment, Code).outerjoin(Code, CodedSegment.code_id == Code.id)
    if document_id:
        query = query.filter(CodedSegment.document_id == document_id)
    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)
    return query.order_by(CodedSegment.created_at).all()


def create_segment(db: Session, segment: CodedSegment) -> CodedSegment:
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


def delete_segment_record(db: Session, segment: CodedSegment) -> None:
    db.delete(segment)
    db.commit()


def get_code_for_segment(db: Session, code_id: str) -> Code | None:
    return db.query(Code).filter(Code.id == code_id).first()


def get_document(db: Session, doc_id: str) -> Document | None:
    return db.query(Document).filter(Document.id == doc_id).first()


def list_alerts(db: Session, user_id: str, unread_only: bool = True) -> list[AgentAlert]:
    query = db.query(AgentAlert).filter(AgentAlert.user_id == user_id)
    if unread_only:
        query = query.filter(AgentAlert.is_read == False)  # noqa: E712
    return query.order_by(AgentAlert.created_at.desc()).limit(50).all()
