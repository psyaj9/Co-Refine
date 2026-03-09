"""Segments feature router: CRUD + alerts."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import CodedSegment
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

logger = get_logger(__name__)

router = APIRouter(prefix="/api/segments", tags=["segments"])


def _seg_out(seg: CodedSegment, code_label: str, code_colour: str) -> SegmentOut:
    return SegmentOut(
        id=seg.id, document_id=seg.document_id, text=seg.text,
        start_index=seg.start_index, end_index=seg.end_index,
        code_id=seg.code_id, code_label=code_label, code_colour=code_colour,
        user_id=seg.user_id, created_at=seg.created_at,
    )


# ── Alerts ──────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AlertOut])
def list_alerts_endpoint(user_id: str, unread_only: bool = True, db: Session = Depends(get_db)):
    alerts = list_alerts(db, user_id, unread_only)
    return [
        AlertOut(
            id=a.id, alert_type=a.alert_type, payload=a.payload,
            segment_id=a.segment_id, is_read=a.is_read, created_at=a.created_at,
        )
        for a in alerts
    ]


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=SegmentOut)
async def create_segment_endpoint(
    body: SegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
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
        code_id=body.code_id, user_id=body.user_id, code=code,
    )
    db.commit()

    if settings.azure_api_key:
        from features.audit.orchestrator import run_background_agents
        from features.audit.context_builder import extract_window
        context_window = extract_window(doc.full_text, body.start_index, body.end_index)
        background_tasks.add_task(
            run_background_agents,
            segment_id=seg_id, text=body.text, code_label=code.label,
            code_id=body.code_id, user_id=body.user_id, document_id=body.document_id,
            document_context=context_window, start_index=body.start_index,
            end_index=body.end_index, created_at=segment.created_at.isoformat(),
        )

    return _seg_out(segment, code.label, code.colour)


@router.post("/batch")
async def batch_create_segments(
    body: BatchSegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not body.items:
        return {"created": 0}

    from features.audit.context_builder import extract_window
    created_segments: list[dict] = []
    user_id = body.items[0].user_id

    for item in body.items:
        code = get_code_for_segment(db, item.code_id)
        if not code:
            continue
        doc = get_document(db, item.document_id)
        if not doc:
            continue

        seg_id = str(uuid.uuid4())
        segment = create_segment_with_event(
            db,
            segment_id=seg_id, document_id=item.document_id, text=item.text,
            start_index=item.start_index, end_index=item.end_index,
            code_id=item.code_id, user_id=item.user_id, code=code, batch=True,
        )

        context_window = extract_window(doc.full_text, item.start_index, item.end_index)
        created_segments.append({
            "segment_id": seg_id,
            "text": item.text,
            "code_label": code.label,
            "code_id": item.code_id,
            "user_id": item.user_id,
            "document_id": item.document_id,
            "document_context": context_window,
            "start_index": item.start_index,
            "end_index": item.end_index,
            "created_at": segment.created_at.isoformat() if segment.created_at else None,
        })

    db.commit()

    if settings.azure_api_key:
        from features.audit.orchestrator import run_background_agents
        for seg_info in created_segments:
            background_tasks.add_task(run_background_agents, **seg_info)

    return {"created": len(created_segments)}


@router.get("/", response_model=list[SegmentOut])
def list_segments_endpoint(
    document_id: str = "",
    user_id: str = "",
    db: Session = Depends(get_db),
):
    rows = list_segments(db, document_id, user_id)
    return [
        _seg_out(s, code.label if code else "?", code.colour if code else "#ccc")
        for s, code in rows
    ]


@router.delete("/{segment_id}")
def delete_segment_endpoint(
    segment_id: str,
    user_id: str = "default",
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    row = get_segment_by_id(db, segment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg, code = row

    doc = get_document(db, seg.document_id)
    project_id = code.project_id if code else (doc.project_id if doc else None)
    seg_start, seg_end = seg.start_index, seg.end_index

    if project_id:
        record_segment_event(
            db, project_id=project_id, document_id=seg.document_id,
            action="deleted", segment_id=segment_id,
            code_label=code.label if code else "?",
            code_colour=code.colour if code else "#ccc",
            code_id=seg.code_id,
            segment_text=seg.text, start_index=seg.start_index, end_index=seg.end_index,
            user_id=user_id,
        )

    try:
        from infrastructure.vector_store.store import delete_segment_embedding
        delete_segment_embedding(user_id, segment_id)
    except Exception as e:
        logger.warning("Vector store cleanup failed for segment", extra={"segment_id": segment_id, "error": str(e)})

    delete_segment_record(db, seg)

    if settings.azure_api_key and background_tasks is not None:
        from features.audit.sibling_auditor import reaudit_siblings_background
        background_tasks.add_task(
            reaudit_siblings_background,
            document_id=seg.document_id,
            start_index=seg_start,
            end_index=seg_end,
            exclude_segment_id=segment_id,
            user_id=user_id,
        )

    return {"status": "deleted"}


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(segment_id: str, db: Session = Depends(get_db)):
    row = get_segment_by_id(db, segment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg, code = row
    return _seg_out(seg, code.label if code else "?", code.colour if code else "#ccc")
