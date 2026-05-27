import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { AuthService } from '@services/auth.service';
import { ToastService } from '@services/toast.service';
import { LoginType, Tenant, TenantCreate } from '@models/tenant.model';

type Mode = 'create' | 'edit' | null;

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-management.component.html',
  styleUrls: ['./tenant-management.component.css'],
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
