"""VMware vCenter discovery via pyVmomi (vSphere SOAP SDK).

Given a host + credentials (supplied per request from the UI), we open a
transient session, walk the inventory with container views, and return a
normalized snapshot: vCenter info + clusters/hosts/VMs/datastores.

The session is always disconnected in a finally block; credentials are never
stored. Discovery is a blocking operation — call it from a sync FastAPI route
(FastAPI runs sync routes in a worker thread) or via run_in_threadpool.
"""
from __future__ import annotations

import logging
import ssl
from datetime import datetime, timezone
from typing import Any, List, Type

from pyVim.connect import Disconnect, SmartConnect
from pyVmomi import vim

from app.schemas.vmware import (
    ClusterInfo,
    DatacenterInfo,
    DatastoreInfo,
    DiscoveryCounts,
    DiscoveryResult,
    HostInfo,
    VCenterAbout,
    VmInfo,
)

logger = logging.getLogger(__name__)


class VCenterError(Exception):
    """Raised when connecting to / discovering from vCenter fails."""


def _container_view(content: Any, vimtype: Type) -> List[Any]:
    """Return all managed objects of a given type under the root folder."""
    view = content.viewManager.CreateContainerView(content.rootFolder, [vimtype], True)
    try:
        return list(view.view)
    finally:
        view.Destroy()


def _parent_cluster_name(host: Any) -> str | None:
    """The cluster a host belongs to (host.parent is a ClusterComputeResource)."""
    parent = getattr(host, "parent", None)
    if isinstance(parent, vim.ClusterComputeResource):
        return parent.name
    return None


def discover(host: str, username: str, password: str, ignore_ssl: bool = True) -> DiscoveryResult:
    """Connect to vCenter and return a discovery snapshot. Raises VCenterError."""
    if not host or not username or not password:
        raise VCenterError("Host, username and password are required")

    ssl_ctx = ssl._create_unverified_context() if ignore_ssl else None

    try:
        si = SmartConnect(host=host, user=username, pwd=password, sslContext=ssl_ctx)
    except vim.fault.InvalidLogin as e:
        raise VCenterError("Invalid vCenter username or password") from e
    except (ssl.SSLError, ConnectionError, OSError) as e:
        raise VCenterError(f"Could not reach vCenter at '{host}': {e}") from e
    except Exception as e:  # pyVmomi raises a wide range of fault types
        raise VCenterError(f"Could not connect to vCenter: {e}") from e

    try:
        content = si.RetrieveContent()
        about = content.about

        vcenter = VCenterAbout(
            host=host,
            name=getattr(about, "fullName", None),
            version=getattr(about, "version", None),
            build=getattr(about, "build", None),
            api_type=getattr(about, "apiType", None),
            instance_uuid=getattr(about, "instanceUuid", None),
        )

        datacenters = [DatacenterInfo(name=dc.name) for dc in _container_view(content, vim.Datacenter)]
        clusters = [_cluster_info(c) for c in _container_view(content, vim.ClusterComputeResource)]
        hosts = [_host_info(h) for h in _container_view(content, vim.HostSystem)]
        vms = [_vm_info(v) for v in _container_view(content, vim.VirtualMachine)]
        datastores = [_datastore_info(d) for d in _container_view(content, vim.Datastore)]

        counts = DiscoveryCounts(
            datacenters=len(datacenters),
            clusters=len(clusters),
            hosts=len(hosts),
            vms=len(vms),
            datastores=len(datastores),
            vms_powered_on=sum(1 for v in vms if v.power_state == "poweredOn"),
        )

        return DiscoveryResult(
            vcenter=vcenter,
            counts=counts,
            datacenters=datacenters,
            clusters=clusters,
            hosts=hosts,
            vms=vms,
            datastores=datastores,
            discovered_at=datetime.now(timezone.utc),
        )
    except VCenterError:
        raise
    except Exception as e:
        logger.exception("vCenter discovery failed")
        raise VCenterError(f"Discovery failed: {e}") from e
    finally:
        try:
            Disconnect(si)
        except Exception:
            pass


# --------------------------------------------------------------------------- #
#  Per-object mappers (use .summary where possible to limit RPC chatter)
# --------------------------------------------------------------------------- #
def _cluster_info(c: Any) -> ClusterInfo:
    summary = getattr(c, "summary", None)
    cfg = getattr(c, "configuration", None)
    drs = getattr(getattr(cfg, "drsConfig", None), "enabled", None)
    ha = getattr(getattr(cfg, "dasConfig", None), "enabled", None)
    return ClusterInfo(
        name=c.name,
        datacenter=_datacenter_of(c),
        num_hosts=getattr(summary, "numHosts", 0) or len(getattr(c, "host", []) or []),
        num_cpu_cores=getattr(summary, "numCpuCores", 0) or 0,
        total_cpu_mhz=getattr(summary, "totalCpu", 0) or 0,
        total_memory_bytes=getattr(summary, "totalMemory", 0) or 0,
        drs_enabled=drs,
        ha_enabled=ha,
    )


def _host_info(h: Any) -> HostInfo:
    summary = h.summary
    hw = getattr(summary, "hardware", None)
    runtime = getattr(summary, "runtime", None)
    return HostInfo(
        name=h.name,
        cluster=_parent_cluster_name(h),
        connection_state=str(getattr(runtime, "connectionState", "") or ""),
        power_state=str(getattr(runtime, "powerState", "") or ""),
        vendor=getattr(hw, "vendor", None),
        model=getattr(hw, "model", None),
        cpu_model=getattr(hw, "cpuModel", None),
        num_cpu_cores=getattr(hw, "numCpuCores", 0) or 0,
        memory_bytes=getattr(hw, "memorySize", 0) or 0,
        num_vms=len(getattr(h, "vm", []) or []),
    )


def _vm_info(v: Any) -> VmInfo:
    summary = v.summary
    cfg = getattr(summary, "config", None)
    runtime = getattr(summary, "runtime", None)
    guest = getattr(summary, "guest", None)
    host_obj = getattr(runtime, "host", None)
    return VmInfo(
        name=getattr(cfg, "name", None) or v.name,
        power_state=str(getattr(runtime, "powerState", "") or ""),
        guest_os=getattr(cfg, "guestFullName", None),
        num_cpu=getattr(cfg, "numCpu", 0) or 0,
        memory_mb=getattr(cfg, "memorySizeMB", 0) or 0,
        ip_address=getattr(guest, "ipAddress", None),
        host=getattr(host_obj, "name", None) if host_obj else None,
        uuid=getattr(cfg, "uuid", None),
    )


def _datastore_info(d: Any) -> DatastoreInfo:
    summary = d.summary
    return DatastoreInfo(
        name=getattr(summary, "name", None) or d.name,
        type=getattr(summary, "type", None),
        capacity_bytes=getattr(summary, "capacity", 0) or 0,
        free_bytes=getattr(summary, "freeSpace", 0) or 0,
    )


def _datacenter_of(entity: Any) -> str | None:
    """Walk parents until we hit the enclosing Datacenter."""
    node = getattr(entity, "parent", None)
    while node is not None:
        if isinstance(node, vim.Datacenter):
            return node.name
        node = getattr(node, "parent", None)
    return None
