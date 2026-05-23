"""Aggregator for v1 API routers."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, users, vmware

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(vmware.router)
