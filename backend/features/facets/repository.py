from sqlalchemy.orm import Session

from core.models import Facet, FacetAssignment, CodedSegment, Code, AnalysisResult


def get_segments_for_code(db: Session, code_id: str, user_id: str) -> list[CodedSegment]:
    return (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .all()
    )


def get_active_facets_for_code(db: Session, code_id: str, user_id: str | None = None) -> list[Facet]:
    q = db.query(Facet).filter(Facet.code_id == code_id, Facet.is_active == True)  # noqa: E712
    if user_id is not None:
        q = q.filter(Facet.user_id == user_id)
    return q.all()


def get_code(db: Session, code_id: str) -> Code | None:
    return db.query(Code).filter(Code.id == code_id).first()


def get_latest_analysis_for_code(db: Session, code_id: str) -> AnalysisResult | None:
    return (
        db.query(AnalysisResult)
        .filter(AnalysisResult.code_id == code_id)
        .order_by(AnalysisResult.created_at.desc())
        .first()
    )


def get_top_assignments_for_facet(
    db: Session, facet_id: str, limit: int = 5
) -> list[FacetAssignment]:
    return (
        db.query(FacetAssignment)
        .filter(FacetAssignment.facet_id == facet_id)
        .order_by(FacetAssignment.similarity_score.desc())
        .limit(limit)
        .all()
    )


def get_segments_by_ids(db: Session, ids: list[str]) -> list[CodedSegment]:
    return db.query(CodedSegment).filter(CodedSegment.id.in_(ids)).all()
