from sqlalchemy.orm import Session
from core.models import Document, CodedSegment


def get_document_by_id(db: Session, doc_id: str) -> Document | None:
    return db.query(Document).filter(Document.id == doc_id).first()


def list_documents(db: Session, project_id: str = "") -> list[Document]:
    query = db.query(Document)

    if project_id:
        query = query.filter(Document.project_id == project_id)
        
    return query.order_by(Document.created_at.desc()).all()


def create_document(db: Session, doc: Document) -> None:
    db.add(doc)
    db.commit()


def delete_document(db: Session, doc: Document) -> None:
    db.delete(doc)
    db.commit()


def get_segments_for_document(db: Session, doc_id: str) -> list[CodedSegment]:
    return db.query(CodedSegment).filter(CodedSegment.document_id == doc_id).all()
