"""Documents service: upload orchestration and vector store cleanup."""

import uuid
from sqlalchemy.orm import Session

from core.models import Document, AgentAlert
from core.logging import get_logger
from features.documents.repository import (
    get_segments_for_document,
    delete_document,
    create_document as _create_document,
)

logger = get_logger(__name__)


def normalise_text(text: str) -> str:
    """Normalise line endings to Unix-style"""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def cleanup_document_vectors(db: Session, doc_id: str, user_id: str) -> None:
    """Remove ChromaDB embeddings and related alerts for all segments in a document.

    Args:
        db: Active DB session.
        doc_id: The document being deleted.
        user_id: Used to scope the ChromaDB collection.
    """
    segments = get_segments_for_document(db, doc_id)

    for seg in segments:
        try:
            from infrastructure.vector_store.store import delete_segment_embedding
            delete_segment_embedding(user_id, seg.id)

        except Exception as e:
            logger.warning("Vector cleanup failed for segment", extra={"segment_id": seg.id, "error": str(e)})

        db.query(AgentAlert).filter(AgentAlert.segment_id == seg.id).delete()


def create_document_from_upload(
    db: Session,
    *,
    project_id: str,
    title: str,
    text: str,
    doc_type: str,
    html: str | None = None,
    original_filename: str | None = None,
) -> Document:
    """Construct and persist a Document from an uploaded file.

    Args:
        db: Active DB session.
        project_id: Which project this document belongs to.
        title: Display title.
        text: Normalised text extracted from the file.
        doc_type: e.g. "transcript", "fieldnote", "interview".
        html
        original_filename

    Returns:
        The committed Document ORM object.
    """
    doc = Document(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=title,
        full_text=text,
        doc_type=doc_type,
        html_content=html,
        original_filename=original_filename,
    )

    _create_document(db, doc)
    
    return doc
