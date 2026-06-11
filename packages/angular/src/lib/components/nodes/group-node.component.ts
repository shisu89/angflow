import { Component, ChangeDetectionStrategy } from '@angular/core';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in container node used for sub-flows. No handles and no label —
 * other nodes parent to it via `parentId` and optionally constrain movement
 * with `extent: 'parent'`. Reads per-node state through `injectNgFlowNode()`
 * (no `@Input()`s); the renderer applies width/height/transform on the host
 * wrapper, so the group body itself just fills its box.
 */
@Component({
  selector: 'ng-flow-group-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'style': 'width: 100%; height: 100%;',
  },
  template: ``,
})
export class GroupNodeComponent {
  readonly node = injectNgFlowNode();
}
