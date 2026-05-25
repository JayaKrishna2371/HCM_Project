import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { Permission } from '../../../core/models/role.model';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="page-head">
        <div>
          <h1>Permissions</h1>
          <p>The platform permission catalog. Roles are composed from these <code>resource:action</code> grants.</p>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <input class="search-input" [(ngModel)]="query" (ngModelChange)="q.set($event)" placeholder="Filter permissions…" />
          <div class="spacer"></div>
          <span style="font-size:.8rem;color:#64748b">{{ filtered().length }} of {{ permissions().length }}</span>
        </div>
        @if (loading()) { <div class="state"><p>Loading…</p></div> }
        @else {
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th style="width:30%">Code</th><th>Description</th><th style="width:18%">Resource</th></tr></thead>
              <tbody>
                @for (p of filtered(); track p.id) {
                  <tr>
                    <td><span class="chip">{{ p.code }}</span></td>
                    <td>{{ p.description }}</td>
                    <td><span class="chip chip--muted">{{ resourceOf(p.code) }}</span></td>
                  </tr>
                } @empty { <tr><td colspan="3" class="tbl__empty">No matching permissions.</td></tr> }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class PermissionsComponent implements OnInit {
  private readonly admin = inject(AdminService);

  readonly permissions = signal<Permission[]>([]);
  readonly loading = signal(true);
  readonly q = signal('');
  query = '';

  readonly filtered = computed(() => {
    const term = this.q().trim().toLowerCase();
    if (!term) return this.permissions();
    return this.permissions().filter(
      (p) => p.code.toLowerCase().includes(term) || (p.description ?? '').toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    this.admin.listPermissions().subscribe({
      next: (p) => { this.permissions.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  resourceOf(code: string): string {
    return code === '*' ? 'all' : code.split(':')[0];
  }
}
