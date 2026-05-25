import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { Tenant } from '../../core/models/tenant.model';

interface AdminNavItem {
  label: string;
  path: string;
  icon: string;
  /** Any of these permissions grants visibility. */
  perms: string[];
}

@Component({
  selector: 'app-administration',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell layout">
      <!-- icon sprite -->
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        <symbol id="ai-tenant" viewBox="0 0 24 24"><path d="M4 21V7l8-4 8 4v14M4 21h16M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01M8 13h.01M12 13h.01M16 13h.01" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
        <symbol id="ai-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 6.5a2.6 2.6 0 0 1 0 5M18 20c-.3-2-1.4-3.4-3-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
        <symbol id="ai-role" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
        <symbol id="ai-perm" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
        <symbol id="ai-ldap" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
        <symbol id="ai-audit" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v5h5M9.5 13l2 2 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
        <symbol id="ai-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M19 13v-2l-2-.4-.7-1.6 1.1-1.7-1.4-1.4L14.3 6 12.7 5.3 12.3 3h-2l-.4 2.3L8.3 6 6.6 4.9 5.2 6.3 6.3 8l-.7 1.6L4 10v2l2 .4.7 1.6-1.1 1.7 1.4 1.4 1.7-1.1 1.6.7.4 2.3h2l.4-2.3 1.6-.7 1.7 1.1 1.4-1.4-1.1-1.7.7-1.6z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></symbol>
        <symbol id="ai-platform" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="11" width="18" height="5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 6.5h.01M6.5 13.5h.01M12 19v2M9 21h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
        <symbol id="ai-infra" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
        <symbol id="ai-access" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c.7-3.6 3.4-5.5 7-5.5s6.3 1.9 7 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
      </defs></svg>

      <!-- Topbar -->
      <header class="topbar">
        <a class="back" routerLink="/dashboard" title="Back to dashboard">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <span class="brand">ADMINISTRATION</span>

        @if (auth.isSuperAdmin()) {
          <div class="tenant-switch">
            <label>Tenant context</label>
            <select [value]="activeTenant() ?? ''" (change)="onSwitch($event)">
              <option value="">Platform-wide (all tenants)</option>
              @for (t of tenants(); track t.id) {
                <option [value]="t.id">{{ t.tenant_name }} ({{ t.tenant_code }})</option>
              }
            </select>
          </div>
        }

        <div class="right">
          <span class="role-pill">{{ auth.primaryRole() ?? 'USER' }}</span>
          <button class="user" type="button" (click)="logout()" [title]="auth.profile()?.email ?? 'Sign out'">
            <span class="avatar">{{ initial() }}</span>
            <span class="uname">{{ displayName() }}</span>
          </button>
        </div>
      </header>

      <!-- Sidebar -->
      <aside class="sidebar">
        <nav>
          @for (item of visibleNav(); track item.path) {
            <a class="nav-item" [routerLink]="item.path" routerLinkActive="is-active">
              <svg class="nav-icon" width="19" height="19"><use [attr.href]="'#ai-' + item.icon"></use></svg>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="sidebar__foot">
          <span class="muted">Signed in as</span>
          <strong>{{ auth.profile()?.username ?? displayName() }}</strong>
        </div>
      </aside>

      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#f6f8fc; }
    .layout {
      display:grid; grid-template-columns:248px 1fr; grid-template-rows:60px 1fr;
      grid-template-areas: 'topbar topbar' 'sidebar main'; min-height:100vh;
    }
    .topbar {
      grid-area:topbar; display:flex; align-items:center; gap:16px; padding:0 20px;
      background:#fff; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:5;
    }
    .back { width:34px; height:34px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:#64748b; border:1px solid #e2e8f0; }
    .back:hover { background:#f1f5f9; color:#0f172a; }
    .brand { font-weight:700; letter-spacing:.06em; font-size:.8125rem; background:linear-gradient(90deg,#2563eb,#0284c7); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .tenant-switch { display:flex; align-items:center; gap:8px; margin-left:18px; }
    .tenant-switch label { font-size:.7rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
    .tenant-switch select { font:inherit; font-size:.8125rem; padding:6px 10px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; }
    .right { margin-left:auto; display:flex; align-items:center; gap:12px; }
    .role-pill { font-size:.6875rem; font-weight:700; letter-spacing:.04em; color:#2563eb; background:#eff5ff; border:1px solid #dbe7ff; padding:4px 10px; border-radius:999px; }
    .user { display:inline-flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer; padding:4px 8px 4px 4px; border-radius:999px; color:#0f172a; }
    .user:hover { background:#f1f5f9; }
    .avatar { width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,#2563eb,#0284c7); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:.8rem; font-weight:700; }
    .uname { font-size:.85rem; font-weight:600; }
    .sidebar { grid-area:sidebar; background:#fff; border-right:1px solid #e2e8f0; padding:14px 12px; display:flex; flex-direction:column; }
    nav { display:flex; flex-direction:column; gap:2px; }
    .nav-item { display:flex; align-items:center; gap:12px; padding:9px 12px; border-radius:8px; font-size:.8438rem; font-weight:500; color:#334155; cursor:pointer; }
    .nav-item:hover { background:#f1f5f9; color:#0f172a; }
    .nav-item.is-active { background:#eff5ff; color:#2563eb; font-weight:600; }
    .nav-icon { color:inherit; flex-shrink:0; }
    .sidebar__foot { margin-top:auto; padding:12px; border-top:1px solid #eef2f7; display:flex; flex-direction:column; gap:2px; }
    .sidebar__foot .muted { font-size:.65rem; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; font-weight:600; }
    .sidebar__foot strong { font-size:.8125rem; color:#334155; }
    .main { grid-area:main; padding:24px 32px 40px; overflow-x:hidden; }
    @media (max-width:820px){ .layout{ grid-template-columns:1fr; grid-template-areas:'topbar' 'main'; } .sidebar{ display:none; } .tenant-switch{ display:none; } }
  `],
})
export class AdministrationComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly router = inject(Router);

  readonly tenants = signal<Tenant[]>([]);
  readonly activeTenant = this.tenantCtx.activeTenantId;

  private readonly nav: AdminNavItem[] = [
    { label: 'Tenant Management',       path: 'tenant-management',       icon: 'tenant',   perms: ['tenant:read'] },
    { label: 'User Management',         path: 'user-management',         icon: 'users',    perms: ['user:read'] },
    { label: 'Role Management',         path: 'role-management',         icon: 'role',     perms: ['role:read'] },
    { label: 'Permissions',             path: 'permissions',             icon: 'perm',     perms: ['permission:read'] },
    { label: 'LDAP Configuration',      path: 'ldap-config',             icon: 'ldap',     perms: ['ldap:read'] },
    { label: 'Audit Logs',              path: 'audit-logs',              icon: 'audit',    perms: ['audit:read'] },
    { label: 'Tenant Settings',         path: 'tenant-settings',         icon: 'settings', perms: ['tenant_settings:read'] },
    { label: 'Platform Settings',       path: 'platform-settings',       icon: 'platform', perms: ['platform_settings:manage'] },
    { label: 'Infrastructure Isolation', path: 'infrastructure-isolation', icon: 'infra',  perms: ['infra:read'] },
    { label: 'Access Control',          path: 'access-control',          icon: 'access',   perms: ['access_control:read'] },
  ];

  readonly visibleNav = computed(() =>
    this.nav.filter((i) => this.auth.hasAnyPermission(...i.perms)),
  );

  readonly displayName = computed(() => {
    const p = this.auth.profile();
    return p?.given_name ?? p?.name ?? p?.username ?? 'Admin';
  });
  readonly initial = computed(() => (this.displayName()[0] ?? 'A').toUpperCase());

  ngOnInit(): void {
    // Super admins need the tenant list to drive the context switcher.
    if (this.auth.isSuperAdmin()) {
      this.admin.listTenants().subscribe({
        next: (t) => this.tenants.set(t),
        error: () => undefined,
      });
    }
  }

  onSwitch(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    this.tenantCtx.switchTo(value || null);
    // Re-trigger the active route's data load by navigating to itself.
    const url = this.router.url;
    this.router.navigateByUrl('/administration', { skipLocationChange: true }).then(() =>
      this.router.navigateByUrl(url),
    );
  }

  logout(): void { this.auth.logout(); }
}
