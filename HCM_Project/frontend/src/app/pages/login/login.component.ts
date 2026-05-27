import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@services/auth.service';
import { ToastService } from '@services/toast.service';
import { SpinnerComponent } from '@components/spinner/spinner.component';

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
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required]],
    remember: [false],
  });

  readonly isBusy = signal(false);

  private returnUrl = '/dashboard';

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/dashboard');
      return;
    }

    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';

    const remembered = localStorage.getItem('hcm.rememberedUser');
    if (remembered) {
      this.form.patchValue({ username: remembered, remember: true });
    }
  }

  /**
   * Sign in with Active Directory credentials. The backend verifies them over
   * LDAP and returns a session token on success.
   */
  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isBusy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isBusy.set(true);
    const { username, password, remember } = this.form.getRawValue();

    if (remember) {
      localStorage.setItem('hcm.rememberedUser', username);
    } else {
      localStorage.removeItem('hcm.rememberedUser');
    }

    try {
      const ok = await this.auth.login(username, password, remember);
      if (ok) {
        await this.router.navigateByUrl(this.returnUrl);
      }
    } finally {
      this.isBusy.set(false);
    }
  }

  onForgotPassword(): void {
    this.toast.info('Passwords are managed in Active Directory. Contact your IT administrator to reset it.');
  }
}
