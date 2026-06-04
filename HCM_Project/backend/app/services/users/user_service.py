"""User business logic — provisioning, validation. Persistence lives in
``app.repositories.users.user_repository``.

Login resolution order (see ``resolve_login_user``):
  1. Match by ``directory_id`` (the stable AD objectGUID) — returning user.
  2. Match by username/UPN — "claims" a row an admin pre-created (admins create
     users by username; the real directory_id is bound on first login).
  3. Unknown user — auto-provision into the default tenant (dev) or reject
     (``AUTH_REQUIRE_DB_PROVISIONING=true``, production posture).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.auth.login.password import hash_password, verify_password
from app.core.config import settings
from app.models.users.user_model import AuthType, User
from app.repositories.users import user_repository as repo
from app.services.tenants import tenant_service


# --------------------------------------------------------------------------- #
#  Lookups (thin pass-throughs to the repository)
# --------------------------------------------------------------------------- #
def get_user_by_directory_id(db: Session, directory_id: str) -> Optional[User]:
    return repo.get_by_directory_id(db, directory_id)


def get_user(db: Session, user_id: int) -> Optional[User]:
    return repo.get_by_id(db, user_id)


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return repo.get_by_username(db, username)


# --------------------------------------------------------------------------- #
#  Local (DB password) authentication
# --------------------------------------------------------------------------- #
def get_local_user(db: Session, username: str) -> Optional[User]:
    """Return a provisioned LOCAL account for ``username``, else ``None``.

    A row only counts as local when ``auth_type='local'`` AND a password hash is
    set. Anything else (LDAP shadow accounts, password-less rows) is treated as
    "no local account here", so the login flow falls back to LDAP.
    """
    user = repo.get_by_username(db, username)
    if user is None or user.auth_type != AuthType.LOCAL or not user.hashed_password:
        return None
    return user


def authenticate_local(db: Session, user: User, password: str) -> Optional[User]:
    """Verify a local user's password, refreshing ``last_login_at`` on success."""
    if not verify_password(password, user.hashed_password):
        return None
    user.last_login_at = datetime.now(timezone.utc)
    return repo.save(db, user)


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

    # 1. Returning user (already bound to a directory_id).
    user = repo.get_by_directory_id(db, directory_id)
    if user is not None:
        _refresh_attrs(user, profile)
        return repo.save(db, user)

    # 2. Pre-created (by an admin) — claim it by username/UPN and bind directory_id.
    candidate = repo.get_by_username(db, profile.get("username") or "") or repo.get_by_username(
        db, profile.get("upn") or ""
    )
    if candidate is not None:
        candidate.directory_id = directory_id
        _refresh_attrs(candidate, profile)
        return repo.save(db, candidate)

    # 3. Unknown user.
    if settings.AUTH_REQUIRE_DB_PROVISIONING:
        return None

    # Dev posture: auto-provision into the master tenant (preserves prior behaviour).
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
        auth_type=AuthType.LDAP,
        last_login_at=datetime.now(timezone.utc),
    )
    return repo.add(db, user)


# --------------------------------------------------------------------------- #
#  Admin-managed CRUD (tenant-scoped)
# --------------------------------------------------------------------------- #
def list_users(db: Session, tenant_id: Optional[uuid.UUID], is_super_admin: bool) -> List[User]:
    return repo.list_by_scope(db, tenant_id, is_super_admin)


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
    password: Optional[str] = None,
) -> User:
    """Create a user.

    When ``password`` is given the user is a *local* account (bcrypt hash stored,
    authenticated against the DB). Without a password the row is an LDAP shadow
    account whose ``directory_id`` is rebound to the real objectGUID on first
    LDAP login.
    """
    if repo.get_by_username(db, username):
        raise ValueError(f"User '{username}' already exists")

    if password:
        auth_type = AuthType.LOCAL
        hashed_password = hash_password(password)
        # Local users have no directory entry; pin a stable, namespaced id so it
        # never collides with a real objectGUID.
        directory_id = directory_id or f"local:{username}"
    else:
        auth_type = AuthType.LDAP
        hashed_password = None
        directory_id = directory_id or username

    user = User(
        tenant_id=tenant_id,
        directory_id=directory_id,
        username=username,
        email=email,
        name=name,
        roles=roles or [settings.DEFAULT_USER_ROLE],
        status=status,
        auth_type=auth_type,
        hashed_password=hashed_password,
    )
    return repo.add(db, user)


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
    return repo.save(db, user)


def delete_user(db: Session, user: User) -> None:
    repo.delete(db, user)


def is_active(user: User) -> bool:
    return (user.status or "ACTIVE").upper() == "ACTIVE"


# Backward-compatible alias: the previous login flow called upsert_from_ldap.
def upsert_from_ldap(db: Session, profile: Dict[str, Any]) -> Optional[User]:
    return resolve_login_user(db, profile)
