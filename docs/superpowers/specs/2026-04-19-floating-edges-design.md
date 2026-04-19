# Floating Edges — Design

**Date:** 2026-04-19
**Status:** Approved design; ready for implementation planning
**Scope:** Promote floating edges from an example-level workaround to a first-class library feature via a per-handle `floating` flag, with whole-node drop fallback during connection drag.

## Context

This is one of six Tier 1 "out-of-box features" initiatives carved from the broader Topic 2 scope in the roadmap (custom-node API, culling, alignment guides, serialization, read-only mode, duplicate-id detection, floating edges). Each gets its own brainstorm → spec → plan → implementation cycle. This is the first.

Related:

- Previous upgrade shipped on `feat/angular-19-zoneless`: raised the peer floor to Angular 19 and made the library zoneless-native. `@angflow/angular@0.1.0` is in pre-release pending examples-track + consumer sign-off.
- The other five Tier 1 features will be brainstormed and shipped separately. Ordering preference: floating edges first (smallest surface, validates the "promote example to core" pattern); culling audit and alignment guides next by impact; read-only, serialization, and duplicate-id detection in any convenient order.

## Problem

The library currently ships floating-edge *behavior* only as an example (`examples/angular/src/app/examples/floating-edges/floating-edges.component.ts`, 191 lines). That example is a workaround, not floating edges: each node declares eight invisible handles (top/right/bottom/left × source/target), and consumer code maintains a `getClosestSide` helper that rewrites every edge's `sourceHandle` / `targetHandle` on every `nodesChange`. Endpoints **hop between four cardinal midpoints**; they do not slide smoothly along the node perimeter.

Consumers who expect floating edges to behave the way they do in ReactFlow (endpoints computed as ray-rect intersections of the line between node centers, smoothly tracking motion) end up re-implementing the same handle-switching workaround in their own apps, or patching it into the library from the outside.

Beyond rendering, the drop-target semantics also need attention: today a connection drag must land within `connectionRadius` pixels of a specific handle's DOM position. For floating anchors, the whole node should be the drop target.

## Goals

- Add a `floating` input to `HandleComponent`. Default `false`.
- When an edge endpoint is connected to a handle with `floating: true`, compute that endpoint at render time as the intersection of a ray from the owning node's center (aimed at the other endpoint's reference point) with the owning node's bounding rectangle.
- Support **mixed edges**: one fixed end, one floating end, same edge.
- Change connection-drag drop semantics: fixed handles win at short range (within `connectionRadius`); floating handles accept drops anywhere inside their owning node when no fixed handle is close enough (Stage 1 / Stage 2 logic).
- When multiple compatible floating handles exist on a single node, pick the one whose declared `[position]` is closest to the pointer's side of the node.
- Remove the handle-switching workaround from `examples/angular/src/app/examples/floating-edges/` and rebuild the example using the new `floating` flag. The rebuilt example must visibly slide endpoints smoothly around node perimeters. Add a mixed-mode subexample (node with both fixed row-handles and a floating target anchor).
- Support floating edges for all existing edge types (bezier, straight, step, smooth-step, simple-bezier). Path generation reads the computed endpoint coordinates and is indifferent to how they were computed.

## Non-goals

- Edge-level floating overrides (`sourceFloating` / `targetFloating` on `Edge`). Evaluated as Approach 2 during brainstorming and explicitly rejected — adds a second way to express the same thing, creates precedence-rule confusion. Can be layered on later if a real use case appears.
- Convenience directive such as `<ng-flow-floating-anchor>`. Evaluated as Approach 3 and deferred — if the `<ng-flow-handle floating position="...">` pattern proves verbose in practice, we can ship a sugar directive without breaking the primary API.
- Custom-shape intersection (circles, polygons). This spec assumes rectangular node bounds, which is what the FlowStore measures via `ResizeObserver`. Nodes that render circular or polygon visuals use their bounding rectangle for intersection.
- Drag-preview snapping (preview endpoint continuously snaps to the ray-rect intersection while the drag is in flight). Deferred until consumers report the end-of-drag "jump" is noticeable enough to fix.
- Changes to the `Edge` data model. Floating-ness is declared handle-side; `Edge` shape is unchanged.
- Orthogonal / path-avoidance edge routing. Different feature.
- Keyboard-initiated connection drag changes. Out of this spec's scope.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Where to declare floating | Per-handle (`<ng-flow-handle [floating]="true">`) | Matches the user's mental model: "this point is fixed / this point can float." Avoids per-edge configuration noise. |
| Per-edge override | Not included | Approach 2 from brainstorming; YAGNI. Handle-level declaration covers the user's described scenarios. |
| Convenience directive | Not included | Approach 3; premature abstraction. |
| Handle's `[position]` when floating | Required, used for drag-start DOM dot, ignored for edge rendering | Keeps connection-drag from a floating handle working without a new drop-zone system. |
| Drop-target priority during connection drag | Fixed handles within `connectionRadius` first; whole-node floating fallback second | Preserves row-handle precision; adds floating tolerance only when needed. |
| Reference point for "both ends floating" | Other node's center (not other endpoint's computed position) | Breaks the chicken-and-egg cleanly; visual difference is invisible at normal distances. |
| Self-loops on floating edges | Disabled — fall back to fixed-handle positions | Geometric degeneracy; custom edges can solve this differently if needed. |
| `Handle` type in `@angflow/system` | Gains optional `floating?: boolean` | Non-breaking for React / Svelte flow packages that share the type. |
| Drag-preview snapping | Deferred | Ship-small principle; can add later without breaking changes. |

## Public API surface changes

### New input on `HandleComponent`

Location: `packages/angular/src/lib/components/handle/handle.component.ts`.

```typescript
readonly floating = input(false);
```

- Standard Angular signal input. Reactive; consumers can bind a signal or boolean literal.
- Default `false`. Backward-compatible.
- When `true`: the `[position]` continues to be used for the handle's DOM dot (drag-start origin), but edges connected to this handle render their endpoint at the ray-rect intersection, and the handle acts as a fallback drop-target anywhere inside its owning node.

### Unchanged

- `Edge` type / edge data model. No new fields.
- `Node` type.
- `NgFlowComponent` inputs / outputs.
- `NgFlowService` public methods.
- Every existing example except `examples/angular/src/app/examples/floating-edges/`.

### Internal-only changes

- The FlowStore's handle registry carries `floating: boolean` per registered handle. Consumed by the edge renderer and the connection-drag logic.
- A new pure helper `getFloatingEndpoint(nodeRect, referencePoint)` in `@angflow/system` computes ray-rect intersection. Pure math, no framework coupling.
- A new internal helper `getFloatingDropTarget(position, nodeLookup, fromHandle)` in `@angflow/system/xyhandle/utils.ts` contains the Stage 2 fallback logic.
- The `Handle` type in `@angflow/system/types` gains an optional `floating?: boolean` field. Non-breaking addition.
- The edge renderer switches endpoint-computation strategy per endpoint based on the handle's `floating` flag.
- The connection-drag entry point (`getClosestHandle` callers) chains to `getFloatingDropTarget` when `getClosestHandle` returns null.

### Impact on consumers

Zero. Consumers using existing handle markup work identically. Floating is strictly opt-in per handle.

## Data flow: rendering a floating endpoint

### Current endpoint computation

At `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts:340-358`, the renderer resolves each endpoint:

```typescript
if (sourceHandle) {
  sourceX = sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2;
  sourceY = sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2;
} else { /* fallback to node-center-bottom */ }
```

`sourceHandle.x/y` are the handle's measured DOM geometry relative to the owning node.

### New logic

Replace the above with a three-case switch per endpoint:

```typescript
// Pseudocode — implementation pattern, not final code
if (handle && handle.floating) {
  ({ x: sourceX, y: sourceY } = getFloatingEndpoint(sourceNodeRect, referencePoint));
} else if (handle) {
  sourceX = sourcePos.x + handle.x + handle.width / 2;
  sourceY = sourcePos.y + handle.y + handle.height / 2;
} else {
  // legacy no-handle fallback — unchanged
}
```

### Ray-rect intersection helper

Pure function, framework-agnostic. Lives in `@angflow/system` alongside existing edge-path helpers.

```typescript
export function getFloatingEndpoint(
  nodeRect: { x: number; y: number; width: number; height: number },
  referencePoint: { x: number; y: number },
): { x: number; y: number } {
  const cx = nodeRect.x + nodeRect.width / 2;
  const cy = nodeRect.y + nodeRect.height / 2;
  const dx = referencePoint.x - cx;
  const dy = referencePoint.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = nodeRect.width / 2;
  const halfH = nodeRect.height / 2;
  const tX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  return { x: cx + t * dx, y: cy + t * dy };
}
```

O(1). No meaningful overhead per edge.

### Reference-point resolution

| Source handle | Target handle | Reference point for source | Reference point for target |
|---|---|---|---|
| Fixed | Fixed | N/A | N/A |
| Fixed | Floating | N/A | Source handle's DOM position |
| Floating | Fixed | Target handle's DOM position | N/A |
| Floating | Floating | Target node's center | Source node's center |

The "both floating" case deliberately uses node centers rather than the other endpoint's computed position — avoids circular dependency; visual difference is negligible at normal graph-editor distances.

### Node rectangle source

```typescript
{
  x: node.internals.positionAbsolute.x,
  y: node.internals.positionAbsolute.y,
  width:  node.measured?.width  ?? node.width  ?? 150,
  height: node.measured?.height ?? node.height ?? 40,
}
```

Same fallback chain the renderer uses today (`edge-renderer.component.ts:335-338`).

### `sourcePosition` / `targetPosition` inference

For floating endpoints, infer the exit side from the intersection point's relationship to the node center:

```typescript
function inferSide(intersection: Point, nodeRect: Rect): Position {
  const cx = nodeRect.x + nodeRect.width / 2;
  const cy = nodeRect.y + nodeRect.height / 2;
  const dx = intersection.x - cx;
  const dy = intersection.y - cy;
  return Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? Position.Right : Position.Left)
    : (dy > 0 ? Position.Bottom : Position.Top);
}
```

Bezier, step, smooth-step, and simple-bezier path generators use this to shape the curve correctly at the floating end.

### Reactivity

No new reactivity plumbing. The renderer already recomputes endpoints when nodes move (position signal), nodes resize (ResizeObserver → signal write), or `version()` bumps. Floating endpoints inherit these triggers.

## Connection-drag changes

### Current (`packages/system/src/xyhandle/utils.ts:28-76`)

`getClosestHandle(position, connectionRadius, nodeLookup, fromHandle)` scans handles within `connectionRadius + ADDITIONAL_DISTANCE` of the pointer, returns the nearest handle within `connectionRadius`, or null.

### New two-stage logic

**Stage 1 — unchanged.** Existing `getClosestHandle` behavior. A fixed handle within `connectionRadius` wins every time.

**Stage 2 — new floating fallback.** Invoked only when Stage 1 returns null.

1. For each node whose bounding rect contains the pointer:
   - Skip if `node.id === fromHandle.nodeId` (self-connection guard).
   - Collect handles where `handle.floating === true`, `handle.type === oppositeOf(fromHandle.type)`, and `handle.isConnectable !== false`.
2. If no candidates, continue to the next node.
3. If multiple nodes contain the pointer, pick the one with highest `zIndex`. Ties broken by `nodeLookup` Map iteration order (insertion order = first-registered wins).
4. Among candidates on the chosen node:
   - One candidate → return it.
   - Multiple → score by position-side match to the pointer's side of the node, fall back to closest-by-angle.
5. Apply any per-handle `isValidConnection` validator. If it rejects, return null (no cascade to next candidate).

### Visual feedback

- Stage 1 winner: existing handle-dot highlight (unchanged).
- Stage 2 winner: add CSS class `.ng-flow__node--connection-target` on the winning node's DOM element. Ship a minimal default style (light outer border or shadow). Class is removed when the pointer leaves the node or enters another Stage 1 range.

### Pointer-type parity

Mouse, touch, and pen behave identically — all report pointer coordinates; Stage 1 / Stage 2 branch identically.

## Example refresh

### Target

Rewrite `examples/angular/src/app/examples/floating-edges/floating-edges.component.ts` (currently 191 lines) to ~60–70 lines.

- Node component declares **two handles total** per node (one source, one target, both `floating: true`).
- Drop the `getClosestSide` helper and `NODE_W` / `NODE_H` constants.
- Drop the `updateEdgeHandles` method and its wiring from `onNodesChange` / `onConnect`.
- Edges reference the handle ids (e.g. `'auto'`) without the handle-switching fields.

### Mixed-mode subexample

Add a second node type (`MixedNodeComponent`) in the same file with:

- Two fixed row-handles (`[position]="Position.Right"`, no `floating`).
- One floating target anchor (`[floating]="true"`).

Seed 1–2 edges that connect row-handle sources to other nodes' floating targets. Dragging the mixed node demonstrates row-handles staying pinned while the floating endpoint slides.

### Description string

Update the `<app-example-card>` description to:

> "Edges connect at floating anchors that slide around the node's perimeter as nodes move. Mix fixed row-handles with floating anchors on the same node — edges with a fixed source and floating target render naturally."

### Cross-track coupling

The examples-reorganization / angflow-pro split is a separate initiative. This spec rebuilds **only the single free example at its current location**. Any subsequent migration or promotion of this example is owned by the examples track.

### Manual regression matrix

The rebuilt example is the manual-test surface. Validation before merge:

1. Drag a floating node → endpoints slide smoothly on the perimeter (no four-point hopping).
2. Drop a connection anywhere inside a floating-target node → edge lands on the nearest border.
3. Drop a connection precisely on a row-handle → row-handle wins over the floating fallback.
4. Mixed-mode edge (fixed source, floating target) renders correctly and updates as either node moves.
5. Reconnect an existing floating endpoint by grabbing it and moving it to a different target → lands correctly.

## Edge cases

### Geometry

- **Overlapping node centers.** `getFloatingEndpoint` returns the shared center. Edge collapses to a point; acceptable if consumers overlap nodes.
- **Self-loops (`source === target`).** Floating disabled for that edge; falls back to fixed-handle positions.
- **Unmeasured nodes.** 150×40 fallback dimensions apply (existing behavior). One-frame flicker on first render is acceptable.

### Handle registry

- **Edge references a non-registered handle id.** Edge falls through to legacy center-bottom path (unchanged).
- **`floating` flag toggles at runtime via signal.** Registry update + `version()` bump triggers recompute on next frame. No cleanup needed.
- **Handle unregistered while edge references it.** Same as non-registered-from-start; legacy fallback.

### Connection drag

- **Pointer inside overlapping nodes.** Highest `zIndex` wins; iteration order breaks ties.
- **Node has floating handles but none are type-compatible with the drag source.** Stage 2 returns null for that node.
- **`isValidConnection` rejects a floating candidate.** Return null; do not cascade to next candidate.
- **Connection drag starts from a floating handle.** Floating handle has a `[position]` with a DOM dot; drag origin is that point. Stage 1 / Stage 2 logic governs the drop as usual.

### Rendering

- **Markers (arrowheads).** Align with the tangent at the endpoint. Inferred `sourcePosition` / `targetPosition` keeps tangents correct.
- **Animated edges.** CSS-driven stroke animation, unaffected.
- **Reconnection.** Shares the connection-drag hit-test logic; works with floating targets.

### Accessibility

- **Keyboard focus order.** Floating handles have a `[position]` and live in the DOM; tab order unchanged.
- **Keyboard-initiated connections.** Not in this spec's scope.

### Non-rectangular visuals

- **Circular / polygon node visuals.** Floating endpoints land on the bounding rectangle's border, which may appear outside the visible circular shape near corners. Documented limitation; custom-shape support is a non-goal.

### Performance

- **Large graphs (1000+ floating edges).** Ray-rect intersection is O(1) per endpoint. Stage 2 hit-test is O(nodes under pointer), which is 1–2 in practice. No new hotspot.

### Reactivity

- **`[floating]="someSignal()"` toggles mid-drag.** Registry re-registration on signal change; next pointer move picks up new flag. Consistent behavior.

## Testing strategy

### `@angflow/system` unit tests (pure math)

- **`getFloatingEndpoint`** (new `packages/system/src/utils/edges/floating.ts` + `floating.spec.ts`):
  - East reference point → east mid-border endpoint.
  - SE diagonal reference → SE corner endpoint.
  - Close-to-top reference → top-border endpoint (`tX > tY` branch).
  - Reference at node center (degenerate) → endpoint = center.
  - Reference inside the node rect → endpoint on border between center and reference.
  - Tall-rectangle node → endpoint reflects halfW/halfH asymmetry.

- **`inferSide`** (same module):
  - Intersection on right border → `Position.Right`.
  - Intersection on bottom border → `Position.Bottom`.
  - Intersection exactly on a corner (|dx| === |dy|) → Y-axis wins because the comparison uses strict `>` (returns `Position.Top` or `Position.Bottom`, not `Position.Left` or `Position.Right`).

- **`getFloatingDropTarget`** (new helper in `xyhandle/utils.ts`; test via `xyhandle/utils.spec.ts`, creating the file if absent):
  - Pointer inside a node with no floating handles → null.
  - Pointer inside a node with one compatible floating handle → that handle.
  - Two floating handles at `Position.Left` / `Position.Right`, pointer on right side → returns the right one.
  - Two floating handles at the same position → first by handle-registry iteration order (insertion order = first-registered wins).
  - Pointer outside all nodes → null.
  - Overlapping nodes → highest `zIndex`.
  - Type mismatch (drag from source, only source floating handles available) → null.
  - `isValidConnection` rejection → null (no cascade).
  - Self-connection (`fromHandle.nodeId === candidate.nodeId`) → skipped.

- **`getClosestHandle` regression test.** Verify Stage 1 happy path remains unchanged after refactor.

### `@angflow/angular` unit tests

Extend `packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts`:

- Both endpoints non-floating → endpoints match current behavior.
- Source fixed, target floating → source uses DOM position, target uses `getFloatingEndpoint` with reference = source DOM position.
- Both floating → each endpoint uses `getFloatingEndpoint` with reference = other node's center.
- Self-loop with floating flags → falls back to fixed-handle positions.
- Unmeasured source node → 150×40 fallback applies; no throw.
- Handle registry returns null → legacy center-bottom fallback.

### `HandleComponent` tests

Minimal or skipped. The new `floating` signal input is trivially wired; adding a dedicated test that verifies `input(false)` defaults is noise.

### Integration / manual smoke

The rebuilt example is the integration test surface. Validation checklist as in the Example Refresh section.

### Performance smoke

Not a formal benchmark. 200-node graph, half with floating handles, 3-second drag across canvas. Acceptance: FPS ≥ 55 in Chrome DevTools Performance, with regression from non-floating baseline ≤ ~5%.

### Explicitly not tested

- Visual correctness under heavy node overlap.
- CSS highlight class rendering (manual QA in the example).
- Cross-package type compatibility runtime (static-typing concern, not runtime).

## Open questions

None at design approval. Implementation-phase questions (exact file layout for the new system helper, whether to create `xyhandle/utils.spec.ts` or extend a sibling) will be resolved in the implementation plan.
