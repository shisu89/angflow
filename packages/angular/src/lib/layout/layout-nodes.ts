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
  /** Group/sub-flow parent id. When present (and in the node set), the node is
   *  clustered within that parent via dagre compound layout. */
  parentId?: string;
}

/**
 * Minimal structural shape `layoutNodes` reads from each edge. Real angflow
 * `Edge` / `InternalEdge` objects satisfy it as-is. When `labelWidth`/
 * `labelHeight` are present, dagre reserves that space for the label;
 * otherwise a truthy `label` reserves a small default box, and a falsy `label`
 * reserves nothing (current behavior). `applyLayout` fills the measured box
 * from the live DOM.
 */
export interface LayoutEdgeInput {
  source: string;
  target: string;
  label?: unknown;
  labelWidth?: number;
  labelHeight?: number;
}

// Match the renderer's unmeasured-node fallbacks (edge-renderer.component.ts).
const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 40;

// Conservative reservation for a labeled edge whose label box wasn't measured.
const DEFAULT_LABEL_WIDTH = 60;
const DEFAULT_LABEL_HEIGHT = 20;

/** Partition `ids` into connected components over `edges` (union-find). Edges
 *  whose endpoints aren't both in `ids` are ignored. Used to detect disconnected
 *  pieces so they can be grid-packed instead of left to dagre's cross-axis cascade. */
export function connectedComponents(
  ids: string[],
  edges: ReadonlyArray<{ source: string; target: string }>,
): string[][] {
  const parent = new Map<string, string>();
  for (const id of ids) parent.set(id, id);
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const idSet = new Set(ids);
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    const a = find(e.source);
    const b = find(e.target);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const g = groups.get(root);
    if (g) g.push(id);
    else groups.set(root, [id]);
  }
  return [...groups.values()];
}

/** Repack disconnected components into a near-square grid, preserving each
 *  component's internal layout. No-op for a single component. `sizeOf` returns
 *  each node's footprint so component bounding boxes (and grid cells) are sized
 *  correctly. Replaces dagre's tendency to stack disconnected pieces along the
 *  cross-axis (angflow-feedback #12). */
export function packComponentsIntoGrid(
  positions: Record<string, { x: number; y: number }>,
  sizeOf: (id: string) => { width: number; height: number },
  components: string[][],
  opts: { nodeSep?: number },
): Record<string, { x: number; y: number }> {
  // Ignore empty components defensively: an empty id list would yield an
  // Infinity bbox and propagate NaN into every cell. connectedComponents never
  // emits empties, but this keeps the helper total for any caller.
  const groups = components.filter((ids) => ids.length > 0);
  if (groups.length <= 1) return positions;
  const sep = opts.nodeSep ?? 50;
  const boxes = groups.map((ids) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      const s = sizeOf(id);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.width);
      maxY = Math.max(maxY, p.y + s.height);
    }
    return { ids, minX, minY, w: maxX - minX, h: maxY - minY };
  });
  boxes.sort((a, b) => b.w * b.h - a.w * a.h);
  const cols = Math.ceil(Math.sqrt(boxes.length));
  const cellW = Math.max(...boxes.map((b) => b.w)) + sep;
  const cellH = Math.max(...boxes.map((b) => b.h)) + sep;
  const out: Record<string, { x: number; y: number }> = {};
  boxes.forEach((box, i) => {
    const cellX = (i % cols) * cellW;
    const cellY = Math.floor(i / cols) * cellH;
    const dx = cellX - box.minX;
    const dy = cellY - box.minY;
    for (const id of box.ids) {
      out[id] = { x: positions[id].x + dx, y: positions[id].y + dy };
    }
  });
  return out;
}

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
 * `initialWidth`/`initialHeight` → 150×40. Edges referencing ids not present in `nodes` are ignored in the result. Lives in the
 * `@angflow/angular/layout` subpath so `@dagrejs/dagre` (an optional peer
 * dependency) is only pulled into bundles that import it.
 *
 * Prefer `NgFlowService.applyLayout(layoutNodes, …)`: it measures live node
 * footprints and edge-label boxes from the DOM and passes them in, so layout is
 * correct even when `measured` is absent/stale (e.g. the controlled-mode
 * round-trip). Calling `layoutNodes` directly uses only the dimensions on the
 * objects you pass — supply measured nodes (e.g. internal nodes) for best
 * results. Edge labels: pass `labelWidth`/`labelHeight` (or a truthy `label` for
 * a default reservation) to reserve dagre space.
 *
 * Groups: a node with a `parentId` that is also in the input is clustered within
 * that parent (dagre compound layout); nesting is supported. Compound output is
 * in absolute coordinates — apply it with
 * `applyLayout(layoutNodes, { coordinateSpace: 'absolute' })` so parented nodes
 * are translated into their parent-relative space. Group boxes are laid out but
 * NOT resized to wrap their members (size them app-side, or see the auto-size
 * feature). Edges whose endpoints aren't in the node set are skipped.
 * Edges whose source or target is a compound parent are also skipped (dagre
 * cannot rank cluster-touching edges). parentId cycles (of any length) are
 * treated as top-level (matching collapse semantics) — cycle members are
 * detached from each other and laid out as ordinary nodes.
 */
export function layoutNodes(
  nodes: LayoutNodeInput[],
  edges: ReadonlyArray<LayoutEdgeInput>,
  opts: LayoutNodesOptions = {},
): Record<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id));

  // Build the valid parent-child map: entries where the parent exists in the
  // input set and is not the node itself (self-parent guard).
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    if (n.parentId != null && n.parentId !== n.id && ids.has(n.parentId)) {
      parentOf.set(n.id, n.parentId);
    }
  }

  // Cycle detection: walk each node's parent chain; if the walk revisits a
  // node already seen in this walk, a cycle exists — collect its members and
  // remove them from parentOf so graphlib never sees a cycle.
  // Only actual cycle members are removed; nodes that point INTO a cycle but
  // are not on it (e.g. d→a where a∈cycle) keep their parentOf entry intact
  // (the parent was just demoted to top-level, which is a valid parent).
  const inCycle = new Set<string>();
  for (const start of parentOf.keys()) {
    if (inCycle.has(start)) continue; // already processed as part of a known cycle
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur !== undefined && parentOf.has(cur)) {
      if (seen.has(cur)) {
        // cur is the entry point of the cycle — trace from cur back to cur
        // to collect exactly the cycle members.
        let walker = cur;
        do {
          inCycle.add(walker);
          walker = parentOf.get(walker)!;
        } while (walker !== cur);
        break;
      }
      seen.add(cur);
      cur = parentOf.get(cur);
    }
  }
  for (const id of inCycle) {
    parentOf.delete(id);
  }

  const compound = parentOf.size > 0;

  const g = new graphlib.Graph(compound ? { compound: true } : undefined);
  g.setGraph({
    rankdir: opts.direction ?? 'TB',
    nodesep: opts.nodeSep ?? 50,
    ranksep: opts.rankSep ?? 80,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const width = n.measured?.width ?? n.width ?? n.initialWidth ?? DEFAULT_WIDTH;
    const height = n.measured?.height ?? n.height ?? n.initialHeight ?? DEFAULT_HEIGHT;
    g.setNode(n.id, { width, height });
  }

  const compoundParentIds = new Set<string>();
  if (compound) {
    for (const [child, parent] of parentOf) {
      g.setParent(child, parent);
      compoundParentIds.add(parent);
    }
  }

  for (const e of edges) {
    // Skip dangling edges: otherwise dagre auto-creates phantom nodes that
    // distort layout (especially compound clusters).
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    // Skip edges incident on a compound parent: dagre cannot rank an edge
    // touching a cluster and throws ("Cannot set properties of undefined").
    if (compoundParentIds.has(e.source) || compoundParentIds.has(e.target)) continue;
    const hasExplicitBox = e.labelWidth != null || e.labelHeight != null;
    if (e.label || hasExplicitBox) {
      g.setEdge(e.source, e.target, {
        width: e.labelWidth ?? DEFAULT_LABEL_WIDTH,
        height: e.labelHeight ?? DEFAULT_LABEL_HEIGHT,
        labelpos: 'c',
      });
    } else {
      g.setEdge(e.source, e.target);
    }
  }

  layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const placed = g.node(n.id) as { x: number; y: number; width: number; height: number };
    // dagre positions by center; angflow by top-left. Use dagre's computed
    // width/height so cluster (group) nodes convert by their wrapping size
    // (for leaf nodes this equals the size we set, so flat output is unchanged).
    positions[n.id] = { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 };
  }
  return positions;
}
