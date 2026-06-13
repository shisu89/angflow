import { graphlib, layout } from '@dagrejs/dagre';

export interface LayoutNodesOptions {
  /** Rank direction. Default 'TB'. */
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Pixels between nodes in the same rank. Default 50. */
  nodeSep?: number;
  /** Pixels between ranks. Default 80. */
  rankSep?: number;
  /** Grid-pack disconnected components instead of letting dagre cascade them
   *  along the cross-axis. No-op for a single connected component. Default true. */
  packComponents?: boolean;
  /** Padding (all sides) when sizing a group's box to its members. Default 24. */
  groupPadding?: number;
  /** Extra top inset reserved for a group header when sizing its box. Default 40. */
  groupHeaderHeight?: number;
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
   *  laid out within that parent's box (recursive level-by-level layout). */
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

// Group box inset defaults (match the app's GROUP_PAD / GROUP_HEADER).
const DEFAULT_GROUP_PADDING = 24;
const DEFAULT_GROUP_HEADER = 40;

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

/** Resolve a node's footprint the way layout does: measured → width → initial → default. */
function baseDims(n: LayoutNodeInput): { width: number; height: number } {
  return {
    width: n.measured?.width ?? n.width ?? n.initialWidth ?? DEFAULT_WIDTH,
    height: n.measured?.height ?? n.height ?? n.initialHeight ?? DEFAULT_HEIGHT,
  };
}

/** Build the valid, cycle-free parent map: entries where the parent exists in the
 *  set and isn't the node itself; parentId cycles (any length) are removed so the
 *  members are treated as top-level (matching collapse semantics). */
function buildValidParentOf(nodes: LayoutNodeInput[], ids: Set<string>): Map<string, string> {
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    if (n.parentId != null && n.parentId !== n.id && ids.has(n.parentId)) {
      parentOf.set(n.id, n.parentId);
    }
  }
  const inCycle = new Set<string>();
  for (const start of parentOf.keys()) {
    if (inCycle.has(start)) continue;
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur !== undefined && parentOf.has(cur)) {
      if (seen.has(cur)) {
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
  for (const id of inCycle) parentOf.delete(id);
  return parentOf;
}

interface LayoutCtx {
  parentOf: Map<string, string>;
  childrenOf: Map<string, LayoutNodeInput[]>;
  nodeById: Map<string, LayoutNodeInput>;
  edges: ReadonlyArray<LayoutEdgeInput>;
  opts: LayoutNodesOptions;
  /** group id → its laid-out box size, filled bottom-up by the recursion. */
  boxes: Record<string, { width: number; height: number }>;
  groupPadding: number;
  groupHeaderHeight: number;
  packComponents: boolean;
}

/** Lay out one flat level with dagre (no compound — group members are pre-sized
 *  boxes). Returns top-left positions. */
function dagreFlat(
  members: LayoutNodeInput[],
  edges: ReadonlyArray<LayoutEdgeInput>,
  opts: LayoutNodesOptions,
  sizeOf: (id: string) => { width: number; height: number },
): Record<string, { x: number; y: number }> {
  const g = new graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction ?? 'TB',
    nodesep: opts.nodeSep ?? 50,
    ranksep: opts.rankSep ?? 80,
  });
  g.setDefaultEdgeLabel(() => ({}));
  const idSet = new Set(members.map((m) => m.id));
  for (const m of members) {
    const s = sizeOf(m.id);
    g.setNode(m.id, { width: s.width, height: s.height });
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target) || e.source === e.target) continue;
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
  for (const m of members) {
    const placed = g.node(m.id) as { x: number; y: number; width: number; height: number };
    positions[m.id] = { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 };
  }
  return positions;
}

/** Lift every edge to the members of the current level: map each endpoint to its
 *  ancestor that is in `memberIds`, drop intra-member and dangling edges, and
 *  dedupe parallels created by lifting. Labels are kept only for edges that were
 *  NOT lifted (both endpoints are real siblings at this level). */
function liftEdges(members: LayoutNodeInput[], ctx: LayoutCtx): LayoutEdgeInput[] {
  const memberIds = new Set(members.map((m) => m.id));
  const lift = (id: string): string | undefined => {
    let cur = id;
    while (!memberIds.has(cur)) {
      const p = ctx.parentOf.get(cur);
      if (p === undefined) return undefined;
      cur = p;
    }
    return cur;
  };
  const seen = new Set<string>();
  const out: LayoutEdgeInput[] = [];
  for (const e of ctx.edges) {
    if (!ctx.nodeById.has(e.source) || !ctx.nodeById.has(e.target)) continue; // dangling
    const s = lift(e.source);
    const t = lift(e.target);
    if (s === undefined || t === undefined || s === t) continue;
    // JSON-encode the pair so the dedupe key can't collide for ids containing
    // the separator (node ids may contain spaces, arrows, etc.).
    const key = JSON.stringify([s, t]);
    if (seen.has(key)) continue;
    seen.add(key);
    const lifted = !(s === e.source && t === e.target);
    out.push(
      lifted
        ? { source: s, target: t }
        : { source: s, target: t, label: e.label, labelWidth: e.labelWidth, labelHeight: e.labelHeight },
    );
  }
  return out;
}

/** Recursively lay out one level (the nodes whose parent is the level's owner).
 *  Returns absolute top-left positions for every node at AND under this level.
 *  Group members are sized to their recursively-laid-out box; disconnected
 *  components at this level are grid-packed. */
function layoutLevel(members: LayoutNodeInput[], ctx: LayoutCtx): Record<string, { x: number; y: number }> {
  const sizeOf = (id: string): { width: number; height: number } =>
    ctx.boxes[id] ?? baseDims(ctx.nodeById.get(id)!);

  const localChild: Record<string, Record<string, { x: number; y: number }>> = {};
  const localBoxOrigin: Record<string, { x: number; y: number }> = {};
  for (const m of members) {
    const children = ctx.childrenOf.get(m.id);
    if (!children || children.length === 0) continue;
    const childAbs = layoutLevel(children, ctx); // fills ctx.boxes for any sub-groups first
    localChild[m.id] = childAbs;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of children) {
      const s = sizeOf(c.id);
      const p = childAbs[c.id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.width);
      maxY = Math.max(maxY, p.y + s.height);
    }
    ctx.boxes[m.id] = {
      width: maxX - minX + 2 * ctx.groupPadding,
      height: maxY - minY + 2 * ctx.groupPadding + ctx.groupHeaderHeight,
    };
    // Box top-left in the children's coordinate space (children sit pad in from the
    // left and pad+header down from the top).
    localBoxOrigin[m.id] = { x: minX - ctx.groupPadding, y: minY - ctx.groupPadding - ctx.groupHeaderHeight };
  }

  const levelEdges = liftEdges(members, ctx);
  let positions = dagreFlat(members, levelEdges, ctx.opts, sizeOf);
  if (ctx.packComponents) {
    const components = connectedComponents(members.map((m) => m.id), levelEdges);
    positions = packComponentsIntoGrid(positions, sizeOf, components, ctx.opts);
  }

  const result: Record<string, { x: number; y: number }> = {};
  for (const m of members) {
    result[m.id] = positions[m.id];
    const childAbs = localChild[m.id];
    if (!childAbs) continue;
    const origin = localBoxOrigin[m.id];
    // childAbs is the FULL subtree returned by the recursive layoutLevel call —
    // direct children AND all descendants — so this single shift re-bases the
    // whole nested group under m's final position. (Don't change layoutLevel to
    // return direct children only without revisiting this.)
    for (const id of Object.keys(childAbs)) {
      result[id] = {
        x: positions[m.id].x + (childAbs[id].x - origin.x),
        y: positions[m.id].y + (childAbs[id].y - origin.y),
      };
    }
  }
  return result;
}

/**
 * Standalone dagre auto-layout: returns a map of node id → top-left position in
 * flow coordinates. Pure — no store, no DI:
 *
 * ```ts
 * import { layoutNodes } from '@angflow/angular/layout';
 * flow.applyLayout(layoutNodes, { direction: 'LR' });
 * ```
 *
 * Dimensions resolve per node as `measured` → `width`/`height` →
 * `initialWidth`/`initialHeight` → 150×40. Edges referencing ids not in `nodes`
 * are skipped. Lives in the `@angflow/angular/layout` subpath so `@dagrejs/dagre`
 * (an optional peer) is only pulled into bundles that import it.
 *
 * Prefer `NgFlowService.applyLayout(layoutNodes, …)`: it measures live node and
 * edge-label footprints from the DOM and passes them in, so layout is correct
 * even when `measured` is absent/stale (controlled-mode round-trip).
 *
 * Groups: a node with a `parentId` that is also in the input is laid out *within*
 * that parent. Each group is sized to its (recursively laid-out) members plus
 * `groupPadding` and `groupHeaderHeight`, and laid out at the level above as a
 * single box. Nesting is supported. Output is in absolute coordinates — apply it
 * with `applyLayout(layoutNodes, { coordinateSpace: 'absolute' })` so parented
 * nodes are translated into their parent-relative space.
 *
 * Disconnected components (within a group or among top-level nodes) are packed
 * into a near-square grid rather than cascaded along the cross-axis — keeping
 * spatially-grouped, sparsely-connected canvases compact (set
 * `packComponents: false` to keep dagre's raw cascade). parentId cycles (any
 * length) are treated as top-level.
 */
export function layoutNodes(
  nodes: LayoutNodeInput[],
  edges: ReadonlyArray<LayoutEdgeInput>,
  opts: LayoutNodesOptions = {},
): Record<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id));
  const parentOf = buildValidParentOf(nodes, ids);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, LayoutNodeInput[]>();
  for (const n of nodes) {
    const p = parentOf.get(n.id);
    if (p === undefined) continue;
    const arr = childrenOf.get(p);
    if (arr) arr.push(n);
    else childrenOf.set(p, [n]);
  }
  const topLevel = nodes.filter((n) => !parentOf.has(n.id));
  const ctx: LayoutCtx = {
    parentOf,
    childrenOf,
    nodeById,
    edges,
    opts,
    boxes: {},
    groupPadding: opts.groupPadding ?? DEFAULT_GROUP_PADDING,
    groupHeaderHeight: opts.groupHeaderHeight ?? DEFAULT_GROUP_HEADER,
    packComponents: opts.packComponents ?? true,
  };
  return layoutLevel(topLevel, ctx);
}
