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

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import rbac
from app.core.config import settings
from app.auth.ldap_auth import LDAPAuthError, LDAPConfigError, authenticate
from app.auth.security import TokenError, create_access_token, decode_access_token
from app.db.session import get_db
from app.auth.deps import get_current_user
from app.models.tenant import TenantStatus
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenIntrospectionResponse, TokenResponse
from app.schemas.user import UserRead
from app.services import audit_service, rbac_service, tenant_service, user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=True)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate against Active Directory (LDAP) and receive a session token",
)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    # NOTE: per-tenant "Own LDAP" routing is Phase 3 — Phase 1 authenticates every
    # tenant against the platform LDAP config. The tenant.login_type is stored and
    # surfaced for that future work.
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
        audit_service.record(
            db, action="auth.login", status="FAILURE",
            actor_username=body.username, detail={"reason": str(e)}, request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # AD verified the password. Authorization comes from the DB (RBAC).
    user = user_service.resolve_login_user(db, profile)
    if user is None:
        audit_service.record(
            db, action="auth.login", status="DENIED",
            actor_username=body.username, detail={"reason": "not provisioned"}, request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not provisioned for this platform. Contact your administrator.",
        )

    if not user_service.is_active(user):
        audit_service.record(
            db, action="auth.login", status="DENIED", tenant_id=user.tenant_id,
            actor_user_id=user.id, actor_username=user.username,
            detail={"reason": "user disabled"}, request=request,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is disabled.")

    # Reject login into a suspended/inactive tenant (super admins have no tenant).
    if user.tenant_id is not None:
        tenant = tenant_service.get_tenant(db, user.tenant_id)
        if tenant is not None and tenant.status != TenantStatus.ACTIVE:
            audit_service.record(
                db, action="auth.login", status="DENIED", tenant_id=user.tenant_id,
                actor_user_id=user.id, actor_username=user.username,
                detail={"reason": f"tenant {tenant.status.value}"}, request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your organization is not active. Contact your administrator.",
            )

    permissions = rbac_service.permissions_for_role_codes(db, user.roles or [], tenant_id=user.tenant_id)
    primary_role = (user.roles or [None])[0]

    token = create_access_token(
        subject=user.directory_id,
        roles=user.roles or [],
        extra_claims={
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "role": primary_role,
            "permissions": permissions,
            "name": user.name,
            "email": user.email,
            "username": user.username,
        },
    )

    audit_service.record(
        db, action="auth.login", status="SUCCESS", tenant_id=user.tenant_id,
        actor_user_id=user.id, actor_username=user.username,
        detail={"role": primary_role, "super_admin": rbac.is_super_admin(user.roles)},
        request=request,
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
