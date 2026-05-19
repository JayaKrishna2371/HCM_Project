/**
 * Production environment placeholder.
 * For Phase 1 (local-only) we use environment.development.ts.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'http://localhost:8000/api/v1',
  azure: {
    tenantId: 'fc388343-6a22-4b5b-a32f-a6aa2320b0fb',
    clientId: 'b643e0ac-2602-4281-8da2-1eaec09adc23',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
    apiScope: 'api://b643e0ac-2602-4281-8da2-1eaec09adc23/access_as_user',
  },
  session: {
    idleTimeoutMs: 30 * 60 * 1000,
    warningMs: 60 * 1000,
  },
};
