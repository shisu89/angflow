import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { Transform } from '@angflow/system';

/**
 * Layer that applies the current pan/zoom transform to its projected content.
 * Rendered internally by `<ng-flow>`; exposed for advanced composition.
 */
@Component({
  selector: 'ng-flow-viewport',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__viewport xy-flow__viewport xyflow__viewport',
    'style': 'display: block; transform-origin: 0 0; z-index: 2; pointer-events: none; position: absolute; width: 100%; height: 100%;',
    '[style.transform]': 'cssTransform()',
  },
  template: `<ng-content />`,
})
export class ViewportComponent {
  readonly transform = input.required<Transform>();

  readonly cssTransform = computed(() => {
    const t = this.transform();
    return `translate(${t[0]}px, ${t[1]}px) scale(${t[2]})`;
  });
}
