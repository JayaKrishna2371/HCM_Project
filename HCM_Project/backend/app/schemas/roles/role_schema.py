"""Schemas for roles & permissions (Administration module)."""
from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


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
