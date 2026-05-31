import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { AuthService } from '@services/auth.service';
import { ToastService } from '@services/toast.service';
import { Permission, Role } from '@models/role.model';
import { Tenant } from '@models/tenant.model';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.css'],
})
export class RoleManagementComponent implements OnInit {
  private readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly roles = signal<Role[]>([]);
  readonly permissions = signal<Permission[]>([]);
  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showModal = signal(false);
  /** SUPER_ADMIN tenant filter ('' = all). */
  readonly tenantFilter = signal<string>('');

  readonly canCreate = computed(() => this.auth.hasPermission('role:create'));
  readonly canDelete = computed(() => this.auth.hasPermission('role:delete'));

  form: { code: string; name: string; description: string; permissions: string[]; tenant_id: string | null }
    = this.blank();

  ngOnInit(): void {
    this.load();
    if (this.auth.hasPermission('permission:read')) {
      this.admin.listPermissions().subscribe({ next: (p) => this.permissions.set(p), error: () => undefined });
    }
    // Tenants power the filter dropdown + the create-form target picker (super admin).
    this.admin.listTenants().subscribe({ next: (t) => this.tenants.set(t), error: () => undefined });
  }

  private blank() {
    return { code: '', name: '', description: '', permissions: [] as string[], tenant_id: null as string | null };
  }

  valid(): boolean {
    if (!this.form.code.trim() || !this.form.name.trim()) return false;
    // A SUPER_ADMIN must say which tenant the custom role belongs to.
    if (this.auth.isSuperAdmin() && !this.form.tenant_id) return false;
    return true;
  }

  load(): void {
    this.loading.set(true);
    const scope = this.auth.isSuperAdmin() ? (this.tenantFilter() || null) : null;
    this.admin.listRoles(scope).subscribe({
      next: (r) => { this.roles.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onTenantFilter(value: string): void {
    this.tenantFilter.set(value);
    this.load();
  }

  /** Tenant name for the table's Tenant column. */
  tenantName(id: string | null | undefined): string {
    if (!id) return 'System';
    return this.tenants().find((t) => t.id === id)?.tenant_name ?? '—';
  }

  open(): void {
    this.form = this.blank();
    // Pre-fill the create form with the currently filtered tenant for convenience.
    if (this.auth.isSuperAdmin() && this.tenantFilter()) {
      this.form.tenant_id = this.tenantFilter();
    }
    this.showModal.set(true);
  }
  close(): void { this.showModal.set(false); }

  toggle(code: string): void {
    this.form.permissions = this.form.permissions.includes(code)
      ? this.form.permissions.filter((c) => c !== code)
      : [...this.form.permissions, code];
  }

  create(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    this.admin.createRole({
      code: this.form.code.trim().toUpperCase(),
      name: this.form.name.trim(),
      description: this.form.description.trim() || null,
      permissions: this.form.permissions,
      tenant_id: this.auth.isSuperAdmin() ? this.form.tenant_id : null,
    }).subscribe({
      next: (r) => { this.saving.set(false); this.showModal.set(false); this.toast.success(`Role “${r.code}” created`); this.load(); },
      error: (e) => { this.saving.set(false); this.toast.error(e?.error?.detail ?? 'Could not create role'); },
    });
  }

  remove(r: Role): void {
    if (!confirm(`Delete role “${r.code}”? This cannot be undone.`)) return;
    this.admin.deleteRole(r.id).subscribe({
      next: () => { this.toast.success(`Role “${r.code}” deleted`); this.load(); },
      error: (e) => this.toast.error(e?.error?.detail ?? 'Delete failed'),
    });
  }
}
