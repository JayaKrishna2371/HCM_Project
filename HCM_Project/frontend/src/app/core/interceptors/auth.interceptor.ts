/**
 * Auth interceptor — attaches the backend-issued session JWT as a bearer token
 * on every request targeting our API base URL.
 *
 * The token is obtained after a successful LDAP login (see AuthService) and
 * stored client-side; here we simply forward it.
 */
import {
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TenantContextService } from '../services/tenant-context.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // Only attach the token to our own API, and never overwrite an explicit header.
  if (!req.url.startsWith(environment.apiBaseUrl) || req.headers.has('Authorization')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const tenantCtx = inject(TenantContextService);
  const token = auth.getAccessToken();

  if (!token) {
    return next(req);
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  // SUPER_ADMIN tenant switching: tell the backend which tenant to scope to.
  if (tenantCtx.isSwitched()) {
    const tid = tenantCtx.activeTenantId();
    if (tid) {
      headers['X-Tenant-Id'] = tid;
    }
  }
  return next(req.clone({ setHeaders: headers }));
};
