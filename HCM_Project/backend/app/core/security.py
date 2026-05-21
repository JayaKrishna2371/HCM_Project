"""Security helpers — JWT issuance/verification + secure HTTP headers.

Unlike the previous Azure AD design (where Entra issued and signed tokens), the
backend now owns its session tokens. After Active Directory verifies a user's
password over LDAP (see ``app.core.ldap_auth``), we mint a short-lived JWT,
signed with ``JWT_SECRET_KEY`` (HS256 by default). The SPA stores it and sends
it as ``Authorization: Bearer <token>`` on every API call.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


class TokenError(Exception):
    """Raised when a session JWT cannot be validated."""


def create_access_token(
    subject: str,
    *,
    roles: Optional[List[str]] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """Sign a session JWT for an authenticated user.

    ``subject`` is the stable directory id (objectGUID) and lands in ``sub``.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "roles": roles or [],
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": now,
        "nbf": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Validate signature, issuer, audience and expiry. Returns the claims."""
    if not token or token.count(".") != 2:
        raise TokenError("Malformed token")
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
            options={"leeway": settings.JWT_LEEWAY_SECONDS},
        )
    except ExpiredSignatureError as e:
        raise TokenError("Token has expired") from e
    except JWTClaimsError as e:
        raise TokenError(f"Invalid token claims: {e}") from e
    except JWTError as e:
        raise TokenError(f"Token signature validation failed: {e}") from e


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    """Adds defensive HTTP security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=()",
        )
        return response
