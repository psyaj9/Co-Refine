from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import User
from features.edit_history.schemas import EditEventOut
from features.edit_history.repository import get_edit_history
from features.projects.repository import get_membership
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/projects", tags=["edit_history"])


def _require_member(db: Session, project_id: str, user_id: str) -> None:
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{project_id}/edit-history", response_model=list[EditEventOut])
def get_edit_history_endpoint(
    project_id: str,
    document_id: str | None = Query(None),
    entity_type: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, project_id, current_user.id)
    events = get_edit_history(
        db, project_id, document_id=document_id,
        entity_type=entity_type, limit=limit, offset=offset,
    )
    return [
        EditEventOut(
            id=e.id,
            project_id=e.project_id,
            document_id=e.document_id,
            entity_type=e.entity_type,
            action=e.action,
            entity_id=e.entity_id,
            field_changed=e.field_changed,
            old_value=e.old_value,
            new_value=e.new_value,
            metadata_json=e.metadata_json,
            user_id=e.user_id,
            created_at=e.created_at,
        )
        for e in events
    ]
