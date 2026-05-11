import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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
  // AuthService is constructed eagerly so it can subscribe to MSAL events.
  private readonly _auth = inject(AuthService);

  ngOnInit(): void {
    this.session.start();
  }
}
