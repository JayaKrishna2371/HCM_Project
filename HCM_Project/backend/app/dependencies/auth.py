"""FastAPI auth dependencies.

`get_current_user` enforces a valid Azure AD access token on any endpoint,
upserts the local user row, and returns the ORM instance.

`require_roles(*roles)` is a dependency factory for RBAC-protected endpoints.
"""
from __future__ import annotations

from typing import Callable, List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.azure_ad import (
    AzureADValidationError,
    extract_user_profile,
    validate_access_token,
)
from app.db.session import get_db
from app.models.user import User
from app.services import user_service

# auto_error=True → returns 403 if no Authorization header at all.
# We override to raise 401 for both missing and invalid tokens so the SPA can react uniformly.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = validate_access_token(creds.credentials)
    except AzureADValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    profile = extract_user_profile(claims)
    if not profile.get("azure_oid"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required subject/oid claim",
        )

    user = user_service.upsert_from_claims(db, profile)
    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """Dependency factory enforcing RBAC. Usage:

        @router.get("/admin", dependencies=[Depends(require_roles("Admin"))])
    """
    allowed = {r.lower() for r in allowed_roles}

    def _checker(user: User = Depends(get_current_user)) -> User:
        user_roles: List[str] = [r.lower() for r in (user.roles or [])]
        if not allowed.intersection(user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {sorted(allowed_roles)}",
            )
        return user

    return _checker
