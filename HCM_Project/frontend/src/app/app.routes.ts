import { Routes } from '@angular/router';

import { authGuard } from '@guards/auth.guard';
import { roleGuard } from '@guards/role.guard';
import { adminGuard } from '@guards/permission.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () =>
      import('@pages/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign in — Hybrid Cloud Portal',
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard — Hybrid Cloud Portal',
  },

  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['Admin'])],
    loadComponent: () =>
      import('@pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Admin — Hybrid Cloud Portal',
  },

  {
    // Lazy-loaded Administration module (platform & tenant management).
    // adminGuard restricts the whole area to SUPER_ADMIN / TENANT_ADMIN.
    path: 'administration',
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import('@pages/administration/administration.routes').then((m) => m.ADMINISTRATION_ROUTES),
  },

  {
    path: 'unauthorized',
    loadComponent: () =>
      import('@pages/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
    title: 'Access denied',
  },

  { path: '**', redirectTo: 'login' },
];
