# mural-copy feedback remediation — design

**Date:** 2026-08-13
**Status:** approved, ready for planning
**Source:** `C:\code\projects\web\mural-copy\docs\angflow-feedback.md`

## Context

mural-copy is a downstream consumer of `@angflow/angular` + `@angflow/system`. It
logs library defects it hits into `docs/angflow-feedback.md`. Three of its ten
findings were fixed and released in `@angflow/angular@0.3.18` / `@angflow/system@0.1.12`
(both activation-key inputs, and pan-after-box-selection). The remaining seven were
verified against `main` at `@angflow/angular@0.3.19` / `@angflow/system@0.1.12` before
this design was written.

### Verification results

| Finding | Verdict |
|---|---|
| Redundant initial `dimensions` change | Real; mechanism restated below; matches xyflow upstream |
| Remounted handles do not refresh edge anchors | Symptom real; **the report's premise is wrong** — the public fix already ships |
| Projected overlays trigger `paneMouseLeave` mid-gesture | Real; their suggested fix rests on store state that does not exist |
| `hidden` also removes nodes from the minimap | Real, exact |
| Unknown edge type has no warning | Real, exact |
| Unknown node type has no warning | Real, exact |
| Core dev-warning channel is missing | **Wrong as written** — the channel exists, but is dead in Angular builds |

This design covers the four items selected for work: the two unknown-type warnings and
the diagnostics repair they depend on, the `paneMouseLeave` guard, the minimap input,
and a correction sent back to mural-copy.

### Findings verified but NOT addressed here

**Redundant initial `dimensions` change.** Confirmed, with a correction to the report's
mechanism. `updateNodeInternals` gates the change on `dimensionChanged`
(`packages/system/src/utils/store.ts:446`), which compares against `node.measured` — and
`adoptUserNodes` seeds `measured` *only* from `userNode.measured`, never from
`userNode.width`/`height` (`store.ts:164-167`). So a node created at `width: 200,
height: 200` still has `measured = {undefined, undefined}` until the `ResizeObserver`
fires, and the first measurement is always `undefined !== 200`. It is not "fires even
when equal" — the declared size is never in the comparison at all.

Deferred deliberately: both the gate and the seeding are verbatim xyflow (confirmed by
diffing `packages/system/src/utils/store.ts` against `upstream/main`; our divergences in
that file are elsewhere). React Flow emits the identical echo. Changing it is a one-way
divergence in shared framework-agnostic code, and mural-copy already has a correct,
cheap app-side fix (diff before writing measured dimensions back to external state).
Revisit only if a second consumer hits it.

**Remounted handles do not refresh edge anchors.** The symptom is real: `handleBounds`
is recomputed only from a `ResizeObserver` over node wrappers
(`node-renderer.component.ts:230-244`), and the `MutationObserver` is
`{childList: true, subtree: false}` on the *container* (`:251`), so a node whose handle
set changes without a size change is never re-measured.

But no library change is needed for mural-copy's case. The report states
`updateNodeInternals` is "never reachable from application code, only from the
ResizeObserver callback". It is reachable: `NgFlowService.updateNodeInternals(nodeIds:
string | string[])` (`packages/angular/src/lib/services/ng-flow.service.ts:1000`) is
public, passes `force: true` — which bypasses the `dimensionChanged` gate at
`store.ts:450` — and is documented in `docs/examples-parity.md:134`. It has been present
since the initial wrapper commit; it exists in the **0.3.17** dist mural-copy wrote the
finding against (`ng-flow.service.js:888` in their own `node_modules`).

Their suggestion (b) — automatic detection via a subtree `MutationObserver` — remains
genuinely open, but is speculative work for a case the public API already covers. Not
scheduled. The correction goes back to mural-copy instead (section 4).

## Section 1 — Dev diagnostics repair

### The real defect

The report claims "the library core has no diagnostic output whatsoever" and that the
two unknown-type warnings "have nowhere to land". Both are wrong. The channel exists
end to end:

- `devWarn(id, message)` — `packages/system/src/utils/general.ts:149`
- `errorMessages` — `packages/system/src/constants.ts:3`, already containing the exact
  two messages needed: `error003` (node type not found) and `error011` (edge type not found)
- `FlowStore.onError` defaults to `devWarn` — `flow-store.service.ts:216`
- `<ng-flow>` bridges it to a public `(error)` output, deliberately preserving `devWarn`
  so unbound consumers still get console warnings — `ng-flow.component.ts:963-975`

Their sweep missed it because it grepped `console.warn` in the **`@angflow/angular`**
dist; the literal `console.warn` lives in `@angflow/system`.

The accident lands on a worse bug. The console half of the channel is dead in every
Angular build:

```ts
export const isDevEnv = (): boolean =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === 'development';
```

`@angular/build:application` (esbuild) never defines `process.env.NODE_ENV` for browser
bundles and nothing here polyfills it. Verified empirically in a local production build of
this repo's own example app — `examples/angular/dist/zoneless/browser/main-SHBTXAG3.js`
(gitignored, not tracked in git) carries
`globalThis.process?.env?.NODE_ENV==="development"` verbatim, unsubstituted. In a browser
`globalThis.process` is `undefined`, so `isDevEnv()` is permanently `false` and `devWarn`
has never logged for any Angular consumer, in dev or prod.

The `(error)` **output** is unaffected — `onErrorWrapper` emits unconditionally
(`ng-flow.component.ts:966-969`). Consumers who bind `(error)` do receive everything
routed through the store. Only the console fallback is dead.

### Design

New `packages/angular/src/lib/utils/dev-warn.ts`:

```ts
const seen = new Set<string>();

export const ngDevWarn: OnError = (id, message) => {
  const key = `${id}::${message}`;
  if (!isDevMode() || seen.has(key)) return;
  seen.add(key);
  console.warn(`[angflow]: ${message} Help: https://reactflow.dev/error#${id}`);
};

/** Test-only: the dedupe cache is module-scoped and outlives a TestBed. */
export const resetDevWarnDedupe = (): void => seen.clear();
```

Three decisions, each load-bearing:

- **Dedupe keys on `id::message`, not `id`.** Keying on `id` alone would mean the second
  typo'd node type in an app never warns, because both are `error003`.
- **`isDevMode()` from `@angular/core`** replaces the `process.env.NODE_ENV` check. This
  is the whole point of putting the helper in the Angular package rather than fixing
  `isDevEnv()` in `@angflow/system`: the system package is framework-agnostic and shared
  with the react/svelte references, and `CLAUDE.md` states it should rarely change.
- **The `reactflow.dev/error#NNN` link stays.** angflow inherits those exact numbered
  codes and the linked docs are correct. Only the `[React Flow]` prefix was misleading.

`flow-store.service.ts:216` swaps its default from system's `devWarn` to `ngDevWarn`.
Nothing in `@angflow/system` is modified.

### Call sites

`NodeRendererComponent.getNodeComponent` (`node-renderer.component.ts:406-415`) and
`EdgeRendererComponent.getEdgeComponent` (`edge-renderer.component.ts:406-409`) each gain
a renderer-local `warnedTypes` Set and report through the store on fallback:

```ts
private warnedTypes = new Set<string>();

getNodeComponent(type?: string): Type<unknown> {
  const resolvedType = type || 'default';
  const hostOrBuiltIn = this.customNodeTypes()[resolvedType] ?? builtInNodeTypes[resolvedType];
  if (hostOrBuiltIn) return hostOrBuiltIn;
  if (this.store.nodeTemplates().has(resolvedType)) return TemplateNodeComponent;

  if (!this.warnedTypes.has(resolvedType)) {
    this.warnedTypes.add(resolvedType);
    // Defer: this runs inside an *ngComponentOutlet binding on every change
    // detection pass, and onError emits the public (error) output.
    queueMicrotask(() => this.store.onError()?.('003', errorMessages.error003(resolvedType)));
  }
  return DefaultNodeComponent;
}
```

The edge site is structurally identical with `'011'` / `errorMessages.error011`.

The `queueMicrotask` is not a change-detection trick — it moves an output emission out
of a template evaluation, which is what would otherwise risk
`ExpressionChangedAfterItHasBeenChecked` in consumers reacting to `(error)`. Permitted
under the zoneless rules (timers to delay work are fine; timers to force CD are not).

`errorMessages` and `OnError` are both publicly exported from `@angflow/system`
(`packages/system/src/index.ts:1`, `types/general.ts:297`).

### Remaining gap, recorded not fixed

`packages/system/src/utils/edges/general.ts:140,209,217` calls system's `devWarn`
directly for `error006`/`error007` (`addEdge` / `reconnectEdge`), bypassing the store
entirely. Those stay invisible in Angular builds after this change. Fixing them requires
either editing shared upstream code or threading the store through those utils. Out of
scope; revisit if a consumer reports a silent `addEdge` failure.

## Section 2 — Gesture-aware `paneMouseLeave`

### The defect

`ng-flow.component.ts:237` projects `<ng-content />` as a **sibling** of
`<ng-flow-pane>` (closed at `:236`), both absolutely positioned in the same container.
`:205` emits `paneMouseLeave` straight from the pane's native `mouseleave`, unguarded. A
pointer travelling from the canvas onto a projected minimap or panel therefore fires a
real `paneMouseLeave` mid-gesture, indistinguishable from leaving onto unrelated page
chrome. Consumers using it for hover chrome tear that chrome down mid-drag; if the
chrome owns a resizer, the `XYResizer` tracking the pointer is destroyed and the gesture
never terminates.

The report's suggested fix (a) assumes `<ng-flow>` "already knows this via its internal
store's `nodeDragging`/resize-in-progress state". Half wrong. `paneDragging`
(`flow-store.service.ts:139`), `userSelectionActive` (`:141`) and `connection()` (`:201`)
exist; there is **no** aggregate node-drag signal and **no** resize state at all —
`node-resizer.component.ts:275,301` only pushes `resizing: true/false` outward as
`NodeChange`s and records nothing.

### Design

Two new store signals:

- `nodeDragging` — written from `FlowStore.updateNodePositions(items, dragging)`
  (`flow-store.service.ts:476`), the single choke point: `XYDrag.ts:204` calls it with
  `true` mid-drag, `XYDrag.ts:369` with `false` at drag end.
- `nodeResizing` — written from `node-resizer.component.ts`'s `onStart`/`onEnd`.

Then:

```ts
readonly gestureActive = computed(() =>
  this.paneDragging() || this.userSelectionActive() ||
  this.nodeDragging() || this.nodeResizing() || this.connection().inProgress);
```

`<ng-flow>` stops emitting `paneMouseLeave` inline:

- `mouseleave` while `gestureActive()` — store the event, emit nothing.
- `mouseenter` while a latch is pending — drop the latch and **suppress this
  `paneMouseEnter` too**, then emit nothing. From the consumer's point of view the
  pointer never left, so an enter would be an unpaired duplicate of the enter they
  already received before the gesture began.
- `mouseenter` with no latch pending — emits `paneMouseEnter` exactly as today. The
  guard only ever suppresses the second half of a suppressed leave/enter pair.
- an `effect()` on `gestureActive()` — on the true→false edge, emit a latched event if one
  survived, then clear the latch.

Semantics chosen: **latch and deliver at gesture end.** The enter/leave pairing is
preserved, so a consumer that clears hover state on leave is not left with stale chrome
after a gesture that genuinely ended off-canvas. Suppress-and-drop was rejected for that
reason; an opt-in input was rejected as shipping the bug as the default.

Signal-driven throughout; no `NgZone`.

## Section 3 — Minimap `[includeHiddenNodes]`

`Node.hidden` does two things at once with no way to separate them: the node renderer
skips its DOM (`node-renderer.component.ts:87`) and the minimap drops it
(`minimap.component.ts:254`). A consumer doing viewport culling must choose between the
cheap DOM skip and off-screen elements remaining visible as minimap dots. mural-copy
gave up the DOM skip, and now carries every culled node's wrapper, drag directive and
`ResizeObserver` against a 5,000-element target.

`MinimapComponent` gains `readonly includeHiddenNodes = input(false)`, and the filter
becomes:

```ts
.filter((node) => !collapsed.has(node.id) && (includeHidden || !node.hidden))
```

Scope is `node.hidden` only. Collapse-hidden nodes (`collapsedHiddenIds()`) stay
excluded: a collapsed group's own rect already represents its descendants, so drawing
them too would double-draw the region and inflate the computed `viewBox` over content
the user deliberately folded away. The `viewBox` widening to cover revealed
`hidden` nodes is inherent and intended — that is the feature.

The name mirrors `fitView`'s existing `includeHiddenNodes` option, which is the
precedent mural-copy cited.

## Section 4 — Correction back to mural-copy

Edit `C:\code\projects\web\mural-copy\docs\angflow-feedback.md` (different repo, docs
only, no code change):

- Correct the "never reachable from application code" premise in the remounted-handles
  entry; cite `NgFlowService.updateNodeInternals(string | string[])` and its `force: true`
  path, and note it was present in the 0.3.17 dist the finding was written against.
- Note their handle-unmounting revert can be unwound if they still want the culling win.
- Correct the dev-warning entry: the channel exists; the real defect is that `isDevEnv()`
  tests `process.env.NODE_ENV`, which Angular's esbuild builder never defines.
- Restate the `dimensions` mechanism (`measured` is never seeded from `width`/`height`)
  and record that it is deferred as verbatim xyflow behavior.
- Mark the items being fixed by this change.

## Testing

vitest in `packages/angular`; TDD per task.

- **dev-warn:** dev/prod gating, dedupe on distinct messages under one code, no dedupe
  collapse across different types. `resetDevWarnDedupe()` in `beforeEach` — the cache is
  module-scoped and outlives a TestBed.
- **call sites:** unknown node type and unknown edge type each warn exactly once across
  repeated change detection, and reach a bound `(error)` output. A known type warns never.
- **`paneMouseLeave` latch:** leave-with-no-reenter emits exactly once at gesture end;
  leave-then-reenter-then-gesture-end emits never, and that re-entry emits no
  `paneMouseEnter` either; leave with no gesture active emits immediately as today; a
  plain enter with no latch pending still emits `paneMouseEnter`. One case per gesture
  source (`paneDragging`, `userSelectionActive`, `nodeDragging`, `nodeResizing`,
  `connection().inProgress`).
- **minimap:** default `false` preserves today's output; `true` includes `node.hidden`
  nodes and still excludes collapse-hidden ones.

Full suite must stay green: `pnpm typecheck`, `pnpm lint`, vitest in all three packages,
plus the zonal example suite in `examples/angular/`.

## Release

`@angflow/angular` patch bump. `@angflow/system` is untouched, so it needs no republish.
No change to `AGENT_TOOL_SCHEMAS`, so `@angflow/mcp` needs no snapshot regeneration.
`AGENT_BRIDGE.md` is unaffected.
