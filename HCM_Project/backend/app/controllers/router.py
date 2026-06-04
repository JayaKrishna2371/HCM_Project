"""Aggregator for v1 API routers.

Controllers are organized by domain (login, users, tenants, roles, audit,
health). The Administration endpoints keep their ``/admin`` URL prefix even
though their controllers live in their respective domain folders.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.controllers.audit import audit_controller as admin_audit
from app.controllers.health import health_controller
from app.controllers.login import login_controller
from app.controllers.roles import role_controller as admin_roles
from app.controllers.tenants import tenant_controller as admin_tenants
from app.controllers.users import admin_user_controller as admin_users
from app.controllers.users import user_controller

api_router = APIRouter()
api_router.include_router(health_controller.router)
api_router.include_router(login_controller.router)
api_router.include_router(user_controller.router)

# Administration module (platform & tenant management) — all under /admin.
admin_router = APIRouter(prefix="/admin")
admin_router.include_router(admin_tenants.router)
admin_router.include_router(admin_users.router)
admin_router.include_router(admin_roles.router)
admin_router.include_router(admin_audit.router)
api_router.include_router(admin_router)
