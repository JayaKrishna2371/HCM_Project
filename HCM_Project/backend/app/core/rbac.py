"""RBAC catalog — the single source of truth for permissions and system roles.

This module defines, in code, the fixed permission catalog and the built-in
system roles. ``app.db.bootstrap`` reads these to seed the database idempotently
on startup, so adding a permission or adjusting a system role is a one-line
change here followed by a restart.

Permissions are ``resource:action`` strings. The wildcard ``"*"`` means "all
permissions" and is held only by SUPER_ADMIN.
"""
from __future__ import annotations

from typing import Dict, List

WILDCARD = "*"

# --------------------------------------------------------------------------- #
#  Permission catalog: code -> human description
# --------------------------------------------------------------------------- #
PERMISSIONS: Dict[str, str] = {
    WILDCARD: "Full platform access (super admin)",
    # Tenants
    "tenant:create": "Create / onboard tenants",
    "tenant:read": "View tenants",
    "tenant:update": "Update / activate / deactivate tenants",
    "tenant:delete": "Delete tenants",
    "tenant:switch": "Act within another tenant's context",
    # Users
    "user:create": "Create users",
    "user:read": "View users",
    "user:update": "Update users",
    "user:delete": "Delete users",
    # Roles & permissions
    "role:create": "Create custom roles",
    "role:read": "View roles",
    "role:update": "Update custom roles",
    "role:delete": "Delete custom roles",
    "permission:read": "View the permission catalog",
    # LDAP / directory
    "ldap:read": "View LDAP configuration",
    "ldap:update": "Update LDAP configuration",
    # Settings
    "tenant_settings:read": "View tenant settings",
    "tenant_settings:update": "Update tenant settings",
    "platform_settings:manage": "Manage global platform settings",
    # Audit
    "audit:read": "View audit logs",
    # Infrastructure / access control
    "infra:read": "View infrastructure",
    "infra:manage": "Manage infrastructure / deployments",
    "access_control:read": "View access control",
    "access_control:manage": "Manage access control",
}

# --------------------------------------------------------------------------- #
#  System roles
# --------------------------------------------------------------------------- #
# Role codes used throughout the app.
SUPER_ADMIN = "SUPER_ADMIN"
TENANT_ADMIN = "TENANT_ADMIN"
APPROVER = "APPROVER"
USER = "USER"
READ_ONLY = "READ_ONLY"

# Permissions a TENANT_ADMIN gets — scoped to their own tenant at query time.
_TENANT_ADMIN_PERMS: List[str] = [
    "tenant:read",
    "user:create", "user:read", "user:update", "user:delete",
    "role:create", "role:read", "role:update", "role:delete",
    "permission:read",
    "ldap:read", "ldap:update",
    "tenant_settings:read", "tenant_settings:update",
    "audit:read",
    "infra:read", "infra:manage",
    "access_control:read", "access_control:manage",
]

_APPROVER_PERMS: List[str] = [
    "tenant:read", "user:read", "infra:read", "audit:read",
    "access_control:read",
]

_USER_PERMS: List[str] = [
    "infra:read", "tenant_settings:read",
]

_READ_ONLY_PERMS: List[str] = [
    "tenant:read", "user:read", "infra:read", "audit:read",
    "access_control:read", "tenant_settings:read", "role:read",
]


class SystemRole:
    def __init__(self, code: str, name: str, description: str, permissions: List[str]):
        self.code = code
        self.name = name
        self.description = description
        self.permissions = permissions


SYSTEM_ROLES: List[SystemRole] = [
    SystemRole(SUPER_ADMIN, "Super Admin", "Internal platform team — full access", [WILDCARD]),
    SystemRole(TENANT_ADMIN, "Tenant Admin", "Business-unit administrator", _TENANT_ADMIN_PERMS),
    SystemRole(APPROVER, "Approver", "Approves workflows within the tenant", _APPROVER_PERMS),
    SystemRole(USER, "User", "Standard tenant user", _USER_PERMS),
    SystemRole(READ_ONLY, "Read Only", "Read-only tenant access", _READ_ONLY_PERMS),
]

# Role codes that are platform-level (no tenant). Used to detect super admins.
PLATFORM_ROLES = {SUPER_ADMIN}


def is_super_admin(roles: List[str]) -> bool:
    return any(r.upper() == SUPER_ADMIN for r in (roles or []))


def expand_permissions(role_codes: List[str], role_perms: Dict[str, List[str]]) -> List[str]:
    """Flatten a list of role codes into a de-duplicated permission list.

    ``role_perms`` maps role code -> permission codes (resolved from the DB).
    If any role grants the wildcard, the result is just ``["*"]``.
    """
    out: List[str] = []
    for code in role_codes or []:
        for perm in role_perms.get(code, []):
            if perm == WILDCARD:
                return [WILDCARD]
            if perm not in out:
                out.append(perm)
    return out


def has_permission(granted: List[str], required: str) -> bool:
    return WILDCARD in (granted or []) or required in (granted or [])
