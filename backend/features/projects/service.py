import uuid
from sqlalchemy.orm import Session

from core.models import Project, ProjectMember
from core.config import settings as global_settings
from core.logging import get_logger
from features.projects.constants import AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
from features.projects.schemas import ProjectOut, ProjectSettingsOut
from features.projects.repository import (
    batch_project_counts,
    get_segment_ids_for_project,
    create_project,
    add_project_member,
)

logger = get_logger(__name__)


def create_new_project(db: Session, name: str, user_id: str | None = None) -> Project:
    """Create and persist a new Project."""
    project = Project(id=str(uuid.uuid4()), name=name, user_id=user_id)
    return create_project(db, project)


def project_to_out(project: Project, doc_count: int = 0, code_count: int = 0) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        document_count=doc_count,
        code_count=code_count,
        created_at=project.created_at,
    )


def get_merged_thresholds(project: Project) -> dict[str, float | int]:
    defaults = {td["key"]: getattr(global_settings, td["key"], td["default"]) for td in THRESHOLD_DEFINITIONS}
    overrides = project.thresholds_json or {}
    return {**defaults, **{k: v for k, v in overrides.items() if k in defaults}}


def build_settings_out(project: Project) -> ProjectSettingsOut:
    return ProjectSettingsOut(
        enabled_perspectives=project.enabled_perspectives or ["self_consistency"],
        available_perspectives=AVAILABLE_PERSPECTIVES,
        thresholds=get_merged_thresholds(project),
    )


def cleanup_project_vectors(db: Session, project_id: str, user_id: str) -> None:
    seg_ids = get_segment_ids_for_project(db, project_id)
    if not seg_ids:
        return
    try:
        from infrastructure.vector_store.store import get_collection
        get_collection(user_id).delete(ids=seg_ids)
    except Exception as e:
        logger.warning("Vector store cleanup failed during project delete", extra={"error": str(e)})

