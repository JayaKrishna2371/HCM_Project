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
          <p>Users are scoped to a tenant. Every user you create is bound to a tenant automatically.</p>
        </div>
        @if (canCreate()) {
          <button class="btn btn--primary" (click)="openCreate()">+ New User</button>
        }
      </div>

      <div class="card">
        @if (loading()) {
          <div class="state"><p>Loading users…</p></div>
        } @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Name</th><th>Username</th><th>Email</th><th>Roles</th><th>Status</th><th>Last login</th><th></th></tr>
              </thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr>
                    <td><strong>{{ u.name || '—' }}</strong></td>
                    <td>{{ u.username || '—' }}</td>
                    <td>{{ u.email || '—' }}</td>
                    <td>@for (r of u.roles; track r) { <span class="chip">{{ r }}</span> }</td>
                    <td><span class="badge" [class.badge--ok]="u.status==='ACTIVE'" [class.badge--off]="u.status!=='ACTIVE'">{{ u.status }}</span></td>
                    <td>{{ u.last_login_at ? (u.last_login_at | date:'short') : 'never' }}</td>
                    <td style="text-align:right">
                      @if (canUpdate()) { <button class="btn btn--sm" (click)="openEdit(u)">Edit</button> }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="tbl__empty">No users yet.</td></tr>
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
              <div class="form-grid">
                <div class="field"><label>Username *</label><input [(ngModel)]="form.username" placeholder="jdoe" /></div>
                <div class="field"><label>Email</label><input [(ngModel)]="form.email" placeholder="jdoe@example.com" /></div>
              </div>
              <div class="field"><label>Display Name</label><input [(ngModel)]="form.name" placeholder="Jane Doe" /></div>
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
            }

            <div class="field">
              <label>Roles</label>
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
    .role-list { display:flex; flex-direction:column; gap:6px; max-height:200px; overflow:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px; }
    .role-opt { display:flex; align-items:center; gap:10px; font-size:.8125rem; cursor:pointer; padding:3px 4px; }
    .role-opt input { width:auto; }
    .role-opt__name { color:#94a3b8; font-size:.72rem; margin-left:auto; }
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

  readonly canCreate = computed(() => this.auth.hasPermission('user:create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('user:update'));
  readonly creatingSuperAdmin = computed(() => this.form.roles.includes('SUPER_ADMIN'));

  /** Hide SUPER_ADMIN from the option list unless the caller is a super admin. */
  readonly assignableRoles = computed(() =>
    this.roles().filter((r) => r.code !== 'SUPER_ADMIN' || this.auth.isSuperAdmin()),
  );

  form: { username: string; email: string; name: string; roles: string[]; status: string; tenant_id: string | null } = this.blank();

  ngOnInit(): void {
    this.load();
    this.admin.listRoles().subscribe({ next: (r) => this.roles.set(r), error: () => undefined });
    if (this.auth.isSuperAdmin()) {
      this.admin.listTenants().subscribe({ next: (t) => this.tenants.set(t), error: () => undefined });
    }
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
}
