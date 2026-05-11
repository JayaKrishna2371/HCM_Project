import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';

import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast" [ngClass]="'toast--' + t.kind">
          <span class="toast__icon" aria-hidden="true">
            @switch (t.kind) {
              @case ('success') { ✓ }
              @case ('error')   { ! }
              @case ('warn')    { ⚠ }
              @default          { i }
            }
          </span>
          <span class="toast__msg">{{ t.message }}</span>
          <button
            type="button"
            class="toast__close"
            aria-label="Dismiss"
            (click)="toastService.dismiss(t.id)"
          >×</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        top: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 9999;
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 280px;
        max-width: 420px;
        padding: 12px 14px;
        border-radius: 10px;
        font-size: 14px;
        color: #0b1e3f;
        background: #fff;
        box-shadow: 0 12px 36px rgba(0, 8, 30, 0.35);
        border-left: 4px solid #2f80ff;
        animation: slide-in 0.18s ease-out;
      }
      .toast--success { border-left-color: #34d399; }
      .toast--warn    { border-left-color: #fbbf24; }
      .toast--error   { border-left-color: #ef4444; }
      .toast__icon {
        width: 22px; height: 22px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 50%;
        background: rgba(47, 128, 255, 0.12);
        font-weight: 700;
      }
      .toast--success .toast__icon { background: rgba(52, 211, 153, 0.15); color: #047857; }
      .toast--warn    .toast__icon { background: rgba(251, 191, 36, 0.18); color: #92400e; }
      .toast--error   .toast__icon { background: rgba(239, 68, 68, 0.15); color: #991b1b; }
      .toast__msg { flex: 1; line-height: 1.35; }
      .toast__close {
        background: none; border: none; cursor: pointer;
        font-size: 20px; line-height: 1; color: #64748b;
      }
      @keyframes slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `,
  ],
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
