import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@angflow/system';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in node renderer with a target handle on top and a source handle on
 * bottom. Used when a node has no `type` or `type: 'default'`. Reads per-node
 * state through `injectNgFlowNode()` (no `@Input()`s).
 */
@Component({
  selector: 'ng-flow-default-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div>{{ node.data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
})
export class DefaultNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<{ label?: string } & Record<string, unknown>>();
}
