"""Codes service: cascade delete, edit event recording."""
import uuid
from sqlalchemy.orm import Session

from core.models import Code, CodedSegment, AnalysisResult, AgentAlert, EditEvent
from core.logging import get_logger

logger = get_logger(__name__)


def record_code_event(
    db: Session,
    *,
    project_id: str,
    action: str,
    code_id: str,
    code_label: str,
    code_colour: str,
    user_id: str,
    definition: str | None = None,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    meta: dict = {"code_label": code_label, "code_colour": code_colour}
    if definition is not None:
        meta["definition"] = definition
    db.add(EditEvent(
        id=str(uuid.uuid4()),
        project_id=project_id,
        document_id=None,
        entity_type="code",
        action=action,
        entity_id=code_id,
        field_changed=field_changed,
        old_value=old_value,
        new_value=new_value,
        metadata_json=meta,
        user_id=user_id,
    ))


def cascade_delete_code(db: Session, code: Code, user_id: str) -> None:
    """Delete all segments, analyses, alerts associated with a code."""
    segments = db.query(CodedSegment).filter(CodedSegment.code_id == code.id).all()
    seg_ids = [s.id for s in segments]

    if seg_ids:
        try:
            from infrastructure.vector_store.store import get_collection
            get_collection(user_id).delete(ids=seg_ids)
        except Exception as e:
            logger.warning("Vector store cleanup failed on code delete", extra={"code_id": code.id, "error": str(e)})
        db.query(AgentAlert).filter(AgentAlert.segment_id.in_(seg_ids)).delete(synchronize_session=False)

    db.query(CodedSegment).filter(CodedSegment.code_id == code.id).delete()
    db.query(AnalysisResult).filter(AnalysisResult.code_id == code.id).delete()
