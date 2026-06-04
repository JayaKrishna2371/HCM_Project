"""Tenant (Business Unit) management — SUPER_ADMIN onboards/manages tenants."""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.admin.tenant_context import TenantContext
from app.db.session.session import get_db
from app.auth.admin.tenant_deps import require_permissions
from app.schemas.tenants.tenant_schema import TenantCreate, TenantRead, TenantUpdate
from app.services.audit import audit_service
from app.services.tenants import tenant_service

router = APIRouter(prefix="/tenants", tags=["admin: tenants"])


@router.get("", response_model=List[TenantRead], summary="List tenants")
def list_tenants(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("tenant:read")),
) -> List[TenantRead]:
    # Tenant Management is a platform-level view: a SUPER_ADMIN always sees every
    # tenant, regardless of any tenant context they've switched into (X-Tenant-Id).
    # A tenant user only ever sees their own (home) tenant.
    if ctx.is_super_admin:
        tenants = tenant_service.list_tenants(db)
    elif ctx.home_tenant_id is not None:
        tenant = tenant_service.get_tenant(db, ctx.home_tenant_id)
        tenants = [tenant] if tenant else []
    else:
        tenants = []

    counts = tenant_service.user_counts_by_tenant(db)
    out: List[TenantRead] = []
    for t in tenants:
        item = TenantRead.model_validate(t)
        item.user_count = counts.get(t.id, 0)
        out.append(item)
    return out


@router.post(
    "",
    response_model=TenantRead,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new tenant (SUPER_ADMIN only)",
)
def create_tenant(
    body: TenantCreate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("tenant:create")),
) -> TenantRead:
    try:
        tenant = tenant_service.create_tenant(
            db,
            tenant_code=body.tenant_code,
            tenant_name=body.tenant_name,
            login_type=body.login_type,
            base_role=body.base_role,
            ldap_server_url=body.ldap_server_url,
            domain_name=body.domain_name,
            dc_name=body.dc_name,
            created_by=ctx.username,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e

    audit_service.record(
        db, action="tenant.create", tenant_id=tenant.id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="tenant", resource_id=tenant.id,
        detail={"tenant_code": tenant.tenant_code}, request=request,
    )
    return TenantRead.model_validate(tenant)


@router.get("/{tenant_id}", response_model=TenantRead, summary="Get a tenant")
def get_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("tenant:read")),
) -> TenantRead:
    # A tenant user may only read their own tenant.
    if not ctx.is_super_admin and tenant_id != ctx.home_tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access denied")
    tenant = tenant_service.get_tenant(db, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return TenantRead.model_validate(tenant)


@router.patch("/{tenant_id}", response_model=TenantRead, summary="Update / activate / deactivate a tenant")
def update_tenant(
    tenant_id: uuid.UUID,
    body: TenantUpdate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("tenant:update")),
) -> TenantRead:
    # Only SUPER_ADMIN holds tenant:update, but defend in depth anyway.
    if not ctx.is_super_admin and tenant_id != ctx.home_tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access denied")
    tenant = tenant_service.get_tenant(db, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    tenant = tenant_service.update_tenant(db, tenant, **body.model_dump(exclude_unset=True))
    audit_service.record(
        db, action="tenant.update", tenant_id=tenant.id,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="tenant", resource_id=tenant.id,
        detail=body.model_dump(exclude_unset=True, mode="json"), request=request,
    )
    return TenantRead.model_validate(tenant)


@router.delete(
    "/{tenant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a tenant (SUPER_ADMIN only; master tenant is protected)",
)
def delete_tenant(
    tenant_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("tenant:delete")),
) -> None:
    tenant = tenant_service.get_tenant(db, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    try:
        tenant_service.delete_tenant(db, tenant)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    audit_service.record(
        db, action="tenant.delete", tenant_id=None,
        actor_user_id=ctx.user_id, actor_username=ctx.username,
        resource_type="tenant", resource_id=tenant_id,
        detail={"tenant_code": tenant.tenant_code}, request=request,
    )
    return None
