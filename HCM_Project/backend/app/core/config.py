"""Application configuration via pydantic-settings.

All values come from environment variables / .env file. Never commit secrets.

Authentication model
---------------------
Identity is verified against Microsoft Active Directory over LDAP. The backend
performs an LDAP *bind* with the user's credentials to verify them, reads the
user's directory attributes + group membership, then issues its OWN signed JWT
that the SPA carries as a bearer token on subsequent calls.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated, Dict, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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
    BACKEND_CORS_ORIGINS: Annotated[List[str], NoDecode] = Field(default_factory=list)

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ============================================================
    #  LDAP / Active Directory
    # ============================================================
    # Comma-separated list of LDAP URIs. Use ldaps:// (port 636) for TLS, or
    # ldap:// (389) + LDAP_START_TLS=true. Multiple = failover order.
    #   e.g. ldaps://dc1.corp.example.com:636,ldaps://dc2.corp.example.com:636
    LDAP_SERVER_URIS: Annotated[List[str], NoDecode] = Field(default_factory=list)

    @field_validator("LDAP_SERVER_URIS", mode="before")
    @classmethod
    def _split_uris(cls, v):
        if isinstance(v, str):
            return [u.strip() for u in v.split(",") if u.strip()]
        return v

    # Negotiate StartTLS on a plain ldap:// connection (ignored for ldaps://).
    LDAP_START_TLS: bool = False
    # Verify the server certificate (set false ONLY in a throwaway lab).
    LDAP_TLS_VALIDATE: bool = True
    # Optional path to a CA bundle (PEM) used to validate the DC certificate.
    LDAP_CA_CERTS_FILE: str | None = None

    # Socket connect timeout (seconds) for binds/searches.
    LDAP_CONNECT_TIMEOUT: int = 8

    # ----- Service ("bind") account used to look users up -----
    # Recommended (search-then-bind). Leave BIND_DN empty to use direct-bind
    # mode instead (the app binds straight as the end user — see README).
    LDAP_BIND_DN: str | None = None          # e.g. CN=svc-hcm,OU=Service,DC=corp,DC=example,DC=com
    LDAP_BIND_PASSWORD: str | None = None

    # Where to search for users and the filter to find one.
    # {username} is replaced (after escaping) with the value the user typed.
    LDAP_USER_SEARCH_BASE: str = ""          # e.g. OU=Users,DC=corp,DC=example,DC=com
    LDAP_USER_SEARCH_FILTER: str = "(sAMAccountName={username})"

    # ----- Direct-bind mode (only used when LDAP_BIND_DN is empty) -----
    # No default domain by design: the user types their full UPN (user@domain)
    # or DOMAIN\user, and the app binds with exactly that. Nothing is assumed.

    # ----- Attribute names on the directory entry -----
    LDAP_ATTR_GUID: str = "objectGUID"
    LDAP_ATTR_USERNAME: str = "sAMAccountName"
    LDAP_ATTR_UPN: str = "userPrincipalName"
    LDAP_ATTR_EMAIL: str = "mail"
    LDAP_ATTR_DISPLAY_NAME: str = "displayName"
    LDAP_ATTR_GIVEN_NAME: str = "givenName"
    LDAP_ATTR_SURNAME: str = "sn"
    LDAP_ATTR_MEMBER_OF: str = "memberOf"

    # ----- Group -> application-role mapping -----
    # JSON object mapping an AD group (by CN or full DN, case-insensitive) to an
    # app role. Example:
    #   {"HCM-Admins":"Admin","HCM-Operators":"Operator","HCM-Viewers":"Viewer"}
    LDAP_ROLE_MAPPINGS: Dict[str, str] = Field(default_factory=dict)
    # Role granted when none of the user's groups match a mapping above.
    LDAP_DEFAULT_ROLE: str = "Viewer"

    @field_validator("LDAP_ROLE_MAPPINGS", mode="before")
    @classmethod
    def _parse_role_map(cls, v):
        if v in (None, ""):
            return {}
        if isinstance(v, str):
            return json.loads(v)
        return v

    # ============================================================
    #  JWT — tokens this API issues after a successful LDAP bind
    # ============================================================
    # MUST be a long random string. Generate with:  openssl rand -hex 32
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "hcm-platform-api"
    JWT_AUDIENCE: str = "hcm-platform"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_LEEWAY_SECONDS: int = 30

    # ----- Database -----
    DATABASE_URL: str


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
