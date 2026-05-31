import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { AuthService } from '@services/auth.service';
import { AuditLog } from '@models/audit.model';
import { Tenant } from '@models/tenant.model';

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
  readonly auth = inject(AuthService);

  readonly items = signal<AuditLog[]>([]);
  readonly tenants = signal<Tenant[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly limit = 25;
  action = '';
  /** SUPER_ADMIN tenant filter ('' = all). Tenant users see only their own logs. */
  readonly tenantFilter = signal<string>('');

  readonly hasNext = computed(() => this.offset() + this.limit < this.total());
  readonly rangeLabel = computed(() => {
    if (this.total() === 0) return '0';
    const from = this.offset() + 1;
    const to = Math.min(this.offset() + this.limit, this.total());
    return `${from}–${to} of ${this.total()}`;
  });

  ngOnInit(): void {
    this.load();
    // Tenant list for the filter dropdown + Tenant-column name mapping.
    this.admin.listTenants().subscribe({ next: (t) => this.tenants.set(t), error: () => undefined });
  }

  load(): void {
    this.loading.set(true);
    const tenantId = this.auth.isSuperAdmin() ? (this.tenantFilter() || null) : null;
    this.admin.listAudit({
      action: this.action.trim() || undefined,
      tenantId,
      limit: this.limit,
      offset: this.offset(),
    }).subscribe({
      next: (p) => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  reload(): void { this.offset.set(0); this.load(); }
  prev(): void { this.offset.set(Math.max(0, this.offset() - this.limit)); this.load(); }
  next(): void { this.offset.set(this.offset() + this.limit); this.load(); }

  onTenantFilter(value: string): void {
    this.tenantFilter.set(value);
    this.offset.set(0);
    this.load();
  }

  /** Tenant name for the table's Tenant column (super-admin view). */
  tenantName(id: string | null | undefined): string {
    if (!id) return 'Platform';
    return this.tenants().find((t) => t.id === id)?.tenant_name ?? '—';
  }
}
