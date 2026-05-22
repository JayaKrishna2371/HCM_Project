/**
 * Local development environment.
 *
 * Authentication is handled by the backend, which verifies credentials against
 * Microsoft Active Directory over LDAP and returns a signed session token.
 * There is nothing identity-provider-specific to configure in the SPA.
 */
export const environment = {
  production: false,

  apiBaseUrl: 'http://127.0.0.1:8000/api/v1',

  auth: {
    // Where the bearer token is kept. 'session' clears on tab close (default);
    // 'local' persists across browser restarts (used when "Keep me signed in").
    tokenStorageKey: 'hcm.accessToken',
    profileStorageKey: 'hcm.userProfile',
    expiryStorageKey: 'hcm.tokenExpiry',
  },

  session: {
    idleTimeoutMs: 30 * 60 * 1000,   // 30 min
    warningMs: 60 * 1000,            // show warning 60s before logout
  },
};
