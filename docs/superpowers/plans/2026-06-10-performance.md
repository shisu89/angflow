# Performance (Pan/Zoom Version Bumps, Node/Edge Memoization, Bridge Throttle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pan/zoom a pure CSS-transform update (remove per-frame version bumps), make drag O(changed) instead of O(N+E) per frame (per-node input cache keys, per-edge geometry memoization), and throttle agent-bridge flow.state emission during drags.

**Architecture:** Targeted cache/reactivity fixes in ng-flow.component, node-renderer, edge-renderer, flow-store, and the agent bridge watcher. No architectural rewrites; the injectNgFlowNode fine-grained context migration is noted as a follow-up only.

**Tech Stack:** Angular 21 signals (zoneless), vitest, extracted pure helpers for testable memoization.

**Part of:** `2026-06-10-review-remediation-master.md` (Plan C — execute AFTER Plan A; both touch flow-store.service.ts and agent-bridge.service.ts).

---
I
I've read all cited files and verified each finding. Before the plan, the verification notes that shape it:

**Verified findings (with corrections):**

1. `bumpVersion()` on transform writes confirmed at `ng-flow.component.ts:983` (onPanZoom) and `minimap.component.ts:362/412/444`. I enumerated **every** `version()` consumer: `flow-store.service.ts` (`collapsedHiddenIds:298`, `visibleNodes:304`, `displayEdges:313`, `visibleEdgeIds:321`), `ng-flow.service.ts` (8 graph-data selectors — none transform-dependent), `connection-line.component.ts:49/71` (reads `transform()` directly at :82), `node-renderer.component.ts:416/466`, `minimap.component.ts:185/218` (`maskPosition`/`viewBoxData` read `transform()` directly at :200/:220), `selection-box.component.ts:44` (flow-space coords, pan-invariant), `node-toolbar.component.ts:68` (node-local coords, pan-invariant). **No consumer relies on the bump for transform reactivity** — every transform-dependent computed already reads `transform()` directly. Notably, `updatePanZoomOptions`'s `onTransformChange` (`ng-flow.component.ts:1017-1019`) already writes transform *without* bumping, so the precedent exists in-tree.
2. Confirmed at `node-renderer.component.ts:415-451`, key at :419 embeds `version`. The inputs builder uses: `data` (identity), `type`, `selected`, `dragging`, `internals.z`, `connectable ?? nodesConnectable`, `positionAbsolute x/y`, `sourcePosition`, `targetPosition`, `dragHandle` — **measured dims are NOT in the inputs**, so they don't belong in the key.
3. Confirmed: `getEdgeInputs` uncached, called from 3 `@let` sites (:90, :193, :213); `getEdgePath(ei)` called twice (:129/:138 + :147). The template re-executes on every drag-frame version bump (dirty notification cascades through `displayEdges` → `visibleEdges` → template), so this is per-frame O(3E) inputs + O(2E) path work. The finding mentioned `connectionMode` as a key input — the actual code never reads it; omitted. The three `@let`s live in three separate `@for` blocks, so they cannot share one `@let`; memoization (identity-stable returns) is the correct fix, no template restructure needed.
4. Confirmed at `agent-bridge.service.ts:370-416` + `signatureOf` at :961-1000; drag fast-path re-emits `nodes` per frame (`flow-store.service.ts:647`), re-triggering the watcher effect and a full-graph `JSON.stringify` per frame. `dragging` is mirrored onto user nodes (:617), so `flow.getNodes().some(n => n.dragging)` is a valid drag detector.
5. Confirmed `collapsedHiddenIds`/`visibleEdgeIds` return fresh Sets. The node-renderer entry-animation Set rebuild (:126-150) is **not safely fixable**: `previousNodeIds` must stay maintained while animation is disabled — pinned by the existing test `'enabling animation later only animates nodes added after the toggle'` (`node-renderer.component.spec.ts:276`). Skipped with rationale in Task 5.

Test runner verified: `vitest` (`packages/angular/package.json` → `"test": "vitest run"`). Component-level testing IS feasible headlessly — `node-renderer.component.spec.ts`, `minimap.component.spec.ts`, `edge-renderer.data-enrichment.spec.ts`, and `agent-bridge.spec.ts` all use `TestBed` + `provideZonelessChangeDetection()` and call renderer methods directly.

---

## Implementation Plan — PERFORMANCE cluster

All paths relative to `C:\Users\shisu\CodeWeb\angflow`. All test commands run from the repo root. Conventional commits; each commit ends with the `Co-Authored-By` trailer.

### Task 1: Stop bumping version on pan/zoom transform writes

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (:983)
- Modify: `packages/angular/src/lib/components/minimap/minimap.component.ts` (:362, :412, :444)
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (:251-252, comment only)
- Test: `packages/angular/src/lib/components/minimap/minimap.component.spec.ts`, `packages/angular/src/lib/services/flow-store.service.spec.ts`

**What could regress:** (a) minimap viewport indicator freezing during pan/zoom — guarded: `maskPosition`/`viewBoxData` read `transform()` directly, regression test below; (b) viewport culling (`onlyRenderVisibleElements`) not updating on pan — guarded: `visibleNodes` reads `transform()` inside the culling branch (`flow-store.service.ts:308`), regression test below; (c) connection-line during auto-pan — already reads `transform()` at `connection-line.component.ts:82`, covered by existing `connection-line.component.spec.ts`. The `onPanZoom` callback itself has no headless harness (requires d3/XYPanZoom DOM); it is covered by the same store-level contract tests plus the full suite.

- [ ] **Step 1: Add failing minimap tests + store contract tests.** Append to `packages/angular/src/lib/components/minimap/minimap.component.spec.ts` (reuses the file's existing `setSignalInput`/`createMinimap` helpers; add `vi` to the vitest import):

```ts
describe('MiniMapComponent pan/zoom interactions do not bump the store version', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never);
  });

  it('wheel zoom updates the transform without bumping version', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'zoomable', true);
    fixture.detectChanges();

    const v0 = store.version();
    const t0 = store.transform();
    fixture.componentInstance.onMinimapWheel(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));

    expect(store.transform()).not.toEqual(t0);
    expect(store.version()).toBe(v0);
  });

  it('drag pan updates the transform without bumping version', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'pannable', true);
    fixture.detectChanges();

    const v0 = store.version();
    fixture.componentInstance.onMinimapMouseDown(new MouseEvent('mousedown'));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 90 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(store.transform()).not.toEqual([0, 0, 1]);
    expect(store.version()).toBe(v0);
  });

  it('click-pan animation frames update the transform without bumping version', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    try {
      const fixture = createMinimap();
      setSignalInput(fixture.componentInstance, 'pannable', true);
      fixture.detectChanges();

      const v0 = store.version();
      fixture.componentInstance.onMinimapClick(new MouseEvent('click', { clientX: 100, clientY: 75 }));
      nowSpy.mockReturnValue(50);
      frames.shift()?.(50); // run one animation frame

      expect(store.version()).toBe(v0);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('REGRESSION: viewport indicator still reacts to pure transform writes', () => {
    const fixture = createMinimap();
    fixture.detectChanges();
    const v0 = store.version();
    const viewBoxBefore = fixture.componentInstance.viewBox();
    const maskBefore = fixture.componentInstance.maskPath();

    store.transform.set([-250, -180, 1.6]); // no bump involved

    expect(store.version()).toBe(v0);
    expect(fixture.componentInstance.viewBox()).not.toBe(viewBoxBefore);
    expect(fixture.componentInstance.maskPath()).not.toBe(maskBefore);
  });
});
```

Append to `packages/angular/src/lib/services/flow-store.service.spec.ts` inside the top-level `describe('FlowStore', ...)` block (these pin the store contract that makes the component edits safe — they pass before and after; the red/green pair is the minimap trio above). Also add `vi.mock('../graph/collapse', { spy: true });` directly below the imports at the top of the file, and add `import { getCollapsedHiddenIds } from '../graph/collapse';` to the imports:

```ts
  // ── Transform writes are version-free (pan/zoom must not dirty the graph) ─

  describe('transform writes are version-free', () => {
    it('writing transform does not change version; viewport stays reactive', () => {
      store.setNodes([makeNode('1')]);
      const v0 = store.version();
      store.transform.set([100, 50, 2]);
      expect(store.version()).toBe(v0);
      expect(store.viewport()).toEqual({ x: 100, y: 50, zoom: 2 });
    });

    it('REGRESSION: culling re-evaluates on transform writes without a bump', () => {
      store.width.set(500);
      store.height.set(500);
      store.transform.set([0, 0, 1]);
      store.onlyRenderVisibleElements.set(true);
      store.setNodes([
        makeNode('near', { position: { x: 100, y: 100 }, width: 100, height: 50 }),
        makeNode('far', { position: { x: 5000, y: 5000 }, width: 100, height: 50 }),
      ]);
      for (const [, n] of store.nodeLookup) {
        n.measured = { width: n.width ?? 100, height: n.height ?? 50 };
        n.internals.handleBounds = { source: [], target: [] };
      }
      store.bumpVersion();
      expect(store.visibleNodes().map((n) => n.id)).toEqual(['near']);

      const v0 = store.version();
      store.transform.set([-4900, -4900, 1]); // pan to the far node
      expect(store.version()).toBe(v0);
      expect(store.visibleNodes().map((n) => n.id)).toEqual(['far']);
    });

    it('PERF: a pure transform write triggers zero collapse/visibility recomputation', () => {
      store.setNodes([makeNode('1'), makeNode('2')]);
      store.visibleNodes(); // settle the computeds
      const before = vi.mocked(getCollapsedHiddenIds).mock.calls.length;

      store.transform.set([120, 40, 1.25]);
      store.visibleNodes();
      expect(vi.mocked(getCollapsedHiddenIds).mock.calls.length).toBe(before);

      store.bumpVersion();
      store.visibleNodes();
      expect(vi.mocked(getCollapsedHiddenIds).mock.calls.length).toBe(before + 1);
    });
  });
```

- [ ] **Step 2: Run and confirm the expected failures.** `npm --prefix packages/angular test -- src/lib/components/minimap/minimap.component.spec.ts src/lib/services/flow-store.service.spec.ts` — expect the three minimap "without bumping version" tests to fail with `expected <v0+1> to be <v0>` (the handlers call `bumpVersion()` today); the REGRESSION tests and store tests pass.
- [ ] **Step 3: Remove the minimap bumps.** In `packages/angular/src/lib/components/minimap/minimap.component.ts`, delete the line `this.store.bumpVersion();` at :362 (click-pan rAF closure), :412 (`onMinimapMouseMove`), and :444 (`onMinimapWheel`). Each becomes a bare `this.store.transform.set([...]);` — exactly the pattern `onTransformChange` already uses in `ng-flow.component.ts:1017-1019`.
- [ ] **Step 4: Run pass.** `npm --prefix packages/angular test -- src/lib/components/minimap/minimap.component.spec.ts` — all green.
- [ ] **Step 5: Remove the pan/zoom bump in NgFlowComponent.** In `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`, change `onPanZoom` (:980-986):

```ts
      onPanZoom: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
        // Transform-only write: every transform consumer (viewport CSS
        // transform, minimap mask, culling, connection line) reads
        // this.transform() directly — bumping version here would dirty all
        // node/edge templates O(N+E) per pan frame for nothing.
        this.store.transform.set(transform);
        this.move.emit({ event, viewport });
        this.viewportChange.emit(viewport);
      },
```

Also update the stale comment on the version signal in `packages/angular/src/lib/services/flow-store.service.ts` (:251-252) to:

```ts
  // A version counter bumped on graph changes (node/edge add/remove/move,
  // selection, measurement) to trigger recomputation of visibleNodes /
  // visibleEdges without rebuilding the full nodeLookup. Deliberately NOT
  // bumped on transform (pan/zoom) writes — transform consumers read
  // this.transform() directly.
```

- [ ] **Step 6: Run the full suite.** `npm --prefix packages/angular test` — expect all green (in particular `connection-line.component.spec.ts`, `ng-flow.service.spec.ts`, and the collapse computeds, none of which depend on transform-driven bumps).
- [ ] **Step 7: Commit.**
```
git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/components/minimap/minimap.component.ts packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/components/minimap/minimap.component.spec.ts packages/angular/src/lib/services/flow-store.service.spec.ts
git commit -m "perf(angular): stop bumping version on pan/zoom transform writes" -m "Transform consumers read transform() directly; bumping dirtied every node/edge template O(N+E) per pan frame." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: Key the node-inputs cache per node instead of the global version

**Files:**
- Modify: `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts` (:167, :415-451; new exported helper)
- Test: `packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts`

**What could regress:** stale inputs if a field that feeds the inputs object changes without changing the key. The key enumerates every field the builder at :425-438 reads — `type`, `isTemplate`, `selected`, `dragging`, `internals.z`, resolved connectable, `positionAbsolute x/y`, `sourcePosition`, `targetPosition`, `dragHandle` — and `data` is guarded by reference in the cache entry (`id` is the cache key itself). Known pre-existing gap kept at parity: swapping `customNodeTypes` for the same type name at runtime doesn't invalidate (the old version-key didn't catch it either, since input changes don't bump version). Noted follow-up (NOT in this task): migrating node rendering fully onto the existing fine-grained `injectNgFlowNode` / `NG_FLOW_NODE_CONTEXT` DI context would remove this cache entirely.

- [ ] **Step 1: Add failing tests.** Append to `packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts` (add `computeNodeInputsKey` to the import from `./node-renderer.component`; add `InternalNode` to the type import):

```ts
describe('getNodeInputs cache keying (per-node, not global version)', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    component = TestBed.createComponent(NodeRendererComponent).componentInstance;
  });

  it('PERF: a version bump alone does not rebuild a node inputs object', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.bumpVersion();
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).toBe(before);
  });

  it('PERF: dragging one node does not rebuild other nodes inputs (O(1) invalidation)', () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' },
      { id: 'n2', position: { x: 100, y: 0 }, data: {}, type: 'default' },
    ]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.triggerNodeChanges([
      { id: 'n2', type: 'position', position: { x: 150, y: 50 }, dragging: true },
    ] as never);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).toBe(before);
  });

  it('REGRESSION: moving the node itself rebuilds its inputs', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.triggerNodeChanges([
      { id: 'n1', type: 'position', position: { x: 30, y: 40 }, dragging: true },
    ] as never);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).not.toBe(before);
  });

  it('REGRESSION: selection change rebuilds inputs', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.addSelectedNodes(['n1']);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).not.toBe(before);
  });

  it('REGRESSION: data identity change rebuilds inputs', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: { v: 1 }, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: { v: 2 }, type: 'default' }]);
    expect(component.getNodeInputs(store.nodeLookup.get('n1')!)).not.toBe(before);
  });
});

describe('computeNodeInputsKey (pure)', () => {
  const internal = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'n',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {},
      internals: { positionAbsolute: { x: 0, y: 0 }, z: 0 },
      ...overrides,
    }) as unknown as InternalNode;

  it('changes for every field that feeds the inputs object', () => {
    const base = computeNodeInputsKey(internal(), true, false);
    expect(computeNodeInputsKey(internal({ internals: { positionAbsolute: { x: 1, y: 0 }, z: 0 } }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ internals: { positionAbsolute: { x: 0, y: 0 }, z: 5 } }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ selected: true }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ dragging: true }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ type: 'custom' }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ connectable: false }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal(), false, false)).not.toBe(base); // nodesConnectable
    expect(computeNodeInputsKey(internal(), true, true)).not.toBe(base);   // template registered
    expect(computeNodeInputsKey(internal({ sourcePosition: 'left' }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ targetPosition: 'right' }), true, false)).not.toBe(base);
    expect(computeNodeInputsKey(internal({ dragHandle: '.h' }), true, false)).not.toBe(base);
  });

  it('is stable for identical state', () => {
    expect(computeNodeInputsKey(internal(), true, false)).toBe(computeNodeInputsKey(internal(), true, false));
  });
});
```

- [ ] **Step 2: Run and confirm failures.** `npm --prefix packages/angular test -- src/lib/container/node-renderer/node-renderer.component.spec.ts` — the two PERF tests fail (`expected inputs object to be itself` — new object because version is in the key); `computeNodeInputsKey` tests fail to compile/import (helper doesn't exist yet).
- [ ] **Step 3: Implement.** In `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts`:

(a) Add the exported pure helper above the `@Component` decorator (below `builtInNodeTypes`):

```ts
/**
 * Cache key for a node's NgComponentOutlet inputs object. Enumerates every
 * field `getNodeInputs` feeds into the inputs object (data is compared by
 * reference in the cache entry instead — object identity can't live in a
 * string key). Exported for tests.
 */
export function computeNodeInputsKey(
  node: InternalNode,
  nodesConnectable: boolean,
  isTemplate: boolean,
): string {
  const x = node.internals?.positionAbsolute?.x ?? node.position.x;
  const y = node.internals?.positionAbsolute?.y ?? node.position.y;
  return [
    node.type ?? 'default',
    isTemplate ? 1 : 0,
    node.selected ? 1 : 0,
    node.dragging ? 1 : 0,
    node.internals?.z ?? 0,
    (node.connectable ?? nodesConnectable) ? 1 : 0,
    x,
    y,
    node.sourcePosition ?? '',
    node.targetPosition ?? '',
    node.dragHandle ?? '',
  ].join(':');
}
```

(b) Change the cache declaration at :167 to carry the data reference:

```ts
  private nodeInputsCache = new Map<string, { key: string; data: unknown; inputs: Record<string, unknown> }>();
```

(c) Replace the head and tail of `getNodeInputs` (:415-421 and :449), keeping the builder body (:425-447) unchanged:

```ts
  getNodeInputs(node: InternalNode): Record<string, unknown> {
    const nodesConnectable = this.store.nodesConnectable();
    const isTemplate = this.store.nodeTemplates().has(node.type ?? 'default');
    // Per-node key: a global version bump (every drag frame) must not
    // invalidate all N nodes' inputs — only fields this node's inputs
    // actually read. The template stays version-reactive via visibleNodes().
    const key = computeNodeInputsKey(node, nodesConnectable, isTemplate);
    const cached = this.nodeInputsCache.get(node.id);
    if (cached && cached.key === key && cached.data === node.data) {
      return cached.inputs;
    }
```

and the final store line becomes:

```ts
    this.nodeInputsCache.set(node.id, { key, data: node.data, inputs });
    return inputs;
```

- [ ] **Step 4: Run pass.** `npm --prefix packages/angular test -- src/lib/container/node-renderer/node-renderer.component.spec.ts` — all green, including the pre-existing `'busts the inputs cache when a template is registered for an existing type'` (covered by the `isTemplate` key component) and the `isConnectable` tests (covered by the connectable key component). Then `npm --prefix packages/angular test` for the full suite.
- [ ] **Step 5: Commit.**
```
git add packages/angular/src/lib/container/node-renderer/node-renderer.component.ts packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts
git commit -m "perf(angular): key node inputs cache per node instead of global version" -m "A drag frame now invalidates only the dragged node's inputs, not all N. Follow-up (not here): migrate node rendering onto NG_FLOW_NODE_CONTEXT to drop this cache." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Memoize edge inputs and path per edge

**Files:**
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (:303-326 `getEdgePath`, :357 `getEdgeInputs`, new constructor effect, new exported helpers)
- Create: `packages/angular/src/lib/container/edge-renderer/edge-renderer.memo.spec.ts`

**What could regress:** (a) edges not following a dragged node — guarded: positions/dims are in the geometry key, regression test below; (b) stale handle-data enrichment — guarded by `handleDataRegistry()` map identity in the entry (and the read keeps the template subscribed on cache hits, satisfying zoneless reactivity), regression test below; (c) stale geometry after remeasure — guarded by `handleBounds` reference compares (replaced wholesale by `updateNodeInternals`) plus measured dims in the key; (d) stale edge props (selected/label/markers/data) — guarded by edge object identity (`applyEdgeChanges` replaces changed edge objects). Known limitation: collapse-rewritten display edges get fresh objects per recompute, so they always miss the memo — correct, just unoptimized (collapse is rare). In-place mutation of `edge.data` without identity change is served stale — same observable behavior as today's NgComponentOutlet shallow input compare. No template restructure: the three `@let ei` sites live in three separate `@for` blocks and cannot share a `@let`; with the memo, calls 2 and 3 are O(1) identity hits.

- [ ] **Step 1: Create the failing spec** `packages/angular/src/lib/container/edge-renderer/edge-renderer.memo.spec.ts`:

```ts
/**
 * Edge renderer memoization tests.
 *
 * The template evaluates getEdgeInputs(edge) up to 3x per edge per CD pass
 * (main SVG @let :90, custom-edge overlay @let :193, label @let :213) and
 * getEdgePath(ei) twice (:129/:138 interaction + :147 visible). These tests
 * pin that repeated calls within an unchanged frame are identity-stable cache
 * hits with exactly one path computation, and that every input affecting
 * geometry or enrichment still invalidates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import * as system from '@angflow/system';
import { Position, type Handle } from '@angflow/system';
import { EdgeRendererComponent, computeEdgeGeometryKey } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node, Edge, InternalNode } from '../../types';

vi.mock('@angflow/system', { spy: true });

describe('edge renderer memoizes inputs and path per edge', () => {
  let store: FlowStore;
  let renderer: EdgeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    renderer = TestBed.createComponent(EdgeRendererComponent).componentInstance;
  });

  function seedFlow(): { edge: Edge } {
    const nodes: Node[] = [
      { id: 'a', type: 'default', data: {}, position: { x: 0, y: 0 }, width: 100, height: 50 },
      { id: 'b', type: 'default', data: {}, position: { x: 300, y: 0 }, width: 100, height: 50 },
    ];
    const edge: Edge = { id: 'e1', source: 'a', target: 'b', sourceHandle: 'sh', targetHandle: 'th' };
    store.setNodes(nodes);
    store.setEdges([edge]);
    store.nodeLookup.get('a')!.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'a', x: 0, y: 0, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    store.nodeLookup.get('b')!.internals.handleBounds = {
      source: null,
      target: [{ id: 'th', nodeId: 'b', x: 0, y: 0, position: Position.Left, type: 'target', width: 6, height: 6 }],
    };
    return { edge };
  }

  it('PERF: one template pass computes the path exactly once per edge', () => {
    const { edge } = seedFlow();
    const bezier = vi.mocked(system.getBezierPath);
    bezier.mockClear();

    // Simulate one CD pass: three @let evaluations + two path bindings.
    const ei1 = renderer.getEdgeInputs(edge);
    const ei2 = renderer.getEdgeInputs(edge);
    const ei3 = renderer.getEdgeInputs(edge);
    renderer.getEdgePath(ei1);
    renderer.getEdgePath(ei1);

    expect(ei2).toBe(ei1);
    expect(ei3).toBe(ei1);
    expect(bezier).toHaveBeenCalledTimes(1);

    // A second identical pass (e.g. unrelated version bump re-render) is free.
    renderer.getEdgePath(renderer.getEdgeInputs(edge));
    expect(bezier).toHaveBeenCalledTimes(1);
  });

  it('REGRESSION: moving the source node invalidates and recomputes once', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    const bezier = vi.mocked(system.getBezierPath);
    bezier.mockClear();

    store.triggerNodeChanges([
      { id: 'a', type: 'position', position: { x: 40, y: 80 }, dragging: true },
    ] as never);

    const after = renderer.getEdgeInputs(edge);
    expect(after).not.toBe(before);
    expect(after['sourceX']).not.toBe(before['sourceX']);
    renderer.getEdgePath(after);
    renderer.getEdgePath(after);
    expect(bezier).toHaveBeenCalledTimes(1);
  });

  it('REGRESSION: registering handle data after a cached read invalidates enrichment', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    expect((before['sourceHandle'] as Handle | null)?.data).toBeUndefined();

    store.registerHandleData('a', 'sh', 'source', 'payload');

    const after = renderer.getEdgeInputs(edge);
    expect(after).not.toBe(before);
    expect((after['sourceHandle'] as Handle | null)?.data).toBe('payload');
  });

  it('REGRESSION: a new edge object (prop change) invalidates', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    const after = renderer.getEdgeInputs({ ...edge, selected: true });
    expect(after).not.toBe(before);
    expect(after['selected']).toBe(true);
  });

  it('REGRESSION: replacing handleBounds (remeasure) invalidates', () => {
    const { edge } = seedFlow();
    const before = renderer.getEdgeInputs(edge);
    store.nodeLookup.get('a')!.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'a', x: 10, y: 10, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    const after = renderer.getEdgeInputs(edge);
    expect(after).not.toBe(before);
  });
});

describe('computeEdgeGeometryKey (pure)', () => {
  const node = (x: number, y: number, w = 100, h = 50) =>
    ({
      id: 'n',
      position: { x, y },
      measured: { width: w, height: h },
      internals: { positionAbsolute: { x, y }, z: 0 },
    }) as unknown as InternalNode;
  const edge: Edge = { id: 'e', source: 'a', target: 'b' };

  it('changes when position, size, or edge mode changes; stable otherwise', () => {
    const base = computeEdgeGeometryKey(edge, node(0, 0), node(300, 0), 'handles');
    expect(computeEdgeGeometryKey(edge, node(0, 0), node(300, 0), 'handles')).toBe(base);
    expect(computeEdgeGeometryKey(edge, node(5, 0), node(300, 0), 'handles')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, node(0, 0), node(300, 9), 'handles')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, node(0, 0, 120), node(300, 0), 'handles')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, node(0, 0), node(300, 0), 'floating')).not.toBe(base);
    expect(computeEdgeGeometryKey(edge, undefined, node(300, 0), 'handles')).not.toBe(base);
  });
});
```

- [ ] **Step 2: Run and confirm failures.** `npm --prefix packages/angular test -- src/lib/container/edge-renderer/edge-renderer.memo.spec.ts` — import of `computeEdgeGeometryKey` fails (doesn't exist); after a stub export it would fail on `expect(ei2).toBe(ei1)` (new object per call) and `toHaveBeenCalledTimes(1)` (bezier called twice).
- [ ] **Step 3: Implement.** In `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`:

(a) Add `effect` to the `@angular/core` import list (:1-12) and `InternalNode` to the type import (:36): `import type { Edge, EdgeTypes, InternalNode } from '../../types';`

(b) Add exported pure helpers above the `@Component` decorator (below `builtInEdgeTypes`):

```ts
/**
 * Geometry portion of the edge memo key: everything numeric that feeds
 * endpoint computation. Handle geometry is guarded separately by
 * handleBounds reference (replaced wholesale on remeasure), and edge props
 * by edge object identity. Exported for tests.
 */
export function computeEdgeGeometryKey(
  edge: Edge,
  sourceNode: InternalNode | undefined,
  targetNode: InternalNode | undefined,
  edgeMode: 'handles' | 'floating',
): string {
  const sp = sourceNode?.internals?.positionAbsolute ?? sourceNode?.position;
  const tp = targetNode?.internals?.positionAbsolute ?? targetNode?.position;
  return [
    edgeMode,
    sp?.x ?? 0,
    sp?.y ?? 0,
    sourceNode?.measured?.width ?? sourceNode?.width ?? 150,
    sourceNode?.measured?.height ?? sourceNode?.height ?? 40,
    tp?.x ?? 0,
    tp?.y ?? 0,
    targetNode?.measured?.width ?? targetNode?.width ?? 150,
    targetNode?.measured?.height ?? targetNode?.height ?? 40,
  ].join(':');
}

/** Pure path computation from an edge-inputs object. Exported for tests. */
export function computeEdgePathFromInputs(ei: Record<string, unknown>): string {
  const type = ei['type'] || 'default';
  const params = {
    sourceX: ei['sourceX'] as number,
    sourceY: ei['sourceY'] as number,
    targetX: ei['targetX'] as number,
    targetY: ei['targetY'] as number,
    sourcePosition: (ei['sourcePosition'] ?? Position.Bottom) as Position,
    targetPosition: (ei['targetPosition'] ?? Position.Top) as Position,
  };

  switch (type) {
    case 'straight':
      return getStraightPath(params)[0];
    case 'step':
      return getSmoothStepPath({ ...params, borderRadius: 0 })[0];
    case 'smoothstep':
      return getSmoothStepPath(params)[0];
    case 'default':
    case 'bezier':
    default:
      return getBezierPath(params)[0];
  }
}
```

(c) Inside the class: rename the existing `getEdgeInputs` (:357-463) to `private buildEdgeInputs` — body byte-for-byte unchanged. Replace the existing `getEdgePath` (:303-326) with:

```ts
  getEdgePath(ei: Record<string, unknown>): string {
    // The memoized inputs object is identity-stable, so the interaction
    // path, visible path, and label all share one computation per entry.
    const entry = this.edgeMemo.get(ei['id'] as string);
    if (entry && entry.inputs === ei) return entry.path;
    return computeEdgePathFromInputs(ei);
  }
```

(d) Add the memo plus the new public `getEdgeInputs` (place directly above `buildEdgeInputs`):

```ts
  private readonly edgeMemo = new Map<
    string,
    {
      key: string;
      edge: Edge;
      handleData: ReadonlyMap<string, unknown>;
      sourceHandleBounds: unknown;
      targetHandleBounds: unknown;
      inputs: Record<string, any>;
      path: string;
    }
  >();

  getEdgeInputs(edge: Edge): Record<string, any> {
    const sourceNode = this.store.nodeLookup.get(edge.source);
    const targetNode = this.store.nodeLookup.get(edge.target);
    // These signal reads happen on hit AND miss so the template stays
    // subscribed to handle-data / edge-mode changes (zoneless reactivity).
    const handleData = this.store.handleDataRegistry();
    const key = computeEdgeGeometryKey(edge, sourceNode, targetNode, this.store.edgeMode());

    const cached = this.edgeMemo.get(edge.id);
    if (
      cached &&
      cached.key === key &&
      cached.edge === edge &&
      cached.handleData === handleData &&
      cached.sourceHandleBounds === sourceNode?.internals?.handleBounds &&
      cached.targetHandleBounds === targetNode?.internals?.handleBounds
    ) {
      return cached.inputs;
    }

    const inputs = this.buildEdgeInputs(edge);
    this.edgeMemo.set(edge.id, {
      key,
      edge,
      handleData,
      sourceHandleBounds: sourceNode?.internals?.handleBounds,
      targetHandleBounds: targetNode?.internals?.handleBounds,
      inputs,
      path: computeEdgePathFromInputs(inputs),
    });
    return inputs;
  }
```

(e) Add a constructor to prune stale entries (keyed off `edges()`, not `displayEdges()`, so it does NOT re-run on per-frame version bumps; synthetic `__collapsed:` display-edge entries are pruned on the next real edge-set change — bounded):

```ts
  constructor() {
    // Drop memo entries for edges that no longer exist (unbounded-growth guard).
    effect(() => {
      const ids = new Set<string>(this.store.edges().map((e) => e.id));
      for (const id of this.edgeMemo.keys()) {
        if (!ids.has(id)) this.edgeMemo.delete(id);
      }
    });
  }
```

- [ ] **Step 4: Run pass.** `npm --prefix packages/angular test -- src/lib/container/edge-renderer/edge-renderer.memo.spec.ts src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts` — all green (the enrichment spec exercises the same public `getEdgeInputs` and must stay green through the memo). Then full suite: `npm --prefix packages/angular test`.
- [ ] **Step 5: Commit.**
```
git add packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts packages/angular/src/lib/container/edge-renderer/edge-renderer.memo.spec.ts
git commit -m "perf(angular): memoize edge inputs and path per edge" -m "One inputs build + one path computation per edge per change, shared across the 3 template @let sites and both path bindings (was 3x inputs + 2x path)." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4: Throttle agent-bridge flow.state emissions during drag

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (:370-416, new constant)
- Modify: `packages/angular/AGENT_BRIDGE.md` (events section, :191 and :193)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

**What could regress:** (a) final drag position lost — guarded by the trailing `setTimeout` + the immediate emit on `dragging: false`, both tested; (b) non-drag emissions delayed — throttle path only taken while some node has `dragging: true`, tested; (c) late emission after unregister — the trailing timer checks `destroyed` and is cleared in the dispose fn, tested. Timer is scheduling-only (no view-state writes), satisfying the zoneless rules. The doc's microtask-ordering guarantee gets a drag-mode caveat.

- [ ] **Step 1: Add failing tests.** Append a new describe to `packages/angular/src/lib/agent/agent-bridge.spec.ts` (inside the top-level `describe('AngflowAgentBridge', ...)` so it reuses `bridge`/`transport`/`newFlow`; add `afterEach` to the vitest import):

```ts
  describe('flow.state throttling during drag', () => {
    async function flushEffects(): Promise<void> {
      TestBed.tick();
      await new Promise<void>((r) => queueMicrotask(r));
    }

    function dragFrame(flow: NgFlowService, x: number, dragging = true): void {
      const store = (flow as unknown as { store: { triggerNodeChanges: (c: unknown[]) => void } }).store;
      store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x, y: 0 }, dragging }]);
    }

    function stateEvents() {
      return transport.events.filter(
        (e): e is { event: string; params: { nodes: Node[] } } =>
          'event' in e && e.event === 'flow.state',
      );
    }

    beforeEach(() => {
      // Keep queueMicrotask real (the watcher coalesces on it); fake only
      // the throttle's clock and timer.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(10_000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function setupDraggingFlow(): Promise<NgFlowService> {
      const flow = newFlow();
      flow.setNodes([makeNode('a')]);
      bridge.register('f', flow);
      await flushEffects();          // initial flow.state emission
      vi.advanceTimersByTime(200);   // move past the throttle window
      transport.events.length = 0;
      return flow;
    }

    it('emits at most one flow.state per 100ms while dragging, with a trailing emit', async () => {
      const flow = await setupDraggingFlow();

      dragFrame(flow, 10);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // interval elapsed -> immediate

      dragFrame(flow, 20);
      await flushEffects();
      dragFrame(flow, 30);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // throttled

      vi.advanceTimersByTime(100);
      await flushEffects();
      const events = stateEvents();
      expect(events.length).toBe(2); // trailing emit fired
      expect(events.at(-1)!.params.nodes[0].position).toEqual({ x: 30, y: 0 }); // latest state, not the throttled one
    });

    it('drag end emits the final state immediately', async () => {
      const flow = await setupDraggingFlow();

      dragFrame(flow, 10);
      await flushEffects();
      dragFrame(flow, 20);
      await flushEffects();
      expect(stateEvents().length).toBe(1);

      dragFrame(flow, 25, false); // drag end
      await flushEffects();
      const events = stateEvents();
      expect(events.length).toBe(2);
      expect(events.at(-1)!.params.nodes[0].position).toEqual({ x: 25, y: 0 });

      vi.advanceTimersByTime(500); // stale trailing timer must not double-emit
      await flushEffects();
      expect(stateEvents().length).toBe(2);
    });

    it('non-drag mutations are not throttled', async () => {
      const flow = newFlow();
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      flow.setNodes([makeNode('a')]);
      await flushEffects();
      flow.setNodes([makeNode('a'), makeNode('b')]);
      await flushEffects();
      expect(stateEvents().length).toBe(2);
    });

    it('a pending trailing emit is dropped on unregister', async () => {
      const flow = newFlow();
      flow.setNodes([makeNode('a')]);
      const unreg = bridge.register('f', flow);
      await flushEffects();
      vi.advanceTimersByTime(200);
      transport.events.length = 0;

      dragFrame(flow, 10);
      await flushEffects();
      dragFrame(flow, 20);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // x=20 pending in the trailing timer

      unreg();
      vi.advanceTimersByTime(500);
      await flushEffects();
      expect(stateEvents().length).toBe(1);
    });
  });
```

- [ ] **Step 2: Run and confirm failures.** `npm --prefix packages/angular test -- src/lib/agent/agent-bridge.spec.ts` — the throttle test fails with 3 state events instead of 1 (every frame emits today); the trailing/unregister assertions fail correspondingly. The non-drag test passes (documents unchanged behavior).
- [ ] **Step 3: Implement.** In `packages/angular/src/lib/agent/agent-bridge.service.ts`, add below the `MUTATING_TOOLS` set (:59):

```ts
/** Max flow.state emission rate while any node drag is in progress. */
const DRAG_STATE_EMIT_INTERVAL_MS = 100;
```

Replace `watchFlow` (:370-416) with:

```ts
  private watchFlow(id: string, flow: NgFlowService): () => void {
    let pending = false;
    let destroyed = false;
    let lastSignature = '';
    let lastEmitTime = Number.NEGATIVE_INFINITY;
    let trailingTimer: ReturnType<typeof setTimeout> | null = null;

    const emitState = () => {
      // Re-read at emit time so coalesced/throttled bursts see the latest state.
      const params = {
        flowId: id,
        nodes: flow.getNodes(),
        edges: flow.getEdges(),
        viewport: flow.getViewport(),
        selection: {
          nodeIds: flow.selectedNodes().map((n: Node) => n.id),
          edgeIds: flow.selectedEdges().map((e: Edge) => e.id),
        },
      };
      // Suppress duplicate emissions when controlled-mode round-trips bounce
      // identical state through the store twice. See signatureOf for the
      // field set; it must cover anything a mutating tool can change.
      const sig = signatureOf(params);
      if (sig === lastSignature) return;
      lastSignature = sig;
      lastEmitTime = Date.now();
      this.emit({ event: 'flow.state', params });
    };

    const ref = runInInjectionContext(this.injector, () =>
      effect(() => {
        // Touch every signal we want to broadcast so the effect re-runs on change.
        flow.nodes();
        flow.edges();
        flow.viewport();
        flow.selectedNodes();
        flow.selectedEdges();

        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          // A queued microtask may outlive the effect (unregister between
          // effect run and microtask drain). Drop late emissions so we never
          // push state for a flowId that's no longer registered.
          if (destroyed) return;
          // While a drag is in flight the store re-emits nodes per pointer
          // frame; serializing the whole graph at that rate floods every
          // transport. Throttle to one emission per interval with a trailing
          // emit so the final drag state is never lost. The timer only
          // schedules the emission — no view state is written here.
          const dragging = flow.getNodes().some((n: Node) => n.dragging === true);
          if (dragging) {
            const elapsed = Date.now() - lastEmitTime;
            if (elapsed < DRAG_STATE_EMIT_INTERVAL_MS) {
              if (trailingTimer === null) {
                trailingTimer = setTimeout(() => {
                  trailingTimer = null;
                  if (destroyed) return;
                  emitState();
                }, DRAG_STATE_EMIT_INTERVAL_MS - elapsed);
              }
              return;
            }
          }
          if (trailingTimer !== null) {
            clearTimeout(trailingTimer);
            trailingTimer = null;
          }
          emitState();
        });
      }),
    );
    return () => {
      destroyed = true;
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      ref.destroy();
    };
  }
```

- [ ] **Step 4: Update the docs in the same commit.** In `packages/angular/AGENT_BRIDGE.md`, replace the `flow.state` bullet (:191) with:

```md
- `flow.state` — `{ flowId, nodes, edges, viewport, selection: { nodeIds, edgeIds } }`. Coalesced per microtask; duplicates suppressed via a cheap signature. Emitted in the **next microtask** via the `watchFlow` effect. While any node is mid-drag (`dragging: true`), emissions are additionally throttled to at most one per 100ms, with a trailing emission that guarantees the latest drag state is always delivered; drag end emits promptly.
```

and append to the ordering note (:193): `During an active node drag, the throttle may delay flow.state past the next microtask (up to ~100ms); the synchronous flow.history ordering is unaffected.`

- [ ] **Step 5: Run pass.** `npm --prefix packages/angular test -- src/lib/agent/agent-bridge.spec.ts` (the existing `'emits flow.state for a position-only change (drag fast-path)'` test at :351 must stay green — its single frame after registration is a *first* drag emission under real timers and emits immediately), then the full suite `npm --prefix packages/angular test`.
- [ ] **Step 6: Commit.**
```
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/AGENT_BRIDGE.md
git commit -m "perf(angular): throttle agent bridge flow.state emissions during drag" -m "Full-graph serialization now runs at most every 100ms while dragging, with a guaranteed trailing emit and immediate emit on drag end." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: Content equality for derived id sets (micro-fixes)

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (:297-300 `collapsedHiddenIds`, :319-333 `visibleEdgeIds`, new exported helper)
- Test: `packages/angular/src/lib/services/flow-store.service.spec.ts`

**Scope decisions after reading:** apply `equal` to `collapsedHiddenIds` and `visibleEdgeIds` (both safe — exact Set<string> membership semantics; `visibleEdgeIds` is public API via `ng-flow.service.ts:84`, so host effects watching it stop re-firing per drag frame — the real win; `collapsedHiddenIds`' benefit is identity stability for non-version consumers, marginal but free). **Skipped:** the node-renderer entry-animation Set rebuild (`node-renderer.component.ts:126-150`) — `previousNodeIds` must keep tracking ids while animation is disabled, otherwise nodes added during a disabled period get flagged as "entering" when animation is re-enabled; this is pinned by the existing test `'enabling animation later only animates nodes added after the toggle'` (`node-renderer.component.spec.ts:276-287`). The effect's early returns already keep re-runs write-free; the O(N) build is documented in-code and not safely removable.

**What could regress:** a consumer that relied on fresh Set identity per recompute to re-fire on unchanged content — none exists (verified consumers: `visibleNodes`/`displayEdges`/`minimapNodes` read `version()` independently; `ng-flow.service.visibleEdgeIds` is a pass-through). Content changes still propagate — regression test below.

- [ ] **Step 1: Add failing tests.** Append to `packages/angular/src/lib/services/flow-store.service.spec.ts` inside the top-level `describe('FlowStore', ...)`:

```ts
  // ── Set-content equality on derived id sets ───────────────────────────

  describe('derived id sets keep identity when membership is unchanged', () => {
    it('collapsedHiddenIds preserves identity across version bumps', () => {
      store.setNodes([
        { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true },
        { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      ]);
      const first = store.collapsedHiddenIds();
      expect(first).toEqual(new Set(['a']));
      store.bumpVersion();
      expect(store.collapsedHiddenIds()).toBe(first);
    });

    it('PERF: visibleEdgeIds does not notify consumers on a drag-frame bump', () => {
      store.setNodes([makeNode('1'), makeNode('2')]);
      store.setEdges([makeEdge('e1', '1', '2')]);
      const spy = vi.fn();
      const consumer = computed(() => {
        spy();
        return store.visibleEdgeIds();
      });
      consumer();
      const calls = spy.mock.calls.length;

      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 5, y: 5 }, dragging: true },
      ]);
      consumer();
      expect(spy.mock.calls.length).toBe(calls); // membership unchanged -> no re-fire
    });

    it('REGRESSION: visibleEdgeIds still updates when the edge set changes', () => {
      store.setNodes([makeNode('1'), makeNode('2'), makeNode('3')]);
      store.setEdges([makeEdge('e1', '1', '2')]);
      expect(store.visibleEdgeIds().has('e1')).toBe(true);
      store.setEdges([makeEdge('e1', '1', '2'), makeEdge('e2', '2', '3')]);
      expect(store.visibleEdgeIds().has('e2')).toBe(true);
      expect(store.visibleEdgeIds().size).toBe(2);
    });

    it('REGRESSION: collapsedHiddenIds still updates when collapse state changes', () => {
      store.setNodes([
        { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true },
        { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      ]);
      expect(store.collapsedHiddenIds()).toEqual(new Set(['a']));
      store.setNodes([
        { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: false },
        { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      ]);
      expect(store.collapsedHiddenIds()).toEqual(new Set());
    });
  });
```

- [ ] **Step 2: Run and confirm failures.** `npm --prefix packages/angular test -- src/lib/services/flow-store.service.spec.ts` — the identity test fails (`expected new Set to be previous Set`) and the consumer-notification test fails (`expected 2 to be 1`); both REGRESSION tests pass.
- [ ] **Step 3: Implement.** In `packages/angular/src/lib/services/flow-store.service.ts`, add above the `@Injectable()` decorator (below the imports):

```ts
/**
 * Content equality for derived string-id sets. Used as a computed `equal` so
 * a recompute that lands on identical membership keeps the previous Set
 * identity and does not notify consumers. Exported for tests.
 */
export function stringSetEquals(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
```

Change `collapsedHiddenIds` (:297-300) to:

```ts
  readonly collapsedHiddenIds = computed(() => {
    this.version();
    return getCollapsedHiddenIds(this.nodeLookup);
  }, { equal: stringSetEquals });
```

Change the closing of `visibleEdgeIds` (:333) from `});` to `}, { equal: stringSetEquals });`.

- [ ] **Step 4: Run pass.** `npm --prefix packages/angular test -- src/lib/services/flow-store.service.spec.ts`, then the full suite `npm --prefix packages/angular test`.
- [ ] **Step 5: Commit.**
```
git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts
git commit -m "perf(angular): set-content equality on collapsedHiddenIds and visibleEdgeIds" -m "Drag-frame version bumps no longer push fresh-but-identical Set identities to consumers. Entry-animation id-set rebuild intentionally left as-is: previousNodeIds must persist across disabled periods (pinned by node-renderer spec)." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Critical Files for Implementation
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\services\flow-store.service.ts
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\container\ng-flow\ng-flow.component.ts
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\container\edge-renderer\edge-renderer.component.ts
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\container\node-renderer\node-renderer.component.ts
- C:\Users\shisu\CodeWeb\angflow\packages\angular\src\lib\agent\agent-bridge.service.ts