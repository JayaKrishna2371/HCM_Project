# Hybrid Cloud Management (HCM) Platform — Phase 1

**Phase 1 scope:** Enterprise Authentication & Login Module using **Microsoft
Active Directory over LDAP**, backend-issued JWT sessions, RBAC, and protected
routes. Local-only execution (no Docker / K8s / cloud infra in this phase).

```
HCM_Project/
├── frontend/   # Angular 17 (standalone) — username/password login form
├── backend/    # FastAPI — LDAP bind to AD + JWT issuance + PostgreSQL
└── README.md   # This file (master setup guide)
```

> **Auth model in one line:** the user types their AD username + password →
> FastAPI binds to a Domain Controller over LDAP to verify it → on success the
> backend issues its own signed JWT, which the SPA sends as a bearer token.
>
> 👉 **The exact LDAP config (and what to ask your team lead for) is in
> [`backend/LDAP_SETUP.md`](./backend/LDAP_SETUP.md).**

## Tech versions used

| Layer        | Tech                      | Version  |
|--------------|---------------------------|----------|
| Frontend     | Angular                   | 17.x     |
| Backend      | Python                    | 3.11+    |
| Backend      | FastAPI                   | 0.136+   |
| Backend      | uvicorn                   | 0.46+    |
| Backend Auth | ldap3 (LDAP client)       | 2.9.1    |
| Backend Auth | python-jose[cryptography] | 3.5+     |
| Backend ORM  | SQLAlchemy                | 2.0+     |
| DB Driver    | psycopg[binary]           | 3.3+     |
| Database     | PostgreSQL                | 15+      |

---

## 0. Prerequisites (one time)

Install on Windows:

1. **Node.js LTS 20.x+** → https://nodejs.org/en/download
2. **Python 3.11 or 3.12** → https://www.python.org/downloads/ (tick *Add Python to PATH*)
3. **PostgreSQL 15+** → https://www.postgresql.org/download/windows/
4. **Git** → https://git-scm.com/download/win
5. **Angular CLI** globally: `npm install -g @angular/cli@17`

Verify: `node -v`, `python --version`, `ng version`, `psql --version`.

You also need **network access from this machine to a Microsoft AD Domain
Controller** (LDAPS 636 or LDAP/StartTLS 389), plus the connection/credentials
details — see step 1.

---

## 1. Active Directory / LDAP configuration

This is the part to coordinate with your team lead. The full checklist of values
to collect and where each goes lives in **[`backend/LDAP_SETUP.md`](./backend/LDAP_SETUP.md)**.
In short you need:

- the **LDAPS URL** of the domain controller(s) (and a CA cert if it's internal),
- either a **read-only service account** (DN + password) + the **user search base
  OU** (recommended), **or** the **UPN domain suffix** for direct bind,
- the **AD security groups** that map to the app's **Admin / Operator / Viewer** roles,
- a **test user** to validate with.

These go into `backend/.env` (`LDAP_*` keys). Nothing identity-provider-specific
needs configuring in the Angular app.

---

## 2. PostgreSQL setup (local)

```sql
CREATE DATABASE hcm_db;
CREATE USER hcm_user WITH PASSWORD 'hcm_pass';
GRANT ALL PRIVILEGES ON DATABASE hcm_db TO hcm_user;
\c hcm_db
GRANT ALL ON SCHEMA public TO hcm_user;
```

> The backend auto-creates the `users` table on first start. This table is keyed
> on `directory_id` (AD objectGUID). If you are migrating from the old Azure-AD
> build, start from a fresh DB or drop the old `users` table first.

---

## 3. Backend — FastAPI

```powershell
cd backend

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

copy .env.example .env
notepad .env       # fill in the LDAP_* values + JWT_SECRET_KEY + DATABASE_URL

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Backend: <http://localhost:8000>  ·  Swagger: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/v1/health>

Generate a JWT signing secret with:
`python -c "import secrets; print(secrets.token_hex(32))"`

> If PowerShell blocks `Activate.ps1`, run once:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## 4. Frontend — Angular 17

```powershell
cd frontend
npm install
npm start
```

Frontend runs at <http://localhost:4200>. No auth config needed in the SPA —
just point `apiBaseUrl` at the backend (default `http://localhost:8000/api/v1`
in `src/environments/environment.development.ts`).

---

## 5. End-to-end test flow

1. Backend on :8000, frontend on :4200.
2. Open <http://localhost:4200> — you'll see the **Hybrid Cloud Portal** login page.
3. Enter your **AD username + password** and click **Sign In**.
4. The backend binds to AD over LDAP; on success you land on **/dashboard** showing
   your name and roles (derived from your AD group membership).
5. DevTools → Network → `POST /api/v1/auth/login` returns `200` with an
   `access_token`; subsequent calls like `GET /api/v1/users/me` send it as a
   `Bearer` token and return `200`.
6. Click **Logout** → token cleared, back to `/login`.

CLI smoke test (no UI):
```powershell
curl -X POST http://localhost:8000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"username\":\"testuser\",\"password\":\"...\"}"
```

---

## 6. Architecture & flow

### High-level
```
+------------------+          +------------------+         +----------------------+
|  Angular 17 SPA  | <------> |  FastAPI Backend | <-----> |   PostgreSQL (local) |
|  (login form +   |  bearer  |  (LDAP bind +    |         |    users table       |
|   bearer token)  |   JWT    |   JWT issuer)    |         |  (keyed on objectGUID)|
+--------+---------+          +--------+---------+         +----------------------+
                                       |
                                       |  LDAP bind / search (LDAPS 636)
                                       v
                             +---------------------------+
                             |  Microsoft Active Directory|
                             |     (Domain Controllers)   |
                             +---------------------------+
```

### Sequence — login
```
User    -> Angular : enter AD username + password, click Sign In
Angular -> FastAPI : POST /api/v1/auth/login { username, password }
FastAPI -> AD (LDAP): bind to verify password (search-then-bind or direct bind)
FastAPI -> AD (LDAP): read attributes + memberOf (group DNs)
FastAPI -> FastAPI : map AD groups -> roles, upsert local user row
FastAPI -> FastAPI : sign a JWT (HS256) with sub=objectGUID, roles=[...]
FastAPI -> Angular : 200 { access_token, expires_in, user }
Angular -> Router  : store token, navigate to /dashboard
Angular -> FastAPI : GET /api/v1/users/me  (Authorization: Bearer <JWT>)
FastAPI -> FastAPI : validate JWT signature, iss, aud, exp -> 200 profile
```

### Token lifecycle
- Access token TTL: `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60 min). No refresh
  token — the user signs in again on expiry.
- Idle session timeout enforced client-side at **30 min** by `SessionService`
  (configurable in `environment.ts`).
- On hard refresh the SPA re-hydrates the session from `localStorage`/
  `sessionStorage` ("Keep me signed in" chooses which).

---

## 7. Common LDAP issues & fixes

| Symptom                                                  | Cause / Fix                                                                                  |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------|
| Login returns `401 Invalid username or password`         | Wrong creds, **or** the search filter / search base doesn't match the user. Check `LDAP_USER_SEARCH_BASE` and `LDAP_USER_SEARCH_FILTER`. |
| Login returns `401 Unable to reach the directory server` | DC unreachable: wrong `LDAP_SERVER_URIS`, port blocked by firewall, or DNS can't resolve the DC. |
| TLS / certificate errors on connect                      | DC uses an internal CA — set `LDAP_CA_CERTS_FILE` to the CA bundle. (Lab-only: `LDAP_TLS_VALIDATE=false`.) |
| Login returns `503`                                      | LDAP settings missing/invalid in `.env` (e.g. empty `LDAP_SERVER_URIS`).                     |
| User logs in but always gets **Viewer**                  | Their AD groups don't match `LDAP_ROLE_MAPPINGS`, or groups are **nested** (see LDAP_SETUP.md). |
| `401 Invalid token` on API calls                         | `JWT_SECRET_KEY` changed/mismatched, or the token expired — sign in again.                   |
| CORS error on `/api/v1/...`                              | Frontend origin must be in `BACKEND_CORS_ORIGINS` (defaults to `http://localhost:4200`).     |

---

## 8. Folder structure (auth-relevant parts)

```
backend/app/
├── core/
│   ├── ldap_auth.py    # LDAP bind, user search, group->role mapping
│   ├── security.py     # JWT issue/verify + secure headers
│   └── config.py       # LDAP_* and JWT_* settings
├── dependencies/auth.py# get_current_user (validates our JWT) + require_roles
├── api/v1/endpoints/auth.py  # POST /auth/login (LDAP -> JWT), logout, introspect
├── models/user.py      # users table keyed on directory_id (objectGUID)
├── schemas/            # LoginRequest, TokenResponse, UserRead
└── services/user_service.py  # upsert_from_ldap

frontend/src/app/
├── core/
│   ├── services/auth.service.ts     # login()/logout(), bearer-token storage
│   ├── interceptors/auth.interceptor.ts  # attaches Bearer token
│   ├── guards/{auth,role}.guard.ts
│   └── models/user.model.ts
└── features/login/login.component.* # username/password form
```

> Configuration & "what to collect from your team lead": **[`backend/LDAP_SETUP.md`](./backend/LDAP_SETUP.md)**.
