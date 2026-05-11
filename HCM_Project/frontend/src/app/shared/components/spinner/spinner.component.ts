import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="spinner"
      [class.spinner--inverse]="inverse"
      [style.width.px]="size"
      [style.height.px]="size"
      role="status"
      aria-label="Loading"
    ></span>
  `,
  styles: [
    `
      .spinner {
        display: inline-block;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.25);
        border-top-color: #ffffff;
        animation: spin 0.8s linear infinite;
      }
      .spinner--inverse {
        border-color: rgba(11, 30, 63, 0.25);
        border-top-color: #0b1e3f;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SpinnerComponent {
  @Input() size = 18;
  @Input() inverse = false;
}
