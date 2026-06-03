import { graphlib, layout } from '@dagrejs/dagre';
import type { AgentLayoutFn } from '../types/node-template';

/**
 * Turnkey dagre adapter for the agent bridge's `layout_nodes` tool.
 *
 * Lives in the `@angflow/angular/layout` subpath so `@dagrejs/dagre` (an
 * optional peer dependency) is only pulled into bundles that import it.
 *
 * @example
 * ```ts
 * import { dagreLayout } from '@angflow/angular/layout';
 * provideAgentBridge({ transports: [...], layout: dagreLayout });
 * ```
 */
export const dagreLayout: AgentLayoutFn = (nodes, edges, opts) => {
  const g = new graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSep ?? 50,
    ranksep: opts.rankSep ?? 80,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, { width: n.width, height: n.height });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  layout(g);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const placed = g.node(n.id) as { x: number; y: number };
    // dagre positions nodes by center; angflow positions by top-left corner.
    positions[n.id] = { x: placed.x - n.width / 2, y: placed.y - n.height / 2 };
  }
  return positions;
};
