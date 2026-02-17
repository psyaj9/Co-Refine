from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_title: str = "The Inductive Lens"
    openrouter_api_key: str = ""

    fast_model: str = "meta-llama/llama-4-maverick:free"
    reasoning_model: str = "qwen/qwen3-235b-a22b:free"
    embedding_model: str = "local"

    min_segments_for_consistency: int = 3
    auto_analysis_threshold: int = 3
    vector_search_top_k: int = 8
    consistency_escalation_threshold: float = 0.7

    database_url: str = "sqlite:///./inductive_lens.db"
    chroma_persist_dir: str = "./chroma_data"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
