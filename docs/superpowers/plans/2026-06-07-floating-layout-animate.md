# Floating Edges, Standalone Layout, Animated Transitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `edgeMode="floating"`, a standalone `layoutNodes`/`applyLayout` API, and an `[animate]` input (entry animation + rAF position tweening) in `@angflow/angular`.

**Architecture:** All changes are in `packages/angular` (no system changes). Floating mode is a 2-line edge-renderer change behind a new `FlowStore.edgeMode` signal. `layoutNodes` is a pure dagre wrapper that `dagreLayout` delegates to. Position tweening lives in `FlowStore` (a single rAF loop writing position changes through the existing fast path) so nodes and edges re-render together; entry animation is CSS keyframes toggled by the node renderer.

**Tech Stack:** Angular 19 signals (zoneless — never inject NgZone; rAF/timer callbacks must drive updates via signal writes only), vitest, `@dagrejs/dagre` (optional peer, quarantined to the `./layout` subpath).

**Spec:** `docs/superpowers/specs/2026-06-07-floating-edges-layout-transitions-design.md`

**Working directory for all commands:** `packages/angular` unless stated otherwise. Test command: `npx vitest run <file>` (or `npm run test` for all). Commits go straight to `main` (trunk-based).

---

### Task 1: `layoutNodes` pure function

**Files:**
- Create: `packages/angular/src/lib/layout/layout-nodes.ts`
- Create: `packages/angular/src/lib/layout/layout-nodes.spec.ts`
- Modify: `packages/angular/src/lib/layout/dagre-layout.ts` (delegate)
- Modify: `packages/angular/src/lib/layout/index.ts` (export)

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/layout/layout-nodes.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { layoutNodes } from './layout-nodes';

describe('layoutNodes', () => {
  it('accepts nodes with measured dimensions and lays out LR', () => {
    const positions = layoutNodes(
      [
        { id: 'a', measured: { width: 100, height: 40 } },
        { id: 'b', measured: { width: 100, height: 40 } },
      ],
      [{ source: 'a', target: 'b' }],
      { direction: 'LR' },
    );
    expect(positions['a'].x).toBeLessThan(positions['b'].x);
  });

  it('defaults direction to TB when opts are omitted entirely', () => {
    const positions = layoutNodes(
      [{ id: 'a', width: 100, height: 40 }, { id: 'b', width: 100, height: 40 }],
      [{ source: 'a', target: 'b' }],
    );
    expect(positions['a'].y).toBeLessThan(positions['b'].y);
  });

  it('falls back measured → width → initialWidth → 150/40 default', () => {
    // No dimensions at all: must not throw, must return finite positions.
    const positions = layoutNodes([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }], {
      direction: 'TB',
    });
    for (const pos of Object.values(positions)) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('returns top-left corners (sibling separation reflects node width)', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
        { id: 'c', width: 100, height: 40 },
      ],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
      { direction: 'TB', nodeSep: 50 },
    );
    expect(Math.abs(positions['b'].x - positions['c'].x)).toBeGreaterThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: FAIL — cannot resolve `./layout-nodes`.

- [ ] **Step 3: Write the implementation**

Create `packages/angular/src/lib/layout/layout-nodes.ts`:

```ts
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
```

Replace the body of `packages/angular/src/lib/layout/dagre-layout.ts` with a delegation (keep the `AgentLayoutFn` type import; rewrite the JSDoc to lead with standalone use):

```ts
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
export const dagreLayout: AgentLayoutFn = (nodes, edges, opts) => layoutNodes(nodes, edges, opts);
```

Replace `packages/angular/src/lib/layout/index.ts`:

```ts
export { layoutNodes, type LayoutNodesOptions, type LayoutNodeInput } from './layout-nodes';
export { dagreLayout } from './dagre-layout';
export type { AgentLayoutFn, AgentLayoutOptions } from '../types/node-template';
```

- [ ] **Step 4: Run tests to verify they pass (old dagre-layout spec must stay green)**

Run: `npx vitest run src/lib/layout/`
Expected: PASS — both `layout-nodes.spec.ts` and `dagre-layout.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/layout
git commit -m "feat(angular): standalone layoutNodes API; dagreLayout delegates to it"
```

---

### Task 2: `edgeMode="floating"` in store + edge renderer

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (~line 183, near `onlyRenderVisibleElements`)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts:385-388`
- Test: `packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append a new describe block to `edge-renderer.data-enrichment.spec.ts` (reuses the file's existing imports; same TestBed pattern as the `floating endpoints` block at line 85):

```ts
describe('edgeMode="floating"', () => {
  let store: FlowStore;
  let component: EdgeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(EdgeRendererComponent);
    component = fixture.componentInstance;
  });

  /** Two handleless nodes: A at (0,0) 100x50, B at (300,200) 100x50. */
  function seedHandleless() {
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: { positionAbsolute: { x: 0, y: 0 }, handleBounds: null, z: 0 },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 },
      measured: { width: 100, height: 50 },
      internals: { positionAbsolute: { x: 300, y: 200 }, handleBounds: null, z: 0 },
    } as any);
  }

  it('computes ray-rect endpoints for nodes with zero handles', () => {
    store.edgeMode.set('floating');
    seedHandleless();
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B' });
    // Same geometry as the floating-handle test above: centers (50,25)→(350,225).
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
    expect(inputs['targetX']).toBeCloseTo(312.5, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2);
    expect(inputs['sourcePosition']).toBe(Position.Bottom);
    expect(inputs['targetPosition']).toBe(Position.Top);
  });

  it('default mode keeps the fixed bottom-center/top-center fallback', () => {
    seedHandleless(); // edgeMode left at default 'handles'
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B' });
    expect(inputs['sourceX']).toBeCloseTo(50, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2); // bottom of A
    expect(inputs['targetX']).toBeCloseTo(350, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2); // top of B
  });

  it('ignores declared non-floating handles when mode is floating', () => {
    store.edgeMode.set('floating');
    seedHandleless();
    const nodeA = store.nodeLookup.get('A')! as any;
    nodeA.internals.handleBounds = {
      source: [{ id: 'sh', nodeId: 'A', x: 0, y: 0, position: Position.Right, type: 'source', width: 6, height: 6 }],
      target: null,
    };
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B', sourceHandle: 'sh' });
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2); // ray-rect, not the handle at (3,3)
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
  });

  it('uses width/height fallbacks for unmeasured (first-frame) nodes', () => {
    store.edgeMode.set('floating');
    // Same rects as seedHandleless, but via `width`/`height` with no `measured`.
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 }, width: 100, height: 50,
      internals: { positionAbsolute: { x: 0, y: 0 }, handleBounds: null, z: 0 },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 }, width: 100, height: 50,
      internals: { positionAbsolute: { x: 300, y: 200 }, handleBounds: null, z: 0 },
    } as any);
    const inputs = component.getEdgeInputs({ id: 'e', source: 'A', target: 'B' });
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
  });

  it('self-loops fall back to fixed endpoints even in floating mode', () => {
    store.edgeMode.set('floating');
    seedHandleless();
    const inputs = component.getEdgeInputs({ id: 'self', source: 'A', target: 'A' });
    expect(inputs['sourceX']).toBeCloseTo(50, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2); // bottom-center fallback
    expect(inputs['targetX']).toBeCloseTo(50, 2);
    expect(inputs['targetY']).toBeCloseTo(0, 2);  // top-center fallback
  });
});
```

- [ ] **Step 2: Run tests to verify the new block fails**

Run: `npx vitest run src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts`
Expected: FAIL — `store.edgeMode` does not exist.

- [ ] **Step 3: Implement**

In `flow-store.service.ts`, next to `readonly onlyRenderVisibleElements = signal(false);` (~line 182), add:

```ts
  /**
   * 'handles' (default): edges attach at declared handles. 'floating': edges
   * ignore handles and attach at the ray-rect intersection from each node's
   * border toward the peer node's center — zero handle boilerplate. Set via
   * the `edgeMode` input on `<ng-flow>`.
   */
  readonly edgeMode = signal<'handles' | 'floating'>('handles');
```

In `edge-renderer.component.ts`, replace lines 385–388:

```ts
    // Self-loops ignore floating and fall back to fixed-handle positions (geometric degeneracy).
    const isSelfLoop = edge.source === edge.target;
    const sourceFloating = !isSelfLoop && sourceHandle?.floating === true;
    const targetFloating = !isSelfLoop && targetHandle?.floating === true;
```

with:

```ts
    // Self-loops ignore floating and fall back to fixed-handle positions (geometric degeneracy).
    const isSelfLoop = edge.source === edge.target;
    // Global floating mode (edgeMode="floating" on <ng-flow>) floats every
    // endpoint regardless of handles; otherwise the per-handle flag decides.
    const floatingMode = this.store.edgeMode() === 'floating';
    const sourceFloating = !isSelfLoop && (floatingMode || sourceHandle?.floating === true);
    const targetFloating = !isSelfLoop && (floatingMode || targetHandle?.floating === true);
```

(The existing reference-point and `getFloatingEndpoint`/`inferSide` logic below already handles handleless nodes — no other renderer change.)

- [ ] **Step 4: Run the full edge-renderer suite**

Run: `npx vitest run src/lib/container/edge-renderer/`
Expected: PASS (new block + all pre-existing floating/enrichment tests).

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts
git commit -m "feat(angular): edgeMode store signal; floating mode in edge renderer"
```

---

### Task 3: tween sampling utility (pure)

**Files:**
- Create: `packages/angular/src/lib/utils/position-tween.ts`
- Create: `packages/angular/src/lib/utils/position-tween.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/utils/position-tween.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { easeInOutCubic, sampleTween, type TweenEntry } from './position-tween';

describe('easeInOutCubic', () => {
  it('anchors 0→0, 0.5→0.5, 1→1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('eases (slower than linear early, faster late)', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe('sampleTween', () => {
  const entry: TweenEntry = { from: { x: 0, y: 100 }, to: { x: 200, y: 100 }, start: 1000, duration: 100 };

  it('returns from at start and is not done', () => {
    const s = sampleTween(entry, 1000);
    expect(s.position).toEqual({ x: 0, y: 100 });
    expect(s.done).toBe(false);
  });
  it('returns exactly to at/after the end and is done', () => {
    expect(sampleTween(entry, 1100)).toEqual({ position: { x: 200, y: 100 }, done: true });
    expect(sampleTween(entry, 1500)).toEqual({ position: { x: 200, y: 100 }, done: true });
  });
  it('is mid-flight halfway through', () => {
    const s = sampleTween(entry, 1050);
    expect(s.position.x).toBeGreaterThan(0);
    expect(s.position.x).toBeLessThan(200);
    expect(s.done).toBe(false);
  });
  it('clamps a time before start to from', () => {
    expect(sampleTween(entry, 0).position).toEqual({ x: 0, y: 100 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/position-tween.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/angular/src/lib/utils/position-tween.ts`:

```ts
import type { XYPosition } from '@angflow/system';

/** Fixed easing for node position tweens (matches CSS ease-in-out feel). */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface TweenEntry {
  from: XYPosition;
  to: XYPosition;
  /** Timestamp (performance.now() domain) when the tween started. */
  start: number;
  /** Milliseconds. */
  duration: number;
}

/** Sample one tween at time `now`. `done` means the target was reached exactly. */
export function sampleTween(entry: TweenEntry, now: number): { position: XYPosition; done: boolean } {
  const t = Math.min(1, Math.max(0, (now - entry.start) / entry.duration));
  const e = easeInOutCubic(t);
  return {
    position: {
      x: entry.from.x + (entry.to.x - entry.from.x) * e,
      y: entry.from.y + (entry.to.y - entry.from.y) * e,
    },
    done: t >= 1,
  };
}

/** True when the OS asks for reduced motion — disables all flow animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/position-tween.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/utils/position-tween.ts packages/angular/src/lib/utils/position-tween.spec.ts
git commit -m "feat(angular): pure tween sampling utility for position animation"
```

---

### Task 4: FlowStore tween integration (`animate` signal, rAF loop, drag-cancel)

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts`
- Test: `packages/angular/src/lib/services/flow-store.service.spec.ts` (append)

Notes for the implementer:
- `flow-store.service.spec.ts` constructs the store with plain `new FlowStore()` (no TestBed) — do **not** use `inject()` in field initializers or the constructor for this feature. Use an `ngOnDestroy()` method for cleanup; Angular calls it on component-provided injectables, and direct `new` in tests simply never calls it.
- The rAF loop drives updates exclusively through `triggerNodeChanges` (signal writes) — zoneless rule 2. rAF used to schedule logic is allowed (rule 3).

- [ ] **Step 1: Write the failing tests**

Append to `flow-store.service.spec.ts` (uses the file's existing `makeNode` helper and `vi` import):

```ts
describe('tweenNodePositions', () => {
  let frames: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    frames = [];
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function tick(toTime: number) {
    now = toTime;
    const cb = frames.shift();
    expect(cb).toBeDefined();
    cb!(now);
  }

  it('interpolates positions each frame and lands exactly on the target', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    const done = store.tweenNodePositions({ a: { x: 100, y: 50 } }, 100);

    tick(50); // halfway
    const mid = store.nodeLookup.get('a')!.position;
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(100);

    tick(100); // complete
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 100, y: 50 });
    await done; // promise resolves on completion
  });

  it('emits position changes through the change pipeline while tweening', () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    const seen: NodeChange[] = [];
    store.onNodesChange = (changes) => seen.push(...changes);

    store.tweenNodePositions({ a: { x: 100, y: 0 } }, 100);
    tick(50);
    expect(seen.some((c) => c.type === 'position')).toBe(true);
  });

  it('a user drag cancels that node’s tween', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a'), makeNode('b')]);
    const done = store.tweenNodePositions({ a: { x: 100, y: 0 }, b: { x: 0, y: 100 } }, 100);

    tick(10);
    // Simulate XYDrag moving node a.
    store.updateNodePositions(
      new Map([['a', { id: 'a', position: { x: 7, y: 7 }, internals: {}, measured: {} }]]),
      true,
    );
    tick(100); // b's tween completes; a must stay where the drag put it
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 7, y: 7 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 0, y: 100 });
    await done; // resolves even though one node was cancelled
  });

  it('retargeting replaces the tween from the current interpolated position', () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    store.tweenNodePositions({ a: { x: 100, y: 0 } }, 100);
    tick(50);
    const midX = store.nodeLookup.get('a')!.position.x;
    store.tweenNodePositions({ a: { x: 0, y: 0 } }, 100); // back to origin
    tick(150); // retargeted tween started at t=50, so it completes here
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 0 });
    expect(midX).toBeGreaterThan(0); // sanity: it really was mid-flight
  });

  it('resolves immediately for unknown ids or already-at-target positions', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    await store.tweenNodePositions({ nope: { x: 1, y: 1 }, a: { x: 0, y: 0 } }, 100);
    expect(frames.length).toBe(0); // no loop started
  });
});

describe('animate signal helpers', () => {
  it('animationEnabled reflects the animate signal', () => {
    const store = new FlowStore();
    expect(store.animationEnabled()).toBe(false);
    store.animate.set(true);
    expect(store.animationEnabled()).toBe(true);
    store.animate.set({ duration: 200 });
    expect(store.animationEnabled()).toBe(true);
  });
  it('animationDuration defaults to 300 and honors the override', () => {
    const store = new FlowStore();
    expect(store.animationDuration()).toBe(300);
    store.animate.set({ duration: 200 });
    expect(store.animationDuration()).toBe(200);
  });
});
```

If the spec file does not already import `afterEach`, extend the vitest import to `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/services/flow-store.service.spec.ts`
Expected: FAIL — `tweenNodePositions` / `animate` do not exist. Pre-existing tests still pass.

- [ ] **Step 3: Implement in `flow-store.service.ts`**

Add to the imports from `../utils/...` region:

```ts
import { sampleTween, prefersReducedMotion, type TweenEntry } from '../utils/position-tween';
```

Add signals + helpers next to `edgeMode` (from Task 2):

```ts
  /**
   * Animation master switch, mirrored from the `[animate]` input on
   * `<ng-flow>`: `false` (default) | `true` | `{ duration?: number }`.
   * Controls node entry animation and position tweening.
   */
  readonly animate = signal<boolean | { duration?: number }>(false);

  /** True when animations should run (input on, OS reduced-motion off). */
  animationEnabled(): boolean {
    const a = this.animate();
    return (a === true || (typeof a === 'object' && a !== null)) && !prefersReducedMotion();
  }

  /** Tween/entry duration in ms. Default 300. */
  animationDuration(): number {
    const a = this.animate();
    return typeof a === 'object' && a !== null && a.duration != null ? a.duration : 300;
  }
```

Add the tween engine as private state + public methods (place after `updateNodePositions`):

```ts
  // ── Position tweening ───────────────────────────────────────────────────
  // One shared rAF loop interpolates every active tween and pushes plain
  // position changes through triggerNodeChanges, so nodes AND edges re-render
  // together each frame (edges read store positions — CSS transforms would
  // detach them). Zoneless-safe: the rAF callback only writes signals.

  private readonly positionTweens = new Map<string, TweenEntry>();
  private tweenWaiters: Array<{ ids: Set<string>; resolve: () => void }> = [];
  private tweenRafId: number | null = null;

  /**
   * Animate the given nodes from their current positions to `positions` over
   * `duration` ms. Unknown ids and zero-distance moves are skipped. Resolves
   * when every requested node has finished (or had its tween cancelled by a
   * drag / retarget).
   */
  tweenNodePositions(positions: Record<string, { x: number; y: number }>, duration: number): Promise<void> {
    const start = performance.now();
    const ids: string[] = [];
    for (const [id, to] of Object.entries(positions)) {
      const node = this.nodeLookup.get(id);
      if (!node) continue;
      const current = node.internals?.positionAbsolute ?? node.position;
      const from = { x: current.x, y: current.y };
      if (from.x === to.x && from.y === to.y) {
        this.positionTweens.delete(id);
        continue;
      }
      // Retarget: overwriting the entry restarts from the live position.
      this.positionTweens.set(id, { from, to: { x: to.x, y: to.y }, start, duration });
      ids.push(id);
    }
    if (ids.length === 0) {
      this.settleTweenWaiters();
      return Promise.resolve();
    }
    this.ensureTweenLoop();
    return new Promise((resolve) => {
      this.tweenWaiters.push({ ids: new Set(ids), resolve });
    });
  }

  /** Cancel one node's active tween (no-op when none). Used by drag. */
  cancelPositionTween(id: string): void {
    if (this.positionTweens.delete(id)) {
      this.settleTweenWaiters();
    }
  }

  private ensureTweenLoop(): void {
    if (this.tweenRafId !== null) return;
    const step = () => {
      const now = performance.now();
      const changes: NodeChange[] = [];
      const finished: string[] = [];
      for (const [id, entry] of this.positionTweens) {
        const { position, done } = sampleTween(entry, now);
        changes.push({ id, type: 'position', position });
        if (done) finished.push(id);
      }
      for (const id of finished) this.positionTweens.delete(id);
      if (changes.length > 0) {
        this.triggerNodeChanges(changes as NodeChange<NodeType>[]);
      }
      this.settleTweenWaiters();
      this.tweenRafId = this.positionTweens.size > 0 ? requestAnimationFrame(step) : null;
    };
    this.tweenRafId = requestAnimationFrame(step);
  }

  private settleTweenWaiters(): void {
    if (this.tweenWaiters.length === 0) return;
    this.tweenWaiters = this.tweenWaiters.filter((w) => {
      for (const id of w.ids) {
        if (this.positionTweens.has(id)) return true;
      }
      w.resolve();
      return false;
    });
  }

  ngOnDestroy(): void {
    if (this.tweenRafId !== null) {
      cancelAnimationFrame(this.tweenRafId);
      this.tweenRafId = null;
    }
    this.positionTweens.clear();
    this.settleTweenWaiters();
  }
```

If the class does not already declare `implements OnDestroy`, add it (`import { ..., OnDestroy } from '@angular/core';`). If an `ngOnDestroy` already exists, merge the body into it instead.

Wire drag-cancel into `updateNodePositions` (line 372) — at the top of its `for` loop body, before building the change:

```ts
    for (const [id, dragItem] of nodeDragItems) {
      // A user drag takes ownership of the node — kill any in-flight tween.
      if (this.positionTweens.size > 0) this.cancelPositionTween(id);
```

- [ ] **Step 4: Run the store suite**

Run: `npx vitest run src/lib/services/flow-store.service.spec.ts`
Expected: PASS (new + all pre-existing).

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts
git commit -m "feat(angular): animate signal and rAF position tweening in FlowStore"
```

---

### Task 5: `NgFlowService.setNodePositions` + `applyLayout`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (after `updateNodeData`, ~line 240)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `ng-flow.service.spec.ts`, following the file's existing TestBed setup pattern (if the file instantiates differently, mirror whatever its other describe blocks do — the service needs a `FlowStore` provider):

```ts
describe('setNodePositions / applyLayout', () => {
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

  it('setNodePositions applies positions immediately when animation is off', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    await service.setNodePositions({ a: { x: 10, y: 20 }, b: { x: 30, y: 40 } });
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 10, y: 20 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 30, y: 40 });
  });

  it('setNodePositions skips unknown ids without throwing', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    await service.setNodePositions({ a: { x: 1, y: 1 }, ghost: { x: 9, y: 9 } });
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 1, y: 1 });
  });

  it('setNodePositions routes through the tween when animation is requested', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    const tween = vi.spyOn(store, 'tweenNodePositions').mockResolvedValue();
    await service.setNodePositions({ a: { x: 100, y: 0 } }, { animate: { duration: 150 } });
    expect(tween).toHaveBeenCalledWith({ a: { x: 100, y: 0 } }, 150);
  });

  it('per-call animate:false overrides the global animate signal', async () => {
    store.animate.set(true);
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    const tween = vi.spyOn(store, 'tweenNodePositions');
    await service.setNodePositions({ a: { x: 5, y: 5 } }, { animate: false });
    expect(tween).not.toHaveBeenCalled();
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 5, y: 5 });
  });

  it('applyLayout feeds store nodes/edges to the fn and applies its result', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b' }]);
    const layoutFn = vi.fn().mockReturnValue({ a: { x: 0, y: 0 }, b: { x: 0, y: 120 } });
    await service.applyLayout(layoutFn, { direction: 'TB' });
    expect(layoutFn).toHaveBeenCalledOnce();
    const [nodesArg, edgesArg, optsArg] = layoutFn.mock.calls[0];
    expect(nodesArg.map((n: { id: string }) => n.id)).toEqual(['a', 'b']);
    expect(edgesArg).toHaveLength(1);
    expect(optsArg).toEqual({ direction: 'TB' });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 0, y: 120 });
  });

  it('applyLayout awaits async layout functions', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    await service.applyLayout(async () => ({ a: { x: 42, y: 42 } }));
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 42, y: 42 });
  });
});
```

Required imports if missing in the spec file: `TestBed` from `@angular/core/testing`, `provideZonelessChangeDetection` from `@angular/core`, `vi` from `vitest`, `FlowStore`, `NgFlowService`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — methods do not exist.

- [ ] **Step 3: Implement in `ng-flow.service.ts`**

Add import:

```ts
import { prefersReducedMotion } from '../utils/position-tween';
```

Add after `updateNodeData` (~line 240):

```ts
  /**
   * Move many nodes at once from a position map (e.g. the result of
   * `layoutNodes`). Unknown ids are skipped. Animation defaults to the flow's
   * `[animate]` input; pass `opts.animate` (true/false/{duration}) to override
   * per call. Resolves when positions are applied — after the tween when
   * animating, immediately otherwise.
   */
  setNodePositions(
    positions: Record<string, { x: number; y: number }>,
    opts?: { animate?: boolean | { duration?: number } },
  ): Promise<void> {
    const valid: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of Object.entries(positions)) {
      if (this.store.nodeLookup.has(id)) valid[id] = pos;
    }
    if (Object.keys(valid).length === 0) return Promise.resolve();

    const setting = opts?.animate ?? this.store.animate();
    const animated = (setting === true || (typeof setting === 'object' && setting !== null)) && !prefersReducedMotion();
    if (animated) {
      const duration =
        typeof setting === 'object' && setting !== null && setting.duration != null
          ? setting.duration
          : this.store.animationDuration();
      return this.store.tweenNodePositions(valid, duration);
    }

    const changes = Object.entries(valid).map(([id, position]) => ({
      id,
      type: 'position' as const,
      position,
    }));
    this.store.triggerNodeChanges(changes as NodeChange<NodeType>[]);
    return Promise.resolve();
  }

  /**
   * One-call auto-layout: reads the current nodes/edges, runs `layoutFn`
   * (e.g. `layoutNodes` from `@angflow/angular/layout` — passed in, not
   * imported, so dagre stays out of bundles that never lay out), and applies
   * the returned positions via {@link setNodePositions}.
   *
   * ```ts
   * import { layoutNodes } from '@angflow/angular/layout';
   * flow.applyLayout(layoutNodes, { direction: 'LR' });
   * ```
   *
   * Internal nodes (with `measured` dimensions) are passed to `layoutFn`.
   * `opts.animate` overrides the flow's `[animate]` input for this call; all
   * other `opts` keys are forwarded to `layoutFn`.
   */
  async applyLayout(
    layoutFn: (
      nodes: InternalNode<NodeType>[],
      edges: EdgeType[],
      opts?: Record<string, unknown>,
    ) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>,
    opts?: Record<string, unknown> & { animate?: boolean | { duration?: number } },
  ): Promise<void> {
    const { animate, ...layoutOpts } = opts ?? {};
    const nodes = this.getNodes().map(
      (n) => this.getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>),
    );
    const positions = await layoutFn(nodes, this.getEdges(), layoutOpts);
    await this.setNodePositions(positions, animate === undefined ? undefined : { animate });
  }
```

(`InternalNode` and `NodeChange` are already imported in this file.)

- [ ] **Step 4: Run the service suite**

Run: `npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): NgFlowService.setNodePositions and applyLayout"
```

---

### Task 6: `edgeMode` + `animate` inputs on `<ng-flow>`

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`

No unit test — the spec files note that JIT can't compile signal-input template bindings under vitest; input→store sync effects follow the established untested pattern (lines 661–691). Coverage comes from typecheck + the example app.

- [ ] **Step 1: Add the inputs**

In the `// ── Appearance ──` section after `defaultMarkerColor` (~line 466), add:

```ts
  /**
   * 'handles' (default): edges attach at declared handles. 'floating': edges
   * ignore handles and attach where the line to the peer node's center crosses
   * the node border — no handle boilerplate needed. Nodes without handles
   * cannot originate interactive drag-connections; declared handles still work
   * for starting connections in floating mode.
   */
  readonly edgeMode = input<'handles' | 'floating'>('handles');

  /**
   * Enable node animations: entry fade/scale for newly added nodes and smooth
   * position tweening for programmatic moves (`setNodePositions`,
   * `applyLayout`, the agent bridge's `layout_nodes`). Pass `{ duration }` to
   * change the default 300ms. Disabled automatically under
   * `prefers-reduced-motion`. Dragging is never animated.
   */
  readonly animate = input<boolean | { duration?: number }>(false);
```

- [ ] **Step 2: Sync to the store**

In the constructor's configuration-sync effect (the block at lines 661–691 that ends with `this.store.onlyRenderVisibleElements.set(...)`), append:

```ts
      this.store.edgeMode.set(this.edgeMode());
      this.store.animate.set(this.animate());
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (in `packages/angular`)
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts
git commit -m "feat(angular): edgeMode and animate inputs on ng-flow"
```

---

### Task 7: node entry animation

**Files:**
- Modify: `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts`
- Modify: `packages/angular/src/lib/styles/ng-flow.css` (Nodes section, ~line 207)
- Test: `packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `node-renderer.component.spec.ts` (follow the file's existing TestBed pattern; the component is created via `TestBed.createComponent(NodeRendererComponent)`):

```ts
describe('entry animation tracking', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;
  let fixture: ComponentFixture<NodeRendererComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  const node = (id: string) => ({ id, data: {}, position: { x: 0, y: 0 } });

  it('does not mark the initial batch as entering', async () => {
    store.animate.set(true);
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable(); // flush effects
    expect(component.enteringNodeIds().size).toBe(0);
  });

  it('marks nodes added after the initial render as entering', async () => {
    store.animate.set(true);
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    expect(component.enteringNodeIds().has('b')).toBe(true);
    expect(component.enteringNodeIds().has('a')).toBe(false);
  });

  it('does nothing when animation is disabled', async () => {
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    expect(component.enteringNodeIds().size).toBe(0);
  });

  it('clears the entering flag when its enter animation ends', async () => {
    store.animate.set(true);
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    component.onNodeAnimationEnd({ animationName: 'xy-flow-node-enter' } as AnimationEvent, 'b');
    expect(component.enteringNodeIds().has('b')).toBe(false);
  });

  it('ignores animationend from other animations', async () => {
    store.animate.set(true);
    store.setNodes([node('a')]);
    await fixture.whenStable();
    store.setNodes([node('a'), node('b')]);
    await fixture.whenStable();
    component.onNodeAnimationEnd({ animationName: 'some-user-anim' } as AnimationEvent, 'b');
    expect(component.enteringNodeIds().has('b')).toBe(true);
  });
});
```

Required imports if missing: `ComponentFixture` from `@angular/core/testing`.

Note: `await fixture.whenStable()` flushes component effects under zoneless TestBed. If the effect provably hasn't run (first assertion fails with an empty prev-state), use `TestBed.tick()` after each `setNodes` call instead — do not weaken the assertions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/container/node-renderer/node-renderer.component.spec.ts`
Expected: FAIL — `enteringNodeIds` does not exist.

- [ ] **Step 3: Implement in `node-renderer.component.ts`**

Add `effect` and `signal` to the `@angular/core` import (line 1–15) if not present.

Add fields + constructor (the class currently has no constructor — add one after the field declarations, ~line 121):

```ts
  /** Ids of nodes currently playing their entry animation. */
  readonly enteringNodeIds = signal<ReadonlySet<string>>(new Set());
  private previousNodeIds: Set<string> | null = null;

  constructor() {
    // Entry-animation bookkeeping: diff node ids per render. The first
    // emission is the initial mount — never animated (no full-graph flash).
    effect(() => {
      const ids = new Set(this.store.nodes().map((n) => n.id));
      const prev = this.previousNodeIds;
      this.previousNodeIds = ids;
      if (prev === null || !this.store.animationEnabled()) {
        if (this.enteringNodeIds().size > 0) this.enteringNodeIds.set(new Set());
        return;
      }
      const fresh: string[] = [];
      for (const id of ids) {
        if (!prev.has(id)) fresh.push(id);
      }
      // Prune entries for removed nodes; add the newcomers.
      const current = this.enteringNodeIds();
      const stale = [...current].filter((id) => !ids.has(id));
      if (fresh.length === 0 && stale.length === 0) return;
      const next = new Set([...current].filter((id) => ids.has(id)));
      for (const id of fresh) next.add(id);
      this.enteringNodeIds.set(next);
    });
  }

  onNodeAnimationEnd(event: AnimationEvent, id: string): void {
    // Only the library's enter keyframe — user animations on node content
    // bubble the same event.
    if (event.animationName !== 'xy-flow-node-enter') return;
    if (!this.enteringNodeIds().has(id)) return;
    this.enteringNodeIds.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }
```

In the template's node `<div>` (after the `[style.transform]` binding, line 68), add:

```html
        [class.xy-flow__node-enter]="enteringNodeIds().has(node.id)"
        [style.animation-duration]="enteringNodeIds().has(node.id) ? store.animationDuration() + 'ms' : null"
        (animationend)="onNodeAnimationEnd($event, node.id)"
```

- [ ] **Step 4: Add the CSS**

In `packages/angular/src/lib/styles/ng-flow.css`, after the `.xy-flow__node.selectable.selected, ...` rule (~line 207), add:

```css
/* Entry animation — applied by the node renderer when [animate] is enabled.
   Uses the standalone `scale` property so it composes with the inline
   translate() transform instead of overriding it. */
.xy-flow__node-enter {
  animation: xy-flow-node-enter 300ms ease both;
  transform-origin: 50% 50%;
}
@keyframes xy-flow-node-enter {
  from { opacity: 0; scale: 0.92; }
  to   { opacity: 1; scale: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .xy-flow__node-enter { animation: none; }
}
```

- [ ] **Step 5: Run the node-renderer suite**

Run: `npx vitest run src/lib/container/node-renderer/node-renderer.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/container/node-renderer/node-renderer.component.ts packages/angular/src/lib/styles/ng-flow.css packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts
git commit -m "feat(angular): node entry animation behind the animate input"
```

---

### Task 8: agent bridge `layout_nodes` routes through `setNodePositions`

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts:919-926`
- Modify: `packages/angular/AGENT_BRIDGE.md` (layout_nodes tool section)

No schema change — `AGENT_TOOL_SCHEMAS` and the `@angflow/mcp` snapshot are untouched.

- [ ] **Step 1: Replace the apply loop**

In `agent-bridge.service.ts`, replace lines 916–926:

```ts
      // Re-check existence at apply time: the graph may have changed while the
      // (possibly async) layout fn ran — e.g. a human deleted a node. Only
      // nodes that still exist are moved, reported, and counted for history.
      const actuallyApplied: Record<string, { x: number; y: number }> = {};
      flow.batch(() => {
        for (const [id, position] of Object.entries(applied)) {
          if (!flow.getNode(id)) continue;
          flow.updateNode(id, { position });
          actuallyApplied[id] = position;
        }
      });
```

with:

```ts
      // Re-check existence at apply time: the graph may have changed while the
      // (possibly async) layout fn ran — e.g. a human deleted a node. Only
      // nodes that still exist are moved, reported, and counted for history.
      const actuallyApplied: Record<string, { x: number; y: number }> = {};
      for (const [id, position] of Object.entries(applied)) {
        if (!flow.getNode(id)) continue;
        actuallyApplied[id] = position;
      }
      // Honors the host's [animate] input: positions tween when it's on, and
      // the await keeps the subsequent fitView measuring settled positions.
      await flow.setNodePositions(actuallyApplied);
```

- [ ] **Step 2: Run the bridge suite**

Run: `npx vitest run src/lib/agent/agent-bridge.spec.ts`
Expected: PASS — the layout_nodes tests assert final positions, which are identical (tween only runs when a host sets `animate`, which the specs don't).

- [ ] **Step 3: Update `AGENT_BRIDGE.md`**

In the `layout_nodes` tool documentation, append this sentence to the behavior description (params/return/error text unchanged):

> When the host enables `[animate]` on `<ng-flow>`, applied positions tween smoothly (default 300 ms) instead of jumping; the tool response is sent after the transition settles, and `fitView` measures the final positions.

- [ ] **Step 4: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/AGENT_BRIDGE.md
git commit -m "feat(agent): layout_nodes honors the animate input via setNodePositions"
```

---

### Task 9: README documentation

**Files:**
- Modify: `packages/angular/README.md`

- [ ] **Step 1: Add three docs sections**

After the `## Programmatic API` section, add:

````markdown
## Floating Edges

Set `edgeMode="floating"` and edges attach wherever the line to the peer node's
center crosses each node's border — no handle declarations needed:

```html
<ng-flow [nodes]="nodes" [edges]="edges" edgeMode="floating" />
```

Works with nodes that declare zero handles, which makes it ideal for
programmatic / agent-driven graphs. Note: a node with no handles cannot
originate an interactive drag-connection — declared handles still work for
starting connections while rendering stays floating. For per-edge control in
the default mode, set `floating` on individual handles instead:
`<ng-flow-handle type="source" [floating]="true" />`.

## Auto-Layout

`layoutNodes` is a pure dagre wrapper — feed it your nodes and edges, get back
a map of top-left positions:

```ts
import { layoutNodes } from '@angflow/angular/layout'; // needs @dagrejs/dagre installed

const positions = layoutNodes(flow.getNodes(), flow.getEdges(), { direction: 'LR' });
flow.setNodePositions(positions);

// or in one call:
flow.applyLayout(layoutNodes, { direction: 'LR' });
```

Options: `direction` (`'TB' | 'LR' | 'BT' | 'RL'`, default `'TB'`), `nodeSep`
(default 50), `rankSep` (default 80). Node dimensions resolve from
`measured` → `width`/`height` → 150×40. Any function with the same shape plugs
into `applyLayout` (elk, custom grids, …).

## Animations

Turn on `[animate]` and the flow animates node entries (fade + scale) and
programmatic position changes (smooth tween, edges tracking mid-flight):

```html
<ng-flow [nodes]="nodes" [edges]="edges" [animate]="true" />
<!-- or tune the duration: -->
<ng-flow [animate]="{ duration: 200 }" />
```

Animated paths: `setNodePositions`, `applyLayout`, and the agent bridge's
`layout_nodes` tool. Dragging is never animated, a drag cancels any in-flight
tween on that node, and everything is disabled under `prefers-reduced-motion`.
Per-call override: `flow.setNodePositions(positions, { animate: false })`.
````

- [ ] **Step 2: Commit**

```bash
git add packages/angular/README.md
git commit -m "docs(angular): floating edges, auto-layout, and animation sections"
```

---

### Task 10: example app demo

**Files:**
- Create: `examples/angular/src/app/examples/floating-tidy/floating-tidy.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

`@dagrejs/dagre` is already in `examples/angular/package.json` (`^3.0.0`).

- [ ] **Step 1: Create the demo component**

Create `examples/angular/src/app/examples/floating-tidy/floating-tidy.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, viewChild } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  PanelComponent,
  BackgroundComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, NodeChange, EdgeChange } from '@angflow/angular';
import { layoutNodes } from '@angflow/angular/layout';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const INITIAL_NODES: Node[] = [
  { id: 'root', type: 'input', data: { label: 'goal' }, position: { x: 250, y: 0 } },
  { id: 'a', data: { label: 'idea a' }, position: { x: 60, y: 140 } },
  { id: 'b', data: { label: 'idea b' }, position: { x: 250, y: 140 } },
  { id: 'c', data: { label: 'idea c' }, position: { x: 440, y: 140 } },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e-root-a', source: 'root', target: 'a' },
  { id: 'e-root-b', source: 'root', target: 'b' },
  { id: 'e-root-c', source: 'root', target: 'c' },
];

@Component({
  selector: 'app-floating-tidy-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ControlsComponent, PanelComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Floating mode + tidy"
      description="edgeMode='floating' attaches edges by geometry (no handles), applyLayout(layoutNodes) tidies the graph, and [animate] tweens nodes (with edges tracking) plus fades new nodes in."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        edgeMode="floating"
        [animate]="animate"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="ft-panel">
            <button (click)="addNode()">add node</button>
            <button (click)="tidy('TB')">tidy ↓</button>
            <button (click)="tidy('LR')">tidy →</button>
            <label><input type="checkbox" [checked]="animate" (change)="toggleAnimate()" /> animate</label>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .ft-panel { display: flex; flex-direction: column; gap: 4px; }
    .ft-panel button, .ft-panel label {
      padding: 4px 10px; font-size: 12px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class FloatingTidyExampleComponent {
  private readonly flow = viewChild.required(NgFlowComponent);

  nodes: Node[] = [...INITIAL_NODES];
  edges: Edge[] = [...INITIAL_EDGES];
  animate = true;
  private counter = 0;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }

  addNode(): void {
    const parent = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    const id = `n${++this.counter}`;
    this.nodes = [
      ...this.nodes,
      { id, data: { label: `idea ${id}` }, position: { x: parent.position.x + 40, y: parent.position.y + 90 } },
    ];
    this.edges = [...this.edges, { id: `e-${parent.id}-${id}`, source: parent.id, target: id }];
  }

  tidy(direction: 'TB' | 'LR'): void {
    this.flow().service.applyLayout(layoutNodes, { direction });
  }

  toggleAnimate(): void { this.animate = !this.animate; }
}
```

- [ ] **Step 2: Register the route**

In `examples/angular/src/app/app.routes.ts`, add the import next to the other example imports:

```ts
import { FloatingTidyExampleComponent } from './examples/floating-tidy/floating-tidy.component';
```

and add to `HARNESS_ROUTES` (next to the existing 'Floating edges' entry):

```ts
  { name: 'Floating mode + tidy',  path: 'floating-tidy',  component: FloatingTidyExampleComponent },
```

- [ ] **Step 3: Build packages and the example**

```bash
# from repo root
pnpm -F @angflow/angular build
pnpm -F angular-examples build
```

Expected: both build clean.

- [ ] **Step 4: Manual smoke test**

```bash
cd examples/angular && npm run dev
```

Open the "Floating mode + tidy" example and verify: (1) edges attach by geometry with no handles, (2) "add node" fades the new node in, (3) "tidy" glides nodes with edges attached mid-flight, (4) dragging a node mid-tween stops its tween, (5) unchecking "animate" makes everything instant.

- [ ] **Step 5: Commit**

```bash
git add examples/angular/src/app/examples/floating-tidy examples/angular/src/app/app.routes.ts
git commit -m "feat(examples): floating mode + tidy + animate demo"
```

---

### Task 11: full verification

- [ ] **Step 1: Full test suite** — `cd packages/angular && npm run test` → all green.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → clean.
- [ ] **Step 3: Library build** — `npm run build` → clean (ngc + CSS bundle picks up the new keyframes).
- [ ] **Step 4: MCP drift check** — `cd ../../packages/mcp && npm run test` → green (no schema changes, snapshot untouched).
- [ ] **Step 5: Commit any stragglers**, then run the verification-before-completion checklist before claiming done.

---

### Task 12: close the feedback loop

**Files:**
- Modify: `C:\Users\shisu\CodeWeb\brainstorm_agentic_app\docs\angflow-feedback.md`

- [ ] **Step 1: Mark findings #1–#3 ✅** with the angflow commit hashes, and note the replacements: delete the 8-handle block + CSS in `web/src/app/canvas/idea-node.component.ts` and `web/src/app/canvas/tidy-layout.ts`, adopt `edgeMode="floating"`, `applyLayout(layoutNodes, …)`, and `[animate]` once the new version is published.
- [ ] **Step 2 (requires user go-ahead): publish** `@angflow/angular` as a **minor** bump (`npm version minor` → 0.1.0, `npm run build`, `npm publish --access public`; 2FA browser prompt). System and MCP packages unchanged.
