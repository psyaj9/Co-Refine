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


def create_segment_with_event(
    db: Session,
    *,
    segment_id: str,
    document_id: str,
    text: str,
    start_index: int,
    end_index: int,
    code_id: str,
    user_id: str,
    code: Code,
    batch: bool = False,
) -> CodedSegment:
    """Construct, persist, and record an edit event for a new segment.

    The caller is responsible for the final db.commit().
    """
    segment = CodedSegment(
        id=segment_id, document_id=document_id, text=text,
        start_index=start_index, end_index=end_index,
        code_id=code_id, user_id=user_id,
    )
    db.add(segment)
    db.flush()  # populate created_at without committing
    record_segment_event(
        db, project_id=code.project_id, document_id=document_id,
        action="created", segment_id=segment_id,
        code_label=code.label, code_colour=code.colour, code_id=code_id,
        segment_text=text, start_index=start_index, end_index=end_index,
        user_id=user_id, batch=batch,
    )
    return segment

