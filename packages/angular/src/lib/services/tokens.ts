import { InjectionToken } from '@angular/core';
import type { NgFlowNodeContext } from '../types';

/**
 * DI token providing the host node's id to components nested inside a node
 * template. Injected automatically by the node renderer — custom components
 * like `<ng-flow-handle>` or `<ng-flow-node-toolbar>` use it to resolve their
 * owning node without explicit `[nodeId]` binding.
 *
 * @example
 * ```typescript
 * constructor(@Optional() @Inject(NODE_ID) private nodeId: string | null) {}
 * ```
 */
export const NODE_ID = new InjectionToken<string>('NODE_ID');

/**
 * DI token providing the host edge's id to components nested inside an edge
 * template. Mirror of {@link NODE_ID} for edge components.
 */
export const EDGE_ID = new InjectionToken<string>('EDGE_ID');

/**
 * DI token providing the per-node context (reactive signals) to components
 * registered via `nodeTypes` on `<ng-flow>`. Consumers retrieve the context
 * via the public `injectNgFlowNode<T>()` helper rather than reading the token
 * directly.
 */
export const NG_FLOW_NODE_CONTEXT = new InjectionToken<NgFlowNodeContext<unknown>>(
  'NG_FLOW_NODE_CONTEXT',
);
