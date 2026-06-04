"""Response schemas for the /auth endpoints (token + introspection)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.schemas.users.user_schema import UserRead


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
