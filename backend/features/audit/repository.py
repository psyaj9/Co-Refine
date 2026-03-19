"""DB query functions for the audit feature.

"""

from sqlalchemy.orm import Session

from core.models import Code, CodedSegment, AnalysisResult


def get_code_by_id(db: Session, code_id: str) -> Code | None:
    """Fetch a single code by its primary key.

    Args:
        db: Active SQLAlchemy session.
        code_id: UUID string of the code.

    Returns:
        The Code ORM object, or None if not found.
    """
    return db.query(Code).filter(Code.id == code_id).first()


def count_segments_for_code(db: Session, code_id: str, user_id: str) -> int:
    """Count how many segments a user has assigned to a particular code.

    Scoped by user_id because different researchers in the same project can
    have different segment sets.

    Args:
        db: Active SQLAlchemy session.
        code_id: UUID string of the code.
        user_id: UUID string of the researcher.

    Returns:
        Integer count of matching CodedSegment rows.
    """
    return (
        db.query(CodedSegment)
        .filter(CodedSegment.code_id == code_id, CodedSegment.user_id == user_id)
        .count()
    )


def list_analyses_for_project(db: Session, project_id: str) -> list:
    """Fetch all AnalysisResult rows for a project, joined with their Code.

    Returns both the AnalysisResult and Code objects as tuples so the caller
    can access fields from both without a second query.

    Args:
        db: Active SQLAlchemy session.
        project_id: UUID string of the project. If empty string, returns all
            analyses (no project filter applied).

    Returns:
        List of (AnalysisResult, Code) tuples.
    """
    query = db.query(AnalysisResult, Code).join(Code, AnalysisResult.code_id == Code.id)
    if project_id:
        query = query.filter(Code.project_id == project_id)
    return query.all()


def list_codes_for_project(db: Session, project_id: str) -> list[Code]:
    """Fetch all Code rows belonging to a project.

    Args:
        db: Active SQLAlchemy session.
        project_id: UUID string of the project.

    Returns:
        List of Code ORM objects.
    """
    return db.query(Code).filter(Code.project_id == project_id).all()
