import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { UserProfile } from '../../core/models/user.model';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header class="shell__topbar">
        <div class="brand">
          <svg viewBox="0 0 64 40" width="32" height="22" aria-hidden="true">
            <defs>
              <linearGradient id="brandCloud" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#82b8ff"/>
                <stop offset="100%" stop-color="#2f80ff"/>
              </linearGradient>
            </defs>
            <path fill="url(#brandCloud)"
              d="M50.3 22.4a12.1 12.1 0 0 0-23.7-3.6 9 9 0 0 0-12.3 8.4 9.1 9.1 0 0 0 9.1 9.1h26.3a7 7 0 0 0 .6-13.9z"/>
          </svg>
          <span>Hybrid Cloud Portal</span>
        </div>

        <div class="topbar__right">
          @if (profile()) {
            <span class="user-chip" [title]="profile()!.email ?? ''">
              {{ profile()!.name ?? profile()!.email }}
            </span>
          }
          <button class="btn-logout" type="button" (click)="logout()">Sign out</button>
        </div>
      </header>

      <main class="shell__main">
        @if (loading()) {
          <div class="loading-block">
            <app-spinner [size]="28" />
            <p>Loading your profile…</p>
          </div>
        } @else if (error()) {
          <div class="error-block">
            <h2>We couldn't load your profile.</h2>
            <p>{{ error() }}</p>
          </div>
        } @else if (profile(); as p) {
          <section class="welcome">
            <h1>Welcome, {{ p.given_name ?? p.name ?? 'User' }} 👋</h1>
            <p class="muted">Phase 1 · Authentication & Login Module — successfully signed in via Azure AD.</p>
          </section>

          <section class="cards">
            <div class="card">
              <h3>Identity</h3>
              <dl>
                <dt>Name</dt><dd>{{ p.name ?? '—' }}</dd>
                <dt>Email</dt><dd>{{ p.email ?? '—' }}</dd>
                <dt>Azure OID</dt><dd class="mono">{{ p.azure_oid }}</dd>
                <dt>Tenant</dt><dd class="mono">{{ p.tenant_id ?? '—' }}</dd>
              </dl>
            </div>

            <div class="card">
              <h3>Roles (RBAC)</h3>
              @if (p.roles?.length) {
                <ul class="roles">
                  @for (r of p.roles; track r) {
                    <li class="role-badge">{{ r }}</li>
                  }
                </ul>
              } @else {
                <p class="muted">No roles assigned.</p>
              }
            </div>

            <div class="card">
              <h3>Session</h3>
              <dl>
                <dt>Last login</dt><dd>{{ p.last_login_at | date: 'medium' }}</dd>
                <dt>Account created</dt><dd>{{ p.created_at | date: 'medium' }}</dd>
              </dl>
            </div>
          </section>
        }
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% 0%, rgba(47, 128, 255, 0.18), transparent 50%),
          radial-gradient(circle at 80% 100%, rgba(79, 155, 255, 0.12), transparent 55%),
          var(--color-bg-deep);
      }
      .shell {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px 48px;
      }
      .shell__topbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 0;
        border-bottom: 1px solid rgba(120, 170, 255, 0.12);
      }
      .brand {
        display: flex; align-items: center; gap: 10px;
        font-weight: 600; letter-spacing: 0.05em;
      }
      .topbar__right { display: flex; align-items: center; gap: 14px; }
      .user-chip {
        background: rgba(120, 170, 255, 0.12);
        border: 1px solid rgba(120, 170, 255, 0.22);
        padding: 6px 12px; border-radius: 999px;
        font-size: 0.85rem; max-width: 240px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .btn-logout {
        background: transparent;
        color: var(--color-text);
        border: 1px solid rgba(120, 170, 255, 0.32);
        padding: 8px 14px; border-radius: 8px;
        cursor: pointer; font-size: 0.85rem;
        transition: background 0.15s ease;
      }
      .btn-logout:hover { background: rgba(120, 170, 255, 0.12); }

      .shell__main { padding-top: 28px; }
      .welcome h1 { margin: 0 0 6px; font-size: 1.6rem; }
      .muted { color: var(--color-text-muted); }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
        margin-top: 24px;
      }
      .card {
        background: var(--color-card);
        border: 1px solid var(--color-card-border);
        border-radius: 14px;
        padding: 20px 22px;
        box-shadow: 0 12px 28px rgba(0, 8, 30, 0.35);
      }
      .card h3 {
        margin: 0 0 14px; font-size: 1rem; color: var(--color-accent-bright);
        letter-spacing: 0.06em; text-transform: uppercase;
      }
      dl { display: grid; grid-template-columns: 110px 1fr; gap: 6px 14px; margin: 0; font-size: 0.9rem; }
      dt { color: var(--color-text-muted); }
      dd { margin: 0; word-break: break-word; }
      .mono { font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; font-size: 0.8rem; }

      .roles { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
      .role-badge {
        background: rgba(47, 128, 255, 0.16);
        border: 1px solid rgba(47, 128, 255, 0.32);
        padding: 4px 10px; border-radius: 999px;
        font-size: 0.78rem;
      }

      .loading-block, .error-block {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 64px 0; gap: 12px; color: var(--color-text-muted);
      }
      .error-block h2 { color: var(--color-text); margin: 0; }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly profile = signal<UserProfile | null>(null);

  ngOnInit(): void {
    this.users.getMyProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? err.message ?? 'Unable to load profile');
        this.loading.set(false);
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
