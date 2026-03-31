import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';

@Component({
  selector: 'ng-flow-selection-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'style': 'display: contents;',
  },
  template: `
    @if (isVisible()) {
      <div
        class="ng-flow__selection xy-flow__selection"
        style="position: absolute; pointer-events: none; z-index: 10;"
        [style.left.px]="rect()!.x"
        [style.top.px]="rect()!.y"
        [style.width.px]="rect()!.width"
        [style.height.px]="rect()!.height"
      ></div>
    }
  `,
})
export class SelectionBoxComponent {
  readonly store = inject(FlowStore);

  readonly isVisible = computed(() => this.store.userSelectionActive() && this.store.userSelectionRect() !== null);
  readonly rect = computed(() => this.store.userSelectionRect());
}
