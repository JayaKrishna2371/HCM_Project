"""Reusable SQLAlchemy column mixins.

``TenantScopedMixin`` is the single place that defines the ``tenant_id`` column
used for row-level multi-tenant isolation. Any future tenant-scoped table
(infrastructure, assets, deployments, …) only needs to inherit this mixin and it
automatically participates in the same isolation contract — see
``app.dependencies.tenant`` for the matching query-time enforcement.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


class TimestampMixin:
    """created_at / updated_at, managed by the database."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantScopedMixin:
    """Adds an indexed ``tenant_id`` foreign key for tenant-scoped tables.

    Nullable so platform-level rows (e.g. the SUPER_ADMIN user, system roles,
    platform audit events) can exist without a tenant. Tenant data MUST always
    set it; enforcement lives in the service/dependency layer.
    """

    @declared_attr
    def tenant_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return mapped_column(
            Uuid,
            ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        )
