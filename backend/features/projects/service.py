"""Projects service: business logic for project creation, settings, and cleanup.

Sits between the router and repository. Knows about cross-cutting concerns like
vector store cleanup and threshold merging, but doesn't touch HTTP directly.
"""

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
    """Create and persist a new Project, adding the creator as owner member.

    Args:
        db: Active DB session.
        name: Display name for the project.
        user_id: The creating user's ID — if provided, a ProjectMember row is added
                 with role "owner" so the membership queries work correctly.

    Returns:
        The freshly committed Project ORM object.
    """
    # UUID keeps IDs portable across environments (no autoincrement collisions)
    project = Project(id=str(uuid.uuid4()), name=name, user_id=user_id)
    create_project(db, project)
    if user_id:
        # Add creator as owner so list_projects_for_user picks this project up
        add_project_member(db, project.id, user_id, role="owner")
    return project


def project_to_out(project: Project, doc_count: int = 0, code_count: int = 0) -> ProjectOut:
    """Map a Project ORM object to the response schema.

    Counts are passed in separately because they come from a batched query in the
    router — we don't want to trigger N+1 queries here.
    """
    return ProjectOut(
        id=project.id,
        name=project.name,
        document_count=doc_count,
        code_count=code_count,
        created_at=project.created_at,
    )


def get_merged_thresholds(project: Project) -> dict[str, float | int]:
    """Return the effective threshold values for a project.

    Resolution order (highest wins):
      1. Per-project overrides stored in thresholds_json
      2. Global defaults from core/config.py (Settings)
      3. Hardcoded defaults in THRESHOLD_DEFINITIONS

    This means a researcher can tune thresholds without touching the server config,
    and their changes are scoped to just their project.
    """
    # Pull global config values as the baseline; fall back to the constant default
    # if the Settings object doesn't have that attribute yet
    defaults = {td["key"]: getattr(global_settings, td["key"], td["default"]) for td in THRESHOLD_DEFINITIONS}
    overrides = project.thresholds_json or {}
    # Only apply overrides for known keys so stale/unknown data doesn't sneak through
    return {**defaults, **{k: v for k, v in overrides.items() if k in defaults}}


def build_settings_out(project: Project) -> ProjectSettingsOut:
    """Assemble the full settings response for a project.

    Includes both the current state and the static catalogue so the frontend can
    render the settings modal without a separate API call.
    """
    return ProjectSettingsOut(
        # Default to self_consistency if no perspectives have been saved yet
        enabled_perspectives=project.enabled_perspectives or ["self_consistency"],
        available_perspectives=AVAILABLE_PERSPECTIVES,
        thresholds=get_merged_thresholds(project),
    )


def cleanup_project_vectors(db: Session, project_id: str, user_id: str) -> None:
    """Remove ChromaDB embeddings for all segments in a project before SQL deletion.

    We delete from the vector store first because after the SQL cascade runs there's
    no easy way to find which segment IDs need cleaning up. A warning is logged
    rather than raising an exception — a failed vector cleanup shouldn't block the
    project from being deleted.

    Args:
        db: Active DB session (used to fetch segment IDs before deletion).
        project_id: Project being deleted.
        user_id: Used to scope the ChromaDB collection to the right user.
    """
    seg_ids = get_segment_ids_for_project(db, project_id)
    if not seg_ids:
        return
    try:
        # Deferred import to avoid circular dependency at module load time
        from infrastructure.vector_store.store import get_collection
        get_collection(user_id).delete(ids=seg_ids)
    except Exception as e:
        logger.warning("Vector store cleanup failed during project delete", extra={"error": str(e)})
