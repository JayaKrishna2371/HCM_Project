"""Tenant (Business Unit) persistence logic."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tenant import LoginType, Tenant, TenantStatus
from app.models.user import User


def get_tenant(db: Session, tenant_id: uuid.UUID) -> Optional[Tenant]:
    return db.get(Tenant, tenant_id)


def get_tenant_by_code(db: Session, code: str) -> Optional[Tenant]:
    return db.scalar(select(Tenant).where(Tenant.tenant_code == code))


def list_tenants(db: Session) -> List[Tenant]:
    # Master tenant first, then alphabetical.
    return list(db.scalars(select(Tenant).order_by(Tenant.is_master.desc(), Tenant.tenant_name)).all())


def user_counts_by_tenant(db: Session) -> Dict[uuid.UUID, int]:
    """tenant_id -> number of users, for the Tenants table '#Users' column."""
    rows = db.execute(
        select(User.tenant_id, func.count(User.id)).group_by(User.tenant_id)
    ).all()
    return {tid: count for tid, count in rows if tid is not None}


def create_tenant(
    db: Session,
    *,
    tenant_code: str,
    tenant_name: str,
    login_type: LoginType,
    base_role: str = "USER",
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
        base_role=base_role or "USER",
        ldap_server_url=ldap_server_url if login_type == LoginType.OWN_LDAP else None,
        domain_name=domain_name if login_type == LoginType.OWN_LDAP else None,
        dc_name=dc_name if login_type == LoginType.OWN_LDAP else None,
        status=TenantStatus.ACTIVE,
        is_master=False,
        created_by=created_by,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def delete_tenant(db: Session, tenant: Tenant) -> None:
    if tenant.is_master:
        raise ValueError("The master tenant cannot be deleted")
    db.delete(tenant)
    db.commit()


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


def get_master_tenant(db: Session) -> Optional[Tenant]:
    return db.scalar(select(Tenant).where(Tenant.is_master.is_(True)))


def get_or_create_default_tenant(db: Session) -> Tenant:
    """The master organization (HCAP). Platform/super admins belong to it and
    pre-existing/auto-provisioned users are mapped to it."""
    tenant = get_master_tenant(db) or get_tenant_by_code(db, settings.DEFAULT_TENANT_CODE)
    if tenant is None:
        tenant = Tenant(
            tenant_code=settings.DEFAULT_TENANT_CODE,
            tenant_name=settings.DEFAULT_TENANT_NAME,
            login_type=LoginType.PLATFORM_LDAP,
            base_role="SUPER_ADMIN",
            status=TenantStatus.ACTIVE,
            is_master=True,
            created_by="system",
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    elif not tenant.is_master:
        # Adopt a pre-existing default tenant as the master.
        tenant.is_master = True
        db.commit()
        db.refresh(tenant)
    return tenant
