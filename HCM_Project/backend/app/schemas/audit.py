"""Schemas for audit log reads."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: Optional[uuid.UUID] = None
    actor_user_id: Optional[int] = None
    actor_username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    status: str
    ip_address: Optional[str] = None
    detail: Optional[Dict[str, Any]] = None
    created_at: datetime


class AuditLogPage(BaseModel):
    items: List[AuditLogRead]
    total: int
    limit: int
    offset: int
