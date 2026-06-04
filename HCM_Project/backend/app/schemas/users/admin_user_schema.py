"""Schemas for admin-managed users (Administration module)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    # Provide a password to create a LOCAL account (bcrypt, authenticated against
    # the DB). Omit it to create an LDAP shadow account (the default), whose
    # password is verified against Active Directory.
    password: Optional[str] = Field(None, min_length=8, max_length=256)


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
    # "ldap" or "local" — never includes the password hash itself.
    auth_type: str = "ldap"
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
