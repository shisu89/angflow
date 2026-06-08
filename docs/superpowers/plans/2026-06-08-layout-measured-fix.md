# Auto-Layout Live DOM Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `applyLayout` produce correct, non-overlapping layouts by measuring live node footprints and edge-label boxes from the DOM, and give controlled-mode apps a supported way to keep the store's `measured` correct.

**Architecture:** Three independent code parts in `@angflow/angular` plus docs and feedback bookkeeping. `layoutNodes` stays a pure dagre wrapper (extended to read an optional per-edge label box). `NgFlowService.applyLayout` gains two read-only DOM-measurement passes (nodes + edge labels) that enrich the objects handed to the layout fn without mutating the store. A new pure `applyDimensionChanges` helper lets controlled-mode apps forward `measured` from `(nodesChange)`. No system-package changes.

**Tech Stack:** Angular 19 (zoneless, signals), TypeScript, `@dagrejs/dagre`, Vitest + jsdom, Angular `TestBed`.

**Spec:** `docs/superpowers/specs/2026-06-08-layout-measured-fix-design.md`

**Conventions for every task:**
- Run tests from `packages/angular`: `npm test` (alias for `vitest run`). Target one file with `npx vitest run <path>`.
- Type-check with `npx tsc --noEmit` in `packages/angular`.
- This repo is trunk-based on `main`; commit directly to `main` with small commits.
- Commit message footer line (keep it): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Task 1: `applyDimensionChanges` controlled-mode helper (spec Part B)

Pure helper that applies only `dimensions`-type changes to a `nodes` array, writing `{ width, height }` into each node's `measured`. Returns the original array reference when no dimension change applied (no needless re-render).

**Files:**
- Modify: `packages/angular/src/lib/utils/changes.ts` (add function near `applyNodeChanges`, ~line 124)
- Modify: `packages/angular/src/lib/utils/changes.spec.ts` (add a `describe` block)
- Modify: `packages/angular/src/lib/public-api.ts:60` (add to the existing export)

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/utils/changes.spec.ts`:

```ts
describe('applyDimensionChanges', () => {
  it('writes measured from a dimensions change', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(nodes, [
      { id: '1', type: 'dimensions', dimensions: { width: 220, height: 90 } },
    ]);
    expect(result[0].measured).toEqual({ width: 220, height: 90 });
  });

  it('ignores non-dimensions changes', () => {
    const nodes = [makeNode('1', { measured: { width: 10, height: 10 } })];
    const result = applyDimensionChanges(nodes, [
      { id: '1', type: 'position', position: { x: 5, y: 5 } },
      { id: '1', type: 'select', selected: true },
    ]);
    // position/selected untouched, measured unchanged
    expect(result[0].measured).toEqual({ width: 10, height: 10 });
    expect(result[0].position).toEqual({ x: 0, y: 0 });
    expect(result[0].selected).toBeUndefined();
  });

  it('returns the SAME array reference when no dimensions change is present', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(nodes, [
      { id: '1', type: 'position', position: { x: 1, y: 1 } },
    ]);
    expect(result).toBe(nodes);
  });

  it('skips unknown ids and applies the rest', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyDimensionChanges(nodes, [
      { id: 'ghost', type: 'dimensions', dimensions: { width: 1, height: 1 } },
      { id: '2', type: 'dimensions', dimensions: { width: 50, height: 30 } },
    ]);
    expect(result[0].measured).toBeUndefined();
    expect(result[1].measured).toEqual({ width: 50, height: 30 });
  });

  it('does not mutate the input nodes', () => {
    const nodes = [makeNode('1')];
    applyDimensionChanges(nodes, [
      { id: '1', type: 'dimensions', dimensions: { width: 7, height: 7 } },
    ]);
    expect(nodes[0].measured).toBeUndefined();
  });
});
```

Add `applyDimensionChanges` to the import on line 2:

```ts
import { applyNodeChanges, applyEdgeChanges, applyDimensionChanges, createSelectionChange, getSelectionChanges } from './changes';
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/utils/changes.spec.ts`
Expected: FAIL — `applyDimensionChanges is not a function` / not exported.

- [ ] **Step 3: Implement the helper**

In `packages/angular/src/lib/utils/changes.ts`, add after `applyNodeChanges` (after line 124):

```ts
/**
 * Apply only `dimensions`-type changes from a `(nodesChange)` batch, writing
 * `{ width, height }` into each affected node's `measured`. All other change
 * types are ignored. Returns a **new** array when at least one dimension change
 * applied, otherwise the **original `nodes` reference** (so it is a no-op for
 * change detection when there is nothing to update).
 *
 * For controlled-mode apps that keep authority over `position`/`data` themselves
 * (e.g. a journal) but still want `measured` to flow back so that layout
 * (`applyLayout`), floating edges, and `fitView` stay correct.
 *
 * @example
 * ```typescript
 * onNodesChange(changes: NodeChange[]) {
 *   this.nodes.update((ns) => applyDimensionChanges(ns, changes));
 *   // ...your own position/data handling on top...
 * }
 * ```
 */
export function applyDimensionChanges<NodeType extends Node = Node>(
  nodes: NodeType[],
  changes: NodeChange<NodeType>[],
): NodeType[] {
  const dims = new Map<string, { width: number; height: number }>();
  for (const change of changes) {
    if (change.type === 'dimensions' && change.dimensions) {
      dims.set(change.id, change.dimensions);
    }
  }
  if (dims.size === 0) return nodes;

  let changed = false;
  const next = nodes.map((node) => {
    const d = dims.get(node.id);
    if (!d) return node;
    changed = true;
    return { ...node, measured: { width: d.width, height: d.height } };
  });
  return changed ? next : nodes;
}
```

Add `NodeChange` to the type import at the top of `changes.ts` (line 1-8 block):

```ts
import type {
  NodeChange,
  EdgeChange,
  NodeSelectionChange,
  EdgeSelectionChange,
  NodeRemoveChange,
  EdgeRemoveChange,
} from '@angflow/system';
```

(`NodeChange` is added; the rest already exist.)

- [ ] **Step 4: Export it**

In `packages/angular/src/lib/public-api.ts:60`, change:

```ts
export { applyNodeChanges, applyEdgeChanges, applyDimensionChanges } from './utils/changes';
```

- [ ] **Step 5: Run tests + type-check, verify pass**

Run: `npx vitest run src/lib/utils/changes.spec.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/utils/changes.ts packages/angular/src/lib/utils/changes.spec.ts packages/angular/src/lib/public-api.ts
git commit -m "feat(angular): applyDimensionChanges helper for controlled-mode measured sync

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `layoutNodes` reserves space for edge labels (spec Part D — pure core)

Widen the edge input to a `LayoutEdgeInput` carrying an optional label box, and forward it to dagre via `setEdge(v, w, { width, height, labelpos: 'c' })`. Reserve a conservative default box when an edge has a truthy `label` but no measured size.

**Files:**
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts`
- Modify: `packages/angular/src/lib/layout/layout-nodes.spec.ts`
- Modify: `packages/angular/src/lib/layout/index.ts` (export the new type)

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/layout/layout-nodes.spec.ts`:

```ts
describe('layoutNodes edge labels', () => {
  const nodes = [
    { id: 'a', width: 100, height: 40 },
    { id: 'b', width: 100, height: 40 },
  ];

  it('reserves more rank space when an edge has a measured label box', () => {
    const withLabel = layoutNodes(
      nodes,
      [{ source: 'a', target: 'b', label: 'relates to', labelWidth: 120, labelHeight: 24 }],
      { direction: 'TB' },
    );
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    // dagre inserts the label as a dummy node along the edge, pushing b further down.
    expect(withLabel['b'].y).toBeGreaterThan(without['b'].y);
  });

  it('reserves a default box when an edge has a truthy label but no measured size', () => {
    const withLabel = layoutNodes(
      nodes,
      [{ source: 'a', target: 'b', label: 'x' }],
      { direction: 'TB' },
    );
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    expect(withLabel['b'].y).toBeGreaterThan(without['b'].y);
  });

  it('an edge with no label behaves exactly as before (no label box)', () => {
    const a = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    const b = layoutNodes(nodes, [{ source: 'a', target: 'b', label: '' }], { direction: 'TB' });
    expect(a['b'].y).toBe(b['b'].y);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: FAIL — label box ignored, so `withLabel['b'].y` equals `without['b'].y`.

- [ ] **Step 3: Implement label support**

In `packages/angular/src/lib/layout/layout-nodes.ts`:

Add the default-box constants beside the existing node defaults (after line 27):

```ts
// Match the renderer's unmeasured-node fallbacks (edge-renderer.component.ts).
const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 40;
// Conservative reservation for a labeled edge whose label box wasn't measured.
const DEFAULT_LABEL_WIDTH = 60;
const DEFAULT_LABEL_HEIGHT = 20;
```

Add the `LayoutEdgeInput` interface after `LayoutNodeInput` (after line 23):

```ts
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
```

Change the `edges` parameter type (line 47) from
`edges: ReadonlyArray<{ source: string; target: string }>,` to:

```ts
  edges: ReadonlyArray<LayoutEdgeInput>,
```

Replace the edge loop (lines 65-67):

```ts
  for (const e of edges) {
    const labelWidth = e.labelWidth ?? (e.label ? DEFAULT_LABEL_WIDTH : undefined);
    const labelHeight = e.labelHeight ?? (e.label ? DEFAULT_LABEL_HEIGHT : undefined);
    if (labelWidth != null && labelHeight != null) {
      g.setEdge(e.source, e.target, { width: labelWidth, height: labelHeight, labelpos: 'c' });
    } else {
      g.setEdge(e.source, e.target);
    }
  }
```

- [ ] **Step 4: Export the type**

In `packages/angular/src/lib/layout/index.ts:1`, add `LayoutEdgeInput`:

```ts
export { layoutNodes, type LayoutNodesOptions, type LayoutNodeInput, type LayoutEdgeInput } from './layout-nodes';
```

- [ ] **Step 5: Run tests + type-check, verify pass**

Run: `npx vitest run src/lib/layout/layout-nodes.spec.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/layout/layout-nodes.ts packages/angular/src/lib/layout/layout-nodes.spec.ts packages/angular/src/lib/layout/index.ts
git commit -m "feat(layout): layoutNodes reserves dagre space for edge labels

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Edge-label element exposes `data-id` (spec Part D — renderer enabler)

The label `<div class="xy-flow__edge-label">` carries no id, so `applyLayout` can't address it. Add `[attr.data-id]`.

**Files:**
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts:214-221`

> **Test note:** the existing edge-renderer spec documents that "JIT doesn't compile signal-input template bindings under Vitest," so the rendered `data-id` attribute is **not** unit-testable in this harness. It is exercised by the `applyLayout` measurement test (Task 4, which stubs the container so it doesn't depend on the real template) and by the zonal example suite. This task is a one-line template change with no unit test.

- [ ] **Step 1: Add the attribute binding**

In `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`, in the label `<div>` block (currently lines 214-221), add the `data-id` binding:

```html
          <div
            class="xy-flow__edge-label"
            [attr.data-id]="edge.id"
            [style.position]="'absolute'"
            [style.transform]="'translate(-50%, -50%) translate(' + getEdgeCenterX(ei) + 'px, ' + getEdgeCenterY(ei) + 'px)'"
            [style.pointer-events]="'all'"
          >
            {{ edge.label }}
          </div>
```

- [ ] **Step 2: Type-check + full test run (no regressions)**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — existing edge-renderer specs unaffected.

- [ ] **Step 3: Commit**

```bash
git add packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts
git commit -m "feat(edge-renderer): expose data-id on edge label for layout measurement

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `applyLayout` measures nodes + edge labels from the live DOM (spec Parts A + D)

Enrich the nodes and edges handed to `layoutFn` with live `offsetWidth`/`offsetHeight` from rendered DOM elements. Read-only: the store's own node/edge objects are never mutated. Always prefer live DOM dims when the element exists (fixes both absent-`measured` and stale-`measured` cases). No `÷ zoom` — `offsetWidth/Height` are intrinsic layout dims.

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`applyLayout` ~lines 303-317; add two private helpers)
- Modify: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (add tests to the `setNodePositions / applyLayout` describe block, ~line 312)

- [ ] **Step 1: Write the failing tests**

In `packages/angular/src/lib/services/ng-flow.service.spec.ts`, add inside the `describe('setNodePositions / applyLayout', ...)` block (after the existing `applyLayout` tests, ~line 377). This builds a fake container whose `querySelector` returns fake elements with known `offsetWidth/Height`:

```ts
  function fakeContainer(
    nodeDims: Record<string, { w: number; h: number }>,
    labelDims: Record<string, { w: number; h: number }> = {},
  ): HTMLDivElement {
    return {
      querySelector(selector: string): { offsetWidth: number; offsetHeight: number } | null {
        const node = selector.match(/^\.xy-flow__node\[data-id="(.+)"\]$/);
        if (node) {
          const d = nodeDims[node[1]];
          return d ? { offsetWidth: d.w, offsetHeight: d.h } : null;
        }
        const label = selector.match(/^\.xy-flow__edge-label\[data-id="(.+)"\]$/);
        if (label) {
          const d = labelDims[label[1]];
          return d ? { offsetWidth: d.w, offsetHeight: d.h } : null;
        }
        return null;
      },
    } as unknown as HTMLDivElement;
  }

  it('applyLayout overrides node measured from the live DOM (always)', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    // store measured is wiped/absent in controlled mode; DOM is the truth.
    store.domNode.set(fakeContainer({ a: { w: 300, h: 120 } }));
    const layoutFn = vi.fn().mockReturnValue({ a: { x: 0, y: 0 } });
    await service.applyLayout(layoutFn);
    const nodesArg = layoutFn.mock.calls[0][0] as Array<{ id: string; measured?: { width?: number; height?: number } }>;
    expect(nodesArg[0].measured).toEqual({ width: 300, height: 120 });
    // store node object NOT mutated
    expect(store.nodeLookup.get('a')!.measured).not.toEqual({ width: 300, height: 120 });
  });

  it('applyLayout leaves a node unchanged when no DOM element exists', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 }, measured: { width: 10, height: 10 } }]);
    store.domNode.set(fakeContainer({})); // querySelector returns null
    const layoutFn = vi.fn().mockReturnValue({ a: { x: 0, y: 0 } });
    await service.applyLayout(layoutFn);
    const nodesArg = layoutFn.mock.calls[0][0] as Array<{ measured?: { width?: number; height?: number } }>;
    expect(nodesArg[0].measured).toEqual({ width: 10, height: 10 });
  });

  it('applyLayout fills edge label dims from the live DOM', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', label: 'rel' }]);
    store.domNode.set(fakeContainer({}, { e: { w: 140, h: 22 } }));
    const layoutFn = vi.fn().mockReturnValue({});
    await service.applyLayout(layoutFn);
    const edgesArg = layoutFn.mock.calls[0][1] as Array<{ id: string; labelWidth?: number; labelHeight?: number }>;
    expect(edgesArg[0].labelWidth).toBe(140);
    expect(edgesArg[0].labelHeight).toBe(22);
    // store edge object NOT mutated
    expect((store.edgeLookup.get('e') as { labelWidth?: number }).labelWidth).toBeUndefined();
  });

  it('applyLayout passes edges through unchanged when no domNode is set', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', label: 'rel' }]);
    // domNode defaults to null
    const layoutFn = vi.fn().mockReturnValue({});
    await service.applyLayout(layoutFn);
    const edgesArg = layoutFn.mock.calls[0][1] as Array<{ labelWidth?: number }>;
    expect(edgesArg[0].labelWidth).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — `measured` not overridden / `labelWidth` undefined (no measurement yet).

- [ ] **Step 3: Implement the DOM-measurement helpers + wire into `applyLayout`**

In `packages/angular/src/lib/services/ng-flow.service.ts`, replace the body of `applyLayout` (lines 311-316) so it enriches both nodes and edges before calling `layoutFn`:

```ts
    const { animate, ...layoutOpts } = opts ?? ({} as O & { animate?: boolean | { duration?: number } });
    const nodes = this.withLiveMeasurements(
      this.getNodes().map((n) => this.getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>)),
    );
    const edges = this.withLiveEdgeLabels(this.getEdges());
    const positions = await layoutFn(nodes, edges, layoutOpts as unknown as O);
    await this.setNodePositions(positions, animate === undefined ? undefined : { animate });
```

Add two private helpers immediately after `applyLayout` (after line 317):

```ts
  /**
   * Override each node's `measured` from its live rendered element
   * (`.xy-flow__node[data-id]`) when present. `offsetWidth/Height` are intrinsic
   * layout dims, unaffected by the pane's CSS scale — no zoom math. Reads only;
   * returns shallow clones so store objects are never mutated. Nodes with no
   * element (hidden / SSR / not-yet-rendered) or zero size pass through unchanged
   * so `layoutNodes`' measured→width→initial→default fallback still applies.
   */
  private withLiveMeasurements(nodes: InternalNode<NodeType>[]): InternalNode<NodeType>[] {
    const container = this.store.domNode();
    if (!container) return nodes;
    return nodes.map((n) => {
      const el = container.querySelector(`.xy-flow__node[data-id="${CSS.escape(n.id)}"]`) as HTMLElement | null;
      if (!el) return n;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return n;
      return { ...n, measured: { width, height } };
    });
  }

  /**
   * Fill each edge's `labelWidth`/`labelHeight` from its live label element
   * (`.xy-flow__edge-label[data-id]`) when present, so `layoutNodes` can reserve
   * dagre space for the label. Reads only; returns shallow clones. Edges with no
   * rendered label pass through unchanged.
   */
  private withLiveEdgeLabels(edges: EdgeType[]): EdgeType[] {
    const container = this.store.domNode();
    if (!container) return edges;
    return edges.map((e) => {
      const el = container.querySelector(`.xy-flow__edge-label[data-id="${CSS.escape(e.id)}"]`) as HTMLElement | null;
      if (!el) return e;
      const labelWidth = el.offsetWidth;
      const labelHeight = el.offsetHeight;
      if (!labelWidth || !labelHeight) return e;
      return { ...e, labelWidth, labelHeight } as EdgeType;
    });
  }
```

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `npx vitest run src/lib/services/ng-flow.service.spec.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Run the full angular suite (no regressions)**

Run: `npm test`
Expected: PASS — all existing specs green.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): applyLayout measures node + edge-label sizes from live DOM

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Documentation (spec Part B docs + `layoutNodes` docstring note)

Document the controlled-mode `measured` pattern and the new auto-measurement behavior.

**Files:**
- Modify: `packages/angular/README.md` (Auto-Layout section ~line 199; add a controlled-mode note)
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts` (docstring, ~lines 29-44)

- [ ] **Step 1: Update the `layoutNodes` docstring**

In `packages/angular/src/lib/layout/layout-nodes.ts`, extend the JSDoc block (lines 29-44) to note auto-measurement and edge labels. Append these sentences before the closing `*/` (after line 43's "subpath …" text):

```
 *
 * Prefer `NgFlowService.applyLayout(layoutNodes, …)`: it measures live node
 * footprints and edge-label boxes from the DOM and passes them in, so layout is
 * correct even when `measured` is absent/stale (e.g. the controlled-mode
 * round-trip). Calling `layoutNodes` directly uses only the dimensions on the
 * objects you pass — supply measured nodes (e.g. internal nodes) for best
 * results. Edge labels: pass `labelWidth`/`labelHeight` (or a truthy `label` for
 * a default reservation) to reserve dagre space.
```

- [ ] **Step 2: Add the controlled-mode README note**

In `packages/angular/README.md`, after the Auto-Layout options paragraph (after line 218), add:

```markdown
### Controlled mode and `measured`

In controlled mode (`[nodes]` bound, re-emitted from `(nodesChange)`), re-emitting
nodes that don't carry `measured` resets the stored dimensions. `applyLayout` reads
live DOM sizes so layout stays correct regardless — but floating edges and `fitView`
read the stored `measured` directly. If your app hand-handles only some changes (e.g.
keeps `position` authority in a journal), forward dimension changes with
`applyDimensionChanges` so `measured` stays current:

```ts
import { applyDimensionChanges } from '@angflow/angular';

onNodesChange(changes: NodeChange[]) {
  // keep measured flowing back: floating edges, fitView, layout stay correct
  this.nodes.update((ns) => applyDimensionChanges(ns, changes));
  // ...your own position/data handling on top...
}
```
```

Also extend the dimension-resolution sentence (line 215-216) to mention labels:

```markdown
(default 50), `rankSep` (default 80). Node dimensions resolve from
`measured` → `width`/`height` → `initialWidth`/`initialHeight` → 150×40, and edge
labels reserve dagre space from `labelWidth`/`labelHeight` (auto-measured by
`applyLayout`) or a default box when an edge has a non-empty `label`. Any
function with the same shape plugs into `applyLayout` (elk, custom grids, …).
```

(Replace the existing "Node dimensions resolve … Any function with the same shape plugs into `applyLayout` (elk, custom grids, …)." sentence with the above.)

- [ ] **Step 3: Verify docs build / no broken snippets**

Run: `npx tsc --noEmit`
Expected: PASS (docstring change is comment-only; no code impact). Visually confirm the README code fences are balanced.

- [ ] **Step 4: Commit**

```bash
git add packages/angular/README.md packages/angular/src/lib/layout/layout-nodes.ts
git commit -m "docs(angular): controlled-mode measured pattern + applyLayout auto-measurement

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Build, version bump, and example regression check

No system-package change, so bump `@angflow/angular` only.

**Files:**
- Modify: `packages/angular/package.json` (version, via `npm version`)

- [ ] **Step 1: Build the angular package**

Run (in `packages/angular`): `npm run build`
Expected: clean build to `dist/esm/` + `dist/style.css`, no errors.

- [ ] **Step 2: Rebuild and run the zonal example suite (regression bar)**

Per the spec's regression bar and CLAUDE.md, the zonal example suite must still pass.
Run: `pnpm -F @angflow/system build && pnpm -F @angflow/angular build` then the example checks under `examples/angular/` (`npm run build` in `examples/angular`).
Expected: example builds clean against the rebuilt packages.

- [ ] **Step 3: Version bump**

Run (in `packages/angular`): `npm version patch`
Expected: version incremented (e.g. 0.0.18 → 0.0.19) and committed by `npm version`.

- [ ] **Step 4: Publish (USER ACTION — requires npm 2FA browser approval)**

> Do **not** run this autonomously. Surface it to the user:
> Run (in `packages/angular`): `npm publish --access public`

- [ ] **Step 5: Commit any remaining build/version artifacts**

```bash
git add packages/angular/package.json
git commit -m "chore(angular): version bump for layout DOM-measurement release

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(If `npm version` already created the commit, this step is a no-op.)

---

## Task 7: Feedback bookkeeping (spec Part C + #5/#6 close-out)

Mark the feedback entries resolved in the consumer repo's tracking doc.

**Files:**
- Modify: `C:\Users\shisu\CodeWeb\brainstorm_agentic_app\docs\angflow-feedback.md`

- [ ] **Step 1: Mark #4 ✅**

Change the `## 4. ⛳ Minimap color inputs are dead …` heading to `## 4. ✅ Minimap color inputs are dead …` and append a resolution bullet:

```markdown
- **✅ Fixed in angflow** (`9be04de28`): minimap binds node/mask fill, stroke, and
  stroke-width as inline `[style.*]` instead of `[attr.fill]`, so `[nodeColor]`,
  `[maskColor]`, `[nodeStrokeColor]`, `[nodeStrokeWidth]` are effective; CSS-variable
  theming (incl. dark mode) still applies when unset. Once published: drop the
  `minimapNodeClass` CSS-hook workaround in `web/src/styles.css` +
  `canvas.component.ts` and use the color inputs directly.
```

- [ ] **Step 2: Mark #5 ✅**

Change `## 5. ⛳ …` to `## 5. ✅ …` and append (use the actual commit hashes from Tasks 1 & 4 — get them with `git log --oneline -8`):

```markdown
- **✅ Fixed in angflow** (`<task1-hash>`, `<task4-hash>`): `applyLayout` measures live
  node footprints from the DOM (`offsetWidth/Height`, no zoom math) and always prefers
  them — fixing both the controlled-mode `measured` wipe and post-growth staleness.
  `layoutNodes` stays pure. Added `applyDimensionChanges(nodes, changes)` so
  controlled-mode apps can forward `measured` for floating edges / `fitView`. Once
  published: drop the manual per-node footprint estimate in `tidy()` and wire
  `applyDimensionChanges` into `onNodesChange`.
```

- [ ] **Step 3: Mark #6 ✅**

Change `## 6. ⛳ …` to `## 6. ✅ …` and append (use the Task 2 & 4 hashes):

```markdown
- **✅ Fixed in angflow** (`<task2-hash>`, `<task3-hash>`, `<task4-hash>`): `layoutNodes`
  reserves dagre space for edge labels via `labelWidth`/`labelHeight` (or a default box
  for a non-empty `label`); `applyLayout` auto-measures `.xy-flow__edge-label` boxes from
  the DOM. Once published: delete `web/src/app/canvas/tidy-layout.ts` again and call
  `applyLayout`.
```

- [ ] **Step 4: Commit (in the brainstorm_agentic_app repo)**

```bash
cd /c/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs(feedback): mark angflow #4/#5/#6 fixed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Part A (node DOM measurement in `applyLayout`) → Task 4 (`withLiveMeasurements`). ✓
- Part B (`applyDimensionChanges` + docs) → Task 1 (helper) + Task 5 (docs). ✓
- Part D (`layoutNodes` label box, renderer `data-id`, `applyLayout` label measurement) → Task 2 + Task 3 + Task 4 (`withLiveEdgeLabels`). ✓
- Part C (#4 bookkeeping) → Task 7 Step 1. ✓
- Rollout (build, version, publish, feedback marks, regression bar) → Task 6 + Task 7. ✓

**Type consistency:**
- `applyDimensionChanges<NodeType>(nodes, changes)` — same signature in Task 1 impl, test, and Task 5 README snippet. ✓
- `LayoutEdgeInput` with `source/target/label?/labelWidth?/labelHeight?` — defined Task 2, consumed by `withLiveEdgeLabels` clones in Task 4 (sets `labelWidth`/`labelHeight`). `EdgeType` is assignable to `LayoutEdgeInput` (has `source`/`target`/optional `label`), so `getEdges()` flows into `layoutFn`. ✓
- `withLiveMeasurements` / `withLiveEdgeLabels` — names match between `applyLayout` body and helper defs in Task 4. ✓
- `measured: { width, height }` shape consistent between `applyDimensionChanges` (Task 1) and `withLiveMeasurements` (Task 4). ✓

**Placeholder scan:** No TBD/TODO. Task 7 uses `<task-hash>` placeholders that are explicitly resolved at execution time via `git log` — these are runtime values, not unfilled plan content. ✓
