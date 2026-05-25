import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from './auth.service';

const STORAGE_KEY = 'hcm.activeTenantId';

/**
 * Holds the tenant a SUPER_ADMIN is currently acting within. When set, the auth
 * interceptor sends it as the X-Tenant-Id header so the backend scopes data to
 * that tenant. Regular users always operate in their own (home) tenant and this
 * service is a no-op for them.
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);

  private readonly _activeTenantId = signal<string | null>(
    localStorage.getItem(STORAGE_KEY),
  );

  /** Effective tenant the SPA is operating in (null = platform-wide for super admin). */
  readonly activeTenantId = computed<string | null>(() => {
    if (this.auth.isSuperAdmin()) {
      return this._activeTenantId();
    }
    return this.auth.homeTenantId();
  });

  readonly isSwitched = computed(
    () => this.auth.isSuperAdmin() && this._activeTenantId() !== null,
  );

  /** SUPER_ADMIN: enter a tenant's context (or pass null to go platform-wide). */
  switchTo(tenantId: string | null): void {
    if (!this.auth.isSuperAdmin()) {
      return;
    }
    this._activeTenantId.set(tenantId);
    if (tenantId) {
      localStorage.setItem(STORAGE_KEY, tenantId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  clear(): void {
    this._activeTenantId.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }
}
