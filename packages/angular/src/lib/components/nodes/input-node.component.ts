import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@angflow/system';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in node renderer with only a source handle on the bottom.
 * Used when a node has `type: 'input'`. Reads per-node state through
 * `injectNgFlowNode()` (no `@Input()`s).
 */
@Component({
  selector: 'ng-flow-input-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>{{ node.data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
})
export class InputNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<{ label?: string } & Record<string, unknown>>();
}
