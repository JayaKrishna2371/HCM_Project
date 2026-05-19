"""Azure AD (Entra ID) token validation.

Validates RS256 access tokens issued by Microsoft Entra ID by:
  1. Fetching the tenant's OpenID configuration to discover JWKS URI + issuers.
  2. Fetching and caching JWKS (public keys) — refreshed on `kid` cache-miss.
  3. Verifying signature, issuer, audience, and expiry using python-jose.
  4. Extracting standard + custom claims (roles, oid, email, name).

No secrets used — public key validation only.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError

from app.core.config import settings

logger = logging.getLogger(__name__)

_JWKS_CACHE_TTL_SECONDS = 3600  # 1 hour


class AzureADValidationError(Exception):
    """Raised when an Azure AD access token fails validation."""


@dataclass
class _JwksCache:
    keys_by_kid: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    jwks_uri: Optional[str] = None
    issuers: List[str] = field(default_factory=list)
    fetched_at: float = 0.0
    lock: threading.Lock = field(default_factory=threading.Lock)


_cache = _JwksCache()


def _is_cache_fresh() -> bool:
    return (
        _cache.jwks_uri is not None
        and (time.time() - _cache.fetched_at) < _JWKS_CACHE_TTL_SECONDS
        and bool(_cache.keys_by_kid)
    )


def _refresh_jwks(force: bool = False) -> None:
    """(Re)load OpenID config + JWKS from Entra ID. Thread-safe."""
    with _cache.lock:
        if not force and _is_cache_fresh():
            return

        logger.info("Refreshing Azure AD OpenID config + JWKS")
        with httpx.Client(timeout=10.0) as client:
            oidc_resp = client.get(settings.AZURE_OPENID_CONFIG_URL)
            oidc_resp.raise_for_status()
            oidc = oidc_resp.json()

            jwks_uri = oidc["jwks_uri"]
            jwks_resp = client.get(jwks_uri)
            jwks_resp.raise_for_status()
            jwks = jwks_resp.json()

        # Accept both v2.0 issuer and v1.0 sts issuer for robustness
        issuers = [
            settings.AZURE_ISSUER_V2,
            settings.AZURE_ISSUER_V1,
            oidc.get("issuer", settings.AZURE_ISSUER_V2),
        ]
        _cache.jwks_uri = jwks_uri
        _cache.issuers = list({i for i in issuers if i})
        _cache.keys_by_kid = {k["kid"]: k for k in jwks.get("keys", []) if "kid" in k}
        _cache.fetched_at = time.time()
        logger.info("Loaded %d signing keys", len(_cache.keys_by_kid))


def _get_signing_key(kid: str) -> Dict[str, Any]:
    if kid not in _cache.keys_by_kid:
        # Possible key rotation — force one refresh
        _refresh_jwks(force=True)
    key = _cache.keys_by_kid.get(kid)
    if key is None:
        raise AzureADValidationError(f"Signing key '{kid}' not found in JWKS")
    return key


def validate_access_token(token: str) -> Dict[str, Any]:
    """Validate an Azure AD access token. Returns the decoded claims.

    Raises AzureADValidationError on any failure.
    """
    if not token or token.count(".") != 2:
        raise AzureADValidationError("Malformed token")

    _refresh_jwks(force=False)

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise AzureADValidationError(f"Cannot read token header: {e}") from e

    kid = unverified_header.get("kid")
    if not kid:
        raise AzureADValidationError("Token header missing 'kid'")

    signing_key = _get_signing_key(kid)

    # The access token's `aud` claim is the API audience (api://<client-id>).
    # If your scenario uses ID tokens instead, audience would be the client_id.
    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=settings.AZURE_JWT_ALGORITHMS,
            audience=settings.AZURE_API_AUDIENCE,
            issuer=_cache.issuers,
            options={
                "verify_at_hash": False,
                "leeway": settings.JWT_LEEWAY_SECONDS,
            },
        )
    except ExpiredSignatureError as e:
        raise AzureADValidationError("Token has expired") from e
    except JWTClaimsError as e:
        raise AzureADValidationError(f"Invalid token claims: {e}") from e
    except JWTError as e:
        raise AzureADValidationError(f"Token signature validation failed: {e}") from e

    return claims


def extract_roles(claims: Dict[str, Any]) -> List[str]:
    """Pull RBAC roles out of the claims.

    Azure AD app-role assignments arrive in the `roles` claim (list of strings).
    Group claims would arrive under `groups` (GUIDs). If neither is present we
    default to ['Viewer'] so the user can still load the dashboard.
    """
    roles = claims.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    if not roles:
        roles = ["Viewer"]
    return roles


def extract_user_profile(claims: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize Entra claims into a flat user profile dict."""
    return {
        "azure_oid": claims.get("oid") or claims.get("sub"),
        "tenant_id": claims.get("tid"),
        "email": (
            claims.get("email")
            or claims.get("preferred_username")
            or claims.get("upn")
        ),
        "name": claims.get("name"),
        "given_name": claims.get("given_name"),
        "family_name": claims.get("family_name"),
        "roles": extract_roles(claims),
    }
