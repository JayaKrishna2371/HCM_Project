import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalModule,
  MsalService,
} from '@azure/msal-angular';

import { routes } from './app.routes';
import {
  msalGuardConfigFactory,
  msalInstanceFactory,
  msalInterceptorConfigFactory,
} from './core/config/msal.config';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),

    // MSAL Angular needs DI-style interceptors so its multi-provider HTTP_INTERCEPTORS
    // chain is honored alongside our functional error interceptor.
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([errorInterceptor]),
    ),

    importProvidersFrom(MsalModule),

    { provide: MSAL_INSTANCE, useFactory: msalInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useFactory: msalGuardConfigFactory },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: msalInterceptorConfigFactory },

    MsalService,
    MsalGuard,
    MsalBroadcastService,

    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
  ],
};
