"""Data access for Role / Permission rows."""
from __future__ import annotations

import uuid
from typing import List, Optional, Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.roles.rbac_model import Permission, Role


def roles_for_codes(db: Session, role_codes: Sequence[str], tenant_id: Optional[uuid.UUID]) -> List[Role]:
    if not role_codes:
        return []
    stmt = select(Role).where(Role.code.in_(list(role_codes)))
    if tenant_id is not None:
        stmt = stmt.where(or_(Role.tenant_id.is_(None), Role.tenant_id == tenant_id))
    else:
        stmt = stmt.where(Role.tenant_id.is_(None))
    return list(db.scalars(stmt).all())


def list_permissions(db: Session) -> List[Permission]:
    return list(db.scalars(select(Permission).order_by(Permission.code)).all())


def permissions_by_codes(db: Session, codes: Sequence[str]) -> List[Permission]:
    if not codes:
        return []
    return list(db.scalars(select(Permission).where(Permission.code.in_(list(codes)))).all())


def list_roles(db: Session, tenant_id: Optional[uuid.UUID], include_system: bool = True) -> List[Role]:
    conds = []
    if include_system:
        conds.append(Role.tenant_id.is_(None))
    if tenant_id is not None:
        conds.append(Role.tenant_id == tenant_id)
    stmt = select(Role)
    if conds:
        stmt = stmt.where(or_(*conds))
    return list(db.scalars(stmt.order_by(Role.is_system.desc(), Role.code)).all())


def get_role(db: Session, role_id: int) -> Optional[Role]:
    return db.get(Role, role_id)


def get_role_by_code(db: Session, code: str, tenant_id: Optional[uuid.UUID]) -> Optional[Role]:
    stmt = select(Role).where(Role.code == code)
    stmt = stmt.where(Role.tenant_id == tenant_id) if tenant_id else stmt.where(Role.tenant_id.is_(None))
    return db.scalar(stmt)


def add_role(db: Session, role: Role) -> Role:
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def save_role(db: Session, role: Role) -> Role:
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role: Role) -> None:
    db.delete(role)
    db.commit()
