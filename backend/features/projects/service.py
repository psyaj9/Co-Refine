"""Project service: business logic for settings and count aggregation."""
from sqlalchemy.orm import Session

from core.models import Project
from core.config import settings as global_settings
from features.projects.constants import AVAILABLE_PERSPECTIVES, THRESHOLD_DEFINITIONS
from features.projects.schemas import ProjectOut, ProjectSettingsOut
from features.projects.repository import batch_project_counts


def project_to_out(project: Project, doc_count: int = 0, code_count: int = 0) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        document_count=doc_count,
        code_count=code_count,
        created_at=project.created_at,
    )


def get_merged_thresholds(project: Project) -> dict[str, float | int]:
    """Merge project overrides on top of global defaults."""
    defaults = {td["key"]: getattr(global_settings, td["key"], td["default"]) for td in THRESHOLD_DEFINITIONS}
    overrides = project.thresholds_json or {}
    return {**defaults, **{k: v for k, v in overrides.items() if k in defaults}}


def build_settings_out(project: Project) -> ProjectSettingsOut:
    return ProjectSettingsOut(
        enabled_perspectives=project.enabled_perspectives or ["self_consistency"],
        available_perspectives=AVAILABLE_PERSPECTIVES,
        thresholds=get_merged_thresholds(project),
    )
