"""Tenant (Business Unit) ORM model — the root of multi-tenant isolation."""
from __future__ import annotations

import enum
import uuid
from typing import Optional

from sqlalchemy import Enum as SAEnum
from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class LoginType(str, enum.Enum):
    """How a tenant's users authenticate."""

    PLATFORM_LDAP = "PLATFORM_LDAP"  # use the platform-wide AD/LDAP config
    OWN_LDAP = "OWN_LDAP"            # tenant brings its own directory


class TenantStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Unique business-unit code / domain (e.g. "FINANCE", "acme.example.com").
    tenant_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tenant_name: Mapped[str] = mapped_column(String(255), nullable=False)

    login_type: Mapped[LoginType] = mapped_column(
        SAEnum(LoginType, name="login_type", native_enum=False, length=32),
        default=LoginType.PLATFORM_LDAP,
        nullable=False,
    )

    # Only populated when login_type == OWN_LDAP.
    ldap_server_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    domain_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dc_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[TenantStatus] = mapped_column(
        SAEnum(TenantStatus, name="tenant_status", native_enum=False, length=16),
        default=TenantStatus.ACTIVE,
        nullable=False,
    )

    # Username/directory id of the SUPER_ADMIN who onboarded the tenant.
    created_by: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
