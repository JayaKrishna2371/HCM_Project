import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Factory: returns a guard that allows the route only if the user has ANY of `allowed` roles. */
export function roleGuard(allowed: string[]): CanActivateFn {
  const allowedLower = allowed.map((r) => r.toLowerCase());

  return (_route, _state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const userRoles = auth.roles().map((r) => r.toLowerCase());
    const ok = userRoles.some((r) => allowedLower.includes(r));
    return ok ? true : router.createUrlTree(['/unauthorized']);
  };
}
