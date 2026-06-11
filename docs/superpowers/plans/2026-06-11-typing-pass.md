# Typing Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every `as any` in `packages/angular/src` production code by fixing the underlying system types the casts paper over. `as unknown as` survives only where TypeScript variance genuinely requires it, each with a one-line justification comment. Then flip `@typescript-eslint/no-explicit-any` to `error` for the angular package's production `src/**` so new `any` is blocked.

**Architecture:** System type fixes are **additive only** — `OnPointerDownParams` gains a node-type generic with a default; `PanZoomUpdateOptions` makes two already-declared fields optional. `packages/react` and `packages/svelte` must compile unchanged (verified below: both pass the affected fields, so relaxing required→optional and adding a defaulted generic is source-compatible). Angular-side fixes use generics and small documented helpers; the few remaining `as unknown as` are variance-forced and carry justification comments.

**Tech Stack:** TypeScript 5.9.3, Angular signals (zoneless), typescript-eslint 8.34.0 (eslint 9.29.0), vitest. pnpm monorepo.

**Part of:** 2026-06-11-deferred-work-master.md (Cluster 5). Runs after Clusters 1-4.

> **Line numbers in this plan are as of 2026-06-11 pre-cluster-1.** Clusters 1-4 land first and WILL shift line numbers (cluster 3 added `isNodeVisible` to `OnPointerDownParams`; cluster 1 may have already fixed the edge-toolbar `zIndex` cast; cluster 4 added selection-box XYDrag wiring). **Re-locate every edit by the quoted code context, not the line number.** Where a cited cast is already gone (e.g. edge-toolbar `zIndex`), the step says so and becomes a verify-only no-op.

---

## Field-mismatch findings (audited 2026-06-11)

These are the concrete reasons each whole-object `as any` exists. The plan resolves each one specifically.

### `XYHandle.onPointerDown` params (`handle.component.ts` + `edge-renderer.component.ts`)

Every field name Angular passes IS declared on `OnPointerDownParams` — the cast is **not** about missing/extra fields. It is two **type-direction** mismatches:

1. **`nodeLookup`** — Angular passes `store.nodeLookup: NodeLookup<InternalNodeBase<NodeType>>`; the param is the bare `NodeLookup = Map<string, InternalNodeBase>`. `Map` is invariant in its value type (its `set(v)` is contravariant), so `Map<string, InternalNodeBase<NodeType>>` is **not** assignable to `Map<string, InternalNodeBase>`. → Fix in the **system type**: make `OnPointerDownParams` generic over the node type with a default (`NodeType extends InternalNodeBase = InternalNodeBase`).
2. **`isValidConnection`** — Angular passes the store validator typed `(connection: EdgeType | Connection) => boolean` (handle also unions a per-handle `(connection: Connection) => boolean`); the param is `IsValidConnection = (edge: EdgeBase | Connection) => boolean`. Function params are contravariant, and `EdgeBase` is **not** assignable to `EdgeType` / `Connection`, so neither variant is assignable to `IsValidConnection`. This is genuine variance — the validator is only ever *called* with a `Connection` inside the system, so it is safe but TS cannot prove it. → Fix in the **Angular call**: scope a single justified `as unknown as IsValidConnection` to **just this one field**, deleting the whole-object `as any`.

No other field on either call site mismatches (`updateConnection`, `getFromHandle`, `onConnectStart`, `onConnect`, `onConnectEnd`, `onReconnectEnd`, `onConnectionTargetChange`, `panBy`, `getTransform`, scalars — all align). The edge-renderer site has no per-handle validator; it passes `store.isValidConnection()` only.

### `panZoomInstance.update(...)` options (`ng-flow.component.ts`)

Angular passes 14 fields, all declared on `PanZoomUpdateOptions`. The cast exists because the type declares two **required** fields Angular **omits**:

- `zoomActivationKeyPressed: boolean` — **required, omitted** (read at `XYPanZoom.ts` `update`: `isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && ...` and passed to `createFilter`).
- `connectionInProgress: boolean` — **required, omitted** (passed to `createFilter`).
- `onPaneContextMenu?` and `selectionOnDrag?` are already optional — fine to omit.

Behavior today (under `as any`): both omitted fields read as `undefined` → falsy. To preserve that exact behavior additively, make both fields **optional** in `PanZoomUpdateOptions` (React/Svelte still pass them — verified — so they stay source-compatible). Delete the cast.

### `ConnectionState` narrowing (`flow-store.service.ts`)

`ConnectionState = ConnectionInProgress<NodeType> | NoConnection` already discriminates on `inProgress`. The site guards `conn.inProgress` immediately before reading `.fromNode`/`.fromHandle`, so after the guard `conn` narrows to `ConnectionInProgress` and both fields exist. **Narrowing suffices — no type change needed**; just delete the two `as any`.

### `as unknown as` survivor accounting (14 production sites today)

Collapsed by this plan: `ng-flow.component.ts` 240, 241, 278, 281; `ng-flow.service.ts` 53, 715, 943, 957, 970 (9 sites → 0 at call sites).
Survive with justification comment (variance/boundary-forced): `ng-flow.service.ts` 424 (`userNode → InternalNode` fallback), 427 (`Omit<O & …> → O` opts spread); `agent-bridge.service.ts` 260 (`null` stub for `list_flows` which ignores the service arg); `transports/window.ts` 49, 88 (`window → Record<string, unknown>` to attach/detach a namespace key). The 3 inject casts move *inside* the new helpers (still `as unknown as`, but one documented site each).

### eslint spec-file decision

`grep` counts in `packages/angular/src`: **30** `as any` and **32** total explicit-`any` usages in `**/*.spec.ts`; production non-spec has **7** `as any`. 30 test casts is a large, low-value retyping surface (partial-mock casts), so per the design's allowance the rule is **scoped off for spec files** via a flat-config override (`files: ['**/*.spec.ts']` → rule `off`) and **`error` for production `src/**`**. Production also carries ~38 *intentional* boundary `: any` declarations (node/edge `data = input<any>()`, `changes.ts`, `type-guards.ts`, `store.ts` interface fields, drag-callback params, `Record<string, any>`, `TemplateRef<any>`) that are explicitly out of scope to retype (design line 47); these get enumerated inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any` disables with a short reason so the rule stays genuinely `error` without scope creep.

---

### Task 1: System `OnPointerDownParams` — generic node type + delete both `as any`

**Files:**
- `packages/system/src/xyhandle/types.ts`
- `packages/angular/src/lib/components/handle/handle.component.ts`
- `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`

Pure-type change: the failing-before / passing-after signal is `pnpm -F @angflow/system build` + `pnpm typecheck`, plus the existing handle/connection suites proving no behavior regression.

- [ ] Re-locate `OnPointerDownParams` in `packages/system/src/xyhandle/types.ts` (the `export type OnPointerDownParams = {` block). Confirm its imports already include `NodeLookup` and `InternalNodeBase` — `NodeLookup` is imported; **add `InternalNodeBase`** to the import from `'../types'` if absent.
- [ ] Make the type generic over the node type with a default and type `nodeLookup` through it. Replace the type header and the `nodeLookup` line:

```ts
export type OnPointerDownParams<NodeType extends InternalNodeBase = InternalNodeBase> = {
  autoPanOnConnect: boolean;
  connectionMode: ConnectionMode;
  connectionRadius: number;
  domNode: HTMLDivElement | null;
  handleId: string | null;
  nodeId: string;
  isTarget: boolean;
  nodeLookup: NodeLookup<NodeType>;
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
};
```

> Note: if cluster 3 added `isNodeVisible?: (...) => boolean` to this type, **keep that field** — re-apply the generic header and `nodeLookup` change around it, do not drop it.

- [ ] Update the `XYHandleInstance.onPointerDown` signature in the same file so the generic flows through (defaulted, so call sites that don't specify it still work):

```ts
export type XYHandleInstance = {
  onPointerDown: <NodeType extends InternalNodeBase = InternalNodeBase>(
    event: MouseEvent | TouchEvent,
    params: OnPointerDownParams<NodeType>
  ) => void;
  isValid: (event: MouseEvent | TouchEvent, params: IsValidParams) => Result;
};
```

Add `InternalNodeBase` to the type imports if not already present (`import { … NodeLookup, InternalNodeBase, FinalConnectionState } from '../types';`).
- [ ] `XYHandle.ts`'s `onPointerDown(event, { … }: OnPointerDownParams)` destructure keeps the **default** `OnPointerDownParams` (no node type) — no change needed; the function body uses `nodeLookup.get(...)` which still returns `InternalNodeBase`. Verify it still compiles (it does — default generic). Do **not** widen the implementation signature.
- [ ] Build system so angular sees the new types:

```bash
pnpm -F @angflow/system build
```

- [ ] Re-locate the `XYHandle.onPointerDown(event, { … } as any);` block in `handle.component.ts` (`onPointerDown(event: MouseEvent | PointerEvent)`). Delete the trailing `} as any);`. Because `store.nodeLookup` is `NodeLookup<InternalNodeBase<NodeType>>`, the call now infers `NodeType` from `nodeLookup` and type-checks every field — except `isValidConnection`, which is variance-incompatible. Scope a single justified cast to that one field. Final block tail:

```ts
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: 0,
      handleDomNode: this.el.nativeElement,
      // Variance-forced: validator is declared (NodeType|Connection)=>boolean but the
      // system only ever calls it with a Connection; contravariance blocks a direct assign.
      isValidConnection: validationFn as unknown as IsValidConnection,
    });
```

Confirm `IsValidConnection` is already imported in `handle.component.ts` (it is — `type IsValidConnection` from `@angflow/system`).
- [ ] Re-locate the `XYHandle.onPointerDown(event, { … } as any);` block in `edge-renderer.component.ts` (`startReconnect`/reconnect path, `oppositeHandle`). Delete `} as any);`. This site passes `isValidConnection: store.isValidConnection()`. Apply the same one-field cast:

```ts
      handleDomNode: event.currentTarget as Element,
      // Variance-forced: validator is declared (EdgeType|Connection)=>boolean but the
      // system only ever calls it with a Connection; contravariance blocks a direct assign.
      isValidConnection: store.isValidConnection() as unknown as IsValidConnection,
      onConnect: (connection: Connection) => {
```

Ensure `IsValidConnection` is imported in `edge-renderer.component.ts` from `@angflow/system`; add it to the existing `@angflow/system` import if missing.
- [ ] Confirm React/Svelte still compile against the additive change (they pass their own `nodeLookup`, inferring the generic; defaulted, so untyped callers unaffected):

```bash
pnpm -F @angflow/system run typecheck
```

- [ ] Gate this task:

```bash
pnpm -F @angflow/angular run test
pnpm -F @angflow/angular run typecheck
```

- [ ] Commit:

```
fix(types): generic OnPointerDownParams node type; drop whole-object as-any on XYHandle calls

OnPointerDownParams is now generic over the lookup node type (defaulted, additive —
react/svelte unchanged). Both Angular onPointerDown calls drop their `as any`; only the
contravariance-blocked isValidConnection field keeps a justified single-field cast.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```

---

### Task 2: System `PanZoomUpdateOptions` — make omitted-required fields optional + delete `as any`

**Files:**
- `packages/system/src/types/panzoom.ts`
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`

Pure-type change: failing-before / passing-after is `pnpm -F @angflow/system build` then angular `typecheck`; the pan/zoom interaction suites are the behavior net.

- [ ] In `packages/system/src/types/panzoom.ts`, re-locate `PanZoomUpdateOptions`. Make `zoomActivationKeyPressed` and `connectionInProgress` **optional** (they are the only two required fields the Angular caller omits; both are read in `XYPanZoom.ts` `update`, falling back to falsy when absent — preserving today's behavior):

```ts
export type PanZoomUpdateOptions = {
  noWheelClassName: string;
  noPanClassName: string;
  onPaneContextMenu?: (event: MouseEvent) => void;
  preventScrolling: boolean;
  panOnScroll: boolean;
  panOnDrag: boolean | number[];
  panOnScrollMode: PanOnScrollMode;
  panOnScrollSpeed: number;
  userSelectionActive: boolean;
  zoomOnPinch: boolean;
  zoomOnScroll: boolean;
  zoomOnDoubleClick: boolean;
  zoomActivationKeyPressed?: boolean;
  lib: string;
  onTransformChange: OnTransformChange;
  connectionInProgress?: boolean;
  paneClickDistance: number;
  selectionOnDrag?: boolean;
};
```

> `XYPanZoom.ts` `update({ …, zoomActivationKeyPressed, …, connectionInProgress, … })` destructures these without a default; when omitted they are `undefined` (falsy) — identical to the current `as any` behavior. No `XYPanZoom.ts` change required. (Optionally default them to `false` in the destructure for clarity, but it is not necessary and changes no behavior — skip to stay minimal.)

- [ ] Build system:

```bash
pnpm -F @angflow/system build
```

- [ ] Re-locate `updatePanZoomOptions()` in `ng-flow.component.ts` (`this.panZoomInstance?.update({ … } as any);`). Delete the trailing `} as any);` → `});`. The object now type-checks: `panOnDrag` is `boolean | number[]`, the omitted fields are optional, `onTransformChange`/`lib`/scalars all align.

```ts
      onTransformChange: (transform: Transform) => {
        this.store.transform.set(transform);
      },
      paneClickDistance: this.paneClickDistance(),
    });
  }
```

- [ ] Confirm React/Svelte unaffected (both pass `zoomActivationKeyPressed`/`connectionInProgress` — verified — and required→optional is additive):

```bash
pnpm -F @angflow/system run typecheck
```

- [ ] Gate:

```bash
pnpm -F @angflow/angular run test
pnpm -F @angflow/angular run typecheck
```

- [ ] Commit:

```
fix(types): make zoomActivationKeyPressed/connectionInProgress optional on PanZoomUpdateOptions

These two fields are read with a falsy fallback in XYPanZoom.update; Angular never passed
them, relying on `as any`. Optional makes the Angular call type-check while staying additive
(react/svelte still pass them). Whole-object cast deleted.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```

---

### Task 3: `ConnectionState` — narrow instead of `as any`

**Files:**
- `packages/angular/src/lib/services/flow-store.service.ts`

No type change — `ConnectionInProgress` already declares `fromNode`/`fromHandle`. Failing-before / passing-after is `typecheck`; the existing connection-update suite is the behavior net. If the suite does not already cover the in-progress `from` rewrite during drag, add a pinning test (below).

- [ ] Re-locate the two casts in `updateNodePositions(...)` — the `if (node && conn.inProgress && (conn as any).fromNode?.id === node.id)` block. After `conn.inProgress` the compiler narrows `conn` to `ConnectionInProgress`, so drop both `as any`:

```ts
      if (node && conn.inProgress && conn.fromNode?.id === node.id) {
        const updatedFrom = getHandlePosition(node, conn.fromHandle, Position.Left, true);
        this.updateConnection({ ...conn, from: updatedFrom });
      }
```

> `conn` is `this.connection()` (typed `ConnectionState`). Confirm the local `const conn = this.connection();` is still above this block (it is at the top of `updateNodePositions`). The narrowing relies on `conn` not being reassigned between the guard and use — it is not.

- [ ] Decide on a pinning test: search the existing flow-store / connection specs for coverage of "drag the from-node while a connection is in progress updates `connection().from`". If **absent**, add a focused spec asserting that when `connection().inProgress` is true and `updateNodePositions` moves the `fromNode`, `connection().from` is recomputed (the branch this narrowing now type-checks). If already covered, skip — note which spec covers it in the commit body.

```bash
pnpm -F @angflow/angular run test
pnpm -F @angflow/angular run typecheck
```

- [ ] Commit:

```
fix(store): narrow ConnectionState instead of casting fromNode/fromHandle

conn.inProgress already discriminates to ConnectionInProgress, which declares fromNode and
fromHandle; the two `as any` casts were redundant.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```

---

### Task 4: `injectFlowStore` / `injectNgFlowService` helpers — collapse the 3 inject casts

**Files:**
- `packages/angular/src/lib/utils/inject-flow-store.ts` (new)
- `packages/angular/src/lib/utils/index.ts`
- `packages/angular/src/lib/services/ng-flow.service.ts`
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`

Behavior-preserving refactor (DI generic erasure). `typecheck` + the full angular suite are the net.

- [ ] Create `packages/angular/src/lib/utils/inject-flow-store.ts`. The variance cast is unavoidable — the DI token `FlowStore` erases the `<NodeType, EdgeType>` generics — so it is documented once here:

```ts
import { inject } from '@angular/core';
import { FlowStore } from '../services/flow-store.service';
import { NgFlowService } from '../services/ng-flow.service';
import type { Node, Edge } from '../types';

/**
 * Injects the ambient {@link FlowStore} re-parameterised to the caller's node/edge types.
 *
 * The `FlowStore` DI token is generic-erased, so a single documented variance cast lives
 * here rather than at every call site. The runtime instance is identical regardless of
 * generics — this only refines the static type.
 */
export function injectFlowStore<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): FlowStore<NodeType, EdgeType> {
  // Variance-forced: DI tokens erase generics; the runtime store is the same instance.
  return inject(FlowStore) as unknown as FlowStore<NodeType, EdgeType>;
}

/**
 * Injects the ambient {@link NgFlowService} re-parameterised to the caller's node/edge types.
 * Same generic-erasure rationale as {@link injectFlowStore}.
 */
export function injectNgFlowService<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): NgFlowService<NodeType, EdgeType> {
  // Variance-forced: DI tokens erase generics; the runtime service is the same instance.
  return inject(NgFlowService) as unknown as NgFlowService<NodeType, EdgeType>;
}
```

> If a circular-import warning surfaces (`ng-flow.service.ts` ↔ this helper), keep the helper in `utils/` and import `NgFlowService`/`FlowStore` lazily is **not** needed — they are classes, not values used at module-eval time here; the `inject(...)` call runs at construction. Verify the build is clean; if Angular's compiler flags a cycle, split `injectNgFlowService` into its own file next to `ng-flow.service.ts`.

- [ ] Export the helpers from `packages/angular/src/lib/utils/index.ts`:

```ts
export { applyNodeChanges, applyEdgeChanges, applyDimensionChanges, createSelectionChange, getSelectionChanges, getElementsDiffChanges, elementToRemoveChange } from './changes';
export { injectNgFlowNode } from './inject-ng-flow-node';
export { injectFlowStore, injectNgFlowService } from './inject-flow-store';
```

- [ ] In `ng-flow.service.ts`, re-locate `private store = inject(FlowStore) as unknown as FlowStore<NodeType, EdgeType>;` and replace with the helper. Add the import:

```ts
import { injectFlowStore } from '../utils/inject-flow-store';
```

```ts
  private store = injectFlowStore<NodeType, EdgeType>();
```

- [ ] In `ng-flow.component.ts`, re-locate the two inject casts (`readonly store = inject(FlowStore) as unknown as …;` and `readonly service = inject(NgFlowService) as unknown as …;`). Add the import and replace:

```ts
import { injectFlowStore, injectNgFlowService } from '../../utils/inject-flow-store';
```

```ts
  readonly store = injectFlowStore<NodeType, EdgeType>();
  readonly service = injectNgFlowService<NodeType, EdgeType>();
```

> Verify the relative import depth (`ng-flow.component.ts` is at `src/lib/container/ng-flow/` → `../../utils/inject-flow-store`).

- [ ] Gate:

```bash
pnpm -F @angflow/angular run test
pnpm -F @angflow/angular run typecheck
```

- [ ] Commit:

```
refactor(di): injectFlowStore/injectNgFlowService helpers centralize the generic-erasure cast

The three `inject(FlowStore/NgFlowService) as unknown as …<NodeType, EdgeType>` call sites
now route through two helpers carrying the single documented variance cast.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```

---

### Task 5: Graph-util generics — collapse 4 `as unknown as` into typed flows

**Files:**
- `packages/angular/src/lib/services/ng-flow.service.ts`

The system utils (`getConnectedEdges`/`getIncomers`/`getOutgoers`) are already generic `<NodeType extends NodeBase, EdgeType extends EdgeBase>` returning `EdgeType[]`/`NodeType[]`; passing explicit type args removes the return casts. `typecheck` + connection-query suite are the net.

- [ ] Re-locate `getConnectedEdges(nodeIds: string | string[])`. `this.store.edges()` is already `EdgeType[]` (extends `EdgeBase[]`), so it can pass directly; supplying `<NodeBase, EdgeType>` makes the return `EdgeType[]` with no cast. The `{ id }` node objects keep the benign `as NodeBase[]` structural cast (not `as any`/`as unknown as`):

```ts
  getConnectedEdges(nodeIds: string | string[]): EdgeType[] {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    // getConnectedEdges only reads `.id`; pass id-only stubs as NodeBase.
    const nodeObjects = ids.map(id => ({ id })) as NodeBase[];
    return getConnectedEdgesSystem<NodeBase, EdgeType>(nodeObjects, this.store.edges());
  }
```

- [ ] Re-locate `selectOutgoers(nodeId)`. `node` is `NodeType` (from `nodes.find`), `nodes` is `NodeType[]`, `edges` is `EdgeType[]` — all match the generic, so drop the `edges as EdgeBase[]` and the return cast:

```ts
  selectOutgoers(nodeId: string): Signal<NodeType[]> {
    return computed(() => {
      this.store.version();
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return [];
      return getOutgoersSystem<NodeType, EdgeType>(node, nodes, edges);
    });
  }
```

- [ ] Re-locate `selectIncomers(nodeId)` and apply the identical treatment:

```ts
  selectIncomers(nodeId: string): Signal<NodeType[]> {
    return computed(() => {
      this.store.version();
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return [];
      return getIncomersSystem<NodeType, EdgeType>(node, nodes, edges);
    });
  }
```

- [ ] Re-locate `selectConnectedEdges(nodeId)`. Supply `<NodeBase, EdgeType>`; the `{ id: nodeId }` stub keeps `as NodeBase[]`, `this.store.edges()` passes directly:

```ts
  selectConnectedEdges(nodeId: string): Signal<EdgeType[]> {
    return computed(() => {
      this.store.version();
      return getConnectedEdgesSystem<NodeBase, EdgeType>(
        [{ id: nodeId }] as NodeBase[],
        this.store.edges()
      );
    });
  }
```

- [ ] Verify `applyLayout`'s two `as unknown as` (the `getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>)` fallback and `layoutOpts as unknown as O`) are **genuinely variance-forced** and add justification comments (they survive — a user `NodeType` is not structurally an `InternalNode<NodeType>`, and `Omit<O & {…}, 'animate'|'coordinateSpace'>` is not provably `O`):

```ts
    const nodes = this.withLiveMeasurements(
      // Fallback for not-yet-measured nodes: a user NodeType lacks `internals`/`measured`,
      // so it cannot be proven an InternalNode<NodeType>; layout reads only position/id.
      this.getNodes().map((n) => this.getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>)),
    );
    const edges = this.withLiveEdgeLabels(this.getEdges());
    // Omit<O & {animate,coordinateSpace}, 'animate'|'coordinateSpace'> is structurally O but
    // TS can't prove it; the stripped keys are exactly the two we destructured out.
    const positions = await layoutFn(nodes, edges, layoutOpts as unknown as O);
```

- [ ] Gate:

```bash
pnpm -F @angflow/angular run test
pnpm -F @angflow/angular run typecheck
```

- [ ] Commit:

```
refactor(types): pass explicit generics to graph utils; drop 4 as-unknown-as bridges

getConnectedEdges/getOutgoers/getIncomers are already generic over Node/Edge; supplying the
type args makes the returns typed. applyLayout's two genuinely variance-forced casts keep a
justification comment.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```

---

### Task 6: Input defaults + `userNode` mirror

**Files:**
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`
- `packages/angular/src/lib/services/flow-store.service.ts`

`typecheck` is the net; controlled-mode and position-mirror suites confirm no behavior change.

- [ ] Re-locate `nodesModel`/`edgesModel` inputs (`input<NodeType[]>([] as unknown as NodeType[], …)`). Replace the `as unknown as` defaults with a single benign `as NodeType[]` / `as EdgeType[]` on the empty literal (`never[]` → typed array is a valid single cast; not in the forbidden `as any` / `as unknown as` set):

```ts
  readonly nodesModel = input<NodeType[]>([] as NodeType[], { alias: 'nodes' });
```

```ts
  readonly edgesModel = input<EdgeType[]>([] as EdgeType[], { alias: 'edges' });
```

> If `typecheck` accepts the barer `input<NodeType[]>([], { alias: 'nodes' })` (TS may widen `[]` to `never[]`, assignable to `NodeType[]`), prefer that form — no cast at all. Try bare `[]` first; fall back to `[] as NodeType[]` only if the generic-input typing rejects it.

- [ ] Re-locate the `userNode as any` mirror in `triggerNodeChanges` (`const userNode = internalNode.internals?.userNode as any;` — the block that mirrors `position`/`dragging` onto the user node). Type the mirror via a scoped `Pick` of the writable fields rather than `any`:

```ts
        // Mirror the mutation onto the user-facing node reference so that
        // external consumers observing `nodes()` see consistent state.
        const userNode = internalNode.internals?.userNode as
          | Pick<NodeType, 'position' | 'dragging'>
          | undefined;
        if (userNode) {
          if (change.position) {
            userNode.position = change.position;
          }
          if (change.dragging !== undefined) {
            userNode.dragging = change.dragging;
          }
        }
```

> `NodeType extends Node` and `Node` declares `position` and `dragging?`, so the `Pick` is valid. `internals.userNode` is typed `NodeType` already on `InternalNodeBase<NodeType>` — confirm; if it is exactly `NodeType`, the `as Pick<…>` is a narrowing cast (allowed, not `as unknown as`). If `internals` is optional and `userNode` is non-optional under it, the `?.` keeps it `NodeType | undefined`, matching the annotation. Adjust the `Pick` form only if a field name differs; do **not** fall back to `any`.

- [ ] Gate:

```bash
pnpm -F @angflow/angular run test
pnpm -F @angflow/angular run typecheck
```

- [ ] Commit:

```
fix(types): typed input defaults and userNode mirror

nodesModel/edgesModel defaults drop `as unknown as`; the position/dragging mirror writes
through a scoped Pick<NodeType,'position'|'dragging'> instead of `as any`.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```

---

### Task 7: eslint `no-explicit-any` flip + boundary disables + edge-toolbar verify + final sweep (EXIT GATE)

**Files:**
- `packages/angular/eslint.config.mjs`
- `packages/angular/src/lib/components/edge-toolbar/edge-toolbar.component.ts` (verify-or-fix)
- The ~38 intentional boundary `: any` sites enumerated below (inline disables)

This is the enforcement + exit-gate task. The rule turning `error` is the failing-before / passing-after signal: lint fails on every unhandled `any`, passes once each is fixed or disabled.

- [ ] Verify-or-fix the edge-toolbar cast: re-locate `zIndex = computed(...)` in `edge-toolbar.component.ts`. `EdgeBase` declares `zIndex?: number`, so the cast is unnecessary. If cluster 1 already removed it, this is a no-op; otherwise:

```ts
  readonly zIndex = computed(() => {
    const edge = this.store.edges().find(e => e.id === this.edgeId());
    return (edge?.zIndex ?? 0) + 1;
  });
```

- [ ] Update `packages/angular/eslint.config.mjs` — flip `no-explicit-any` to `error` for production `**/*.ts`, with a `**/*.spec.ts` override keeping it `off` (30 test casts are out of scope):

```js
// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Spec files carry ~30 partial-mock `as any` test idioms; retyping them is out of
    // scope for this typing pass. Keep the rule off for tests only.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
```

- [ ] Run lint to enumerate every remaining production `any` the rule now flags:

```bash
pnpm -F @angflow/angular run lint
```

- [ ] For each **intentional boundary** `: any` the lint flags (these are framework-boundary annotations explicitly out of scope to retype per design line 47), add an inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a short reason on the line above. The expected set (re-locate each by context; some line numbers will have drifted):
  - `components/controls/controls.component.ts` — `fitViewOptions = input<FitViewOptionsBase<any>>()` → reason: `node-type-agnostic fitView options`.
  - `components/edges/{bezier,simple-bezier,smooth-step,step,straight}-edge.component.ts` — `data = input<any>()` → reason: `untyped built-in edge data`.
  - `components/nodes/{default,group,input,output,template}-node.component.ts` — `data = input<any>()` → reason: `untyped built-in node data` (template reads `data()?.label`).
  - `container/edge-renderer/edge-renderer.component.ts` — `buildEdgeInputs(): Record<string, any>`, the `inputs: Record<string, any>` field, `getEdgeInputs(): Record<string, any>` → reason: `dynamic component input bag`.
  - `container/ng-flow/ng-flow.component.ts` — `new Map<string, TemplateRef<any>>()`, the six drag-callback assignments `(event, node: any, nodes: any[])` / `(event, nodes: any[])` → reason: `store drag-callback boundary mirrors xyflow's untyped signature`.
  - `container/node-renderer/node-renderer.component.ts` — `nodeTemplateMap = input<Map<string, TemplateRef<any>>>(...)`, `getNodeTemplate(): TemplateRef<any> | null` → reason: `heterogeneous node templates`.
  - `container/pane/pane.component.ts` — `selectionKeyCode = input<any>(null)` → reason: `KeyCode union accepts string|string[]|null`.
  - `services/flow-store.service.ts` — `unselectNodesAndEdges: (params?: any) => …` → reason: `store API boundary`.
  - `types/edges.ts` `EdgeTypes = Record<string, Type<any>>`; `types/nodes.ts` `NodeTypes = Record<string, Type<any>>` → reason: `heterogeneous component registry`.
  - `types/store.ts` — `connectionClickStartHandle: any | null`, `fitViewOptions: any | undefined`, `isValidConnection: ((connection: any) => boolean) | undefined` → reason: `store interface mirrors xyflow boundary types`.
  - `utils/changes.ts` — every `any` in `applyChanges`/`applyChange`/`getElementsDiffChanges`/the `changes`/`addItemChanges` arrays → reason: `change-applier mirrors xyflow's untyped element diffing`.
  - `utils/type-guards.ts` — `isNode(element: any)`, `isEdge(element: any)` → reason: `type-guard input is intentionally unknown-shaped`.

> Decision rationale: these are pre-existing, intentional `any` at framework boundaries (the old config literally documented "intentional `any` at framework boundaries"). Retyping them is out of scope (design line 47). Inline disables keep the rule genuinely `error` — any *new* `any` is blocked — while documenting each survivor. If lint surfaces a flagged site **not** in this list, treat it as an oversight from Tasks 1-6: fix the type rather than disable it.

- [ ] Re-run lint until green:

```bash
pnpm -F @angflow/angular run lint
```

- [ ] **Exit-gate proof — zero `as any` in production:** confirm the grep returns nothing:

```bash
cd packages/angular && grep -rEn 'as any\b' src --include='*.ts' | grep -v '\.spec\.ts'
```

(Expect: no output. If any line prints, it was missed in Tasks 1-6 — fix the type, do not disable.)

- [ ] **Exit-gate proof — every surviving `as unknown as` is justified.** Confirm the production list is exactly the documented survivors, each with a comment:

```bash
cd packages/angular && grep -rEn 'as unknown as' src --include='*.ts' | grep -v '\.spec\.ts'
```

Expected survivors (all carry a justification comment after this plan): `utils/inject-flow-store.ts` (×2, helper variance casts), `services/ng-flow.service.ts` applyLayout (×2: userNode fallback, opts spread), `agent/agent-bridge.service.ts` (×1: `null` stub for `list_flows`), `agent/transports/window.ts` (×2: window→Record). For the agent-bridge and window-transport sites, **add a one-line justification comment** if one is not already present:
  - `agent-bridge.service.ts` `handler(null as unknown as NgFlowService, params)` → `// list_flows ignores the service arg; null stub avoids resolving a flow.`
  - `transports/window.ts` (both) → `// attach/detach the bridge namespace key on window without widening its global type.`

- [ ] **Full gate (cluster boundary):**

```bash
pnpm -F @angflow/system build
pnpm -F @angflow/system test
pnpm -F @angflow/angular test
pnpm -F @angflow/mcp test
pnpm typecheck
pnpm lint
```

> System is rebuilt because Tasks 1-2 touched `packages/system`. `mcp` test must stay green with no snapshot regeneration (no tool-schema change in this cluster — master rule 4).

- [ ] Commit:

```
chore(lint): enable no-explicit-any (error) for angular src; document boundary anys

Production src is now `as any`-free; the rule is `error` for src and `off` for spec files
(test-idiom casts out of scope). ~38 intentional framework-boundary `: any` declarations
carry inline justification disables. edge-toolbar zIndex uses the typed EdgeBase.zIndex.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

```
