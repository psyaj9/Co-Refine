from sqlalchemy.orm import Session
from sqlalchemy import func

from core.models import Code, CodedSegment


def get_code_by_id(db: Session, code_id: str) -> Code | None:
    return db.query(Code).filter(Code.id == code_id).first()


def get_code_by_label_and_project(db: Session, label: str, project_id: str) -> Code | None:
    return (
        db.query(Code)
        .filter(Code.label == label, Code.project_id == project_id)
        .first()
    )


def list_codes(db: Session, project_id: str = "") -> list[Code]:
    query = db.query(Code)

    if project_id:
        query = query.filter(Code.project_id == project_id)

    return query.order_by(Code.label).all()


def create_code(db: Session, code: Code) -> None:
    db.add(code)
    db.commit()
    db.refresh(code)


def update_code(db: Session) -> None:
    db.commit()


def delete_code_record(db: Session, code: Code) -> None:
    db.delete(code)
    db.commit()


def segment_counts(db: Session, code_ids: list[str], user_id: str | None = None) -> dict[str, int]:
    query = (
        db.query(CodedSegment.code_id, func.count(CodedSegment.id))
        .filter(CodedSegment.code_id.in_(code_ids))
    )

    if user_id:
        query = query.filter(CodedSegment.user_id == user_id)

    rows = query.group_by(CodedSegment.code_id).all()
    
    return {code_id: count for code_id, count in rows}


def get_segments_for_code(db: Session, code_id: str, user_id: str) -> list[CodedSegment]:
    return (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .order_by(CodedSegment.created_at)
        .all()
    )
