from __future__ import annotations
import uuid

from sqlalchemy.orm import Session

from core.models import ConsistencyScore, AgentAlert


def persist_agent_alert(
    *,
    db: Session,
    user_id: str,
    segment_id: str,
    audit_result: dict,
    delete_existing: bool = False,
) -> AgentAlert:
    if delete_existing:
        db.query(AgentAlert).filter(
            AgentAlert.segment_id == segment_id,
            AgentAlert.alert_type == "coding_audit",
        ).delete()
    alert = AgentAlert(
        id=str(uuid.uuid4()),
        user_id=user_id,
        segment_id=segment_id,
        alert_type="coding_audit",
        payload=audit_result,
    )
    db.add(alert)
    return alert


def persist_consistency_score(
    *,
    db: Session,
    segment_id: str,
    code_id: str,
    user_id: str,
    project_id: str,
    stage1: dict | None,
    audit_result: dict,
    delete_existing: bool = False,
) -> ConsistencyScore:
    
    if delete_existing:
        db.query(ConsistencyScore).filter(
            ConsistencyScore.segment_id == segment_id,
            ConsistencyScore.code_id == code_id,
        ).delete()

    self_lens = audit_result.get("self_lens", {})

    score_row = ConsistencyScore(
        id=str(uuid.uuid4()),
        segment_id=segment_id,
        code_id=code_id,
        user_id=user_id,
        project_id=project_id,
        centroid_similarity=stage1["centroid_similarity"] if stage1 else None,
        is_pseudo_centroid=stage1["is_pseudo_centroid"] if stage1 else False,
        temporal_drift=stage1["temporal_drift"] if stage1 else None,
        llm_consistency_score=self_lens.get("consistency_score"),
        llm_intent_score=self_lens.get("intent_alignment_score"),
        llm_overall_severity=audit_result.get("overall_severity_score"),
    )

    db.add(score_row)
    
    return score_row
