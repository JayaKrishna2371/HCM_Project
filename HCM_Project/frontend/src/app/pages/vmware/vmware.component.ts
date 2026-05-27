import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SpinnerComponent } from '@components/spinner/spinner.component';
import { DiscoveryResult, VmwareService } from '@services/vmware.service';

type ResourceKey = 'datacenters' | 'clusters' | 'hosts' | 'vms' | 'datastores';
interface Col { h: string; k: string; fmt?: 'bytes' | 'mb' | 'ghz' | 'bool' | 'power' | 'usedpct'; }
interface DonutSeg { label: string; value: number; pct: number; color: string; dasharray: string; dashoffset: string; }

@Component({
  selector: 'app-vmware',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vmware.component.html',
  styleUrls: ['./vmware.component.css'],
})
export class VmwareComponent {
  private readonly vmware = inject(VmwareService);

  host = ''; username = ''; password = ''; ignoreSsl = true;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<DiscoveryResult | null>(null);
  readonly open = signal<ResourceKey | null>(null);
  readonly filter = signal('');

  readonly titles: Record<ResourceKey, string> = {
    datacenters: 'Datacenters', clusters: 'Clusters', hosts: 'Hosts',
    vms: 'Virtual Machines', datastores: 'Datastores',
  };

  // Column definitions per category (drives the detail table).
  readonly cols: Record<ResourceKey, Col[]> = {
    datacenters: [{ h: 'Name', k: 'name' }],
    clusters: [
      { h: 'Cluster', k: 'name' }, { h: 'Datacenter', k: 'datacenter' }, { h: 'Hosts', k: 'num_hosts' },
      { h: 'CPU Cores', k: 'num_cpu_cores' }, { h: 'CPU', k: 'total_cpu_mhz', fmt: 'ghz' },
      { h: 'Memory', k: 'total_memory_bytes', fmt: 'bytes' }, { h: 'DRS', k: 'drs_enabled', fmt: 'bool' }, { h: 'HA', k: 'ha_enabled', fmt: 'bool' },
    ],
    hosts: [
      { h: 'Host', k: 'name' }, { h: 'Cluster', k: 'cluster' }, { h: 'Power', k: 'power_state', fmt: 'power' },
      { h: 'Connection', k: 'connection_state' }, { h: 'Vendor', k: 'vendor' }, { h: 'Model', k: 'model' },
      { h: 'CPU Cores', k: 'num_cpu_cores' }, { h: 'Memory', k: 'memory_bytes', fmt: 'bytes' }, { h: 'VMs', k: 'num_vms' },
    ],
    vms: [
      { h: 'VM Name', k: 'name' }, { h: 'Power', k: 'power_state', fmt: 'power' }, { h: 'Cluster', k: 'cluster' },
      { h: 'Host', k: 'host' }, { h: 'IP', k: 'ip_address' }, { h: 'vCPU', k: 'num_cpu' }, { h: 'RAM', k: 'memory_mb', fmt: 'mb' },
      { h: 'Disks', k: 'num_disks' }, { h: 'Provisioned', k: 'disk_provisioned_bytes', fmt: 'bytes' }, { h: 'Guest OS', k: 'guest_os' },
    ],
    datastores: [
      { h: 'Datastore', k: 'name' }, { h: 'Type', k: 'type' }, { h: 'Capacity', k: 'capacity_bytes', fmt: 'bytes' },
      { h: 'Free', k: 'free_bytes', fmt: 'bytes' }, { h: 'Used', k: 'capacity_bytes', fmt: 'usedpct' },
    ],
  };

  readonly tiles = computed(() => {
    const r = this.result();
    if (!r) return [];
    return [
      { key: 'datacenters' as ResourceKey, label: 'Datacenters', value: r.counts.datacenters, tone: 'slate', sub: '' },
      { key: 'clusters' as ResourceKey, label: 'Clusters', value: r.counts.clusters, tone: 'violet', sub: '' },
      { key: 'hosts' as ResourceKey, label: 'Hosts', value: r.counts.hosts, tone: 'teal', sub: '' },
      { key: 'vms' as ResourceKey, label: 'Virtual Machines', value: r.counts.vms, tone: 'blue',
        sub: r.counts.vms ? `${r.counts.vms_powered_on} powered on` : '' },
      { key: 'datastores' as ResourceKey, label: 'Datastores', value: r.counts.datastores, tone: 'amber', sub: '' },
    ];
  });

  // ---- charts ----
  readonly vmStats = computed(() => {
    const vms = this.result()?.vms ?? [];
    return {
      on: vms.filter((v) => v.power_state === 'poweredOn').length,
      off: vms.filter((v) => v.power_state === 'poweredOff').length,
      susp: vms.filter((v) => v.power_state === 'suspended').length,
      total: vms.length,
    };
  });

  readonly powerDonut = computed<DonutSeg[]>(() => {
    const s = this.vmStats();
    const total = s.total || 1;
    const C = 2 * Math.PI * 60;
    let offset = 0;
    const defs = [
      { label: 'Powered On', value: s.on, color: '#15803d' },
      { label: 'Powered Off', value: s.off, color: '#94a3b8' },
      { label: 'Suspended', value: s.susp, color: '#d97706' },
    ];
    return defs.map((d) => {
      const len = (d.value / total) * C;
      const seg: DonutSeg = { ...d, pct: Math.round((d.value / total) * 100), dasharray: `${len} ${C - len}`, dashoffset: `${-offset}` };
      offset += len;
      return seg;
    });
  });

  readonly clusterBars = computed(() => {
    const vms = this.result()?.vms ?? [];
    const map = new Map<string, number>();
    for (const v of vms) { const k = v.cluster || 'Unassigned'; map.set(k, (map.get(k) ?? 0) + 1); }
    const arr = [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    const max = Math.max(1, ...arr.map((a) => a.count));
    return arr.map((a) => ({ ...a, pct: Math.round((a.count / max) * 100) }));
  });

  readonly storage = computed(() => {
    const ds = this.result()?.datastores ?? [];
    const cap = ds.reduce((s, d) => s + (d.capacity_bytes || 0), 0);
    const free = ds.reduce((s, d) => s + (d.free_bytes || 0), 0);
    const used = cap - free;
    return { cap, free, used, usedPct: cap ? Math.round((used / cap) * 100) : 0 };
  });

  // ---- modal ----
  readonly modalRows = computed<Record<string, unknown>[]>(() => {
    const key = this.open();
    const r = this.result();
    if (!key || !r) return [];
    const rows = r[key] as unknown as Record<string, unknown>[];
    const q = this.filter().trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  });

  openModal(key: ResourceKey): void { this.filter.set(''); this.open.set(key); }
  closeModal(): void { this.open.set(null); }

  cell(row: Record<string, unknown>, c: Col): string {
    const raw = row[c.k];
    switch (c.fmt) {
      case 'bytes': return this.fmtBytes(Number(raw) || 0);
      case 'mb': { const gb = (Number(raw) || 0) / 1024; return gb ? `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)} GB` : '—'; }
      case 'ghz': { const n = Number(raw) || 0; return n ? `${(n / 1000).toFixed(1)} GHz` : '—'; }
      case 'bool': return raw === true ? 'Yes' : raw === false ? 'No' : '—';
      case 'power': return this.powerLabel(String(raw ?? ''));
      case 'usedpct': {
        const cap = Number(row['capacity_bytes']) || 0;
        const free = Number(row['free_bytes']) || 0;
        return cap ? `${Math.round(((cap - free) / cap) * 100)}%` : '—';
      }
      default: return raw === null || raw === undefined || raw === '' ? '—' : String(raw);
    }
  }

  private powerLabel(p: string): string {
    return p === 'poweredOn' ? 'On' : p === 'poweredOff' ? 'Off' : p === 'suspended' ? 'Suspended' : (p || '—');
  }

  fmtBytes(b: number): string {
    if (!b) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0; let n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n >= 10 || i < 2 ? n.toFixed(0) : n.toFixed(1)} ${u[i]}`;
  }

  connect(): void {
    if (!this.host || !this.username || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    this.vmware
      .discover({ host: this.host.trim(), username: this.username.trim(), password: this.password, ignore_ssl: this.ignoreSsl })
      .subscribe({
        next: (res) => { this.result.set(res); this.loading.set(false); },
        error: (err) => { this.error.set(err?.error?.detail ?? err.message ?? 'Discovery failed'); this.loading.set(false); },
      });
  }

  rediscover(): void { this.connect(); }
  reset(): void { this.result.set(null); this.open.set(null); this.password = ''; }

  download(key: ResourceKey): void {
    const r = this.result();
    if (!r) return;
    this.downloadCsv(`vmware-${key}-${r.vcenter.host}.csv`, r[key] as unknown as Record<string, unknown>[]);
  }

  private downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
