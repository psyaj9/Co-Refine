from sqlalchemy.orm import Session

from core.models import EditEvent


def get_edit_history(
    db: Session,
    project_id: str,
    document_id: str | None = None,
    entity_type: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[EditEvent]:
    query = db.query(EditEvent).filter(EditEvent.project_id == project_id)
    if document_id:
        query = query.filter(EditEvent.document_id == document_id)
    if entity_type:
        query = query.filter(EditEvent.entity_type == entity_type)
    return (
        query.order_by(EditEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
