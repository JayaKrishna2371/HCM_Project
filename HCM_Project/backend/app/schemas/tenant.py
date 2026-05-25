"""Pydantic schemas for tenant (Business Unit) management."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.tenant import LoginType, TenantStatus


class TenantBase(BaseModel):
    tenant_code: str = Field(..., min_length=2, max_length=64)
    tenant_name: str = Field(..., min_length=2, max_length=255)
    login_type: LoginType = LoginType.PLATFORM_LDAP
    ldap_server_url: Optional[str] = Field(None, max_length=512)
    domain_name: Optional[str] = Field(None, max_length=255)
    dc_name: Optional[str] = Field(None, max_length=255)


class TenantCreate(TenantBase):
    @model_validator(mode="after")
    def _require_own_ldap_fields(self) -> "TenantCreate":
        if self.login_type == LoginType.OWN_LDAP and not (self.ldap_server_url and self.domain_name):
            raise ValueError(
                "ldap_server_url and domain_name are required when login_type is OWN_LDAP"
            )
        return self


class TenantUpdate(BaseModel):
    tenant_name: Optional[str] = Field(None, min_length=2, max_length=255)
    login_type: Optional[LoginType] = None
    ldap_server_url: Optional[str] = Field(None, max_length=512)
    domain_name: Optional[str] = Field(None, max_length=255)
    dc_name: Optional[str] = Field(None, max_length=255)
    status: Optional[TenantStatus] = None


class TenantRead(TenantBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: TenantStatus
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
