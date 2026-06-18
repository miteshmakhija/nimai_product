# app/core/config.py
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

def _presets() -> dict:
    # Model IDs overridable per preset via env vars, e.g.:
    #   LOCAL_MODEL=qwen2.5:32b
    #   GEMINI_MODEL=gemini-2.0-flash
    #   BEDROCK_MODEL=us.deepseek.r1-v1:0
    #   BEDROCK_HAIKU_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
    #   BEDROCK_QWEN_MODEL=qwen/qwen3-32b:0
    local_m   = os.getenv("LOCAL_MODEL",        "qwen2.5:14b")
    openai_m  = os.getenv("OPENAI_MODEL",        "gpt-4o-mini")
    gemini_m  = os.getenv("GEMINI_MODEL",        "gemini-2.5-flash")
    bdr_m     = os.getenv("BEDROCK_MODEL",       "us.deepseek.r1-v1:0")
    haiku_m   = os.getenv("BEDROCK_HAIKU_MODEL", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
    qwen_m    = os.getenv("BEDROCK_QWEN_MODEL",  "qwen/qwen3-32b:0")
    return {
        "local":         {"provider": "ollama",   "extractor_model": local_m,  "generator_model": local_m},
        "openai":        {"provider": "openai",   "extractor_model": openai_m, "generator_model": openai_m},
        "gemini":        {"provider": "gemini",   "extractor_model": gemini_m, "generator_model": gemini_m},
        "bedrock":       {"provider": "bedrock",  "extractor_model": bdr_m,    "generator_model": bdr_m},
        "bedrock-haiku": {"provider": "bedrock",  "extractor_model": haiku_m,  "generator_model": haiku_m},
        "bedrock-qwen":  {"provider": "bedrock",  "extractor_model": qwen_m,   "generator_model": qwen_m},
    }


class Settings(BaseSettings):
    # Single switch — set LLM_PRESET to override all provider/model settings.
    # Leave blank to use the individual *_PROVIDER / *_MODEL vars below.
    llm_preset: str = ""

    # Provider per function: "openai", "bedrock", or "ollama"
    extractor_provider: str = "openai"
    generator_provider: str = "openai"
    planner_provider: str = "openai"

    # Model per function (uses provider's model naming)
    extractor_model: str = "gpt-4o-mini"
    generator_model: str = "gpt-4o-mini"
    planner_model: str = "gpt-4o-mini"

    # OpenAI
    openai_api_key: str = ""
    openai_base_url: str = ""
    openai_timeout: int = 300

    # Gemini (OpenAI-compatible endpoint)
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    gemini_timeout: int = 120

    # AWS Bedrock
    bedrock_region: str = "us-east-1"
    aws_region: str = ""       # alias for AWS_REGION in .env — maps to bedrock_region if set
    bedrock_model_id: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    aws_profile: str = ""  # boto3 named profile (e.g. SSO profile); empty = use default chain

    @property
    def effective_bedrock_region(self) -> str:
        return self.aws_region or self.bedrock_region

    # Ollama (fallback)
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout: int = 300

    # Database
    database_url: str = "postgresql://user:pass@localhost:5432/quotes"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Application Settings
    completeness_threshold: float = 0.8
    session_timeout_hours: int = 24

    # Paths
    data_dir: str = "data"
    uploads_dir: str = "data/uploads"
    templates_dir: str = "data/templates"
    vector_store_dir: str = "data/vector_store"
    samples_dir: str = "data/samples/quotation"

    # Auth / JWT
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7

    # CORS (frontend origins, comma-separated)
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # Seed super admin
    seed_admin_email: str = "admin@nimai.ai"
    seed_admin_password: str = "password!123"

    @property
    def cors_origin_list(self) -> list:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def resolved_provider(function: str) -> tuple[str, str]:
    """Return (provider, model) for a given function, applying LLM_PRESET if set."""
    s = get_settings()
    preset = _presets().get(s.llm_preset.lower()) if s.llm_preset else None
    if preset:
        return preset["provider"], preset.get(f"{function}_model", preset["extractor_model"])
    provider = getattr(s, f"{function}_provider", s.extractor_provider)
    model = getattr(s, f"{function}_model", s.extractor_model)
    return provider, model
