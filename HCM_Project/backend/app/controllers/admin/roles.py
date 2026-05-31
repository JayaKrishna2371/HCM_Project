"""Role & permission management.

System roles are read-only; tenant admins create/manage custom roles scoped to
their own tenant from the permission catalog.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auth.tenant_context import TenantContext
from app.db.session import get_db
from app.auth.tenant_deps import require_permissions
from app.schemas.admin import PermissionRead, RoleCreate, RoleRead, RoleUpdate
from app.services import audit_service, rbac_service

router = APIRouter(tags=["admin: roles"])


@router.get("/permissions", response_model=List[PermissionRead], summary="Permission catalog")
def list_permissions(
    db: Session = Depends(get_db),
    _: TenantContext = Depends(require_permissions("permission:read")),
) -> List[PermissionRead]:
    return [PermissionRead.model_validate(p) for p in rbac_service.list_permissions(db)]


@router.get("/roles", response_model=List[RoleRead], summary="Roles")
def list_roles(
    tenant_id: Optional[uuid.UUID] = Query(
        None, description="SUPER_ADMIN only: filter custom roles to a tenant."
    ),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("role:read")),
) -> List[RoleRead]:
    if ctx.is_super_admin:
        # No filter => ALL roles (system + every tenant's custom).
        # Filter => only that tenant's custom roles.
        roles = rbac_service.list_roles(db, tenant_id, include_system=False)
    else:
        # A TENANT_ADMIN only sees their own tenant's custom roles — never system roles.
        roles = [
            r for r in rbac_service.list_roles(db, ctx.home_tenant_id, include_system=False)
            if not r.is_system
        ]
    return [RoleRead.from_role(r) for r in roles]


@router.post(
    "/roles",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom role (tenant-scoped)",
)
def create_role(
    body: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("role:create")),
) -> RoleRead:
    # Target tenant: a TENANT_ADMIN is bound to their own; a SUPER_ADMIN must say
    # which tenant the custom role belongs to (sent in the body).
    if ctx.is_super_admin:
        tenant_id = body.tenant_id
        if tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a tenant to create the role in (tenant_id).",
            )
    elif ctx.home_tenant_id is not None:
        tenant_id = ctx.home_tenant_id
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant context.")
    try:
        role = rbac_service.create_custom_role(
            db,
            tenant_id=tenant_id,
            code=body.code,
            name=body.name,
            description=body.description,
            permission_codes=body.permissions,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e

    audit_service.record(
        db, action="role.create", tenant_id=tenant_id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="role", resource_id=role.id,
        detail={"code": role.code, "permissions": role.permission_codes}, request=request,
    )
    return RoleRead.from_role(role)


@router.patch("/roles/{role_id}", response_model=RoleRead, summary="Update a custom role")
def update_role(
    role_id: int,
    body: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("role:update")),
) -> RoleRead:
    role = rbac_service.get_role(db, role_id)
    if role is None or (not ctx.is_super_admin and role.tenant_id != ctx.home_tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    try:
        role = rbac_service.update_custom_role(db, role, **body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    audit_service.record(
        db, action="role.update", tenant_id=role.tenant_id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="role", resource_id=role.id, request=request,
    )
    return RoleRead.from_role(role)


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a custom role")
def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("role:delete")),
) -> None:
    role = rbac_service.get_role(db, role_id)
    if role is None or (not ctx.is_super_admin and role.tenant_id != ctx.home_tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    try:
        rbac_service.delete_custom_role(db, role)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    audit_service.record(
        db, action="role.delete", tenant_id=role.tenant_id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="role", resource_id=role_id, request=request,
    )
    return None
