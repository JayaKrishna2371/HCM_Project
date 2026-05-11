# HCM Backend (FastAPI)

## Run locally

```powershell
cd "c:\Users\Jaya Krishna\OneDrive\Desktop\HCM_Project\backend"

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

copy .env.example .env
# Edit .env and fill AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_API_AUDIENCE, DATABASE_URL

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Swagger UI:  http://localhost:8000/docs
- Health:      http://localhost:8000/api/v1/health
- Me:          http://localhost:8000/api/v1/users/me   *(requires Bearer)*

## Endpoints

| Method | Path                              | Auth      | Description                       |
|--------|-----------------------------------|-----------|-----------------------------------|
| GET    | `/api/v1/health`                  | public    | Liveness probe                    |
| GET    | `/api/v1/auth/introspect`         | Bearer    | Decoded token claims              |
| GET    | `/api/v1/auth/me/roles`           | Bearer    | Current user's role list          |
| GET    | `/api/v1/users/me`                | Bearer    | Current user's profile            |
| GET    | `/api/v1/users/admin-only`        | Admin     | Sample RBAC route                 |
| GET    | `/api/v1/users/operator-or-admin` | Admin\|Operator | Sample RBAC route           |
