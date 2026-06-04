"""Tenant-aware FastAPI dependencies.

* ``get_tenant_context`` builds the per-request :class:`TenantContext` from the
  authenticated user + the optional ``X-Tenant-Id`` header (SUPER_ADMIN switch).
  The DB is the source of truth for roles→permissions, not the JWT, so a revoked
  permission takes effect immediately.
* ``require_permissions(*codes)`` gates a route on one or more permissions.
* ``require_admin`` gates the whole Administration surface (SUPER_ADMIN or
  TENANT_ADMIN).
"""
from __future__ import annotations

import uuid
from typing import Callable, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.rbac import rbac
from app.core.config import settings
from app.auth.admin.tenant_context import (
    CrossTenantError,
    TenantContext,
    resolve_effective_tenant,
)
from app.db.session.session import get_db
from app.auth.login.deps import get_current_user
from app.models.users.user_model import User
from app.services.roles import rbac_service


def _parse_tenant_header(request: Request) -> Optional[uuid.UUID]:
    raw = request.headers.get(settings.TENANT_HEADER)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {settings.TENANT_HEADER} header",
        )


def get_tenant_context(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantContext:
    roles = user.roles or []
    is_super = rbac.is_super_admin(roles)
    permissions = rbac_service.permissions_for_role_codes(db, roles, tenant_id=user.tenant_id)

    requested = _parse_tenant_header(request)
    try:
        effective = resolve_effective_tenant(
            is_super_admin=is_super,
            home_tenant_id=user.tenant_id,
            requested_tenant_id=requested,
        )
    except CrossTenantError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e

    # Switching into a tenant requires the explicit permission.
    if is_super and requested is not None and not rbac.has_permission(permissions, "tenant:switch"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing permission to switch tenant context",
        )

    return TenantContext(
        user_id=user.id,
        username=user.username,
        is_super_admin=is_super,
        tenant_id=effective,
        home_tenant_id=user.tenant_id,
        roles=roles,
        permissions=permissions,
    )


def require_permissions(*required: str) -> Callable[[TenantContext], TenantContext]:
    """Dependency factory enforcing that the caller holds ALL given permissions."""

    def _checker(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        missing = [code for code in required if not ctx.has_permission(code)]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission(s): {missing}",
            )
        return ctx

    return _checker


def require_admin(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
    """Gate the Administration surface: SUPER_ADMIN or TENANT_ADMIN only."""
    allowed = {rbac.SUPER_ADMIN, rbac.TENANT_ADMIN}
    if not any(r.upper() in allowed for r in ctx.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administration access requires SUPER_ADMIN or TENANT_ADMIN",
        )
    return ctx
