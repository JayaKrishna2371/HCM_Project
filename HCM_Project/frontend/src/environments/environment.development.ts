/**
 * Local development environment.
 *
 * Replace tenantId and clientId with values from your Azure AD App Registration.
 *   Azure Portal → Microsoft Entra ID → App registrations → <your app> → Overview
 *
 * apiScope must match the scope you exposed under "Expose an API".
 */
export const environment = {
  production: false,

  apiBaseUrl: 'http://localhost:8000/api/v1',

  azure: {
    tenantId: 'REPLACE_WITH_TENANT_ID',
    clientId: 'REPLACE_WITH_CLIENT_ID',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
    // Scope your backend will require on incoming access tokens
    apiScope: 'api://REPLACE_WITH_CLIENT_ID/access_as_user',
  },

  session: {
    idleTimeoutMs: 30 * 60 * 1000,   // 30 min
    warningMs: 60 * 1000,            // show warning 60s before logout
  },
};
