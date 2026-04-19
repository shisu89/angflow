import { Component, ChangeDetectionStrategy } from '@angular/core';
import { PanelComponent } from '../panel/panel.component';

/**
 * Small library-attribution badge rendered in the bottom-right corner.
 * Rendered internally by `<ng-flow>`; hide via `[hideAttribution]="true"`.
 */
@Component({
  selector: 'ng-flow-attribution',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-panel position="bottom-right">
      <span
        class="ng-flow__attribution xy-flow__attribution"
        style="font-size: 10px; color: #999; pointer-events: all;"
      >
        angflow
      </span>
    </ng-flow-panel>
  `,
})
export class AttributionComponent {}
