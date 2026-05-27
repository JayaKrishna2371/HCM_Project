import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { AuthService } from '@services/auth.service';
import { ToastService } from '@services/toast.service';
import { AdminUser } from '@models/admin-user.model';
import { Role } from '@models/role.model';
import { Tenant } from '@models/tenant.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
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
  /** SUPER_ADMIN tenant filter — '' means all tenants. */
  readonly tenantFilter = signal<string>('');

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
    // SUPER_ADMIN: '' tenant filter => all tenants; otherwise the chosen tenant.
    const scope = this.auth.isSuperAdmin() ? (this.tenantFilter() || null) : null;
    this.admin.listUsers(scope).subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onTenantFilter(value: string): void {
    this.tenantFilter.set(value);
    this.load();
  }

  /** Tenant name for the table's Tenant column (super-admin all-tenants view). */
  tenantName(id: string | null | undefined): string {
    if (!id) return '—';
    return this.tenants().find((t) => t.id === id)?.tenant_name ?? '—';
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
