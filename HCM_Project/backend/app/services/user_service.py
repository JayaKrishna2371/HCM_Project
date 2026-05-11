"""User-related persistence logic."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_azure_oid(db: Session, azure_oid: str) -> Optional[User]:
    return db.scalar(select(User).where(User.azure_oid == azure_oid))


def upsert_from_claims(db: Session, profile: Dict[str, Any]) -> User:
    """Insert or update the local user row from Azure AD claims."""
    azure_oid = profile["azure_oid"]
    user = get_user_by_azure_oid(db, azure_oid)
    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            azure_oid=azure_oid,
            tenant_id=profile.get("tenant_id"),
            email=profile.get("email"),
            name=profile.get("name"),
            given_name=profile.get("given_name"),
            family_name=profile.get("family_name"),
            roles=profile.get("roles") or ["Viewer"],
            last_login_at=now,
        )
        db.add(user)
    else:
        user.tenant_id = profile.get("tenant_id") or user.tenant_id
        user.email = profile.get("email") or user.email
        user.name = profile.get("name") or user.name
        user.given_name = profile.get("given_name") or user.given_name
        user.family_name = profile.get("family_name") or user.family_name
        user.roles = profile.get("roles") or user.roles
        user.last_login_at = now

    db.commit()
    db.refresh(user)
    return user
