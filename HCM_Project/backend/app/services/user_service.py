"""User-related persistence logic."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_directory_id(db: Session, directory_id: str) -> Optional[User]:
    return db.scalar(select(User).where(User.directory_id == directory_id))


def upsert_from_ldap(db: Session, profile: Dict[str, Any]) -> User:
    """Insert or update the local user row from an LDAP profile."""
    directory_id = profile["directory_id"]
    user = get_user_by_directory_id(db, directory_id)
    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            directory_id=directory_id,
            username=profile.get("username"),
            upn=profile.get("upn"),
            email=profile.get("email"),
            name=profile.get("name"),
            given_name=profile.get("given_name"),
            family_name=profile.get("family_name"),
            roles=profile.get("roles") or ["Viewer"],
            last_login_at=now,
        )
        db.add(user)
    else:
        user.username = profile.get("username") or user.username
        user.upn = profile.get("upn") or user.upn
        user.email = profile.get("email") or user.email
        user.name = profile.get("name") or user.name
        user.given_name = profile.get("given_name") or user.given_name
        user.family_name = profile.get("family_name") or user.family_name
        # Roles always refresh from the directory at login (single source of truth).
        user.roles = profile.get("roles") or user.roles
        user.last_login_at = now

    db.commit()
    db.refresh(user)
    return user
