import type { AgentLayoutFn } from '../types/node-template';
import { layoutNodes } from './layout-nodes';

/**
 * Dagre layout in the `AgentLayoutFn` shape. Most apps should call
 * {@link layoutNodes} directly (or `NgFlowService.applyLayout(layoutNodes, …)`)
 * — this wrapper exists for wiring the agent bridge's `layout_nodes` tool:
 *
 * ```ts
 * provideAgentBridge({ transports: [...], layout: dagreLayout });
 * ```
 */
// opts always carries direction: the agent bridge validates and defaults it before calling.
export const dagreLayout: AgentLayoutFn = (nodes, edges, opts) => layoutNodes(nodes, edges, opts);
