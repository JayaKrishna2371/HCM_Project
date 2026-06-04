"""Pydantic schemas for User."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    directory_id: str
    username: Optional[str] = None
    upn: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    roles: List[str] = []


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Multi-tenancy: which tenant the user belongs to (NULL for SUPER_ADMIN).
    tenant_id: Optional[uuid.UUID] = None
    # Credential source: "ldap" or "local" (never exposes the password hash).
    auth_type: str = "ldap"
    status: str = "ACTIVE"
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
