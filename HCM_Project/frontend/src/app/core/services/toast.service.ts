import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  private _nextId = 1;

  readonly toasts = this._toasts.asReadonly();

  show(message: string, kind: ToastKind = 'info', durationMs = 4000): void {
    const id = this._nextId++;
    this._toasts.update((arr) => [...arr, { id, message, kind }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  info(msg: string, d?: number): void { this.show(msg, 'info', d); }
  success(msg: string, d?: number): void { this.show(msg, 'success', d); }
  warn(msg: string, d?: number): void { this.show(msg, 'warn', d); }
  error(msg: string, d?: number): void { this.show(msg, 'error', d ?? 6000); }

  dismiss(id: number): void {
    this._toasts.update((arr) => arr.filter((t) => t.id !== id));
  }
}
