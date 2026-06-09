# Group collapse: fold a sub-flow to its box, hide descendants, reroute crossing edges

**Date:** 2026-06-09
**Source:** angflow feedback #7 (`brainstorm_agentic_app/docs/angflow-feedback.md`).

This is the first sub-project of a larger "first-class groups" effort. Feedback #8 (compound
layout), #9 (auto-size box), and #10 (absolute-coordinate tween) are **out of scope** here and
get their own specs.

## Problem

angflow renders sub-flow containment (`type:'group'` + child `parentId`) but has no notion of a
*collapsed* group. There is no `collapsed` state on a node, no service call to fold/unfold, and
no rendering or edge handling for the collapsed state. Apps that want collapse must implement the
whole transform themselves. The reference consumer does exactly this in
`web/src/app/canvas/group-render.ts` (`composeNodes`/`composeEdges`): when a group's `collapsed`
flag is set it omits member nodes, renders only the group chip, remaps edges crossing the
boundary onto the group id, and dedupes the parallels the remap creates. Every app reimplements
the same graph transform.

## Goals

- A truthy `collapsed` on a group/parent node, by itself, makes angflow: hide the group's
  descendants, render the box in a collapsed (header-only) state, and reroute crossing edges onto
  the collapsed box — with no app-side graph transform.
- Correct under **nesting** (groups within groups).
- Fits controlled mode: `collapsed` lives on the node and round-trips through
  `[nodes]`/`(nodesChange)`; a service convenience writes it.
- No `@angflow/system` changes (per CLAUDE.md). All new logic lives in `@angflow/angular` as pure
  functions + store computeds.

## Non-goals

- Compound/group-aware **layout** (#8), **auto-size**-to-children box geometry (#9), and
  absolute-coordinate **tweening** of parented children (#10) — separate specs.
- A built-in collapse trigger UI (chevron). Apps render their own trigger; we ship the mechanism
  and a service writer. (Rationale below.)
- Animating the collapse/expand transition. Collapse is a state flip; entry/exit animation can
  ride on the existing `[animate]` work later if wanted.

## Design

### 1. State & API

Add `collapsed?: boolean` to the Angular `Node` type (`src/lib/types/nodes.ts`, the
`NodeBase & {…}` extension — **no system change**; it rides along on internal nodes via the
existing `adoptUserNodes` spread). A truthy `collapsed` on a node that has children is the single
source of truth; all rendering/edge behavior derives from it.

`NgFlowService` gains two thin writers (mirroring the existing `updateNodeData`):

```ts
/** Set a (group/parent) node's collapsed state. Emits a `replace` node change. */
setNodeCollapsed(id: string, collapsed: boolean): void
/** Flip a node's collapsed state. */
toggleNodeCollapsed(id: string): void
```

Both resolve the current node, write `{ ...node, collapsed }` via
`store.triggerNodeChanges([{ id, type: 'replace', item }])` (same path `updateNodeData` uses), so
controlled apps receive the change and can journal it. No separate uncontrolled collapse state
exists — that would desync from `[nodes]`.

### 2. Node hiding (pure helper + store computed)

New file `src/lib/graph/collapse.ts`:

```ts
/**
 * Ids of nodes hidden because an ancestor (via parentId chain) is `collapsed`.
 * The collapsed node itself is NOT included — it stays visible as the box.
 * Nesting-correct: a node under two nested collapsed groups is hidden once.
 */
export function getCollapsedHiddenIds(
  nodeLookup: Map<string, { id: string; parentId?: string; collapsed?: boolean }>,
): Set<string>
```

It walks each node's `parentId` ancestry; if any ancestor has `collapsed === true`, the node is
hidden. (Ancestry walks are memoized per call to stay O(n) over the lookup.)

Store: a `collapsedHiddenIds` computed wraps the helper over `nodeLookup` (re-runs via the
existing `version()` signal). `visibleNodes` is extended to exclude `collapsedHiddenIds`, so the
node-renderer, minimap, and edge geometry all see a consistent node set. The existing
`@if (!node.hidden)` template filter is untouched — collapse is a separate derived axis from the
user-set `hidden` flag.

### 3. Edge rewriting (pure helper + store computed) — the core

In `src/lib/graph/collapse.ts`:

```ts
export interface DisplayEdge extends Edge {
  /** Original edge ids this display edge represents (length 1 = passthrough). */
  collapsedFrom?: string[];
}

/**
 * Rewrite edges for the current collapsed state:
 *  - map each endpoint to its OUTERMOST collapsed ancestor when the endpoint is hidden;
 *  - DROP edges whose endpoints map to the same group (now internal to a collapsed box);
 *  - DEDUPE parallels created by rewriting, keyed (source,target,sourceHandle,targetHandle).
 * Edges untouched by collapse pass through unchanged (collapsedFrom omitted / length 1).
 */
export function rewriteEdgesForCollapse(
  edges: Edge[],
  nodeLookup: Map<string, { id: string; parentId?: string; collapsed?: boolean }>,
  hiddenIds: Set<string>,
): DisplayEdge[]
```

"Outermost collapsed ancestor" = walk the endpoint's ancestry and take the **highest** ancestor
with `collapsed === true` (so nested collapsed groups reroute to the top box). A store computed
`displayEdges` runs this over `edges()` + `nodeLookup` + `collapsedHiddenIds` and becomes the
edge-renderer's edge source (replacing its current raw `edges()` read). Viewport culling
(`onlyRenderVisibleElements`) must be recomputed over the **rewritten** endpoints rather than the
original `visibleEdgeIds` set, since merged edges carry synthetic ids absent from that set — i.e.
cull `displayEdges` by visible-node membership directly.

Rewritten endpoints attach to the collapsed box through the **existing** edge geometry
(`internals.positionAbsolute` + handleBounds, with `inferSide` under `edgeMode="floating"`). Under
floating mode (the consumer's mode) attachment to the box is clean; under handle mode it resolves
to the group's handles or falls back to the box rect. No new geometry code.

### 4. Interaction semantics

- **1:1 display edge** (not merged): keeps the original `id`; `collapsedFrom` is `[id]` or
  omitted. Fully selectable / reconnectable / deletable exactly as today.
- **Merged display edge** (N originals → one): **render-only**. Synthetic stable id
  `__collapsed:{source}->{target}` (handles appended when present), `collapsedFrom` lists all N
  original ids. Not individually selectable or reconnectable (reconnection is ambiguous across N
  relationships); `collapsedFrom` lets an app act on click (e.g. surface or delete the N originals)
  if it chooses. Rationale: a merged edge shouldn't masquerade as a single relationship, but
  tracking the underlying ids costs almost nothing.

The collapsed group node itself remains a normal node — selectable, draggable, deletable as a unit.

### 5. Collapsed box rendering

angflow adds a `collapsed` class to the group node wrapper when `node.collapsed`
(`node-renderer.component.ts`, alongside the existing `[class.selectable]` etc.). The bundled
stylesheet gets a `.xy-flow__node.collapsed`/`.xy-flow__node-group.collapsed` rule that drops the
expanded footprint to a header height. Custom group components read `collapsed` via the node
context (add `collapsed` to the rendered node context signals next to `selected`/`dragging`) so
they can render their own chip. Because descendants aren't rendered (§2), nothing needs to wrap.

**Box auto-shrink-to-children-bounds is feedback #9 (deferred).** Here, collapse only stops the
box occupying its expanded size via CSS; precise header sizing is a CSS concern (built-in rule +
app override), not measurement.

### 6. Trigger UI — service + class only (no built-in chevron)

We ship the mechanism, `setNodeCollapsed`/`toggleNodeCollapsed`, the `collapsed` node-context
signal, and the `.collapsed` CSS hook. We do **not** add a chevron to the built-in
`GroupNodeComponent` (it is intentionally template-less, and apps — including the reference
consumer — render their own group node with their own header/trigger). This keeps the feature a
focused mechanism; a built-in disclosure control can be added later if demand appears.

## File structure

- `src/lib/types/nodes.ts` — add `collapsed?: boolean` to `Node`.
- `src/lib/graph/collapse.ts` (new) — pure `getCollapsedHiddenIds`, `rewriteEdgesForCollapse`,
  `DisplayEdge`. `src/lib/graph/collapse.spec.ts` (new).
- `src/lib/services/flow-store.service.ts` — `collapsedHiddenIds` + `displayEdges` computeds;
  extend `visibleNodes` to exclude collapsed-hidden ids.
- `src/lib/services/ng-flow.service.ts` — `setNodeCollapsed` / `toggleNodeCollapsed`.
- `src/lib/container/edge-renderer/edge-renderer.component.ts` — source edges from
  `store.displayEdges` instead of raw `edges()`.
- `src/lib/container/node-renderer/node-renderer.component.ts` — `[class.collapsed]` on the
  wrapper; expose `collapsed` on the node context.
- `src/lib/components/nodes/group-node.component.ts` + bundled CSS — `.collapsed` header rule.
- `src/lib/public-api.ts` — export `DisplayEdge` (and the collapse helpers if we want them public;
  default: keep helpers internal, export only the type).
- Docs: `packages/angular/README.md` — a "Group collapse" subsection.

## Testing

- **Pure helpers** (`collapse.spec.ts`):
  - `getCollapsedHiddenIds`: direct children of a collapsed group are hidden; the group itself is
    not; **nested** collapsed groups hide all descendants once; an expanded group hides nothing; a
    node whose only collapsed ancestor is several levels up is hidden.
  - `rewriteEdgesForCollapse`: outside→hidden-member edge reroutes to the box; member→member
    inside one collapsed group is **dropped**; two outside→member parallels **dedupe** to one
    merged `DisplayEdge` with `collapsedFrom` length 2; **nested** collapse reroutes to the
    **outermost** collapsed ancestor; untouched edges pass through with original id.
- **Store integration** (`flow-store.service.spec.ts`): setting `collapsed` on a parent removes its
  children from `visibleNodes` and produces rewritten `displayEdges`; clearing `collapsed` restores
  both; nested case.
- **Service** (`ng-flow.service.spec.ts`): `setNodeCollapsed(id,true)` emits a single `replace`
  change carrying `collapsed:true`; `toggleNodeCollapsed` flips; unknown id is a no-op.
- **Renderer**: the `collapsed` class binding and node-context signal are template bindings (not
  unit-testable under Vitest's JIT limitation, per existing edge-renderer spec note) — covered by
  the example suite.
- Regression bar: the zonal example suite (`examples/angular/`) must still pass; full
  `packages/angular` vitest suite green.

## Rollout

1. Implement in `@angflow/angular` (pure helpers → store computeds → service → renderer wiring →
   CSS), TDD throughout.
2. Bump `@angflow/angular` (patch/minor — new feature → minor). No system bump.
3. Build, publish (user action — 2FA).
4. Mark feedback #7 ✅ with the implementing commit(s).
5. Adopt in `brainstorm_agentic_app`: delete the collapse branches of `composeNodes`/`composeEdges`
   (hide members + edge remap + dedupe), set `collapsed` on group nodes, and call
   `toggleNodeCollapsed` from the existing header chevron. `groupBounds`/coordinate conversion stay
   until #9/#10 land.

*Process note: Angular-package + docs only; `@angflow/system` is intentionally untouched.*
