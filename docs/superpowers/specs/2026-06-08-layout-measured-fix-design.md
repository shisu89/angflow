# Auto-layout robustness: live DOM measurement + controlled-mode `measured` sync

**Date:** 2026-06-08
**Source:** angflow feedback #5 (`brainstorm_agentic_app/docs/angflow-feedback.md`), plus #4 bookkeeping.

## Problem

`layoutNodes` (and therefore `NgFlowService.applyLayout`) packs custom nodes into
overlaps because the node sizes it feeds dagre are wrong. Two compounding causes:

1. **Unmeasured fallback.** `layoutNodes` resolves each node's size as
   `measured → width/height → initialWidth/Height → 150×40`. A custom node with no
   `measured` dims silently gets `150×40`, so dagre lays it out far too tight.
2. **Controlled-mode wipes `measured`.** In controlled mode the app binds `[nodes]`
   and re-emits from `(nodesChange)`. `applyNodeChanges` (and any app that maps its
   own model into fresh node objects) produces **new** node references. In the
   system's `adoptUserNodes` (`packages/system/src/utils/store.ts:154-167`), a new
   reference fails the `checkEquality` fast-path, so the internal node is rebuilt
   with `measured: { width: userNode.measured?.width, height: userNode.measured?.height }`.
   An app that doesn't carry `measured` on its model (e.g. one that hand-handles only
   `position` changes to keep a journal authoritative) emits nodes with no `measured`,
   so `getInternalNode().measured` is wiped to `{ undefined, undefined }` on every
   round-trip. `handleBounds` is preserved here (prior fix, `store.ts:79-86`);
   `measured` is not. Even when `measured` survives, it is stale immediately after a
   card grows but before the `ResizeObserver` re-fires.

The first symptom (bad layout) is the loud one. The same wiped/stale `measured` also
silently degrades other measured-dependent features in controlled mode: floating
edges (attachment geometry) and `fitView` (bounds).

## Goals

- `applyLayout` produces correct layouts regardless of the controlled-mode round-trip
  or `ResizeObserver` timing — **zero app changes required**.
- Controlled-mode apps have a supported, low-boilerplate way to keep the store's
  `measured` correct so floating edges and `fitView` also work.
- `layoutNodes` stays pure (no DOM, no dagre pulled into SSR/non-layout bundles).
- No changes to system-package reconciliation semantics.

## Non-goals

- Sub-flow / nested-parent layout (already unsupported; unchanged).
- Changing `adoptUserNodes` to preserve `measured` across re-emits (considered;
  rejected — see Alternatives).
- Having `applyLayout` write measurements back into the store (considered; rejected —
  see Alternatives).

## Design

### Part A — `applyLayout` measures live DOM (feedback direction 1)

`NgFlowService.applyLayout` already maps each public node to its internal node before
calling `layoutFn` (`ng-flow.service.ts:312-315`). Insert a measurement step between
the map and the `layoutFn` call:

- For each node, look up its rendered element via
  `store.domNode()?.querySelector('.xy-flow__node[data-id="<id>"]')`.
- If found, read `el.offsetWidth` / `el.offsetHeight`. These are **layout dimensions
  in the element's own coordinate space**, unaffected by the pane's CSS `scale`
  transform — exactly what `getDimensions` (system `dom.ts:30`) reads via the
  `ResizeObserver`. **No `÷ zoom` is required** (the feedback's "getBoundingClientRect
  ÷ zoom" suggestion is superseded by the cleaner `offsetWidth` approach).
- When both are `> 0`, override `measured` on a **shallow clone** of the internal node
  (`{ ...node, measured: { width, height } }`) so the original store object is not
  mutated. Pass the enriched array to `layoutFn`.
- When the element is absent (hidden node, SSR, not-yet-rendered) or reports `0`,
  leave the node as-is — `layoutNodes`' existing
  `measured → width → initialWidth → 150×40` chain still applies.

**Policy: always prefer live DOM** when an element exists (overriding any existing
`measured`), so both the *absent* (round-trip wipe) and *stale* (card just grew) cases
are fixed. All `offsetWidth`/`offsetHeight` reads happen in a single pass before the
layout call, so the forced reflow is a single batched read — negligible for an explicit
user/agent action.

Because the enrichment happens in `applyLayout`, **every** layout function benefits, not
just the built-in `layoutNodes`. `layoutNodes` itself is untouched and stays pure; its
docstring gains a one-line note that `applyLayout` auto-measures from the DOM and that
direct `layoutNodes` callers should pass already-measured nodes (e.g. internal nodes).

A private helper keeps `applyLayout` readable:

```ts
/** Override measured dims from the live DOM where a rendered element exists. */
private withLiveMeasurements(nodes: InternalNode<NodeType>[]): InternalNode<NodeType>[] {
  const container = this.store.domNode();
  if (!container) return nodes;
  return nodes.map((n) => {
    const el = container.querySelector<HTMLElement>(`.xy-flow__node[data-id="${CSS.escape(n.id)}"]`);
    if (!el) return n;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (!width || !height) return n;
    return { ...n, measured: { width, height } };
  });
}
```

(`CSS.escape` guards ids with selector-special characters.)

### Part B — `applyDimensionChanges` helper + controlled-mode docs (direction 2)

Part A fixes layout, which routes through `applyLayout`. Floating edges and `fitView`
read the store's `measured` directly and never call `applyLayout`, so they still need
the store's `measured` to be correct in controlled mode. Provide a supported way to keep
it correct without forcing apps to cede position/data authority.

New pure helper, exported from `@angflow/angular` (alongside `applyNodeChanges` in
`packages/angular/src/lib/utils/changes.ts`, re-exported from `public-api.ts`):

```ts
/**
 * Apply only `dimensions`-type changes from a `(nodesChange)` batch, writing
 * `{ width, height }` into each affected node's `measured`. Returns a new array
 * when any dimension change applied, otherwise the original reference (so it is a
 * no-op for change-detection when there is nothing to update).
 *
 * For controlled-mode apps that keep authority over `position`/`data` themselves
 * (e.g. a journal) but still want `measured` to flow back so floating edges,
 * `fitView`, and `applyLayout`-free measurement work.
 */
export function applyDimensionChanges<NodeType extends Node>(
  nodes: NodeType[],
  changes: NodeChange<NodeType>[],
): NodeType[];
```

Implementation: collect `{ id → {width, height} }` from changes where
`change.type === 'dimensions'` (system `NodeDimensionChange` carries `dimensions`),
then map `nodes`, merging `measured` for matched ids. If no dimension change matched,
return `nodes` unchanged.

Docs: a "Controlled mode and `measured`" subsection (README + `AGENT_BRIDGE.md` is the
wrong home — README of `packages/angular`) with the copy-paste pattern:

```ts
onNodesChange(changes: NodeChange[]) {
  // keep measured flowing back so layout / floating edges / fitView stay correct
  this.nodes.update((ns) => applyDimensionChanges(ns, changes));
  // ...your own position/data handling (journal authority) on top...
}
```

### Part C — feedback #4 cleanup (bookkeeping only, no code)

`9be04de28` already fixed #4 (minimap color inputs — inline `[style.fill]` instead of
`[attr.fill]`), matching the feedback's suggested fix. Mark entry #4 ✅ in
`angflow-feedback.md`, link the commit, and note the remaining follow-up: publish the
new `@angflow/angular` version, then adopt in `brainstorm_agentic_app` (the app's
`minimapNodeClass` CSS-hook workaround can be replaced with the now-working
`[nodeColor]`/`[maskColor]` inputs once published).

## Testing

- **`applyDimensionChanges`** (pure unit tests, `changes.spec.ts` or a new spec):
  applies a single dimension change; ignores non-dimension changes; merges into
  existing `measured`; returns the **same reference** when no dimension change present;
  handles unknown ids (skip); multiple changes in one batch.
- **`applyLayout` live measurement** (`ng-flow.service.spec.ts` or layout integration
  spec): with a stubbed `store.domNode()` returning a container whose
  `.xy-flow__node[data-id]` elements report known `offsetWidth/Height`, assert the
  `layoutFn` receives nodes whose `measured` reflects the DOM (not the stale/absent
  store value), and that the store node objects are **not** mutated. Cover the
  no-element fallback (node passed through unchanged). Use a fake element/container
  rather than a full render to keep it a fast unit test, mirroring existing service
  specs.
- **`layoutNodes`** existing spec is unchanged (it stays pure); add nothing unless the
  docstring example changes break a doctest (none exist).
- Regression bar: the zonal example suite (`examples/angular/`) must still pass.

## Alternatives considered

1. **Preserve `measured` in `adoptUserNodes`** (system) — in the rebuild branch, fall
   back to the prior internal node's `measured` when `userNode.measured` is absent,
   exactly as `handleBounds` is already preserved (`store.ts:84`). Fixes layout,
   floating edges, and `fitView` in one place with no app changes. **Rejected:**
   CLAUDE.md states the system package should rarely change; this alters core
   xyflow-ported reconciliation semantics shared in spirit with React/Svelte, and
   risks masking genuine re-measurement intent. Higher blast radius than the problem
   warrants. Revisit only if Part B adoption proves too burdensome across apps.
2. **`applyLayout` writes measurements back to the store** via
   `updateNodeInternals(force)` before laying out — would also refresh floating-edge
   geometry post-layout for free, covering the no-helper case. **Rejected:** introduces
   a surprising side effect (emits `dimensions` `nodesChange` events from a call the
   app invoked for *positions*), blurring read vs. write. Kept `applyLayout`
   read-only; Part B covers store correctness explicitly.

## Rollout

1. Implement Part A + B in `@angflow/angular`, with tests.
2. `npm version patch` `@angflow/system`? — **no**, no system change. Bump
   `@angflow/angular` only.
3. Build, publish `@angflow/angular`.
4. Update `angflow-feedback.md`: mark #5 ✅ (link the implementing commit) and #4 ✅
   (link `9be04de28`).
5. Adopt in `brainstorm_agentic_app`: simplify `tidy()` (drop the manual per-node
   footprint estimate now that `applyLayout` measures live), and wire
   `applyDimensionChanges` into `onNodesChange`. Replace the minimap CSS-hook
   workaround with the now-working color inputs.

*Process note: this design touches only the Angular package and docs; the system
package is intentionally left unchanged.*
