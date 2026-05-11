/**
 * Production environment placeholder.
 * For Phase 1 (local-only) we use environment.development.ts.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'http://localhost:8000/api/v1',
  azure: {
    tenantId: 'REPLACE_WITH_TENANT_ID',
    clientId: 'REPLACE_WITH_CLIENT_ID',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
    apiScope: 'api://REPLACE_WITH_CLIENT_ID/access_as_user',
  },
  session: {
    idleTimeoutMs: 30 * 60 * 1000,
    warningMs: 60 * 1000,
  },
};
