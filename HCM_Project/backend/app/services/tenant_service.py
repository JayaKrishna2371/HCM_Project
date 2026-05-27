"""Tenant (Business Unit) business logic. Persistence in
``app.repositories.tenant_repository``."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tenant import LoginType, Tenant, TenantStatus
from app.repositories import tenant_repository as repo


def get_tenant(db: Session, tenant_id: uuid.UUID) -> Optional[Tenant]:
    return repo.get(db, tenant_id)


def get_tenant_by_code(db: Session, code: str) -> Optional[Tenant]:
    return repo.get_by_code(db, code)


def get_master_tenant(db: Session) -> Optional[Tenant]:
    return repo.get_master(db)


def list_tenants(db: Session) -> List[Tenant]:
    return repo.list_all(db)


def user_counts_by_tenant(db: Session) -> Dict[uuid.UUID, int]:
    """tenant_id -> number of users, for the Tenants table '#Users' column."""
    return repo.user_counts(db)


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
    if repo.get_by_code(db, tenant_code):
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
    return repo.add(db, tenant)


def update_tenant(db: Session, tenant: Tenant, **changes) -> Tenant:
    for field in ("tenant_name", "login_type", "base_role", "ldap_server_url", "domain_name", "dc_name", "status"):
        if field in changes and changes[field] is not None:
            setattr(tenant, field, changes[field])
    # Clear own-LDAP fields if switched back to platform LDAP.
    if tenant.login_type == LoginType.PLATFORM_LDAP:
        tenant.ldap_server_url = None
        tenant.domain_name = None
        tenant.dc_name = None
    return repo.save(db, tenant)


def delete_tenant(db: Session, tenant: Tenant) -> None:
    if tenant.is_master:
        raise ValueError("The master tenant cannot be deleted")
    repo.delete(db, tenant)


def get_or_create_default_tenant(db: Session) -> Tenant:
    """The master organization (HCAP). Platform/super admins belong to it and
    pre-existing/auto-provisioned users are mapped to it."""
    tenant = repo.get_master(db) or repo.get_by_code(db, settings.DEFAULT_TENANT_CODE)
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
        return repo.add(db, tenant)
    if not tenant.is_master:
        tenant.is_master = True
        return repo.save(db, tenant)
    return tenant
