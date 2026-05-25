import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Permission, Role } from '../../../core/models/role.model';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="page-head">
        <div>
          <h1>Role Management</h1>
          <p>Built-in system roles plus custom roles scoped to your tenant.</p>
        </div>
        @if (canCreate()) { <button class="btn btn--primary" (click)="open()">+ Custom Role</button> }
      </div>

      <div class="card">
        @if (loading()) { <div class="state"><p>Loading roles…</p></div> }
        @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Permissions</th><th></th></tr></thead>
              <tbody>
                @for (r of roles(); track r.id) {
                  <tr>
                    <td><strong>{{ r.code }}</strong></td>
                    <td>{{ r.name }}</td>
                    <td><span class="badge" [class.badge--ok]="!r.is_system" [class.badge--off]="r.is_system">{{ r.is_system ? 'System' : 'Custom' }}</span></td>
                    <td>
                      @if (r.permissions.includes('*')) { <span class="chip">all permissions</span> }
                      @else { @for (p of r.permissions.slice(0,6); track p) { <span class="chip chip--muted">{{ p }}</span> } @if (r.permissions.length>6) { <span class="chip chip--muted">+{{ r.permissions.length-6 }}</span> } }
                    </td>
                    <td style="text-align:right">
                      @if (!r.is_system && canDelete()) { <button class="btn btn--sm btn--danger" (click)="remove(r)">Delete</button> }
                    </td>
                  </tr>
                } @empty { <tr><td colspan="5" class="tbl__empty">No roles.</td></tr> }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    @if (showModal()) {
      <div class="admin-shell"><div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal__head"><h3>New Custom Role</h3><button class="modal__x" (click)="close()">×</button></div>
          <div class="modal__body">
            <div class="form-grid">
              <div class="field"><label>Code *</label><input [(ngModel)]="form.code" placeholder="AUDITOR" /></div>
              <div class="field"><label>Name *</label><input [(ngModel)]="form.name" placeholder="Auditor" /></div>
            </div>
            <div class="field"><label>Description</label><input [(ngModel)]="form.description" placeholder="What this role is for" /></div>
            <div class="field">
              <label>Permissions ({{ form.permissions.length }} selected)</label>
              <div class="perm-list">
                @for (p of permissions(); track p.code) {
                  @if (p.code !== '*') {
                    <label class="perm-opt">
                      <input type="checkbox" [checked]="form.permissions.includes(p.code)" (change)="toggle(p.code)" />
                      <span>{{ p.code }}</span><span class="perm-opt__d">{{ p.description }}</span>
                    </label>
                  }
                }
              </div>
            </div>
            <div class="form-actions">
              <button class="btn" (click)="close()">Cancel</button>
              <button class="btn btn--primary" [disabled]="saving() || !valid()" (click)="create()">{{ saving() ? 'Creating…' : 'Create Role' }}</button>
            </div>
          </div>
        </div>
      </div></div>
    }
  `,
  styles: [`
    .perm-list { display:grid; grid-template-columns:1fr 1fr; gap:4px 14px; max-height:260px; overflow:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px; }
    .perm-opt { display:flex; align-items:center; gap:8px; font-size:.78rem; cursor:pointer; }
    .perm-opt input { width:auto; }
    .perm-opt__d { color:#94a3b8; font-size:.68rem; margin-left:auto; text-align:right; }
    @media (max-width:640px){ .perm-list{ grid-template-columns:1fr; } }
  `],
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
