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
  templateUrl: './section-placeholder.component.html',
  styleUrls: ['./section-placeholder.component.css'],
})
export class SectionPlaceholderComponent {
  @Input() title = 'Section';
  @Input() description = '';
  @Input() icon = '';
}
