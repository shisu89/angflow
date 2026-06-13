# Group-aware packed layout + controlled-mode `measured` resilience — Design

**Date:** 2026-06-13
**Status:** Approved (brainstorming)
**Source:** `brainstorm_agentic_app/docs/angflow-feedback.md` findings #12 and #13.

## Problem

Two open findings from the test-flight app, both against `@angflow/angular@0.3.4`:

### #13 — Floating edges mis-anchor; controlled mode loses `measured`
With `edgeMode="floating"`, edge endpoints *sometimes* land 25–40px inside a node and draw
over it instead of meeting the border (measured: 36 of 98 endpoints on a real canvas). It
affects ungrouped nodes too, so it is a node **size** problem, not a sub-flow/position one.

Root cause: the app is controlled (`[nodes]="nodes()"`), and `nodes()` is re-derived from a
journal on every op via `composeNodes`, emitting plain nodes with **no `measured`**. On each
re-render the user-node object identity changes, so `adoptUserNodes` (`@angflow/system`)
rebuilds a fresh internal node and copies `measured` **only** from the incoming node —
discarding the DOM-measured value held on the previous internal node. The floating-edge
border math then uses the ~150×40 default, so the computed endpoint falls inside the larger
rendered card. It self-corrects on the next `ResizeObserver` pass — hence "sometimes". Same
root gap as feedback #5 (the #5 decision to *not* wire `applyDimensionChanges` leaves this
broken).

### #12 — Compound `layoutNodes` cascades disconnected clusters into a diagonal staircase
On a real 121-node / 9-group canvas, `tidy()` ballooned the canvas to **2654 × 14741px** —
the 9 group boxes laid out in a tall diagonal staircase, so `fitView` zooms out until nothing
is legible.

Root cause: dagre places **disconnected** components/clusters by stacking them along the
cross-axis. This app's groups are *spatial* (user-lassoed), not connected subgraphs — measured
on this canvas: **0 cross-group edges**, and many members are internally disconnected too.
Under `direction:'LR'`, every disconnected piece gets its own column → vertical cascade. The
isolation harness confirmed group-box *size is irrelevant* (0×0, 240×100, and 446×1152 all
produced the same ~2700×12673 bbox), and that even a *flat* layout of this graph is
~2400×11410 — clustering then stacks the 9 disconnected groups on top of that.

**Sub-finding:** `internals.positionAbsolute` is stale right after `applyLayout` for parented
children. `applyLayout({coordinateSpace:'absolute'})` writes each grouped child's *relative*
`node.position` correctly, but a caller reading `internals.positionAbsolute` immediately after
the awaited call may observe the pre-layout value. The app worked around it by walking the
`parentId` tree itself to resolve absolute positions to journal; it would prefer the library
expose this.

## Goals

- Floating edges, `fitView`, and the minimap stay correct across controlled `[nodes]` updates
  that omit `measured`, with **zero** app-side dimension round-tripping.
- `applyLayout(layoutNodes, { coordinateSpace: 'absolute' })` produces a **compact** layout on
  spatially-grouped, internally-disconnected canvases — the app deletes its
  `packed-group-layout.ts` workaround and calls plain `layoutNodes`.
- A caller can read a node's final absolute position immediately after `applyLayout`.

## Non-goals

- No change to the agent tool catalog (`AGENT_TOOL_SCHEMAS`), so no `AGENT_BRIDGE.md` edit and
  no `@angflow/mcp` snapshot regeneration. The `layout_nodes` agent tool benefits automatically.
- No new controlled-mode dimension round-trip API (the #5 `applyDimensionChanges` path stays as
  is; this design removes the *need* for it for `measured`-dependent features).
- No reactive group auto-size input (feedback #9 already shipped `getGroupBounds` +
  `sizeGroupToChildren`).

---

## Fix A — Preserve `measured` across controlled round-trips (#13)

**File:** `packages/system/src/utils/store.ts`, `adoptUserNodes`.

When the user-node identity changed (controlled round-trip) and a fresh internal node is built
(the `else` branch, ~line 161–174), fall back to the prior internal node's `measured` when the
incoming node omits it:

```ts
measured: {
  width:  userNode.measured?.width  ?? internalNode?.measured?.width,
  height: userNode.measured?.height ?? internalNode?.measured?.height,
},
```

`internalNode` still references the previous internal node during RHS evaluation (the
reassignment happens after) — the same pattern the adjacent `parseHandles(userNode,
internalNode)` already relies on. For a genuinely new node there is no prior entry, so both
fall to `undefined` (unchanged). On node removal the entry is dropped from `nodeLookup`, so no
stale measured lingers.

**Why this is safe:** incoming `measured` still wins when present, so apps that *do* round-trip
dimensions are unaffected. `@angflow/system` is consumed only by `@angflow/angular` (the
`react/` and `svelte/` trees are reference copies that use `@xyflow/*`), so this does not change
behavior for any shipped React/Svelte consumer. Preserving the last DOM-measured value until the
next `ResizeObserver` tick is strictly better than resetting to the 150×40 default. The
`nodesInitialized` check (line ~179) then correctly sees the node as measured.

---

## Fix B — Group-aware packed layout inside `layoutNodes` (#12 main)

**File:** `packages/angular/src/lib/layout/layout-nodes.ts`. Stays self-contained: depends only
on `@dagrejs/dagre` (bounds math inlined; no `getGroupBounds` import, to keep the
`@angflow/angular/layout` subpath free of a main-package dependency).

This absorbs the app's proven three-phase `packedGroupLayout` (reference:
`brainstorm_agentic_app/web/src/app/canvas/packed-group-layout.ts`), generalized and configurable.

### New options (additive to `LayoutNodesOptions`)

| Option | Default | Meaning |
|--------|---------|---------|
| `packComponents` | `true` | Grid-pack disconnected components instead of accepting dagre's cross-axis cascade. No-op for a single (connected) component. |
| `groupPadding` | `24` | Padding inset used when sizing a group's super-node box from its members (matches the app's `GROUP_PAD`). |
| `groupHeaderHeight` | `40` | Extra top inset for a group header (matches the app's `GROUP_HEADER`). |

Defaults are chosen so the app can call `applyLayout(layoutNodes, { direction, coordinateSpace:
'absolute' })` with no extra options and get layout consistent with its own
`getGroupBounds(..., { padding: GROUP_PAD, headerHeight: GROUP_HEADER })` box rendering. (If the
app's constants differ, it passes them through; an approximate match only changes inter-group
gaps slightly, never correctness.)

### Algorithm

1. **`packComponentsIntoGrid(positions, sizes, opts)` — pure helper.** Given a level's computed
   top-left positions, node sizes, and that level's edge set, find connected components (union-
   find over the edges). If there is one component, return positions unchanged. Otherwise:
   compute each component's bounding box, order components by size (largest first) for stable
   packing, and place each component's bbox into a near-square grid
   (`cols = ceil(sqrt(n))`), translating every node in the component by the grid-cell offset
   minus the component's bbox origin. Cell dimensions derive from the max component bbox per
   axis plus `nodeSep`. This preserves each component's *internal* dagre layout while replacing
   the inter-component placement.

2. **Flat (non-compound) path.** Run dagre as today, then apply `packComponentsIntoGrid` over
   the result (gated by `packComponents`). Single-component graphs are byte-identical to today.

3. **Compound (any `parentId` present) path — recursive.**
   - **Local:** for each group, lay out its members with `layoutNodes` over the group's intra-
     group edges (recursing, so members are themselves component-packed), then size the group's
     box from the member bounding box + `groupPadding` (all sides) + `groupHeaderHeight` (top).
   - **Outer:** build an outer graph of one super-node per group (sized to its box) plus all
     ungrouped nodes. Lift each edge to its endpoints' super-node (`parentId ?? id`), dropping
     intra-group edges and deduping parallels. Lay out the outer graph (component-packed).
   - **Expand:** member absolute = outer box origin + (local member − local box origin). Return
     each group node's box top-left too (drives `coordinateSpace:'absolute'` re-basing). Nesting
     falls out of the recursion (a group whose members include sub-groups).

Output remains in **absolute** coordinates. `applyLayout(layoutNodes, { coordinateSpace:
'absolute' })` already translates parented children into parent-relative space and is unchanged.
Existing guards (dangling edges skipped, edges incident on a compound parent skipped, `parentId`
cycles treated as top-level) are preserved.

### Degenerate behavior (regression safety)

- No `parentId` in the set + single connected component → identical to today's flat dagre.
- No `parentId` + multiple components → grid-packed (the new, intended behavior; the only flat
  behavior change, and strictly more compact than the cascade).
- Empty group / single member → trivial (box wraps the one member, or a zero-member box at
  origin).

### App impact

`packed-group-layout.ts` is deleted; `tidy()` calls `applyLayout(layoutNodes, { direction:
'LR', coordinateSpace: 'absolute' })`. `@dagrejs/dagre` stays as the optional peer the
`@angflow/angular/layout` subpath needs.

---

## Fix C — `getAbsolutePosition` + fresh recompute (#12 sub-finding)

**File:** `packages/angular/src/lib/services/ng-flow.service.ts`.

Add a public method:

```ts
/** Resolve a node's absolute (flow-space) position by walking the parentId chain
 *  from the current store state. Correct immediately after applyLayout/setNodePositions,
 *  regardless of tween timing. Returns null for unknown ids. */
getAbsolutePosition(id: string): { x: number; y: number } | null
```

It sums `node.position` up the `parentId` chain (honoring each node's `origin` and resolved
dimensions, mirroring `calculateChildXYZ`), so it does not depend on `internals.positionAbsolute`
being recomputed. The app drops its manual parent-walk and journals
`getAbsolutePosition(id)` per laid-out node.

Additionally, add a test reproducing "read `internals.positionAbsolute` immediately after
`await applyLayout({coordinateSpace:'absolute'})` on a grouped canvas" to confirm whether the
store recompute path leaves it fresh on both the immediate and tween paths; repair the path if
the test shows staleness. (`triggerNodeChanges` already calls `updateAbsolutePositions` for
parented moves; the test pins down whether the tween/await ordering exposes a stale read.)

---

## Testing

- **system (`packages/system`):** `adoptUserNodes` preserves prior `measured` when a re-adopted
  node (new object identity) omits `measured`; a brand-new node yields `undefined` measured; a
  removed node leaves no stale entry; incoming `measured` overrides the prior value.
- **angular layout (`packages/angular`, layout subpath):**
  - Disconnected components pack into a compact grid — assert the result bbox is far smaller than
    the cascade (e.g. width/height ratio bounded) and components don't overlap.
  - Grouped + internally-disconnected canvas stays compact (no diagonal staircase).
  - Single connected component, and no-`parentId` input, are unchanged vs. current output.
  - Nesting: a sub-group's members cluster within their parent group's box.
  - Existing compound tests (feedback #8/#10 coverage) are rewritten to assert *properties* —
    member-within-box containment, relative ordering, compactness — rather than exact dagre
    coordinates, which the packing changes.
- **angular service:** `getAbsolutePosition` for a top-level node and a nested
  (group → sub-group → leaf) node; `internals.positionAbsolute` is fresh after `await
  applyLayout` on a grouped canvas.
- **Examples:** the zonal example suite (`examples/angular/`) stays green; the zoneless
  validation bar is unaffected (no Zone assumptions introduced).

## Docs

- Update the `layoutNodes` doc comment in `layout-nodes.ts`: compound layout now packs members
  compactly and grid-packs disconnected components rather than sprawling; document
  `packComponents`, `groupPadding`, `groupHeaderHeight`.
- No `AGENT_BRIDGE.md` change and no `@angflow/mcp` snapshot regeneration (tool catalog
  unchanged).

## Publish

Per `CLAUDE.md`: bump + publish `@angflow/system` (Fix A) first, then `@angflow/angular`
(Fixes B & C) with `pnpm publish`. `@angflow/mcp` needs no republish (no schema drift). After
publishing, the app adopts: deletes `packed-group-layout.ts`, calls `applyLayout(layoutNodes, …)`,
journals via `getAbsolutePosition`, and removes its manual parent-walk — to be recorded back in
`angflow-feedback.md` (#12, #13 marked ✅).
