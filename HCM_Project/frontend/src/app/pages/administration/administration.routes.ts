import { Routes } from '@angular/router';

import { permissionGuard } from '@guards/permission.guard';
import { AdministrationComponent } from './administration.component';

/**
 * Lazy-loaded Administration routes. Each sub-page is itself lazily imported and
 * guarded by the matching permission (defence in depth on top of the client-side
 * menu filtering). Pages without a dedicated backend yet reuse the shared
 * SectionPlaceholderComponent, fed by route `data` via component input binding.
 */
export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: '',
    component: AdministrationComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tenant-management' },
      {
        path: 'tenant-management',
        canActivate: [permissionGuard('tenant:read')],
        loadComponent: () =>
          import('./tenant-management/tenant-management.component').then((m) => m.TenantManagementComponent),
        title: 'Tenant Management — Administration',
      },
      {
        path: 'user-management',
        canActivate: [permissionGuard('user:read')],
        loadComponent: () =>
          import('./user-management/user-management.component').then((m) => m.UserManagementComponent),
        title: 'User Management — Administration',
      },
      {
        path: 'role-management',
        canActivate: [permissionGuard('role:read')],
        loadComponent: () =>
          import('./role-management/role-management.component').then((m) => m.RoleManagementComponent),
        title: 'Role Management — Administration',
      },
      {
        path: 'permissions',
        canActivate: [permissionGuard('permission:read')],
        loadComponent: () =>
          import('./permissions/permissions.component').then((m) => m.PermissionsComponent),
        title: 'Permissions — Administration',
      },
      {
        path: 'audit-logs',
        canActivate: [permissionGuard('audit:read')],
        loadComponent: () =>
          import('./audit-logs/audit-logs.component').then((m) => m.AuditLogsComponent),
        title: 'Audit Logs — Administration',
      },
      {
        path: 'ldap-config',
        canActivate: [permissionGuard('ldap:read')],
        loadComponent: () =>
          import('./section-placeholder/section-placeholder.component').then((m) => m.SectionPlaceholderComponent),
        data: {
          title: 'LDAP Configuration',
          description: 'Configure the directory used to authenticate this tenant (Platform LDAP or Own LDAP). Backend wiring lands in Phase 3.',
          icon: 'ldap',
        },
        title: 'LDAP Configuration — Administration',
      },
      {
        path: 'tenant-settings',
        canActivate: [permissionGuard('tenant_settings:read')],
        loadComponent: () =>
          import('./section-placeholder/section-placeholder.component').then((m) => m.SectionPlaceholderComponent),
        data: {
          title: 'Tenant Settings',
          description: 'Branding, defaults and policies scoped to your tenant.',
          icon: 'settings',
        },
        title: 'Tenant Settings — Administration',
      },
      {
        path: 'platform-settings',
        canActivate: [permissionGuard('platform_settings:manage')],
        loadComponent: () =>
          import('./section-placeholder/section-placeholder.component').then((m) => m.SectionPlaceholderComponent),
        data: {
          title: 'Platform Settings',
          description: 'Global configuration for the whole platform. Super Admin only.',
          icon: 'platform',
        },
        title: 'Platform Settings — Administration',
      },
      {
        path: 'infrastructure-isolation',
        canActivate: [permissionGuard('infra:read')],
        loadComponent: () =>
          import('./section-placeholder/section-placeholder.component').then((m) => m.SectionPlaceholderComponent),
        data: {
          title: 'Infrastructure Isolation',
          description: 'Per-tenant Kubernetes namespaces, resource tags and network policies. See the design doc for the model.',
          icon: 'infra',
        },
        title: 'Infrastructure Isolation — Administration',
      },
      {
        path: 'access-control',
        canActivate: [permissionGuard('access_control:read')],
        loadComponent: () =>
          import('./section-placeholder/section-placeholder.component').then((m) => m.SectionPlaceholderComponent),
        data: {
          title: 'Access Control',
          description: 'Fine-grained access policies and assignments within your tenant.',
          icon: 'access',
        },
        title: 'Access Control — Administration',
      },
      { path: '**', redirectTo: 'tenant-management' },
    ],
  },
];
