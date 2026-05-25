import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { AuditLog } from '../../../core/models/audit.model';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="page-head">
        <div>
          <h1>Audit Logs</h1>
          <p>Tenant-scoped activity &amp; security trail. Super Admins see platform-wide events.</p>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input class="search-input" [(ngModel)]="action" placeholder="Filter by action e.g. user.create" (keyup.enter)="reload()" />
          <button class="btn" (click)="reload()">Apply</button>
          <div class="spacer"></div>
          <span style="font-size:.8rem;color:#64748b">{{ total() }} events</span>
        </div>

        @if (loading()) { <div class="state"><p>Loading…</p></div> }
        @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th><th>Status</th><th>IP</th></tr></thead>
              <tbody>
                @for (e of items(); track e.id) {
                  <tr>
                    <td style="white-space:nowrap">{{ e.created_at | date:'short' }}</td>
                    <td>{{ e.actor_username || '—' }}</td>
                    <td><span class="chip chip--muted">{{ e.action }}</span></td>
                    <td>{{ e.resource_type }}{{ e.resource_id ? ' #' + e.resource_id : '' }}</td>
                    <td><span class="badge" [class.badge--ok]="e.status==='SUCCESS'" [class.badge--warn]="e.status==='FAILURE'" [class.badge--off]="e.status==='DENIED'">{{ e.status }}</span></td>
                    <td>{{ e.ip_address || '—' }}</td>
                  </tr>
                } @empty { <tr><td colspan="6" class="tbl__empty">No audit events.</td></tr> }
              </tbody>
            </table>
          </div>

          <div class="toolbar" style="margin-top:14px">
            <button class="btn btn--sm" [disabled]="offset() === 0" (click)="prev()">‹ Prev</button>
            <span style="font-size:.78rem;color:#64748b">{{ rangeLabel() }}</span>
            <button class="btn btn--sm" [disabled]="!hasNext()" (click)="next()">Next ›</button>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuditLogsComponent implements OnInit {
  private readonly admin = inject(AdminService);

  readonly items = signal<AuditLog[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly limit = 25;
  action = '';

  readonly hasNext = computed(() => this.offset() + this.limit < this.total());
  readonly rangeLabel = computed(() => {
    if (this.total() === 0) return '0';
    const from = this.offset() + 1;
    const to = Math.min(this.offset() + this.limit, this.total());
    return `${from}–${to} of ${this.total()}`;
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.admin.listAudit({ action: this.action.trim() || undefined, limit: this.limit, offset: this.offset() }).subscribe({
      next: (p) => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  reload(): void { this.offset.set(0); this.load(); }
  prev(): void { this.offset.set(Math.max(0, this.offset() - this.limit)); this.load(); }
  next(): void { this.offset.set(this.offset() + this.limit); this.load(); }
}
