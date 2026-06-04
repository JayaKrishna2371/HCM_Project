"""User ORM model — local mirror of Active Directory identities.

Multi-tenancy: every user belongs to exactly one tenant (``tenant_id``), except
the platform ``SUPER_ADMIN`` whose ``tenant_id`` is NULL. The tenant binding is
the anchor for row-level isolation across the platform.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session.base import Base
from app.models.mixins import TenantScopedMixin


class UserStatus:
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class AuthType:
    """Where a user's credentials are verified.

    ``ldap``  — password checked against Active Directory (the default; no
                password is ever stored locally).
    ``local`` — password hashed with bcrypt and stored in ``hashed_password``.
    """

    LDAP = "ldap"
    LOCAL = "local"


class User(Base, TenantScopedMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # tenant_id (nullable) is provided by TenantScopedMixin. NULL => SUPER_ADMIN.

    # Stable AD identifier — objectGUID (falls back to UPN/sAMAccountName).
    directory_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    # sAMAccountName — the login name; userPrincipalName is the full alice@corp.
    username: Mapped[Optional[str]] = mapped_column(String(256), index=True, nullable=True)
    upn: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)

    # Credential source: "ldap" (default — AD verifies the password) or "local"
    # (bcrypt hash stored below). Drives the auto-detect login path.
    auth_type: Mapped[str] = mapped_column(String(16), default="ldap", nullable=False)

    # bcrypt hash — set ONLY for local users; always NULL for LDAP users.
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    email: Mapped[Optional[str]] = mapped_column(String(320), index=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    given_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    family_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Effective application role codes (DB-managed RBAC). Kept as JSON for
    # backward compatibility with require_roles(); the role→permission expansion
    # lives in app.services.roles.rbac_service.
    roles: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Account lifecycle within the tenant (ACTIVE | INACTIVE). Disabled users are
    # rejected at login even if AD still authenticates them.
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", nullable=False)

    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
