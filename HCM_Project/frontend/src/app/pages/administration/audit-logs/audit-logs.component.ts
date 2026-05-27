import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { AuditLog } from '@models/audit.model';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css'],
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
