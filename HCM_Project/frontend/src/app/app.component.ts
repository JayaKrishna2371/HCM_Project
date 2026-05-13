import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

import { ToastComponent } from './shared/components/toast/toast.component';
import { AuthService } from './core/services/auth.service';
import { SessionService } from './core/services/session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toast />
  `,
})
export class AppComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly msal = inject(MsalService);
  // AuthService is constructed eagerly so it can subscribe to MSAL events.
  private readonly _auth = inject(AuthService);

  ngOnInit(): void {
    this.session.start();

    // msal-browser 3.x requires explicit initialize() before any other API call,
    // and handleRedirectObservable() must run once at startup to transition
    // MsalBroadcastService.inProgress$ from "Startup" to "None". Without it,
    // anything bound to interaction status (e.g. the Azure AD button) stays disabled.
    this.msal.instance.initialize().then(() => {
      this.msal.handleRedirectObservable().subscribe({
        error: (err) => console.error('[MSAL] handleRedirect failed', err),
      });
    });
  }
}
