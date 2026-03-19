"""
Facets repository: DB queries for clustering and facet display.

Facets are sub-themes discovered by KMeans clustering of segment embeddings.
Each code can have multiple active facets
"""
from sqlalchemy.orm import Session
from core.models import Facet, FacetAssignment, CodedSegment, Code, AnalysisResult


def get_segments_for_code(db: Session, code_id: str, user_id: str) -> list[CodedSegment]:
    """Return all segments coded by this user under a specific code.

    Args:
        db: Active SQLAlchemy session.
        code_id: The code whose segments to fetch.
        user_id: Filter to current user's coding.

    Returns:
        List of CodedSegment ORM objects.
    """
    return (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .all()
    )


def get_active_facets_for_code(db: Session, code_id: str, user_id: str | None = None) -> list[Facet]:
    """Return the currently active facets for a code.

    Args:
        db: Active SQLAlchemy session.
        code_id: The code to query facets for.
        user_id: User filter.

    Returns:
        List of active Facet ORM objects.
    """
    q = db.query(Facet).filter(Facet.code_id == code_id, Facet.is_active == True)

    if user_id is not None:
        q = q.filter(Facet.user_id == user_id)

    return q.all()


def get_code(db: Session, code_id: str) -> Code | None:
    """Code lookup by ID.

    Args:
        db: Active SQLAlchemy session.
        code_id: UUID of the code.

    Returns:
        Code ORM object, or None if not found.
    """
    return db.query(Code).filter(Code.id == code_id).first()


def get_latest_analysis_for_code(db: Session, code_id: str) -> AnalysisResult | None:
    """Fetch the most recent LLM analysis result for a code.

    Args:
        db: Active SQLAlchemy session.
        code_id: UUID of the code.

    Returns:
        Most recent AnalysisResult, or None.
    """
    return (
        db.query(AnalysisResult)
        .filter(AnalysisResult.code_id == code_id)
        .order_by(AnalysisResult.created_at.desc())
        .first()
    )


def get_top_assignments_for_facet(
    db: Session, facet_id: str, limit: int = 5
) -> list[FacetAssignment]:
    """Return the most representative segment assignments for a facet.

    Ordered by cosine similarity to the cluster centroid

    Args:
        db: Active SQLAlchemy session.
        facet_id: UUID of the facet.
        limit: How many top assignments to return.

    Returns:
        List of FacetAssignment ORM objects.
    """
    return (
        db.query(FacetAssignment)
        .filter(FacetAssignment.facet_id == facet_id)
        .order_by(FacetAssignment.similarity_score.desc())
        .limit(limit)
        .all()
    )


def get_segments_by_ids(db: Session, ids: list[str]) -> list[CodedSegment]:
    """Batch fetch segments by a list of IDs.

    Args:
        db: Active SQLAlchemy session.
        ids: List of segment UUIDs to fetch.

    Returns:
        List of CodedSegment ORM objects.
    """
    return db.query(CodedSegment).filter(CodedSegment.id.in_(ids)).all()
