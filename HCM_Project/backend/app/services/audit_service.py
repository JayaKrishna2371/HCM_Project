"""Audit trail persistence — one helper for the whole platform to call."""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


def record(
    db: Session,
    *,
    action: str,
    tenant_id: Optional[uuid.UUID] = None,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    status: str = "SUCCESS",
    detail: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Persist an audit event. Never raises — auditing must not break the request."""
    ip = None
    user_agent = None
    if request is not None:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
    try:
        db.add(
            AuditLog(
                tenant_id=tenant_id,
                actor_user_id=actor_user_id,
                actor_username=actor_username,
                action=action,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id is not None else None,
                status=status,
                ip_address=ip,
                user_agent=user_agent,
                detail=detail,
            )
        )
        db.commit()
    except Exception:  # pragma: no cover - defensive
        logger.exception("Failed to write audit log for action=%s", action)
        db.rollback()


def list_logs(
    db: Session,
    *,
    tenant_id: Optional[uuid.UUID],
    is_super_admin: bool,
    action: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AuditLog], int]:
    """Tenant-scoped audit query.

    A SUPER_ADMIN with no tenant selected sees all events; otherwise results are
    constrained to the effective tenant.
    """
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)

    if not (is_super_admin and tenant_id is None):
        stmt = stmt.where(AuditLog.tenant_id == tenant_id)
        count_stmt = count_stmt.where(AuditLog.tenant_id == tenant_id)

    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)

    total = db.scalar(count_stmt) or 0
    rows = list(
        db.scalars(
            stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        ).all()
    )
    return rows, total
