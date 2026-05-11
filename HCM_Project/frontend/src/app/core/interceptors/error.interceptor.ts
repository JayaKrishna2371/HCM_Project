import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      switch (err.status) {
        case 0:
          toast.error('Cannot reach API. Is the FastAPI backend running on :8000?');
          break;
        case 401:
          toast.warn('Session expired. Please sign in again.');
          if (auth.isAuthenticated()) {
            auth.logout();
          } else {
            router.navigateByUrl('/login');
          }
          break;
        case 403:
          toast.error('You do not have permission to access this resource.');
          router.navigateByUrl('/unauthorized');
          break;
        case 500:
        case 502:
        case 503:
          toast.error('Server error. Please try again shortly.');
          break;
        default: {
          const detail = (err.error as { detail?: string } | undefined)?.detail;
          toast.error(detail ?? err.message ?? 'Unexpected error');
        }
      }
      return throwError(() => err);
    }),
  );
};
