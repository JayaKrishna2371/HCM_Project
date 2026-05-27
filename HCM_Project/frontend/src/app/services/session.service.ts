/**
 * Idle-session timeout.
 *
 * Tracks mouse/keyboard/touch activity. If the user is idle for
 * `idleTimeoutMs`, MSAL is logged out and the user is bounced to /login.
 *
 * Lives at the app shell level so route changes don't reset it.
 */
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, fromEvent, merge, timer } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';

import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stop$ = new Subject<void>();
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const activity$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'touchstart'),
      fromEvent(window, 'focus'),
    ).pipe(debounceTime(500));

    activity$
      .pipe(
        switchMap(() => timer(environment.session.idleTimeoutMs)),
        takeUntil(this.stop$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.expire());
  }

  stop(): void {
    this.stop$.next();
    this.started = false;
  }

  private expire(): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }
    this.toast.warn('Session timed out due to inactivity.');
    this.auth.logout();
  }
}
