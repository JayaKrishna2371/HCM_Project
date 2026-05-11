"""User ORM model — local mirror of Azure AD identities."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Azure AD object id — globally unique per identity
    azure_oid: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    email: Mapped[Optional[str]] = mapped_column(String(320), index=True, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    given_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    family_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Snapshot of roles at last login; live roles are still re-read from the token.
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
