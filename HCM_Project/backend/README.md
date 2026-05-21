# HCM Backend (FastAPI)

Authentication is against **Microsoft Active Directory over LDAP**. The backend
verifies credentials with an LDAP bind, then issues its own signed JWT that the
SPA carries as a bearer token. See **[LDAP_SETUP.md](./LDAP_SETUP.md)** for the
full config checklist (and what to ask your team lead for).

## Run locally

```powershell
cd backend

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

copy .env.example .env
# Edit .env: fill the LDAP_* values (from your team lead), set a JWT_SECRET_KEY,
# and set DATABASE_URL. See LDAP_SETUP.md.

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Swagger UI:  http://localhost:8000/docs
- Health:      http://localhost:8000/api/v1/health
- Login:       `POST http://localhost:8000/api/v1/auth/login` `{ "username": "...", "password": "..." }`
- Me:          http://localhost:8000/api/v1/users/me   *(requires Bearer)*

## Endpoints

| Method | Path                              | Auth      | Description                          |
|--------|-----------------------------------|-----------|--------------------------------------|
| GET    | `/api/v1/health`                  | public    | Liveness probe                       |
| POST   | `/api/v1/auth/login`              | public    | Verify AD creds (LDAP), return a JWT |
| POST   | `/api/v1/auth/logout`             | Bearer    | Stateless logout acknowledgement     |
| GET    | `/api/v1/auth/introspect`         | Bearer    | Decoded session-token claims         |
| GET    | `/api/v1/auth/me/roles`           | Bearer    | Current user's role list             |
| GET    | `/api/v1/users/me`                | Bearer    | Current user's profile               |
| GET    | `/api/v1/users/admin-only`        | Admin     | Sample RBAC route                    |
| GET    | `/api/v1/users/operator-or-admin` | Admin\|Operator | Sample RBAC route              |

## Auth flow

```
Angular login form ──POST /auth/login (username,password)──▶ FastAPI
                                                              │ LDAP bind to AD (verify password)
                                                              │ read attributes + memberOf
                                                              │ map AD groups ──▶ roles
                                                              ▼
Angular ◀──────── { access_token (JWT), user } ──────────────┘
   │
   └─ Authorization: Bearer <JWT> ─▶ protected endpoints (JWT validated locally)
```

## Database note

The `users` table mirrors AD identities and is keyed on `directory_id`
(objectGUID). Tables are auto-created on startup (`Base.metadata.create_all`).
This replaced the previous Azure-AD `azure_oid` schema — start from a fresh DB
(or drop the old `users` table) when migrating an existing environment.
