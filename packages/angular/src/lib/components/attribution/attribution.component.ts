import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { PanelPosition } from '@angflow/system';
import { PanelComponent } from '../panel/panel.component';

/**
 * Small library-attribution badge (bottom-right by default).
 * Rendered internally by `<ng-flow>`; place it via `[attributionPosition]`,
 * hide via `[hideAttribution]="true"`.
 */
@Component({
  selector: 'ng-flow-attribution',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-panel [position]="position()">
      <span
        class="ng-flow__attribution xy-flow__attribution"
        style="font-size: 10px; color: #999; pointer-events: all;"
      >
        angflow
      </span>
    </ng-flow-panel>
  `,
})
export class AttributionComponent {
  /** Panel slot for the badge; bound from `<ng-flow [attributionPosition]>`. */
  readonly position = input<PanelPosition>('bottom-right');
}
