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

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // Only attach the token to our own API, and never overwrite an explicit header.
  if (!req.url.startsWith(environment.apiBaseUrl) || req.headers.has('Authorization')) {
    return next(req);
  }

  const token = inject(AuthService).getAccessToken();
  const authed = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  return next(authed);
};
