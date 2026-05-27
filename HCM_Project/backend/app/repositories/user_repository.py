"""Data access for User rows. No business logic — just persistence."""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_directory_id(db: Session, directory_id: str) -> Optional[User]:
    return db.scalar(select(User).where(User.directory_id == directory_id))


def get_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> Optional[User]:
    if not username:
        return None
    return db.scalar(select(User).where(func.lower(User.username) == username.lower()))


def list_by_scope(db: Session, tenant_id: Optional[uuid.UUID], is_super_admin: bool) -> List[User]:
    stmt = select(User)
    if not (is_super_admin and tenant_id is None):
        stmt = stmt.where(User.tenant_id == tenant_id)
    return list(db.scalars(stmt.order_by(User.username)).all())


def add(db: Session, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def save(db: Session, user: User) -> User:
    db.commit()
    db.refresh(user)
    return user


def delete(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
