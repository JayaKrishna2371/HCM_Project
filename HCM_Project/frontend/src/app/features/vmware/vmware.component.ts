import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import {
  DiscoveryResult,
  VmwareService,
} from '../../core/services/vmware.service';

type ResourceKey = 'datacenters' | 'clusters' | 'hosts' | 'vms' | 'datastores';

@Component({
  selector: 'app-vmware',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="vm-head">
      <div>
        <h1>VMware vCenter Discovery</h1>
        <p class="muted">Connect to a vCenter Server to discover its inventory.</p>
      </div>
      @if (result()) {
        <div class="vm-head__actions">
          <button class="btn btn--ghost" type="button" (click)="rediscover()" [disabled]="loading()">
            Re-discover
          </button>
          <button class="btn btn--ghost" type="button" (click)="reset()">New connection</button>
        </div>
      }
    </header>

    <!-- ============ Connection form ============ -->
    @if (!result()) {
      <section class="card connect">
        <h3 class="card__title">Connect to vCenter</h3>
        <form (ngSubmit)="connect()" #f="ngForm" class="connect__form">
          <label class="field-row">
            <span>vCenter host / IP</span>
            <input name="host" [(ngModel)]="host" required placeholder="vcenter.corp.local" autocomplete="off" />
          </label>
          <label class="field-row">
            <span>Username</span>
            <input name="username" [(ngModel)]="username" required placeholder="administrator@vsphere.local" autocomplete="off" />
          </label>
          <label class="field-row">
            <span>Password</span>
            <input name="password" type="password" [(ngModel)]="password" required autocomplete="off" />
          </label>
          <label class="check-row">
            <input name="ignoreSsl" type="checkbox" [(ngModel)]="ignoreSsl" />
            <span>Ignore TLS certificate validation (self-signed vCenter)</span>
          </label>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button class="btn btn--primary" type="submit" [disabled]="loading() || f.invalid">
            @if (loading()) { <app-spinner [size]="16" /> }
            <span>{{ loading() ? 'Discovering…' : 'Connect & Discover' }}</span>
          </button>
        </form>
      </section>
    }

    <!-- ============ Discovery result ============ -->
    @if (result(); as r) {
      <section class="vcenter-bar">
        <div class="vcenter-bar__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/>
            <circle cx="7" cy="7" r="0.6" fill="currentColor"/><circle cx="7" cy="17" r="0.6" fill="currentColor"/>
          </svg>
        </div>
        <div class="vcenter-bar__body">
          <strong>{{ r.vcenter.name ?? r.vcenter.host }}</strong>
          <span class="muted">
            {{ r.vcenter.host }}
            @if (r.vcenter.version) { · v{{ r.vcenter.version }} }
            @if (r.vcenter.build) { · build {{ r.vcenter.build }} }
            · discovered {{ r.discovered_at | date: 'medium' }}
          </span>
        </div>
      </section>

      <section class="tiles">
        @for (t of tiles(); track t.key) {
          <article class="tile" [class.is-open]="open() === t.key"
                   [attr.data-tone]="t.tone" (click)="toggle(t.key)"
                   role="button" tabindex="0">
            <div class="tile__top">
              <span class="tile__label">{{ t.label }}</span>
              <svg class="tile__caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="tile__value">{{ t.value }}</div>
            @if (t.sub) { <div class="tile__sub">{{ t.sub }}</div> }

            @if (open() === t.key) {
              <div class="tile__actions" (click)="$event.stopPropagation()">
                <button class="btn btn--download" type="button" (click)="download(t.key)" [disabled]="t.value === 0">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Download CSV
                </button>
              </div>
            }
          </article>
        }
      </section>
    }
  `,
  styles: [
    `
      :host { display: block; }
      h1 { margin: 0 0 4px; font-size: 1.5rem; font-weight: 700; color: #0f172a; letter-spacing: -0.018em; }
      .muted { color: #64748b; font-size: 0.875rem; }

      .vm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
      .vm-head__actions { display: flex; gap: 8px; flex-shrink: 0; }

      .card {
        background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 24px;
        box-shadow: 0 1px 2px rgba(15,23,42,.04);
      }
      .card__title { margin: 0 0 16px; font-size: 0.9375rem; font-weight: 600; color: #0f172a; }

      .connect { max-width: 520px; }
      .connect__form { display: flex; flex-direction: column; gap: 14px; }
      .field-row { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: #334155; font-weight: 500; }
      .field-row input {
        padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem;
        background: #f8fafc; color: #0f172a; outline: none; transition: border-color .15s, box-shadow .15s, background .15s;
      }
      .field-row input:focus { background: #fff; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
      .check-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #475569; cursor: pointer; }
      .error { margin: 0; color: #b91c1c; font-size: 0.85rem; background: #fee2e2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 8px; }

      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 10px 16px; border-radius: 8px; border: 1px solid transparent;
        font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background .15s, box-shadow .15s, border-color .15s;
      }
      .btn:disabled { opacity: .6; cursor: not-allowed; }
      .btn--primary { background: #2563eb; color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,.25); }
      .btn--primary:hover:not(:disabled) { background: #1d4ed8; }
      .btn--ghost { background: #fff; color: #334155; border-color: #e2e8f0; }
      .btn--ghost:hover:not(:disabled) { background: #f1f5f9; }
      .btn--download { background: #eff5ff; color: #2563eb; border-color: #cfdcfa; padding: 7px 12px; font-size: 0.8rem; }
      .btn--download:hover:not(:disabled) { background: #e0ebff; }

      .vcenter-bar {
        display: flex; align-items: center; gap: 14px; padding: 16px 20px; margin-bottom: 16px;
        background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #e6eefc; border-radius: 14px;
      }
      .vcenter-bar__icon {
        width: 42px; height: 42px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,.12); color: #bfdbfe; flex-shrink: 0;
      }
      .vcenter-bar__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .vcenter-bar__body strong { font-size: 1rem; }
      .vcenter-bar .muted { color: rgba(220,232,255,.75); }

      .tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
      @media (max-width: 1100px) { .tiles { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 680px) { .tiles { grid-template-columns: repeat(2, 1fr); } }

      .tile {
        background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px;
        box-shadow: 0 1px 2px rgba(15,23,42,.04); cursor: pointer; position: relative; overflow: hidden;
        transition: transform .15s, box-shadow .15s, border-color .15s;
      }
      .tile::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--tone, #2563eb); }
      .tile[data-tone='blue']   { --tone: #2563eb; }
      .tile[data-tone='violet'] { --tone: #7c3aed; }
      .tile[data-tone='teal']   { --tone: #0d9488; }
      .tile[data-tone='amber']  { --tone: #d97706; }
      .tile[data-tone='slate']  { --tone: #475569; }
      .tile:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(15,23,42,.10); border-color: #cbd5e1; }
      .tile.is-open { box-shadow: 0 12px 32px rgba(15,23,42,.12); }
      .tile__top { display: flex; align-items: center; justify-content: space-between; }
      .tile__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; color: #64748b; }
      .tile__caret { color: #94a3b8; transition: transform .18s ease; }
      .tile.is-open .tile__caret { transform: rotate(180deg); }
      .tile__value { font-size: 2rem; font-weight: 700; color: #0f172a; line-height: 1.1; margin-top: 6px; letter-spacing: -0.02em; }
      .tile__sub { font-size: 0.75rem; color: #15803d; font-weight: 600; margin-top: 2px; }
      .tile__actions { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef2f7; }
    `,
  ],
})
export class VmwareComponent {
  private readonly vmware = inject(VmwareService);

  // form model
  host = '';
  username = '';
  password = '';
  ignoreSsl = true;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<DiscoveryResult | null>(null);
  readonly open = signal<ResourceKey | null>(null);

  readonly tiles = computed(() => {
    const r = this.result();
    if (!r) return [];
    return [
      { key: 'datacenters' as ResourceKey, label: 'Datacenters', value: r.counts.datacenters, tone: 'slate',  sub: '' },
      { key: 'clusters'    as ResourceKey, label: 'Clusters',    value: r.counts.clusters,    tone: 'violet', sub: '' },
      { key: 'hosts'       as ResourceKey, label: 'Hosts',       value: r.counts.hosts,       tone: 'teal',   sub: '' },
      { key: 'vms'         as ResourceKey, label: 'Virtual Machines', value: r.counts.vms,    tone: 'blue',
        sub: r.counts.vms ? `${r.counts.vms_powered_on} powered on` : '' },
      { key: 'datastores'  as ResourceKey, label: 'Datastores',  value: r.counts.datastores,  tone: 'amber',  sub: '' },
    ];
  });

  connect(): void {
    if (!this.host || !this.username || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    this.vmware
      .discover({ host: this.host.trim(), username: this.username.trim(), password: this.password, ignore_ssl: this.ignoreSsl })
      .subscribe({
        next: (res) => { this.result.set(res); this.loading.set(false); },
        error: (err) => {
          this.error.set(err?.error?.detail ?? err.message ?? 'Discovery failed');
          this.loading.set(false);
        },
      });
  }

  rediscover(): void { this.connect(); }

  reset(): void {
    this.result.set(null);
    this.open.set(null);
    this.password = '';
  }

  toggle(key: ResourceKey): void {
    this.open.update((cur) => (cur === key ? null : key));
  }

  download(key: ResourceKey): void {
    const r = this.result();
    if (!r) return;
    const rows = r[key] as unknown as Record<string, unknown>[];
    this.downloadCsv(`vmware-${key}-${r.vcenter.host}.csv`, rows);
  }

  private downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
