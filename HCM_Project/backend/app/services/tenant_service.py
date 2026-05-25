"""Tenant (Business Unit) persistence logic."""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tenant import LoginType, Tenant, TenantStatus


def get_tenant(db: Session, tenant_id: uuid.UUID) -> Optional[Tenant]:
    return db.get(Tenant, tenant_id)


def get_tenant_by_code(db: Session, code: str) -> Optional[Tenant]:
    return db.scalar(select(Tenant).where(Tenant.tenant_code == code))


def list_tenants(db: Session) -> List[Tenant]:
    return list(db.scalars(select(Tenant).order_by(Tenant.tenant_name)).all())


def create_tenant(
    db: Session,
    *,
    tenant_code: str,
    tenant_name: str,
    login_type: LoginType,
    ldap_server_url: Optional[str],
    domain_name: Optional[str],
    dc_name: Optional[str],
    created_by: Optional[str],
) -> Tenant:
    if get_tenant_by_code(db, tenant_code):
        raise ValueError(f"Tenant code '{tenant_code}' already exists")
    tenant = Tenant(
        tenant_code=tenant_code,
        tenant_name=tenant_name,
        login_type=login_type,
        ldap_server_url=ldap_server_url if login_type == LoginType.OWN_LDAP else None,
        domain_name=domain_name if login_type == LoginType.OWN_LDAP else None,
        dc_name=dc_name if login_type == LoginType.OWN_LDAP else None,
        status=TenantStatus.ACTIVE,
        created_by=created_by,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def update_tenant(db: Session, tenant: Tenant, **changes) -> Tenant:
    for field in ("tenant_name", "login_type", "ldap_server_url", "domain_name", "dc_name", "status"):
        if field in changes and changes[field] is not None:
            setattr(tenant, field, changes[field])
    # Clear own-LDAP fields if switched back to platform LDAP.
    if tenant.login_type == LoginType.PLATFORM_LDAP:
        tenant.ldap_server_url = None
        tenant.domain_name = None
        tenant.dc_name = None
    db.commit()
    db.refresh(tenant)
    return tenant


def get_or_create_default_tenant(db: Session) -> Tenant:
    """The fallback tenant existing/auto-provisioned users are mapped to."""
    tenant = get_tenant_by_code(db, settings.DEFAULT_TENANT_CODE)
    if tenant is None:
        tenant = Tenant(
            tenant_code=settings.DEFAULT_TENANT_CODE,
            tenant_name=settings.DEFAULT_TENANT_NAME,
            login_type=LoginType.PLATFORM_LDAP,
            status=TenantStatus.ACTIVE,
            created_by="system",
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant
