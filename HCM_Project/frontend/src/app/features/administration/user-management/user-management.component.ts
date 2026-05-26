import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminUser } from '../../../core/models/admin-user.model';
import { Role } from '../../../core/models/role.model';
import { Tenant } from '../../../core/models/tenant.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="page-head">
        <div>
          <h1>User Management</h1>
          <p>Users are bound to a tenant automatically. Sign-in is verified by the tenant's identity source.</p>
        </div>
        @if (canCreate()) {
          <button class="btn btn--primary" (click)="openCreate()">+ Create User</button>
        }
      </div>

      <!-- Identity source / LDAP login method -->
      <div class="card idsrc">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2563eb" stroke-width="1.7"><path d="M12 2 4 6v6c0 5 3.4 7.4 8 10 4.6-2.6 8-5 8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
        <div>
          <b>Identity Source — Login Method</b>
          <div class="idsrc__detail">{{ identitySource() }}</div>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input class="search-input" type="search" placeholder="Search name, username, email or role…"
                 [ngModel]="query()" (ngModelChange)="query.set($event)" />
          <span class="spacer"></span>
          <span class="muted" style="font-size:12px">{{ filtered().length }} of {{ users().length }}</span>
        </div>
        @if (loading()) {
          <div class="state"><p>Loading users…</p></div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Display Name</th><th>Username</th><th>Email</th><th>Role</th><th style="text-align:right">Action</th></tr>
              </thead>
              <tbody>
                @for (u of filtered(); track u.id) {
                  <tr>
                    <td><strong>{{ u.name || '—' }}</strong></td>
                    <td>{{ u.username || '—' }}</td>
                    <td>{{ u.email || '—' }}</td>
                    <td>@for (r of u.roles; track r) { <span class="chip">{{ r }}</span> }</td>
                    <td style="text-align:right;white-space:nowrap">
                      @if (canUpdate()) {
                        <button class="icon-btn" title="Edit" (click)="openEdit(u)" aria-label="Edit user">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                        </button>
                      }
                      @if (canDelete()) {
                        <button class="icon-btn icon-btn--danger" title="Delete" (click)="confirmDelete(u)" aria-label="Delete user">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="tbl__empty">{{ query() ? 'No users match your search.' : 'No users yet.' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    @if (modal()) {
      <div class="admin-shell"><div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal__head">
            <h3>{{ modal() === 'create' ? 'Create User' : 'Edit User' }}</h3>
            <button class="modal__x" (click)="close()">×</button>
          </div>
          <div class="modal__body">
            @if (modal() === 'create') {
              <div class="field"><label>Display Name</label><input [(ngModel)]="form.name" placeholder="Jane Doe" /></div>
              <div class="form-grid">
                <div class="field"><label>Username *</label><input [(ngModel)]="form.username" placeholder="jdoe" /></div>
                <div class="field"><label>Email</label><input [(ngModel)]="form.email" placeholder="jdoe@example.com" /></div>
              </div>
              @if (auth.isSuperAdmin() && !creatingSuperAdmin()) {
                <div class="field">
                  <label>Tenant *</label>
                  <select [(ngModel)]="form.tenant_id">
                    <option [ngValue]="null" disabled>Select a tenant…</option>
                    @for (t of tenants(); track t.id) { <option [ngValue]="t.id">{{ t.tenant_name }} ({{ t.tenant_code }})</option> }
                  </select>
                  <span class="field__hint">The user will be isolated to this tenant.</span>
                </div>
              }
            } @else {
              <p style="margin:0 0 12px;color:#64748b;font-size:.85rem">{{ editing()?.username }} — {{ editing()?.email }}</p>
              <div class="field"><label>Display Name</label><input [(ngModel)]="form.name" /></div>
              <div class="field"><label>Email</label><input [(ngModel)]="form.email" /></div>
            }

            <div class="field">
              <label>Role</label>
              <div class="role-list">
                @for (r of assignableRoles(); track r.code) {
                  <label class="role-opt">
                    <input type="checkbox" [checked]="form.roles.includes(r.code)" (change)="toggleRole(r.code)" />
                    <span>{{ r.code }}</span>
                    <span class="role-opt__name">{{ r.name }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="field" style="max-width:200px">
              <label>Status</label>
              <select [(ngModel)]="form.status">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div class="form-actions">
              <button class="btn" (click)="close()">Cancel</button>
              <button class="btn btn--primary" [disabled]="saving() || !valid()" (click)="save()">
                {{ saving() ? 'Saving…' : (modal() === 'create' ? 'Create User' : 'Save Changes') }}
              </button>
            </div>
          </div>
        </div>
      </div></div>
    }
  `,
  styles: [`
    .idsrc{display:flex;align-items:center;gap:12px;padding:14px 18px;}
    .idsrc b{font-size:13px;} .idsrc__detail{font-size:12px;color:#64748b;margin-top:2px;}
    .role-list { display:flex; flex-direction:column; gap:6px; max-height:200px; overflow:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px; }
    .role-opt { display:flex; align-items:center; gap:10px; font-size:.8125rem; cursor:pointer; padding:3px 4px; }
    .role-opt input { width:auto; }
    .role-opt__name { color:#94a3b8; font-size:.72rem; margin-left:auto; }
    .icon-btn{background:none;border:1px solid #e2e8f0;border-radius:7px;width:30px;height:30px;
      cursor:pointer;color:#64748b;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;}
    .icon-btn:hover{background:#f1f5f9;color:#0f172a;}
    .icon-btn--danger:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca;}
  `],
})
export class UserManagementComponent implements OnInit {
  private readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly users = signal<AdminUser[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly modal = signal<'create' | 'edit' | null>(null);
  readonly editing = signal<AdminUser | null>(null);
  readonly query = signal('');

  readonly canCreate = computed(() => this.auth.hasPermission('user:create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('user:update'));
  readonly canDelete = computed(() => this.auth.hasPermission('user:delete'));
  readonly creatingSuperAdmin = computed(() => this.form.roles.includes('SUPER_ADMIN'));

  readonly assignableRoles = computed(() =>
    this.roles().filter((r) => r.code !== 'SUPER_ADMIN' || this.auth.isSuperAdmin()),
  );

  /** Client-side search across name / username / email / role. */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter((u) =>
      [u.name, u.username, u.email, ...(u.roles || [])]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  });

  /** Identity source / LDAP login method for the tenant(s) in scope. */
  readonly identitySource = computed(() => {
    const ts = this.tenants();
    if (this.auth.isSuperAdmin() && ts.length !== 1) {
      return 'Configured per tenant — see Tenant Management for each tenant’s login method.';
    }
    const t = ts[0];
    if (!t) return 'Platform LDAP / Active Directory.';
    if (t.login_type === 'OWN_LDAP') {
      return `Own LDAP — ${t.ldap_server_url || 'server not set'}${t.domain_name ? ' · ' + t.domain_name : ''}`;
    }
    return 'Platform LDAP / Active Directory (shared directory).';
  });

  form: { username: string; email: string; name: string; roles: string[]; status: string; tenant_id: string | null } = this.blank();

  ngOnInit(): void {
    this.load();
    this.admin.listRoles().subscribe({ next: (r) => this.roles.set(r), error: () => undefined });
    // Tenants power both the identity-source panel and the super-admin tenant picker.
    this.admin.listTenants().subscribe({ next: (t) => this.tenants.set(t), error: () => undefined });
  }

  private blank() {
    return { username: '', email: '', name: '', roles: ['USER'], status: 'ACTIVE', tenant_id: null as string | null };
  }

  valid(): boolean {
    if (this.modal() === 'create' && !this.form.username.trim()) return false;
    if (this.modal() === 'create' && this.auth.isSuperAdmin() && !this.creatingSuperAdmin() && !this.form.tenant_id) return false;
    return true;
  }

  load(): void {
    this.loading.set(true);
    this.admin.listUsers().subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleRole(code: string): void {
    this.form.roles = this.form.roles.includes(code)
      ? this.form.roles.filter((r) => r !== code)
      : [...this.form.roles, code];
  }

  openCreate(): void { this.form = this.blank(); this.editing.set(null); this.modal.set('create'); }
  openEdit(u: AdminUser): void {
    this.editing.set(u);
    this.form = { username: u.username ?? '', email: u.email ?? '', name: u.name ?? '', roles: [...u.roles], status: u.status, tenant_id: u.tenant_id ?? null };
    this.modal.set('edit');
  }
  close(): void { this.modal.set(null); }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    const done = (msg: string) => { this.saving.set(false); this.modal.set(null); this.toast.success(msg); this.load(); };
    const fail = (e: any) => { this.saving.set(false); this.toast.error(e?.error?.detail ?? 'Operation failed'); };

    if (this.modal() === 'create') {
      this.admin.createUser({
        username: this.form.username.trim(),
        email: this.form.email.trim() || null,
        name: this.form.name.trim() || null,
        roles: this.form.roles,
        status: this.form.status,
        tenant_id: this.creatingSuperAdmin() ? null : this.form.tenant_id,
      }).subscribe({ next: (u) => done(`User “${u.username}” created`), error: fail });
    } else {
      const u = this.editing()!;
      this.admin.updateUser(u.id, { email: this.form.email.trim() || null, name: this.form.name.trim() || null, roles: this.form.roles, status: this.form.status })
        .subscribe({ next: () => done('User updated'), error: fail });
    }
  }

  confirmDelete(u: AdminUser): void {
    if (!confirm(`Delete user “${u.username}”? This cannot be undone.`)) return;
    this.admin.deleteUser(u.id).subscribe({
      next: () => { this.toast.success(`User “${u.username}” deleted`); this.load(); },
      error: (e) => this.toast.error(e?.error?.detail ?? 'Delete failed'),
    });
  }
}
