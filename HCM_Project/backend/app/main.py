"""FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers.router import api_router
from app.core.config import settings
from app.middleware.secure_headers import SecureHeadersMiddleware
from app.db.base import Base
from app.db.bootstrap import run_bootstrap
from app.db.session import SessionLocal, engine

# Import the models package so SQLAlchemy registers every model on Base.metadata
# (tenants, users, roles, permissions, audit_logs) before create_all.
from app import models as _models  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("hcm")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        debug=settings.APP_DEBUG,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS — Angular dev server origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o).rstrip("/") for o in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # Secure headers
    app.add_middleware(SecureHeadersMiddleware)

    # API routes
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.on_event("startup")
    def _startup() -> None:
        logger.info("Creating database tables if missing")
        Base.metadata.create_all(bind=engine)
        # Seed permissions, system roles, default tenant, super admin; backfill users.
        db = SessionLocal()
        try:
            run_bootstrap(db)
        finally:
            db.close()
        logger.info("HCM API ready on http://%s:%s", settings.APP_HOST, settings.APP_PORT)

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {
            "app": settings.APP_NAME,
            "docs": "/docs",
            "health": f"{settings.API_V1_PREFIX}/health",
        }

    return app


app = create_app()
