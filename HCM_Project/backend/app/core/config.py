"""Application configuration via pydantic-settings.

All values come from environment variables / .env file. Never commit secrets.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ----- App -----
    APP_NAME: str = "HCM Platform API"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"

    # ----- CORS -----
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] | List[str] = Field(default_factory=list)

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ----- Azure AD -----
    AZURE_TENANT_ID: str
    AZURE_CLIENT_ID: str
    AZURE_API_AUDIENCE: str
    AZURE_JWT_ALGORITHMS: List[str] = Field(default_factory=lambda: ["RS256"])

    @field_validator("AZURE_JWT_ALGORITHMS", mode="before")
    @classmethod
    def _split_algs(cls, v):
        if isinstance(v, str):
            return [a.strip() for a in v.split(",") if a.strip()]
        return v

    # ----- Database -----
    DATABASE_URL: str

    # ----- JWT -----
    JWT_LEEWAY_SECONDS: int = 30

    # ----- Derived -----
    @property
    def AZURE_AUTHORITY(self) -> str:
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}"

    @property
    def AZURE_ISSUER_V2(self) -> str:
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}/v2.0"

    @property
    def AZURE_ISSUER_V1(self) -> str:
        # v1.0 tokens (sts.windows.net) — accepted as fallback
        return f"https://sts.windows.net/{self.AZURE_TENANT_ID}/"

    @property
    def AZURE_OPENID_CONFIG_URL(self) -> str:
        return f"{self.AZURE_AUTHORITY}/v2.0/.well-known/openid-configuration"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
