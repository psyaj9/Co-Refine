"""Document service: upload orchestration and text normalization."""
from sqlalchemy.orm import Session

from core.models import Document, AgentAlert
from core.logging import get_logger
from features.documents.repository import get_segments_for_document, delete_document

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
