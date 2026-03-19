"""Segments router: HTTP endpoints for coded text segments.

Prefix: /api/segments

Endpoints:
  GET    /alerts           Retrieve recent audit alerts for the current user
  POST   /                 Create a single coded segment (triggers background audit)
  POST   /batch            Create multiple coded segments in one request
  GET    /                 List segments (optionally filtered by document)
  DELETE /{segment_id}     Delete a segment + its vector embedding, re-audit siblings
  GET    /{segment_id}     Fetch a single segment
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import CodedSegment, User
from core.config import settings
from core.logging import get_logger
from features.segments.schemas import SegmentCreate, SegmentOut, BatchSegmentCreate, AlertOut
from features.segments.repository import (
    get_segment_by_id,
    list_segments,
    delete_segment_record,
    get_code_for_segment,
    get_document,
    list_alerts,
)
from features.segments.service import create_segment_with_event, record_segment_event
from features.projects.repository import get_membership
from infrastructure.auth.dependencies import get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/api/segments", tags=["segments"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_member(db: Session, project_id: str, user_id: str) -> None:
    """Raise 403 if the user isn't a project member."""
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


def _seg_out(seg: CodedSegment, code_label: str, code_colour: str) -> SegmentOut:
    """Map a CodedSegment ORM object to the response schema."""
    return SegmentOut(
        id=seg.id, document_id=seg.document_id, text=seg.text,
        start_index=seg.start_index, end_index=seg.end_index,
        code_id=seg.code_id, code_label=code_label, code_colour=code_colour,
        user_id=seg.user_id, created_at=seg.created_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AlertOut])
def list_alerts_endpoint(
    unread_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return recent audit alerts for the current user.

    The frontend polls this on load and also receives real-time alerts via WebSocket.
    This endpoint covers the case where the WS connection wasn't open when alerts fired.
    """
    alerts = list_alerts(db, current_user.id, unread_only)
    return [
        AlertOut(
            id=a.id, alert_type=a.alert_type, payload=a.payload,
            segment_id=a.segment_id, is_read=a.is_read, created_at=a.created_at,
        )
        for a in alerts
    ]


@router.post("/", response_model=SegmentOut)
async def create_segment_endpoint(
    body: SegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = get_code_for_segment(db, body.code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    doc = get_document(db, body.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    seg_id = str(uuid.uuid4())
    segment = create_segment_with_event(
        db,
        segment_id=seg_id, document_id=body.document_id, text=body.text,
        start_index=body.start_index, end_index=body.end_index,
        code_id=body.code_id, user_id=current_user.id, code=code,
    )
    db.commit()

    # Only trigger the audit pipeline when Azure is configured — no key, no LLM work
    if settings.azure_api_key:
        from features.audit.service import run_background_agents
        from features.audit.context_builder import extract_window
        context_window = extract_window(doc.full_text, body.start_index, body.end_index)
        background_tasks.add_task(
            run_background_agents,
            segment_id=seg_id, text=body.text, code_label=code.label,
            code_id=body.code_id, user_id=current_user.id, document_id=body.document_id,
            document_context=context_window, start_index=body.start_index,
            end_index=body.end_index, created_at=segment.created_at.isoformat(),
        )

    return _seg_out(segment, code.label, code.colour)


@router.post("/batch")
async def batch_create_segments(
    body: BatchSegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create multiple segments in a single transaction.

    Invalid items (unknown code/document) are silently skipped rather than
    aborting the whole batch — the response count tells the caller how many
    actually succeeded.
    """
    if not body.items:
        return {"created": 0}

    from features.audit.context_builder import extract_window
    created_segments: list[dict] = []

    for item in body.items:
        code = get_code_for_segment(db, item.code_id)
        if not code:
            continue    # skip unknown code rather than failing the whole batch
        doc = get_document(db, item.document_id)
        if not doc:
            continue    # skip unknown document

        seg_id = str(uuid.uuid4())
        segment = create_segment_with_event(
            db,
            segment_id=seg_id, document_id=item.document_id, text=item.text,
            start_index=item.start_index, end_index=item.end_index,
            code_id=item.code_id, user_id=current_user.id, code=code, batch=True,
        )

        context_window = extract_window(doc.full_text, item.start_index, item.end_index)
        created_segments.append({
            "segment_id": seg_id,
            "text": item.text,
            "code_label": code.label,
            "code_id": item.code_id,
            "user_id": current_user.id,
            "document_id": item.document_id,
            "document_context": context_window,
            "start_index": item.start_index,
            "end_index": item.end_index,
            "created_at": segment.created_at.isoformat() if segment.created_at else None,
        })

    # Single commit for the whole batch — faster and atomic
    db.commit()

    if settings.azure_api_key:
        from features.audit.service import run_background_agents
        for seg_info in created_segments:
            background_tasks.add_task(run_background_agents, **seg_info)

    return {"created": len(created_segments)}


@router.get("/", response_model=list[SegmentOut])
def list_segments_endpoint(
    document_id: str = "",
    all_coders: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if document_id:
        doc = get_document(db, document_id)
        if doc:
            _require_member(db, doc.project_id, current_user.id)

    # all_coders=True is used by the document viewer to show all coders' work in the margin
    user_filter = "" if all_coders else current_user.id
    rows = list_segments(db, document_id, user_filter)
    return [
        # Guard against orphaned segments whose code was deleted
        _seg_out(s, code.label if code else "?", code.colour if code else "#ccc")
        for s, code in rows
    ]


@router.delete("/{segment_id}")
def delete_segment_endpoint(
    segment_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_segment_by_id(db, segment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg, code = row

    # Coders can only delete their own work
    if seg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's segment")

    doc = get_document(db, seg.document_id)
    # Try to get the project_id from the code first; fall back to the document
    project_id = code.project_id if code else (doc.project_id if doc else None)
    # Capture span before deletion so sibling re-audit can use it
    seg_start, seg_end = seg.start_index, seg.end_index

    if project_id:
        record_segment_event(
            db, project_id=project_id, document_id=seg.document_id,
            action="deleted", segment_id=segment_id,
            code_label=code.label if code else "?",
            code_colour=code.colour if code else "#ccc",
            code_id=seg.code_id,
            segment_text=seg.text, start_index=seg.start_index, end_index=seg.end_index,
            user_id=current_user.id,
        )

    # Remove from vector store before deleting the DB row — best-effort, won't block deletion
    try:
        from infrastructure.vector_store.store import delete_segment_embedding
        delete_segment_embedding(current_user.id, segment_id)
    except Exception as e:
        logger.warning("Vector store cleanup failed for segment", extra={"segment_id": segment_id, "error": str(e)})

    delete_segment_record(db, seg)

    # Re-run audit on segments that overlapped with the deleted one — their context has changed
    if settings.azure_api_key:
        from features.audit.service import reaudit_siblings_background
        background_tasks.add_task(
            reaudit_siblings_background,
            document_id=seg.document_id,
            start_index=seg_start,
            end_index=seg_end,
            exclude_segment_id=segment_id,
            user_id=current_user.id,
        )


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(
    segment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_segment_by_id(db, segment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg, code = row
    if code:
        _require_member(db, code.project_id, current_user.id)
    return _seg_out(seg, code.label if code else "?", code.colour if code else "#ccc")
