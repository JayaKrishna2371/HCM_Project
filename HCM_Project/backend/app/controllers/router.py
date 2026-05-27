"""Aggregator for v1 API routers."""
from __future__ import annotations

from fastapi import APIRouter

from app.controllers import auth, health, users, vmware
from app.controllers.admin import audit as admin_audit
from app.controllers.admin import roles as admin_roles
from app.controllers.admin import tenants as admin_tenants
from app.controllers.admin import users as admin_users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(vmware.router)

# Administration module (platform & tenant management) — all under /admin.
admin_router = APIRouter(prefix="/admin")
admin_router.include_router(admin_tenants.router)
admin_router.include_router(admin_users.router)
admin_router.include_router(admin_roles.router)
admin_router.include_router(admin_audit.router)
api_router.include_router(admin_router)
