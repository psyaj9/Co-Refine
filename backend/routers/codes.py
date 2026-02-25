from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from database import get_db, Code, CodedSegment, AnalysisResult, AgentAlert
from models import CodeCreate, CodeOut, CodeUpdate, SegmentOut
from services.vector_store import delete_segment_embedding

router = APIRouter(prefix="/api/codes", tags=["codes"])


def _code_to_out(code: Code, db: Session) -> CodeOut:
    count = db.query(CodedSegment).filter(CodedSegment.code_id == code.id).count()
    return CodeOut(
        id=code.id,
        label=code.label,
        definition=code.definition,
        colour=code.colour,
        created_by=code.created_by,
        project_id=code.project_id,
        segment_count=count,
    )


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
    return _code_to_out(code, db)


@router.get("/", response_model=list[CodeOut])
def list_codes(project_id: str = "", db: Session = Depends(get_db)):
    query = db.query(Code)
    if project_id:
        query = query.filter(Code.project_id == project_id)
    codes = query.order_by(Code.label).all()
    return [_code_to_out(c, db) for c in codes]


@router.patch("/{code_id}", response_model=CodeOut)
def update_code(code_id: str, body: CodeUpdate, db: Session = Depends(get_db)):
    code = db.query(Code).filter(Code.id == code_id).first()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    if body.label is not None:
        code.label = body.label
    if body.definition is not None:
        code.definition = body.definition
    if body.colour is not None:
        code.colour = body.colour
    db.commit()
    db.refresh(code)
    return _code_to_out(code, db)


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

    segments = db.query(CodedSegment).filter(CodedSegment.code_id == code_id).all()
    for seg in segments:
        delete_segment_embedding(user_id, seg.id)
        db.query(AgentAlert).filter(AgentAlert.segment_id == seg.id).delete()

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
