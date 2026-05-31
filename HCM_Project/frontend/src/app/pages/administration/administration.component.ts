import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@services/auth.service';

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
export class AdministrationComponent {
  readonly auth = inject(AuthService);

  private readonly nav: AdminNavItem[] = [
    { label: 'Tenant Management',  path: 'tenant-management',  icon: 'tenant', perms: ['tenant:read'] },
    { label: 'User Management',    path: 'user-management',    icon: 'users',  perms: ['user:read'] },
    { label: 'Role Management',    path: 'role-management',    icon: 'role',   perms: ['role:read'] },
    { label: 'LDAP Configuration', path: 'ldap-config',        icon: 'ldap',   perms: ['ldap:read'] },
    { label: 'Audit Logs',         path: 'audit-logs',         icon: 'audit',  perms: ['audit:read'] },
    // Hidden per request: Permissions, Tenant Settings, Platform Settings,
    // Infrastructure Isolation, Access Control (routes remain but are off-nav).
  ];

  readonly visibleNav = computed(() =>
    this.nav.filter((i) => this.auth.hasAnyPermission(...i.perms)),
  );

  readonly displayName = computed(() => {
    const p = this.auth.profile();
    return p?.given_name ?? p?.name ?? p?.username ?? 'Admin';
  });
  readonly initial = computed(() => (this.displayName()[0] ?? 'A').toUpperCase());

  logout(): void { this.auth.logout(); }
}
