from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    app_title: str = "Co-Refine"
    gemini_api_key: str = ""
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta/openai/"

    fast_model: str = "gemini-2.5-flash-lite"
    reasoning_model: str = "gemini-2.5-flash"
    embedding_model: str = "local"

    min_segments_for_consistency: int = 3
    auto_analysis_threshold: int = 3
    vector_search_top_k: int = 8
    consistency_escalation_threshold: float = 0.7

    database_url: str = "sqlite:///./inductive_lens.db"
    chroma_persist_dir: str = "./chroma_data"

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )


settings = Settings()
