# Floating Edges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship floating edges as a first-class feature via a per-handle `floating` input on `HandleComponent`, with ray-rect intersection for edge endpoints and a whole-node drop fallback during connection drag. Rebuild the existing floating-edges example on the new API.

**Architecture:** The feature spans three layers. (1) `@angflow/system` gains pure math helpers (`getFloatingEndpoint`, `inferSide`), a new drop-target helper (`getFloatingDropTarget`), and an optional `floating?: boolean` field on the `Handle` type. The DOM measurement function `getHandleBounds` reads a new `data-floating` attribute from handle elements. (2) `@angflow/angular` `HandleComponent` adds a `floating` signal input that toggles the DOM attribute. The edge renderer switches endpoint-computation strategy per endpoint based on `handle.floating`. A `connectionTargetNodeId` signal on `FlowStore` + a CSS state class provide hover feedback. (3) `examples/angular` rewrites the floating-edges example to demonstrate the new API with both a pure-floating node type and a mixed fixed-and-floating subexample.

**Tech Stack:** Angular 19+ (signals, OnPush), TypeScript 5.9, Vitest, `@angflow/system` (D3-based framework-agnostic core). Windows with bash — use forward-slash paths.

**Spec reference:** `docs/superpowers/specs/2026-04-19-floating-edges-design.md`.

---

## Branch

Work on `feat/floating-edges` (already created; the spec commit lives here).

```bash
git branch --show-current
# feat/floating-edges
```

---

## File Structure

**Files created:**

- `packages/system/src/utils/edges/floating.ts` — pure helpers `getFloatingEndpoint` and `inferSide`.
- `packages/system/src/utils/edges/floating.spec.ts` — unit tests for the above.
- `packages/system/src/xyhandle/utils.spec.ts` — unit tests for the new `getFloatingDropTarget` (and a small regression test for `getClosestHandle`).

**Files modified:**

- `packages/system/src/types/handles.ts` — add `floating?: boolean` to `Handle`.
- `packages/system/src/utils/edges/index.ts` — re-export the new helpers.
- `packages/system/src/index.ts` — re-export `getFloatingEndpoint` / `inferSide` from the public surface.
- `packages/system/src/utils/dom.ts` — `getHandleBounds` reads `data-floating` attribute.
- `packages/system/src/xyhandle/utils.ts` — add `getFloatingDropTarget` alongside `getClosestHandle`.
- `packages/system/src/xyhandle/XYHandle.ts` — call `getFloatingDropTarget` when `getClosestHandle` returns null.
- `packages/angular/src/lib/components/handle/handle.component.ts` — add `floating` input and `data-floating` host binding.
- `packages/angular/src/lib/components/handle/handle.component.spec.ts` — extend with one test covering the attribute.
- `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` — switch endpoint computation on `handle.floating`.
- `packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts` — extend with floating-endpoint test cases.
- `packages/angular/src/lib/services/flow-store.service.ts` — add `connectionTargetNodeId = signal<string | null>(null)`.
- `packages/angular/src/lib/styles/ng-flow.css` — add `.xy-flow__node.connection-target` state class styles.
- `packages/angular/src/lib/container/pane/pane.component.ts` or wherever nodes render — apply the state class from the FlowStore signal.
- `examples/angular/src/app/examples/floating-edges/floating-edges.component.ts` — full rewrite.

**Files deliberately not touched:**

- Any other example under `examples/angular/`.
- The React and Svelte packages — the `Handle` type change is additive (optional field), backward-compatible for them.
- `@angflow/system` export surface beyond the new helpers.

---

## Task 1: Add `floating` field to `Handle` type

**Goal:** Extend the `Handle` type in `@angflow/system` with an optional `floating?: boolean` field. Additive, non-breaking.

**Files:**
- Modify: `packages/system/src/types/handles.ts`

- [ ] **Step 1: Read the current type**

Run:
```bash
grep -n "export type Handle" packages/system/src/types/handles.ts
```

Expected: one match showing the current type at around line 8.

- [ ] **Step 2: Add the `floating` field**

Edit `packages/system/src/types/handles.ts`. Find the `Handle` type and add a `floating?: boolean` field after `data?: unknown`:

```typescript
export type Handle = {
  id?: string | null;
  nodeId: string;
  x: number;
  y: number;
  position: Position;
  type: HandleType;
  width: number;
  height: number;
  /** User-attached metadata (e.g. data type tag). Populated by the framework wrapper. */
  data?: unknown;
  /** If true, edges connected to this handle render endpoints as ray-rect intersections on the node border
   *  and the handle acts as a whole-node drop fallback during connection drag. */
  floating?: boolean;
};
```

- [ ] **Step 3: Typecheck across both packages**

```bash
cd packages/system && npm run build
cd ../angular && npx tsc --noEmit
```

Expected: both succeed. The optional field is non-breaking.

- [ ] **Step 4: Commit**

From repo root:
```bash
git add packages/system/src/types/handles.ts
git commit -m "feat(system): add optional floating flag to Handle type"
```

---

## Task 2: Add pure math helpers (`getFloatingEndpoint`, `inferSide`) with unit tests

**Goal:** Implement the ray-rect intersection and side-inference helpers as pure functions. TDD: write tests first, then implementation.

**Files:**
- Create: `packages/system/src/utils/edges/floating.ts`
- Create: `packages/system/src/utils/edges/floating.spec.ts`
- Modify: `packages/system/src/utils/edges/index.ts`
- Modify: `packages/system/src/index.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/system/src/utils/edges/floating.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getFloatingEndpoint, inferSide } from './floating';
import { Position } from '../../types/position';

const rect = { x: 0, y: 0, width: 100, height: 50 };

describe('getFloatingEndpoint', () => {
  it('returns east midpoint for reference point due east', () => {
    const p = getFloatingEndpoint(rect, { x: 500, y: 25 });
    expect(p).toEqual({ x: 100, y: 25 });
  });

  it('returns west midpoint for reference point due west', () => {
    const p = getFloatingEndpoint(rect, { x: -500, y: 25 });
    expect(p).toEqual({ x: 0, y: 25 });
  });

  it('returns south midpoint for reference point due south', () => {
    const p = getFloatingEndpoint(rect, { x: 50, y: 500 });
    expect(p).toEqual({ x: 50, y: 50 });
  });

  it('returns north midpoint for reference point due north', () => {
    const p = getFloatingEndpoint(rect, { x: 50, y: -500 });
    expect(p).toEqual({ x: 50, y: 0 });
  });

  it('returns center for reference point exactly at center (degenerate)', () => {
    const p = getFloatingEndpoint(rect, { x: 50, y: 25 });
    expect(p).toEqual({ x: 50, y: 25 });
  });

  it('picks the correct border for an off-center reference (tX > tY case)', () => {
    // Reference point far above — ray should hit top border first.
    const p = getFloatingEndpoint(rect, { x: 60, y: -1000 });
    expect(p.y).toBe(0);
    expect(p.x).toBeCloseTo(50 + (10 / 1025) * 50, 2); // cx + (dx/|dy|) * halfH
  });

  it('handles tall rectangles (halfW/halfH asymmetry)', () => {
    const tall = { x: 0, y: 0, width: 20, height: 200 };
    // Reference point to the right — should hit right border at (20, 100).
    const p = getFloatingEndpoint(tall, { x: 500, y: 100 });
    expect(p).toEqual({ x: 20, y: 100 });
  });
});

describe('inferSide', () => {
  it('returns Right for intersection on right border', () => {
    expect(inferSide({ x: 100, y: 25 }, rect)).toBe(Position.Right);
  });

  it('returns Left for intersection on left border', () => {
    expect(inferSide({ x: 0, y: 25 }, rect)).toBe(Position.Left);
  });

  it('returns Bottom for intersection on bottom border', () => {
    expect(inferSide({ x: 50, y: 50 }, rect)).toBe(Position.Bottom);
  });

  it('returns Top for intersection on top border', () => {
    expect(inferSide({ x: 50, y: 0 }, rect)).toBe(Position.Top);
  });

  it('prefers Y axis at exact corners (|dx| === |dy| tie breaks to Top/Bottom)', () => {
    // On a square, corner has equal |dx| and |dy|.
    const square = { x: 0, y: 0, width: 100, height: 100 };
    // Top-right corner: dx=50, dy=-50. Strict > means Y branch wins → Top.
    expect(inferSide({ x: 100, y: 0 }, square)).toBe(Position.Top);
    // Bottom-left corner: dx=-50, dy=50. Y branch wins → Bottom.
    expect(inferSide({ x: 0, y: 100 }, square)).toBe(Position.Bottom);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/system
npx vitest run src/utils/edges/floating.spec.ts
```

Expected: FAIL with "Failed to resolve import './floating'".

- [ ] **Step 3: Write the implementation**

Create `packages/system/src/utils/edges/floating.ts`:

```typescript
import { Position } from '../../types/position';

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Compute a ray-rect intersection point.
 *
 * Given a node rectangle and a reference point outside (or inside) the rectangle,
 * casts a ray from the rectangle's center toward the reference point and returns
 * the point at which that ray exits the rectangle's border.
 *
 * Used to position floating-edge endpoints dynamically on the border of a node.
 */
export function getFloatingEndpoint(nodeRect: NodeRect, referencePoint: Point): Point {
  const cx = nodeRect.x + nodeRect.width / 2;
  const cy = nodeRect.y + nodeRect.height / 2;
  const dx = referencePoint.x - cx;
  const dy = referencePoint.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const halfW = nodeRect.width / 2;
  const halfH = nodeRect.height / 2;
  const tX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);

  return { x: cx + t * dx, y: cy + t * dy };
}

/**
 * Infer which side of the node a given intersection point lies on.
 *
 * Used to choose sourcePosition/targetPosition for path-shape helpers (bezier, step)
 * when the endpoint is floating rather than anchored to a handle with a declared position.
 *
 * Tiebreak: at exact corners (|dx| === |dy|), the Y axis wins via strict `>`, so the
 * function returns Top or Bottom rather than Left or Right.
 */
export function inferSide(intersection: Point, nodeRect: NodeRect): Position {
  const cx = nodeRect.x + nodeRect.width / 2;
  const cy = nodeRect.y + nodeRect.height / 2;
  const dx = intersection.x - cx;
  const dy = intersection.y - cy;

  return Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? Position.Right : Position.Left)
    : (dy > 0 ? Position.Bottom : Position.Top);
}
```

- [ ] **Step 4: Re-export from the edges index**

Edit `packages/system/src/utils/edges/index.ts`. Find the list of re-exports and add:

```typescript
export * from './floating';
```

If the file uses named re-exports instead of star, match the style used for `bezier-edge`, `straight-edge`, etc.

- [ ] **Step 5: Re-export from the system package root**

Edit `packages/system/src/index.ts`. Find where other edge helpers (e.g. `getBezierPath`) are exported and add the new helpers alongside:

```typescript
export { getFloatingEndpoint, inferSide } from './utils/edges/floating';
```

If the file already re-exports `* from './utils/edges'` or similar, the new helpers are picked up automatically and this step is a no-op.

- [ ] **Step 6: Run the tests and verify they pass**

```bash
cd packages/system
npx vitest run src/utils/edges/floating.spec.ts
```

Expected: PASS (13 tests across two describe blocks).

- [ ] **Step 7: Run the full system test suite to confirm no regressions**

```bash
cd packages/system
npm test 2>&1 | tail -20
```

If there is no `test` script in `packages/system`, run `npx vitest run` directly. Expected: all existing specs plus the new one pass.

- [ ] **Step 8: Build the system package**

```bash
cd packages/system
npm run build
```

Expected: clean build, `dist/esm/` updated.

- [ ] **Step 9: Commit**

From repo root:
```bash
git add packages/system/src/utils/edges/floating.ts \
        packages/system/src/utils/edges/floating.spec.ts \
        packages/system/src/utils/edges/index.ts \
        packages/system/src/index.ts
git commit -m "feat(system): add getFloatingEndpoint and inferSide helpers

Pure math helpers for ray-rect intersection and side inference, used by
edge renderers to position floating-edge endpoints on the node border."
```

---

## Task 3: Read `data-floating` attribute in `getHandleBounds`

**Goal:** When a handle DOM element carries `data-floating`, populate the resulting `Handle` record with `floating: true`. This is the data path from DOM → `@angflow/system` handle registry.

**Files:**
- Modify: `packages/system/src/utils/dom.ts`

- [ ] **Step 1: Read the current `getHandleBounds` (around line 68)**

Run:
```bash
grep -n "getHandleBounds\|data-handleid\|data-handlepos" packages/system/src/utils/dom.ts
```

Expected output:
```
68:export const getHandleBounds = (
85:      id: handle.getAttribute('data-handleid'),
88:      position: handle.getAttribute('data-handlepos') as unknown as Position,
```

- [ ] **Step 2: Extend the returned Handle record with the floating flag**

Edit `packages/system/src/utils/dom.ts`. Find the Handle construction block (lines 81-93) and add a `floating` field. The attribute is present-or-absent — if present (even with empty value), treat as `true`; if absent, leave `undefined`:

Change:
```typescript
return Array.from(handles).map((handle): Handle => {
  const handleBounds = handle.getBoundingClientRect();

  return {
    id: handle.getAttribute('data-handleid'),
    type,
    nodeId,
    position: handle.getAttribute('data-handlepos') as unknown as Position,
    x: (handleBounds.left - nodeBounds.left) / zoom,
    y: (handleBounds.top - nodeBounds.top) / zoom,
    ...getDimensions(handle as HTMLDivElement),
  };
});
```

To:
```typescript
return Array.from(handles).map((handle): Handle => {
  const handleBounds = handle.getBoundingClientRect();

  return {
    id: handle.getAttribute('data-handleid'),
    type,
    nodeId,
    position: handle.getAttribute('data-handlepos') as unknown as Position,
    x: (handleBounds.left - nodeBounds.left) / zoom,
    y: (handleBounds.top - nodeBounds.top) / zoom,
    ...getDimensions(handle as HTMLDivElement),
    floating: handle.hasAttribute('data-floating') ? true : undefined,
  };
});
```

- [ ] **Step 3: Typecheck + build**

```bash
cd packages/system
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

From repo root:
```bash
git add packages/system/src/utils/dom.ts
git commit -m "feat(system): read data-floating attribute in getHandleBounds

Populates the floating flag on Handle records from a DOM attribute. Framework
wrappers set data-floating on their handle elements when the consumer has opted
into floating behavior."
```

---

## Task 4: Add `getFloatingDropTarget` helper with unit tests

**Goal:** Add the Stage 2 drop-target helper in `@angflow/system/xyhandle/utils.ts`. Pure hit-test logic; no validator integration yet (that lands in Task 5 when we wire it into XYHandle).

**Files:**
- Modify: `packages/system/src/xyhandle/utils.ts`
- Create: `packages/system/src/xyhandle/utils.spec.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/system/src/xyhandle/utils.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getFloatingDropTarget } from './utils';
import { Position } from '../types/position';
import type { NodeLookup } from '../types/nodes';

// Minimal internal-node factory for tests.
// Fields not relevant to hit-testing are stubbed with safe defaults.
function makeNode(id: string, opts: {
  x: number; y: number; width: number; height: number;
  zIndex?: number;
  floatingHandles?: Array<{ id: string; type: 'source' | 'target'; position: Position }>;
  fixedHandles?: Array<{ id: string; type: 'source' | 'target'; position: Position }>;
}): any {
  const sourceHandles = [
    ...(opts.fixedHandles?.filter(h => h.type === 'source') ?? []),
    ...(opts.floatingHandles?.filter(h => h.type === 'source') ?? []),
  ].map(h => ({
    id: h.id, nodeId: id, type: h.type, position: h.position,
    x: 0, y: 0, width: 0, height: 0,
    floating: opts.floatingHandles?.some(fh => fh.id === h.id) ? true : undefined,
  }));
  const targetHandles = [
    ...(opts.fixedHandles?.filter(h => h.type === 'target') ?? []),
    ...(opts.floatingHandles?.filter(h => h.type === 'target') ?? []),
  ].map(h => ({
    id: h.id, nodeId: id, type: h.type, position: h.position,
    x: 0, y: 0, width: 0, height: 0,
    floating: opts.floatingHandles?.some(fh => fh.id === h.id) ? true : undefined,
  }));

  return {
    id,
    position: { x: opts.x, y: opts.y },
    width: opts.width,
    height: opts.height,
    measured: { width: opts.width, height: opts.height },
    internals: {
      positionAbsolute: { x: opts.x, y: opts.y },
      z: opts.zIndex ?? 0,
      handleBounds: {
        source: sourceHandles,
        target: targetHandles,
      },
    },
  };
}

function makeLookup(...nodes: any[]): NodeLookup {
  const m = new Map();
  for (const n of nodes) m.set(n.id, n);
  return m as NodeLookup;
}

describe('getFloatingDropTarget', () => {
  it('returns null when pointer is outside all nodes', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 500, y: 500 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('returns null when the hovered node has no floating handles', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      fixedHandles: [{ id: 'fixed', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('returns the sole compatible floating handle when pointer is inside the node', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.id).toBe('auto');
    expect(result?.nodeId).toBe('A');
  });

  it('returns null when only same-type floating handles exist (type mismatch)', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'source', position: Position.Left }],
    }));
    // Drag started from a source handle → looking for a target. Only source floating
    // handles exist → no valid drop.
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('skips the source node (self-connection guard)', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'A', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('prefers the floating handle at the pointer-side when multiple exist', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [
        { id: 'left',  type: 'target', position: Position.Left },
        { id: 'right', type: 'target', position: Position.Right },
      ],
    }));
    // Pointer on the right half (x=75) → dx=25 > 0 → pointer side is Right.
    const result = getFloatingDropTarget(
      { x: 75, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.id).toBe('right');
  });

  it('prefers the node with highest zIndex when pointer is inside overlapping nodes', () => {
    const lookup = makeLookup(
      makeNode('A', {
        x: 0, y: 0, width: 100, height: 50, zIndex: 1,
        floatingHandles: [{ id: 'a-auto', type: 'target', position: Position.Left }],
      }),
      makeNode('B', {
        x: 20, y: 10, width: 100, height: 50, zIndex: 5,
        floatingHandles: [{ id: 'b-auto', type: 'target', position: Position.Left }],
      }),
    );
    const result = getFloatingDropTarget(
      { x: 50, y: 30 },
      lookup,
      { nodeId: 'C', type: 'source', id: null },
    );
    expect(result?.nodeId).toBe('B');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/system
npx vitest run src/xyhandle/utils.spec.ts
```

Expected: FAIL with "getFloatingDropTarget is not exported from './utils'".

- [ ] **Step 3: Read the current `utils.ts` to locate the insertion point**

```bash
grep -n "^export function\|^export const" packages/system/src/xyhandle/utils.ts
```

Note the exports; you'll add `getFloatingDropTarget` after `getClosestHandle` (around line 76).

- [ ] **Step 4: Implement `getFloatingDropTarget`**

Edit `packages/system/src/xyhandle/utils.ts`. After the closing brace of `getClosestHandle`, add:

```typescript
/**
 * Stage 2 drop-target resolver for connection drags.
 *
 * Called when Stage 1 (`getClosestHandle`) returns null. Finds a node whose bounding
 * rectangle contains the pointer and has at least one compatible floating handle, then
 * returns the best floating handle on that node.
 *
 * Disambiguation when multiple floating handles exist on the same node:
 *   - If a handle's declared position matches the pointer's side of the node, that handle wins.
 *   - Otherwise, fall back to iteration order.
 *
 * Does not apply per-handle `isValidConnection` validation — that is the caller's
 * responsibility. If the validator rejects, the caller returns null (no cascade).
 */
export function getFloatingDropTarget(
  position: XYPosition,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null },
): Handle | null {
  const oppositeType: HandleType = fromHandle.type === 'source' ? 'target' : 'source';

  let bestNode: any = null;
  let bestZ = -Infinity;

  for (const node of nodeLookup.values()) {
    if (node.id === fromHandle.nodeId) continue;

    const nx = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
    const ny = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
    const nw = node.measured?.width ?? node.width ?? 0;
    const nh = node.measured?.height ?? node.height ?? 0;

    if (position.x < nx || position.x > nx + nw) continue;
    if (position.y < ny || position.y > ny + nh) continue;

    const oppositeList = (node.internals?.handleBounds?.[oppositeType] ?? []) as Handle[];
    const hasFloating = oppositeList.some((h) => h.floating === true);
    if (!hasFloating) continue;

    const z = node.internals?.z ?? 0;
    if (z > bestZ) {
      bestZ = z;
      bestNode = node;
    }
  }

  if (!bestNode) return null;

  const candidates = ((bestNode.internals?.handleBounds?.[oppositeType] ?? []) as Handle[])
    .filter((h) => h.floating === true);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Disambiguate by position-side match.
  const nx = bestNode.internals?.positionAbsolute?.x ?? bestNode.position?.x ?? 0;
  const ny = bestNode.internals?.positionAbsolute?.y ?? bestNode.position?.y ?? 0;
  const nw = bestNode.measured?.width ?? bestNode.width ?? 0;
  const nh = bestNode.measured?.height ?? bestNode.height ?? 0;
  const cx = nx + nw / 2;
  const cy = ny + nh / 2;
  const dx = position.x - cx;
  const dy = position.y - cy;
  const pointerSide: Position = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? Position.Right : Position.Left)
    : (dy > 0 ? Position.Bottom : Position.Top);

  const sideMatch = candidates.find((h) => h.position === pointerSide);
  return sideMatch ?? candidates[0];
}
```

You may need to add imports at the top of `utils.ts`. Ensure the file imports `Position` from `'../types/position'` and `XYPosition`, `NodeLookup`, `Handle`, `HandleType` from the same places they are already imported. If an import is missing, add it to the existing top-of-file import block.

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd packages/system
npx vitest run src/xyhandle/utils.spec.ts
```

Expected: PASS (7 tests).

- [ ] **Step 6: Run the full system test suite**

```bash
cd packages/system
npx vitest run
```

Expected: all specs pass (floating.spec + utils.spec + any pre-existing).

- [ ] **Step 7: Build**

```bash
cd packages/system
npm run build
```

Expected: clean build.

- [ ] **Step 8: Commit**

From repo root:
```bash
git add packages/system/src/xyhandle/utils.ts packages/system/src/xyhandle/utils.spec.ts
git commit -m "feat(system): add getFloatingDropTarget for Stage 2 drop resolution

Whole-node drop-target helper called when getClosestHandle returns null.
Finds a node whose bounding rect contains the pointer and picks the best
compatible floating handle, disambiguated by pointer-side-to-handle-position
matching with iteration-order fallback."
```

---

## Task 5: Wire `getFloatingDropTarget` into `XYHandle` connection drag

**Goal:** Chain the Stage 2 helper after `getClosestHandle` in the connection-drag flow at `packages/system/src/xyhandle/XYHandle.ts`. This is the integration step that makes the feature visible during drag.

**Files:**
- Modify: `packages/system/src/xyhandle/XYHandle.ts`

- [ ] **Step 1: Locate the `getClosestHandle` call site**

```bash
grep -n "getClosestHandle" packages/system/src/xyhandle/XYHandle.ts
```

Expected: one hit, around line 146.

- [ ] **Step 2: Read the surrounding context**

```bash
sed -n '140,170p' packages/system/src/xyhandle/XYHandle.ts
```

Identify what variable captures the result of `getClosestHandle` (likely `closestHandle`), and how the code uses `closestHandle === null` downstream.

- [ ] **Step 3: Edit the import at the top of the file**

Find the existing import from `./utils`:

```typescript
import { getClosestHandle, /* ... */ } from './utils';
```

Add `getFloatingDropTarget` to that import:

```typescript
import { getClosestHandle, getFloatingDropTarget, /* ... */ } from './utils';
```

If the imports are split across multiple lines, match the existing formatting.

- [ ] **Step 4: Chain the fallback after `getClosestHandle`**

Change:

```typescript
closestHandle = getClosestHandle(
  pointToRendererPoint(position, transform, false, [1, 1]),
  connectionRadius,
  nodeLookup,
  fromHandle
);
```

To:

```typescript
const pointerInRenderer = pointToRendererPoint(position, transform, false, [1, 1]);
closestHandle = getClosestHandle(
  pointerInRenderer,
  connectionRadius,
  nodeLookup,
  fromHandle
);
if (!closestHandle) {
  closestHandle = getFloatingDropTarget(pointerInRenderer, nodeLookup, fromHandle);
}
```

This preserves the existing behavior when Stage 1 returns a handle and only falls through when nothing was close enough.

- [ ] **Step 5: Build the system package**

```bash
cd packages/system
npm run build
```

Expected: clean build.

- [ ] **Step 6: Run the full system test suite to verify no regression**

```bash
cd packages/system
npx vitest run
```

Expected: all specs pass. No new tests in this task — the integration is exercised by manual smoke in Task 10.

- [ ] **Step 7: Commit**

From repo root:
```bash
git add packages/system/src/xyhandle/XYHandle.ts
git commit -m "feat(system): chain getFloatingDropTarget after getClosestHandle in XYHandle

When no fixed handle is within connectionRadius of the pointer during a connection
drag, fall through to the Stage 2 whole-node-drop resolver. Fixed handles still win
at short range; floating handles catch the rest of the node area."
```

---

## Task 6: Add `floating` input to `HandleComponent` and `data-floating` host binding

**Goal:** Expose the consumer-facing API. A boolean signal input on `HandleComponent` toggles a `data-floating` DOM attribute that `getHandleBounds` reads (Task 3).

**Files:**
- Modify: `packages/angular/src/lib/components/handle/handle.component.ts`
- Modify: `packages/angular/src/lib/components/handle/handle.component.spec.ts`

- [ ] **Step 1: Read the current handle component**

```bash
grep -n "input\|\[attr\." packages/angular/src/lib/components/handle/handle.component.ts
```

Note the existing host bindings (around lines 35–38) and the existing signal inputs (around lines 48–55).

- [ ] **Step 2: Add the `floating` input**

Edit `packages/angular/src/lib/components/handle/handle.component.ts`. Find the block of `readonly ... = input(...)` declarations (around lines 48–55) and add:

```typescript
readonly floating = input(false);
```

at the end of that block, after `readonly data = input<unknown>(undefined);`.

- [ ] **Step 3: Add the host binding**

In the same file, find the `host: { ... }` object (lines 23–42). Add a new line in the `[attr.*]` section:

```typescript
'[attr.data-floating]': 'floating() ? "" : null',
```

Place it alongside the other `[attr.*]` entries (e.g. right after `'[attr.data-handlepos]': 'position()',`). The `? "" : null` pattern yields an empty-valued attribute when `floating()` is true and no attribute at all when false — matching what `hasAttribute('data-floating')` expects (Task 3 Step 2).

- [ ] **Step 4: Write a failing test**

Edit `packages/angular/src/lib/components/handle/handle.component.spec.ts`. Add a new `it` block inside the top-level `describe`:

```typescript
it('sets the data-floating attribute when the floating input is true', async () => {
  // Construct the component as the other tests do (reuse whatever harness the existing
  // specs use — likely TestBed.createComponent with a minimal host). The key check:
  //   - When floating() is true, the host element has attribute data-floating (value "").
  //   - When floating() is false (default), the host element has no data-floating attribute.

  // Example shape — adapt to the existing spec's setup pattern:
  const { fixture, el } = createHandleTestHost({ floating: true, type: 'source' });
  await fixture.whenStable();
  fixture.detectChanges();
  expect(el.hasAttribute('data-floating')).toBe(true);

  const { fixture: f2, el: el2 } = createHandleTestHost({ floating: false, type: 'source' });
  await f2.whenStable();
  f2.detectChanges();
  expect(el2.hasAttribute('data-floating')).toBe(false);
});
```

If the existing spec file does not have a `createHandleTestHost` helper, adapt to its actual setup idiom. The existing spec at `packages/angular/src/lib/components/handle/handle.component.spec.ts` already constructs the component for its five existing tests — mirror that construction for the floating test, just passing `floating: true` (or binding the input) where appropriate.

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd packages/angular
npx vitest run src/lib/components/handle/handle.component.spec.ts
```

Expected: the new test fails (initially with no matching implementation, or passes if Step 2/3 are already applied — in which case the test is green from the start, which is acceptable for attribute tests).

- [ ] **Step 6: Verify the test passes with the input + binding in place**

```bash
cd packages/angular
npx vitest run src/lib/components/handle/handle.component.spec.ts
```

Expected: all 6 tests pass (5 existing + 1 new).

- [ ] **Step 7: Typecheck + full test run**

```bash
cd packages/angular
npx tsc --noEmit
npm run test
```

Expected: both clean.

- [ ] **Step 8: Build**

```bash
cd packages/angular
npm run build
```

Expected: clean build.

- [ ] **Step 9: Commit**

From repo root:
```bash
git add packages/angular/src/lib/components/handle/handle.component.ts \
        packages/angular/src/lib/components/handle/handle.component.spec.ts
git commit -m "feat(angular): add floating input to HandleComponent

Adds a boolean signal input that toggles a data-floating attribute on the
handle element. The system package's getHandleBounds reads this attribute to
populate the floating flag on the Handle record."
```

---

## Task 7: Edge renderer uses `getFloatingEndpoint` for floating endpoints

**Goal:** Switch endpoint-computation strategy in `getEdgeInputs` based on `handle.floating`. Adds the floating branches alongside the existing fixed-handle and legacy fallback branches.

**Files:**
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts`

- [ ] **Step 1: Write the failing tests**

Edit `packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts`. Add new `describe` blocks after the existing ones:

```typescript
describe('floating endpoints', () => {
  let store: FlowStore;
  let component: EdgeRendererComponent<any, any>;

  beforeEach(() => {
    // Mirror the setup pattern used in the existing describe blocks.
    TestBed.configureTestingModule({
      providers: [FlowStore, provideZonelessChangeDetection()],
    });
    store = TestBed.inject(FlowStore);
    component = TestBed.runInInjectionContext(() => new (EdgeRendererComponent as any)());
  });

  function seedNodes() {
    // Source node at (0,0) sized 100x50; target node at (300, 200) sized 100x50.
    const srcHandle: Handle = {
      id: 'auto', nodeId: 'A', type: 'source', position: Position.Right,
      x: 50, y: 25, width: 0, height: 0, floating: true,
    };
    const tgtHandle: Handle = {
      id: 'auto', nodeId: 'B', type: 'target', position: Position.Left,
      x: 50, y: 25, width: 0, height: 0, floating: true,
    };

    // Directly populate nodeLookup to bypass DOM measurement.
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 0, y: 0 },
        handleBounds: { source: [srcHandle], target: null },
        z: 0,
      },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 300, y: 200 },
        handleBounds: { source: null, target: [tgtHandle] },
        z: 0,
      },
    } as any);
  }

  it('computes both endpoints as ray-rect intersections when both handles are floating', () => {
    seedNodes();
    const edge: Edge = { id: 'e', source: 'A', target: 'B', sourceHandle: 'auto', targetHandle: 'auto' };
    const inputs = component.getEdgeInputs(edge);

    // Source node center = (50, 25); target node center = (350, 225).
    // Both endpoints should lie on their respective node's border, on the
    // center-to-center ray. Exact values depend on ray-rect intersection math.
    // Source node bounds: x in [0,100], y in [0,50].
    // Ray from (50,25) toward (350,225): dx=300, dy=200. halfW=50, halfH=25.
    //   tX = 50/300 ≈ 0.167, tY = 25/200 = 0.125. Min = tY. Intersection = (50 + 0.125*300, 25 + 0.125*200) = (87.5, 50).
    expect(inputs['sourceX']).toBeCloseTo(87.5, 2);
    expect(inputs['sourceY']).toBeCloseTo(50, 2);
    // Target node bounds: x in [300,400], y in [200,250].
    // Ray from (350,225) toward (50,25): dx=-300, dy=-200. halfW=50, halfH=25.
    //   tY = 25/200 = 0.125. Intersection = (350 - 0.125*300, 225 - 0.125*200) = (312.5, 200).
    expect(inputs['targetX']).toBeCloseTo(312.5, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2);
  });

  it('falls back to fixed-handle positions for self-loops even when handles are floating', () => {
    seedNodes();
    // Self-loop: source === target.
    const edge: Edge = { id: 'self', source: 'A', target: 'A', sourceHandle: 'auto', targetHandle: 'auto' };
    const inputs = component.getEdgeInputs(edge);
    // Source handle DOM center: sourcePos (0,0) + handle.x (50) + width/2 (0) = (50, 25).
    expect(inputs['sourceX']).toBeCloseTo(50, 2);
    expect(inputs['sourceY']).toBeCloseTo(25, 2);
  });

  it('uses fixed-handle position on the fixed side and ray-rect on the floating side', () => {
    // Set A's source handle as fixed (no floating flag).
    const srcHandle: Handle = {
      id: 'fixed', nodeId: 'A', type: 'source', position: Position.Right,
      x: 90, y: 20, width: 10, height: 10, // fixed position on right side
    };
    const tgtHandle: Handle = {
      id: 'auto', nodeId: 'B', type: 'target', position: Position.Left,
      x: 50, y: 25, width: 0, height: 0, floating: true,
    };
    store.nodeLookup.set('A', {
      id: 'A', position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 0, y: 0 },
        handleBounds: { source: [srcHandle], target: null },
        z: 0,
      },
    } as any);
    store.nodeLookup.set('B', {
      id: 'B', position: { x: 300, y: 200 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 300, y: 200 },
        handleBounds: { source: null, target: [tgtHandle] },
        z: 0,
      },
    } as any);

    const edge: Edge = { id: 'e', source: 'A', target: 'B', sourceHandle: 'fixed', targetHandle: 'auto' };
    const inputs = component.getEdgeInputs(edge);

    // Source: fixed handle center = (0 + 90 + 5, 0 + 20 + 5) = (95, 25).
    expect(inputs['sourceX']).toBeCloseTo(95, 2);
    expect(inputs['sourceY']).toBeCloseTo(25, 2);
    // Target: ray-rect intersection with reference = source fixed handle position.
    //   Ray from target center (350,225) toward (95,25): dx=-255, dy=-200.
    //   halfW=50, halfH=25. tX=50/255 ≈ 0.196, tY=25/200=0.125. Min=tY.
    //   Intersection = (350 - 0.125*255, 225 - 0.125*200) = (318.125, 200).
    expect(inputs['targetX']).toBeCloseTo(318.125, 2);
    expect(inputs['targetY']).toBeCloseTo(200, 2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd packages/angular
npx vitest run src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts
```

Expected: the three new tests fail because `getEdgeInputs` does not yet branch on `handle.floating`.

- [ ] **Step 3: Import the floating helpers into the edge renderer**

Edit `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`. Find the existing import from `@angflow/system` (where `Position`, `EdgeMarker`, etc. come from) and add:

```typescript
import { getFloatingEndpoint, inferSide } from '@angflow/system';
```

If those imports are grouped together in an existing `import { ... } from '@angflow/system'` block, add the two names inline.

- [ ] **Step 4: Replace the endpoint-resolution block**

Locate the endpoint-resolution block at lines 340–358. Replace it with a version that branches on `handle.floating`.

Find:

```typescript
let sourceX: number, sourceY: number, targetX: number, targetY: number;
let srcPos = sourceHandle?.position ?? (edge as Record<string, unknown>).sourcePosition as Position ?? Position.Bottom;
let tgtPos = targetHandle?.position ?? (edge as Record<string, unknown>).targetPosition as Position ?? Position.Top;

if (sourceHandle) {
  sourceX = sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2;
  sourceY = sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2;
} else {
  sourceX = sourcePos.x + sourceW / 2;
  sourceY = sourcePos.y + sourceH;
}

if (targetHandle) {
  targetX = targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2;
  targetY = targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2;
} else {
  targetX = targetPos.x + targetW / 2;
  targetY = targetPos.y;
}
```

Replace with:

```typescript
let sourceX: number, sourceY: number, targetX: number, targetY: number;
let srcPos = sourceHandle?.position ?? (edge as Record<string, unknown>).sourcePosition as Position ?? Position.Bottom;
let tgtPos = targetHandle?.position ?? (edge as Record<string, unknown>).targetPosition as Position ?? Position.Top;

// Self-loops ignore floating and fall back to fixed-handle positions (geometric degeneracy).
const isSelfLoop = edge.source === edge.target;
const sourceFloating = !isSelfLoop && sourceHandle?.floating === true;
const targetFloating = !isSelfLoop && targetHandle?.floating === true;

const sourceRect = { x: sourcePos.x, y: sourcePos.y, width: sourceW, height: sourceH };
const targetRect = { x: targetPos.x, y: targetPos.y, width: targetW, height: targetH };

// Reference points: see spec section "Reference-point resolution".
const sourceRef = targetFloating
  ? { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 }
  : targetHandle
    ? { x: targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2, y: targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2 }
    : { x: targetRect.x + targetRect.width / 2, y: targetRect.y };
const targetRef = sourceFloating
  ? { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height / 2 }
  : sourceHandle
    ? { x: sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2, y: sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2 }
    : { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height };

if (sourceFloating) {
  const p = getFloatingEndpoint(sourceRect, sourceRef);
  sourceX = p.x;
  sourceY = p.y;
  srcPos = inferSide(p, sourceRect);
} else if (sourceHandle) {
  sourceX = sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2;
  sourceY = sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2;
} else {
  sourceX = sourcePos.x + sourceW / 2;
  sourceY = sourcePos.y + sourceH;
}

if (targetFloating) {
  const p = getFloatingEndpoint(targetRect, targetRef);
  targetX = p.x;
  targetY = p.y;
  tgtPos = inferSide(p, targetRect);
} else if (targetHandle) {
  targetX = targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2;
  targetY = targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2;
} else {
  targetX = targetPos.x + targetW / 2;
  targetY = targetPos.y;
}
```

- [ ] **Step 5: Run the new tests to verify they pass**

```bash
cd packages/angular
npx vitest run src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts
```

Expected: all tests pass (3 existing + 3 new).

- [ ] **Step 6: Run the full Angular test suite**

```bash
cd packages/angular
npm run test
```

Expected: all specs pass.

- [ ] **Step 7: Typecheck + build**

```bash
cd packages/angular
npx tsc --noEmit
npm run build
```

Expected: clean.

- [ ] **Step 8: Commit**

From repo root:
```bash
git add packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
        packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts
git commit -m "feat(angular): edge renderer computes floating endpoints via ray-rect intersection

Endpoints whose handle has floating=true are placed on the node border via a ray
cast from the owning node's center toward the other endpoint's reference point.
Self-loops and non-floating edges keep today's behavior. Path side (sourcePosition,
targetPosition) is inferred from the intersection location for bezier/step curve shaping."
```

---

## Task 8: Visual feedback for Stage 2 drop candidate

**Goal:** When Stage 2 resolves to a floating drop candidate during a live connection drag, highlight the owning node's border. Feedback is driven by a new `connectionTargetNodeId` signal on `FlowStore` that the node wrapper reads to apply a CSS class.

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts`
- Modify: `packages/system/src/xyhandle/XYHandle.ts` (write the target node id through a callback)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (wire the callback)
- Modify: `packages/angular/src/lib/styles/ng-flow.css` (add the state class)
- Modify: the node wrapper template (likely `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts` or similar — locate first)

- [ ] **Step 1: Add the signal to FlowStore**

Edit `packages/angular/src/lib/services/flow-store.service.ts`. Find the section where other UI-state signals live (e.g. `userSelectionActive`, `nodesSelectionActive`). Add:

```typescript
/** Id of the node currently showing Stage 2 floating-drop feedback during a connection drag.
 *  Null when no candidate is active or when Stage 1 owns the drop target. */
readonly connectionTargetNodeId = signal<string | null>(null);
```

- [ ] **Step 2: Locate the node renderer template**

Find the Angular file responsible for rendering each node:

```bash
grep -rn "xy-flow__node" packages/angular/src/lib --include="*.ts" -l
```

Identify the component/template that puts the `xy-flow__node` class on each rendered node wrapper. Typically this is `node-renderer.component.ts` or a `node-wrapper.component.ts`.

- [ ] **Step 3: Add the connection-target class conditionally**

In the identified component's `host` bindings or template, add a conditional class driven by the FlowStore signal. Example pattern (match the file's existing host/template style):

```typescript
host: {
  // ... existing bindings
  '[class.connection-target]': 'store.connectionTargetNodeId() === id()',
}
```

Where `id()` is the node's id signal input.

- [ ] **Step 4: Add the CSS**

Edit `packages/angular/src/lib/styles/ng-flow.css`. Locate the existing node-state selectors (around lines 194–203). Add a new state class:

```css
.xy-flow__node.connection-target {
  outline: 2px dashed var(--xy-connection-target-outline-color, #3b82f6);
  outline-offset: 4px;
}
```

- [ ] **Step 5: Thread the candidate id from XYHandle to FlowStore**

The integration between the system-package drag machinery and the Angular signal requires a callback. Locate the `XYHandle.update()` or handler-configuration block where `NgFlowComponent` already wires per-frame callbacks (search for `onConnectStart`, `onConnect`, or similar in `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`).

Add a new callback prop — for example `onConnectionTargetChange?: (nodeId: string | null) => void` — on the XYHandle configuration surface:

1. Edit `packages/system/src/xyhandle/XYHandle.ts`. Wherever `closestHandle` is computed (the block you edited in Task 5), after both Stage 1 and Stage 2 have run, invoke a new callback if provided:

   ```typescript
   const targetNodeId = closestHandle?.floating === true ? closestHandle.nodeId : null;
   params.onConnectionTargetChange?.(targetNodeId);
   ```

   where `params` is the options object passed to the handler (named per the existing convention in that file — could be `state`, `options`, or another local). Ensure the callback is also called with `null` on pointer-up or when Stage 1 wins (so the highlight clears).

2. Add `onConnectionTargetChange?: (nodeId: string | null) => void` to the XYHandle config type (likely in `packages/system/src/xyhandle/types.ts`).

3. In `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`, find where XYHandle is initialized with its callbacks. Add:

   ```typescript
   onConnectionTargetChange: (nodeId) => {
     this.store.connectionTargetNodeId.set(nodeId);
   },
   ```

   Match the existing callback style in that file.

- [ ] **Step 6: Build both packages**

```bash
cd packages/system
npm run build
cd ../angular
npm run build
```

Expected: both clean.

- [ ] **Step 7: Run all tests**

```bash
cd packages/system && npx vitest run
cd ../angular && npm run test
```

Expected: all specs pass.

- [ ] **Step 8: Commit**

From repo root:
```bash
git add packages/system/src/xyhandle/XYHandle.ts \
        packages/system/src/xyhandle/types.ts \
        packages/angular/src/lib/services/flow-store.service.ts \
        packages/angular/src/lib/container/ng-flow/ng-flow.component.ts \
        packages/angular/src/lib/styles/ng-flow.css
# plus the node-renderer file you modified in Step 3
git commit -m "feat(angular): highlight node when Stage 2 floating handle would be the drop target

Adds a connectionTargetNodeId signal on FlowStore, driven by a new
onConnectionTargetChange callback on XYHandle. The node wrapper applies a
connection-target CSS state class (dashed outline) when the signal matches
its id. Clears when Stage 1 wins or when drag ends."
```

**Note:** Step 3 file path will depend on the actual node-wrapper component name. Include it in the `git add` command above.

---

## Task 9: Rewrite the floating-edges example

**Goal:** Replace the handle-switching workaround at `examples/angular/src/app/examples/floating-edges/floating-edges.component.ts` with a clean demonstration of the new API. Include both a pure-floating node type and a mixed-mode subexample.

**Files:**
- Modify: `examples/angular/src/app/examples/floating-edges/floating-edges.component.ts` (full rewrite)

- [ ] **Step 1: Delete the old content and write the new version**

Overwrite `examples/angular/src/app/examples/floating-edges/floating-edges.component.ts` with:

```typescript
import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

// ── Pure floating node: one source + one target, both floating ──────────

@Component({
  selector: 'app-floating-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="source" id="auto" [position]="Position.Right" [floating]="true" />
    <ng-flow-handle type="target" id="auto" [position]="Position.Left"  [floating]="true" />
    <div class="floating-node" [style.background]="data()?.color ?? '#e0e7ff'">
      {{ data()?.label }}
    </div>
  `,
  styles: [`
    .floating-node {
      padding: 14px 22px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      border: 2px solid #c7d2fe;
      min-width: 80px;
      text-align: center;
    }
    :host ::ng-deep .xy-flow__handle { opacity: 0; width: 1px; height: 1px; }
  `],
})
export class FloatingNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

// ── Mixed node: two fixed row-handles + one floating target anchor ──────

@Component({
  selector: 'app-mixed-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <!-- Two fixed source handles, one per row -->
    <ng-flow-handle type="source" id="row-a" [position]="Position.Right" />
    <ng-flow-handle type="source" id="row-b" [position]="Position.Right" />
    <!-- One floating target anchor; any drop inside the node lands here -->
    <ng-flow-handle type="target" id="any" [position]="Position.Left" [floating]="true" />

    <div class="mixed-node">
      <div class="mixed-node__row">Row A →</div>
      <div class="mixed-node__row">Row B →</div>
    </div>
  `,
  styles: [`
    .mixed-node {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 8px;
      min-width: 140px;
      overflow: hidden;
      color: #78350f;
      font-size: 12px;
      font-weight: 600;
    }
    .mixed-node__row {
      padding: 10px 14px;
      position: relative;
    }
    .mixed-node__row + .mixed-node__row {
      border-top: 1px solid #fcd34d;
    }
    :host ::ng-deep .xy-flow__handle { opacity: 0; width: 1px; height: 1px; }
  `],
})
export class MixedNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

// ── Example page ───────────────────────────────────────────────────────

@Component({
  selector: 'app-floating-edges-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Floating Edges"
      description="Edges connect at floating anchors that slide around the node's perimeter as nodes move. Mix fixed row-handles with floating anchors on the same node — edges with a fixed source and floating target render naturally."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class FloatingEdgesExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    floating: FloatingNodeComponent,
    mixed: MixedNodeComponent,
  };

  nodes: Node[] = [
    { id: '1', type: 'floating', position: { x:  0,  y: 100 }, data: { label: 'Origin',    color: '#dbeafe' } },
    { id: '2', type: 'floating', position: { x: 260, y:   0 }, data: { label: 'Service A', color: '#dcfce7' } },
    { id: '3', type: 'floating', position: { x: 260, y: 200 }, data: { label: 'Service B', color: '#fef3c7' } },
    { id: '4', type: 'mixed',    position: { x: 540, y:  40 }, data: { label: 'Router' } },
    { id: '5', type: 'floating', position: { x: 800, y:   0 }, data: { label: 'Database',  color: '#fce7f3' } },
    { id: '6', type: 'floating', position: { x: 800, y: 180 }, data: { label: 'Cache',     color: '#e0e7ff' } },
  ];

  edges: Edge[] = [
    // Pure floating-to-floating
    { id: 'e1-2', source: '1', sourceHandle: 'auto',  target: '2', targetHandle: 'auto' },
    { id: 'e1-3', source: '1', sourceHandle: 'auto',  target: '3', targetHandle: 'auto' },
    { id: 'e2-4', source: '2', sourceHandle: 'auto',  target: '4', targetHandle: 'any' },
    { id: 'e3-4', source: '3', sourceHandle: 'auto',  target: '4', targetHandle: 'any' },
    // Mixed: fixed row-handle source → floating target
    { id: 'e4a-5', source: '4', sourceHandle: 'row-a', target: '5', targetHandle: 'auto' },
    { id: 'e4b-6', source: '4', sourceHandle: 'row-b', target: '6', targetHandle: 'auto' },
  ];

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
```

- [ ] **Step 2: Verify the example typechecks and builds in the examples app**

```bash
cd examples/angular
npx tsc --noEmit
npm run build 2>&1 | tail -20
```

Expected: clean typecheck + build. If build is slow, skip it and rely on the dev server check in Step 3.

- [ ] **Step 3: Run the dev server for visual verification**

```bash
cd examples/angular
npm run dev
```

Navigate in a browser to the Floating Edges example. Verify:

1. Six nodes render; edges connect appropriately.
2. Drag node 1 around → endpoints on nodes 2 and 3 slide smoothly on their perimeters (no four-point hopping).
3. Drag node 4 (the mixed node) around → edges from its `row-a` / `row-b` handles stay pinned to those rows; edges into it from 2 and 3 slide around its perimeter.
4. Drag the page's pointer inside node 5 during a connection drag starting from node 1's floating handle → node 5 shows the connection-target highlight; release → edge lands on node 5's border.
5. Drop a connection precisely on a row-handle of node 4 → row-handle wins (fixed-handle precision preserved).

If any check fails, stop and report BLOCKED.

- [ ] **Step 4: Commit**

From repo root:
```bash
git add examples/angular/src/app/examples/floating-edges/floating-edges.component.ts
git commit -m "feat(examples/angular): rebuild floating-edges example on new API

Replaces the 191-line handle-switching workaround with a cleaner demonstration
that declares floating handles directly. Adds a mixed-mode node (two fixed
row-handles + one floating target anchor) to show fixed-source/floating-target
edges rendering naturally."
```

---

## Task 10: Final validation

**Goal:** Run the full manual and automated validation matrix from the spec before the branch merges.

No files change in this task. No commit.

- [ ] **Step 1: Run all tests and builds end-to-end**

```bash
cd packages/system
npm run build
npx vitest run
cd ../angular
npx tsc --noEmit
npm run build
npm run test
cd ../../examples/angular
npx tsc --noEmit
```

Expected: every command exits 0. Total test count should be higher than the pre-branch baseline (new tests added in Tasks 2, 4, 6, 7).

- [ ] **Step 2: Manual smoke — zonal example app**

```bash
cd examples/angular
npm run dev
```

Walk through every gallery example (not just floating-edges). The system-package changes in Tasks 3 and 5 touch a code path shared by every edge render and every connection drag — regression check is mandatory.

Confirm:
- Every existing example still works (drag nodes, pan/zoom, connect edges, delete, resize, minimap).
- Kitchen-sink still passes every toggle and interaction.
- Showcase still runs its simulation.

- [ ] **Step 3: Manual smoke — floating-edges example regression matrix**

On the rebuilt Floating Edges example, verify each item from the spec's validation matrix:

1. Drag a floating node → endpoints slide smoothly along perimeters (not four-point hop).
2. Drop a connection anywhere inside a floating-target node → edge lands on the nearest border point.
3. Drop a connection precisely on a fixed row-handle → row-handle wins.
4. Mixed-mode edge (fixed row-source → floating target) renders correctly; drag either node → correct updates.
5. Reconnect an existing floating endpoint → lands on the new target's floating anchor.
6. `connection-target` highlight appears on a hovered floating-drop candidate; disappears when pointer leaves or when a fixed handle wins at close range.

- [ ] **Step 4: Performance spot-check**

Seed a ~200-node graph (can extend the kitchen-sink or construct ad-hoc) with at least half of the nodes using floating handles and all edges passing through them. In Chrome DevTools Performance, start recording, drag a node across the canvas for 3 seconds, stop. Read the average FPS during drag.

Acceptance: FPS ≥ 55. If below, do not merge — investigate the hot path.

- [ ] **Step 5: Decision gate**

If all steps passed: the branch is ready to merge to `main` per the finishing-a-development-branch skill. The floating-edges feature is self-contained and does not require a version bump (no public API breaks); it will be included in the next natural release cadence.

If any step failed: report the failure specifically and stop.

---

## Self-Review Notes

Verified against spec `docs/superpowers/specs/2026-04-19-floating-edges-design.md`:

- **Goal 1** (add `floating` input to HandleComponent): Task 6.
- **Goal 2** (ray-rect intersection for floating endpoints): Tasks 2, 7.
- **Goal 3** (mixed edges): Covered by Task 7's reference-point resolution and Task 9's mixed-node subexample.
- **Goal 4** (Stage 1 / Stage 2 drop logic): Tasks 4, 5.
- **Goal 5** (multi-floating disambiguation by position): Task 4 (helper) + test case.
- **Goal 6** (rebuild the example): Task 9.
- **Goal 7** (support all existing edge types): Task 7 produces `sourceX/Y/targetX/Y` + inferred `sourcePosition/targetPosition`; existing path generators consume these unchanged. No per-type changes needed.
- **Non-goal enforcement**: No edge-level `floating` field added; no convenience directive; no custom-shape intersection; no drag-preview snapping — all confirmed absent from task list.
- **Breaking-changes list**: None required. Floating is strictly opt-in per handle; public API for existing consumers is unchanged.

Coverage check of spec's testing strategy:
- `getFloatingEndpoint` cases → Task 2 test cases 1–7.
- `inferSide` cases including corner tiebreak → Task 2 test cases 8–12.
- `getFloatingDropTarget` cases → Task 4 test cases 1–7.
- `getClosestHandle` regression → covered by existing system-package spec runs in Task 5 Step 6.
- Edge renderer enrichment for floating → Task 7 tests.
- `HandleComponent` attribute wiring → Task 6 test.
- Performance spot-check → Task 10 Step 4.

Placeholders scanned: none remaining. One plan task (Task 8 Step 3) leaves the exact node-wrapper component file for the implementer to identify — this is a genuine needs-inspection-at-impl-time case, not a placeholder (the grep command to find the file is included).
