import { Component, ChangeDetectionStrategy, input, inject, computed } from '@angular/core';
import { getEdgeToolbarTransform } from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';

@Component({
  selector: 'ng-flow-edge-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__edge-toolbar xy-flow__edge-toolbar',
    '[style.display]': 'shouldShow() ? "block" : "none"',
    '[style.position]': '"absolute"',
    '[style.transform]': 'toolbarTransform()',
    '[style.transform-origin]': '"0 0"',
    '[style.z-index]': 'zIndex()',
    '[style.pointer-events]': '"all"',
  },
  template: `<ng-content />`,
})
export class EdgeToolbarComponent {
  private readonly store = inject(FlowStore);

  /** The ID of the edge this toolbar belongs to. */
  readonly edgeId = input.required<string>();

  /** Horizontal position in flow coordinates. */
  readonly x = input.required<number>();

  /** Vertical position in flow coordinates. */
  readonly y = input.required<number>();

  /** Horizontal alignment relative to (x, y). */
  readonly alignX = input<'left' | 'center' | 'right'>('center');

  /** Vertical alignment relative to (x, y). */
  readonly alignY = input<'top' | 'center' | 'bottom'>('center');

  /** Override visibility. Defaults to showing when the edge is selected. */
  readonly isVisible = input<boolean | undefined>(undefined);

  readonly shouldShow = computed(() => {
    const vis = this.isVisible();
    if (vis !== undefined) return vis;
    const edge = this.store.edges().find(e => e.id === this.edgeId());
    return edge?.selected ?? false;
  });

  readonly zIndex = computed(() => {
    const edge = this.store.edges().find(e => e.id === this.edgeId());
    return ((edge as any)?.zIndex ?? 0) + 1;
  });

  readonly toolbarTransform = computed(() => {
    const zoom = this.store.transform()[2];
    return getEdgeToolbarTransform(this.x(), this.y(), zoom, this.alignX(), this.alignY());
  });
}
