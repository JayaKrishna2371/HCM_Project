"""Audit log reads — tenant-scoped activity trail."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.tenant_context import TenantContext
from app.db.session import get_db
from app.dependencies.tenant import require_permissions
from app.schemas.audit import AuditLogPage, AuditLogRead
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["admin: audit"])


@router.get("", response_model=AuditLogPage, summary="List audit log entries (tenant-scoped)")
def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action, e.g. 'auth.login'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permissions("audit:read")),
) -> AuditLogPage:
    rows, total = audit_service.list_logs(
        db,
        tenant_id=ctx.tenant_id,
        is_super_admin=ctx.is_super_admin,
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
