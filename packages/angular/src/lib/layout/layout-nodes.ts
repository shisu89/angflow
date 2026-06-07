import { graphlib, layout } from '@dagrejs/dagre';

export interface LayoutNodesOptions {
  /** Rank direction. Default 'TB'. */
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Pixels between nodes in the same rank. Default 50. */
  nodeSep?: number;
  /** Pixels between ranks. Default 80. */
  rankSep?: number;
}

/**
 * Minimal structural shape `layoutNodes` reads from each node. Real angflow
 * `Node` / `InternalNode` objects satisfy it as-is — no mapping required.
 */
export interface LayoutNodeInput {
  id: string;
  width?: number | null;
  height?: number | null;
  initialWidth?: number;
  initialHeight?: number;
  measured?: { width?: number; height?: number };
}

// Match the renderer's unmeasured-node fallbacks (edge-renderer.component.ts).
const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 40;

/**
 * Standalone dagre auto-layout: returns a map of node id → top-left position
 * in flow coordinates. Pure — no store, no DI, callable from anywhere:
 *
 * ```ts
 * import { layoutNodes } from '@angflow/angular/layout';
 * const positions = layoutNodes(flow.getNodes(), flow.getEdges(), { direction: 'LR' });
 * flow.setNodePositions(positions);
 * // or in one call: flow.applyLayout(layoutNodes, { direction: 'LR' });
 * ```
 *
 * Dimensions resolve per node as `measured` → `width`/`height` →
 * `initialWidth`/`initialHeight` → 150×40. Lives in the
 * `@angflow/angular/layout` subpath so `@dagrejs/dagre` (an optional peer
 * dependency) is only pulled into bundles that import it.
 */
export function layoutNodes(
  nodes: LayoutNodeInput[],
  edges: ReadonlyArray<{ source: string; target: string }>,
  opts: LayoutNodesOptions = {},
): Record<string, { x: number; y: number }> {
  const g = new graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction ?? 'TB',
    nodesep: opts.nodeSep ?? 50,
    ranksep: opts.rankSep ?? 80,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const dims = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const width = n.measured?.width ?? n.width ?? n.initialWidth ?? DEFAULT_WIDTH;
    const height = n.measured?.height ?? n.height ?? n.initialHeight ?? DEFAULT_HEIGHT;
    dims.set(n.id, { width, height });
    g.setNode(n.id, { width, height });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const placed = g.node(n.id) as { x: number; y: number };
    const d = dims.get(n.id)!;
    // dagre positions nodes by center; angflow positions by top-left corner.
    positions[n.id] = { x: placed.x - d.width / 2, y: placed.y - d.height / 2 };
  }
  return positions;
}
