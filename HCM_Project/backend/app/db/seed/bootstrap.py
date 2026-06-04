"""Idempotent startup bootstrap for the multi-tenancy / RBAC layer.

Run on every startup (after ``create_all``). It:
  1. Ensures the new ``users`` columns exist (for DBs created before this feature).
  2. Seeds the permission catalog from ``app.auth.rbac.rbac.PERMISSIONS``.
  3. Seeds the built-in system roles + their permission grants.
  4. Ensures the DEFAULT tenant exists.
  5. Backfills existing users into the DEFAULT tenant.
  6. Seeds the bootstrap SUPER_ADMIN (if configured and none exists yet).

Everything is upsert-style, so repeated runs are safe.
"""
from __future__ import annotations

import logging

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth.rbac import rbac
from app.core.config import settings
from app.models.roles.rbac_model import Permission, Role
from app.models.users.user_model import User
from app.services.tenants import tenant_service

logger = logging.getLogger("hcm.bootstrap")


def _ensure_user_columns(db: Session) -> None:
    """Add tenant_id/status/auth columns to a pre-existing users table."""
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID"))
        db.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'")
        )
        db.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_type VARCHAR(16) NOT NULL DEFAULT 'ldap'")
        )
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)"))
        db.commit()
    except Exception:  # pragma: no cover - non-Postgres or perms
        logger.exception("Could not ensure users columns (continuing)")
        db.rollback()


def _seed_permissions(db: Session) -> dict[str, Permission]:
    existing = {p.code: p for p in db.scalars(select(Permission)).all()}
    for code, desc in rbac.PERMISSIONS.items():
        perm = existing.get(code)
        if perm is None:
            perm = Permission(code=code, description=desc)
            db.add(perm)
            existing[code] = perm
        elif perm.description != desc:
            perm.description = desc
    db.commit()
    return {p.code: p for p in db.scalars(select(Permission)).all()}


def _seed_system_roles(db: Session, perms: dict[str, Permission]) -> None:
    for sysrole in rbac.SYSTEM_ROLES:
        role = db.scalar(
            select(Role).where(Role.code == sysrole.code, Role.tenant_id.is_(None))
        )
        if role is None:
            role = Role(
                tenant_id=None,
                code=sysrole.code,
                name=sysrole.name,
                description=sysrole.description,
                is_system=True,
            )
            db.add(role)
        else:
            role.name = sysrole.name
            role.description = sysrole.description
            role.is_system = True
        role.permissions = [perms[c] for c in sysrole.permissions if c in perms]
    db.commit()


def _backfill_users(db: Session, master_tenant_id) -> int:
    """Map every tenant-less user (incl. super admins) into the master tenant."""
    count = 0
    for user in db.scalars(select(User).where(User.tenant_id.is_(None))).all():
        user.tenant_id = master_tenant_id
        if not user.roles:
            user.roles = [settings.DEFAULT_USER_ROLE]
        count += 1
    if count:
        db.commit()
    return count


def _seed_super_admin(db: Session, master_tenant_id) -> None:
    username = (settings.SUPER_ADMIN_USERNAME or "").strip()
    if not username:
        return
    # Already have a super admin? Then nothing to do.
    for user in db.scalars(select(User)).all():
        if rbac.is_super_admin(user.roles or []):
            return
    existing = db.scalar(select(User).where(User.username == username))
    if existing is not None:
        existing.roles = [rbac.SUPER_ADMIN]
        existing.tenant_id = master_tenant_id  # super admin belongs to the master (HCAP) tenant
        existing.status = "ACTIVE"
    else:
        # Placeholder row; first LDAP login rebinds directory_id to the real GUID.
        db.add(
            User(
                tenant_id=master_tenant_id,
                directory_id=username,
                username=username,
                email=settings.SUPER_ADMIN_EMAIL,
                name=settings.SUPER_ADMIN_NAME,
                roles=[rbac.SUPER_ADMIN],
                status="ACTIVE",
            )
        )
    db.commit()
    logger.info("Seeded bootstrap SUPER_ADMIN: %s (master tenant)", username)


def run_bootstrap(db: Session) -> None:
    _ensure_user_columns(db)
    perms = _seed_permissions(db)
    _seed_system_roles(db, perms)
    tenant = tenant_service.get_or_create_default_tenant(db)
    moved = _backfill_users(db, tenant.id)
    _seed_super_admin(db, tenant.id)
    logger.info(
        "Bootstrap complete: %d permissions, %d system roles, master tenant=%s, %d users backfilled",
        len(perms), len(rbac.SYSTEM_ROLES), tenant.tenant_code, moved,
    )
