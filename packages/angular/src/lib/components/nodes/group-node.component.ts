import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Position } from '@angflow/system';

/**
 * Built-in container node used for sub-flows. No handles and no label —
 * other nodes parent to it via `parentId` and optionally constrain movement
 * with `extent: 'parent'`.
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
  readonly id = input.required<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly data = input<any>(); // untyped built-in node data
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<Position>();
  readonly targetPosition = input<Position>();
  readonly dragHandle = input<string>();
}
