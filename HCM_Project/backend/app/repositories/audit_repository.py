"""Data access for AuditLog rows."""
from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def add(db: Session, log: AuditLog) -> None:
    db.add(log)
    db.commit()


def query(
    db: Session,
    *,
    tenant_id: Optional[uuid.UUID],
    scoped: bool,
    action: Optional[str],
    limit: int,
    offset: int,
) -> Tuple[List[AuditLog], int]:
    """``scoped=False`` returns platform-wide (super admin); otherwise filtered to tenant_id."""
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)
    if scoped:
        stmt = stmt.where(AuditLog.tenant_id == tenant_id)
        count_stmt = count_stmt.where(AuditLog.tenant_id == tenant_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)
    total = db.scalar(count_stmt) or 0
    rows = list(db.scalars(stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)).all())
    return rows, total
