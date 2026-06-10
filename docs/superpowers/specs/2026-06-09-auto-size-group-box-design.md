# Auto-size group box to its children

**Date:** 2026-06-09
**Source:** angflow feedback #9 (`brainstorm_agentic_app/docs/angflow-feedback.md`).

Final sub-project of the group-layout cluster. Builds on #10 (absolute-coordinate apply, shipped
in `@angflow/angular@0.1.1`) and complements #8 (compound layout, `0.1.2`).

## Problem

Group nodes take an explicit `width`/`height` (or `style.width/height`); angflow has no
auto-size-to-children behavior. Apps must compute the bounding box themselves and keep it in sync as
members move/resize. The reference consumer does this in `web/src/app/canvas/group-render.ts`
(`groupBounds`/`boundsFromMembers`): it derives the box from member positions with padding + an
asymmetric header inset, recomputed every render — and, because the box is derived, stores absolute
member positions in its journal and converts to/from parent-relative at the render boundary. The box
math (and a fixed 240×100 member-size guess) is duplicated app-side.

## Goals

- A pure helper that computes a group's wrapping box `{ position, width, height }` from its members'
  **measured** sizes plus configurable padding and header inset — the library-blessed `groupBounds`.
- An imperative service call that sizes + positions a group to wrap its children **while keeping the
  children visually fixed** (handling the box-origin ↔ child-coordinate feedback loop).
- Reuse the shipped #10 `coordinateSpace:'absolute'` primitive for nested boxes and child rebasing.
- No `@angflow/system` change.

## Non-goals

- A continuous, reactive `autoSize` input on group nodes that rebases children on every move — high
  magic, fights angflow's controlled model + parent-relative child storage (was option C; rejected).
  The imperative call covers the real cases (after Tidy / drag-stop).
- Animating the resize.

## Design

### Part A — pure `getGroupBounds` (`src/lib/graph/group-bounds.ts`, new)

```ts
export interface GroupBoundsOptions {
  /** Inset on left, right, and bottom. Default 0. */
  padding?: number;
  /** Extra inset on top (for a header/title bar). Default 0. */
  headerHeight?: number;
  /** Minimum box width. Default 0. */
  minWidth?: number;
  /** Minimum box height. Default 0. */
  minHeight?: number;
}

export interface GroupBounds {
  position: { x: number; y: number };
  width: number;
  height: number;
}

/** Minimal member shape getGroupBounds reads. */
interface GroupMember {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number | null;
  height?: number | null;
}

/**
 * Compute the box that wraps `members` with padding and an optional header
 * inset. Coordinate-agnostic: members' positions and the returned position are
 * in the same space (pass absolute members → absolute bounds). Member sizes
 * resolve `measured → width → 0`. With no members, returns a min-sized box at
 * `{0,0}` (the caller positions it).
 */
export function getGroupBounds(members: ReadonlyArray<GroupMember>, opts?: GroupBoundsOptions): GroupBounds;
```

Computation (padding `p`, headerHeight `hh`, both default 0):
- Empty members → `{ position: {0,0}, width: max(minWidth, 2p), height: max(minHeight, hh + p) }`.
- Else, per member: `x0 = position.x`, `y0 = position.y`, `w = measured?.width ?? width ?? 0`,
  `h = measured?.height ?? height ?? 0`, `x1 = x0+w`, `y1 = y0+h`. Then
  `minX/minY/maxX/maxY` over all members and:
  - `position = { x: minX − p, y: minY − hh }`  (header replaces top padding; no extra top pad)
  - `width  = max(minWidth,  (maxX − minX) + 2p)`
  - `height = max(minHeight, (maxY − minY) + hh + p)`

This mirrors the consumer's `GROUP_HEADER` (top) / `GROUP_PAD` (other sides) but uses real measured
member sizes instead of a fixed guess.

Exported from the **main** entry `@angflow/angular` (it has no dagre dependency, unlike the
`/layout` subpath), via `public-api.ts`.

### Part B — `NgFlowService.sizeGroupToChildren(groupId, opts)`

```ts
sizeGroupToChildren(groupId: string, opts?: GroupBoundsOptions): Promise<void>
```

Sizes and positions the group to wrap its direct children (nodes with `parentId === groupId`),
keeping the children visually fixed. The box-origin ↔ child-coordinate feedback loop is resolved by
strict sequencing:

1. Resolve children (`nodes with parentId === groupId`). If none → **no-op** (resolve immediately).
2. Capture each child's **original** absolute footprint: `position = child.internals.positionAbsolute`,
   plus `measured`/`width`/`height`. Compute `bounds = getGroupBounds(thoseMembers, opts)` — absolute
   box bounds.
3. Apply the box: `updateNode(groupId, { width: bounds.width, height: bounds.height })` and
   `await setNodePositions({ [groupId]: bounds.position }, { coordinateSpace: 'absolute' })`. The
   absolute box position is translated to the group's own parent-relative space (identity for a
   top-level group; nested boxes convert via #10). Moving the box updates its `positionAbsolute`.
4. **Rebase children:** `await setNodePositions(childrenOriginalAbsolute, { coordinateSpace: 'absolute' })`
   — re-applies each child's *original* absolute position against the **now-moved** box, so their
   parent-relative positions shift to keep them visually pinned. This step **must** run after step 3
   (it converts against the box's new `positionAbsolute`).

Immediate (not animated): a resize shouldn't tween the children (and step 4 keeps them stationary).

`opts` is the same `GroupBoundsOptions`.

### Coordinate-loop correctness (why it works)

A child's stored absolute is `box.positionAbsolute + child.position`. After step 3 the box's
absolute origin = `bounds.position`; the children's relative positions are still the old values, so
their absolutes have shifted. Step 4 sets each child's absolute back to its captured original:
`newRelative = originalAbsolute − newBoxAbsolute`, so `child.positionAbsolute` returns to
`originalAbsolute` — visually unchanged. Captured-before-move is essential (step 2 before step 3).

## File structure

- `src/lib/graph/group-bounds.ts` (new) — `getGroupBounds`, `GroupBounds`, `GroupBoundsOptions`.
- `src/lib/graph/group-bounds.spec.ts` (new).
- `src/lib/services/ng-flow.service.ts` — `sizeGroupToChildren` (near the other node ops).
- `src/lib/services/ng-flow.service.spec.ts` — service tests.
- `src/lib/public-api.ts` — export `getGroupBounds`, `GroupBounds`, `GroupBoundsOptions`.
- `packages/angular/README.md` — a short "Group auto-size" note.
- No `@angflow/system` change.

## Testing

- **`getGroupBounds`** (pure, `group-bounds.spec.ts`): wraps two members with padding + header
  (assert exact position/width/height); member sizes use `measured` (then `width` fallback, then 0);
  asymmetric header (top inset = headerHeight, others = padding); `minWidth`/`minHeight` clamp a
  small set; empty members → min box at `{0,0}`.
- **`sizeGroupToChildren`** (TestBed, `ng-flow.service.spec.ts`):
  - group + 2 children at known absolute positions (give children `width/height` so dims resolve):
    group `width`/`height` are set to the wrapping size, group position moves to wrap, and **each
    child's `internals.positionAbsolute` is unchanged** (the load-bearing invariant).
  - empty group (no children) → no-op (group unchanged), no throw.
  - nested group (the group itself has a `parentId`): the box position is applied in the group's
    parent-relative space correctly (child absolutes still unchanged).
- Regression bar: full `packages/angular` vitest suite green; zonal example suite builds.

## Rollout

1. Implement in `@angflow/angular`, TDD.
2. Bump `@angflow/angular` minor (new exported API → `0.2.0`). No system bump.
3. Build, publish (user action — 2FA).
4. Mark feedback #9 ✅ — and note the group-layout cluster (#7/#8/#9/#10) is complete.
5. Adopt in `brainstorm_agentic_app`: replace `boundsFromMembers`/`groupBounds` with `getGroupBounds`;
   where boxes are derived imperatively (post-Tidy), call `sizeGroupToChildren`. `group-render.ts`
   shrinks to mostly composition.

*Process note: Angular-package + docs only; `layoutNodes`/system untouched; reuses #10's
`coordinateSpace`.*
