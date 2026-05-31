"""Audit log reads — tenant-scoped activity trail."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.tenant_context import TenantContext
from app.db.session import get_db
from app.auth.tenant_deps import require_permissions
from app.schemas.audit import AuditLogPage, AuditLogRead
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["admin: audit"])


@router.get("", response_model=AuditLogPage, summary="List audit log entries (tenant-scoped)")
def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action, e.g. 'auth.login'"),
    tenant_id: Optional[uuid.UUID] = Query(
        None, description="SUPER_ADMIN only: filter logs to a tenant; omit for ALL tenants."
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("audit:read")),
) -> AuditLogPage:
    # SUPER_ADMIN: scope = explicit query param (None => all). A tenant user is
    # ALWAYS confined to their own (home) tenant — the query param is ignored.
    if ctx.is_super_admin:
        scope_tenant = tenant_id
        scope_is_super = True
    else:
        scope_tenant = ctx.home_tenant_id
        scope_is_super = False
    rows, total = audit_service.list_logs(
        db,
        tenant_id=scope_tenant,
        is_super_admin=scope_is_super,
        action=action,
        limit=limit,
        offset=offset,
    )
    return AuditLogPage(
        items=[AuditLogRead.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
