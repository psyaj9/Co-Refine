from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field


class Settings(BaseSettings):
    app_title: str = "Co-Refine"

    azure_api_key = AZURE_API_KEY
    azure_endpoint= AZURE_ENDPOINT
    azure_api_version= AZURE_API_VERSION

    # Azure deployment names (used in API calls — must match deployment names in Azure portal)
    azure_deployment_fast = AZURE_DEPLOYMENT_FAST
    azure_deployment_reasoning= AZURE_DEPLOYMENT_REASONING

    # Display names (used in /api/settings response)
    fast_model = "gpt-5-mini"
    reasoning_model = "gpt-5.2"
    embedding_model = "local"

    min_segments_for_consistency = 3
    auto_analysis_threshold = 3
    vector_search_top_k = 8
    consistency_escalation_threshold = 0.7

    database_url = "sqlite:///./inductive_lens.db"
    chroma_persist_dir = "./chroma_data"

    model_config = ConfigDict(
        env_file=(".env"),
        env_file_encoding="utf-8",
        extra="allow",
    )


settings = Settings()
