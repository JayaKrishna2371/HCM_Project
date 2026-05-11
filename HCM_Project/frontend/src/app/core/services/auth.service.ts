import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AccountInfo,
  AuthenticationResult,
  EventMessage,
  EventType,
  InteractionStatus,
  InteractionType,
  PopupRequest,
  RedirectRequest,
  SilentRequest,
} from '@azure/msal-browser';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { Observable, filter, firstValueFrom, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);
  private readonly broadcast = inject(MsalBroadcastService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // ---- Reactive state ----
  private readonly _account = signal<AccountInfo | null>(null);
  readonly account = this._account.asReadonly();
  readonly isAuthenticated = computed(() => this._account() !== null);

  /** Observable mirror of MSAL interaction status (used by buttons to show spinners). */
  readonly interactionStatus$: Observable<InteractionStatus> = this.broadcast.inProgress$;

  constructor() {
    // Re-sync account on every login/logout/token event.
    this.broadcast.msalSubject$
      .pipe(
        filter((m: EventMessage) =>
          m.eventType === EventType.LOGIN_SUCCESS ||
          m.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
          m.eventType === EventType.LOGOUT_SUCCESS ||
          m.eventType === EventType.ACCOUNT_ADDED ||
          m.eventType === EventType.ACCOUNT_REMOVED,
        ),
      )
      .subscribe(() => this.syncAccount());

    this.broadcast.inProgress$
      .pipe(filter((status) => status === InteractionStatus.None))
      .subscribe(() => this.syncAccount());
  }

  private syncAccount(): void {
    const accounts = this.msal.instance.getAllAccounts();
    if (accounts.length > 0) {
      this.msal.instance.setActiveAccount(accounts[0]);
      this._account.set(accounts[0]);
    } else {
      this._account.set(null);
    }
  }

  /** Trigger Azure AD login via popup. Returns true on success. */
  async loginPopup(): Promise<boolean> {
    const request: PopupRequest = {
      scopes: ['openid', 'profile', 'email', environment.azure.apiScope],
      prompt: 'select_account',
    };

    try {
      const result: AuthenticationResult = await firstValueFrom(
        this.msal.loginPopup(request),
      );
      this.msal.instance.setActiveAccount(result.account);
      this._account.set(result.account);
      this.toast.success(`Welcome, ${result.account?.name ?? 'user'}`);
      this.router.navigateByUrl('/dashboard');
      return true;
    } catch (err: unknown) {
      console.error('[Auth] loginPopup failed', err);
      this.toast.error('Azure AD sign-in failed. Check console for details.');
      return false;
    }
  }

  /** Alternative: redirect-based login (useful if popups are blocked). */
  loginRedirect(): void {
    const request: RedirectRequest = {
      scopes: ['openid', 'profile', 'email', environment.azure.apiScope],
    };
    this.msal.loginRedirect(request);
  }

  /** Acquire an API access token silently — used by the HTTP interceptor. */
  async acquireApiToken(): Promise<string | null> {
    const account = this.msal.instance.getActiveAccount();
    if (!account) {
      return null;
    }
    const silentRequest: SilentRequest = {
      account,
      scopes: [environment.azure.apiScope],
    };
    try {
      const result = await firstValueFrom(
        this.msal.acquireTokenSilent(silentRequest),
      );
      return result.accessToken;
    } catch (err) {
      console.warn('[Auth] silent token acquisition failed, falling back to popup', err);
      try {
        const result = await firstValueFrom(
          this.msal.acquireTokenPopup({ scopes: [environment.azure.apiScope] }),
        );
        return result.accessToken;
      } catch (popupErr) {
        console.error('[Auth] popup token acquisition failed', popupErr);
        return null;
      }
    }
  }

  /** Logout the active account (popup) and route back to /login. */
  logout(): void {
    const account = this.msal.instance.getActiveAccount() ?? undefined;
    this.msal.logoutPopup({
      account,
      mainWindowRedirectUri: environment.azure.postLogoutRedirectUri,
    }).subscribe({
      complete: () => {
        this._account.set(null);
        this.router.navigateByUrl('/login');
      },
      error: (err) => {
        console.error('[Auth] logout failed', err);
        this.toast.error('Logout failed.');
      },
    });
  }

  /** Roles claim from the ID token, if present. */
  rolesFromIdToken(): string[] {
    const account = this.msal.instance.getActiveAccount();
    const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
    const roles = (claims?.['roles'] as string[] | undefined) ?? [];
    return Array.isArray(roles) ? roles : [];
  }

  /** Stream that emits once MSAL finishes any in-flight interaction. */
  whenIdle$(): Observable<boolean> {
    return this.broadcast.inProgress$.pipe(
      filter((status) => status === InteractionStatus.None),
      map(() => true),
    );
  }

  // Re-export the MSAL interaction type so login template can compare without importing msal-browser.
  readonly InteractionType = InteractionType;
}
