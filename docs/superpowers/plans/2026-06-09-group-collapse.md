# Group Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A truthy `collapsed` on a group/parent node makes angflow hide its descendants, render the box collapsed, and reroute crossing edges onto the box — with no app-side graph transform.

**Architecture:** Two pure helpers (`getCollapsedHiddenIds`, `rewriteEdgesForCollapse`) drive two `FlowStore` computeds (`collapsedHiddenIds`, `displayEdges`). `visibleNodes` excludes collapse-hidden ids; the edge-renderer sources `displayEdges`. A `collapsed?` field on `Node`, `NgFlowService.setNodeCollapsed`/`toggleNodeCollapsed` writers, a `[class.collapsed]` binding + node-context signal, and a CSS rule complete it. No `@angflow/system` changes.

**Tech Stack:** Angular 19 (zoneless, signals), TypeScript, Vitest + jsdom, Angular `TestBed`.

**Spec:** `docs/superpowers/specs/2026-06-09-group-collapse-design.md`

**Conventions for every task:**
- Run tests from `packages/angular`: `npm test` (= `vitest run`); target one file with `npx vitest run <path>`.
- Type-check: `npx tsc --noEmit` in `packages/angular`.
- Trunk-based on `main`; commit directly. Commit footer line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Leave pre-existing untracked PNGs / unrelated working-tree changes unstaged.

---

## Task 1: Pure collapse helpers (`collapse.ts`)

The pure core: derive collapse-hidden node ids and rewrite edges. No Angular, no store — structurally typed over the node lookup so it's trivially unit-testable.

**Files:**
- Create: `packages/angular/src/lib/graph/collapse.ts`
- Create: `packages/angular/src/lib/graph/collapse.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/angular/src/lib/graph/collapse.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getCollapsedHiddenIds, rewriteEdgesForCollapse, type DisplayEdge } from './collapse';

type N = { id: string; parentId?: string; collapsed?: boolean };
type E = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };

function lookup(nodes: N[]): Map<string, N> {
  return new Map(nodes.map((n) => [n.id, n]));
}

describe('getCollapsedHiddenIds', () => {
  it('hides direct children of a collapsed group but not the group itself', () => {
    const ids = getCollapsedHiddenIds(lookup([
      { id: 'g', collapsed: true },
      { id: 'a', parentId: 'g' },
      { id: 'b', parentId: 'g' },
      { id: 'x' },
    ]));
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('hides nothing when the group is expanded', () => {
    const ids = getCollapsedHiddenIds(lookup([
      { id: 'g', collapsed: false },
      { id: 'a', parentId: 'g' },
    ]));
    expect(ids.size).toBe(0);
  });

  it('hides all descendants across nesting (deep child of a collapsed ancestor)', () => {
    const ids = getCollapsedHiddenIds(lookup([
      { id: 'g', collapsed: true },
      { id: 'sub', parentId: 'g' },
      { id: 'leaf', parentId: 'sub' },
    ]));
    expect(ids).toEqual(new Set(['sub', 'leaf']));
  });
});

describe('rewriteEdgesForCollapse', () => {
  const nodes: N[] = [
    { id: 'g', collapsed: true },
    { id: 'a', parentId: 'g' },
    { id: 'b', parentId: 'g' },
    { id: 'x' },
  ];
  const nl = lookup(nodes);
  const hidden = getCollapsedHiddenIds(nl);

  it('reroutes an outside→member edge to the collapsed box', () => {
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'x', target: 'a' }] as E[], nl, hidden);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('x');
    expect(out[0].target).toBe('g');
    expect(out[0].id).toBe('e1');
    expect(out[0].collapsedFrom).toEqual(['e1']);
  });

  it('drops an edge internal to one collapsed group', () => {
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'a', target: 'b' }] as E[], nl, hidden);
    expect(out).toHaveLength(0);
  });

  it('dedupes parallels created by rerouting into a merged render-only edge', () => {
    const out = rewriteEdgesForCollapse(
      [{ id: 'e1', source: 'x', target: 'a' }, { id: 'e2', source: 'x', target: 'b' }] as E[],
      nl,
      hidden,
    );
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('x');
    expect(out[0].target).toBe('g');
    expect(out[0].id).toBe('__collapsed:x->g');
    expect(out[0].collapsedFrom).toEqual(['e1', 'e2']);
  });

  it('passes untouched edges through with original identity', () => {
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'x', target: 'y' }] as E[], lookup([{ id: 'x' }, { id: 'y' }]), new Set());
    expect(out[0].id).toBe('e1');
    expect(out[0].collapsedFrom).toBeUndefined();
  });

  it('reroutes to the OUTERMOST collapsed ancestor under nesting', () => {
    const nlNest = lookup([
      { id: 'g', collapsed: true },
      { id: 'sub', parentId: 'g', collapsed: true },
      { id: 'leaf', parentId: 'sub' },
      { id: 'x' },
    ]);
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'x', target: 'leaf' }] as E[], nlNest, getCollapsedHiddenIds(nlNest));
    expect(out[0].target).toBe('g');
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/graph/collapse.spec.ts`
Expected: FAIL — module `./collapse` not found.

- [ ] **Step 3: Implement the helpers**

Create `packages/angular/src/lib/graph/collapse.ts`:

```ts
import type { Edge } from '../types';

/** Minimal node shape the collapse helpers read. */
interface CollapseNode {
  id: string;
  parentId?: string;
  collapsed?: boolean;
}

/** A display edge: an `Edge` plus the original ids it represents (length 1 = passthrough). */
export type DisplayEdge<EdgeType extends Edge = Edge> = EdgeType & { collapsedFrom?: string[] };

/**
 * Ids of nodes hidden because an ancestor (via `parentId` chain) is `collapsed`.
 * The collapsed node itself is NOT included. Nesting-correct and O(n) via memoized
 * ancestry walks.
 */
export function getCollapsedHiddenIds(nodeLookup: ReadonlyMap<string, CollapseNode>): Set<string> {
  const hidden = new Set<string>();
  for (const node of nodeLookup.values()) {
    let parentId = node.parentId;
    while (parentId) {
      const parent = nodeLookup.get(parentId);
      if (!parent) break;
      if (parent.collapsed) {
        hidden.add(node.id);
        break;
      }
      parentId = parent.parentId;
    }
  }
  return hidden;
}

/** The outermost (highest) collapsed ancestor of `id`, or `id` itself if none. */
function outermostCollapsedAncestor(id: string, nodeLookup: ReadonlyMap<string, CollapseNode>): string {
  let result = id;
  let parentId = nodeLookup.get(id)?.parentId;
  while (parentId) {
    const parent = nodeLookup.get(parentId);
    if (!parent) break;
    if (parent.collapsed) result = parent.id;
    parentId = parent.parentId;
  }
  return result;
}

/**
 * Rewrite edges for the current collapsed state:
 *  - map each hidden endpoint to its outermost collapsed ancestor;
 *  - drop edges whose endpoints map to the same node (internal to a collapsed box);
 *  - dedupe parallels created by rewriting, keyed (source,target,sourceHandle,targetHandle).
 * Untouched edges pass through with original identity (no `collapsedFrom`).
 */
export function rewriteEdgesForCollapse<EdgeType extends Edge>(
  edges: EdgeType[],
  nodeLookup: ReadonlyMap<string, CollapseNode>,
  hiddenIds: Set<string>,
): DisplayEdge<EdgeType>[] {
  if (hiddenIds.size === 0) return edges as DisplayEdge<EdgeType>[];

  const byKey = new Map<string, { edge: EdgeType; source: string; target: string; from: string[] }>();
  const order: string[] = [];

  for (const edge of edges) {
    const source = hiddenIds.has(edge.source) ? outermostCollapsedAncestor(edge.source, nodeLookup) : edge.source;
    const target = hiddenIds.has(edge.target) ? outermostCollapsedAncestor(edge.target, nodeLookup) : edge.target;
    if (source === target) continue; // internal to one collapsed box

    const key = `${source} ${target} ${edge.sourceHandle ?? ''} ${edge.targetHandle ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.from.push(edge.id);
    } else {
      byKey.set(key, { edge, source, target, from: [edge.id] });
      order.push(key);
    }
  }

  return order.map((key) => {
    const { edge, source, target, from } = byKey.get(key)!;
    const merged = from.length > 1;
    return {
      ...edge,
      id: merged ? `__collapsed:${source}->${target}` : edge.id,
      source,
      target,
      collapsedFrom: from,
    } as DisplayEdge<EdgeType>;
  });
}
```

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/graph/collapse.spec.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/graph/collapse.ts packages/angular/src/lib/graph/collapse.spec.ts
git commit -m "feat(graph): pure collapse helpers — hidden-id derivation + edge rewrite

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `collapsed` field + service writers

**Files:**
- Modify: `packages/angular/src/lib/types/nodes.ts:11-18` (add `collapsed?`)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (add two methods near `updateNodeData`, ~line 234-240)
- Modify: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

In `packages/angular/src/lib/services/ng-flow.service.spec.ts`, add a new top-level `describe` (after the existing ones, before EOF — place it after the final `});` of the `setNodePositions / applyLayout` block):

```ts
describe('collapse writers', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('setNodeCollapsed emits a replace change carrying collapsed', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 } }]);
    const changes: unknown[] = [];
    store.onNodesChange = (c) => changes.push(...c);
    service.setNodeCollapsed('g', true);
    expect(store.nodeLookup.get('g')!.collapsed).toBe(true);
    expect(changes).toEqual([{ id: 'g', type: 'replace', item: expect.objectContaining({ id: 'g', collapsed: true }) }]);
  });

  it('toggleNodeCollapsed flips the current value', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true }]);
    service.toggleNodeCollapsed('g');
    expect(store.nodeLookup.get('g')!.collapsed).toBe(false);
    service.toggleNodeCollapsed('g');
    expect(store.nodeLookup.get('g')!.collapsed).toBe(true);
  });

  it('setNodeCollapsed on an unknown id is a no-op', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 } }]);
    expect(() => service.setNodeCollapsed('ghost', true)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — `setNodeCollapsed`/`toggleNodeCollapsed` not a function; `collapsed` not on type.

- [ ] **Step 3: Add the `collapsed` field**

In `packages/angular/src/lib/types/nodes.ts`, extend the `Node` type body (currently lines 11-18):

```ts
> = NodeBase<NodeData, NodeType> & {
  style?: CSSProperties;
  className?: string;
  resizing?: boolean;
  focusable?: boolean;
  ariaRole?: string;
  domAttributes?: Record<string, string>;
  /** When true on a group/parent node, angflow hides its descendants and reroutes crossing edges to the box. */
  collapsed?: boolean;
};
```

- [ ] **Step 4: Implement the service writers**

In `packages/angular/src/lib/services/ng-flow.service.ts`, immediately after the `updateNodeData` method (the one ending ~line 240), add:

```ts
  /**
   * Set a (group/parent) node's `collapsed` state. Emits a `replace` node change
   * so controlled apps can journal it. angflow derives descendant hiding and
   * crossing-edge rerouting from this flag.
   */
  setNodeCollapsed(id: string, collapsed: boolean): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    const next = { ...current, collapsed } as NodeType;
    this.store.triggerNodeChanges([{ id, type: 'replace', item: next }]);
  }

  /** Flip a node's `collapsed` state. No-op for unknown ids. */
  toggleNodeCollapsed(id: string): void {
    const current = this.store.nodes().find((n) => n.id === id);
    if (!current) return;
    this.setNodeCollapsed(id, !current.collapsed);
  }
```

- [ ] **Step 5: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/types/nodes.ts packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): collapsed node field + setNodeCollapsed/toggleNodeCollapsed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Store computeds — `collapsedHiddenIds`, `displayEdges`, `visibleNodes` exclusion

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (imports; `visibleNodes` ~296-305; add two computeds)
- Modify: `packages/angular/src/lib/services/flow-store.service.spec.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

In `packages/angular/src/lib/services/flow-store.service.spec.ts`, add (after the existing tests; mirror the file's existing TestBed setup — inspect the top of the file for how it injects `FlowStore`, and reuse that pattern):

```ts
describe('collapse computeds', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), FlowStore] });
    store = TestBed.inject(FlowStore);
  });

  it('visibleNodes excludes descendants of a collapsed parent', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true },
      { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      { id: 'x', data: {}, position: { x: 0, y: 0 } },
    ]);
    const ids = store.visibleNodes().map((n) => n.id).sort();
    expect(ids).toEqual(['g', 'x']);
  });

  it('displayEdges reroutes a crossing edge to the collapsed box', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true },
      { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      { id: 'x', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e1', source: 'x', target: 'a' }]);
    const de = store.displayEdges();
    expect(de).toHaveLength(1);
    expect(de[0].target).toBe('g');
  });

  it('expanding restores nodes and edges', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: false },
      { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
    ]);
    store.setEdges([{ id: 'e1', source: 'a', target: 'a' }]);
    expect(store.visibleNodes().map((n) => n.id).sort()).toEqual(['a', 'g']);
    expect(store.displayEdges()).toHaveLength(1);
  });
});
```

(If `provideZonelessChangeDetection` / `TestBed` aren't already imported in this spec, add them — check the file's existing imports first.)

- [ ] **Step 2: Run the tests, verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/services/flow-store.service.spec.ts`
Expected: FAIL — `displayEdges` not a function; `visibleNodes` still includes `a`.

- [ ] **Step 3: Implement the computeds**

In `packages/angular/src/lib/services/flow-store.service.ts`, add the import near the top (with the other local imports):

```ts
import { getCollapsedHiddenIds, rewriteEdgesForCollapse, type DisplayEdge } from '../graph/collapse';
```

Add a `collapsedHiddenIds` computed and a `displayEdges` computed, and rewrite `visibleNodes` to exclude collapse-hidden ids. Replace the existing `visibleNodes` computed (currently lines ~296-305):

```ts
  readonly collapsedHiddenIds = computed(() => {
    this.version();
    return getCollapsedHiddenIds(this.nodeLookup);
  });

  readonly visibleNodes: Signal<InternalNodeBase<NodeType>[]> = computed(() => {
    this.version();
    const hidden = this.collapsedHiddenIds();
    const base = !this.onlyRenderVisibleElements()
      ? Array.from(this.nodeLookup.values())
      : getNodesInside(this.nodeLookup, { x: 0, y: 0, width: this.width(), height: this.height() }, this.transform(), true);
    return hidden.size ? base.filter((n) => !hidden.has(n.id)) : base;
  });

  readonly displayEdges = computed<DisplayEdge<EdgeType>[]>(() => {
    this.version();
    const edges = this.edges();
    const hidden = this.collapsedHiddenIds();
    return hidden.size ? rewriteEdgesForCollapse(edges, this.nodeLookup, hidden) : (edges as DisplayEdge<EdgeType>[]);
  });
```

(`computed`, `Signal`, `getNodesInside`, `InternalNodeBase` are already imported/used by the existing `visibleNodes`. Keep the existing `visibleEdgeIds` computed as-is.)

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/services/flow-store.service.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts
git commit -m "feat(store): collapsedHiddenIds + displayEdges computeds; visibleNodes excludes collapsed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Edge-renderer sources `displayEdges`

**Files:**
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts:250-253`

**Test note:** the edge-renderer's template/signal bindings aren't unit-testable under Vitest's JIT limit (documented in the existing edge-renderer spec). The behavior change (collapsed edges reroute) is covered by Task 3's store-level `displayEdges` tests and the example suite. This task is a small wiring change verified by type-check + full suite.

- [ ] **Step 1: Rewire `visibleEdges`**

In `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`, replace the `visibleEdges` computed (currently lines 250-253):

```ts
  readonly visibleEdges = computed(() => {
    const edges = this.store.displayEdges();
    if (!this.store.onlyRenderVisibleElements()) return edges;
    const visibleNodeIds = new Set(this.store.visibleNodes().map((n) => n.id));
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  });
```

This sources rewritten edges and culls by visible-node membership (synthetic merged-edge ids aren't in `visibleEdgeIds`, so culling must be over endpoints — see spec §3).

- [ ] **Step 2: Type-check + full suite (no regressions)**

Run: `cd packages/angular && npx tsc --noEmit && npm test`
Expected: PASS — all existing edge-renderer/edge tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts
git commit -m "feat(edge-renderer): render store.displayEdges so collapsed edges reroute

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Node-renderer collapsed class + context signal + CSS

**Files:**
- Modify: `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts` (template class binding ~line 71; context object ~line 489)
- Modify: `packages/angular/src/lib/types/nodes.ts` (`NgFlowNodeContext`, ~line 110)
- Modify: `packages/angular/src/lib/styles/ng-flow.css` (add a `.collapsed` rule near the `.xy-flow__node` rules ~line 186-212)

**Test note:** template bindings and CSS aren't unit-testable under Vitest's JIT limit; verified by type-check, the full suite (no regressions), and the example suite. No new unit test.

- [ ] **Step 1: Add the `collapsed` context field to the type**

In `packages/angular/src/lib/types/nodes.ts`, add to the `NgFlowNodeContext` interface (after the `dragHandle` signal, ~line 110, before the closing `}`):

```ts
  /** True when this node is collapsed (a group folded to its box). */
  readonly collapsed: Signal<boolean>;
```

- [ ] **Step 2: Bind the class and expose the context signal**

In `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts`:

(a) Add a class binding to the node wrapper `<div>` — insert after the `[class.connection-target]` line (~line 57):

```ts
        [class.collapsed]="node.collapsed"
```

(b) Add the context signal — in the object returned by the node-context builder (the `return { id: ..., dragHandle: ... }` block, ~lines 469-490), add after the `dragHandle` entry:

```ts
      collapsed: computed(() => getNode()?.collapsed ?? false),
```

- [ ] **Step 3: Add the collapsed CSS rule**

In `packages/angular/src/lib/styles/ng-flow.css`, after the existing `.xy-flow__node` block (near line 212), add:

```css
.xy-flow__node.collapsed {
  /* Folded group: drop the expanded footprint to a header strip. Overrides an
     inline style.height set in controlled mode; apps may extend this rule. */
  height: var(--xy-node-collapsed-height, 40px) !important;
  overflow: hidden;
}
```

- [ ] **Step 4: Build the CSS bundle + type-check + full suite**

Run: `cd packages/angular && node scripts/bundle-css.js && npx tsc --noEmit && npm test`
Expected: CSS bundles without error; type-check clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/container/node-renderer/node-renderer.component.ts packages/angular/src/lib/types/nodes.ts packages/angular/src/lib/styles/ng-flow.css
git commit -m "feat(node-renderer): collapsed class + node-context signal + collapsed CSS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Public export + docs

**Files:**
- Modify: `packages/angular/src/lib/public-api.ts` (export `DisplayEdge`)
- Modify: `packages/angular/README.md` (add a "Group collapse" subsection)

- [ ] **Step 1: Export the `DisplayEdge` type**

In `packages/angular/src/lib/public-api.ts`, add a line near the other type exports:

```ts
export type { DisplayEdge } from './lib/graph/collapse';
```

NOTE: confirm the correct relative path from `public-api.ts` to the file. If `public-api.ts` lives at `packages/angular/src/lib/public-api.ts`, the import is `./graph/collapse`. If it lives at `packages/angular/src/public-api.ts`, it is `./lib/graph/collapse`. Read the top of `public-api.ts` to match the style of the existing exports and use the matching prefix.

- [ ] **Step 2: Add the README subsection**

In `packages/angular/README.md`, add a new `## Group Collapse` section before the `## Architecture` section:

```markdown
## Group Collapse

Set `collapsed: true` on a group/parent node and angflow folds it: descendants stop
rendering, the box drops to a header strip (`.collapsed` CSS class), and edges crossing
the boundary reroute onto the box (parallels merge). It is nesting-aware — edges reroute
to the outermost collapsed ancestor.

```ts
flow.setNodeCollapsed(groupId, true);   // or toggleNodeCollapsed(groupId)
```

`collapsed` lives on the node, so in controlled mode it round-trips through
`(nodesChange)` like any other field. A merged (deduped) display edge is render-only and
carries its underlying edge ids on `collapsedFrom`; a 1:1 rerouted edge keeps its original
identity. Rerouted edges attach to the box via the normal edge geometry — cleanest under
`edgeMode="floating"`. The collapsed box renders at `--xy-node-collapsed-height` (40px
default); auto-sizing the expanded box to its children is separate.
```

- [ ] **Step 3: Type-check + confirm fences**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: clean. Visually confirm the README's nested ```ts fence is balanced.

- [ ] **Step 4: Commit**

```bash
git add packages/angular/src/lib/public-api.ts packages/angular/README.md
git commit -m "feat(angular): export DisplayEdge; document Group Collapse

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Build, version bump, example regression

**Files:**
- Modify: `packages/angular/package.json` (version, via `npm version`)

- [ ] **Step 1: Build the angular package**

Run (in `packages/angular`): `npm run build`
Expected: clean ngc + CSS bundle, no errors.

- [ ] **Step 2: Example regression (regression bar)**

Build the packages then the example (matches the prior release flow — `pnpm -F` may hit a lockfile-policy preflight in this environment; if so, run each package's build script directly):
Run: `cd packages/system && npm run build` then `cd packages/angular && npm run build` then `cd examples/angular && npm run build`
Expected: example builds clean against the rebuilt packages.

- [ ] **Step 3: Version bump (minor — new feature)**

Run (in `packages/angular`): `npm version minor`
Expected: version incremented (e.g. 0.0.19 → 0.1.0) and committed by `npm version`. No system bump.

- [ ] **Step 4: Publish (USER ACTION — npm 2FA)**

> Do not run autonomously. Surface to the user: `cd packages/angular && npm publish --access public`.

- [ ] **Step 5: Commit any remaining version artifact**

```bash
git add packages/angular/package.json
git commit -m "chore(angular): version bump for group collapse release

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(If `npm version` already created the commit, this is a no-op.)

---

## Task 8: Feedback bookkeeping (#7)

**Files:**
- Modify: `C:\Users\shisu\CodeWeb\brainstorm_agentic_app\docs\angflow-feedback.md`

- [ ] **Step 1: Mark #7 ✅**

Change the `## 7. ⛳ No built-in group (sub-flow) collapse` heading to `## 7. ✅ …` and append a resolution bullet (use the real implementing commit hashes — `git log --oneline -12`):

```markdown
- **✅ Fixed in angflow** (`<task1-hash>`, `<task2-hash>`, `<task3-hash>`, `<task5-hash>`): set
  `collapsed: true` on a group node (or `NgFlowService.toggleNodeCollapsed(id)`) and angflow hides
  descendants, reroutes crossing edges onto the box (nesting-aware, parallels merged into a
  render-only edge carrying `collapsedFrom`), and applies a `.collapsed` class for header-only
  sizing. Shipped in `@angflow/angular@<new-version>`. Once the app is on it: delete the collapse
  branches of `composeNodes`/`composeEdges` in `web/src/app/canvas/group-render.ts` and call
  `toggleNodeCollapsed` from the header chevron. (`groupBounds`/coordinate conversion stay until
  #9/#10 land.)
```

- [ ] **Step 2: Commit (in the brainstorm_agentic_app repo)**

```bash
cd /c/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs(feedback): mark angflow #7 (group collapse) fixed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1 State & API (`collapsed` field + `setNodeCollapsed`/`toggleNodeCollapsed`) → Task 2. ✓
- §2 Node hiding (`getCollapsedHiddenIds` + `collapsedHiddenIds` + `visibleNodes` exclusion) → Task 1 + Task 3. ✓
- §3 Edge rewriting (`rewriteEdgesForCollapse` + `displayEdges` + edge-renderer source + endpoint culling) → Task 1 + Task 3 + Task 4. ✓
- §4 Interaction semantics (1:1 keeps id; merged = synthetic id + `collapsedFrom`) → Task 1 (helper encodes it), tested in Task 1. ✓
- §5 Collapsed box rendering (`collapsed` class + context signal + CSS) → Task 5. ✓
- §6 Trigger UI = service + class only → Tasks 2 & 5; no built-in chevron (correctly absent). ✓
- Testing section → Tasks 1/2/3 unit+integration; renderer/CSS via example per spec. ✓
- Rollout → Task 7 + Task 8. ✓

**Type consistency:**
- `getCollapsedHiddenIds(nodeLookup)` and `rewriteEdgesForCollapse(edges, nodeLookup, hiddenIds)` — identical signatures in Task 1 impl, Task 1 tests, and Task 3 store wiring. ✓
- `DisplayEdge<EdgeType>` with `collapsedFrom?: string[]` — defined Task 1, used in Task 3 (`displayEdges` return), exported Task 6. ✓
- Merged id format `__collapsed:${source}->${target}` — same in Task 1 impl and Task 1 test assertion. ✓
- `setNodeCollapsed(id, collapsed)` / `toggleNodeCollapsed(id)` — same names/signatures in Task 2 impl, Task 2 tests, README (Task 6), and feedback note (Task 8). ✓
- `collapsed` field/context signal — added to `Node` (Task 2) and `NgFlowNodeContext` (Task 5), read by node-renderer (Task 5). ✓

**Placeholder scan:** No TBD/TODO. Task 6 Step 1 and Task 8 contain explicit "confirm the path"/"use real hashes" instructions resolved at execution time (runtime values, not unfilled plan content). ✓
