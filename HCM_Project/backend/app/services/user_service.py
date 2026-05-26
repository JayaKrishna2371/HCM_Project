"""User persistence logic — now tenant-aware with DB-managed RBAC.

Login resolution order (see ``resolve_login_user``):
  1. Match by ``directory_id`` (the stable AD objectGUID) — returning user.
  2. Match by username/UPN — "claims" a row an admin pre-created (admins create
     users by username; the real directory_id is bound on first login).
  3. Unknown user — auto-provision into the default tenant (dev) or reject
     (``AUTH_REQUIRE_DB_PROVISIONING=true``, production posture).

For known/claimed users the DB is the source of truth for tenant_id, roles and
status; LDAP only refreshes display attributes. LDAP-derived roles are NOT
trusted for authorization (authentication only).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import rbac
from app.core.config import settings
from app.models.user import User
from app.services import tenant_service


# --------------------------------------------------------------------------- #
#  Lookups
# --------------------------------------------------------------------------- #
def get_user_by_directory_id(db: Session, directory_id: str) -> Optional[User]:
    return db.scalar(select(User).where(User.directory_id == directory_id))


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    if not username:
        return None
    return db.scalar(select(User).where(func.lower(User.username) == username.lower()))


# --------------------------------------------------------------------------- #
#  Login resolution / provisioning
# --------------------------------------------------------------------------- #
def _refresh_attrs(user: User, profile: Dict[str, Any]) -> None:
    user.username = profile.get("username") or user.username
    user.upn = profile.get("upn") or user.upn
    user.email = profile.get("email") or user.email
    user.name = profile.get("name") or user.name
    user.given_name = profile.get("given_name") or user.given_name
    user.family_name = profile.get("family_name") or user.family_name
    user.last_login_at = datetime.now(timezone.utc)


def resolve_login_user(db: Session, profile: Dict[str, Any]) -> Optional[User]:
    """Return the User for a successful LDAP bind, provisioning if policy allows.

    Returns ``None`` when the user is unknown and DB provisioning is required.
    """
    directory_id = profile["directory_id"]
    now = datetime.now(timezone.utc)

    # 1. Returning user (already bound to a directory_id).
    user = get_user_by_directory_id(db, directory_id)
    if user is not None:
        _refresh_attrs(user, profile)
        db.commit()
        db.refresh(user)
        return user

    # 2. Pre-created (by an admin) — claim it by username/UPN and bind directory_id.
    candidate = get_user_by_username(db, profile.get("username") or "") or get_user_by_username(
        db, (profile.get("upn") or "")
    )
    if candidate is not None:
        candidate.directory_id = directory_id
        _refresh_attrs(candidate, profile)
        db.commit()
        db.refresh(candidate)
        return candidate

    # 3. Unknown user.
    if settings.AUTH_REQUIRE_DB_PROVISIONING:
        return None

    # Dev posture: auto-provision into the default tenant (preserves prior behaviour).
    tenant = tenant_service.get_or_create_default_tenant(db)
    user = User(
        tenant_id=tenant.id,
        directory_id=directory_id,
        username=profile.get("username"),
        upn=profile.get("upn"),
        email=profile.get("email"),
        name=profile.get("name"),
        given_name=profile.get("given_name"),
        family_name=profile.get("family_name"),
        roles=[settings.DEFAULT_USER_ROLE],
        status="ACTIVE",
        last_login_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# --------------------------------------------------------------------------- #
#  Admin-managed CRUD (tenant-scoped)
# --------------------------------------------------------------------------- #
def list_users(db: Session, tenant_id: Optional[uuid.UUID], is_super_admin: bool) -> List[User]:
    stmt = select(User)
    if not (is_super_admin and tenant_id is None):
        stmt = stmt.where(User.tenant_id == tenant_id)
    return list(db.scalars(stmt.order_by(User.username)).all())


def create_user(
    db: Session,
    *,
    tenant_id: Optional[uuid.UUID],
    username: str,
    email: Optional[str],
    name: Optional[str],
    directory_id: Optional[str],
    roles: List[str],
    status: str = "ACTIVE",
) -> User:
    if get_user_by_username(db, username):
        raise ValueError(f"User '{username}' already exists")
    # Until first LDAP login, the directory_id placeholder is the username; it is
    # rebound to the real objectGUID when the user first authenticates.
    user = User(
        tenant_id=tenant_id,
        directory_id=directory_id or username,
        username=username,
        email=email,
        name=name,
        roles=roles or [settings.DEFAULT_USER_ROLE],
        status=status,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    user: User,
    *,
    email: Optional[str] = None,
    name: Optional[str] = None,
    roles: Optional[List[str]] = None,
    status: Optional[str] = None,
) -> User:
    if email is not None:
        user.email = email
    if name is not None:
        user.name = name
    if roles is not None:
        user.roles = roles
    if status is not None:
        user.status = status
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()


def is_active(user: User) -> bool:
    return (user.status or "ACTIVE").upper() == "ACTIVE"


# Backward-compatible alias: the previous login flow called upsert_from_ldap.
def upsert_from_ldap(db: Session, profile: Dict[str, Any]) -> Optional[User]:
    return resolve_login_user(db, profile)
