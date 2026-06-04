"""Data access for Tenant rows."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.tenants.tenant_model import Tenant
from app.models.users.user_model import User


def get(db: Session, tenant_id: uuid.UUID) -> Optional[Tenant]:
    return db.get(Tenant, tenant_id)


def get_by_code(db: Session, code: str) -> Optional[Tenant]:
    return db.scalar(select(Tenant).where(Tenant.tenant_code == code))


def get_master(db: Session) -> Optional[Tenant]:
    return db.scalar(select(Tenant).where(Tenant.is_master.is_(True)))


def list_all(db: Session) -> List[Tenant]:
    return list(db.scalars(select(Tenant).order_by(Tenant.is_master.desc(), Tenant.tenant_name)).all())


def user_counts(db: Session) -> Dict[uuid.UUID, int]:
    rows = db.execute(select(User.tenant_id, func.count(User.id)).group_by(User.tenant_id)).all()
    return {tid: count for tid, count in rows if tid is not None}


def add(db: Session, tenant: Tenant) -> Tenant:
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def save(db: Session, tenant: Tenant) -> Tenant:
    db.commit()
    db.refresh(tenant)
    return tenant


def delete(db: Session, tenant: Tenant) -> None:
    db.delete(tenant)
    db.commit()
