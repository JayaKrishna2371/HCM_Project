import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Factory: allow the route only if the user holds ANY of the given permissions.
 * Usage: `canActivate: [authGuard, permissionGuard('tenant:read')]`.
 */
export function permissionGuard(...permissions: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    if (auth.hasAnyPermission(...permissions)) {
      return true;
    }
    return router.createUrlTree(['/unauthorized']);
  };
}

/** Gate the whole Administration area: SUPER_ADMIN or TENANT_ADMIN only. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/unauthorized']);
};
