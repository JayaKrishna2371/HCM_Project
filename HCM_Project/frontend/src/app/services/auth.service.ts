import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';

import { environment } from '@env/environment';
import {
  LoginResponse,
  SUPER_ADMIN,
  TENANT_ADMIN,
  TokenClaims,
  UserProfile,
} from '../models/user.model';
import { ToastService } from './toast.service';

interface StoredSession {
  token: string;
  profile: UserProfile;
  expiresAt: number; // epoch ms
}

/**
 * Authentication against Microsoft Active Directory via the backend LDAP login.
 *
 * The backend verifies the username/password against AD over LDAP and returns a
 * signed session JWT. We hold that token (plus the user profile and expiry) and
 * attach it as a bearer token on API calls (see auth.interceptor.ts).
 *
 * "Keep me signed in" decides whether the session lives in localStorage
 * (survives browser restarts) or sessionStorage (cleared when the tab closes).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly tokenKey = environment.auth.tokenStorageKey;
  private readonly profileKey = environment.auth.profileStorageKey;
  private readonly expiryKey = environment.auth.expiryStorageKey;

  // ---- Reactive state ----
  private readonly _profile = signal<UserProfile | null>(null);
  readonly profile = this._profile.asReadonly();
  readonly isAuthenticated = computed(() => this._profile() !== null);

  // Authorization context decoded from the JWT (backend re-checks every call).
  private readonly _claims = signal<TokenClaims | null>(null);
  readonly claims = this._claims.asReadonly();
  readonly permissions = computed<string[]>(() => this._claims()?.permissions ?? []);
  readonly primaryRole = computed<string | null>(() => this._claims()?.role ?? null);
  /** The user's home tenant id (null for SUPER_ADMIN). */
  readonly homeTenantId = computed<string | null>(() => this._claims()?.tenant_id ?? null);
  readonly isSuperAdmin = computed(() => this.hasRole(SUPER_ADMIN));
  /** Shows the Administration menu: SUPER_ADMIN or TENANT_ADMIN. */
  readonly isAdmin = computed(() => this.hasRole(SUPER_ADMIN) || this.hasRole(TENANT_ADMIN));

  private token: string | null = null;
  private expiresAt = 0;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hydrateFromStorage();
  }

  /** Verify credentials against AD (via backend LDAP) and start a session. */
  async login(username: string, password: string, remember: boolean): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, {
          username,
          password,
        }),
      );
      this.persistSession(res, remember);
      this.toast.success(`Welcome, ${res.user.given_name ?? res.user.name ?? username}`);
      return true;
    } catch {
      // The error interceptor surfaces a toast with the backend's detail message.
      return false;
    }
  }

  /** Token attached to API calls by the interceptor (null if absent/expired). */
  getAccessToken(): string | null {
    if (this.token && Date.now() >= this.expiresAt) {
      this.clearSession();
      return null;
    }
    return this.token;
  }

  /** Roles for the current user (from the profile returned at login). */
  roles(): string[] {
    return this._profile()?.roles ?? [];
  }

  /** True if the user holds the given role (case-insensitive). */
  hasRole(role: string): boolean {
    const want = role.toLowerCase();
    return this.roles().some((r) => r.toLowerCase() === want);
  }

  /** True if the user holds the permission (wildcard '*' grants everything). */
  hasPermission(code: string): boolean {
    const perms = this.permissions();
    return perms.includes('*') || perms.includes(code);
  }

  /** True if the user holds ANY of the given permissions. */
  hasAnyPermission(...codes: string[]): boolean {
    return codes.some((c) => this.hasPermission(c));
  }

  /** Tell the backend (best effort) then clear local session and route to /login. */
  logout(): void {
    if (this.token) {
      // Stateless on the server; fire-and-forget so logout is instant for the user.
      this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}).subscribe({
        error: () => undefined,
      });
    }
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  /** Backend round-trip to confirm the current token is still valid. */
  introspect(): Observable<unknown> {
    return this.http.get(`${environment.apiBaseUrl}/auth/introspect`).pipe(
      tap(() => undefined),
    );
  }

  // ------------------------------------------------------------------ #
  //  Session persistence
  // ------------------------------------------------------------------ #
  private persistSession(res: LoginResponse, remember: boolean): void {
    const expiresAt = Date.now() + res.expires_in * 1000;
    this.token = res.access_token;
    this.expiresAt = expiresAt;
    this._profile.set(res.user);
    this._claims.set(this.decodeClaims(res.access_token));

    // Write to the chosen store; clear the other so only one copy exists.
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(this.tokenKey, res.access_token);
    store.setItem(this.profileKey, JSON.stringify(res.user));
    store.setItem(this.expiryKey, String(expiresAt));
    other.removeItem(this.tokenKey);
    other.removeItem(this.profileKey);
    other.removeItem(this.expiryKey);

    this.scheduleExpiry();
  }

  private hydrateFromStorage(): void {
    const session = this.readSession();
    if (!session) {
      return;
    }
    if (Date.now() >= session.expiresAt) {
      this.clearSession();
      return;
    }
    this.token = session.token;
    this.expiresAt = session.expiresAt;
    this._profile.set(session.profile);
    this._claims.set(this.decodeClaims(session.token));
    this.scheduleExpiry();
  }

  /** Decode the JWT payload (no verification — backend verifies on every call). */
  private decodeClaims(token: string): TokenClaims | null {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json))) as TokenClaims;
    } catch {
      return null;
    }
  }

  private readSession(): StoredSession | null {
    for (const store of [localStorage, sessionStorage]) {
      const token = store.getItem(this.tokenKey);
      const profileRaw = store.getItem(this.profileKey);
      const expiryRaw = store.getItem(this.expiryKey);
      if (token && profileRaw && expiryRaw) {
        try {
          return {
            token,
            profile: JSON.parse(profileRaw) as UserProfile,
            expiresAt: Number(expiryRaw),
          };
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private scheduleExpiry(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
    }
    const ms = this.expiresAt - Date.now();
    if (ms <= 0) {
      this.clearSession();
      return;
    }
    this.expiryTimer = setTimeout(() => {
      this.toast.warn('Your session has expired. Please sign in again.');
      this.logout();
    }, ms);
  }

  private clearSession(): void {
    this.token = null;
    this.expiresAt = 0;
    this._profile.set(null);
    this._claims.set(null);
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(this.tokenKey);
      store.removeItem(this.profileKey);
      store.removeItem(this.expiryKey);
    }
  }
}
