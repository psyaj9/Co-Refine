"""Segments service: create/delete with edit event recording."""
import uuid
from sqlalchemy.orm import Session

from core.models import Code, CodedSegment, EditEvent
from core.logging import get_logger

logger = get_logger(__name__)


def record_segment_event(
    db: Session,
    *,
    project_id: str,
    document_id: str,
    action: str,
    segment_id: str,
    code_label: str,
    code_colour: str,
    code_id: str,
    segment_text: str,
    start_index: int,
    end_index: int,
    user_id: str,
    batch: bool = False,
) -> None:
    meta: dict = {
        "code_label": code_label,
        "code_colour": code_colour,
        "code_id": code_id,
        "segment_text": segment_text[:200],
        "start_index": start_index,
        "end_index": end_index,
    }
    if batch:
        meta["batch"] = True
    db.add(EditEvent(
        id=str(uuid.uuid4()),
        project_id=project_id,
        document_id=document_id,
        entity_type="segment",
        action=action,
        entity_id=segment_id,
        metadata_json=meta,
        user_id=user_id,
    ))
