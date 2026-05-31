"""Schemas for the Administration module — user & role management."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --------------------------------------------------------------------------- #
#  Admin-managed users
# --------------------------------------------------------------------------- #
class AdminUserCreate(BaseModel):
    """Create a user under a tenant.

    ``tenant_id`` is bound automatically from the caller's context (TENANT_ADMIN)
    or supplied explicitly by a SUPER_ADMIN; it is never trusted from a tenant
    admin's request body.
    """

    username: str = Field(..., min_length=1, max_length=256)
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, max_length=255)
    # directory_id ties the row to AD; defaults to username when not yet known.
    directory_id: Optional[str] = Field(None, max_length=128)
    roles: List[str] = Field(default_factory=list)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
    # SUPER_ADMIN only — target tenant. Ignored for TENANT_ADMIN.
    tenant_id: Optional[uuid.UUID] = None


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, max_length=255)
    roles: Optional[List[str]] = None
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: Optional[uuid.UUID] = None
    directory_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    roles: List[str] = []
    status: str
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------- #
#  Roles & permissions
# --------------------------------------------------------------------------- #
class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    description: Optional[str] = None


class RoleCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = Field(None, max_length=255)
    permissions: List[str] = Field(default_factory=list, description="Permission codes")
    # SUPER_ADMIN only: which tenant the custom role belongs to. Ignored for a
    # TENANT_ADMIN (bound to their own tenant).
    tenant_id: Optional[uuid.UUID] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=128)
    description: Optional[str] = Field(None, max_length=255)
    permissions: Optional[List[str]] = None


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: Optional[uuid.UUID] = None
    code: str
    name: str
    description: Optional[str] = None
    is_system: bool
    permissions: List[str] = Field(default_factory=list)

    @classmethod
    def from_role(cls, role) -> "RoleRead":
        return cls(
            id=role.id,
            tenant_id=role.tenant_id,
            code=role.code,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=role.permission_codes,
        )
