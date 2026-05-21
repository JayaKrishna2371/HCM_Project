# Active Directory (LDAP) Login — Setup & Config Checklist

This backend authenticates users against **Microsoft Active Directory over LDAP**.
The flow is:

1. The Angular app posts `username` + `password` to `POST /api/v1/auth/login`.
2. The backend **binds** to a Domain Controller to verify the password
   (search-then-bind by default, see below).
3. On success it reads the user's directory attributes + group memberships,
   maps AD groups → app roles, and **issues its own signed JWT**.
4. The SPA stores that JWT and sends it as `Authorization: Bearer <token>` on
   every later call. The backend validates the JWT — it never sees the password
   again.

All configuration lives in `backend/.env` (copy from `.env.example`).

---

## ✅ What to collect from your team lead

Ask for the following. The **bold** items are the ones the app cannot work
without; the rest have sensible AD defaults.

### 1. Domain Controller / connection
| Need | `.env` key | Example | Notes |
|------|------------|---------|-------|
| **LDAP server host(s) + port** | `LDAP_SERVER_URIS` | `ldaps://dc1.corp.example.com:636` | Prefer **LDAPS (636)**. List multiple DCs comma-separated for failover. |
| Use StartTLS on port 389? | `LDAP_START_TLS` | `false` | Only if they hand you `ldap://...:389` and require StartTLS instead of LDAPS. |
| Validate the DC's TLS cert? | `LDAP_TLS_VALIDATE` | `true` | Keep `true` in any real environment. |
| CA certificate (PEM) that signed the DC cert | `LDAP_CA_CERTS_FILE` | `/path/corp-ca.pem` | Needed if the DC uses an internal/private CA. Ask for the CA bundle file. |

### 2. How the app should find & verify a user — pick ONE mode

**Mode A — Search-then-bind (recommended).** Ask for a **read-only service
account** the app binds with to look users up:
| Need | `.env` key | Example |
|------|------------|---------|
| **Service account DN** | `LDAP_BIND_DN` | `CN=svc-hcm,OU=Service Accounts,DC=corp,DC=example,DC=com` |
| **Service account password** | `LDAP_BIND_PASSWORD` | `••••••••` |
| **Base DN to search for users** | `LDAP_USER_SEARCH_BASE` | `OU=Users,DC=corp,DC=example,DC=com` |
| Login attribute / search filter | `LDAP_USER_SEARCH_FILTER` | `(sAMAccountName={username})` |

**Mode B — Direct bind (no service account).** Leave `LDAP_BIND_DN` empty. The
app binds as the end user directly. Ask for:
| Need | `.env` key | Example |
|------|------------|---------|
| **AD UPN domain suffix** | `LDAP_DEFAULT_DOMAIN` | `corp.example.com` (so `jdoe` → `jdoe@corp.example.com`) |
| Base DN to read attributes | `LDAP_USER_SEARCH_BASE` | `DC=corp,DC=example,DC=com` |

> Tip: To let people log in with **username, UPN, or email**, ask for this filter:
> `(&(objectClass=user)(|(sAMAccountName={username})(userPrincipalName={username})(mail={username})))`

### 3. Roles — AD groups → app roles
The app has three roles: **Admin**, **Operator**, **Viewer**. Ask which AD
security groups correspond to each, then set the mapping:
| Need | `.env` key | Example |
|------|------------|---------|
| **Group → role map** (CN or full DN) | `LDAP_ROLE_MAPPINGS` | `{"HCM-Admins":"Admin","HCM-Operators":"Operator","HCM-Viewers":"Viewer"}` |
| Role if no group matches | `LDAP_DEFAULT_ROLE` | `Viewer` |

Also confirm: should roles come from **direct** group membership only, or
**nested** groups too? (See "Nested groups" below.)

### 4. Attribute names (only if their schema is non-standard)
Defaults already match Microsoft AD: `objectGUID`, `sAMAccountName`,
`userPrincipalName`, `mail`, `displayName`, `givenName`, `sn`, `memberOf`.
Override via `LDAP_ATTR_*` only if their directory differs.

### 5. A test account
Ask for **one non-privileged test user** (username + password) and which group
it's in, so you can verify login + role mapping end-to-end.

### 6. Network/firewall
Confirm the lab host running this backend can reach the DC on **636 (LDAPS)**
or **389 (LDAP/StartTLS)**. Ask them to open it if not.

---

## 🔑 One thing you set yourself (not from the team lead)
`JWT_SECRET_KEY` — the secret this API uses to sign session tokens. Generate a
fresh one per environment:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

(A development value is already filled into `.env`; replace it for anything real.)

---

## Quick copy-paste questions for your team lead

> 1. What's the LDAPS URL of the domain controller(s) I should point at
>    (host + port), and is the cert from a public or internal CA? If internal,
>    can you send me the CA bundle (.pem)?
> 2. Can I get a **read-only service account** (DN + password) for user lookups,
>    and the **base DN (OU)** where user accounts live? If not, what's our **UPN
>    domain suffix** so I can bind users directly?
> 3. Which **login attribute** do people use — `sAMAccountName`, UPN, or email?
> 4. Which **AD security groups** map to Admin / Operator / Viewer in this app,
>    and should membership be **direct only or nested**?
> 5. Can I get **one test user** (and its group) to validate the integration?
> 6. Is the firewall open from this lab box to the DC on 636/389?

---

## Verifying once configured

```bash
# 1. Backend
cd backend
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Try a login (replace creds with the test account)
curl -s -X POST http://localhost:8000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"testuser\",\"password\":\"...\"}"
#   200 + {access_token,...}  -> LDAP bind worked
#   401 "Invalid username or password" -> bind reached AD but creds/filter wrong
#   401 "Unable to reach the directory server" -> network/URL/TLS problem
#   503 -> LDAP settings missing/misconfigured in .env

# 3. Use the returned token
curl -s http://localhost:8000/api/v1/users/me -H "Authorization: Bearer <token>"
```

Interactive API docs: <http://localhost:8000/docs>

---

## Notes & decisions

- **Empty password** is rejected before any bind (an empty password can trigger
  an "unauthenticated bind" that some servers accept).
- **Generic errors**: a missing user and a wrong password both return
  *"Invalid username or password"* so we don't reveal which usernames exist.
- **Nested groups**: AD's `memberOf` lists *direct* groups only. If the team
  uses nested security groups, the search filter for membership needs AD's
  `LDAP_MATCHING_RULE_IN_CHAIN` OID (`1.2.840.113556.1.4.1941`). Tell me if you
  need this and I'll switch role resolution to a recursive lookup.
- **Token lifetime** is `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60). There is no
  refresh token; the user signs in again after expiry (and the SPA also has a
  30-minute idle timeout).
- **Token storage in the browser** is `localStorage`/`sessionStorage` (bearer
  token). If your security review requires XSS-hardening, we can move to an
  httpOnly cookie session — that needs CORS-with-credentials + CSRF handling.
