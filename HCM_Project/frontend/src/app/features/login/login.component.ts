import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InteractionStatus } from '@azure/msal-browser';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [false],
  });

  readonly isBusy = signal(false);
  readonly isAzureBusy = signal(false);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/dashboard');
      return;
    }

    this.auth.interactionStatus$.subscribe((status) => {
      this.isAzureBusy.set(status !== InteractionStatus.None);
    });

    const remembered = localStorage.getItem('hcm.rememberedUser');
    if (remembered) {
      this.form.patchValue({ username: remembered, remember: true });
    }
  }

  /**
   * Local-credentials submit path.
   *
   * Phase 1 enterprise policy: identity is owned by Azure AD. We surface a
   * username/password form for UX continuity, but it is intentionally inert —
   * users must sign in with Azure AD. This avoids a parallel password store
   * (and the breach surface that comes with it).
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isBusy.set(true);

    const { username, remember } = this.form.getRawValue();
    if (remember) {
      localStorage.setItem('hcm.rememberedUser', username);
    } else {
      localStorage.removeItem('hcm.rememberedUser');
    }

    setTimeout(() => {
      this.isBusy.set(false);
      this.toast.info(
        'Local password sign-in is disabled in Phase 1. Please use "Sign in with Azure AD".',
        5000,
      );
    }, 400);
  }

  async onAzureAdLogin(): Promise<void> {
    if (this.isAzureBusy()) {
      return;
    }
    this.isAzureBusy.set(true);
    try {
      await this.auth.loginPopup();
    } finally {
      this.isAzureBusy.set(false);
    }
  }

  onForgotPassword(): void {
    this.toast.info('Password recovery is managed by your Azure AD administrator.');
  }
}
