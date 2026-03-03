from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from database import get_db, Code, CodedSegment, AnalysisResult, AgentAlert, EditEvent
from models import CodeCreate, CodeOut, CodeUpdate, SegmentOut
router = APIRouter(prefix="/api/codes", tags=["codes"])


def _code_to_out(code: Code, segment_count: int = 0) -> CodeOut:
    return CodeOut(
        id=code.id,
        label=code.label,
        definition=code.definition,
        colour=code.colour,
        created_by=code.created_by,
        project_id=code.project_id,
        segment_count=segment_count,
    )


def _segment_counts(db: Session, code_ids: list[str]) -> dict[str, int]:
    """Return a mapping of code_id -> segment count in a single query."""
    rows = (
        db.query(CodedSegment.code_id, func.count(CodedSegment.id))
        .filter(CodedSegment.code_id.in_(code_ids))
        .group_by(CodedSegment.code_id)
        .all()
    )
    return {code_id: count for code_id, count in rows}


@router.post("/", response_model=CodeOut)
def create_code(body: CodeCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Code)
        .filter(Code.label == body.label, Code.project_id == body.project_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Code label already exists in this project")

    code = Code(
        id=str(uuid.uuid4()),
        label=body.label,
        definition=body.definition,
        colour=body.colour or "#FFEB3B",
        created_by=body.user_id,
        project_id=body.project_id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)

    # Record edit event
    db.add(EditEvent(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        document_id=None,
        entity_type="code",
        action="created",
        entity_id=code.id,
        metadata_json={
            "code_label": body.label,
            "code_colour": body.colour or "#FFEB3B",
            "definition": body.definition,
        },
        user_id=body.user_id,
    ))
    db.commit()

    counts = _segment_counts(db, [code.id])
    return _code_to_out(code, counts.get(code.id, 0))


@router.get("/", response_model=list[CodeOut])
def list_codes(project_id: str = "", db: Session = Depends(get_db)):
    query = db.query(Code)
    if project_id:
        query = query.filter(Code.project_id == project_id)
    codes = query.order_by(Code.label).all()
    counts = _segment_counts(db, [c.id for c in codes])
    return [_code_to_out(c, counts.get(c.id, 0)) for c in codes]


@router.patch("/{code_id}", response_model=CodeOut)
def update_code(code_id: str, body: CodeUpdate, db: Session = Depends(get_db)):
    code = db.query(Code).filter(Code.id == code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    # Record one edit event per changed field
    changes: list[tuple[str, str | None, str | None]] = []
    if body.label is not None and body.label != code.label:
        changes.append(("label", code.label, body.label))
    if body.definition is not None and body.definition != code.definition:
        changes.append(("definition", code.definition, body.definition))
    if body.colour is not None and body.colour != code.colour:
        changes.append(("colour", code.colour, body.colour))

    if body.label is not None:
        code.label = body.label
    if body.definition is not None:
        code.definition = body.definition
    if body.colour is not None:
        code.colour = body.colour

    for field, old_val, new_val in changes:
        db.add(EditEvent(
            id=str(uuid.uuid4()),
            project_id=code.project_id,
            document_id=None,
            entity_type="code",
            action="updated",
            entity_id=code_id,
            field_changed=field,
            old_value=old_val,
            new_value=new_val,
            metadata_json={
                "code_label": code.label,
                "code_colour": code.colour,
            },
            user_id=code.created_by,
        ))

    db.commit()
    db.refresh(code)
    counts = _segment_counts(db, [code.id])
    return _code_to_out(code, counts.get(code.id, 0))


@router.delete("/{code_id}")
def delete_code(code_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    """
    Delete a code and ALL associated data:
    - coded segments (+ their vector embeddings)
    - analysis results
    - agent alerts linked to those segments
    This prevents orphaned "?" labels in the UI.
    """
    code = db.query(Code).filter(Code.id == code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    # Snapshot before deletion for edit history
    db.add(EditEvent(
        id=str(uuid.uuid4()),
        project_id=code.project_id,
        document_id=None,
        entity_type="code",
        action="deleted",
        entity_id=code_id,
        metadata_json={
            "code_label": code.label,
            "code_colour": code.colour,
            "definition": code.definition,
        },
        user_id=user_id,
    ))

    segments = db.query(CodedSegment).filter(CodedSegment.code_id == code_id).all()
    seg_ids = [seg.id for seg in segments]
    if seg_ids:
        # Batch delete all embeddings in one ChromaDB call
        try:
            from services.vector_store import get_collection
            get_collection(user_id).delete(ids=seg_ids)
        except Exception:
            pass
        db.query(AgentAlert).filter(AgentAlert.segment_id.in_(seg_ids)).delete(synchronize_session=False)

    db.query(CodedSegment).filter(CodedSegment.code_id == code_id).delete()
    db.query(AnalysisResult).filter(AnalysisResult.code_id == code_id).delete()

    db.delete(code)
    db.commit()
    return {"status": "deleted"}


@router.get("/{code_id}/segments", response_model=list[SegmentOut])
def get_code_segments(
    code_id: str,
    user_id: str = "default",
    db: Session = Depends(get_db),
):
    """Get all coded segments for a given code, ordered by creation time."""
    code = db.query(Code).filter(Code.id == code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    rows = (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .order_by(CodedSegment.created_at)
        .all()
    )

    return [
        SegmentOut(
            id=s.id,
            document_id=s.document_id,
            text=s.text,
            start_index=s.start_index,
            end_index=s.end_index,
            code_id=s.code_id,
            code_label=code.label,
            code_colour=code.colour,
            user_id=s.user_id,
            created_at=s.created_at,
        )
        for s in rows
    ]
