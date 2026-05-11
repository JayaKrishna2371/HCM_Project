"""FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import SecureHeadersMiddleware
from app.db.base import Base
from app.db.session import engine

# Import models so SQLAlchemy registers them on Base.metadata before create_all.
from app.models import user as _user_model  # noqa: F401

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
