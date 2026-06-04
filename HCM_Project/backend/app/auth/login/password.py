"""Local-account password hashing/verification (bcrypt).

This backs the *local* authentication path. LDAP users never have a password
stored here — Active Directory remains the sole source of truth for their
credentials (see ``app.auth.login.ldap_auth``). Only users created with
``auth_type='local'`` carry a ``hashed_password``.

We use the ``bcrypt`` library directly rather than passlib: passlib 1.7.x is
unmaintained and incompatible with bcrypt 4.1+.
"""
from __future__ import annotations

from typing import Optional

import bcrypt

# bcrypt only considers the first 72 bytes of a password; longer inputs must be
# truncated consistently for hash and verify to agree.
_MAX_BCRYPT_BYTES = 72


def _encode(plain: str) -> bytes:
    return plain.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def hash_password(plain: str) -> str:
    """Return a bcrypt hash for a plaintext password."""
    return bcrypt.hashpw(_encode(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: Optional[str]) -> bool:
    """Check a plaintext password against a stored hash.

    Returns ``False`` (never raises) for an empty/malformed hash so callers can
    treat any failure uniformly as "wrong credentials".
    """
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
