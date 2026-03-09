"""Audit repository: pure DB queries for the audit router and services."""
from sqlalchemy.orm import Session

from core.models import Code, CodedSegment, AnalysisResult


def get_code_by_id(db: Session, code_id: str) -> Code | None:
    return db.query(Code).filter(Code.id == code_id).first()


def count_segments_for_code(db: Session, code_id: str, user_id: str) -> int:
    return (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .count()
    )


def list_analyses_for_project(db: Session, project_id: str) -> list:
    """Returns list of (AnalysisResult, Code) tuples."""
    query = db.query(AnalysisResult, Code).join(Code, AnalysisResult.code_id == Code.id)
    if project_id:
        query = query.filter(Code.project_id == project_id)
    return query.all()


def list_codes_for_project(db: Session, project_id: str) -> list[Code]:
    return db.query(Code).filter(Code.project_id == project_id).all()
