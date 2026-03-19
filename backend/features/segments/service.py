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
    """Write an EditEvent row for a segment creation or deletion.

    Args:
        db: Active DB session.
        project_id: Project the segment belongs to.
        document_id: Document the segment was coded from.
        action: "created" or "deleted".
        segment_id: UUID of the segment.
        code_label: Code label at the time of the event.
        code_colour: Code colour at the time of the event.
        code_id: UUID of the code applied.
        segment_text: Parts of the selected text.
        start_index: Character offset in the document.
        end_index: End character offset.
        user_id: Who made the change.
        batch: True if this is part of a batch operation.
    """
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

    Args:
        db: Active DB session.
        segment_id: UUID string for the new segment.
        document_id: Which document this segment was coded from.
        text: The selected text.
        start_index: Start character offset in the document full_text.
        end_index: End character offset.
        code_id: Which code is being applied.
        user_id: The coder creating this segment.
        code: The ORM Code object.
        batch: True if this is part of a batch operation.

    Returns:
        The flushed CodedSegment ORM object.
    """
    segment = CodedSegment(
        id=segment_id, document_id=document_id, text=text,
        start_index=start_index, end_index=end_index,
        code_id=code_id, user_id=user_id,
    )
    db.add(segment)
    db.flush()
    record_segment_event(
        db, project_id=code.project_id, document_id=document_id,
        action="created", segment_id=segment_id,
        code_label=code.label, code_colour=code.colour, code_id=code_id,
        segment_text=text, start_index=start_index, end_index=end_index,
        user_id=user_id, batch=batch,
    )
    return segment
