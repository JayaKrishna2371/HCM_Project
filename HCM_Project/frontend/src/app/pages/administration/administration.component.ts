import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@services/auth.service';
import { AdminService } from '@services/admin.service';
import { TenantContextService } from '@services/tenant-context.service';
import { Tenant } from '@models/tenant.model';

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
  templateUrl: './administration.component.html',
  styleUrls: ['./administration.component.css'],
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
