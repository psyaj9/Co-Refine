"""Alert management endpoints for segment audit alerts."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db, AgentAlert
from models import AlertOut

router = APIRouter()


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(user_id: str, unread_only: bool = True, db: Session = Depends(get_db)):
    query = db.query(AgentAlert).filter(AgentAlert.user_id == user_id)
    if unread_only:
        query = query.filter(AgentAlert.is_read == False)
    alerts = query.order_by(AgentAlert.created_at.desc()).limit(50).all()
    return [
        AlertOut(
            id=a.id,
            alert_type=a.alert_type,
            payload=a.payload,
            segment_id=a.segment_id,
            is_read=a.is_read,
            created_at=a.created_at,
        )
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AgentAlert).filter(AgentAlert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"status": "ok"}
