"""Schemas for the /auth endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=256)
    password: str = Field(..., min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until the access token expires
    user: UserRead


class TokenIntrospectionResponse(BaseModel):
    valid: bool
    subject: Optional[str] = None
    audience: Optional[str] = None
    issuer: Optional[str] = None
    expires_at: Optional[int] = None
    roles: List[str] = []
    claims: Dict[str, Any] = {}
