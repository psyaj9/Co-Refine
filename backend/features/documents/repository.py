"""Documents repository

DB queries for document management.
"""

from sqlalchemy.orm import Session
from core.models import Document, CodedSegment


def get_document_by_id(db: Session, doc_id: str) -> Document | None:
    """Fetch a single document by UUID, or None if not found."""
    return db.query(Document).filter(Document.id == doc_id).first()


def list_documents(db: Session, project_id: str = "") -> list[Document]:
    """List documents.

    Args:
        db: Active DB session.
        project_id: If provided, only return documents for this project.
                    If empty, returns all documents.
    """
    query = db.query(Document)
    if project_id:
        query = query.filter(Document.project_id == project_id)
    return query.order_by(Document.created_at.desc()).all()


def create_document(db: Session, doc: Document) -> None:
    """Persist a new Document row and commit."""
    db.add(doc)
    db.commit()


def delete_document(db: Session, doc: Document) -> None:
    """Delete a document and commit."""
    db.delete(doc)
    db.commit()


def get_segments_for_document(db: Session, doc_id: str) -> list[CodedSegment]:
    """Return all coded segments that belong to a document."""
    return db.query(CodedSegment).filter(CodedSegment.document_id == doc_id).all()
