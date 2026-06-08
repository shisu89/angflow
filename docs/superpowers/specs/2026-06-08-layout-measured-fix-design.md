# Auto-layout robustness: live DOM measurement (nodes + edge labels) and controlled-mode `measured` sync

**Date:** 2026-06-08
**Source:** angflow feedback #5 and #6 (`brainstorm_agentic_app/docs/angflow-feedback.md`), plus #4 bookkeeping.

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

### Edge labels overlapped (feedback #6)

`layoutNodes` calls `g.setEdge(e.source, e.target)` with **no label box**, so dagre
reserves zero space for edge labels. A labeled cross-branch edge then routes its label
mid-edge, potentially on top of a distant node. Bumping `rankSep` does not fix it (the
label is not in a rank gap). dagre *can* route around labels when given
`setEdge(v, w, { width, height, labelpos })` — it inserts the label as a dummy node —
but `layoutNodes` exposes no way to pass label dimensions. This is the edge-label twin
of the node-measurement problem above: dagre is fed the wrong sizes, this time for
labels instead of nodes. Today's workaround re-introduces the very
`tidy-layout.ts` file that feedback #2 had removed.

## Goals

- `applyLayout` produces correct layouts regardless of the controlled-mode round-trip
  or `ResizeObserver` timing — **zero app changes required**.
- Controlled-mode apps have a supported, low-boilerplate way to keep the store's
  `measured` correct so floating edges and `fitView` also work.
- `layoutNodes` stays pure (no DOM, no dagre pulled into SSR/non-layout bundles).
- `applyLayout` reserves space for edge labels so they are not overlapped, reusing the
  same live-DOM measurement pass — removing the need for an app-side dagre workaround.
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
// arg order matches sibling applyNodeChanges(changes, nodes)
export function applyDimensionChanges<NodeType extends Node>(
  changes: NodeChange<NodeType>[],
  nodes: NodeType[],
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
  this.nodes.update((ns) => applyDimensionChanges(changes, ns));
  // ...your own position/data handling (journal authority) on top...
}
```

### Part D — edge-label spacing (feedback #6)

Symmetric with Part A, on the edge side.

**`layoutNodes` (pure) — accept a label box per edge.** Widen the edge input shape from
`{ source; target }` to a `LayoutEdgeInput`:

```ts
export interface LayoutEdgeInput {
  source: string;
  target: string;
  label?: unknown;        // dagre space is reserved when this is truthy
  labelWidth?: number;    // measured label box; filled by applyLayout from the DOM
  labelHeight?: number;
}
```

In `layoutNodes`, when an edge supplies `labelWidth`/`labelHeight`, call
`g.setEdge(e.source, e.target, { width, height, labelpos: 'c' })`. When an edge has a
truthy `label` but no measured box, reserve a **conservative default box**
(`DEFAULT_LABEL_WIDTH`/`DEFAULT_LABEL_HEIGHT`, e.g. `60×20`) so direct callers and
not-yet-rendered labels still get *some* spacing rather than zero. Edges with no label
and no box fall through to the current `g.setEdge(e.source, e.target)` (no dummy node,
no behavior change). This keeps `layoutNodes` pure — it only reads fields off the edge
objects it is handed.

**`applyLayout` — measure label boxes from the DOM.** Extend the live-DOM pass (Part A)
to also enrich edges: for each edge, look up
`store.domNode()?.querySelector('.xy-flow__edge-label[data-id="<id>"]')`, read
`offsetWidth`/`offsetHeight`, and on a shallow clone set `labelWidth`/`labelHeight`
(and carry `label` through). Absent element or zero size → leave the edge as-is (the
`layoutNodes` default box, if any, applies). Same single-reflow batched-read discipline
as nodes; original store edge objects are not mutated.

**Renderer change (enabling).** The label `<div class="xy-flow__edge-label">`
(`edge-renderer.component.ts:215`) currently carries no id. Add
`[attr.data-id]="edge.id"` so `applyLayout` can address each label. Purely additive;
the label only renders when `edge.label` is truthy, so the selector naturally matches
exactly the labels that need spacing. `offsetWidth`/`offsetHeight` are intrinsic layout
dims unaffected by the pane's `scale` (the label's own `translate(-50%,-50%)` transform
does not change them) — no `÷ zoom`.

The private DOM-measurement helper from Part A grows an edge sibling
(`withLiveEdgeLabels`) following the same shape; `applyLayout` calls both before
invoking `layoutFn`.

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
- **`layoutNodes` edge labels** (extend `layout-nodes.spec.ts`): an edge with
  `labelWidth`/`labelHeight` produces more inter-rank space than the same graph without
  (assert via the resulting positions / dagre graph node count incl. the label dummy);
  a truthy `label` with no box reserves the default box; an edge with neither behaves
  exactly as before (no regression). Stays pure — no DOM.
- **`applyLayout` edge-label measurement** (same service/integration spec as Part A):
  with stubbed `.xy-flow__edge-label[data-id]` elements reporting known
  `offsetWidth/Height`, assert `layoutFn` receives edges whose `labelWidth/labelHeight`
  reflect the DOM and that store edge objects are not mutated; absent element → edge
  passed through unchanged.
- **Renderer** (`edge-renderer.component`): a labeled edge's `.xy-flow__edge-label`
  div exposes `data-id`. Add to the existing edge-renderer spec if present, else a
  minimal assertion.
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

1. Implement Parts A + B + D in `@angflow/angular`, with tests.
2. `npm version patch` `@angflow/system`? — **no**, no system change. Bump
   `@angflow/angular` only.
3. Build, publish `@angflow/angular`.
4. Update `angflow-feedback.md`: mark #5 and #6 ✅ (link the implementing commit) and
   #4 ✅ (link `9be04de28`).
5. Adopt in `brainstorm_agentic_app`: delete `tidy-layout.ts` again and call
   `applyLayout` (now that it measures both node footprints and edge-label boxes live),
   wire `applyDimensionChanges` into `onNodesChange`, and replace the minimap CSS-hook
   workaround with the now-working color inputs.

*Process note: this design touches only the Angular package and docs; the system
package is intentionally left unchanged.*
