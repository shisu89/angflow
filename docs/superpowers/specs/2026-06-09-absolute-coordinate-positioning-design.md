# Absolute-coordinate node positioning

**Date:** 2026-06-09
**Source:** angflow feedback #10 (`brainstorm_agentic_app/docs/angflow-feedback.md`).

First sub-project of the group-layout cluster. Feedback #8 (compound layout) and #9 (auto-size
box) are **out of scope** here and get their own specs; this primitive is the foundation #8 builds
on.

## Problem

`NgFlowService.setNodePositions` (and the underlying `tweenNodePositions`) take positions in
`node.position` space — **parent-relative** for a node with `parentId`, absolute for a top-level
node. Apps and layout engines that work in absolute/flow coordinates (the journal, dagre compound
layout, the consumer's `tidy()`) must convert to each node's parent-relative space themselves, and
there is no coordinate-space option. The reference consumer instead **skips the animated tween
entirely for grouped nodes** (`canvas.component.ts` `tidy()`: `sized.some(n => n.groupId != null)`)
and relies on a journal re-render, so grouped canvases snap instead of animating. There is no
absolute→relative translation and no `coordinateSpace` option.

## Goals

- `setNodePositions` and `applyLayout` accept absolute coordinates for parented nodes via an
  opt-in `coordinateSpace: 'absolute'`, translating to each node's parent-relative `node.position`
  space internally.
- Default behavior is unchanged (`coordinateSpace: 'relative'`).
- Nesting-correct (parent's `positionAbsolute` encodes the full ancestor chain).
- The store's immediate (`triggerNodeChanges`) and animated (`tweenNodePositions`) paths stay
  untouched — they keep operating purely in `node.position` space.
- No `@angflow/system` changes.

## Non-goals

- Compound/group-aware **layout** (#8) and **auto-size** box geometry (#9) — separate specs.
- Wiring the agent-bridge `layout_nodes` tool to emit absolute coordinates — that rides with #8
  (which actually produces absolute coords). #10 only makes the primitive available.
- A public coordinate-conversion helper — kept internal (YAGNI).

## Design

### API

Extend the existing options bag on both methods (`NgFlowService`):

```ts
setNodePositions(
  positions: Record<string, { x: number; y: number }>,
  opts?: { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' },
): Promise<void>

applyLayout<O>(
  layoutFn: ...,
  opts?: O & { animate?: ...; coordinateSpace?: 'relative' | 'absolute' },
): Promise<void>
```

- `coordinateSpace` default `'relative'` — values are in `node.position` space (parent-relative
  for parented nodes, absolute for top-level), exactly as today. No conversion.
- `coordinateSpace: 'absolute'` — values are flow-absolute. Each **parented** node's position is
  translated to its parent-relative space before applying; top-level nodes pass through unchanged.

Naming follows xyflow's `position` (relative) vs `positionAbsolute` vocabulary.

### Conversion (single point, at the service boundary)

The store's actual child-positioning (`updateChildNode` → `getNodePositionWithOrigin`, system
`store.ts:290-298` / `graph.ts:140`) is the transform we must invert — **not**
`evaluateAbsolutePosition`, which uses the *parent's* origin and is a separate, inconsistent code
path. The store computes:

```
positionWithOrigin = child.position − dims·origin     (origin = child.origin ?? store.nodeOrigin)
positionAbsolute   = parent.positionAbsolute + positionWithOrigin   (then extent-clamped)
```

So the inverse is:

```
relative = absolute − parent.internals.positionAbsolute + dims·origin
```

using the **child's** `origin` (`node.origin ?? store.nodeOrigin()`) and the child's resolved
dimensions (`measured.width ?? width ?? initialWidth ?? 0`, matching `getNodeDimensions`). For the
default origin `[0,0]` this reduces to `relative = absolute − parent.positionAbsolute`. The
immediate parent's `positionAbsolute` already encodes the full ancestor chain, so nested parents
need no extra walking. We do **not** clamp in the conversion — the store re-applies extent clamping
when it writes the position (`updateChildNode`), so feeding an unclamped relative is correct.

A private method on `NgFlowService` does the conversion once on the incoming map and returns a
relative map, which is then handed to the **existing** `setNodePositions` body:

```ts
private toRelativePositions(
  positions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const origin = this.store.nodeOrigin();
  for (const [id, abs] of Object.entries(positions)) {
    const node = this.store.nodeLookup.get(id);
    const parent = node?.parentId ? this.store.nodeLookup.get(node.parentId) : undefined;
    if (!node || !parent) {
      out[id] = abs; // top-level, unknown, or orphaned parent → use as-is
      continue;
    }
    const o = node.origin ?? origin;
    const w = node.measured?.width ?? node.width ?? node.initialWidth ?? 0;
    const h = node.measured?.height ?? node.height ?? node.initialHeight ?? 0;
    const pAbs = parent.internals.positionAbsolute;
    out[id] = { x: abs.x - pAbs.x + w * o[0], y: abs.y - pAbs.y + h * o[1] };
  }
  return out;
}
```

`setNodePositions` converts first when `coordinateSpace === 'absolute'`, then runs its current
logic unchanged:

```ts
setNodePositions(positions, opts) {
  const resolved = opts?.coordinateSpace === 'absolute'
    ? this.toRelativePositions(positions)
    : positions;
  // ...existing valid-id filter + animate decision + tween/immediate on `resolved`...
}
```

`applyLayout` destructures `coordinateSpace` alongside `animate` and forwards both:
`await this.setNodePositions(positions, { animate, coordinateSpace })`.

### Edge cases

- **Top-level node** (no `parentId`): identity — absolute equals its `node.position` space.
- **Parented node, parent missing from lookup**: position used as-is (graceful degradation),
  consistent with how the rest of the store tolerates missing parents.
- **Unmeasured node** (`measured` absent): `dims` default to 0 — correct for the default origin
  `[0,0]`; only matters for non-`[0,0]` origins, where a not-yet-measured node is already an
  unusual state.

## File structure

- `src/lib/services/ng-flow.service.ts` — add `coordinateSpace` to `setNodePositions` and
  `applyLayout` opts; add the private `toRelativePositions`.
- `src/lib/services/ng-flow.service.spec.ts` — new tests.
- No other files. No system change. No new exports.

## Testing

`ng-flow.service.spec.ts` (uses TestBed + FlowStore):
- `coordinateSpace:'absolute'` on a **top-level** node is identity (writes the same position).
- On a **parented** node, the written `node.position` equals `absolute − parent.positionAbsolute`
  (seed a parent at a known absolute position via `setNodes` with `parentId`, assert the child's
  resulting `position`).
- **Nested** parent (grandparent→parent→child): child converts against its immediate parent's
  `positionAbsolute` (which includes the grandparent), landing at the right absolute spot.
- **Non-default origin** (`nodeOrigin` or node `origin`): the `dims·origin` term is applied.
- **Missing parent**: parented node with a `parentId` not in the graph → position used as-is, no
  throw.
- **Default (`'relative'` / omitted)**: behavior identical to before (regression guard) — a
  parented node's position is written verbatim.
- **Tween path**: with `animate` on, the tween targets the converted (relative) position
  (`tweenNodePositions` receives relative coords) — spy on `tweenNodePositions`.
- **applyLayout forwards `coordinateSpace`**: a layout fn returning absolute coords for a parented
  node, called with `coordinateSpace:'absolute'`, lands the child correctly.

Regression bar: full `packages/angular` vitest suite green; zonal example suite builds.

## Rollout

1. Implement in `@angflow/angular`, TDD.
2. Bump `@angflow/angular` patch (additive, backward-compatible). No system bump.
3. Build, publish (user action — 2FA).
4. Mark feedback #10 ✅ with the implementing commit.
5. Adopt in `brainstorm_agentic_app`: in `tidy()`, stop skipping the tween for grouped nodes —
   pass absolute layout positions with `coordinateSpace:'absolute'` so grouped children animate.

*Process note: Angular-package only; `@angflow/system` is intentionally untouched.*
