import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '@services/admin.service';
import { Permission } from '@models/role.model';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permissions.component.html',
  styleUrls: ['./permissions.component.css'],
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
