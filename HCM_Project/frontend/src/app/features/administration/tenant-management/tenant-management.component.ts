import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoginType, Tenant, TenantCreate } from '../../../core/models/tenant.model';

type Mode = 'create' | 'edit' | null;

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="page-head">
        <div>
          <h1>Tenant Management</h1>
          <p>Onboard and manage organizations. <strong>HCAP</strong> is the master tenant; all others are isolated Business Units.</p>
        </div>
        @if (canCreate()) {
          <button class="btn btn--primary" (click)="openCreate()">+ New Tenant</button>
        }
      </div>

      <div class="card">
        @if (loading()) {
          <div class="state"><p>Loading tenants…</p></div>
        } @else if (error()) {
          <div class="state"><strong style="color:#b91c1c">{{ error() }}</strong></div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Name</th><th>Role</th><th># Users</th><th>Status</th><th>Date Created</th><th style="text-align:right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tenants(); track t.id) {
                  <tr>
                    <td>
                      <strong>{{ t.tenant_name }}</strong>
                      @if (t.is_master) { <span class="chip" style="margin-left:6px">MASTER</span> }
                      <div class="muted" style="font-size:11px">{{ t.tenant_code }}</div>
                    </td>
                    <td><span class="chip chip--muted">{{ t.base_role }}</span></td>
                    <td>{{ t.user_count }}</td>
                    <td>
                      <span class="badge" [class.badge--ok]="t.status==='ACTIVE'" [class.badge--off]="t.status==='INACTIVE'" [class.badge--warn]="t.status==='SUSPENDED'">{{ t.status }}</span>
                    </td>
                    <td>{{ t.created_at | date:'mediumDate' }}</td>
                    <td style="text-align:right;white-space:nowrap">
                      @if (canUpdate()) {
                        <button class="icon-btn" title="Edit" (click)="openEdit(t)" aria-label="Edit tenant">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                        </button>
                        <button class="icon-btn icon-btn--danger" title="Delete" (click)="confirmDelete(t)"
                                [disabled]="t.is_master" aria-label="Delete tenant">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="tbl__empty">No tenants yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    @if (mode()) {
      <div class="admin-shell"><div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal__head">
            <h3>{{ mode() === 'create' ? 'Onboard New Tenant' : 'Edit Tenant' }}</h3>
            <button class="modal__x" (click)="close()">×</button>
          </div>
          <div class="modal__body">
            <div class="form-grid">
              <div class="field">
                <label>Tenant Code *</label>
                <input [(ngModel)]="form.tenant_code" [disabled]="mode()==='edit'" placeholder="e.g. FINANCE" />
                <span class="field__hint">Unique BU code / domain.</span>
              </div>
              <div class="field">
                <label>Tenant Name *</label>
                <input [(ngModel)]="form.tenant_name" placeholder="e.g. Finance Business Unit" />
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label>Base Role *</label>
                <select [(ngModel)]="form.base_role">
                  <option value="USER">USER</option>
                  <option value="READ_ONLY">READ_ONLY</option>
                  <option value="APPROVER">APPROVER</option>
                  <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                </select>
                <span class="field__hint">Default role for this tenant's users.</span>
              </div>
              <div class="field">
                <label>Login Type *</label>
                <select [(ngModel)]="form.login_type">
                  <option value="PLATFORM_LDAP">Platform LDAP</option>
                  <option value="OWN_LDAP">Own LDAP</option>
                </select>
              </div>
            </div>
            @if (form.login_type === 'OWN_LDAP') {
              <div class="field">
                <label>LDAP Server URL *</label>
                <input [(ngModel)]="form.ldap_server_url" placeholder="ldaps://dc.bu.example.com:636" />
              </div>
              <div class="form-grid">
                <div class="field"><label>Domain Name *</label><input [(ngModel)]="form.domain_name" placeholder="bu.example.com" /></div>
                <div class="field"><label>DC Name</label><input [(ngModel)]="form.dc_name" placeholder="DC=bu,DC=example,DC=com" /></div>
              </div>
            }
            <div class="form-actions">
              <button class="btn" (click)="close()">Cancel</button>
              <button class="btn btn--primary" [disabled]="saving() || !valid()" (click)="save()">
                {{ saving() ? 'Saving…' : (mode() === 'create' ? 'Create Tenant' : 'Save Changes') }}
              </button>
            </div>
          </div>
        </div>
      </div></div>
    }
  `,
  styles: [`
    .icon-btn{background:none;border:1px solid #e2e8f0;border-radius:7px;width:30px;height:30px;
      cursor:pointer;color:#64748b;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;}
    .icon-btn:hover{background:#f1f5f9;color:#0f172a;}
    .icon-btn--danger:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca;}
    .icon-btn:disabled{opacity:.35;cursor:not-allowed;}
  `],
})
export class TenantManagementComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly mode = signal<Mode>(null);
  readonly saving = signal(false);
  readonly editing = signal<Tenant | null>(null);

  readonly canCreate = computed(() => this.auth.hasPermission('tenant:create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('tenant:update'));

  form: TenantCreate = this.blank();

  ngOnInit(): void { this.load(); }

  private blank(): TenantCreate {
    return { tenant_code: '', tenant_name: '', login_type: 'PLATFORM_LDAP' as LoginType, base_role: 'USER' };
  }

  valid(): boolean {
    if (!this.form.tenant_code.trim() || !this.form.tenant_name.trim()) return false;
    if (this.form.login_type === 'OWN_LDAP') {
      return !!(this.form.ldap_server_url?.trim() && this.form.domain_name?.trim());
    }
    return true;
  }

  load(): void {
    this.loading.set(true);
    this.admin.listTenants().subscribe({
      next: (t) => { this.tenants.set(t); this.loading.set(false); },
      error: (e) => { this.error.set(e?.error?.detail ?? 'Unable to load tenants'); this.loading.set(false); },
    });
  }

  openCreate(): void { this.form = this.blank(); this.editing.set(null); this.mode.set('create'); }

  openEdit(t: Tenant): void {
    this.editing.set(t);
    this.form = {
      tenant_code: t.tenant_code, tenant_name: t.tenant_name, login_type: t.login_type,
      base_role: t.base_role, ldap_server_url: t.ldap_server_url, domain_name: t.domain_name, dc_name: t.dc_name,
    };
    this.mode.set('edit');
  }

  close(): void { this.mode.set(null); }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    const done = (msg: string) => { this.saving.set(false); this.mode.set(null); this.toast.success(msg); this.load(); };
    const fail = (e: any) => { this.saving.set(false); this.toast.error(e?.error?.detail ?? 'Operation failed'); };

    if (this.mode() === 'create') {
      this.admin.createTenant(this.form).subscribe({ next: (t) => done(`Tenant “${t.tenant_name}” created`), error: fail });
    } else {
      const t = this.editing()!;
      this.admin.updateTenant(t.id, {
        tenant_name: this.form.tenant_name, login_type: this.form.login_type, base_role: this.form.base_role,
        ldap_server_url: this.form.ldap_server_url, domain_name: this.form.domain_name, dc_name: this.form.dc_name,
      }).subscribe({ next: () => done('Tenant updated'), error: fail });
    }
  }

  confirmDelete(t: Tenant): void {
    if (t.is_master) return;
    if (!confirm(`Delete tenant “${t.tenant_name}”? This removes its users, roles and data. This cannot be undone.`)) return;
    this.admin.deleteTenant(t.id).subscribe({
      next: () => { this.toast.success(`Tenant “${t.tenant_name}” deleted`); this.load(); },
      error: (e) => this.toast.error(e?.error?.detail ?? 'Delete failed'),
    });
  }
}
