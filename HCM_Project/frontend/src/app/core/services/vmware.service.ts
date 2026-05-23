import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface VCenterConnect {
  host: string;
  username: string;
  password: string;
  ignore_ssl: boolean;
}

export interface VCenterAbout {
  host: string;
  name?: string | null;
  version?: string | null;
  build?: string | null;
  api_type?: string | null;
  instance_uuid?: string | null;
}

export interface DiscoveryCounts {
  datacenters: number;
  clusters: number;
  hosts: number;
  vms: number;
  datastores: number;
  vms_powered_on: number;
}

export interface DatacenterInfo { name: string; }

export interface ClusterInfo {
  name: string;
  datacenter?: string | null;
  num_hosts: number;
  num_cpu_cores: number;
  total_cpu_mhz: number;
  total_memory_bytes: number;
  drs_enabled?: boolean | null;
  ha_enabled?: boolean | null;
}

export interface HostInfo {
  name: string;
  cluster?: string | null;
  connection_state?: string | null;
  power_state?: string | null;
  vendor?: string | null;
  model?: string | null;
  cpu_model?: string | null;
  num_cpu_cores: number;
  memory_bytes: number;
  num_vms: number;
}

export interface VmInfo {
  name: string;
  power_state?: string | null;
  guest_os?: string | null;
  num_cpu: number;
  memory_mb: number;
  ip_address?: string | null;
  host?: string | null;
  uuid?: string | null;
}

export interface DatastoreInfo {
  name: string;
  type?: string | null;
  capacity_bytes: number;
  free_bytes: number;
}

export interface DiscoveryResult {
  vcenter: VCenterAbout;
  counts: DiscoveryCounts;
  datacenters: DatacenterInfo[];
  clusters: ClusterInfo[];
  hosts: HostInfo[];
  vms: VmInfo[];
  datastores: DatastoreInfo[];
  discovered_at: string;
}

@Injectable({ providedIn: 'root' })
export class VmwareService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Connect to a vCenter and discover its inventory in one shot. */
  discover(req: VCenterConnect): Observable<DiscoveryResult> {
    return this.http.post<DiscoveryResult>(`${this.base}/vmware/discover`, req);
  }
}
