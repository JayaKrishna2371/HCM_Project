/**
 * Production environment placeholder.
 * For Phase 1 (local-only) we use environment.development.ts.
 */
export const environment = {
  production: true,

  apiBaseUrl: 'http://localhost:8000/api/v1',

  auth: {
    tokenStorageKey: 'hcm.accessToken',
    profileStorageKey: 'hcm.userProfile',
    expiryStorageKey: 'hcm.tokenExpiry',
  },

  session: {
    idleTimeoutMs: 30 * 60 * 1000,
    warningMs: 60 * 1000,
  },
};
