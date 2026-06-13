# Bridge fit/layout clamp signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface achieved zoom + a "couldn't frame everything" `clamped` flag from `fit_view`, `fit_bounds`, and `layout_nodes`, and let those bridge tools take a per-call `minZoom` override.

**Architecture:** The system util `fitViewport` already computes the clamped target viewport via `getViewportForBounds`; change it to return `{ zoom, clamped }` instead of `boolean`. Thread that result up through `FlowStore.fitView` → `NgFlowService.fitView`/`fitBounds` → the three bridge handlers. `clamped` means the fit hit the minimum-zoom floor (board too big to frame). Per-call `minZoom` for `fit_view` is already plumbed via `FitViewOptionsBase.minZoom`; the handlers just pass it.

**Tech Stack:** TypeScript, `@angflow/system` (rollup, vitest), `@angflow/angular` (ngc, vitest), `@angflow/mcp` (schema snapshot).

**Spec:** `docs/superpowers/specs/2026-06-13-bridge-fit-clamp-signal-design.md`

---

### Task 1: `@angflow/system` — `FitViewResult` type + `fitViewport` returns it

**Files:**
- Modify: `packages/system/src/types/general.ts` (add `FitViewResult` type after `FitViewOptionsBase`, ~line 176)
- Modify: `packages/system/src/utils/graph.ts` (add `ZOOM_CLAMP_EPSILON`; change `fitViewport` ~lines 357-388)
- Test: `packages/system/src/utils/graph.spec.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `packages/system/src/utils/graph.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fitViewport } from './graph';
import { adoptUserNodes } from './store';
import type { NodeBase, InternalNodeBase, NodeLookup, ParentLookup, PanZoomInstance } from '../types';

function buildLookup(nodes: NodeBase[]): NodeLookup<InternalNodeBase<NodeBase>> {
  const nodeLookup = new Map() as NodeLookup<InternalNodeBase<NodeBase>>;
  const parentLookup = new Map() as ParentLookup<InternalNodeBase<NodeBase>>;
  adoptUserNodes(nodes, nodeLookup, parentLookup);
  return nodeLookup;
}

// Records the viewport fitViewport asks for; setViewport resolves like the real panZoom.
const fakePanZoom = (): PanZoomInstance =>
  ({ setViewport: async () => true } as unknown as PanZoomInstance);

const sized = (id: string, x: number, y: number, w = 100, h = 50): NodeBase => ({
  id,
  position: { x, y },
  data: {},
  measured: { width: w, height: h },
});

describe('fitViewport', () => {
  it('returns clamped: true when the board is too big to fit at minZoom', async () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 100000, 0)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      { padding: 0.1 },
    );
    expect(result.clamped).toBe(true);
    expect(result.zoom).toBeCloseTo(0.5, 5);
  });

  it('returns clamped: false when the board fits inside [minZoom, maxZoom]', async () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 300, 200)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.1, maxZoom: 2 },
      { padding: 0.1 },
    );
    expect(result.clamped).toBe(false);
  });

  it('does not flag clamped when clamped at maxZoom (tiny board, over-zoom)', async () => {
    const nodes = buildLookup([sized('a', 0, 0, 10, 10)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      { padding: 0.1 },
    );
    expect(result.zoom).toBeCloseTo(2, 5);
    expect(result.clamped).toBe(false);
  });

  it('honors an options.minZoom override that loosens the floor', async () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 100000, 0)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      { padding: 0.1, minZoom: 0.0001 },
    );
    expect(result.clamped).toBe(false);
  });

  it('returns { zoom: NaN, clamped: false } when there are no nodes to fit', async () => {
    const nodes = new Map() as NodeLookup<InternalNodeBase<NodeBase>>;
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      {},
    );
    expect(Number.isNaN(result.zoom)).toBe(true);
    expect(result.clamped).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/system && npx vitest run src/utils/graph.spec.ts`
Expected: FAIL — `result.clamped` is undefined (fitViewport currently returns `boolean`).

- [ ] **Step 3: Add the `FitViewResult` type**

In `packages/system/src/types/general.ts`, immediately after the `FitViewOptionsBase` type (after line ~176):

```ts
/**
 * Result of a fit-to-content operation.
 */
export type FitViewResult = {
  /** Achieved zoom after the fit. NaN when there was nothing to fit (no nodes). */
  zoom: number;
  /** True when the fit hit the minimum-zoom floor — the content could not be fully framed. */
  clamped: boolean;
};
```

- [ ] **Step 4: Change `fitViewport` to return `FitViewResult`**

In `packages/system/src/utils/graph.ts`, add the epsilon constant just above `fitViewport` (after line ~355):

```ts
/** Tolerance for detecting that a fit's zoom was clamped to the minimum floor. */
const ZOOM_CLAMP_EPSILON = 1e-6;
```

Replace the `fitViewport` body (lines ~357-388) with:

```ts
export async function fitViewport<
  Params extends FitViewParamsBase<NodeBase>,
  Options extends FitViewOptionsBase<NodeBase>
>(
  { nodes, width, height, panZoom, minZoom, maxZoom }: Params,
  options?: Omit<Options, 'nodes' | 'includeHiddenNodes'>
): Promise<{ zoom: number; clamped: boolean }> {
  if (nodes.size === 0) {
    return { zoom: NaN, clamped: false };
  }

  const nodesToFit = getFitViewNodes(nodes, options);
  const bounds = getInternalNodesBounds(nodesToFit);

  const effMin = options?.minZoom ?? minZoom;
  const effMax = options?.maxZoom ?? maxZoom;

  const viewport = getViewportForBounds(bounds, width, height, effMin, effMax, options?.padding ?? 0.1);

  await panZoom.setViewport(viewport, {
    duration: options?.duration,
    ease: options?.ease,
    interpolate: options?.interpolate,
  });

  // getViewportForBounds clamps the ideal zoom to >= effMin, so zoom landing at
  // the floor means the ideal zoom was below it — the content couldn't be framed.
  return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + ZOOM_CLAMP_EPSILON };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/system && npx vitest run src/utils/graph.spec.ts`
Expected: PASS (all 5).

- [ ] **Step 6: Typecheck the system package**

Run: `cd packages/system && npx tsc --noEmit`
Expected: no errors. (`FitViewResult` is exported via `export * from './types'` → `general.ts`.)

- [ ] **Step 7: Commit**

```bash
git add packages/system/src/types/general.ts packages/system/src/utils/graph.ts packages/system/src/utils/graph.spec.ts
git commit -m "feat(system): fitViewport returns { zoom, clamped }"
```

---

### Task 2: `@angflow/angular` — `FlowStore.fitView` / `NgFlowService.fitView` return the result; re-export `FitViewResult`

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`fitView`, ~lines 803-820)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`fitView`, ~lines 109-111)
- Modify: `packages/angular/src/lib/public-api.ts` (add `FitViewResult` to the `@angflow/system` type re-export block)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts` (add a focused store-return test — see Step 1)

- [ ] **Step 1: Write the failing test**

The bridge spec's harness (`setup()` → `newFlow()`) creates flows with **no panZoom**, so `fitView` short-circuits to `{ zoom: NaN, clamped: false }`. Bridge tests therefore assert **shape only** — clamp-value correctness is proven at the system layer in Task 1.

In `packages/angular/src/lib/agent/agent-bridge.spec.ts`, add a new describe block near the other viewport-tool tests (after the `layout_nodes` block is fine):

```ts
describe('fit clamp signal', () => {
  it('fit_view returns { zoom, clamped }', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a'), makeNode('b')]);
    const res = (await bridge.callTool('fit_view', {})) as { zoom: number; clamped: boolean };
    expect(res).toHaveProperty('zoom');
    expect(res).toHaveProperty('clamped');
    expect(typeof res.clamped).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "fit_view returns"`
Expected: FAIL — `fitView` still returns a boolean, so the result has no `zoom`/`clamped` keys.

> NOTE: The existing `fit_view` handler already does `return flow.fitView({...})`, so once Steps 3-4 make the service return the object, this test passes — no handler change is needed for the shape. Task 4 only adds `minZoom` validation + threading.

- [ ] **Step 3: Change `FlowStore.fitView` to return the result**

In `packages/angular/src/lib/services/flow-store.service.ts`, replace the `fitView` method (~lines 803-820):

```ts
  async fitView(options?: FitViewOptionsBase<NodeType>): Promise<{ zoom: number; clamped: boolean }> {
    const pz = this.panZoom();
    if (!pz) return { zoom: NaN, clamped: false };

    return fitViewport(
      {
        nodes: this.nodeLookup,
        width: this.width(),
        height: this.height(),
        panZoom: pz,
        minZoom: this.minZoom(),
        maxZoom: this.maxZoom(),
      },
      options
    );
  }
```

- [ ] **Step 4: Change `NgFlowService.fitView` return type**

In `packages/angular/src/lib/services/ng-flow.service.ts`, update the `fitView` method (~lines 109-111) — add `FitViewResult` to the imports from `@angflow/system` at the top of the file, and change the signature:

```ts
  /** Fit the viewport to the given nodes (all nodes if omitted). Returns the achieved zoom and whether it was clamped at the min-zoom floor. */
  fitView(options?: FitViewOptionsBase<NodeType>): Promise<FitViewResult> {
    return this.store.fitView(options);
  }
```

(If `FitViewOptionsBase` is already imported, add `FitViewResult` to the same import; otherwise add `import type { FitViewResult } from '@angflow/system';`.)

- [ ] **Step 5: Re-export `FitViewResult` from the public API**

In `packages/angular/src/lib/public-api.ts`, inside the `export type { ... } from '@angflow/system';` block (the one starting `// Re-export all types from @angflow/system`), add under the `// Options` group:

```ts
  FitViewResult,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "fit_view returns"`
Expected: PASS — `fitView` now returns `{ zoom: NaN, clamped: false }` (no panZoom in the harness) and the existing handler forwards it.

- [ ] **Step 7: Typecheck the angular package**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors. (Existing `fitView` callers — `controls.component.ts`, `<ng-flow>` init — ignore the return value, so the richer return type does not break them.)

- [ ] **Step 8: Commit**

```bash
git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/public-api.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(angular): fitView returns FitViewResult; re-export type"
```

---

### Task 3: `@angflow/angular` — `NgFlowService.fitBounds` gains `minZoom`/`maxZoom` and returns `FitViewResult`

This task is pure service plumbing — the `fit_bounds` *handler* test lives with the handler change in Task 5 (test-first there). Verify here by typecheck.

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`fitBounds` ~lines 134-141; `getViewportForBoundsInternal` ~lines 1047-1056)

- [ ] **Step 1: Extend `getViewportForBoundsInternal` to accept effective min/max**

In `packages/angular/src/lib/services/ng-flow.service.ts`, replace `getViewportForBoundsInternal` (~lines 1047-1056):

```ts
  private getViewportForBoundsInternal(
    bounds: Rect,
    padding: number,
    minZoom = this.store.minZoom(),
    maxZoom = this.store.maxZoom(),
  ) {
    return getViewportForBounds(
      bounds,
      this.store.width(),
      this.store.height(),
      minZoom,
      maxZoom,
      padding
    );
  }
```

- [ ] **Step 2: Change `fitBounds` to take min/max and return the result**

Replace `fitBounds` (~lines 134-141):

```ts
  async fitBounds(
    bounds: Rect,
    options?: { padding?: number; duration?: number; minZoom?: number; maxZoom?: number },
  ): Promise<FitViewResult> {
    const pz = this.store.panZoom();
    if (!pz) return { zoom: NaN, clamped: false };

    const effMin = options?.minZoom ?? this.store.minZoom();
    const effMax = options?.maxZoom ?? this.store.maxZoom();
    const viewport = this.getViewportForBoundsInternal(bounds, options?.padding ?? 0.1, effMin, effMax);
    await pz.setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom }, { duration: options?.duration });
    return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + 1e-6 };
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no type errors. (`fitBounds`'s only caller is the `fit_bounds` handler, updated in Task 5; the richer return type and new opts are backward compatible.)

- [ ] **Step 4: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts
git commit -m "feat(angular): fitBounds takes minZoom/maxZoom, returns FitViewResult"
```

---

### Task 4: Bridge — `fit_view` handler accepts `minZoom` and returns the result

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`fit_view` handler ~lines 552-563; add `optionalPositiveNumber` helper near the other param helpers ~line 1212)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing test**

In the `fit clamp signal` describe block, add:

```ts
it('fit_view rejects a non-positive minZoom with -32602', async () => {
  const { bridge, newFlow } = setup();
  bridge.register('main', newFlow());
  await expect(bridge.callTool('fit_view', { minZoom: 0 })).rejects.toMatchObject({ code: -32602 });
  await expect(bridge.callTool('fit_view', { minZoom: -1 })).rejects.toMatchObject({ code: -32602 });
  await expect(bridge.callTool('fit_view', { minZoom: 'big' })).rejects.toMatchObject({ code: -32602 });
});

it('fit_view threads minZoom to the service and captures no history', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([makeNode('a')]);
  const spy = vi.spyOn(flow, 'fitView');
  await bridge.callTool('fit_view', { minZoom: 0.3 });
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ minZoom: 0.3 }));
  const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
  expect(status.pastDepth).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "fit_view"`
Expected: the `rejects … -32602` and `threads minZoom` tests FAIL (no validation / minZoom not passed yet); the `fit_view returns` test from Task 2 also goes green once this handler change lands.

- [ ] **Step 3: Add the `optionalPositiveNumber` helper**

In `packages/angular/src/lib/agent/agent-bridge.service.ts`, after `optionalStringArray` (~line 1224):

```ts
function optionalPositiveNumber(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new InvalidParamsError(`Param "${key}" must be a finite number greater than 0.`);
  }
  return value;
}
```

- [ ] **Step 4: Update the `fit_view` handler**

Replace the `fit_view` handler (~lines 552-563):

```ts
    this.handlers.set('fit_view', (flow, params) => {
      const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      const minZoom = optionalPositiveNumber(params, 'minZoom');
      const nodeIds = optionalStringArray(params, 'nodeIds');
      const nodes = nodeIds
        ? nodeIds
            .map((id) => flow.getNode(id))
            .filter((n): n is Node => !!n)
            .map((n) => ({ id: n.id }))
        : undefined;
      return flow.fitView({ padding, duration, minZoom, nodes });
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "fit_view"`
Expected: PASS — including the `fit_view returns { zoom, clamped }` test from Task 2.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): fit_view accepts minZoom, returns { zoom, clamped }"
```

---

### Task 5: Bridge — `fit_bounds` handler accepts `minZoom` and returns the result

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`fit_bounds` handler ~lines 694-699)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing test**

Clamp values can't be asserted at the bridge layer (no panZoom), so verify shape + that the handler threads `minZoom` into the service via a spy. In the `fit clamp signal` describe block (created in Task 2), add:

```ts
it('fit_bounds returns { zoom, clamped } and threads minZoom to the service', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  const spy = vi.spyOn(flow, 'fitBounds');
  const res = (await bridge.callTool('fit_bounds', {
    bounds: { x: 0, y: 0, width: 200, height: 100 },
    minZoom: 0.2,
  })) as { zoom: number; clamped: boolean };
  expect(res).toHaveProperty('zoom');
  expect(typeof res.clamped).toBe('boolean');
  expect(spy).toHaveBeenCalledWith(
    { x: 0, y: 0, width: 200, height: 100 },
    expect.objectContaining({ minZoom: 0.2 }),
  );
});

it('fit_bounds rejects a non-positive minZoom with -32602', async () => {
  const { bridge, newFlow } = setup();
  bridge.register('main', newFlow());
  await expect(
    bridge.callTool('fit_bounds', { bounds: { x: 0, y: 0, width: 10, height: 10 }, minZoom: 0 }),
  ).rejects.toMatchObject({ code: -32602 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "fit_bounds"`
Expected: FAIL — the handler neither parses nor forwards `minZoom`.

- [ ] **Step 3: Update the `fit_bounds` handler**

Replace the `fit_bounds` handler (~lines 694-699):

```ts
    this.handlers.set('fit_bounds', (flow, params) => {
      const bounds = requireObject(params, 'bounds') as { x: number; y: number; width: number; height: number };
      const padding = typeof params['padding'] === 'number' ? (params['padding'] as number) : undefined;
      const duration = typeof params['duration'] === 'number' ? (params['duration'] as number) : undefined;
      const minZoom = optionalPositiveNumber(params, 'minZoom');
      return flow.fitBounds(bounds, { padding, duration, minZoom });
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "fit_bounds"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): fit_bounds accepts minZoom, returns { zoom, clamped }"
```

---

### Task 6: Bridge — `layout_nodes` accepts `minZoom` and returns `{ positions, fit }`

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`layout_nodes` handler ~lines 896-1003)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing test**

In `agent-bridge.spec.ts`, inside the existing `describe('layout_nodes', ...)` block (line ~934, which defines `fakeLayout` and uses `setupWithLayout`), add these tests (a flow with no panZoom still returns a non-null fit object — `{ zoom: NaN, clamped: false }` — when the fit path runs):

```ts
it('returns a fit result when fitView is on', async () => {
  const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
  const flow = nf();
  b.register('main', flow);
  flow.setNodes([makeNode('a'), makeNode('b')]);
  const res = (await b.callTool('layout_nodes', {})) as {
    positions: Record<string, { x: number; y: number }>;
    fit: { zoom: number; clamped: boolean } | null;
  };
  expect(res.positions).toBeDefined();
  expect(res.fit).not.toBeNull();
  expect(res.fit).toHaveProperty('clamped');
});

it('returns fit: null when fitView is false', async () => {
  const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
  const flow = nf();
  b.register('main', flow);
  flow.setNodes([makeNode('a')]);
  const res = (await b.callTool('layout_nodes', { fitView: false })) as { fit: unknown };
  expect(res.fit).toBeNull();
});

it('threads minZoom into the post-layout fit', async () => {
  const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
  const flow = nf();
  b.register('main', flow);
  flow.setNodes([makeNode('a')]);
  const spy = vi.spyOn(flow, 'fitView');
  await b.callTool('layout_nodes', { minZoom: 0.25 });
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ minZoom: 0.25 }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "layout_nodes returns"`
Expected: FAIL — handler returns `{ positions }` only (no `fit` key).

- [ ] **Step 3: Update the `layout_nodes` handler**

In the `layout_nodes` handler, parse `minZoom` near the other param reads (after the `rankSep` line, ~line 908):

```ts
      const minZoom = optionalPositiveNumber(params, 'minZoom');
```

Then replace the fit-and-return tail (the `const shouldFit = ...` block through `return { positions: actuallyApplied };`, ~lines 992-1002) with:

```ts
      const shouldFit = params['fitView'] !== false;
      let fit: { zoom: number; clamped: boolean } | null = null;
      if (shouldFit && Object.keys(actuallyApplied).length > 0) {
        try {
          fit = await flow.fitView({ minZoom });
        } catch (err) {
          // Best-effort viewport fit: never fail the tool over a cosmetic step,
          // but surface the error to hosts observing onError.
          this.reportError(err, { kind: 'dispatch', method: 'layout_nodes' });
        }
      }
      return { positions: actuallyApplied, fit };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "layout_nodes"`
Expected: PASS (new tests + existing layout_nodes tests still green — `positions` key unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): layout_nodes accepts minZoom, returns { positions, fit }"
```

---

### Task 7: Tool schemas + AGENT_BRIDGE.md + MCP snapshot

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (`fit_view` ~line 196, `fit_bounds` ~line 471, `layout_nodes` ~line 768)
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Modify: `packages/mcp/...` snapshot (regenerated, not hand-edited)

- [ ] **Step 1: Add `minZoom` to the three tool schemas**

In `packages/angular/src/lib/agent/tool-schemas.ts`:

For `fit_view` (properties block ~lines 200-205), add after `nodeIds`:

```ts
        minZoom: { type: 'number', description: 'Per-call min-zoom floor for this fit (overrides host minZoom). Returns { zoom, clamped } where clamped means the board could not be fully framed.' },
```

For `fit_bounds` (properties block ~lines 476-489), add after `duration`:

```ts
        minZoom: { type: 'number', description: 'Per-call min-zoom floor for this fit (overrides host minZoom). Returns { zoom, clamped }.' },
```

For `layout_nodes` (properties block ~lines 780-793), add after `fitView`:

```ts
        minZoom: { type: 'number', description: 'Per-call min-zoom floor used for the post-layout fit. The result includes fit: { zoom, clamped } | null (null when fitView is false).' },
```

Also update the `layout_nodes` description string (~lines 769-776): change "Returns the applied positions." to "Returns the applied positions plus a fit result ({ zoom, clamped } or null)."

- [ ] **Step 2: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Update `AGENT_BRIDGE.md`**

In `packages/angular/AGENT_BRIDGE.md`, update the **Viewport / camera** table rows:

- `fit_view` row: params `nodeIds?, padding?, duration?, minZoom?`; Notes: "Animates to fit the given nodes (all if omitted). Returns `{ zoom, clamped }` — `clamped` is true when the fit hit the min-zoom floor (board too big to frame)."
- `fit_bounds` row: params add `minZoom?`; Notes add "Returns `{ zoom, clamped }`."

In the **Layout** table, update the `layout_nodes` Returns column to `{ positions: Record<nodeId, { x; y }>, fit: { zoom, clamped } | null }` and add a sentence to the paragraph below: "The optional `minZoom` param sets the floor for the post-layout fit; `fit` is the fit result (`null` when `fitView` is false). `clamped` indicates the board could not be fully framed."

Add a short note (e.g. under the Viewport section): "**`FitViewResult`** — `{ zoom: number; clamped: boolean }`. `zoom` is the achieved zoom (`null`/NaN when there was nothing to fit); `clamped` is true only when the fit was limited by the minimum zoom, i.e. the content is larger than the viewport can show — a signal to split into regions or use `set_center`."

- [ ] **Step 4: Regenerate the MCP schema snapshot**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp run generate:schemas`
Expected: the snapshot file under `packages/mcp/` updates with the three new `minZoom` properties.

- [ ] **Step 5: Run the MCP drift test**

Run: `pnpm -F @angflow/mcp run test`
Expected: PASS (schema-drift test green against the regenerated snapshot).

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/AGENT_BRIDGE.md packages/mcp
git commit -m "docs(agent): schemas + AGENT_BRIDGE for fit clamp signal; regen mcp snapshot"
```

---

### Task 8: Full verification across packages

**Files:** none (verification only)

- [ ] **Step 1: Build system → angular → mcp**

Run: `pnpm -F @angflow/system build && pnpm -F @angflow/angular build && pnpm -F @angflow/mcp build`
Expected: all three build clean.

- [ ] **Step 2: Run the full test suites**

Run: `pnpm -F @angflow/system test && pnpm -F @angflow/angular test && pnpm -F @angflow/mcp test`
Expected: all green.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm -F @angflow/angular exec tsc --noEmit && pnpm lint`
Expected: no errors. (Mirrors CI: build system→angular→mcp, typecheck, lint, vitest.)

- [ ] **Step 4: Mark the feedback entry**

In `C:/Users/shisu/CodeWeb/brainstorm_agentic_app/docs/angflow-feedback.md`, change entry #18's heading marker from `⚠️`/`⛳` style to `✅` and append a `**✅ Fixed in angflow**` bullet noting: `fit_view`/`fit_bounds`/`layout_nodes` now accept a per-call `minZoom` and return `{ zoom, clamped }` (`layout_nodes` as a `fit` field); shipped in the next `@angflow/system` + `@angflow/angular` + `@angflow/mcp` patch. Reference the commit/PR.

- [ ] **Step 5: Commit the feedback update**

```bash
git add ../brainstorm_agentic_app/docs/angflow-feedback.md
git commit -m "docs: mark angflow feedback #18 fixed (fit clamp signal)"
```

> NOTE: the feedback file is in a separate working directory (`brainstorm_agentic_app`), which may be its own git repo. If `git add` fails because it's outside this repo, commit it from that repo's root instead. Confirm with the user before committing in the other repo.

---

## Publish (manual — requires npm 2FA, do with the user)

Per `CLAUDE.md`: bump + publish in order. Do NOT run unprompted — npm 2FA prompts for browser approval.

1. `packages/system`: `npm version patch && npm run build && npm publish --access public`
2. `packages/angular`: `npm version patch && npm run build && pnpm publish --access public` (pnpm rewrites `workspace:^`)
3. `packages/mcp`: `npm version patch && npm run build && npm publish --access public`

## Notes for the implementer

- **Spec self-review coverage:** `FitViewResult` (Task 1), system `fitViewport` (Task 1), store/service `fitView` (Task 2), `fitBounds` + per-call minZoom (Task 3), `fit_view`/`fit_bounds`/`layout_nodes` handlers (Tasks 4-6), validation helper (Task 4), schemas + AGENT_BRIDGE.md + mcp snapshot (Task 7), out-of-scope tools untouched (no tasks add them).
- **Cross-task test timing:** the `fit_view returns` test is added in Task 2 and goes green within Task 2 (the existing handler already forwards `flow.fitView(...)`, so only the service return type matters). `fit_bounds` and `layout_nodes` tests are added test-first in the same task as their handler change (Tasks 5 and 6). No test is left committed RED.
- **Test harness:** the bridge spec uses `setup()` → `{ bridge, newFlow }` (no layout fn) and `setupWithLayout(layout)` → `{ bridge, newFlow }`. `newFlow()` builds a flow via a child `Injector` with `FlowStore`/`NgFlowService` — it has **no panZoom**, so `fitView`/`fitBounds` short-circuit to `{ zoom: NaN, clamped: false }`. That is why bridge tests assert shape + validation + minZoom-threading (via `vi.spyOn(flow, 'fitView' | 'fitBounds')`), and clamp-value correctness is proven only in the system test (Task 1). Reuse `makeNode(id, overrides?)` (already defined at the top of the spec).
