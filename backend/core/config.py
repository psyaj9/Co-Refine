from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    app_title: str = "Co-Refine"

    azure_api_key: str = ""
    azure_endpoint: str = ""
    azure_api_version: str = ""

    azure_deployment_fast: str = ""
    azure_deployment_reasoning: str = ""
    azure_embedding_model: str = ""
    fast_model: str = "gpt-5-mini"
    reasoning_model: str = "gpt-5.2"

    min_segments_for_consistency: int = 3
    auto_analysis_threshold: int = 3
    vector_search_top_k: int = 8

    drift_warning_threshold: float = 0.3
    code_overlap_warning_threshold: float = 0.85

    database_url: str = "sqlite:///./inductive_lens.db"
    chroma_persist_dir: str = "./chroma_data"

    model_config = ConfigDict(
        env_file=(".env"),
        env_file_encoding="utf-8",
        extra="allow",
    )


settings = Settings()


def get_threshold(key: str, project_thresholds: dict | None = None) -> float | int:
    if project_thresholds and key in project_thresholds:
        return project_thresholds[key]
    return getattr(settings, key)
