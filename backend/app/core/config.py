from __future__ import annotations

import os
from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "lumen-lens"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = True

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "sqlite+aiosqlite:///./lumen_lens.db"

    # CORS
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

    # Auth / Keycloak (OIDC)
    oidc_enabled: bool = True
    oidc_issuer_url: str = "http://localhost:8080/realms/lumen-lens"
    oidc_client_id: str = "lumen-lens-backend"
    oidc_client_secret: str = ""
    oidc_audience: str = "lumen-lens-api"
    oidc_jwks_url: Optional[str] = None

    # LLM Providers
    llm_provider: str = "openai-compatible"  # openai-compatible, anthropic, gemini, ollama
    llm_model: str = "gpt-4o-mini"
    llm_base_url: Optional[str] = None
    llm_api_key: str = ""
    llm_timeout_seconds: int = 30

    # Demo mode (local only, refuses in production)
    demo_mode: bool = False

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def effective_oidc_jwks_url(self) -> str:
        if self.oidc_jwks_url:
            return self.oidc_jwks_url
        return f"{self.oidc_issuer_url.rstrip('/')}/protocol/openid-connect/certs"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()