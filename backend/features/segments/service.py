"""Segments service: create/delete with edit event recording.

Keeps the two operations together because they always go hand-in-hand —
every segment mutation gets an edit event, and the segment creation needs
to flush before the event is written so created_at is populated.
"""

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

    The metadata blob captures enough context to render the event in the history
    timeline without re-querying the segment (which may have been deleted by then).

    Args:
        db: Active DB session (event is added but NOT committed here).
        project_id: Project the segment belongs to.
        document_id: Document the segment was coded from.
        action: "created" or "deleted".
        segment_id: UUID of the segment.
        code_label: Code label at the time of the event.
        code_colour: Code colour at the time of the event.
        code_id: UUID of the code applied.
        segment_text: The selected text (truncated to 200 chars to keep events lean).
        start_index: Character offset in the document.
        end_index: End character offset.
        user_id: Who made the change.
        batch: True if this was part of a batch create operation.
    """
    meta: dict = {
        "code_label": code_label,
        "code_colour": code_colour,
        "code_id": code_id,
        # Truncate so a huge selection doesn't bloat the events table
        "segment_text": segment_text[:200],
        "start_index": start_index,
        "end_index": end_index,
    }
    if batch:
        meta["batch"] = True  # lets the history view group batch operations visually

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

    Uses db.flush() rather than db.commit() so the segment gets its created_at
    timestamp populated (needed for the edit event metadata) without ending the
    transaction. The caller is responsible for the final db.commit().

    Args:
        db: Active DB session.
        segment_id: Pre-generated UUID string for the new segment.
        document_id: Which document this segment was coded from.
        text: The selected text.
        start_index: Start character offset in the document full_text.
        end_index: End character offset.
        code_id: Which code is being applied.
        user_id: The coder creating this segment.
        code: The ORM Code object (used to capture label/colour/project_id in the event).
        batch: True if this is part of a batch operation.

    Returns:
        The flushed (but not committed) CodedSegment ORM object.
    """
    segment = CodedSegment(
        id=segment_id, document_id=document_id, text=text,
        start_index=start_index, end_index=end_index,
        code_id=code_id, user_id=user_id,
    )
    db.add(segment)
    # flush to populate created_at without committing — the caller owns the transaction boundary
    db.flush()
    record_segment_event(
        db, project_id=code.project_id, document_id=document_id,
        action="created", segment_id=segment_id,
        code_label=code.label, code_colour=code.colour, code_id=code_id,
        segment_text=text, start_index=start_index, end_index=end_index,
        user_id=user_id, batch=batch,
    )
    return segment
