"""Authentication endpoints.

Unlike the previous Azure AD design, this API now owns the login flow:
  * POST /auth/login     — verify username/password against AD over LDAP and,
                           on success, issue a signed session JWT.
  * POST /auth/logout    — stateless acknowledgement (the SPA discards the token).
  * GET  /auth/introspect — debug helper: decode + validate the caller's JWT.
  * GET  /auth/me/roles   — quick role-only check (used by the Angular role guard).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.ldap_auth import LDAPAuthError, LDAPConfigError, authenticate
from app.core.security import TokenError, create_access_token, decode_access_token
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenIntrospectionResponse, TokenResponse
from app.schemas.user import UserRead
from app.services import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=True)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate against Active Directory (LDAP) and receive a session token",
)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        profile = authenticate(body.username, body.password)
    except LDAPConfigError as e:
        # Misconfiguration is an operator problem, not a credential problem.
        logger.error("LDAP configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured correctly. Contact your administrator.",
        ) from e
    except LDAPAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    user = user_service.upsert_from_ldap(db, profile)

    token = create_access_token(
        subject=user.directory_id,
        roles=user.roles or [],
        extra_claims={
            "name": user.name,
            "email": user.email,
            "username": user.username,
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Log out (client discards token)")
def logout(_: User = Depends(get_current_user)) -> None:
    # Tokens are stateless; the SPA clears its stored token. This endpoint exists
    # for symmetry and so a future token-denylist can hook in here.
    return None


@router.get(
    "/introspect",
    response_model=TokenIntrospectionResponse,
    summary="Decode and validate the caller's session token (debug helper)",
)
def introspect(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> TokenIntrospectionResponse:
    try:
        claims = decode_access_token(creds.credentials)
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e

    roles = claims.get("roles") or []
    return TokenIntrospectionResponse(
        valid=True,
        subject=claims.get("sub"),
        audience=claims.get("aud"),
        issuer=claims.get("iss"),
        expires_at=claims.get("exp"),
        roles=roles if isinstance(roles, list) else [roles],
        claims=claims,
    )


@router.get("/me/roles", summary="Roles for the currently authenticated user")
def my_roles(user: User = Depends(get_current_user)) -> dict:
    return {"roles": user.roles or []}
