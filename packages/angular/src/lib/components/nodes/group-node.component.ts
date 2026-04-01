import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Position } from '@ngflow/system';

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
  readonly data = input<any>();
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
