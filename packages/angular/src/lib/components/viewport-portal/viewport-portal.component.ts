import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';

/**
 * Layer that shares the viewport transform with nodes and edges. Content
 * projected here pans and zooms with the canvas — useful for decorative
 * overlays drawn in flow coordinates.
 */
@Component({
  selector: 'ng-flow-viewport-portal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__viewport-portal xy-flow__viewport-portal',
    '[style.transform]': 'cssTransform()',
  },
  template: `<ng-content />`,
})
export class ViewportPortalComponent {
  private store = inject(FlowStore);

  readonly cssTransform = computed(() => {
    const t = this.store.transform();
    return `translate(${t[0]}px, ${t[1]}px) scale(${t[2]})`;
  });
}
