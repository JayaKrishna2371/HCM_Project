/**
 * MSAL Angular configuration — OAuth2 Authorization Code Flow + PKCE.
 *
 * Notes
 * -----
 * - `cacheLocation: sessionStorage` keeps tokens out of localStorage (slightly safer)
 *   but they're still cleared when the tab closes. Switch to 'localStorage' if you
 *   need cross-tab SSO.
 * - We do NOT use the deprecated implicit flow; PKCE is enforced by msal-browser.
 * - Protected resources map your backend URL → the API scope MSAL must attach.
 */
import {
  BrowserCacheLocation,
  IPublicClientApplication,
  InteractionType,
  LogLevel,
  PublicClientApplication,
} from '@azure/msal-browser';
import {
  MsalGuardConfiguration,
  MsalInterceptorConfiguration,
} from '@azure/msal-angular';

import { environment } from '../../../environments/environment';

export function msalInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.azure.clientId,
      authority: `https://login.microsoftonline.com/${environment.azure.tenantId}`,
      redirectUri: environment.azure.redirectUri,
      postLogoutRedirectUri: environment.azure.postLogoutRedirectUri,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.SessionStorage,
      storeAuthStateInCookie: false, // set true for IE11 — not needed here
    },
    system: {
      allowNativeBroker: false,
      loggerOptions: {
        logLevel: environment.production ? LogLevel.Warning : LogLevel.Info,
        piiLoggingEnabled: false,
        loggerCallback: (level, message) => {
          if (level === LogLevel.Error) {
            console.error('[MSAL]', message);
          } else if (!environment.production) {
            // eslint-disable-next-line no-console
            console.debug('[MSAL]', message);
          }
        },
      },
    },
  });
}

export function msalGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Popup,
    authRequest: {
      scopes: ['openid', 'profile', 'email', environment.azure.apiScope],
    },
    loginFailedRoute: '/login',
  };
}

export function msalInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string> | null>();
  protectedResourceMap.set(environment.apiBaseUrl, [environment.azure.apiScope]);

  return {
    interactionType: InteractionType.Popup,
    protectedResourceMap,
  };
}
