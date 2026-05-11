"""Schemas surfaced on /auth endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class TokenIntrospectionResponse(BaseModel):
    valid: bool
    subject: Optional[str] = None
    audience: Optional[str] = None
    issuer: Optional[str] = None
    expires_at: Optional[int] = None
    roles: List[str] = []
    claims: Dict[str, Any] = {}
