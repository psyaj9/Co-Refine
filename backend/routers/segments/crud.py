"""Segment CRUD operations.

Handles create, batch-create, list, delete, and get-by-id for CodedSegment.
Background audit tasks are dispatched to services.audit_pipeline.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

from database import get_db, CodedSegment, Code, Document, EditEvent
from models import SegmentCreate, SegmentOut, BatchSegmentCreate
from services.audit_pipeline import (
    _run_background_agents,
    _reaudit_siblings_background,
    _extract_window,
)
from services.vector_store import delete_segment_embedding
from config import settings

router = APIRouter()


@router.post("/", response_model=SegmentOut)
async def create_segment(
    body: SegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    code = db.query(Code).filter(Code.id == body.code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    doc = db.query(Document).filter(Document.id == body.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    seg_id = str(uuid.uuid4())
    segment = CodedSegment(
        id=seg_id,
        document_id=body.document_id,
        text=body.text,
        start_index=body.start_index,
        end_index=body.end_index,
        code_id=body.code_id,
        user_id=body.user_id,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)

    # Record edit event
    db.add(EditEvent(
        id=str(uuid.uuid4()),
        project_id=code.project_id,
        document_id=body.document_id,
        entity_type="segment",
        action="created",
        entity_id=seg_id,
        metadata_json={
            "code_label": code.label,
            "code_colour": code.colour,
            "code_id": body.code_id,
            "segment_text": body.text[:200],
            "start_index": body.start_index,
            "end_index": body.end_index,
        },
        user_id=body.user_id,
    ))
    db.commit()

    if settings.azure_api_key:
        context_window = _extract_window(doc.full_text, body.start_index, body.end_index)
        background_tasks.add_task(
            _run_background_agents,
            segment_id=seg_id,
            text=body.text,
            code_label=code.label,
            code_id=body.code_id,
            user_id=body.user_id,
            document_id=body.document_id,
            document_context=context_window,
            start_index=body.start_index,
            end_index=body.end_index,
            created_at=segment.created_at.isoformat(),
        )

    return SegmentOut(
        id=seg_id,
        document_id=body.document_id,
        text=body.text,
        start_index=body.start_index,
        end_index=body.end_index,
        code_id=body.code_id,
        code_label=code.label,
        code_colour=code.colour,
        user_id=body.user_id,
        created_at=segment.created_at,
    )


@router.post("/batch")
async def batch_create_segments(
    body: BatchSegmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create multiple coded segments in one request, trigger ONE consolidated audit."""
    if not body.items:
        return {"created": 0}

    created_segments: list[dict] = []
    user_id = body.items[0].user_id
    project_id: str | None = None

    for item in body.items:
        code = db.query(Code).filter(Code.id == item.code_id).first()
        if not code:
            continue
        doc = db.query(Document).filter(Document.id == item.document_id).first()
        if not doc:
            continue

        if project_id is None:
            project_id = code.project_id

        seg_id = str(uuid.uuid4())
        segment = CodedSegment(
            id=seg_id,
            document_id=item.document_id,
            text=item.text,
            start_index=item.start_index,
            end_index=item.end_index,
            code_id=item.code_id,
            user_id=item.user_id,
        )
        db.add(segment)
        db.flush()

        # Record edit event
        db.add(EditEvent(
            id=str(uuid.uuid4()),
            project_id=code.project_id,
            document_id=item.document_id,
            entity_type="segment",
            action="created",
            entity_id=seg_id,
            metadata_json={
                "code_label": code.label,
                "code_colour": code.colour,
                "code_id": item.code_id,
                "segment_text": item.text[:200],
                "start_index": item.start_index,
                "end_index": item.end_index,
                "batch": True,
            },
            user_id=item.user_id,
        ))

        context_window = _extract_window(doc.full_text, item.start_index, item.end_index)
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

    # Trigger background agents for each created segment (single consolidated pipeline)
    if settings.azure_api_key:
        for seg_info in created_segments:
            background_tasks.add_task(_run_background_agents, **seg_info)

    return {"created": len(created_segments)}


@router.get("/", response_model=list[SegmentOut])
def list_segments(
    document_id: str = "",
    user_id: str = "",
    db: Session = Depends(get_db),
):
    # Single JOIN query — avoids N+1 (one query per segment to fetch its code).
    query = db.query(CodedSegment, Code).outerjoin(Code, CodedSegment.code_id == Code.id)
    if document_id:
        query = query.filter(CodedSegment.document_id == document_id)
    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)
    rows = query.order_by(CodedSegment.created_at).all()

    return [
        SegmentOut(
            id=s.id,
            document_id=s.document_id,
            text=s.text,
            start_index=s.start_index,
            end_index=s.end_index,
            code_id=s.code_id,
            code_label=code.label if code else "?",
            code_colour=code.colour if code else "#ccc",
            user_id=s.user_id,
            created_at=s.created_at,
        )
        for s, code in rows
    ]


@router.delete("/{segment_id}")
def delete_segment(
    segment_id: str,
    user_id: str = "default",
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    seg = db.query(CodedSegment).filter(CodedSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Snapshot before deletion for edit history + sibling re-audit
    code = db.query(Code).filter(Code.id == seg.code_id).first()
    doc = db.query(Document).filter(Document.id == seg.document_id).first()
    project_id = code.project_id if code else (doc.project_id if doc else None)
    seg_document_id = seg.document_id
    seg_start = seg.start_index
    seg_end = seg.end_index

    if project_id:
        db.add(EditEvent(
            id=str(uuid.uuid4()),
            project_id=project_id,
            document_id=seg.document_id,
            entity_type="segment",
            action="deleted",
            entity_id=segment_id,
            metadata_json={
                "code_label": code.label if code else "?",
                "code_colour": code.colour if code else "#ccc",
                "code_id": seg.code_id,
                "segment_text": seg.text[:200],
                "start_index": seg.start_index,
                "end_index": seg.end_index,
            },
            user_id=user_id,
        ))

    delete_segment_embedding(user_id, segment_id)
    db.delete(seg)
    db.commit()

    # Re-audit siblings — their co-applied context just changed (code removed)
    if settings.azure_api_key and background_tasks is not None:
        background_tasks.add_task(
            _reaudit_siblings_background,
            document_id=seg_document_id,
            start_index=seg_start,
            end_index=seg_end,
            exclude_segment_id=segment_id,
            user_id=user_id,
        )

    return {"status": "deleted"}


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(segment_id: str, db: Session = Depends(get_db)):
    """Fetch a single segment by ID."""
    row = (
        db.query(CodedSegment, Code)
        .outerjoin(Code, CodedSegment.code_id == Code.id)
        .filter(CodedSegment.id == segment_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg, code = row
    return SegmentOut(
        id=seg.id,
        document_id=seg.document_id,
        text=seg.text,
        start_index=seg.start_index,
        end_index=seg.end_index,
        code_id=seg.code_id,
        code_label=code.label if code else "?",
        code_colour=code.colour if code else "#ccc",
        user_id=seg.user_id,
        created_at=seg.created_at,
    )
