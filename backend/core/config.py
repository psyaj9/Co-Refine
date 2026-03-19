"""
Application settings loaded from .env file.

Pydantic BaseSettings handles the .env parsing so the rest of the app can just import `settings` and trust the values are valid.
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
import secrets
import warnings


class Settings(BaseSettings):
    # Central config object. One instance created at module load time.

    app_title: str = "Co-Refine"

    jwt_secret: str = ""

    @field_validator("jwt_secret", mode="before")
    @classmethod
    def _ensure_jwt_secret(cls, v: str) -> str:
        # Generate a random secret if none is configured.
        if not v or not v.strip():
            generated = secrets.token_hex(32)
            warnings.warn(
                "JWT_SECRET is not set in environment — a temporary secret was generated. "
                "All sessions will be invalidated on restart. Set JWT_SECRET in .env.",
                stacklevel=2,
            )
            return generated
        return v

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Azure OpenAI credentials
    azure_api_key: str = ""
    azure_endpoint: str = ""
    azure_api_version: str = ""

    # Deployment names in Azure OpenAI Studio
    azure_deployment_fast: str = ""
    azure_deployment_reasoning: str = ""
    azure_embedding_model: str = ""

    # Logical model names used internally
    fast_model: str = "gpt-5-mini"
    reasoning_model: str = "gpt-5.2"
    embedding_model: str = "text-embedding-3-small"

    # Audit pipeline threshold defaults, projects can override these values
    min_segments_for_consistency: int = 3
    auto_analysis_threshold: int = 3
    vector_search_top_k: int = 8

    # Warning thresholds for deterministic scoring
    drift_warning_threshold: float = 0.3
    code_overlap_warning_threshold: float = 0.85

    # SQLite file and ChromaDB persistent directory
    database_url: str = "sqlite:///./inductive_lens.db"
    chroma_persist_dir: str = "./chroma_data"

    # CORS allowed origins
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = ConfigDict(
        env_file=(".env"),
        env_file_encoding="utf-8",
        extra="allow",
    )


# Module-level singleton, this is imported everywhere instead of instantiating Settings directly
settings = Settings()


def get_threshold(key: str, project_thresholds: dict | None = None) -> float | int:
    """Return a threshold value, checking project-level overrides first.

    Projects can store custom threshold values in `thresholds_json`. This function
    checks there first so researchers can tune sensitivity without touching app config.

    Args:
        key: The threshold name, e.g. "drift_warning_threshold".
        project_thresholds: Optional dict of project-level overrides.

    Returns:
        The project-level value if present, otherwise the global settings value.
    """
    if project_thresholds and key in project_thresholds:
        return project_thresholds[key]
    return getattr(settings, key)
