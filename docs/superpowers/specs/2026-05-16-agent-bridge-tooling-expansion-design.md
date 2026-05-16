# Agent Bridge Tooling Expansion — Design

**Date:** 2026-05-16
**Status:** Approved design; ready for implementation planning
**Scope:** Grow the `AngflowAgentBridge` tool surface from 16 tools to 42, add a transactional `apply_changes` tool, and add a bridge-only snapshot-based undo/redo system. No breaking changes; additive only.

## Context

`AngflowAgentBridge` (in `packages/angular/src/lib/agent/`) currently exposes 16 JSON-RPC tools so external callers (LLMs over MCP, Playwright, devtools console) can drive a registered `NgFlowService`. See `packages/angular/AGENT_BRIDGE.md` for the wiring, transport contract, and current tool catalog.

The bridge was shipped as a thin first slice. Several useful `NgFlowService` capabilities are not exposed (programmatic selection, zoom in/out/center, fitBounds, screen↔flow coordinate conversion, spatial queries, graph queries, internal-node geometry, handle data, batch add). The `AGENT_BRIDGE.md` "Known gaps" section enumerates these plus more ambitious capabilities the package does not yet implement (undo/redo, copy/paste, runtime type registration, pane/read-only toggles).

This spec covers the next expansion. Out-of-scope items are deliberately deferred; see Non-goals.

## Problem

An agent driving the canvas today is limited in three concrete ways:

1. **Cannot inspect geometry or topology.** No way to ask "what nodes intersect X?", "what are the incomers of Y?", "what's the bounding box of these nodes?", "where on screen is this flow position?". The agent has to read all nodes/edges and recompute these locally — expensive and error-prone.
2. **Cannot guide attention.** No programmatic selection, no zoom-in / zoom-out / center-on-node, no fit-to-rect. Tutoring and "look here" UX is impossible.
3. **Cannot speculate safely.** Each mutation is irreversible: a wrong `delete_elements` leaves the agent to reconstruct prior state from its own transcript memory. Building a 5-node graph also costs 9 round trips, each emitting a separate `flow.state` event.

## Goals

- Expose 24 new tools that thinly wrap existing `NgFlowService` capabilities: read/discovery, spatial queries, graph queries, mutations (including bulk add and `update_*_data`), selection, viewport (zoom in/out/center, fit-bounds), coordinate conversion, handle data, internal-node geometry.
- Add `apply_changes` — a transactional batch tool with snapshot-rollback on error and a single coalesced `flow.state` emission.
- Add bridge-only snapshot-based undo/redo: `undo`, `redo`, `history_status`, `clear_history` with a configurable depth (default 100).
- Add `flow.history` push event so agent UIs can grey out undo/redo affordances.
- Keep all additions purely additive: no breaking change to the existing 16 tools, no breaking change to `NgFlowService`, no breaking change to transports.
- Update `AGENT_BRIDGE.md` in the same commit per CLAUDE.md repository rule.

## Non-goals

- **Service-level undo/redo.** History lives in the bridge and only tracks mutations that came in through bridge tool calls. User-driven changes (drag, connect via UI, keyboard delete) are NOT captured. App code that calls `service.setNodes(...)` directly bypasses history. Documented as a known limitation. A future `FlowHistoryService` could subsume this; out of scope here.
- **Copy/paste of subgraphs.** An LLM can synthesize this from `get_nodes` + `get_edges` + `apply_changes` once those tools exist.
- **Auto-layout.** Real value, but a layout engine is an architectural decision (dagre? elk? custom?) that warrants its own design. Layouting example in `examples/angular/` already pulls dagre; we do not want the bridge to take that dependency.
- **Runtime node/edge type registration.** Closed type sets are the norm; agents work with the types the app registers at compile time.
- **Read-only / pane-interactivity toggles.** App-level configuration handles this better than a per-call tool.
- **History coverage for non-bridge mutations.** Explicitly out — the agent reverts to the prior agent-known state, not the prior user-known state.
- **Changes to `@angflow/system`.** Zero diffs in `packages/system/`.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Scope ceiling | Expose-only + `apply_changes` + undo/redo | Picked over "expose-only" (too thin to be safe for speculative agents) and "expose + auto-layout + copy/paste + runtime types" (each warrants its own design). User-confirmed during brainstorming. |
| Where history lives | In the bridge (`AgentHistory` class), per `flowId` | Avoids new public `NgFlowService` surface and avoids edge cases around user-driven changes. Limitation is acceptable for the agent-driven use case. |
| History representation | Snapshots of `{ nodes, edges }` (see "Snapshot contents" below) | Simpler than operation-log inverses. Memory cost bounded by `maxDepth`. Structural sharing keeps cost manageable for typical flows. |
| What captures history | All bridge-side mutating tools EXCEPT selection ops, viewport ops, and rolled-back `apply_changes`. An `apply_changes` call captures iff at least one op is non-selection. | Selection pollutes the stack with no canvas effect; viewport changes do not modify graph content; rolled-back transactions did not change state; a pure-selection batch should behave like its individual selection ops. |
| Snapshot contents | `{ nodes, edges }` only — viewport excluded | Viewport changes do not capture history. Restoring viewport on undo would clobber post-mutation zoom/pan that the user expects to keep. |
| `apply_changes` op vocabulary | Mirrors individual tool names exactly | LLM does not learn a second grammar. |
| `apply_changes` atomicity | Snapshot-before, rollback-on-throw, single coalesced state event | Cleanest mental model for the LLM: success means everything applied; failure means nothing applied. |
| Selection tool implementation | New `NgFlowService.setSelection({ nodeIds?, edgeIds?, additive? })` wrapping `store.addSelectedNodes` / `addSelectedEdges` / `unselectNodesAndEdges` | Going through the proper change pipeline emits selection-change events correctly. Explicit `additive` decouples agent behavior from the global `multiSelectionActive()` mode. |
| Default `maxDepth` | 100 | Big enough for long agent sessions; small enough that worst-case memory stays under ~6 MB even for 200-node flows. |
| History opt-out | `provideAgentBridge({ history: false })` | Apps that already have their own history system can disable. |
| Versioning | `@angflow/angular` minor bump | Purely additive but the agent-bridge surface is now substantial enough that "minor" signals stability of the new surface. |

## Public API surface changes

### New tools (read / discovery / geometry)

All tools accept the optional `flowId` parameter the existing tools already accept.

| Tool | Params | Returns | Wraps |
|---|---|---|---|
| `get_internal_node` | `id: string` | `{ id, positionAbsolute: { x, y }, measured: { width, height }, handleBounds } \| null` | `NgFlowService.getInternalNode` (serializable subset) |
| `get_nodes_bounds` | `nodeIds?: string[]` (default: all nodes) | `Rect` | `NgFlowService.getNodesBounds` |
| `get_intersecting_nodes` | `id: string`, `partially?: boolean` (default `true`) | `Node[]` | `NgFlowService.getIntersectingNodes` |
| `is_node_in_area` | `id: string`, `area: Rect`, `partially?: boolean` | `boolean` | `NgFlowService.isNodeIntersecting` |
| `get_outgoers` | `id: string` | `Node[]` | `getOutgoers` from `@angflow/system` (via service) |
| `get_incomers` | `id: string` | `Node[]` | `getIncomers` from `@angflow/system` (via service) |
| `get_connected_edges` | `nodeIds: string[]` | `Edge[]` | `NgFlowService.getConnectedEdges` |
| `get_node_connections` | `nodeId: string` | `HandleConnection[]` | `NgFlowService.getNodeConnections` |
| `get_handle_connections` | `nodeId: string`, `type: 'source' \| 'target'`, `handleId?: string` | `HandleConnection[]` | `NgFlowService.getHandleConnections` |
| `get_handle_data` | `nodeId: string`, `handleId: string \| null`, `type: 'source' \| 'target'` | `unknown` | `NgFlowService.getHandleData` |
| `screen_to_flow_position` | `position: { x, y }`, `snapToGrid?: boolean` | `{ x, y }` | `NgFlowService.screenToFlowPosition` |
| `flow_to_screen_position` | `position: { x, y }` | `{ x, y }` | `NgFlowService.flowToScreenPosition` |

### New tools (mutation)

| Tool | Params | Returns | Wraps |
|---|---|---|---|
| `add_nodes` | `nodes: Node[]` | `Node[]` (the created nodes) | `NgFlowService.addNodes` |
| `add_edges` | `edges: Edge[]` | `Edge[]` | `NgFlowService.addEdges` |
| `update_node_data` | `id: string`, `dataPatch: object` | `Node \| null` | `NgFlowService.updateNodeData` |
| `update_edge_data` | `id: string`, `dataPatch: object` | `Edge \| null` | `NgFlowService.updateEdgeData` |

### New tools (selection)

| Tool | Params | Returns | Wraps |
|---|---|---|---|
| `select_nodes` | `nodeIds: string[]`, `additive?: boolean` (default `false`) | `{ selectedNodeIds: string[] }` | new `NgFlowService.setSelection` |
| `select_edges` | `edgeIds: string[]`, `additive?: boolean` | `{ selectedEdgeIds: string[] }` | same |
| `deselect_all` | — | `void` | `store.unselectNodesAndEdges()` via service |

### New tools (viewport)

| Tool | Params | Returns | Wraps |
|---|---|---|---|
| `zoom_in` | `duration?: number` | `Viewport` | `NgFlowService.zoomIn` |
| `zoom_out` | `duration?: number` | `Viewport` | `NgFlowService.zoomOut` |
| `zoom_to` | `level: number`, `duration?: number` | `Viewport` | `NgFlowService.zoomTo` |
| `set_center` | `x: number`, `y: number`, `zoom?: number`, `duration?: number` | `Viewport` | `NgFlowService.setCenter` |
| `fit_bounds` | `bounds: Rect`, `padding?: number`, `duration?: number` | `boolean` | `NgFlowService.fitBounds` |

### New tool — transactional batch

```ts
apply_changes({
  flowId?: string,
  ops: Op[],
}) → { results: OpResult[] }

type Op =
  | { op: 'add_node', node: Node }
  | { op: 'add_nodes', nodes: Node[] }
  | { op: 'add_edge', edge: Edge }
  | { op: 'add_edges', edges: Edge[] }
  | { op: 'update_node', id: string, patch: Partial<Node> }
  | { op: 'update_node_data', id: string, dataPatch: object }
  | { op: 'update_edge', id: string, patch: Partial<Edge> }
  | { op: 'update_edge_data', id: string, dataPatch: object }
  | { op: 'delete_elements', nodeIds?: string[], edgeIds?: string[] }
  | { op: 'select_nodes', nodeIds: string[], additive?: boolean }
  | { op: 'select_edges', edgeIds: string[], additive?: boolean }
  | { op: 'deselect_all' };

type OpResult = { ok: true, value: Node | Edge | { deletedNodeIds: string[]; deletedEdgeIds: string[] } | null };
```

Semantics:

1. Capture `{ nodes, edges }` snapshot.
2. Wrap execution in `service.batch(() => { for op in ops … })`.
3. If any op throws (e.g., `update_node` on a missing id), restore the snapshot via `setNodes` / `setEdges` (still inside `batch`), and return a JSON-RPC error with `data: { failedIndex, message }`. Viewport is not part of the snapshot and is unaffected by rollback.
4. The bridge's microtask coalescing ensures exactly one `flow.state` event per `apply_changes` call — one for success, one for rollback.

`set_nodes` and `set_edges` (full replacement) are **not** valid ops inside `apply_changes`. They remain available as top-level tools.

A successful `apply_changes` creates **one** undo entry, reusing the snapshot from step 1 — but only if at least one op was non-selection. A pure-selection batch behaves like the equivalent sequence of individual selection ops and creates no undo entry. A rolled-back `apply_changes` creates **no** undo entry.

### New tools — undo / redo

| Tool | Params | Returns | Behavior |
|---|---|---|---|
| `undo` | `steps?: number` (default 1) | `{ undone: number, canUndo: boolean, canRedo: boolean }` | Pop up to `steps` snapshots from `past`, push current state to `future`, restore latest popped snapshot. No-op if `past` is empty (`undone: 0`). |
| `redo` | `steps?: number` | `{ redone: number, canUndo: boolean, canRedo: boolean }` | Inverse of undo. |
| `history_status` | — | `{ canUndo: boolean, canRedo: boolean, pastDepth: number, futureDepth: number }` | Cheap query. |
| `clear_history` | — | `void` | Drops both stacks. |

History capture rule: snapshot captured **before** any of these tools fires, into `past`, and `future` is cleared.

```
add_node, add_nodes, add_edge, add_edges,
update_node, update_node_data, update_edge, update_edge_data,
delete_elements, set_nodes, set_edges,
apply_changes (on success, iff any op is non-selection)
```

Read-only tools, viewport tools, selection tools, coordinate-conversion tools, and rolled-back `apply_changes` calls do NOT capture history.

History restore mechanism: wrap `setNodes` / `setEdges` in `service.batch()` for a single reactivity cycle and one coalesced `flow.state` event. Viewport is not restored.

### New push event

`flow.history` — `{ flowId, canUndo, canRedo, pastDepth, futureDepth }`. Emitted whenever either stack changes (capture, undo, redo, clear).

### `provideAgentBridge` config

```ts
provideAgentBridge({
  transports: [...],
  history?: { maxDepth?: number } | false,   // default { maxDepth: 100 }
})
```

`history: false` disables history entirely; `undo` / `redo` / `history_status` then return `{ canUndo: false, canRedo: false, ... }`.

### New `NgFlowService` method

```ts
setSelection(params: {
  nodeIds?: string[];
  edgeIds?: string[];
  additive?: boolean;   // default false
}): void
```

When `additive` is `false`, replaces the current selection with the given ids. When `true`, adds to the current selection. Implemented in terms of the existing store primitives (`getSelectionChanges`, `triggerNodeChanges`, `triggerEdgeChanges`) without touching the global `multiSelectionActive()` state. Public method on `NgFlowService` so app code can use it too — not bridge-only.

### Touched files

- `packages/angular/src/lib/agent/agent-bridge.service.ts` — add 26 handlers in `installHandlers()`; add `AgentHistory` field, plumb it through `dispatch`, emit `flow.history` on changes.
- `packages/angular/src/lib/agent/tool-schemas.ts` — append 26 schema entries.
- `packages/angular/src/lib/agent/history.ts` — **new** file, `AgentHistory` class with `capture(flowId, snapshot)`, `undo(flowId, steps)`, `redo(flowId, steps)`, `status(flowId)`, `clear(flowId)`, configurable `maxDepth`.
- `packages/angular/src/lib/agent/provide-agent-bridge.ts` — accept optional `history` config, pass through to bridge.
- `packages/angular/src/lib/agent/types.ts` — extend `AgentEvent` documentation; no shape change.
- `packages/angular/src/lib/agent/index.ts` — export `AgentHistoryOptions` type if it becomes public.
- `packages/angular/src/lib/services/ng-flow.service.ts` — add `setSelection` method.
- `packages/angular/src/lib/agent/agent-bridge.spec.ts` — new `describe` blocks for selection, `apply_changes`, history, and the read-tool fixtures.
- `packages/angular/AGENT_BRIDGE.md` — full doc update per CLAUDE.md rule.
- `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts` — extend the panel with `undo` / `apply_changes` snippet examples and a `history_status` live readout fed by `flow.history`.

## Architecture / approach

### Tool dispatch

The existing `installHandlers()` registers a `Map<string, ToolHandler>` where each handler receives `(flow: NgFlowService, params)`. New tools follow the same pattern — small handler functions calling the underlying service method, with param validation via the existing helpers (`requireString`, `requireObject`, `requireArray`, `optionalStringArray`). Add `optionalNumber`, `optionalBoolean`, `requireRect` helpers as needed.

History capture happens at the dispatch boundary, not inside the handlers. The dispatch loop checks `MUTATING_TOOLS.has(req.method)` before invoking the handler and calls `history.capture(flowId, snapshotOf(flow))` if true. This keeps handlers ignorant of history.

For `apply_changes`, the dispatch path is unchanged (the tool is "mutating"), and the handler itself owns the snapshot used both for rollback and for the undo entry. Capture happens at dispatch boundary; the handler refuses to capture again. Implemented by exposing a `capturedSnapshot?: Snapshot` field on a per-call context, or simply by passing the snapshot the dispatcher captured to the handler.

### `apply_changes` execution

Inside `service.batch(() => { ... })`:

```ts
for (let i = 0; i < ops.length; i++) {
  const op = ops[i];
  try {
    results.push(executeOp(flow, op));
  } catch (e) {
    // restore snapshot
    flow.setNodes(snapshot.nodes);
    flow.setEdges(snapshot.edges);
    throw new ApplyChangesError(i, e.message);
  }
}
```

`executeOp` is a small dispatch table over `op.op` that calls the same underlying service methods the individual tools use. Selection ops inside a transaction work through `setSelection` like outside.

### History data structures

```ts
type Snapshot = { nodes: readonly Node[]; edges: readonly Edge[] };

class AgentHistory {
  private past = new Map<string, Snapshot[]>();
  private future = new Map<string, Snapshot[]>();
  constructor(private readonly maxDepth: number) {}

  capture(flowId: string, snapshot: Snapshot): void { ... }
  undo(flowId: string, steps: number, currentSnapshot: Snapshot): Snapshot | null { ... }
  redo(flowId: string, steps: number, currentSnapshot: Snapshot): Snapshot | null { ... }
  status(flowId: string): { canUndo: boolean; canRedo: boolean; pastDepth: number; futureDepth: number };
  clear(flowId: string): void;
  dropFlow(flowId: string): void;  // called from bridge.unregister
}
```

`capture` pushes onto `past` and clears `future`. When `past.length > maxDepth`, shifts the oldest entry off. `undo` pops from `past`, pushes the *current* snapshot onto `future` (so a redo re-applies), and returns the popped snapshot for the bridge to restore.

Snapshots reuse node/edge object identities — only the wrapping arrays are new — so the memory cost per snapshot is just two array clones.

### Restore mechanism

The bridge owns the restore. It does NOT call `setNodes` / `setEdges` outside `service.batch` because that would emit two reactivity cycles. The flow:

```ts
service.batch(() => {
  service.setNodes(target.nodes);
  service.setEdges(target.edges);
});
```

The existing watcher (`watchFlow`) sees one signal change and emits one coalesced `flow.state`. The bridge also emits `flow.history` once for the same event.

### `flow.history` emission

Emitted from `AgentHistory` via a callback the bridge installs. Bridge consolidates into the same microtask used by `flow.state` so consumers see history + state updates land together.

### Backward compatibility

- Existing 16 tools unchanged in name, params, and return shapes.
- Existing `WindowTransport` / `WebSocketTransport` unchanged.
- `provideAgentBridge` adds an optional `history` field; absence means default-on at `maxDepth: 100`. Calling code with no history field continues to work.
- New `NgFlowService.setSelection` is additive; existing selection mechanisms (drag-rect, click) untouched.

## Testing

Test plan in `packages/angular/src/lib/agent/agent-bridge.spec.ts`, mirroring the existing Vitest + `provideZonelessChangeDetection()` + `CapturingTransport` patterns. New describe blocks:

**`describe('selection tools')`**
- `select_nodes` with `additive: false` replaces selection
- `select_nodes` with `additive: true` adds to selection
- `select_edges` analogous
- `deselect_all` clears both
- Selection changes are visible through `flow.selectedNodes()` / `selectedEdges()` signals (proves the change pipeline emits properly)

**`describe('viewport tools')`**
- `zoom_in` / `zoom_out` / `zoom_to` against a minimal fixture (panZoom must be initialized — use the same dom-mocking approach the existing viewport tests use, if any; otherwise mark as smoke-tests at the dispatch layer)
- `set_center`, `fit_bounds` — coordinate-conversion smoke checks

**`describe('read / geometry tools')`**
- Fixture: small graph (3 nodes in a chain, one branching edge), measured dimensions stubbed via `updateNodeInternals` or directly by setting `measured` on the node
- `get_internal_node` returns positionAbsolute, measured, handleBounds — and is serializable (no circular refs, no DOM elements)
- `get_nodes_bounds` for all and for a subset
- `get_outgoers` / `get_incomers` / `get_connected_edges` match expected ids
- `get_intersecting_nodes` and `is_node_in_area` for two overlapping nodes
- `screen_to_flow_position` / `flow_to_screen_position` round-trip

**`describe('apply_changes')`**
- Happy path: 5 ops (add 2 nodes, add 1 edge, update 1 node, select 1 node) → one `flow.state` event, results array length 5, all `ok: true`
- Rollback: ops that include `update_node` against a missing id → JSON-RPC error with `data.failedIndex`, zero net mutations (nodes/edges identical to pre-call state)
- Single coalesced `flow.state` event for both success and rollback paths
- `apply_changes` creates exactly one entry in the history stack (success) / zero entries (rollback)

**`describe('history')`**
- `undo` restores prior state, `redo` re-applies it
- Stack depth caps at configured `maxDepth` (configure a small value, e.g., 3, for the test)
- `clear_history` empties both stacks; `history_status` reflects it
- `flow.history` event fires on capture, undo, redo, clear
- Selection ops do NOT add to history (capture an entry, run `select_nodes`, undo restores pre-select-no, the state is unchanged from before the previous mutation)
- Viewport ops do NOT add to history
- Rolled-back `apply_changes` does NOT add to history
- `provideAgentBridge({ history: false })` disables capture; `undo` is a no-op

**`describe('WindowTransport with history')`**
- Smoke test that `window.angflow.callTool('undo')` works from the namespace

### Manual / example verification

After implementation, the agent-bridge example panel should run two new snippets cleanly from the devtools console:

```js
await angflow.callTool('apply_changes', {
  ops: [
    { op: 'add_node', node: { id: 'x', position: { x: 0, y: 0 }, data: { label: 'X' } } },
    { op: 'add_node', node: { id: 'y', position: { x: 200, y: 0 }, data: { label: 'Y' } } },
    { op: 'add_edge', edge: { id: 'x-y', source: 'x', target: 'y' } },
  ],
});

await angflow.callTool('undo');
```

The single `apply_changes` call must produce exactly one log line (one `flow.state` event). The subsequent `undo` must produce exactly one log line and remove both nodes and the edge.

## Doc updates

`packages/angular/AGENT_BRIDGE.md` per CLAUDE.md rule:

- Catalog table grows the four sections (read, mutate-incremental, viewport) and gains a new "Selection" subsection.
- New "Transactional batch" section with `apply_changes` shape, op vocabulary, atomicity guarantees, and example.
- New "History" section covering `undo`/`redo`/`history_status`/`clear_history`, the capture rule (with the explicit exclusion list), the bridge-only scope caveat, the `provideAgentBridge({ history })` config, and the `flow.history` push event.
- "Events" section gains `flow.history`.
- "Known gaps" section trimmed: remove items now covered (selection, zoom in/out/center, batch add, internal-node geometry, spatial queries, graph queries, coordinate conversion). What stays: undo/redo for user-driven changes, copy/paste, auto-layout, runtime node/edge type registration, pane/read-only toggles.

## Rollout / versioning

- Additive change. No breaking API.
- `@angflow/angular` patch or minor bump per the current release-track convention. The floating-edges spec notes `0.1.0` is in pre-release, so this work likely lands on or after `0.1.0`. Defer the exact version choice to implementation; bump rule is "minor if shipping standalone, patch if folded into another already-bumped release."
- No `@angflow/system` change.
- Publish order unchanged (system first if changed; angular second).

## Known limitations (called out for the doc)

- History does not capture changes that did not originate from a bridge tool call. A user dragging a node, the app calling `service.setNodes(...)` directly, or a controlled-mode parent applying `(nodesChange)` outputs — none of these create history entries. An `undo` after such changes reverts to the prior agent-known state, which may overwrite user-driven changes. Apps that need full Ctrl+Z affordance for their users should build a separate history layer.
- `flow.state` and `flow.history` are emitted on separate frames within the same microtask flush. Consumers wanting strict ordering should buffer until a microtask drain.
- `get_internal_node` returns serializable fields only — no DOM element refs, no signal references. Agents needing to query the DOM should use Playwright or the WindowTransport with a separate selector strategy.
