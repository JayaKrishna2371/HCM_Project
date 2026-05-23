"""Pydantic models for the VMware vCenter discovery feature.

Credentials are supplied per request from the UI connection form — they are
used to open a transient pyVmomi session and are never persisted.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class VCenterConnectRequest(BaseModel):
    host: str = Field(..., description="vCenter hostname or IP (no scheme)")
    username: str = Field(..., description="e.g. administrator@vsphere.local")
    password: str
    ignore_ssl: bool = Field(True, description="Skip TLS verification (self-signed certs)")


class VCenterAbout(BaseModel):
    host: str
    name: Optional[str] = None          # fullName, e.g. "VMware vCenter Server 8.0.2 build-..."
    version: Optional[str] = None
    build: Optional[str] = None
    api_type: Optional[str] = None
    instance_uuid: Optional[str] = None


class DatacenterInfo(BaseModel):
    name: str


class ClusterInfo(BaseModel):
    name: str
    datacenter: Optional[str] = None
    num_hosts: int = 0
    num_cpu_cores: int = 0
    total_cpu_mhz: int = 0
    total_memory_bytes: int = 0
    drs_enabled: Optional[bool] = None
    ha_enabled: Optional[bool] = None


class HostInfo(BaseModel):
    name: str
    cluster: Optional[str] = None
    connection_state: Optional[str] = None
    power_state: Optional[str] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    cpu_model: Optional[str] = None
    num_cpu_cores: int = 0
    memory_bytes: int = 0
    num_vms: int = 0


class VmInfo(BaseModel):
    name: str
    power_state: Optional[str] = None
    guest_os: Optional[str] = None
    num_cpu: int = 0
    memory_mb: int = 0
    ip_address: Optional[str] = None
    host: Optional[str] = None
    uuid: Optional[str] = None


class DatastoreInfo(BaseModel):
    name: str
    type: Optional[str] = None
    capacity_bytes: int = 0
    free_bytes: int = 0


class DiscoveryCounts(BaseModel):
    datacenters: int = 0
    clusters: int = 0
    hosts: int = 0
    vms: int = 0
    datastores: int = 0
    vms_powered_on: int = 0


class DiscoveryResult(BaseModel):
    vcenter: VCenterAbout
    counts: DiscoveryCounts
    datacenters: List[DatacenterInfo] = []
    clusters: List[ClusterInfo] = []
    hosts: List[HostInfo] = []
    vms: List[VmInfo] = []
    datastores: List[DatastoreInfo] = []
    discovered_at: datetime
