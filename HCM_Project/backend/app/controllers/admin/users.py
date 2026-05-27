"""User management — TENANT_ADMIN manages their own users; SUPER_ADMIN any."""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth import rbac
from app.auth.tenant_context import TenantContext
from app.db.session import get_db
from app.auth.tenant_deps import require_permissions
from app.models.user import User
from app.schemas.admin import AdminUserCreate, AdminUserRead, AdminUserUpdate
from app.services import audit_service, rbac_service, user_service

router = APIRouter(prefix="/users", tags=["admin: users"])


def _valid_role_codes(db: Session, tenant_id: Optional[uuid.UUID]) -> set[str]:
    return {r.code for r in rbac_service.list_roles(db, tenant_id, include_system=True)}


def _guard_role_assignment(ctx: TenantContext, requested: List[str], db: Session,
                           tenant_id: Optional[uuid.UUID]) -> None:
    """Reject unknown roles and privilege escalation."""
    valid = _valid_role_codes(db, tenant_id)
    unknown = [r for r in requested if r not in valid]
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown role(s): {unknown}")
    # Only a SUPER_ADMIN may grant the SUPER_ADMIN role.
    if any(r.upper() == rbac.SUPER_ADMIN for r in requested) and not ctx.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign SUPER_ADMIN")


def _scoped_user_or_404(db: Session, user_id: int, ctx: TenantContext) -> User:
    user = user_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Tenant users may only touch users in their own tenant.
    if not ctx.is_super_admin and user.tenant_id != ctx.home_tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("", response_model=List[AdminUserRead], summary="List users in the tenant")
def list_users(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("user:read")),
) -> List[AdminUserRead]:
    users = user_service.list_users(db, ctx.tenant_id, ctx.is_super_admin)
    return [AdminUserRead.model_validate(u) for u in users]


@router.post(
    "",
    response_model=AdminUserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user (tenant_id is bound from context, never trusted from body)",
)
def create_user(
    body: AdminUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("user:create")),
) -> AdminUserRead:
    creating_super = any(r.upper() == rbac.SUPER_ADMIN for r in body.roles)

    # Resolve the target tenant.
    if creating_super:
        if not ctx.is_super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create a SUPER_ADMIN")
        # Super admins belong to the master (HCAP) tenant.
        from app.services import tenant_service
        target_tenant: Optional[uuid.UUID] = tenant_service.get_or_create_default_tenant(db).id
    elif ctx.is_super_admin:
        # Super admin must say which tenant (header context or explicit body field).
        target_tenant = ctx.tenant_id or body.tenant_id
        if target_tenant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a tenant (X-Tenant-Id header) or provide tenant_id",
            )
    else:
        # Tenant admin: hard-bind to their own tenant; body.tenant_id is ignored.
        target_tenant = ctx.require_tenant()

    _guard_role_assignment(ctx, body.roles, db, target_tenant)

    try:
        user = user_service.create_user(
            db,
            tenant_id=target_tenant,
            username=body.username,
            email=body.email,
            name=body.name,
            directory_id=body.directory_id,
            roles=body.roles,
            status=body.status,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e

    audit_service.record(
        db, action="user.create", tenant_id=target_tenant,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="user", resource_id=user.id,
        detail={"username": user.username, "roles": user.roles}, request=request,
    )
    return AdminUserRead.model_validate(user)


@router.get("/{user_id}", response_model=AdminUserRead, summary="Get a user")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("user:read")),
) -> AdminUserRead:
    return AdminUserRead.model_validate(_scoped_user_or_404(db, user_id, ctx))


@router.patch("/{user_id}", response_model=AdminUserRead, summary="Update a user's roles/status")
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("user:update")),
) -> AdminUserRead:
    user = _scoped_user_or_404(db, user_id, ctx)
    if body.roles is not None:
        _guard_role_assignment(ctx, body.roles, db, user.tenant_id)

    user = user_service.update_user(db, user, **body.model_dump(exclude_unset=True))
    audit_service.record(
        db, action="user.update", tenant_id=user.tenant_id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="user", resource_id=user.id,
        detail=body.model_dump(exclude_unset=True), request=request,
    )
    return AdminUserRead.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a user")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("user:delete")),
) -> None:
    user = _scoped_user_or_404(db, user_id, ctx)
    if user.id == ctx.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")
    # Only a super admin may delete another super admin.
    if rbac.is_super_admin(user.roles or []) and not ctx.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete a SUPER_ADMIN")
    tenant_id = user.tenant_id
    username = user.username
    user_service.delete_user(db, user)
    audit_service.record(
        db, action="user.delete", tenant_id=tenant_id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="user", resource_id=user_id,
        detail={"username": username}, request=request,
    )
    return None
