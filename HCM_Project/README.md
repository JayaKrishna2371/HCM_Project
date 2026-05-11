# Hybrid Cloud Management (HCM) Platform — Phase 1

**Phase 1 scope:** Enterprise Authentication & Login Module with Azure AD (Entra ID) SSO, JWT validation, RBAC, and protected routes. Local-only execution (no Docker / K8s / cloud infra in this phase).

```
HCM_Project/
├── frontend/   # Angular 17 (standalone) + MSAL Angular
├── backend/    # FastAPI + Azure AD JWT validation + PostgreSQL
└── README.md   # This file (master setup guide)
```

## Tech versions used

| Layer        | Tech              | Version           |
|--------------|-------------------|-------------------|
| Frontend     | Angular           | 17.x              |
| Frontend Auth| @azure/msal-angular | 3.x             |
| Frontend Auth| @azure/msal-browser | 3.x             |
| Backend      | Python            | 3.11+             |
| Backend      | FastAPI           | 0.110+            |
| Backend      | uvicorn           | 0.29+             |
| Backend Auth | python-jose[cryptography] | 3.3+      |
| Backend ORM  | SQLAlchemy        | 2.0+              |
| DB Driver    | psycopg[binary]   | 3.1+              |
| Database     | PostgreSQL        | 15+               |

---

## 0. Prerequisites (one time)

Install on Windows:

1. **Node.js LTS 20.x** → https://nodejs.org/en/download
2. **Python 3.11 or 3.12** → https://www.python.org/downloads/ (tick *Add Python to PATH*)
3. **PostgreSQL 15+** → https://www.postgresql.org/download/windows/ (remember the `postgres` password you set during install)
4. **Git** → https://git-scm.com/download/win
5. **Angular CLI** globally:
   ```powershell
   npm install -g @angular/cli@17
   ```

Verify:
```powershell
node -v          # v20.x
npm -v           # 10.x
python --version # 3.11.x or 3.12.x
ng version       # Angular CLI 17.x
psql --version   # 15+
```

---

## 1. Azure AD (Entra ID) App Registration — step by step

> You need an Azure AD tenant. A free **personal Microsoft 365 Developer tenant** works: https://developer.microsoft.com/microsoft-365/dev-program

### 1.1 Create the app registration

1. Go to **Azure Portal → Microsoft Entra ID → App registrations → + New registration**.
2. Fill in:
   - **Name:** `HCM-Platform-Local`
   - **Supported account types:** *Accounts in this organizational directory only (Single tenant)*
   - **Redirect URI:** select **Single-page application (SPA)** and enter:
     ```
     http://localhost:4200
     ```
3. Click **Register**.

### 1.2 Copy these three values (you'll paste them into env files)

On the **Overview** tab:
- **Application (client) ID** → this is `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → this is `AZURE_TENANT_ID`

### 1.3 Add a second redirect URI for the backend Swagger UI (optional but useful)

**Authentication** blade →
- Under **Single-page application**, click **Add URI** and add:
  ```
  http://localhost:4200/auth-callback
  ```
- Under **Implicit grant and hybrid flows**, leave **everything UNCHECKED** (we use Auth Code + PKCE, not implicit).
- **Allow public client flows:** No.
- Save.

### 1.4 Expose an API (so the backend can validate access tokens)

**Expose an API** blade →
1. Click **Add** next to *Application ID URI*. Accept the default `api://<client-id>` → **Save**.
2. Click **+ Add a scope**:
   - **Scope name:** `access_as_user`
   - **Who can consent:** *Admins and users*
   - **Admin consent display name:** `Access HCM API as user`
   - **Admin consent description:** `Allows the app to access HCM API on behalf of the signed-in user.`
   - **State:** Enabled
   - **Add scope**

   Full scope value becomes: `api://<client-id>/access_as_user`

### 1.5 API permissions

**API permissions** blade →
1. **+ Add a permission → Microsoft Graph → Delegated permissions**:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
2. **+ Add a permission → My APIs → HCM-Platform-Local → Delegated permissions**:
   - `access_as_user`
3. Click **Grant admin consent for <your tenant>** (top button).

### 1.6 Token configuration (optional, recommended for roles)

**Token configuration** blade →
- **+ Add optional claim → Access token →** check `email`, `family_name`, `given_name` → Add.
- **+ Add optional claim → ID token →** check `email`, `family_name`, `given_name` → Add.

### 1.7 App roles (for RBAC)

**App roles** blade → **+ Create app role**:

| Display name | Allowed member types | Value     | Description           |
|--------------|----------------------|-----------|-----------------------|
| Admin        | Users/Groups         | `Admin`   | Platform administrator|
| Operator     | Users/Groups         | `Operator`| Cloud operator        |
| Viewer       | Users/Groups         | `Viewer`  | Read-only viewer      |

Then assign roles to your test user(s):
**Microsoft Entra ID → Enterprise applications → HCM-Platform-Local → Users and groups → + Add user/group →** pick a user → pick a role → Assign.

> If your tenant edition does not allow app-role assignment from the Enterprise Apps blade (rare on free dev tenants), the code falls back to treating every signed-in user as **Viewer**. You can change this default in `backend/app/core/azure_ad.py`.

---

## 2. PostgreSQL setup (local)

Open **SQL Shell (psql)** or **pgAdmin** and run:

```sql
CREATE DATABASE hcm_db;
CREATE USER hcm_user WITH PASSWORD 'hcm_pass';
GRANT ALL PRIVILEGES ON DATABASE hcm_db TO hcm_user;
\c hcm_db
GRANT ALL ON SCHEMA public TO hcm_user;
```

> The backend auto-creates the `users` table on first start.

---

## 3. Backend — FastAPI

```powershell
cd "c:\Users\Jaya Krishna\OneDrive\Desktop\HCM_Project\backend"

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

copy .env.example .env
notepad .env       # fill in AZURE_TENANT_ID and AZURE_CLIENT_ID

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be running at: <http://localhost:8000>
Swagger docs: <http://localhost:8000/docs>
Health: <http://localhost:8000/api/v1/health>

> If PowerShell blocks `Activate.ps1`, run once:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## 4. Frontend — Angular 17

```powershell
cd "c:\Users\Jaya Krishna\OneDrive\Desktop\HCM_Project\frontend"

npm install

# Open src/environments/environment.development.ts and fill in:
#   tenantId, clientId  (from Azure step 1.2)

npm start
```

Frontend will be running at: <http://localhost:4200>

---

## 5. Drop in your custom images

Place the two images you uploaded into:

```
frontend/src/assets/images/background.jpg   <-- the blue cloud-in-hand image
frontend/src/assets/images/logo.png         <-- (optional) your company logo
```

The login page automatically picks them up. The cloud icon in the title is rendered as inline SVG, so no logo is mandatory.

---

## 6. End-to-end test flow

1. Backend running on :8000, frontend on :4200.
2. Open <http://localhost:4200> — you should see the **Hybrid Cloud Portal** login page.
3. Click **Sign in with Azure AD**.
4. Microsoft login popup → enter your Azure AD test user → consent (first time only).
5. You should be redirected to the **/dashboard** route showing your name, email, and roles.
6. Open DevTools → Network → look for `GET /api/v1/users/me` returning 200 with your profile.
7. Click **Logout** → token cleared and you bounce back to `/login`.

---

## 7. Architecture & flow

### High-level
```
+------------------+          +------------------+         +----------------------+
|  Angular 17 SPA  | <------> |  FastAPI Backend | <-----> |   PostgreSQL (local) |
|  (MSAL Angular)  |          |  (JWT validator) |         |    users table       |
+--------+---------+          +--------+---------+         +----------------------+
         |                             |
         |  Authorization Code + PKCE  |  validates RS256 JWT against Entra JWKS
         v                             v
+-------------------------------------------------------------+
|                    Microsoft Entra ID (Azure AD)            |
|  /authorize  /token  /jwks  /.well-known/openid-config      |
+-------------------------------------------------------------+
```

### Sequence — login
```
User -> Angular: click "Sign in with Azure AD"
Angular(MSAL) -> Entra ID: GET /authorize?code_challenge=PKCE...
Entra ID -> User: shows login page (popup)
User -> Entra ID: credentials + MFA
Entra ID -> Angular(MSAL): authorization code (popup callback)
Angular(MSAL) -> Entra ID: POST /token (code + code_verifier)
Entra ID -> Angular(MSAL): id_token + access_token
Angular -> FastAPI: GET /api/v1/users/me  (Bearer access_token)
FastAPI -> Entra ID: GET /.well-known/openid-configuration + JWKS (cached)
FastAPI -> FastAPI: validate signature, iss, aud, exp + extract roles
FastAPI -> PostgreSQL: upsert user record
FastAPI -> Angular: 200 { id, email, name, roles }
Angular -> Router: navigate to /dashboard
```

### Token lifecycle
- Access token TTL: ~60–90 min (Entra default). MSAL silently refreshes via hidden iframe (`acquireTokenSilent`).
- Idle session timeout enforced client-side at **30 min** by `SessionService` (configurable in `environment.ts`).
- On hard refresh, MSAL re-hydrates the account from `sessionStorage` (configured via MSAL `cacheLocation`).

---

## 8. Common Azure AD localhost issues & fixes

| Error                                                   | Cause / Fix                                                                                 |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client type` | Redirect URI is registered under *Web* instead of *Single-page application*. Move it.       |
| `AADSTS50011: redirect URI ... does not match`         | Add **exact** URI `http://localhost:4200` to App Registration → Authentication → SPA.       |
| `AADSTS65001: consent required`                        | Click **Grant admin consent** in API permissions; or re-login and accept the consent prompt.|
| Backend returns 401 `Invalid audience`                  | `AZURE_API_AUDIENCE` in backend `.env` must equal `api://<client-id>` exactly.              |
| Backend returns 401 `Invalid issuer`                    | `AZURE_TENANT_ID` mismatch between frontend and backend.                                    |
| CORS error on `/api/v1/users/me`                        | Frontend origin must be in `BACKEND_CORS_ORIGINS` (already set to `http://localhost:4200`). |
| Popup blocked                                          | Allow popups for `localhost:4200`, or switch to `loginRedirect` in `auth.service.ts`.       |
| Tokens disappear on hard refresh                       | Make sure `cacheLocation` is `sessionStorage` (default) **or** `localStorage`. Not `memory`.|

---

## 9. Folder structure (full)

```
HCM_Project/
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── README.md
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── api/
│       │   ├── __init__.py
│       │   └── v1/
│       │       ├── __init__.py
│       │       ├── router.py
│       │       └── endpoints/
│       │           ├── __init__.py
│       │           ├── auth.py
│       │           ├── health.py
│       │           └── users.py
│       ├── core/
│       │   ├── __init__.py
│       │   ├── azure_ad.py
│       │   ├── config.py
│       │   └── security.py
│       ├── db/
│       │   ├── __init__.py
│       │   ├── base.py
│       │   └── session.py
│       ├── dependencies/
│       │   ├── __init__.py
│       │   └── auth.py
│       ├── models/
│       │   ├── __init__.py
│       │   └── user.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   └── user.py
│       └── services/
│           ├── __init__.py
│           └── user_service.py
│
└── frontend/
    ├── package.json
    ├── angular.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── README.md
    └── src/
        ├── index.html
        ├── main.ts
        ├── styles.scss
        ├── assets/images/
        │   ├── background.jpg
        │   └── logo.png
        ├── environments/
        │   ├── environment.ts
        │   └── environment.development.ts
        └── app/
            ├── app.component.ts
            ├── app.config.ts
            ├── app.routes.ts
            ├── core/
            │   ├── config/msal.config.ts
            │   ├── guards/auth.guard.ts
            │   ├── guards/role.guard.ts
            │   ├── interceptors/auth.interceptor.ts
            │   ├── interceptors/error.interceptor.ts
            │   ├── models/user.model.ts
            │   └── services/
            │       ├── auth.service.ts
            │       ├── session.service.ts
            │       ├── toast.service.ts
            │       └── user.service.ts
            ├── features/
            │   ├── dashboard/dashboard.component.ts
            │   ├── login/login.component.ts
            │   └── unauthorized/unauthorized.component.ts
            └── shared/components/
                ├── spinner/spinner.component.ts
                └── toast/toast.component.ts
```
