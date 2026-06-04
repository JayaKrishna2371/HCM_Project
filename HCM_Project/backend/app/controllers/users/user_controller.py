"""User endpoints — profile + RBAC-protected sample routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.login.deps import get_current_user, require_roles
from app.models.users.user_model import User
from app.schemas.users.user_schema import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead, summary="Current user's profile")
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get(
    "/admin-only",
    summary="Sample RBAC route — Admin only",
    dependencies=[Depends(require_roles("Admin"))],
)
def admin_only() -> dict:
    return {"message": "Welcome, Admin. You can see this because RBAC matched."}


@router.get(
    "/operator-or-admin",
    summary="Sample RBAC route — Operator or Admin",
    dependencies=[Depends(require_roles("Admin", "Operator"))],
)
def operator_or_admin() -> dict:
    return {"message": "Cloud operator tooling here."}
