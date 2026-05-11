Act as a Principal Enterprise Architect + Senior Full Stack Engineer.

I am building an Enterprise Hybrid Cloud Management (HCM) Platform similar to Morpheus/CloudBolt.

Current Phase:
Phase 1 → Authentication & Login Module.

Technology Stack:
- Frontend → Angular 17+
- Backend → Python FastAPI
- Database → PostgreSQL
- Authentication → Microsoft Azure Active Directory (Azure AD / Entra ID)
- API Security → JWT / OAuth2
- Deployment → Docker + Kubernetes (future phase)
- CI/CD → GitHub Actions (future phase)

Your responsibility:
Design and generate a production-grade enterprise login module integrated with Azure AD SSO.

=====================================================
MY REQUIREMENTS
=====================================================

1. Frontend Requirements
- I will provide:
  - Custom login page UI layout image
  - Custom background image
  - Company logo

You must:
- Convert the provided design into a modern Angular login page.
- Use responsive enterprise UI.
- Use Angular standalone components.
- Use Angular routing.
- Use Angular services for auth.
- Use Angular environment.ts properly.
- Use enterprise folder structure.
- Use route guards.
- Use interceptor for JWT tokens.
- Use reusable components.
- Use clean CSS or Tailwind if needed.
- Use proper loading spinners.
- Use toast notifications.
- Use session timeout handling.

2. Authentication Requirements
Authentication must happen using:
- Microsoft Azure AD (Entra ID)
- OAuth2 Authorization Code Flow with PKCE
- MSAL Angular Library

Features required:
- Single Sign-On (SSO)
- Login
- Logout
- Silent token refresh
- Access token handling
- Role-based access control (RBAC)
- Session management
- Protected routes
- JWT validation

3. Backend Requirements (FastAPI)
Create:
- Auth validation middleware
- JWT verification
- Azure AD token validation
- Secure API endpoints
- User profile endpoint
- Role extraction endpoint
- Health endpoint

Use:
- FastAPI
- Pydantic
- Python typing
- Dependency Injection
- Enterprise folder structure

4. Security Requirements
Implement:
- Secure token storage
- HTTPS-ready configs
- CORS handling
- Secure headers
- CSRF protection approach
- Session expiration handling
- Refresh token strategy
- Environment variables for secrets

5. Architecture
Generate:
- Complete architecture explanation
- Authentication flow diagram
- Sequence diagram
- Frontend-backend-Azure AD flow
- Folder structure
- Config files
- Step-by-step execution flow

6. Azure AD Integration
Guide me step-by-step:
- How to create Azure AD app registration
- Redirect URI setup
- SPA configuration
- API permission setup
- Token configuration
- Client ID usage
- Tenant ID usage
- How to configure Angular
- How to configure FastAPI
- How to test locally
- Common errors and fixes

7. Output Expectations
I want:
- Production-quality code
- Exact file-by-file implementation
- Exact commands
- No pseudo code
- Full code only
- Enterprise standards
- Explain every step
- Mention where to place each file

8. Code Structure
Generate:
- Angular frontend project structure
- FastAPI backend structure
- Docker-ready setup
- Environment files
- Config classes
- Auth service
- Auth guard
- MSAL config
- Token interceptor
- Login component
- Dashboard placeholder
- Protected route examples

9. UI Expectations
The login page should feel like:
- Enterprise cloud platform
- Similar to VMware / Morpheus / ServiceNow portals
- Modern dark/light gradient UI
- Professional animations
- Minimal and clean

10. Important
- Use latest stable versions only.
- Mention package versions.
- Mention exact npm/pip install commands.
- Mention where each configuration goes.
- Explain WHY each config is needed.
- Do not skip any file.
- Do not assume anything.
- Generate complete working implementation.

I will upload:
1. Login page design image
2. Background image
3. Company logo

After upload:
- Analyze design
- Create exact UI implementation
- Integrate Azure AD authentication
- Generate complete codebase
- Explain execution flow step-by-step


IMPORTANT CURRENT PHASE REQUIREMENT

As of now:
- Do NOT use Docker
- Do NOT use Kubernetes
- Do NOT use Terraform
- Do NOT use CI/CD
- Do NOT use Helm
- Do NOT use cloud deployment
- Do NOT generate production infra configs
- Do NOT generate containerization files

Current goal:
Run the complete application locally on my machine.

Environment:
- Frontend runs locally using Angular dev server
- Backend runs locally using FastAPI uvicorn
- PostgreSQL can be local
- Azure AD authentication should still work from localhost

Local Development URLs:
Frontend:
http://localhost:4200

Backend:
http://localhost:8000

Backend API Base URL:
http://localhost:8000/api

Focus Areas:
1. Local development setup
2. Azure AD integration on localhost
3. Enterprise login page UI
4. Authentication flow
5. Route protection
6. JWT validation
7. RBAC implementation
8. Clean architecture
9. Working local execution

I want:
- Step-by-step local setup
- Exact commands
- File-by-file code
- How to run frontend
- How to run backend
- How to test login flow locally
- How to debug Azure AD integration locally
- Common localhost authentication issues and fixes

Generate:
- Angular standalone application setup
- FastAPI local backend setup
- PostgreSQL local configuration
- .env examples
- package installation commands
- requirements.txt
- launch instructions
- local testing workflow

Do not skip any setup step.
Assume I am starting from scratch.