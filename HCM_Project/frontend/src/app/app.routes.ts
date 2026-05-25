import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { adminGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign in — Hybrid Cloud Portal',
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard — Hybrid Cloud Portal',
  },

  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['Admin'])],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Admin — Hybrid Cloud Portal',
  },

  {
    // Lazy-loaded Administration module (platform & tenant management).
    // adminGuard restricts the whole area to SUPER_ADMIN / TENANT_ADMIN.
    path: 'administration',
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import('./features/administration/administration.routes').then((m) => m.ADMINISTRATION_ROUTES),
  },

  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
    title: 'Access denied',
  },

  { path: '**', redirectTo: 'login' },
];
