import { inject } from '@angular/core';
import { NG_FLOW_NODE_CONTEXT } from '../services/tokens';
import type { NgFlowNodeContext } from '../types';

/**
 * Retrieve the per-node reactive context from a component registered via
 * `nodeTypes` on `<ng-flow>`. The returned object exposes read-only signals
 * for every property the library tracks per node (id, data, selected,
 * dragging, position, zIndex, etc.).
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyNode {
 *   readonly node = injectNgFlowNode<MyData>();
 *   // node.id(), node.data(), node.selected(), ...
 * }
 * ```
 *
 * @throws Error when called outside of a node-rendered component tree.
 */
export function injectNgFlowNode<TData = unknown>(): NgFlowNodeContext<TData> {
  const context = inject(NG_FLOW_NODE_CONTEXT, { optional: true });
  if (!context) {
    throw new Error(
      'injectNgFlowNode() was called outside of a node-rendered component tree. ' +
      'It can only be called from components registered via nodeTypes on <ng-flow>.',
    );
  }
  return context as NgFlowNodeContext<TData>;
}
