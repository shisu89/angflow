import { Component, ChangeDetectionStrategy, input, inject, computed } from '@angular/core';
import { getEdgeToolbarTransform } from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';

/**
 * Floating toolbar anchored to a fixed `(x, y)` in flow coordinates — typically
 * placed near an edge's midpoint. By default it shows only while the owning
 * edge is selected.
 *
 * @example
 * ```html
 * <ng-flow-edge-toolbar [edgeId]="edge.id" [x]="labelX" [y]="labelY">
 *   <button (click)="remove(edge.id)">Delete</button>
 * </ng-flow-edge-toolbar>
 * ```
 */
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

  /**
   * O(1) edge resolution via the store's edgeLookup. Reads version() so the
   * computed re-fires when setEdges repopulates the lookup and bumps the
   * version (e.g. on selection) — edgeLookup is a plain Map, not a signal.
   */
  readonly resolvedEdge = computed(() => {
    this.store.version();
    return this.store.edgeLookup.get(this.edgeId());
  });

  readonly shouldShow = computed(() => {
    const vis = this.isVisible();
    if (vis !== undefined) return vis;
    return this.resolvedEdge()?.selected ?? false;
  });

  readonly zIndex = computed(() => {
    return (this.resolvedEdge()?.zIndex ?? 0) + 1;
  });

  readonly toolbarTransform = computed(() => {
    const [tx, ty, zoom] = this.store.transform();
    // x,y are in flow coordinates; convert to viewport pixel coordinates
    const vx = this.x() * zoom + tx;
    const vy = this.y() * zoom + ty;
    // The toolbar lives in the untransformed container (a direct <ng-flow>
    // child), so it is already in screen space. Pass zoom=1 to keep it a
    // constant screen size — applying scale(1/zoom) here would invert zoom
    // (half-size at 2×, double-size at 0.5×).
    return getEdgeToolbarTransform(vx, vy, 1, this.alignX(), this.alignY());
  });
}
