import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';

@Component({
  selector: 'ng-flow-a11y-descriptions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [id]="rfId + '-node-desc'" class="xy-flow__sr-only">
      {{ config()['node.a11yDescription.default'] }}
    </div>
    <div [id]="rfId + '-handle-desc'" class="xy-flow__sr-only">
      {{ config()['handle.ariaLabel'] }}
    </div>
    <div [id]="rfId + '-edge-desc'" class="xy-flow__sr-only">
      Edge connection
    </div>
  `,
  host: {
    'style': 'position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); border: 0;',
  },
})
export class A11yDescriptionsComponent {
  private store = inject(FlowStore);

  get rfId(): string {
    return this.store.rfId();
  }

  readonly config = this.store.ariaLabelConfig;
}
