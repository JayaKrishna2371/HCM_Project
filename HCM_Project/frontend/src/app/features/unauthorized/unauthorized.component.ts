import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="card">
        <div class="badge">403</div>
        <h1>Access denied</h1>
        <p>You're signed in, but you don't have permission to view that page.</p>
        <p class="muted">If you believe this is a mistake, contact your Active Directory administrator and ask to be added to the appropriate security group.</p>
        <a routerLink="/dashboard" class="back">← Back to dashboard</a>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background:
          radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.12), transparent 55%),
          var(--color-bg-deep);
      }
      .wrap {
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; padding: 24px;
      }
      .card {
        max-width: 460px; padding: 36px;
        background: var(--color-card);
        border: 1px solid var(--color-card-border);
        border-radius: 16px;
        text-align: center;
        box-shadow: var(--shadow-card);
      }
      .badge {
        display: inline-block;
        background: rgba(239, 68, 68, 0.15);
        color: #fca5a5;
        font-weight: 700;
        padding: 4px 12px; border-radius: 999px;
        font-size: 0.8rem; letter-spacing: 0.1em;
        margin-bottom: 14px;
      }
      h1 { margin: 0 0 8px; }
      .muted { color: var(--color-text-muted); font-size: 0.9rem; }
      .back {
        display: inline-block; margin-top: 18px;
        font-weight: 600;
      }
    `,
  ],
})
export class UnauthorizedComponent {}
