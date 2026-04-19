import { InjectionToken } from '@angular/core';

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
