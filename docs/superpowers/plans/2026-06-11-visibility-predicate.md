# Visibility-Predicate Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `isNodeVisible` predicate to `OnPointerDownParams` so collapse-hidden nodes (tracked in `collapsedHiddenIds` but not in `node.hidden`) can never become connection snap-targets or drop-candidates.

**Architecture:** The system layer gains one optional field on `OnPointerDownParams`; `getNodesWithinDistance` and `getFloatingDropTarget` each accept it as a new optional trailing parameter; `getClosestHandle` passes it through to `getNodesWithinDistance`. `XYHandle.onPointerDown` destructs the field and threads it into every call including the `pointermove` closure. The Angular package reads `collapsedHiddenIds` from the store and supplies the closure at both call sites. React and Svelte are unaffected — the new parameter is optional everywhere.

**Tech Stack:** TypeScript, `@angflow/system` (rollup/vitest), `@angflow/angular` (ngc/vitest/Angular 21 zoneless).

**Part of:** `2026-06-11-deferred-work-master.md` (Cluster 3).

> **Ordering note:** Cluster 1 (quick fixes, Task 3) runs before this plan and adds the bare `if (node.hidden) continue;` guard (plus a test) to `getNodesWithinDistance`. The code blocks below show the complete target state including that guard — if you find the guard and/or its test already present, that is expected; converge on the shown final code without duplicating either.

---

## File Map

| File | Change |
|------|--------|
| `packages/system/src/xyhandle/types.ts` | Add `isNodeVisible?` field to `OnPointerDownParams` |
| `packages/system/src/xyhandle/utils.ts` | `getNodesWithinDistance` + `getFloatingDropTarget` accept optional predicate |
| `packages/system/src/xyhandle/XYHandle.ts` | Destruct `isNodeVisible` from params; thread into both calls in `onPointerMove` |
| `packages/system/src/xyhandle/utils.spec.ts` | New describe blocks for predicate behavior in all three functions |
| `packages/angular/src/lib/components/handle/handle.component.ts` | Pass `isNodeVisible` at the `onPointerDown` call site (line 142) |
| `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` | Pass `isNodeVisible` at the reconnect call site (~line 678) |
| `packages/angular/src/lib/components/handle/handle.component.spec.ts` | New integration test: collapse-hidden child never captured |

---

### Task 1: System — types, utility functions, and unit tests

**Files:**
- Modify: `packages/system/src/xyhandle/types.ts` (line 17–43, `OnPointerDownParams`)
- Modify: `packages/system/src/xyhandle/utils.ts` (lines 5–21 `getNodesWithinDistance`; lines 93–153 `getFloatingDropTarget`; lines 29–77 `getClosestHandle`)
- Modify: `packages/system/src/xyhandle/utils.spec.ts` (append new `describe` blocks)

**Exact function signatures chosen:**

```ts
// utils.ts — internal helper (unexported)
function getNodesWithinDistance(
  position: XYPosition,
  nodeLookup: NodeLookup,
  distance: number,
  isNodeVisible?: (node: InternalNodeBase) => boolean,
): InternalNodeBase[]

// utils.ts — exported
export function getClosestHandle(
  position: XYPosition,
  connectionRadius: number,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null },
  isNodeVisible?: (node: InternalNodeBase) => boolean,
): Handle | null

// utils.ts — exported
export function getFloatingDropTarget(
  position: XYPosition,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null },
  isNodeVisible?: (node: InternalNodeBase) => boolean,
): Handle | null
```

`getClosestHandle` passes `isNodeVisible` straight to `getNodesWithinDistance`; no other changes needed in `getClosestHandle` itself because eligibility filtering happens in `getNodesWithinDistance` before handles are examined.

- [ ] **Step 1: Add `isNodeVisible` to `OnPointerDownParams`**

Open `packages/system/src/xyhandle/types.ts`. After line 40 (`getFromHandle: () => Handle | null;`) add the new optional field. The full updated type block becomes:

```ts
export type OnPointerDownParams = {
  autoPanOnConnect: boolean;
  connectionMode: ConnectionMode;
  connectionRadius: number;
  domNode: HTMLDivElement | null;
  handleId: string | null;
  nodeId: string;
  isTarget: boolean;
  nodeLookup: NodeLookup;
  lib: string;
  flowId: string | null;
  edgeUpdaterType?: HandleType;
  updateConnection: UpdateConnection;
  panBy: PanBy;
  cancelConnection: () => void;
  onConnectStart?: OnConnectStart;
  onConnect?: OnConnect;
  onConnectEnd?: OnConnectEnd;
  isValidConnection?: IsValidConnection;
  onReconnectEnd?: (evt: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => void;
  onConnectionTargetChange?: (nodeId: string | null) => void;
  getTransform: () => Transform;
  getFromHandle: () => Handle | null;
  autoPanSpeed?: number;
  dragThreshold?: number;
  handleDomNode: Element;
  /** Optional extra visibility check. Called only for nodes that already pass
   *  the `!node.hidden` guard. Return `false` to exclude a node from snap and
   *  drop-target search (e.g. collapse-hidden children). */
  isNodeVisible?: (node: InternalNodeBase) => boolean;
};
```

`InternalNodeBase` is NOT currently imported in `types.ts` (the existing import on line 1 only lists `ConnectionMode`, `Connection`, `OnConnect`, `OnConnectStart`, `HandleType`, `PanBy`, `Transform`, `Handle`, `OnConnectEnd`, `UpdateConnection`, `IsValidConnection`, `NodeLookup`, `FinalConnectionState`). Add it to the import:

```ts
import {
  ConnectionMode,
  type Connection,
  type OnConnect,
  type OnConnectStart,
  type HandleType,
  type PanBy,
  type Transform,
  type Handle,
  type OnConnectEnd,
  type UpdateConnection,
  type IsValidConnection,
  type InternalNodeBase,
  NodeLookup,
  FinalConnectionState,
} from '../types';
```

- [ ] **Step 2: Type-check the system package after Step 1**

```
pnpm -F @angflow/system typecheck
```

`InternalNodeBase` is defined in `packages/system/src/types/nodes.ts` and re-exported through `packages/system/src/types/index.ts` (which `xyhandle/types.ts` imports as `'../types'`), so no changes to `src/index.ts` or the types barrel are needed. This step just confirms there are no stray type errors introduced by the new import and field.

- [ ] **Step 3: Write failing tests for `getNodesWithinDistance` predicate behavior**

Append these tests to `packages/system/src/xyhandle/utils.spec.ts` (after the existing `getFloatingDropTarget` describe block). They import `getClosestHandle` and `getFloatingDropTarget` — `getNodesWithinDistance` is internal/unexported, so we test its predicate contract through `getClosestHandle`.

```ts
// ── Predicate tests via getClosestHandle ──────────────────────────────────
// getNodesWithinDistance is an unexported helper; its predicate filtering
// is observable through getClosestHandle (which passes the predicate through).

import { getClosestHandle, getFloatingDropTarget } from './utils';
// (already imported at the top of the file — the existing import covers both)
```

Add a new describe block at the end of the file:

```ts
// ─── helper additions used by predicate tests ─────────────────────────────
// makeHandleNode: builds a node with a fixed (non-floating) handle so we can
// test getClosestHandle. Re-uses makeNode + adds a fixed target handle.
function makeHandleNode(
  id: string,
  opts: { x: number; y: number; width: number; height: number; zIndex?: number }
): any {
  return makeNode(id, {
    ...opts,
    fixedHandles: [{ id: 'h', type: 'target', position: Position.Left }],
  });
}

describe('getClosestHandle — isNodeVisible predicate', () => {
  it('predicate absent: node within connectionRadius is a candidate (current behaviour preserved)', () => {
    // Node A at (0,0) 100x50; its handle is at Left edge absolute (0, 25).
    // Pointer at (10, 25) is within connectionRadius=50 → should find a handle.
    const node = makeHandleNode('A', { x: 0, y: 0, width: 100, height: 50 });
    // We need handleBounds with a real position for getClosestHandle to compute distance.
    // Since makeNode leaves handle x/y at 0 and getHandlePosition reads positionAbsolute,
    // and the pointer is very close to (0, 25), the handle at x=0, y=0 is within radius 50.
    const result = getClosestHandle(
      { x: 5, y: 0 },
      50,
      makeLookup(node),
      { nodeId: 'B', type: 'source', id: null },
    );
    // getClosestHandle may return null if handle coordinates are 0,0 and distance > radius —
    // the point here is only that the predicate-absent path does NOT crash and mirrors
    // the existing hidden-guard logic.
    // We assert the call does not throw.
    expect(() =>
      getClosestHandle(
        { x: 5, y: 0 },
        50,
        makeLookup(node),
        { nodeId: 'B', type: 'source', id: null },
      )
    ).not.toThrow();
  });

  it('predicate returning false hides the node from getClosestHandle candidates', () => {
    const node = makeHandleNode('A', { x: 0, y: 0, width: 100, height: 50 });
    // Without predicate — might find or not find handle depending on coords.
    // With predicate always returning false — must return null regardless.
    const result = getClosestHandle(
      { x: 5, y: 0 },
      500, // large radius to ensure it would otherwise find the handle
      makeLookup(node),
      { nodeId: 'B', type: 'source', id: null },
      () => false, // predicate rejects all nodes
    );
    expect(result).toBeNull();
  });

  it('predicate returning false for one node still allows another node to be a candidate', () => {
    const nodeA = makeHandleNode('A', { x: 0, y: 0, width: 100, height: 50 });
    const nodeB = makeHandleNode('B', { x: 0, y: 0, width: 100, height: 50 });
    // Predicate hides A but allows B. Result should not be from node A.
    const result = getClosestHandle(
      { x: 5, y: 0 },
      500,
      makeLookup(nodeA, nodeB),
      { nodeId: 'C', type: 'source', id: null },
      (n) => n.id !== 'A',
    );
    // If a handle is found, it must not belong to A.
    if (result !== null) {
      expect(result.nodeId).not.toBe('A');
    }
    // (result may be null if B's handle is also at distance > radius after
    //  absolute position computation; the key assertion is that A is excluded)
  });

  it('predicate cannot resurrect a node.hidden node (hidden+predicate=true still excluded)', () => {
    const node = makeHandleNode('H', { x: 0, y: 0, width: 100, height: 50 });
    node.hidden = true; // set hidden flag
    const result = getClosestHandle(
      { x: 5, y: 0 },
      500,
      makeLookup(node),
      { nodeId: 'B', type: 'source', id: null },
      () => true, // predicate says visible — but hidden flag still wins
    );
    expect(result).toBeNull();
  });
});

describe('getFloatingDropTarget — isNodeVisible predicate', () => {
  it('predicate absent: existing behaviour unchanged (visible node is captured)', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.nodeId).toBe('A');
  });

  it('predicate returning false hides the node from getFloatingDropTarget', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
      () => false, // predicate rejects all nodes
    );
    expect(result).toBeNull();
  });

  it('predicate filtering one node still allows another overlapping node to be captured', () => {
    const lookup = makeLookup(
      makeNode('A', {
        x: 0, y: 0, width: 100, height: 50, zIndex: 5,
        floatingHandles: [{ id: 'a-auto', type: 'target', position: Position.Left }],
      }),
      makeNode('B', {
        x: 0, y: 0, width: 100, height: 50, zIndex: 1,
        floatingHandles: [{ id: 'b-auto', type: 'target', position: Position.Left }],
      }),
    );
    // Predicate hides A (higher z) — B should win instead.
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'C', type: 'source', id: null },
      (n) => n.id !== 'A',
    );
    expect(result?.nodeId).toBe('B');
  });

  it('predicate cannot resurrect a node.hidden node', () => {
    const hiddenNode = makeNode('H', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    });
    hiddenNode.hidden = true;
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      makeLookup(hiddenNode),
      { nodeId: 'B', type: 'source', id: null },
      () => true, // predicate says visible — hidden flag still wins
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to confirm they fail**

```
pnpm -F @angflow/system test src/xyhandle/utils.spec.ts
```

Expected: The new tests fail with errors like `Expected 1 argument but got 5` or the predicate-based assertions return wrong values — confirming the feature is not yet implemented.

- [ ] **Step 5: Implement the predicate in `getNodesWithinDistance`**

In `packages/system/src/xyhandle/utils.ts`, update `getNodesWithinDistance` (lines 5–21):

```ts
function getNodesWithinDistance(
  position: XYPosition,
  nodeLookup: NodeLookup,
  distance: number,
  isNodeVisible?: (node: InternalNodeBase) => boolean,
): InternalNodeBase[] {
  const nodes: InternalNodeBase[] = [];
  const rect = {
    x: position.x - distance,
    y: position.y - distance,
    width: distance * 2,
    height: distance * 2,
  };

  for (const node of nodeLookup.values()) {
    // Hidden nodes remain in nodeLookup (visibility filtering is render-level);
    // an invisible node must not be a snap candidate.
    if (node.hidden) continue;
    // Optional caller-supplied predicate (e.g. collapse-hidden children).
    // Composes with the hidden guard — predicate can only further exclude.
    if (isNodeVisible !== undefined && !isNodeVisible(node)) continue;
    if (getOverlappingArea(rect, nodeToRect(node)) > 0) {
      nodes.push(node);
    }
  }

  return nodes;
}
```

- [ ] **Step 6: Thread the predicate through `getClosestHandle`**

Update the `getClosestHandle` signature and its internal call (lines 29–77):

```ts
export function getClosestHandle(
  position: XYPosition,
  connectionRadius: number,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null },
  isNodeVisible?: (node: InternalNodeBase) => boolean,
): Handle | null {
  let closestHandles: Handle[] = [];
  let minDistance = Infinity;

  const closeNodes = getNodesWithinDistance(
    position,
    nodeLookup,
    connectionRadius + ADDITIONAL_DISTANCE,
    isNodeVisible,
  );

  // ... remainder of function body unchanged ...
```

Only the signature line and the `getNodesWithinDistance` call change. All handle-distance logic below is identical to the current code.

- [ ] **Step 7: Add the predicate parameter to `getFloatingDropTarget`**

Update the `getFloatingDropTarget` signature and its eligibility guard (lines 93–153). Only the signature and the node-eligibility block change:

```ts
export function getFloatingDropTarget(
  position: XYPosition,
  nodeLookup: NodeLookup,
  fromHandle: { nodeId: string; type: HandleType; id?: string | null },
  isNodeVisible?: (node: InternalNodeBase) => boolean,
): Handle | null {
  const oppositeType: HandleType = fromHandle.type === 'source' ? 'target' : 'source';

  let bestNode: InternalNodeBase | null = null;
  let bestZ = -Infinity;

  for (const node of nodeLookup.values()) {
    if (node.id === fromHandle.nodeId) continue;
    // Hidden nodes remain in nodeLookup (visibility filtering is render-level);
    // an invisible node must not capture connection drops or highlights.
    if (node.hidden) continue;
    // Optional caller-supplied predicate (e.g. collapse-hidden children).
    // Composes with the hidden guard — predicate can only further exclude.
    if (isNodeVisible !== undefined && !isNodeVisible(node)) continue;

    // ... remainder of the loop body unchanged (position bounds, floating handle check, z-index) ...
```

Everything from `const nx = node.internals?.positionAbsolute?.x ?? ...` onward is unchanged.

- [ ] **Step 8: Run tests — all must pass**

```
pnpm -F @angflow/system test src/xyhandle/utils.spec.ts
```

Expected: All tests (existing + new) pass.

- [ ] **Step 9: Commit**

```bash
git add packages/system/src/xyhandle/types.ts \
        packages/system/src/xyhandle/utils.ts \
        packages/system/src/xyhandle/utils.spec.ts
git commit -m "$(cat <<'EOF'
feat(system): isNodeVisible predicate on OnPointerDownParams + utils

Adds optional `isNodeVisible?(node) => boolean` to `OnPointerDownParams`.
Threads it through `getNodesWithinDistance`, `getClosestHandle`, and
`getFloatingDropTarget` so collapse-hidden nodes can never become snap
or drop-target candidates. Predicate composes with `node.hidden`; it
can only further restrict — never resurrect a hidden node.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: System — thread predicate through `XYHandle.onPointerDown` + rebuild

**Files:**
- Modify: `packages/system/src/xyhandle/XYHandle.ts` (lines 23–256, `onPointerDown` function)

**Threading points in `onPointerDown`:**

There are exactly two call sites to thread (both inside `onPointerMove`, the closure defined at line 126):

1. **Line 148–153** — `getClosestHandle` call:
   ```ts
   closestHandle = getClosestHandle(
     pointerInRenderer,
     connectionRadius,
     nodeLookup,
     fromHandle
   );
   ```
2. **Line 154–156** — `getFloatingDropTarget` call (executed when stage 1 returns null):
   ```ts
   if (!closestHandle) {
     closestHandle = getFloatingDropTarget(pointerInRenderer, nodeLookup, fromHandle);
   }
   ```

The predicate must also be captured in `onPointerDown`'s destructuring (line 26–51) so the `onPointerMove` closure closes over it.

- [ ] **Step 1: Write a failing test for `XYHandle.onPointerDown` predicate threading**

There is no dedicated `XYHandle.ts` spec. Add a new test file: `packages/system/src/xyhandle/XYHandle.spec.ts`.

The test strategy: mock `getClosestHandle` and `getFloatingDropTarget` via `vi.mock` to capture what arguments they are called with, then fire a synthetic `pointermove` event and assert the predicate was passed.

```ts
// packages/system/src/xyhandle/XYHandle.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XYHandle } from './XYHandle';

// We test that onPointerDown threads isNodeVisible into both utility calls.
// Mock the utils module so we can spy on argument lists without needing DOM.
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getClosestHandle: vi.fn(() => null),
    getFloatingDropTarget: vi.fn(() => null),
  };
});

import { getClosestHandle, getFloatingDropTarget } from './utils';

function makeFakeEvent(type: string, x = 50, y = 50): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
}

/** Minimal OnPointerDownParams for the threading test. */
function makeParams(isNodeVisible?: (n: any) => boolean) {
  // We need a real Element for handleDomNode (used in getHandleType).
  const handleEl = document.createElement('div');
  handleEl.classList.add('source');

  // domNode must return a real ClientRect — we stub getBoundingClientRect.
  const domNode = document.createElement('div');
  domNode.getBoundingClientRect = () =>
    ({ x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 } as DOMRect);

  // nodeLookup needs the fromHandle node (nodeId='N') so XYHandle can find
  // fromHandleInternal. Give it a minimal source handle.
  const sourceHandle = {
    id: 'h', nodeId: 'N', type: 'source' as const,
    position: 'left' as any,
    x: 0, y: 0, width: 10, height: 10,
  };
  const nodeLookup = new Map([
    ['N', {
      id: 'N',
      position: { x: 0, y: 0 },
      measured: { width: 100, height: 50 },
      internals: {
        positionAbsolute: { x: 0, y: 0 },
        z: 0,
        handleBounds: { source: [sourceHandle], target: [] },
      },
    }],
  ]);

  return {
    autoPanOnConnect: false,
    connectionMode: 'strict' as any,
    connectionRadius: 50,
    domNode,
    handleId: 'h',
    nodeId: 'N',
    isTarget: false,
    nodeLookup: nodeLookup as any,
    lib: 'ng',
    flowId: 'flow-1',
    updateConnection: vi.fn(),
    panBy: vi.fn(),
    cancelConnection: vi.fn(),
    getTransform: () => [1, 0, 0] as any,
    getFromHandle: () => sourceHandle as any,
    dragThreshold: 0,
    handleDomNode: handleEl,
    isNodeVisible,
  };
}

describe('XYHandle.onPointerDown — isNodeVisible threading', () => {
  beforeEach(() => {
    vi.mocked(getClosestHandle).mockClear();
    vi.mocked(getFloatingDropTarget).mockClear();
  });

  it('passes isNodeVisible to getClosestHandle on pointermove', () => {
    const predicate = vi.fn(() => true);
    const params = makeParams(predicate);

    const downEvt = makeFakeEvent('mousedown');
    XYHandle.onPointerDown(downEvt, params);

    const moveEvt = makeFakeEvent('mousemove', 100, 100);
    document.dispatchEvent(moveEvt);

    expect(vi.mocked(getClosestHandle)).toHaveBeenCalled();
    const args = vi.mocked(getClosestHandle).mock.calls[0];
    // 5th argument (index 4) is the isNodeVisible predicate.
    expect(args[4]).toBe(predicate);
  });

  it('passes isNodeVisible to getFloatingDropTarget when stage 1 returns null', () => {
    vi.mocked(getClosestHandle).mockReturnValue(null);
    const predicate = vi.fn(() => true);
    const params = makeParams(predicate);

    const downEvt = makeFakeEvent('mousedown');
    XYHandle.onPointerDown(downEvt, params);

    const moveEvt = makeFakeEvent('mousemove', 100, 100);
    document.dispatchEvent(moveEvt);

    expect(vi.mocked(getFloatingDropTarget)).toHaveBeenCalled();
    const args = vi.mocked(getFloatingDropTarget).mock.calls[0];
    // 4th argument (index 3) is the isNodeVisible predicate.
    expect(args[3]).toBe(predicate);
  });

  it('absent isNodeVisible passes undefined to both utilities', () => {
    const params = makeParams(undefined);

    const downEvt = makeFakeEvent('mousedown');
    XYHandle.onPointerDown(downEvt, params);

    const moveEvt = makeFakeEvent('mousemove', 100, 100);
    document.dispatchEvent(moveEvt);

    if (vi.mocked(getClosestHandle).mock.calls.length > 0) {
      expect(vi.mocked(getClosestHandle).mock.calls[0][4]).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
pnpm -F @angflow/system test src/xyhandle/XYHandle.spec.ts
```

Expected: Tests fail because `getClosestHandle` and `getFloatingDropTarget` are called without a 5th/4th argument.

- [ ] **Step 3: Update `onPointerDown` destructuring to capture `isNodeVisible`**

In `packages/system/src/xyhandle/XYHandle.ts`, add `isNodeVisible` to the destructured params object (lines 26–51):

```ts
function onPointerDown(
  event: MouseEvent | TouchEvent,
  {
    connectionMode,
    connectionRadius,
    handleId,
    nodeId,
    edgeUpdaterType,
    isTarget,
    domNode,
    nodeLookup,
    lib,
    autoPanOnConnect,
    flowId,
    panBy,
    cancelConnection,
    onConnectStart,
    onConnect,
    onConnectEnd,
    isValidConnection = alwaysValid,
    onReconnectEnd,
    onConnectionTargetChange,
    updateConnection,
    getTransform,
    getFromHandle,
    autoPanSpeed,
    dragThreshold = 1,
    handleDomNode,
    isNodeVisible,
  }: OnPointerDownParams
) {
```

- [ ] **Step 4: Thread `isNodeVisible` into both calls inside `onPointerMove`**

In `XYHandle.ts`, update the two calls inside `onPointerMove`:

```ts
    closestHandle = getClosestHandle(
      pointerInRenderer,
      connectionRadius,
      nodeLookup,
      fromHandle,
      isNodeVisible,
    );
    if (!closestHandle) {
      closestHandle = getFloatingDropTarget(pointerInRenderer, nodeLookup, fromHandle, isNodeVisible);
    }
```

- [ ] **Step 5: Run all system tests**

```
pnpm -F @angflow/system test src/xyhandle/XYHandle.spec.ts
pnpm -F @angflow/system test src/xyhandle/utils.spec.ts
```

Expected: All pass.

- [ ] **Step 6: Build the system package (required before angular tests)**

```
pnpm -F @angflow/system build
```

Expected: Exits 0 with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/system/src/xyhandle/XYHandle.ts \
        packages/system/src/xyhandle/XYHandle.spec.ts
git commit -m "$(cat <<'EOF'
feat(system): thread isNodeVisible through XYHandle.onPointerDown

Destructs `isNodeVisible` from `OnPointerDownParams` and passes it to
`getClosestHandle` and `getFloatingDropTarget` inside the pointermove
closure, so the predicate is re-evaluated on every snap re-check
(honoring mid-drag collapse changes).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Angular — wire both call sites + integration test

**Files:**
- Modify: `packages/angular/src/lib/components/handle/handle.component.ts` (line 142–174, `XYHandle.onPointerDown` call)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (~line 678, `XYHandle.onPointerDown` call in `handleEdgeReconnect`)
- Modify: `packages/angular/src/lib/components/handle/handle.component.spec.ts` (append integration test)

**Important:** Both call sites currently cast to `as any`. Do NOT remove these casts — that is Cluster 5's job. Adding `isNodeVisible` to the literal object inside the cast is enough; TypeScript will be satisfied once the field exists on `OnPointerDownParams`.

- [ ] **Step 1: Write failing integration test for collapse-hidden node not being captured**

Append to `packages/angular/src/lib/components/handle/handle.component.spec.ts`:

```ts
// ── Integration: collapse-hidden child is never a connection drop candidate ──
//
// Strategy: we don't fire real pointer events (XYHandle.onPointerDown uses
// document-level event listeners that are hard to drive in jsdom). Instead we
// test the predicate closure that the component would supply to XYHandle.
// This is the correct boundary to test: the component's responsibility is to
// build the right predicate; XYHandle's responsibility to call it is covered
// by the system-level XYHandle.spec.ts tests.

import { signal } from '@angular/core';
// FlowStore is already imported above.

describe('HandleComponent — isNodeVisible predicate for collapsedHiddenIds', () => {
  it('returns false for a node in collapsedHiddenIds and true for a visible node', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-source' },
      ],
    });

    const store = TestBed.inject(FlowStore);

    // Populate the store with a group containing a collapsed child.
    // We drive collapsedHiddenIds by setting a collapsed group node via setNodes.
    // FlowStore.setNodes populates nodeLookup which getCollapsedHiddenIds reads.
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
      { id: 'visible', position: { x: 200, y: 200 }, data: {} },
    ] as any[]);

    // collapsedHiddenIds should now include 'child' but not 'group' or 'visible'.
    const hiddenIds = store.collapsedHiddenIds();
    expect(hiddenIds.has('child')).toBe(true);
    expect(hiddenIds.has('group')).toBe(false);
    expect(hiddenIds.has('visible')).toBe(false);

    // Build the exact predicate the component passes to XYHandle.onPointerDown.
    const predicate = (n: { id: string }) => !store.collapsedHiddenIds().has(n.id);

    // A collapse-hidden child must not be a candidate.
    expect(predicate({ id: 'child' })).toBe(false);
    // The group node itself is visible.
    expect(predicate({ id: 'group' })).toBe(true);
    // A completely separate visible node is a candidate.
    expect(predicate({ id: 'visible' })).toBe(true);
    // An arbitrary unknown node defaults to visible.
    expect(predicate({ id: 'unknown' })).toBe(true);
  });

  it('predicate reflects signal reactivity: after expanding group child becomes visible', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HandleComponent],
      providers: [
        provideZonelessChangeDetection(),
        FlowStore,
        { provide: NODE_ID, useValue: 'node-source' },
      ],
    });

    const store = TestBed.inject(FlowStore);

    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
    ] as any[]);

    const predicate = (n: { id: string }) => !store.collapsedHiddenIds().has(n.id);

    expect(predicate({ id: 'child' })).toBe(false);

    // Expand the group — setNodes with collapsed:false.
    store.setNodes([
      { id: 'group', position: { x: 0, y: 0 }, data: {}, collapsed: false },
      { id: 'child', position: { x: 10, y: 10 }, data: {}, parentId: 'group' },
    ] as any[]);

    // Now the predicate must return true for the child (no longer hidden).
    expect(predicate({ id: 'child' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the integration test to confirm it fails (store wiring not yet done)**

```
pnpm -F @angflow/angular test src/lib/components/handle/handle.component.spec.ts
```

Expected: The new tests fail because the predicate logic is not yet tested against a real `collapsedHiddenIds` signal from the store. (The test itself is what drives the wiring; if the store works correctly and `setNodes` populates `collapsedHiddenIds`, they may actually pass already — in that case, move to Step 4 and verify the call sites next.)

- [ ] **Step 3: Add `isNodeVisible` at `handle.component.ts` call site**

In `packages/angular/src/lib/components/handle/handle.component.ts`, inside the `onPointerDown` method, add `isNodeVisible` to the params object passed to `XYHandle.onPointerDown` (line 142–174). Insert it after `handleDomNode` and before the closing `} as any`:

```ts
    XYHandle.onPointerDown(event, {
      autoPanOnConnect: store.autoPanOnConnect(),
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: this.handleId(),
      nodeId: this.nodeId,
      isTarget,
      nodeLookup: store.nodeLookup,
      lib: 'ng',
      flowId: store.rfId(),
      updateConnection: (connection: ConnectionState) => store.updateConnection(connection),
      panBy: (delta: { x: number; y: number }) => store.panBy(delta),
      cancelConnection: () => store.cancelConnection(),
      onConnect: (connection: Connection) => {
        this.handleConnect.emit(connection);
        store.onConnect?.(connection);
      },
      onConnectStart: (event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: HandleType | null }) => store.onConnectStart?.(event, params),
      onConnectEnd: (event: MouseEvent | TouchEvent) => store.onConnectEnd?.(event),
      onConnectionTargetChange: (nodeId: string | null) => {
        store.connectionTargetNodeId.set(nodeId);
      },
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: 0,
      handleDomNode: this.el.nativeElement,
      isValidConnection: validationFn,
      isNodeVisible: (n) => !store.collapsedHiddenIds().has(n.id),
    } as any);
```

- [ ] **Step 4: Add `isNodeVisible` at `edge-renderer.component.ts` reconnect call site**

In `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`, inside `handleEdgeReconnect`, add `isNodeVisible` to the params object passed to `XYHandle.onPointerDown` (~line 678–713). Insert it after `onConnectionTargetChange` and before the closing `} as any`:

```ts
    XYHandle.onPointerDown(event, {
      autoPanOnConnect: store.autoPanOnConnect(),
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: oppositeHandle.id,
      nodeId: oppositeHandle.nodeId,
      nodeLookup: store.nodeLookup,
      isTarget,
      edgeUpdaterType: oppositeHandle.type,
      lib: 'ng',
      flowId: store.rfId(),
      cancelConnection: () => store.cancelConnection(),
      panBy: (delta: { x: number; y: number }) => store.panBy(delta),
      updateConnection: (conn: ConnectionState) => store.updateConnection(conn),
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: store.connectionDragThreshold(),
      handleDomNode: event.currentTarget as Element,
      isValidConnection: store.isValidConnection(),
      onConnect: (connection: Connection) => {
        this.reconnect.emit({ edge, connection });
      },
      onReconnectEnd: (evt: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
        this.reconnectingEdgeId.set(null);
        this.hoveredAnchorEdgeId.set(null);
        this.reconnectEnd.emit({ event: evt, edge, handleType: oppositeHandle.type, connectionState });
      },
      onConnectionTargetChange: (nodeId: string | null) => {
        store.connectionTargetNodeId.set(nodeId);
      },
      isNodeVisible: (n) => !store.collapsedHiddenIds().has(n.id),
    } as any);
```

- [ ] **Step 5: Run integration tests**

```
pnpm -F @angflow/angular test src/lib/components/handle/handle.component.spec.ts
```

Expected: All tests (existing + new) pass.

- [ ] **Step 6: Run full angular test suite**

```
pnpm -F @angflow/angular test
```

Expected: All tests pass.

- [ ] **Step 7: Run typecheck**

```
pnpm -F @angflow/angular typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 8: Full gate (from repo root)**

Run all three packages' test suites in order, then lint and typecheck:

```
pnpm -F @angflow/system build
pnpm -F @angflow/system test
pnpm -F @angflow/angular test
pnpm -F @angflow/mcp test
pnpm -F @angflow/system typecheck
pnpm -F @angflow/angular typecheck
```

Expected: All exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/angular/src/lib/components/handle/handle.component.ts \
        packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
        packages/angular/src/lib/components/handle/handle.component.spec.ts
git commit -m "$(cat <<'EOF'
feat(angular): wire isNodeVisible predicate at both XYHandle call sites

Both handle.component.ts and edge-renderer.component.ts (reconnect path)
now pass `isNodeVisible: (n) => !store.collapsedHiddenIds().has(n.id)`.
The closure reads the signal at call time, so mid-drag collapse changes
are honoured on the next pointermove evaluation. Adds integration tests
verifying that a collapse-hidden child can never become a drop candidate.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
