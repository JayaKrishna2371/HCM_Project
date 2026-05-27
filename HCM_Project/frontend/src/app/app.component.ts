import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastComponent } from '@components/toast/toast.component';
import { AuthService } from '@services/auth.service';
import { SessionService } from '@services/session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly session = inject(SessionService);
  // AuthService is constructed eagerly so it hydrates any stored session on boot.
  private readonly _auth = inject(AuthService);

  ngOnInit(): void {
    this.session.start();
  }
}
