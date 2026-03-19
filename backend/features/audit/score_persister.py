"""Helpers for audit results that need to go into the database.

Both AgentAlert and ConsistencyScore rows are written here. 
This keeps the router code cleaner and also allows us to reuse this logic in other contexts if needed.
"""
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
    """Write a coding_audit alert to the database.

    Each segment can only have one coding_audit alert at a time. 
    When `delete_existing=True`, any previous coding_audit alert for this segment is deleted first.

    Args:
        db: Active SQLAlchemy session.
        user_id: UUID of the researcher who owns this segment.
        segment_id: UUID of the coded segment being audited.
        audit_result: Raw dict returned by the LLM auditor. 
                      Stored as JSON in the payload column.
        delete_existing: If True, delete any existing coding_audit alert for
            this segment before inserting the new one.

    Returns:
        The newly created AgentAlert ORM object.
    """
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
    """Write a ConsistencyScore row combining Stage 1 and LLM audit results.

    This merges the deterministic Stage 1 scores with the LLM-generated consistency scores into a single row. 
    Having them together makes it easy to query and compare across the project.

    Stage 1 fields come from the `stage1` dict. 
    If Stage 1 failed, those columns are left as None/False.

    Args:
        db: Active SQLAlchemy session.
        segment_id: UUID of the coded segment.
        code_id: UUID of the code assigned to the segment.
        user_id: UUID of the researcher.
        project_id: UUID of the project.
        stage1: Dict returned by compute_stage1_scores(), or None if Stage 1
            was skipped or failed.
        audit_result: Raw dict returned by the LLM auditor.
        delete_existing: If True, delete any existing ConsistencyScore for
            this (segment_id, code_id) pair before inserting.

    Returns:
        The newly created ConsistencyScore ORM object.
    """
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
