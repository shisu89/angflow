import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@xyflow/system';

@Component({
  selector: 'ng-flow-default-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div>{{ data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
})
export class DefaultNodeComponent {
  readonly Position = Position;
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
