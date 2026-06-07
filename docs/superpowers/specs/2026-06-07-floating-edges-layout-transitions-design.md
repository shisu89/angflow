# Floating Edges, Standalone Layout API, and Animated Transitions — Design

**Date:** 2026-06-07
**Status:** Approved
**Source:** `brainstorm_agentic_app/docs/angflow-feedback.md` findings #1–#3 (test-flight feedback)
**Scope:** `@angflow/angular` only — no `@angflow/system` changes, no agent tool schema changes.
**Amendment (during implementation):** one authorized `@angflow/system` bugfix landed — `inferSide` now normalizes deltas by half-extents (raw deltas misclassified border sides on non-square nodes), surfaced by this spec's floating-mode tests. Behavior note: per-handle floating edges on non-square nodes get corrected `sourcePosition`/`targetPosition` (path curvature direction); endpoints unchanged.

## Background

The brainstorm_agentic_app test flight surfaced three gaps:

1. Floating (cardinal-point) edges required an 8-invisible-handles-per-node workaround,
   even though `@angflow/system` already ships the ray-rect intersection math
   (`getFloatingEndpoint`/`inferSide` in `packages/system/src/utils/edges/floating.ts`)
   and the edge renderer already honors a per-handle `floating` flag
   (`edge-renderer.component.ts:387-429`). The infra exists; the zero-boilerplate
   entry point and discoverability do not.
2. `dagreLayout` in `@angflow/angular/layout` is already a pure function with the exact
   shape the app needed, but its JSDoc frames it as agent-bridge-only and its input type
   demands `{id, width, height}` instead of accepting real `Node` objects — so the app
   reimplemented it with a direct dagre dependency.
3. No animation support: agent-grown nodes pop in instantly and relayouts teleport nodes.

## Part 1 — `edgeMode="floating"`

### API

```html
<ng-flow [nodes]="nodes" [edges]="edges" edgeMode="floating" />
```

- New input on `NgFlowComponent`: `edgeMode: 'handles' | 'floating'`, default `'handles'`.
- Mirrored into `FlowStore` as a signal; edge renderer reads it.

### Behavior

When `edgeMode === 'floating'`, the edge renderer skips handle lookup entirely for every
edge:

- Node rect = `node.internals.positionAbsolute` + `getNodeDimensions(node)` (existing
  fallback chain `measured` → `width/height` → `initialWidth/initialHeight` covers
  unmeasured first-frame nodes).
- Endpoint = `getFloatingEndpoint(nodeRect, referencePoint)` with the opposite node's
  center as the reference point — the same math the per-handle `floating` flag uses today.
- `inferSide(intersection, nodeRect)` supplies `sourcePosition`/`targetPosition` to the
  path generators, so bezier curvature and marker orientation stay correct.
- Self-loops keep current behavior (floating disabled, as today at
  `edge-renderer.component.ts:386`).

### Interactions with existing features

- Per-handle `floating?: boolean` continues to work unchanged in `'handles'` mode.
- In `'floating'` mode, declared handles are ignored for edge *rendering* but still work
  to *start* interactive drag-connections. Documented limitation: a node with zero
  handles cannot originate a drag-connection — `edgeMode="floating"` targets
  programmatic/agent-driven graphs.

### Out of scope

- Auto-injecting hidden handles (rejected: extra DOM/complexity).
- A `FloatingEdgeComponent` edge type (the global mode covers the feedback; per-edge
  opt-in can be added later if mixing demand appears).

## Part 2 — Standalone layout API

### `layoutNodes` (pure, in `@angflow/angular/layout`)

```ts
import { layoutNodes } from '@angflow/angular/layout';

layoutNodes(nodes, edges, opts?): Record<string, { x: number; y: number }>
// opts: { direction?: 'TB' | 'LR' | 'BT' | 'RL'; nodeSep?: number; rankSep?: number }
```

- Accepts real `Node[]` (dimensions via the `getNodeDimensions` fallback chain — callers
  no longer pre-extract `{width, height}`) and `Edge[]` (only `source`/`target` read).
- Returns top-left-corner positions (dagre center → top-left conversion stays internal).
- Becomes the core implementation. Existing `dagreLayout` (`AgentLayoutFn` shape) becomes
  a thin back-compat wrapper over it — no behavior change for current bridge users.
- `@dagrejs/dagre` stays quarantined in the `./layout` subpath (optional peer dep intact).
- `dagreLayout` JSDoc rewritten: standalone usage is the headline, agent-bridge wiring
  the footnote.

### `NgFlowService` additions (main entry, dagre-free)

```ts
flow.setNodePositions(positions: Record<string, { x: number; y: number }>,
                      opts?: { animate?: boolean }): void

flow.applyLayout(layoutFn, opts?): void
// e.g. flow.applyLayout(layoutNodes, { direction: 'LR' })
```

- `setNodePositions` is the primitive: writes a position map to the store. Animation
  defaults to the flow's `[animate]` input; `opts.animate` (true or false) overrides it
  per call — see Part 3.
- `applyLayout` is the convenience: reads nodes/edges from the store, calls `layoutFn`,
  applies the result via `setNodePositions`. The layout function is *passed in* rather
  than imported by the service — this keeps the main entry free of dagre and lets
  elk/custom layouts plug in with the same one-liner.

## Part 3 — `[animate]` input

### API

```html
<ng-flow [nodes]="nodes" [edges]="edges" [animate]="true" />
<!-- or -->
<ng-flow [animate]="{ duration: 200 }" />
```

- `animate: boolean | { duration?: number }`, default off. Duration default 300ms.
- Fixed ease-in-out cubic easing (YAGNI on configurable easing).
- `prefers-reduced-motion: reduce` disables both behaviors regardless of the input.

### Entry animation (CSS-driven)

- Node-renderer tracks the previous render's node-id set; nodes with new ids get an
  entry class (e.g. `.xy-flow__node-enter`) driving a fade + slight-scale keyframe.
- Class removed on `animationend`.
- The initial mount batch is **not** animated (no full-graph flash on load).

### Position transitions (rAF store tween)

CSS-only transform transitions were rejected: edges are SVG paths computed from store
positions, so the store would jump while node DOM glides — edges visibly detach for the
whole transition. Instead:

- A small tween module: when positions are written via `setNodePositions`/`applyLayout`
  with animation on, a single shared `requestAnimationFrame` loop interpolates every
  moving node's store position from current → target each frame. Nodes and edges
  re-render together and stay attached mid-flight.
- Retargeting (a new tween for a node already tweening) cancels and replaces its tween,
  starting from the current interpolated position.
- A user drag on a tweening node cancels that node's tween.
- The agent bridge's `layout_nodes` handler routes through the same path, so
  agent-driven relayouts animate for free when `[animate]` is on. No tool schema change.

### Zoneless compliance

rAF callbacks and `animationend` listeners drive updates exclusively through signal
writes (contributor rules 2/3). No `NgZone` anywhere.

## Part 4 — Cross-cutting

### Testing

- Edge-renderer specs: `edgeMode="floating"` endpoint/side computation, unmeasured
  nodes (initial-dims fallback), self-loops unaffected, handles still honored in
  `'handles'` mode.
- Pure-fn specs for `layoutNodes` (measured-dims fallback, direction options,
  center→top-left conversion) and `dagreLayout` back-compat.
- Tween specs with mocked rAF: interpolation, retargeting, drag-cancel, reduced-motion.
- Entry-class lifecycle spec: applied on add, removed on `animationend`, skipped on
  initial mount.
- Zonal example suite (`examples/angular/`) stays green.

### Docs & examples

- README sections for all three features.
- `examples/angular` demo: floating edges + a tidy-layout button + animate toggle.
- `AGENT_BRIDGE.md`: note that `layout_nodes` honors `[animate]` (behavior note only —
  params/return unchanged, so no `@angflow/mcp` snapshot regeneration).

### Release

- Single **minor** bump of `@angflow/angular` (0.0.17 → 0.1.0). `@angflow/system`
  unchanged. `@angflow/mcp` unchanged.

### Closing the feedback loop

After shipping: mark findings #1–#3 ✅ in
`brainstorm_agentic_app/docs/angflow-feedback.md` with commit links, and note the app
can delete both workarounds (`idea-node.component.ts` 8-handle block + CSS,
`canvas/tidy-layout.ts`) and adopt `edgeMode="floating"`,
`applyLayout(layoutNodes, …)`, and `[animate]`.
