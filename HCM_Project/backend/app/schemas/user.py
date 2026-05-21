"""Pydantic schemas for User."""
from __future__ import annotations

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
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
