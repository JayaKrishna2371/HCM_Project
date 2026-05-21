"""User ORM model — local mirror of Active Directory identities."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Stable AD identifier — objectGUID (falls back to UPN/sAMAccountName).
    directory_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    # sAMAccountName — the login name; userPrincipalName is the full alice@corp.
    username: Mapped[Optional[str]] = mapped_column(String(256), index=True, nullable=True)
    upn: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)

    email: Mapped[Optional[str]] = mapped_column(String(320), index=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    given_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    family_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Roles derived from AD group membership at last login.
    roles: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
