/**
 * Auth interceptor — attaches an Azure AD access token to every request
 * targeting our backend API base URL.
 *
 * MSAL Angular ships its own interceptor (used in app.config.ts), so this file
 * is a lightweight fallback used by non-MSAL HttpClient calls (kept here for
 * clarity and future flexibility).
 */
import {
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const auth = inject(AuthService);
  return from(auth.acquireApiToken()).pipe(
    switchMap((token) => {
      const cloned = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(cloned);
    }),
  );
};
