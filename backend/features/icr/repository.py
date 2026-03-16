"""
Database query functions for the ICR feature.
All functions are pure DB access — no business logic.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.models import CodedSegment, Code, IcrResolution, ProjectMember
from core.models.document import Document
from core.models.user import User


def list_members_for_project(db: Session, project_id: str) -> list[ProjectMember]:
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at)
        .all()
    )


def list_documents_for_project(db: Session, project_id: str) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.created_at)
        .all()
    )


def get_document_text(db: Session, document_id: str) -> str | None:
    doc = db.query(Document).filter(Document.id == document_id).first()
    return doc.full_text if doc else None


def list_segments_for_document_all_coders(
    db: Session,
    document_id: str,
    coder_ids: list[str],
) -> list[tuple[CodedSegment, Code]]:
    """Return (segment, code) pairs for ALL coders of a document."""
    rows = (
        db.query(CodedSegment, Code)
        .join(Code, CodedSegment.code_id == Code.id)
        .filter(
            CodedSegment.document_id == document_id,
            CodedSegment.user_id.in_(coder_ids),
        )
        .order_by(CodedSegment.start_index)
        .all()
    )
    return rows


def get_user_display_name(db: Session, user_id: str) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return user_id[:8]
    return user.display_name or user.email


def get_users_by_ids(db: Session, user_ids: list[str]) -> dict[str, User]:
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {u.id: u for u in users}


def get_code(db: Session, code_id: str) -> Code | None:
    return db.query(Code).filter(Code.id == code_id).first()


def get_codes_for_project(db: Session, project_id: str) -> list[Code]:
    return db.query(Code).filter(Code.project_id == project_id).order_by(Code.label).all()


# ── Resolutions ───────────────────────────────────────────────────────────────

def create_resolution(
    db: Session,
    project_id: str,
    document_id: str | None,
    span_start: int,
    span_end: int,
    disagreement_type: str,
    chosen_segment_id: str | None,
    resolution_note: str | None,
    user_id: str,
) -> IcrResolution:
    import uuid
    res = IcrResolution(
        id=str(uuid.uuid4()),
        project_id=project_id,
        document_id=document_id,
        span_start=span_start,
        span_end=span_end,
        disagreement_type=disagreement_type,
        status="unresolved",
        chosen_segment_id=chosen_segment_id,
        resolved_by=user_id,
        resolution_note=resolution_note,
        created_at=datetime.now(timezone.utc),
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return res


def get_resolution(db: Session, resolution_id: str) -> IcrResolution | None:
    return db.query(IcrResolution).filter(IcrResolution.id == resolution_id).first()


def update_resolution(
    db: Session,
    resolution: IcrResolution,
    status: str | None,
    chosen_segment_id: str | None,
    resolution_note: str | None,
    user_id: str,
    llm_analysis: str | None = None,
) -> IcrResolution:
    if status is not None:
        resolution.status = status
        if status == "resolved":
            resolution.resolved_at = datetime.now(timezone.utc)
            resolution.resolved_by = user_id
    if chosen_segment_id is not None:
        resolution.chosen_segment_id = chosen_segment_id
    if resolution_note is not None:
        resolution.resolution_note = resolution_note
    if llm_analysis is not None:
        resolution.llm_analysis = llm_analysis
    db.commit()
    db.refresh(resolution)
    return resolution


def list_resolutions(
    db: Session,
    project_id: str,
    document_id: str | None = None,
    status: str | None = None,
) -> list[IcrResolution]:
    q = db.query(IcrResolution).filter(IcrResolution.project_id == project_id)
    if document_id:
        q = q.filter(IcrResolution.document_id == document_id)
    if status:
        q = q.filter(IcrResolution.status == status)
    return q.order_by(IcrResolution.created_at.desc()).all()
