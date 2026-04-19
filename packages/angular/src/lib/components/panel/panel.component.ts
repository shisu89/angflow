import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { PanelPosition } from '@angflow/system';

/**
 * Absolutely-positioned overlay anchored to one of the nine canvas corners/edges.
 * Projects arbitrary content — useful for custom toolbars or HUDs.
 *
 * @example
 * ```html
 * <ng-flow-panel position="top-right">
 *   <button (click)="save()">Save</button>
 * </ng-flow-panel>
 * ```
 */
@Component({
  selector: 'ng-flow-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__panel xy-flow__panel',
    '[class.top]': 'isTop()',
    '[class.bottom]': 'isBottom()',
    '[class.left]': 'isLeft()',
    '[class.right]': 'isRight()',
    '[class.center]': 'isCenter()',
  },
  template: `<ng-content />`,
})
export class PanelComponent {
  /** Which corner/edge of the canvas the panel anchors to. */
  readonly position = input<PanelPosition>('top-left');

  readonly isTop = computed(() => this.position().includes('top'));
  readonly isBottom = computed(() => this.position().includes('bottom'));
  readonly isLeft = computed(() => this.position().includes('left'));
  readonly isRight = computed(() => this.position().includes('right'));
  readonly isCenter = computed(() => this.position().includes('center'));
}
