"""VMware vCenter discovery endpoints.

Auth-protected (a valid app session JWT is required). vCenter credentials are
supplied in the request body from the UI form, used for a one-shot pyVmomi
discovery, and never stored.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.core.vcenter import VCenterError, discover
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.vmware import DiscoveryResult, VCenterConnectRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vmware", tags=["vmware"])


@router.post(
    "/discover",
    response_model=DiscoveryResult,
    summary="Connect to a vCenter and discover its inventory",
)
async def discover_vcenter(
    body: VCenterConnectRequest,
    _: User = Depends(get_current_user),
) -> DiscoveryResult:
    try:
        # pyVmomi is blocking — run it off the event loop.
        return await run_in_threadpool(
            discover,
            body.host,
            body.username,
            body.password,
            body.ignore_ssl,
        )
    except VCenterError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
