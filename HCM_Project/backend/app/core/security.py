"""Security helpers — secure HTTP headers + small utility functions.

We intentionally do NOT issue our own JWTs here. Authentication is delegated
entirely to Azure AD (Entra ID); the backend only validates Entra-issued
access tokens. This avoids token-issuer sprawl and keeps the trust boundary
inside Microsoft Identity Platform.
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


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
