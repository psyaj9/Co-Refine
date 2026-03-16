import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.models import Code, User
from features.codes.schemas import CodeCreate, CodeOut, CodeUpdate, SegmentOut
from features.codes.repository import (
    get_code_by_id,
    get_code_by_label_and_project,
    list_codes,
    create_code,
    update_code,
    delete_code_record,
    segment_counts,
    get_segments_for_code,
)
from features.codes.service import record_code_event, cascade_delete_code
from features.projects.repository import get_membership
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/codes", tags=["codes"])


def _require_member(db: Session, project_id: str, user_id: str) -> None:
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


def _code_to_out(code: Code, count: int = 0) -> CodeOut:
    return CodeOut(
        id=code.id, label=code.label, definition=code.definition,
        colour=code.colour, created_by=code.created_by,
        project_id=code.project_id, segment_count=count,
    )


@router.post("/", response_model=CodeOut)
def create_code_endpoint(
    body: CodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = get_code_by_label_and_project(db, body.label, body.project_id)

    if existing:
        raise HTTPException(status_code=409, detail="Code label already exists in this project")

    user_id = current_user.id
    code = Code(
        id=str(uuid.uuid4()),
        label=body.label,
        definition=body.definition,
        colour=body.colour or "#FFEB3B",
        created_by=user_id,
        project_id=body.project_id,
    )

    create_code(db, code)
    record_code_event(
        db, project_id=body.project_id, action="created",
        code_id=code.id, code_label=body.label,
        code_colour=body.colour or "#FFEB3B",
        user_id=user_id, definition=body.definition,
    )

    db.commit()
    counts = segment_counts(db, [code.id], user_id=user_id)

    return _code_to_out(code, counts.get(code.id, 0))


@router.get("/", response_model=list[CodeOut])
def list_codes_endpoint(
    project_id: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id:
        _require_member(db, project_id, current_user.id)

    codes = list_codes(db, project_id)
    counts = segment_counts(db, [c.id for c in codes], user_id=current_user.id)

    return [_code_to_out(c, counts.get(c.id, 0)) for c in codes]


@router.patch("/{code_id}", response_model=CodeOut)
def update_code_endpoint(
    code_id: str,
    body: CodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = get_code_by_id(db, code_id)

    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

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
        record_code_event(
            db, project_id=code.project_id, action="updated",
            code_id=code_id, code_label=code.label, code_colour=code.colour,
            user_id=current_user.id, field_changed=field,
            old_value=old_val, new_value=new_val,
        )

    update_code(db)
    db.refresh(code)
    counts = segment_counts(db, [code.id], user_id=current_user.id)

    return _code_to_out(code, counts.get(code.id, 0))


@router.delete("/{code_id}")
def delete_code_endpoint(
    code_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = get_code_by_id(db, code_id)

    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    record_code_event(
        db, project_id=code.project_id, action="deleted",
        code_id=code_id, code_label=code.label, code_colour=code.colour,
        user_id=current_user.id, definition=code.definition,
    )

    cascade_delete_code(db, code, current_user.id)
    delete_code_record(db, code)

    return {"status": "deleted"}


@router.get("/{code_id}/segments", response_model=list[SegmentOut])
def get_code_segments(
    code_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = get_code_by_id(db, code_id)

    if not code:
        raise HTTPException(status_code=404, detail="Code not found")

    rows = get_segments_for_code(db, code_id, current_user.id)
    
    return [
        SegmentOut(
            id=s.id, document_id=s.document_id, text=s.text,
            start_index=s.start_index, end_index=s.end_index,
            code_id=s.code_id, code_label=code.label, code_colour=code.colour,
            user_id=s.user_id, created_at=s.created_at,
        )
        for s in rows
    ]
