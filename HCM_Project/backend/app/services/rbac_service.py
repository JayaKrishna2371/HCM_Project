"""Role/permission persistence + resolution logic."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional, Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import rbac
from app.models.rbac import Permission, Role


# --------------------------------------------------------------------------- #
#  Permission resolution
# --------------------------------------------------------------------------- #
def _roles_for_codes(
    db: Session, role_codes: Sequence[str], tenant_id: Optional[uuid.UUID]
) -> List[Role]:
    """Load Role rows matching the given codes.

    System roles (tenant_id IS NULL) always match; tenant custom roles match only
    within the user's tenant. This prevents one tenant's custom role from being
    honoured for another tenant's user even if the codes collide.
    """
    if not role_codes:
        return []
    stmt = select(Role).where(Role.code.in_(list(role_codes)))
    if tenant_id is not None:
        stmt = stmt.where(or_(Role.tenant_id.is_(None), Role.tenant_id == tenant_id))
    else:
        stmt = stmt.where(Role.tenant_id.is_(None))
    return list(db.scalars(stmt).all())


def permissions_for_role_codes(
    db: Session, role_codes: Sequence[str], tenant_id: Optional[uuid.UUID] = None
) -> List[str]:
    """Flatten role codes into an effective permission list (``["*"]`` for super)."""
    roles = _roles_for_codes(db, role_codes, tenant_id)
    role_perms: Dict[str, List[str]] = {r.code: r.permission_codes for r in roles}
    return rbac.expand_permissions(list(role_codes), role_perms)


# --------------------------------------------------------------------------- #
#  Catalog reads
# --------------------------------------------------------------------------- #
def list_permissions(db: Session) -> List[Permission]:
    return list(db.scalars(select(Permission).order_by(Permission.code)).all())


def list_roles(db: Session, tenant_id: Optional[uuid.UUID], include_system: bool = True) -> List[Role]:
    """System roles + the tenant's custom roles."""
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


# --------------------------------------------------------------------------- #
#  Custom role management (tenant-scoped)
# --------------------------------------------------------------------------- #
def _resolve_permissions(db: Session, codes: Sequence[str]) -> List[Permission]:
    if not codes:
        return []
    perms = list(db.scalars(select(Permission).where(Permission.code.in_(list(codes)))).all())
    found = {p.code for p in perms}
    unknown = [c for c in codes if c not in found]
    if unknown:
        raise ValueError(f"Unknown permission codes: {unknown}")
    return perms


def create_custom_role(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    code: str,
    name: str,
    description: Optional[str],
    permission_codes: Sequence[str],
) -> Role:
    if get_role_by_code(db, code, tenant_id):
        raise ValueError(f"Role '{code}' already exists in this tenant")
    # Disallow shadowing a system role code.
    if get_role_by_code(db, code, None):
        raise ValueError(f"'{code}' is a reserved system role")
    role = Role(
        tenant_id=tenant_id,
        code=code,
        name=name,
        description=description,
        is_system=False,
        permissions=_resolve_permissions(db, permission_codes),
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def update_custom_role(
    db: Session,
    role: Role,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    permission_codes: Optional[Sequence[str]] = None,
) -> Role:
    if role.is_system:
        raise ValueError("System roles cannot be modified")
    if name is not None:
        role.name = name
    if description is not None:
        role.description = description
    if permission_codes is not None:
        role.permissions = _resolve_permissions(db, permission_codes)
    db.commit()
    db.refresh(role)
    return role


def delete_custom_role(db: Session, role: Role) -> None:
    if role.is_system:
        raise ValueError("System roles cannot be deleted")
    db.delete(role)
    db.commit()
