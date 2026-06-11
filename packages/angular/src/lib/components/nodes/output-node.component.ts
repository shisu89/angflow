import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@angflow/system';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in node renderer with only a target handle on the top.
 * Used when a node has `type: 'output'`. Reads per-node state through
 * `injectNgFlowNode()` (no `@Input()`s).
 */
@Component({
  selector: 'ng-flow-output-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div>{{ node.data()?.label }}</div>
  `,
})
export class OutputNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<{ label?: string } & Record<string, unknown>>();
}
