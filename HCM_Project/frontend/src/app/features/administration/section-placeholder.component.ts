import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Shared "section coming soon" page for Administration sub-modules whose backend
 * is not implemented yet. Fed by route `data` via component input binding
 * (withComponentInputBinding is enabled in app.config).
 */
@Component({
  selector: 'app-section-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-shell">
      <div class="page-head">
        <div>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
      </div>
      <div class="card">
        <div class="state">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <strong style="color:#334155">This section is on the roadmap</strong>
          <p style="margin:0;max-width:520px;text-align:center;">
            The screen and its API land in a later phase. The route, permission
            guard and navigation entry are already wired so it appears only for
            users who hold the required permission.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class SectionPlaceholderComponent {
  @Input() title = 'Section';
  @Input() description = '';
  @Input() icon = '';
}
