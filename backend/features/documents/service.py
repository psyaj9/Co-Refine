"""Document service: upload orchestration and text normalization."""
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
    """Normalise line endings."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def cleanup_document_vectors(db: Session, doc_id: str, user_id: str) -> None:
    """Delete segment embeddings and alerts before removing a document."""
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
    """Build and persist a Document from a file upload."""
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

