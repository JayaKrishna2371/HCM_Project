"""FastAPI auth dependencies.

``get_current_user`` enforces a valid session JWT (issued by this API after a
successful LDAP bind) on any endpoint, loads the local user row, and returns the
ORM instance.

``require_roles(*roles)`` is a dependency factory for RBAC-protected endpoints.
"""
from __future__ import annotations

from typing import Callable, List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.login.security import TokenError, decode_access_token
from app.db.session.session import get_db
from app.models.users.user_model import User
from app.services.users import user_service

# auto_error=False so we can raise a uniform 401 for both missing and invalid tokens.
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
        claims = decode_access_token(creds.credentials)
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    directory_id = claims.get("sub")
    if not directory_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    user = user_service.get_user_by_directory_id(db, directory_id)
    if user is None:
        # Token is validly signed but the user no longer exists locally.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found — please sign in again",
        )
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
