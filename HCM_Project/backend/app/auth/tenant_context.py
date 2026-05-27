"""Tenant context — resolves the effective tenant for the current request.

The effective tenant_id is the anchor every tenant-scoped query filters on:

* **Tenant users** are pinned to their own ``tenant_id`` (from the JWT / DB row).
  An ``X-Tenant-Id`` header that disagrees with their own tenant is rejected —
  this is the cross-tenant API protection.
* **SUPER_ADMIN** has no home tenant. They operate platform-wide by default, and
  may opt into a specific tenant's context by sending ``X-Tenant-Id`` (tenant
  switching). ``is_super_admin`` callers bypass per-tenant filtering unless they
  switch in.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import List, Optional

from app.auth import rbac


@dataclass(frozen=True)
class TenantContext:
    """Resolved authorization context for a request."""

    user_id: int
    username: Optional[str]
    is_super_admin: bool
    # The tenant whose data this request operates on. None => platform-wide
    # (only valid for a SUPER_ADMIN who has not switched into a tenant).
    tenant_id: Optional[uuid.UUID]
    # The user's *home* tenant (their own membership). None for SUPER_ADMIN.
    home_tenant_id: Optional[uuid.UUID]
    roles: List[str]
    permissions: List[str]

    def has_permission(self, code: str) -> bool:
        return rbac.has_permission(self.permissions, code)

    def require_tenant(self) -> uuid.UUID:
        """Return the effective tenant_id or raise — handlers that always need a
        concrete tenant (e.g. creating a user) call this."""
        if self.tenant_id is None:
            raise ValueError(
                "No tenant in context. A SUPER_ADMIN must select a tenant "
                "(send the X-Tenant-Id header) for this operation."
            )
        return self.tenant_id


class CrossTenantError(Exception):
    """Raised when a caller tries to act in a tenant other than their own."""


def resolve_effective_tenant(
    *,
    is_super_admin: bool,
    home_tenant_id: Optional[uuid.UUID],
    requested_tenant_id: Optional[uuid.UUID],
) -> Optional[uuid.UUID]:
    """Compute which tenant the request operates on, enforcing isolation.

    Raises ``CrossTenantError`` if a non-super-admin requests a different tenant.
    """
    if is_super_admin:
        # May switch into any tenant, or stay platform-wide (None).
        return requested_tenant_id

    if requested_tenant_id is not None and requested_tenant_id != home_tenant_id:
        raise CrossTenantError("Cross-tenant access is not permitted")

    return home_tenant_id
