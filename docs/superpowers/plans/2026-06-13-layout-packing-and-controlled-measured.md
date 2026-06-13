# Group-aware Packed Layout + Controlled `measured` Resilience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix angflow-feedback #13 (controlled `[nodes]` round-trips drop `measured`, mis-anchoring floating edges) and #12 (compound `layoutNodes` cascades disconnected spatial groups into a giant diagonal staircase; `positionAbsolute` stale after `applyLayout`).

**Architecture:** Three independent changes. (A) `@angflow/system`'s `adoptUserNodes` preserves a node's prior `measured` when the incoming controlled node omits it. (B) `@angflow/angular`'s `layoutNodes` is refactored from a single dagre compound pass into a recursive, level-by-level layout that sizes each group to its (recursively laid-out) members and grid-packs disconnected components at every level instead of letting dagre cascade them. (C) `NgFlowService` gains `getAbsolutePosition(id)` that resolves a node's absolute position on demand by walking the `parentId` chain.

**Tech Stack:** TypeScript, Angular (zoneless), `@dagrejs/dagre`, Vitest.

**Reference:** Design spec `docs/superpowers/specs/2026-06-13-layout-packing-and-controlled-measured-design.md`. App's proven prior art: `brainstorm_agentic_app/web/src/app/canvas/packed-group-layout.ts` (being absorbed into the library).

**Conventions:**
- Tests are `*.spec.ts`, run with `vitest run` from the package dir.
- Run `npm test` in `packages/system` and `packages/angular` (NOT from repo root).
- No agent-tool catalog change → no `AGENT_BRIDGE.md` edit and no `@angflow/mcp` snapshot regen.

---

## Task 1: Preserve `measured` across controlled round-trips (#13)

**Files:**
- Modify: `packages/system/src/utils/store.ts` (`adoptUserNodes`, ~line 164)
- Test: `packages/system/src/utils/store.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/system/src/utils/store.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { adoptUserNodes } from './store';
import type { NodeBase, InternalNodeBase, NodeLookup, ParentLookup } from '../types';

function lookups() {
  return {
    nodeLookup: new Map() as NodeLookup<InternalNodeBase<NodeBase>>,
    parentLookup: new Map() as ParentLookup<InternalNodeBase<NodeBase>>,
  };
}

const node = (id: string, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});

describe('adoptUserNodes measured preservation', () => {
  it('preserves prior measured when a re-adopted node (new identity) omits it', () => {
    const { nodeLookup, parentLookup } = lookups();
    // First adopt with measured present (as if DOM-measured / app-provided).
    adoptUserNodes([node('a', { measured: { width: 200, height: 80 } })], nodeLookup, parentLookup);
    expect(nodeLookup.get('a')!.measured).toEqual({ width: 200, height: 80 });
    // Re-adopt with a NEW object that omits measured (the controlled round-trip).
    adoptUserNodes([node('a')], nodeLookup, parentLookup);
    expect(nodeLookup.get('a')!.measured).toEqual({ width: 200, height: 80 });
  });

  it('leaves measured undefined for a brand-new node', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('b')], nodeLookup, parentLookup);
    expect(nodeLookup.get('b')!.measured).toEqual({ width: undefined, height: undefined });
  });

  it('lets incoming measured override the prior value', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('a', { measured: { width: 200, height: 80 } })], nodeLookup, parentLookup);
    adoptUserNodes([node('a', { measured: { width: 120, height: 60 } })], nodeLookup, parentLookup);
    expect(nodeLookup.get('a')!.measured).toEqual({ width: 120, height: 60 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/system && npx vitest run src/utils/store.spec.ts`
Expected: the first test FAILS — `measured` is `{ width: undefined, height: undefined }` after re-adopt (prior value dropped). The other two pass.

> If the imports `NodeLookup`/`ParentLookup`/`InternalNodeBase` aren't all exported from `../types`, import them from where the file's other `import type` lines resolve them (check the top of `store.ts`). Keep the fixture minimal — `NodeBase` requires only `id`, `position`, `data`.

- [ ] **Step 3: Apply the minimal fix**

In `packages/system/src/utils/store.ts`, in `adoptUserNodes`, the `else` branch builds a fresh internal node. Change the `measured` block (currently lines ~164–167):

```ts
        measured: {
          width: userNode.measured?.width,
          height: userNode.measured?.height,
        },
```

to fall back to the prior internal node's measured (`internalNode` still references the previous entry here — the reassignment to `internalNode` happens on this same statement's left-hand side, after the RHS is evaluated, exactly as the adjacent `parseHandles(userNode, internalNode)` relies on):

```ts
        measured: {
          width: userNode.measured?.width ?? internalNode?.measured?.width,
          height: userNode.measured?.height ?? internalNode?.measured?.height,
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/system && npx vitest run src/utils/store.spec.ts`
Expected: all 3 PASS.

- [ ] **Step 5: Run the full system suite (no regressions)**

Run: `cd packages/system && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/system/src/utils/store.ts packages/system/src/utils/store.spec.ts
git commit -m "fix(system): preserve prior measured on controlled node re-adopt

adoptUserNodes dropped a node's DOM-measured size when a controlled
[nodes] round-trip supplied a fresh object without measured, breaking
floating-edge anchoring (angflow-feedback #13). Fall back to the prior
internal node's measured when the incoming node omits it.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Layout helpers — connected components + grid packing

**Files:**
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts` (add two exported helpers)
- Test: `packages/angular/src/lib/layout/layout-nodes.spec.ts` (append a `describe` block)

These are pure functions with no dagre dependency, built and tested in isolation before the `layoutNodes` refactor (Task 3) consumes them.

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/layout/layout-nodes.spec.ts` (add `connectedComponents, packComponentsIntoGrid` to the existing top import from `./layout-nodes`):

```ts
describe('connectedComponents', () => {
  it('groups ids joined by edges and isolates the rest', () => {
    const comps = connectedComponents(
      ['a', 'b', 'c', 'd'],
      [{ source: 'a', target: 'b' }],
    );
    // a,b together; c and d each alone (order within/among components not asserted)
    const sets = comps.map((c) => new Set(c));
    expect(comps).toHaveLength(3);
    expect(sets.some((s) => s.has('a') && s.has('b'))).toBe(true);
    expect(sets.some((s) => s.size === 1 && s.has('c'))).toBe(true);
    expect(sets.some((s) => s.size === 1 && s.has('d'))).toBe(true);
  });

  it('returns one component when all ids are connected', () => {
    const comps = connectedComponents(
      ['a', 'b', 'c'],
      [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }],
    );
    expect(comps).toHaveLength(1);
  });

  it('ignores edges whose endpoints are not in the id list', () => {
    const comps = connectedComponents(['a', 'b'], [{ source: 'a', target: 'ghost' }]);
    expect(comps).toHaveLength(2);
  });
});

describe('packComponentsIntoGrid', () => {
  const size = () => ({ width: 100, height: 100 });

  it('returns positions unchanged for a single component', () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const out = packComponentsIntoGrid(positions, () => size(), [['a', 'b']], {});
    expect(out).toEqual(positions);
  });

  it('packs many disconnected single-node components into a compact grid (not a line)', () => {
    // 9 isolated nodes that dagre would cascade; expect a ~3x3 grid bbox, not 9 wide/tall.
    const ids = Array.from({ length: 9 }, (_, i) => `n${i}`);
    // Pretend dagre cascaded them diagonally.
    const positions = Object.fromEntries(ids.map((id, i) => [id, { x: i * 500, y: i * 500 }]));
    const components = ids.map((id) => [id]);
    const out = packComponentsIntoGrid(positions, () => size(), components, { nodeSep: 50 });
    const xs = ids.map((id) => out[id].x);
    const ys = ids.map((id) => out[id].y);
    const bboxW = Math.max(...xs) - Math.min(...xs) + 100;
    const bboxH = Math.max(...ys) - Math.min(...ys) + 100;
    // 3 columns x 3 rows of 150px cells => roughly 450 x 450, far from a 4500px line.
    expect(bboxW).toBeLessThan(700);
    expect(bboxH).toBeLessThan(700);
  });

  it('preserves each component\'s internal layout (relative offsets) while repacking', () => {
    // Two 2-node components; within each, the second node sits +20px right of the first.
    const positions = {
      a1: { x: 0, y: 0 }, a2: { x: 20, y: 0 },
      b1: { x: 9999, y: 9999 }, b2: { x: 10019, y: 9999 },
    };
    const out = packComponentsIntoGrid(positions, () => size(), [['a1', 'a2'], ['b1', 'b2']], { nodeSep: 50 });
    expect(out.a2.x - out.a1.x).toBe(20);
    expect(out.b2.x - out.b1.x).toBe(20);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/angular && npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: FAIL — `connectedComponents` / `packComponentsIntoGrid` are not exported.

- [ ] **Step 3: Implement the helpers**

In `packages/angular/src/lib/layout/layout-nodes.ts`, add (after the `DEFAULT_LABEL_*` consts, above `layoutNodes`):

```ts
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
    // path-compress
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
  if (components.length <= 1) return positions;
  const sep = opts.nodeSep ?? 50;
  const boxes = components.map((ids) => {
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
  // Largest-first gives a stable, tidy pack (ties keep input order — V8 sort is stable).
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
```

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/angular && npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: all PASS (existing `layoutNodes` tests + the new helper tests).

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/layout/layout-nodes.ts packages/angular/src/lib/layout/layout-nodes.spec.ts
git commit -m "feat(angular/layout): add connectedComponents + packComponentsIntoGrid helpers

Pure helpers for the upcoming layoutNodes packing refactor: detect
disconnected pieces and repack them into a near-square grid instead of
dagre's cross-axis cascade (angflow-feedback #12).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Refactor `layoutNodes` to recursive, packed, group-aware layout

**Files:**
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts` (replace `LayoutNodesOptions`, the doc comment, and the `layoutNodes` body; keep the helpers from Task 2 and the `DEFAULT_*` consts)
- Test: `packages/angular/src/lib/layout/layout-nodes.spec.ts` (append a `describe` block)

The new `layoutNodes` lays out **one level at a time**: each group node is sized to its recursively-laid-out members' bounding box (+ padding/header), the level is laid out flat with dagre, disconnected components at that level are grid-packed, then members are expanded back to absolute coordinates under their group's final position.

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/layout/layout-nodes.spec.ts`:

```ts
describe('layoutNodes packing (feedback #12)', () => {
  const bbox = (positions: Record<string, { x: number; y: number }>, sizeById: Record<string, number>) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [id, p] of Object.entries(positions)) {
      const s = sizeById[id] ?? 0;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s); maxY = Math.max(maxY, p.y + s);
    }
    return { w: maxX - minX, h: maxY - minY };
  };

  it('grid-packs many disconnected ungrouped nodes instead of cascading them', () => {
    // 16 disconnected nodes, no edges. A cascade would be ~16 cells along one axis;
    // packing should keep both dimensions in the ~4-cell range.
    const nodes = Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, width: 100, height: 100 }));
    const positions = layoutNodes(nodes, [], { direction: 'LR' });
    const sizeById = Object.fromEntries(nodes.map((n) => [n.id, 100]));
    const { w, h } = bbox(positions, sizeById);
    // 4x4 grid of 150px cells => ~600x600. Cascade would be one dimension ~2400+.
    expect(w).toBeLessThan(1200);
    expect(h).toBeLessThan(1200);
    // Both axes meaningfully used (not a line).
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(3);
  });

  it('keeps a spatially-grouped, internally-disconnected canvas compact (no diagonal staircase)', () => {
    // 4 groups, 4 disconnected members each, ZERO cross-group edges (spatial groups).
    const nodes: Array<{ id: string; width: number; height: number; parentId?: string }> = [];
    for (let g = 0; g < 4; g++) {
      nodes.push({ id: `g${g}`, width: 10, height: 10 });
      for (let m = 0; m < 4; m++) nodes.push({ id: `g${g}_m${m}`, width: 80, height: 80, parentId: `g${g}` });
    }
    const positions = layoutNodes(nodes, [], { direction: 'LR' });
    for (const id of Object.keys(positions)) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
    // Group boxes should not stack into a tall/wide staircase: bbox of the 4 group
    // nodes should be roughly square (ratio < 3), unlike dagre's per-component columns.
    const groupOnly = Object.fromEntries(Object.entries(positions).filter(([id]) => /^g\d+$/.test(id)));
    const sizeById = Object.fromEntries(Object.keys(groupOnly).map((id) => [id, 10]));
    const { w, h } = bbox(groupOnly, sizeById);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(4);
  });

  it('clusters each group\'s members within its own region', () => {
    const nodes = [
      { id: 'gA', width: 10, height: 10 },
      { id: 'gB', width: 10, height: 10 },
      { id: 'a1', width: 40, height: 40, parentId: 'gA' },
      { id: 'a2', width: 40, height: 40, parentId: 'gA' },
      { id: 'b1', width: 40, height: 40, parentId: 'gB' },
      { id: 'b2', width: 40, height: 40, parentId: 'gB' },
    ];
    const positions = layoutNodes(nodes, [], { direction: 'LR' });
    const aXs = [positions.a1.x, positions.a2.x];
    const bXs = [positions.b1.x, positions.b2.x];
    // Every gA member is entirely to one side of every gB member (no interleave).
    const separated = Math.max(...aXs) < Math.min(...bXs) || Math.max(...bXs) < Math.min(...aXs);
    expect(separated).toBe(true);
  });

  it('places members inside their group box (padding + header offset)', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'm', width: 60, height: 60, parentId: 'g' },
    ];
    const positions = layoutNodes(nodes, [], { direction: 'TB', groupPadding: 24, groupHeaderHeight: 40 });
    // Member sits 24px in from the box left and 24+40=64px down from the box top.
    expect(positions.m.x - positions.g.x).toBeCloseTo(24, 5);
    expect(positions.m.y - positions.g.y).toBeCloseTo(64, 5);
  });

  it('nests: a sub-group\'s members land inside the sub-group, inside the outer group', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'sub', width: 10, height: 10, parentId: 'g' },
      { id: 'leaf', width: 40, height: 40, parentId: 'sub' },
    ];
    const positions = layoutNodes(nodes, [], { direction: 'TB', groupPadding: 24, groupHeaderHeight: 40 });
    // leaf inside sub
    expect(positions.leaf.x).toBeGreaterThan(positions.sub.x);
    expect(positions.leaf.y).toBeGreaterThan(positions.sub.y);
    // sub inside g
    expect(positions.sub.x).toBeGreaterThanOrEqual(positions.g.x);
    expect(positions.sub.y).toBeGreaterThan(positions.g.y);
  });

  it('packComponents:false leaves the dagre cascade in place', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, width: 100, height: 100 }));
    const packed = layoutNodes(nodes, [], { direction: 'LR' });
    const cascaded = layoutNodes(nodes, [], { direction: 'LR', packComponents: false });
    // With packing off, disconnected nodes stay on dagre's single cross-axis line
    // (all same coordinate on the rank axis); with packing on they don't.
    const packedYs = new Set(Object.values(packed).map((p) => p.y));
    const cascadedYs = new Set(Object.values(cascaded).map((p) => p.y));
    expect(cascadedYs.size).toBeLessThan(packedYs.size);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/angular && npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: the new `packing` tests FAIL (current `layoutNodes` cascades / uses dagre compound; `groupPadding`/`groupHeaderHeight`/`packComponents` options don't exist).

- [ ] **Step 3: Replace `LayoutNodesOptions` and the `layoutNodes` body**

In `packages/angular/src/lib/layout/layout-nodes.ts`:

(3a) Replace the `LayoutNodesOptions` interface with:

```ts
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
```

(3b) Add the new size/group consts near `DEFAULT_LABEL_HEIGHT`:

```ts
const DEFAULT_GROUP_PADDING = 24;
const DEFAULT_GROUP_HEADER = 40;
```

(3c) Replace the entire `layoutNodes` function (the doc comment + the body from `export function layoutNodes(...)` through its closing `}`) with the following. Keep the Task-2 helpers (`connectedComponents`, `packComponentsIntoGrid`) and the `DEFAULT_WIDTH`/`DEFAULT_HEIGHT`/`DEFAULT_LABEL_*` consts above.

```ts
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
    const key = `${s} ${t}`;
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

  // 1. Recurse into each group member; size its box from its members' bounds.
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

  // 2. Lay this level out flat, then grid-pack disconnected components.
  const levelEdges = liftEdges(members, ctx);
  let positions = dagreFlat(members, levelEdges, ctx.opts, sizeOf);
  if (ctx.packComponents) {
    const components = connectedComponents(members.map((m) => m.id), levelEdges);
    positions = packComponentsIntoGrid(positions, sizeOf, components, ctx.opts);
  }

  // 3. Assign positions; expand each group's descendants under its final position.
  const result: Record<string, { x: number; y: number }> = {};
  for (const m of members) {
    result[m.id] = positions[m.id];
    const childAbs = localChild[m.id];
    if (!childAbs) continue;
    const origin = localBoxOrigin[m.id];
    for (const id of Object.keys(childAbs)) {
      result[id] = {
        x: positions[m.id].x + (childAbs[id].x - origin.x),
        y: positions[m.id].y + (childAbs[id].y - origin.y),
      };
    }
  }
  return result;
}
```

(3d) Replace the `layoutNodes` doc comment + body with the new public entry. Update the doc comment to describe packing (remove the old "Group boxes are laid out but NOT resized…sprawl" wording; document the new options):

```ts
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
```

- [ ] **Step 4: Run the layout suite (new + regression)**

Run: `cd packages/angular && npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: all PASS.

> **If an existing compound test fails:** the older tests assert finiteness / no-throw / non-interleaving, which the recursive packing still satisfies. The most likely casualty is `'clusters grouped members (interleaved insertion would scatter when flat)'` (line ~107) if grid order happens to place the boxes unexpectedly — but its `groupsSeparated` assertion should still hold because each group's members stay within that group's box. If it genuinely breaks, the regression is in your code (members leaking outside their box), NOT the test — debug the expand step, do not weaken the test. Only the *exact-coordinate* expectations (none currently exist in the compound block) would legitimately need updating.

- [ ] **Step 5: Type-check**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/layout/layout-nodes.ts packages/angular/src/lib/layout/layout-nodes.spec.ts
git commit -m "fix(angular/layout): recursive group-aware packed layout

layoutNodes now lays out each group within its parent (sized to its
recursively-laid-out members + padding/header) and grid-packs
disconnected components at every level instead of letting dagre cascade
them along the cross-axis. Fixes the diagonal-staircase sprawl on
spatially-grouped, sparsely-connected canvases (angflow-feedback #12).
New opts: packComponents (default true), groupPadding, groupHeaderHeight.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `getAbsolutePosition` + fresh-after-applyLayout test (#12 sub-finding)

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (add `getAbsolutePosition`)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (append tests in the `setNodePositions / applyLayout` describe, or a new describe)

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/services/ng-flow.service.spec.ts` (inside `describe('setNodePositions / applyLayout', …)` so it reuses that `store`/`service` setup, or add a sibling `describe` with the same `beforeEach`):

```ts
  it('getAbsolutePosition resolves a top-level node verbatim', () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 30, y: 40 } }]);
    expect(service.getAbsolutePosition('a')).toEqual({ x: 30, y: 40 });
  });

  it('getAbsolutePosition sums the parentId chain for nested nodes', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 100, y: 100 } },
      { id: 'sub', data: {}, position: { x: 10, y: 20 }, parentId: 'g' },
      { id: 'leaf', data: {}, position: { x: 5, y: 5 }, parentId: 'sub' },
    ]);
    // leaf absolute = 100+10+5, 100+20+5 (default origin [0,0])
    expect(service.getAbsolutePosition('leaf')).toEqual({ x: 115, y: 125 });
  });

  it('getAbsolutePosition returns null for an unknown id', () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    expect(service.getAbsolutePosition('ghost')).toBeNull();
  });

  it('positionAbsolute and getAbsolutePosition agree right after applyLayout on a grouped canvas', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, type: 'group' },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
    ]);
    // Move the group to (200,200) and the child to absolute (224,264) in one absolute apply.
    await service.applyLayout(
      () => ({ g: { x: 200, y: 200 }, c: { x: 224, y: 264 } }),
      { coordinateSpace: 'absolute', animate: false },
    );
    expect(service.getAbsolutePosition('c')).toEqual({ x: 224, y: 264 });
    // The store's derived absolute must match the on-demand walk (no staleness).
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 224, y: 264 });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — `getAbsolutePosition` is not a function. (The last test also pins the staleness check; if `positionAbsolute` is stale, that assertion fails too.)

- [ ] **Step 3: Implement `getAbsolutePosition`**

In `packages/angular/src/lib/services/ng-flow.service.ts`, add a public method (place it near `getInternalNode`, ~line 204). It mirrors the store's child transform (`calculateChildXYZ` → `getNodePositionWithOrigin`: `absolute = Σ (position − dims·origin)` up the chain), resolving from the live `node.position` tree so it's correct regardless of tween/recompute timing:

```ts
  /**
   * Resolve a node's absolute (flow-space) top-left position by walking the
   * `parentId` chain from the current store state. Correct immediately after
   * `applyLayout` / `setNodePositions`, regardless of tween timing — unlike a
   * raw read of `internals.positionAbsolute`, which a caller may observe before
   * the derived value is recomputed. Returns `null` for an unknown id.
   */
  getAbsolutePosition(id: string): { x: number; y: number } | null {
    const lookup = this.store.nodeLookup;
    const storeOrigin = this.store.nodeOrigin();
    let cur = lookup.get(id);
    if (!cur) return null;
    let x = 0;
    let y = 0;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const origin = cur.origin ?? storeOrigin;
      const w = cur.measured?.width ?? cur.width ?? cur.initialWidth ?? 0;
      const h = cur.measured?.height ?? cur.height ?? cur.initialHeight ?? 0;
      x += cur.position.x - w * origin[0];
      y += cur.position.y - h * origin[1];
      cur = cur.parentId ? lookup.get(cur.parentId) : undefined;
    }
    return { x, y };
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: all PASS.

> If the last test (`positionAbsolute … agree …`) fails while the first three pass, the store's absolute recompute IS stale on the apply path — that's the #12 sub-finding's repair point. Use superpowers:systematic-debugging: trace `setNodePositions` (animate:false) → `triggerNodeChanges` → the `needsAbsoluteRecompute` branch (`flow-store.service.ts` ~635). The parented child should set `needsAbsoluteRecompute = true` and trigger `updateAbsolutePositions`. Fix the gap (do NOT weaken the test). `getAbsolutePosition` itself is independent and should pass regardless.

- [ ] **Step 5: Type-check**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): add NgFlowService.getAbsolutePosition(id)

Resolves a node's absolute position by walking the parentId chain from
the live store, so callers get a correct value immediately after
applyLayout regardless of tween timing (angflow-feedback #12 sub-finding).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Docs + full verification across packages

**Files:**
- Modify: `packages/angular/AGENT_BRIDGE.md` — only if Task 3/4 touched a tool (they did NOT; verify and skip)
- Verify: builds, typecheck, lint, full test suites

- [ ] **Step 1: Confirm no agent-tool catalog change**

Run: `git diff --name-only main -- packages/angular/src/lib/agent/`
Expected: empty (no agent files changed). Therefore no `AGENT_BRIDGE.md` edit and no `@angflow/mcp` snapshot regeneration are needed. If anything shows up, stop and reassess against `CLAUDE.md`'s Agent Bridge rules.

- [ ] **Step 2: Build system, then angular (order matters — angular depends on system)**

Run:
```bash
cd packages/system && npm run build
cd ../angular && npm run build
```
Expected: both builds succeed.

- [ ] **Step 3: Full test suites**

Run:
```bash
cd packages/system && npm test
cd ../angular && npm test
```
Expected: all PASS.

- [ ] **Step 4: Lint + typecheck angular**

Run:
```bash
cd packages/angular && npm run lint && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Build the angular example (catches consumer-facing breakage)**

Run:
```bash
cd examples/angular && npm run build
```
Expected: builds successfully (the zonal example suite must stay green per `CLAUDE.md`).

- [ ] **Step 6: Commit any doc touch-ups**

If only the `layoutNodes` doc comment changed (already committed in Task 3) and nothing else needs editing, there's nothing to commit here. Otherwise:

```bash
git add -A
git commit -m "docs: note layoutNodes packing behavior

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Out of scope / follow-up (not in this plan)

- **Publishing** (`@angflow/system` then `@angflow/angular` via `pnpm publish`) — interactive (2FA browser approval); do as a separate, user-initiated step per `CLAUDE.md`. `@angflow/mcp` needs no republish (no schema drift).
- **App adoption** (in `brainstorm_agentic_app`, a different repo): delete `packed-group-layout.ts`, call `applyLayout(layoutNodes, { direction: 'LR', coordinateSpace: 'absolute' })`, journal via `getAbsolutePosition`, drop the manual parent-walk; then mark #12/#13 ✅ in `angflow-feedback.md`.

---

## Self-review notes

- **Spec coverage:** Fix A → Task 1. Fix B (packComponentsIntoGrid + recursive compound + options, default-on) → Tasks 2–3. Fix C (`getAbsolutePosition` + fresh recompute) → Task 4. Testing/docs/build → Task 5. No agent-tool/mcp change confirmed in Task 5 Step 1.
- **Type consistency:** `connectedComponents(ids, edges)` and `packComponentsIntoGrid(positions, sizeOf, components, opts)` signatures are identical in Task 2 definition and Task 3 call site. `LayoutCtx.boxes` is the single source of group sizes read by `sizeOf`. `getAbsolutePosition` returns `{x,y}|null` consistently in impl and tests.
- **No placeholders:** every code/test/command step is concrete.
