"""Microsoft Active Directory authentication over LDAP.

Flow
----
1. The user submits username + password to ``POST /auth/login``.
2. We verify the password by performing an LDAP *bind*:
     * **search-then-bind** (recommended) — bind with a read-only service
       account, search for the user, then re-bind as the user's DN with the
       supplied password. This is the default whenever ``LDAP_BIND_DN`` is set.
     * **direct-bind** — bind straight away with exactly what the user typed
       (a full UPN ``user@domain`` or ``DOMAIN\\user``). Used when no service
       account is configured. No domain is ever assumed or appended.
3. Once the bind succeeds we read the user's directory attributes + group
   memberships and map AD groups to application roles.

No password is ever stored — LDAP is the sole source of truth for credentials.
The session token the API hands back is a JWT we sign ourselves (see
``app.auth.security``).
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from ldap3 import ALL, BASE, SIMPLE, SUBTREE, Connection, Server, ServerPool, Tls
from ldap3.core.exceptions import LDAPException
from ldap3.utils.conv import escape_filter_chars

from app.core.config import settings

logger = logging.getLogger(__name__)


class LDAPConfigError(Exception):
    """Raised when LDAP settings are missing/inconsistent (a deploy problem)."""


class LDAPAuthError(Exception):
    """Raised when authentication fails (bad credentials or directory error)."""


# --------------------------------------------------------------------------- #
#  Server / connection plumbing
# --------------------------------------------------------------------------- #
def _build_tls() -> Optional[Tls]:
    import ssl

    if not (settings.LDAP_TLS_VALIDATE or settings.LDAP_CA_CERTS_FILE):
        # Lab-only: accept any cert. NEVER do this in production.
        return Tls(validate=ssl.CERT_NONE)
    return Tls(
        validate=ssl.CERT_REQUIRED if settings.LDAP_TLS_VALIDATE else ssl.CERT_NONE,
        ca_certs_file=settings.LDAP_CA_CERTS_FILE,
    )


def _build_server_pool() -> ServerPool:
    if not settings.LDAP_SERVER_URIS:
        raise LDAPConfigError("LDAP_SERVER_URIS is not configured")

    tls = _build_tls()
    servers = []
    for uri in settings.LDAP_SERVER_URIS:
        use_ssl = uri.lower().startswith("ldaps://")
        servers.append(
            Server(
                uri,
                use_ssl=use_ssl,
                get_info=ALL,
                connect_timeout=settings.LDAP_CONNECT_TIMEOUT,
                tls=tls if use_ssl else None,
            )
        )
    # ROUND_ROBIN with failover across the configured DCs.
    return ServerPool(servers, pool_strategy="ROUND_ROBIN", active=True, exhaust=False)


def _connect(user: Optional[str], password: Optional[str]) -> Connection:
    """Open a bound connection. Raises LDAPAuthError if the bind fails."""
    server = _build_server_pool()
    try:
        conn = Connection(
            server,
            user=user,
            password=password,
            authentication=SIMPLE,
            auto_bind=False,
            raise_exceptions=False,
            receive_timeout=settings.LDAP_CONNECT_TIMEOUT,
        )
        # Plain ldap:// + StartTLS upgrades the channel before sending the password.
        if settings.LDAP_START_TLS and not str(server).lower().startswith("ldaps"):
            conn.open()
            if not conn.start_tls():
                raise LDAPAuthError("Could not establish StartTLS with the directory")
        if not conn.bind():
            raise LDAPAuthError(_describe_bind_failure(conn))
        return conn
    except LDAPException as e:  # network/protocol failure
        logger.warning("LDAP connection error: %s", e)
        raise LDAPAuthError("Unable to reach the directory server") from e


def _describe_bind_failure(conn: Connection) -> str:
    result = conn.result or {}
    # AD returns data 52e for "invalid credentials" — surface a generic message.
    desc = (result.get("description") or "").lower()
    if "invalidcredentials" in desc:
        return "Invalid username or password"
    return "Authentication failed"


# --------------------------------------------------------------------------- #
#  Public API
# --------------------------------------------------------------------------- #
def authenticate(username: str, password: str) -> Dict[str, Any]:
    """Verify credentials against AD and return a normalized user profile.

    Raises ``LDAPAuthError`` on bad credentials or directory problems.
    """
    username = (username or "").strip()
    if not username or not password:
        # An empty password would otherwise trigger an "unauthenticated bind"
        # that LDAP servers may accept — reject it up front.
        raise LDAPAuthError("Username and password are required")

    if settings.LDAP_BIND_DN:
        entry = _search_then_bind(username, password)
    else:
        # Direct-bind: the user must supply a fully-qualified identity so the app
        # never has to assume a domain. Accept a UPN (user@domain) or DOMAIN\user.
        if "@" not in username and "\\" not in username:
            raise LDAPAuthError(
                "Enter your full username including domain, e.g. user@domain.com"
            )
        entry = _direct_bind(username, password)

    return _build_profile(entry)


def _search_then_bind(username: str, password: str) -> Dict[str, Any]:
    """Service-account search for the user, then bind as that user to verify."""
    svc = _connect(settings.LDAP_BIND_DN, settings.LDAP_BIND_PASSWORD)
    try:
        entry = _find_user(svc, username)
        if entry is None:
            # Same generic error as a wrong password — don't leak which usernames exist.
            raise LDAPAuthError("Invalid username or password")
        user_dn = entry["dn"]
    finally:
        svc.unbind()

    # Verify the password by binding as the user we just located.
    user_conn = _connect(user_dn, password)
    user_conn.unbind()
    return entry


def _direct_bind(username: str, password: str) -> Dict[str, Any]:
    """Bind directly as the end user (no service account), then read attributes.

    We bind with exactly what the user typed (a full UPN like user@domain, or
    DOMAIN\\user). No domain is ever assumed or appended by the app.
    """
    conn = _connect(username, password)
    try:
        entry = _find_user(conn, username)
        if entry is None:
            # Bind succeeded but we couldn't read the entry — fall back to a
            # minimal profile derived from what the user typed.
            entry = {
                "dn": username,
                "attrs": {settings.LDAP_ATTR_USERNAME: username, settings.LDAP_ATTR_UPN: username},
                "groups": [],
            }
        return entry
    finally:
        conn.unbind()


def _default_naming_context(conn: Connection) -> str:
    """Ask the directory for its base DN via the RootDSE.

    This is the authoritative search base and works even when the user's UPN
    suffix differs from the AD DNS/DN name (e.g. UPN @nordicpoc.com but the
    directory root is DC=nordicpoc,DC=local). Returns "" if unavailable.
    """
    # ldap3 with get_info=ALL pre-reads the RootDSE into server.info.
    info = getattr(conn.server, "info", None)
    if info is not None:
        other = getattr(info, "other", {}) or {}
        for key in ("defaultNamingContext", "defaultnamingcontext"):
            val = other.get(key)
            if val:
                return val[0] if isinstance(val, (list, tuple)) else str(val)

    # Fallback: read the RootDSE explicitly.
    try:
        if conn.search("", "(objectClass=*)", search_scope=BASE,
                       attributes=["defaultNamingContext"]) and conn.entries:
            val = conn.entries[0]["defaultNamingContext"].value
            if val:
                return val
    except LDAPException:
        pass
    return ""


def _derive_base_from_upn(username: str) -> str:
    """Last-resort search base derived from a UPN's domain.

    e.g.  jdoe@corp.local  ->  DC=corp,DC=local
    Note: this is only correct when the UPN suffix matches the AD DN, which is
    NOT always the case — prefer the RootDSE defaultNamingContext.
    Returns "" if the username has no @domain part.
    """
    if "@" not in username:
        return ""
    domain = username.split("@", 1)[1]
    return ",".join(f"DC={part}" for part in domain.split(".") if part)


def _find_user(conn: Connection, username: str) -> Optional[Dict[str, Any]]:
    """Search the directory for the user and return dn/attrs/groups.

    Works whether the user typed a bare name, a UPN (user@domain) or DOMAIN\\user:
      * sAMAccountName never contains the domain, so we match it against the
        *bare* part of whatever was typed.
      * We also OR-in a userPrincipalName match against the full string, so a
        typed UPN resolves directly.
      * If no search base is configured, we ask the directory for its real base
        DN (RootDSE defaultNamingContext), falling back to a UPN-derived guess.
    """
    base = (
        settings.LDAP_USER_SEARCH_BASE
        or _default_naming_context(conn)
        or _derive_base_from_upn(username)
    )
    if not base:
        return None

    if "@" in username:
        bare = username.split("@", 1)[0]
    elif "\\" in username:
        bare = username.split("\\", 1)[1]
    else:
        bare = username

    safe_bare = escape_filter_chars(bare)
    safe_full = escape_filter_chars(username)
    # Configured filter (default: sAMAccountName) matched against the bare name,
    # OR a userPrincipalName match against the full typed value.
    configured = settings.LDAP_USER_SEARCH_FILTER.format(username=safe_bare)
    search_filter = f"(|{configured}({settings.LDAP_ATTR_UPN}={safe_full}))"

    attributes = [
        settings.LDAP_ATTR_GUID,
        settings.LDAP_ATTR_USERNAME,
        settings.LDAP_ATTR_UPN,
        settings.LDAP_ATTR_EMAIL,
        settings.LDAP_ATTR_DISPLAY_NAME,
        settings.LDAP_ATTR_GIVEN_NAME,
        settings.LDAP_ATTR_SURNAME,
        settings.LDAP_ATTR_MEMBER_OF,
    ]
    ok = conn.search(
        search_base=base,
        search_filter=search_filter,
        search_scope=SUBTREE,
        attributes=attributes,
    )
    if not ok or not conn.entries:
        return None

    entry = conn.entries[0]
    attrs = entry.entry_attributes_as_dict
    return {
        "dn": entry.entry_dn,
        "attrs": attrs,
        "groups": _as_list(attrs.get(settings.LDAP_ATTR_MEMBER_OF)),
    }


# --------------------------------------------------------------------------- #
#  Profile + role mapping
# --------------------------------------------------------------------------- #
def _build_profile(entry: Dict[str, Any]) -> Dict[str, Any]:
    attrs = entry.get("attrs", {})
    groups = entry.get("groups", [])

    username = _first(attrs.get(settings.LDAP_ATTR_USERNAME))
    upn = _first(attrs.get(settings.LDAP_ATTR_UPN))
    directory_id = _coerce_guid(attrs.get(settings.LDAP_ATTR_GUID)) or upn or username

    if not directory_id:
        raise LDAPAuthError("Directory entry is missing a stable identifier")

    return {
        "directory_id": directory_id,
        "username": username,
        "upn": upn,
        "email": _first(attrs.get(settings.LDAP_ATTR_EMAIL)) or upn,
        "name": _first(attrs.get(settings.LDAP_ATTR_DISPLAY_NAME)),
        "given_name": _first(attrs.get(settings.LDAP_ATTR_GIVEN_NAME)),
        "family_name": _first(attrs.get(settings.LDAP_ATTR_SURNAME)),
        "groups": groups,
        "roles": map_roles(groups),
    }


def map_roles(group_dns: List[str]) -> List[str]:
    """Translate AD group memberships into application roles.

    Matches each configured mapping key against either the full group DN or its
    CN (the first RDN), case-insensitively. Falls back to ``LDAP_DEFAULT_ROLE``.
    """
    mappings = {k.lower(): v for k, v in (settings.LDAP_ROLE_MAPPINGS or {}).items()}
    roles: List[str] = []

    for dn in group_dns or []:
        candidates = {dn.lower(), _cn_of(dn).lower()}
        for key, role in mappings.items():
            if key in candidates and role not in roles:
                roles.append(role)

    if not roles:
        roles = [settings.LDAP_DEFAULT_ROLE]
    return roles


# --------------------------------------------------------------------------- #
#  Small helpers
# --------------------------------------------------------------------------- #
def _as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value]
    return [str(value)]


def _first(value: Any) -> Optional[str]:
    items = _as_list(value)
    return items[0] if items else None


def _cn_of(dn: str) -> str:
    """Return the CN component of a DN, e.g. 'CN=Admins,OU=..' -> 'Admins'."""
    first = dn.split(",", 1)[0]
    return first.split("=", 1)[1] if "=" in first else first


def _coerce_guid(value: Any) -> Optional[str]:
    """Normalize objectGUID (bytes or str) into a canonical UUID string."""
    raw = value[0] if isinstance(value, (list, tuple)) and value else value
    if raw is None:
        return None
    if isinstance(raw, bytes):
        try:
            return str(uuid.UUID(bytes_le=raw))
        except (ValueError, TypeError):
            return raw.hex()
    return str(raw).strip("{}")
