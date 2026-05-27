"""Role/permission business logic + resolution. Persistence in
``app.repositories.rbac_repository``."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.auth import rbac
from app.models.rbac import Permission, Role
from app.repositories import rbac_repository as repo


# --------------------------------------------------------------------------- #
#  Permission resolution
# --------------------------------------------------------------------------- #
def permissions_for_role_codes(
    db: Session, role_codes: Sequence[str], tenant_id: Optional[uuid.UUID] = None
) -> List[str]:
    """Flatten role codes into an effective permission list (``["*"]`` for super)."""
    roles = repo.roles_for_codes(db, role_codes, tenant_id)
    role_perms: Dict[str, List[str]] = {r.code: r.permission_codes for r in roles}
    return rbac.expand_permissions(list(role_codes), role_perms)


# --------------------------------------------------------------------------- #
#  Catalog reads
# --------------------------------------------------------------------------- #
def list_permissions(db: Session) -> List[Permission]:
    return repo.list_permissions(db)


def list_roles(db: Session, tenant_id: Optional[uuid.UUID], include_system: bool = True) -> List[Role]:
    return repo.list_roles(db, tenant_id, include_system)


def get_role(db: Session, role_id: int) -> Optional[Role]:
    return repo.get_role(db, role_id)


def get_role_by_code(db: Session, code: str, tenant_id: Optional[uuid.UUID]) -> Optional[Role]:
    return repo.get_role_by_code(db, code, tenant_id)


# --------------------------------------------------------------------------- #
#  Custom role management (tenant-scoped)
# --------------------------------------------------------------------------- #
def _resolve_permissions(db: Session, codes: Sequence[str]) -> List[Permission]:
    if not codes:
        return []
    perms = repo.permissions_by_codes(db, codes)
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
    if repo.get_role_by_code(db, code, tenant_id):
        raise ValueError(f"Role '{code}' already exists in this tenant")
    # Disallow shadowing a system role code.
    if repo.get_role_by_code(db, code, None):
        raise ValueError(f"'{code}' is a reserved system role")
    role = Role(
        tenant_id=tenant_id,
        code=code,
        name=name,
        description=description,
        is_system=False,
        permissions=_resolve_permissions(db, permission_codes),
    )
    return repo.add_role(db, role)


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
    return repo.save_role(db, role)


def delete_custom_role(db: Session, role: Role) -> None:
    if role.is_system:
        raise ValueError("System roles cannot be deleted")
    repo.delete_role(db, role)
