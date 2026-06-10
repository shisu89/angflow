# Compound (group-aware) auto-layout

**Date:** 2026-06-09
**Source:** angflow feedback #8 (`brainstorm_agentic_app/docs/angflow-feedback.md`).

Second sub-project of the group-layout cluster. Builds on #10 (absolute-coordinate apply, shipped
in `@angflow/angular@0.1.1`). Feedback #9 (auto-size box) remains a separate spec.

## Problem

`layoutNodes` builds a **flat** dagre graph — it never calls `setParent`, so it has no notion of
`type:'group'` containers / `parentId` membership. Running it on a grouped canvas scatters a
group's members across the layout instead of clustering them inside their box. The reference
consumer worked around this by building the dagre graph directly in
`web/src/app/canvas/tidy-layout.ts` with `new dagre.graphlib.Graph({ compound: true })`,
registering a cluster per `groupId`, and `setParent`-ing each member — re-introducing the very file
that feedback #2 had removed.

## Goals

- `layoutNodes` clusters grouped members within their parent using dagre compound layout, driven by
  each node's `parentId` — so members of one group stay together.
- **Nesting-correct** (groups within groups).
- Backward-compatible: a graph with no `parentId` is byte-identical to today's flat layout.
- Stays a **pure** function (no DOM); `applyLayout`'s existing DOM measurement supplies dims, and
  its existing `coordinateSpace` option (from #10) applies the absolute output.
- No `@angflow/system` changes; no `applyLayout` change (it already forwards `coordinateSpace`).

## Non-goals

- **Sizing/positioning the group box** to wrap its members — that is feedback #9. #8 lays out the
  *members*; until #9 (or app-side box sizing, which the consumer already does via `groupBounds`),
  a clustered group's box will not visually wrap its members.
- Collapsed-group layout interplay — a collapsed group is a single visible node (#7); laying out an
  expanded grouped canvas is what this addresses.

## Design

### Cluster detection: any `parentId` target

A node is a **cluster** iff some in-set node lists it as `parentId`. No `type` check, no new
`type` field on the input — matches dagre's compound model and works for any parent node. Add
`parentId?: string` to `LayoutNodeInput` (real `Node`/`InternalNode` already carry it):

```ts
export interface LayoutNodeInput {
  id: string;
  width?: number | null;
  height?: number | null;
  initialWidth?: number;
  initialHeight?: number;
  measured?: { width?: number; height?: number };
  parentId?: string;
}
```

### `layoutNodes` algorithm

1. Build a node-id set. `const compound = nodes.some(n => n.parentId != null && ids.has(n.parentId))`.
2. Graph: `new graphlib.Graph(compound ? { compound: true } : undefined)` — flat path is created
   exactly as today (no arg) so its output is unchanged.
3. `setNode(id, { width, height })` for every node (dims resolution unchanged:
   `measured → width/height → initialWidth/Height → 150×40`).
4. **New:** when `compound`, for each node with a `parentId` that is in the set,
   `g.setParent(n.id, n.parentId)`. (Parents not in the set are ignored — the node is treated as
   top-level. Guards against `setParent` referencing a phantom node.)
5. Edges: unchanged label-box logic, **plus** skip edges whose `source` or `target` isn't in the
   node set (`if (!ids.has(e.source) || !ids.has(e.target)) continue`). Today such edges make dagre
   auto-create phantom nodes that distort layout — harmless-ish in the flat case, but a real hazard
   for compound clusters. This also makes the docstring's "dangling edges are ignored" literally
   true.
6. `layout(g)`.
7. Output: for every node, read **dagre's computed box** `g.node(id)` (`{x,y,width,height}`) and
   convert center → top-left: `{ x: placed.x − placed.width/2, y: placed.y − placed.height/2 }`.
   Using dagre's `width`/`height` (not the input dims) is correct for **both** leaves (dagre keeps
   the size we set) and **clusters** (dagre computes the wrapping size), so a group node's returned
   position reflects its cluster bounds.

dagre compound emits **absolute/global** coordinates for all nodes including grouped children.

### How callers apply it

```ts
flow.applyLayout(layoutNodes, { direction: 'LR', coordinateSpace: 'absolute' });
```

`applyLayout` already (from #10) forwards `coordinateSpace`, and `setNodePositions` translates each
parented node's absolute position into its parent-relative `node.position` space. So grouped
children land correctly (and animate, if `[animate]` is on). For a flat graph, `coordinateSpace`
may be omitted (absolute === relative for top-level nodes). `layoutNodes`' docstring will state:
*compound output is absolute — apply with `coordinateSpace:'absolute'`.*

### Return shape

Unchanged: `Record<string, { x: number; y: number }>` for all input nodes (leaf and group). No box
sizes returned (that's #9).

## File structure

- `src/lib/layout/layout-nodes.ts` — `parentId` on `LayoutNodeInput`; conditional `compound`
  graph + `setParent`; edge-endpoint guard; dagre-box top-left conversion; docstring update.
- `src/lib/layout/layout-nodes.spec.ts` — new tests.
- No other files. No `applyLayout`/store/system change.

## Testing

`layout-nodes.spec.ts` (pure, Vitest):
- **Clustering:** two groups (gA with a1,a2; gB with b1,b2) plus a chain of edges; assert each
  group's members are positioned within their cluster's bounds and closer to each other than to the
  other group's members (e.g. `|a1−a2| < |a1−b1|`, or members fall inside `g.node(gX)` bounds —
  assert via the returned positions, deterministically).
- **No-parentId regression:** a graph with no `parentId` produces output byte-identical to the
  pre-change flat layout (snapshot a small graph's positions).
- **Parent outside the set:** a node whose `parentId` isn't among the input nodes is laid out as
  top-level — no throw, finite position.
- **Nesting:** `g → sub → leaf` (sub has `parentId:g`, leaf has `parentId:sub`); assert finite
  positions and that `leaf` falls within `sub`'s bounds which fall within `g`'s bounds.
- **Dangling edge skipped:** an edge referencing an id not in the node set doesn't create a phantom
  node — assert by comparing positions to the same graph without that edge (identical).
- **Group node position reflects cluster bounds:** the returned position for a parent (cluster)
  node equals its dagre cluster top-left (sanity: it contains its members).

Regression bar: full `packages/angular` vitest suite green; zonal example suite builds.

## Rollout

1. Implement in `@angflow/angular`, TDD.
2. Bump `@angflow/angular` patch (additive). No system bump.
3. Build, publish (user action — 2FA).
4. Mark feedback #8 ✅ with the implementing commit.
5. Adopt in `brainstorm_agentic_app`: delete the compound-dagre body of `tidy-layout.ts` and call
   `applyLayout(layoutNodes, { direction, coordinateSpace: 'absolute' })`; keep `groupBounds` for
   box sizing until #9.

*Process note: `@angflow/angular/layout` only; `layoutNodes` stays pure; system untouched.*
