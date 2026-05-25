import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoginType, Tenant, TenantCreate } from '../../../core/models/tenant.model';

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
          <p>Onboard and manage Business Units. Each tenant is fully isolated.</p>
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
                <tr><th>Name</th><th>Code</th><th>Login Type</th><th>Status</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                @for (t of tenants(); track t.id) {
                  <tr>
                    <td><strong>{{ t.tenant_name }}</strong></td>
                    <td><span class="chip chip--muted">{{ t.tenant_code }}</span></td>
                    <td>{{ t.login_type === 'OWN_LDAP' ? 'Own LDAP' : 'Platform LDAP' }}</td>
                    <td>
                      <span class="badge" [class.badge--ok]="t.status==='ACTIVE'" [class.badge--off]="t.status==='INACTIVE'" [class.badge--warn]="t.status==='SUSPENDED'">{{ t.status }}</span>
                    </td>
                    <td>{{ t.created_at | date:'mediumDate' }}</td>
                    <td style="text-align:right">
                      @if (canUpdate()) {
                        <button class="btn btn--sm" [class.btn--danger]="t.status==='ACTIVE'" (click)="toggleStatus(t)">
                          {{ t.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
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

    @if (showCreate()) {
      <div class="admin-shell"><div class="modal-backdrop" (click)="closeCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal__head">
            <h3>Onboard New Tenant</h3>
            <button class="modal__x" (click)="closeCreate()">×</button>
          </div>
          <div class="modal__body">
            <div class="form-grid">
              <div class="field">
                <label>Tenant Code *</label>
                <input [(ngModel)]="form.tenant_code" placeholder="e.g. FINANCE" />
                <span class="field__hint">Unique BU code / domain.</span>
              </div>
              <div class="field">
                <label>Tenant Name *</label>
                <input [(ngModel)]="form.tenant_name" placeholder="e.g. Finance Business Unit" />
              </div>
            </div>
            <div class="field">
              <label>Login Type *</label>
              <select [(ngModel)]="form.login_type">
                <option value="PLATFORM_LDAP">Platform LDAP</option>
                <option value="OWN_LDAP">Own LDAP</option>
              </select>
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
              <button class="btn" (click)="closeCreate()">Cancel</button>
              <button class="btn btn--primary" [disabled]="saving() || !valid()" (click)="create()">
                {{ saving() ? 'Creating…' : 'Create Tenant' }}
              </button>
            </div>
          </div>
        </div>
      </div></div>
    }
  `,
})
export class TenantManagementComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showCreate = signal(false);
  readonly saving = signal(false);

  readonly canCreate = computed(() => this.auth.hasPermission('tenant:create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('tenant:update'));

  form: TenantCreate = this.blank();

  ngOnInit(): void { this.load(); }

  private blank(): TenantCreate {
    return { tenant_code: '', tenant_name: '', login_type: 'PLATFORM_LDAP' as LoginType };
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

  openCreate(): void { this.form = this.blank(); this.showCreate.set(true); }
  closeCreate(): void { this.showCreate.set(false); }

  create(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    this.admin.createTenant(this.form).subscribe({
      next: (t) => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.toast.success(`Tenant “${t.tenant_name}” created`);
        this.load();
      },
      error: (e) => { this.saving.set(false); this.toast.error(e?.error?.detail ?? 'Could not create tenant'); },
    });
  }

  toggleStatus(t: Tenant): void {
    const next = t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.admin.updateTenant(t.id, { status: next }).subscribe({
      next: () => { this.toast.success(`${t.tenant_name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}`); this.load(); },
      error: (e) => this.toast.error(e?.error?.detail ?? 'Update failed'),
    });
  }
}
