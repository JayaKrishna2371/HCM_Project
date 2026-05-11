"""Authentication-related endpoints.

These do NOT issue tokens — Entra ID does that. They expose:
  * /auth/introspect — debug helper: decode + validate the caller's access token.
  * /auth/me/roles   — quick role-only check (used by the Angular role guard).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.azure_ad import (
    AzureADValidationError,
    extract_roles,
    validate_access_token,
)
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import TokenIntrospectionResponse

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=True)


@router.get(
    "/introspect",
    response_model=TokenIntrospectionResponse,
    summary="Decode and validate the caller's access token (debug helper)",
)
def introspect(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> TokenIntrospectionResponse:
    try:
        claims = validate_access_token(creds.credentials)
    except AzureADValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e

    return TokenIntrospectionResponse(
        valid=True,
        subject=claims.get("sub"),
        audience=claims.get("aud"),
        issuer=claims.get("iss"),
        expires_at=claims.get("exp"),
        roles=extract_roles(claims),
        claims=claims,
    )


@router.get("/me/roles", summary="Roles for the currently authenticated user")
def my_roles(user: User = Depends(get_current_user)) -> dict:
    return {"roles": user.roles or []}
