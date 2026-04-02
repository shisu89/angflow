import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { PanelPosition } from '@angflow/system';

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
  readonly position = input<PanelPosition>('top-left');

  readonly isTop = computed(() => this.position().includes('top'));
  readonly isBottom = computed(() => this.position().includes('bottom'));
  readonly isLeft = computed(() => this.position().includes('left'));
  readonly isRight = computed(() => this.position().includes('right'));
  readonly isCenter = computed(() => this.position().includes('center'));
}
