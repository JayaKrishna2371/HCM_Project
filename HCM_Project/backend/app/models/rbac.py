"""RBAC ORM models — Permission catalog, Role, and the role→permission link.

Design
------
* ``Permission`` rows form a fixed catalog of ``resource:action`` strings seeded
  at startup (see ``app.core.rbac`` + ``app.db.bootstrap``).
* ``Role`` is either a *system* role (``tenant_id`` NULL, ``is_system`` True —
  e.g. SUPER_ADMIN, TENANT_ADMIN, USER, READ_ONLY, APPROVER) or a tenant-defined
  *custom* role (``tenant_id`` set). ``code`` is unique within its scope.
* A user's effective role codes live on ``User.roles`` (JSON) for backward
  compatibility; the role's permission set is resolved from these tables and
  flattened into the JWT at login.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    String,
    Table,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

# Many-to-many: which permissions a role grants.
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # e.g. "user:create", "tenant:read", or the wildcard "*".
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    __table_args__ = (
        # A role code is unique per scope (NULL tenant_id = system scope).
        UniqueConstraint("tenant_id", "code", name="uq_role_scope_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # NULL => system role (cross-tenant definition). Set => tenant custom role.
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )

    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    permissions: Mapped[List[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin"
    )

    @property
    def permission_codes(self) -> List[str]:
        return [p.code for p in self.permissions]
