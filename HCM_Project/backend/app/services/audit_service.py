"""Audit trail business logic. Persistence in
``app.repositories.audit_repository``."""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.repositories import audit_repository as repo

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
        repo.add(
            db,
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
            ),
        )
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
    """Tenant-scoped audit query. A SUPER_ADMIN with no tenant selected sees all."""
    scoped = not (is_super_admin and tenant_id is None)
    return repo.query(db, tenant_id=tenant_id, scoped=scoped, action=action, limit=limit, offset=offset)
