import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { AuthService } from '@services/auth.service';
import { ToastService } from '@services/toast.service';
import { Permission, Role } from '@models/role.model';

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
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly roles = signal<Role[]>([]);
  readonly permissions = signal<Permission[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showModal = signal(false);

  readonly canCreate = computed(() => this.auth.hasPermission('role:create'));
  readonly canDelete = computed(() => this.auth.hasPermission('role:delete'));

  form: { code: string; name: string; description: string; permissions: string[] } = this.blank();

  ngOnInit(): void {
    this.load();
    if (this.auth.hasPermission('permission:read')) {
      this.admin.listPermissions().subscribe({ next: (p) => this.permissions.set(p), error: () => undefined });
    }
  }

  private blank() { return { code: '', name: '', description: '', permissions: [] as string[] }; }
  valid(): boolean { return !!(this.form.code.trim() && this.form.name.trim()); }

  load(): void {
    this.loading.set(true);
    this.admin.listRoles().subscribe({
      next: (r) => { this.roles.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  open(): void { this.form = this.blank(); this.showModal.set(true); }
  close(): void { this.showModal.set(false); }
  toggle(code: string): void {
    this.form.permissions = this.form.permissions.includes(code)
      ? this.form.permissions.filter((c) => c !== code)
      : [...this.form.permissions, code];
  }

  create(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    this.admin.createRole({ code: this.form.code.trim().toUpperCase(), name: this.form.name.trim(), description: this.form.description.trim() || null, permissions: this.form.permissions })
      .subscribe({
        next: (r) => { this.saving.set(false); this.showModal.set(false); this.toast.success(`Role “${r.code}” created`); this.load(); },
        error: (e) => { this.saving.set(false); this.toast.error(e?.error?.detail ?? 'Could not create role'); },
      });
  }

  remove(r: Role): void {
    this.admin.deleteRole(r.id).subscribe({
      next: () => { this.toast.success(`Role “${r.code}” deleted`); this.load(); },
      error: (e) => this.toast.error(e?.error?.detail ?? 'Delete failed'),
    });
  }
}
