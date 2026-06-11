# Agent Bridge

`AngflowAgentBridge` exposes a flow to AI agents (or any external caller) over a small JSON-RPC protocol. Source lives in `packages/angular/src/lib/agent/`.

## Architecture

```
┌──────────────┐   tool call   ┌────────────────┐   handler   ┌──────────────┐
│ External     │ ────────────▶ │   Transport    │ ──────────▶ │ AngflowAgent │
│ caller       │               │ (Window / WS / │             │ Bridge       │
│ (LLM, REPL,  │ ◀──────────── │  custom)       │ ◀────────── │              │
│  Playwright) │   event/result└────────────────┘    invoke   └──────┬───────┘
└──────────────┘                                                     │
                                                                     ▼ (via flowId)
                                                              ┌──────────────┐
                                                              │ NgFlowService│
                                                              │   instance   │
                                                              └──────────────┘
```

- **Bridge** — root-scoped service. Holds a registry of `flowId → NgFlowService`, routes inbound tool calls to the right service, and emits `flow.state` events when any registered flow's signals change (coalesced via microtask). Each flow also carries a per-flow node-template registry (see `register_node_template`) and supports an optional host-pluggable layout function (see `layout_nodes`).
- **Transport** — anything implementing `AgentTransport`. Bundled: `WindowTransport` (exposes `window.angflow`), `WebSocketTransport`. Add custom ones for postMessage, CDP, MCP servers, etc. The bridge calls `stop()` on every transport when its injector is destroyed (e.g. `ApplicationRef.destroy()`), so `stop()` must be idempotent and must cancel any reconnect timers. `WebSocketTransport` reconnects with exponential backoff on most close codes (including `1006` network drops and `1009` frame-too-big), but treats close codes `4401` (bad token) and `4403` (origin rejected) as terminal — it logs a `console.error` and does not retry, since retrying would never succeed without a configuration change.
- **Tool schemas** — `AGENT_TOOL_SCHEMAS` is a JSON-Schema array suitable for direct use as Anthropic/OpenAI `tools`.

## Wiring

```ts
// app.config.ts
import { provideAgentBridge, WindowTransport } from '@angflow/angular';
// dagreLayout requires the optional peer dep @dagrejs/dagre >= 3
import { dagreLayout } from '@angflow/angular/layout';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgentBridge({
      transports: [new WindowTransport()],
      history: { maxDepth: 100 },  // default; pass `false` to disable
      layout: dagreLayout,         // optional; enables the layout_nodes tool
      // Optional. Receives transport / dispatch errors the bridge would
      // otherwise swallow (start() rejection, send() throw).
      onError: (err, ctx) => console.warn('[agent-bridge]', ctx.kind, err),
    }),
  ],
};

// some.component.ts
import { AngflowAgentBridge, NgFlowService } from '@angflow/angular';

private readonly bridge = inject(AngflowAgentBridge);
private unregister?: () => void;

onInit(svc: NgFlowService) {
  this.unregister = this.bridge.register('main', svc);
}
ngOnDestroy() { this.unregister?.(); }
```

After this, the browser devtools console can do `await angflow.callTool('add_node', { node: {…} })`.

**In-process calls.** Inside Angular code, `bridge.callTool(method, params)` is equivalent to a JSON-RPC request through a transport: it captures a history snapshot, emits `flow.history` / `flow.state` events, and throws a structured error (with `code` and `data` attached) on failure. Use this whenever you want the bridge's full semantics — `undo`/`redo` only sees mutations that went through `callTool` or a transport.

**Re-registration.** `register(id, service)` is idempotent for the same service instance — calling it twice with the same `(id, service)` is a no-op (no extra `flow.registered` event, history preserved). Calling it with a different `NgFlowService` under the same id tears down the previous watcher, drops the previous history stack (since those snapshots refer to a different graph), and emits `flow.registered` again.

## Tool catalog

Every tool takes an optional `flowId` (omit when only one flow is registered; required otherwise). All payloads use the `Node` / `Edge` types from `@angflow/angular`.

**Payload validation.** `add_node`, `add_nodes`, `set_nodes`, and the corresponding `add_node` / `add_nodes` ops inside `apply_changes` require each node to have a non-empty string `id` and a `position: { x: number, y: number }`. The edge variants require non-empty string `id`, `source`, and `target`. Malformed payloads fail with `-32602` *before* reaching `NgFlowService`.

### Discovery / read

| Tool | Params | Returns |
|---|---|---|
| `list_flows` | — | `string[]` of registered flow ids |
| `get_state` | — | `{ nodes, edges, viewport }` |
| `get_nodes` | — | `Node[]` |
| `get_edges` | — | `Edge[]` |
| `get_node` | `id: string` | `Node \| null` |
| `get_edge` | `id: string` | `Edge \| null` |
| `get_viewport` | — | `{ x, y, zoom }` |

### Discovery — types & templates

| Tool | Params | Returns |
|---|---|---|
| `list_node_types` | — | `{ types: Array<{ name, source: 'builtin' \| 'host' \| 'template' }> }` |
| `list_edge_types` | — | `{ types: Array<{ name, source: 'builtin' \| 'host' }> }` |
| `register_node_template` | `name: string`, `spec: NodeTemplateSpec` | Overwrites an existing template of the same name; rejects builtin/host names with `-32602`. Returns `{ name }` |
| `unregister_node_template` | `name: string` | `{ removed: boolean }`; nodes of that type fall back to the default renderer |
| `list_node_templates` | — | `{ templates: Array<{ name, spec }> }` |

`source` tells the agent how to treat a type: `builtin` ships with the library; `host` is app-registered (component or content template — its `data` contract is app-specific); `template` is a data-driven template registered at runtime (see `register_node_template`).

### Read — geometry / graph queries

| Tool | Params | Returns |
|---|---|---|
| `get_internal_node` | `id: string` | `{ id, positionAbsolute, measured, handleBounds } \| null` — layout-resolved node with absolute position and measured dimensions |
| `get_nodes_bounds` | `nodeIds?: string[]` | `{ x, y, width, height }` — bounding rect of the given nodes (all nodes if omitted) |
| `get_intersecting_nodes` | `id: string`, `partially?: boolean` (default `true`) | `Node[]` — nodes that overlap the given node's bounding box |
| `is_node_in_area` | `id: string`, `area: { x, y, width, height }`, `partially?: boolean` (default `true`) | `boolean` — whether the node overlaps the given area |
| `get_outgoers` | `id: string` | `Node[]` — direct downstream neighbours of the node |
| `get_incomers` | `id: string` | `Node[]` — direct upstream neighbours of the node |
| `get_connected_edges` | `nodeIds: string[]` | `Edge[]` — all edges touching any of the given nodes |
| `get_node_connections` | `nodeId: string` | `Connection[]` — all connections (source+target pairs) for the node |
| `get_handle_connections` | `nodeId: string`, `type: 'source' \| 'target'`, `handleId?: string` | `Connection[]` — connections for a specific handle |
| `get_handle_data` | `nodeId: string`, `type: 'source' \| 'target'`, `handleId: string \| null` | `HandleElement \| null` — raw handle element data |

### Read — coordinates

| Tool | Params | Returns |
|---|---|---|
| `screen_to_flow_position` | `position: { x, y }`, `snapToGrid?: boolean` | `{ x, y }` — converts a screen pixel coordinate to a flow canvas coordinate |
| `flow_to_screen_position` | `position: { x, y }` | `{ x, y }` — converts a flow canvas coordinate to a screen pixel coordinate |

### Mutate — incremental (preferred)

| Tool | Params | Notes |
|---|---|---|
| `add_node` | `node: { id, position:{x,y}, data, type?, … }` | Returns the created `Node` |
| `add_nodes` | `nodes: Node[]` | Bulk version of `add_node`; returns `Node[]` |
| `add_edge` | `edge: { id, source, target, sourceHandle?, targetHandle?, type?, animated?, label?, data? }` | Use this to **link nodes**; returns the created `Edge` |
| `add_edges` | `edges: Edge[]` | Bulk version of `add_edge`; returns `Edge[]` |
| `update_node` | `id: string`, `patch: Partial<Node>` | Shallow merge. Move with `patch.position`; returns updated `Node` |
| `update_node_data` | `id: string`, `dataPatch: Record<string, unknown>` | Shallow-merges only the `data` property; returns updated `Node` |
| `update_edge` | `id: string`, `patch: Partial<Edge>` | Shallow merge; returns updated `Edge` |
| `update_edge_data` | `id: string`, `dataPatch: Record<string, unknown>` | Shallow-merges only the `data` property; returns updated `Edge` |
| `delete_elements` | `nodeIds?: string[]`, `edgeIds?: string[]` | Edges to deleted nodes auto-removed. Returns `{ deletedNodeIds, deletedEdgeIds }` |

### Mutate — bulk (prefer incremental ops above)

| Tool | Params |
|---|---|
| `set_nodes` | `nodes: Node[]` — full replacement |
| `set_edges` | `edges: Edge[]` — full replacement |

### Selection

| Tool | Params | Returns |
|---|---|---|
| `select_nodes` | `nodeIds: string[]`, `additive?: boolean` (default `false`) | `{ selectedNodeIds: string[] }` |
| `select_edges` | `edgeIds: string[]`, `additive?: boolean` (default `false`) | `{ selectedEdgeIds: string[] }` |
| `deselect_all` | — | `null` |

### Viewport / camera

| Tool | Params | Notes |
|---|---|---|
| `fit_view` | `nodeIds?`, `padding?`, `duration?` | Animates to fit the given nodes (all nodes if omitted) |
| `set_viewport` | `viewport: { x, y, zoom }`, `duration?` | Animate to an explicit viewport |
| `zoom_in` | `duration?: number` | Incremental zoom in |
| `zoom_out` | `duration?: number` | Incremental zoom out |
| `zoom_to` | `level: number`, `duration?: number` | Set zoom to an absolute level |
| `set_center` | `x: number`, `y: number`, `zoom?: number`, `duration?: number` | Center the viewport on a flow coordinate |
| `fit_bounds` | `bounds: { x, y, width, height }`, `padding?: number`, `duration?: number` | Fit the viewport to an explicit bounding rect |

### Transactional batch

| Tool | Params | Returns |
|---|---|---|
| `apply_changes` | `ops: Op[]` | `{ results: Array<{ ok: true; value: unknown }> }` |

See the **Transactional batch** section below for semantics and the full op-kind list.

### Layout

Requires a layout function to be passed to `provideAgentBridge({ layout: dagreLayout })`. When omitted, the tool fails with `-32601`.

| Tool | Params | Returns |
|---|---|---|
| `layout_nodes` | `direction?: 'TB' \| 'LR' \| 'BT' \| 'RL'` (default `'TB'`), `nodeIds?: string[]` (omit = all nodes), `nodeSep?: number`, `rankSep?: number`, `fitView?: boolean` (default `true`) | `{ positions: Record<nodeId, { x: number; y: number }> }` |

`layout_nodes` computes tidy positions using the host-configured layout engine (typically dagre), applies them in one undoable step, and fits the viewport. Returned positions are **flow-absolute** (top-left corners in flow coordinates). When `nodeIds` is supplied, only those nodes and the edges among them form the layout subgraph — nodes outside the subset are left untouched. The `dagreLayout` adapter ships in `@angflow/angular/layout` (requires the optional peer dep `@dagrejs/dagre >= 3`). When the host enables `[animate]` on `<ng-flow>`, applied positions tween smoothly (default 300 ms) instead of jumping; the tool response is sent after the transition settles, and `fitView` measures the final positions.

**Groups (compound layout).** A node carrying a `parentId` is forwarded to the layout fn with that `parentId` **only when its parent is also in the layout set** (the whole graph, or within the `nodeIds` subset) — so the engine clusters grouped children within their group. If the parent is excluded from the set, the child is laid out as a free top-level node. Results are applied via the `'absolute'` coordinate space, so each grouped child is re-parented against its group's new position and stays inside the group; top-level nodes are unaffected (absolute == relative for them). When a child's parent is excluded via `nodeIds`, the child is laid out as a free node but the result is still applied parent-relative (its `parentId` is unchanged), so it may land outside the group's visual box; children with `extent: 'parent'` are re-clamped by the store on write. Note: prior to v0.2.x the bridge applied layout results in relative space, which mis-placed grouped children; results are now always applied as flow-absolute positions.

### History

| Tool | Params | Returns |
|---|---|---|
| `undo` | `steps?: number` (default `1`) | `{ undone: number, canUndo: boolean, canRedo: boolean }` |
| `redo` | `steps?: number` (default `1`) | `{ redone: number, canUndo: boolean, canRedo: boolean }` |
| `history_status` | — | `{ canUndo: boolean, canRedo: boolean, pastDepth: number, futureDepth: number }` |
| `clear_history` | — | `null` |

## Events (push)

Subscribers (`angflow.subscribe(h)`) receive:

- `flow.registered` — `{ flowId }`
- `flow.unregistered` — `{ flowId }`
- `flow.history` — `{ flowId, canUndo, canRedo, pastDepth, futureDepth }`. Emitted **synchronously inside `dispatch`** immediately after a history-capturing mutation completes (or after `undo`/`redo`/`clear_history`).
- `flow.state` — `{ flowId, nodes, edges, viewport, selection: { nodeIds, edgeIds } }`. Coalesced per microtask; duplicates suppressed via a cheap signature. Emitted in the **next microtask** via the `watchFlow` effect. While any node is mid-drag (`dragging: true`), emissions are additionally throttled to at most one per 100ms, with a trailing emission that guarantees the latest drag state is always delivered; drag end emits promptly.

**Ordering note:** When a mutating tool fires, consumers receive `flow.history` first (synchronously), then `flow.state` (next microtask). This ordering is reliable — useful when a consumer wants to update UI affordances before rendering the new graph state. During an active node drag, the throttle may delay flow.state past the next microtask (up to ~100ms); the synchronous flow.history ordering is unaffected.

## Transactional batch

`apply_changes` runs a sequence of ops atomically:

```ts
await angflow.callTool('apply_changes', {
  ops: [
    { op: 'add_node', node: { id: 'a1', position: { x: 0, y: 0 }, data: { label: 'A' } } },
    { op: 'add_edge', edge: { id: 'e1', source: 'a1', target: 'existing' } },
    { op: 'update_node_data', id: 'existing', dataPatch: { label: 'Updated' } },
  ],
})
```

**Supported op kinds** (mirrors the individual tool names):

| Op kind | Required fields |
|---|---|
| `add_node` | `node: Node` |
| `add_nodes` | `nodes: Node[]` |
| `add_edge` | `edge: Edge` |
| `add_edges` | `edges: Edge[]` |
| `update_node` | `id: string`, `patch: Partial<Node>` |
| `update_node_data` | `id: string`, `dataPatch: Record<string, unknown>` |
| `update_edge` | `id: string`, `patch: Partial<Edge>` |
| `update_edge_data` | `id: string`, `dataPatch: Record<string, unknown>` |
| `delete_elements` | `nodeIds?: string[]`, `edgeIds?: string[]` |
| `select_nodes` | `nodeIds: string[]`, `additive?: boolean` |
| `select_edges` | `edgeIds: string[]`, `additive?: boolean` |
| `deselect_all` | — |

**`set_nodes` and `set_edges` are NOT valid ops inside `apply_changes`.** Use the incremental ops instead.

**`delete_elements` inside `apply_changes` skips the `onBeforeDelete` hook.** The standalone `delete_elements` tool awaits `onBeforeDelete` if the host has registered one. Inside `apply_changes`, deletions go through synchronous `setNodes`/`setEdges` filters so the whole batch can roll back on failure — there is no opportunity to await an async veto. If your app relies on `onBeforeDelete` to gate deletions, call the standalone `delete_elements` tool instead. The bridge emits a one-time `console.warn` the first time this combination occurs (`apply_changes` containing `delete_elements` while the host has `onBeforeDelete` set), so the silent veto-loss is discoverable.

**Snapshot-rollback semantics:**

1. Before any op executes, `apply_changes` captures a snapshot of `{ nodes, edges }` (viewport is intentionally excluded). Each node and edge is shallow-cloned so concurrent in-place mutations cannot corrupt the snapshot.
2. All ops run inside `service.batch()`.
3. If any op throws, the snapshot is restored via `setNodes`/`setEdges` inside another `batch()` call. Because the rolled-back state is byte-for-byte identical to the pre-call state, the `flow.state` dedup will normally suppress the emission — consumers should treat the JSON-RPC error response (`-32603` with `failedIndex`) as the signal that the batch was rolled back, not absence of a state event.
4. On success, a single coalesced `flow.state` event is emitted after all ops complete.

**History:** A successful `apply_changes` that includes at least one non-selection op (i.e., at least one op that is not `select_nodes`, `select_edges`, or `deselect_all`) creates exactly one undo entry. A batch that is entirely selection ops creates no undo entry. A rolled-back `apply_changes` creates no undo entry.

**Error shape on failure:**

```json
{
  "code": -32603,
  "message": "...",
  "data": { "failedIndex": 2 }
}
```

`failedIndex` is the zero-based index of the first op that threw.

## Node templates

Node templates are JSON-serialisable rendering specs that let an agent define new card-style node types at runtime without shipping Angular components.

### NodeTemplateSpec interface

```ts
interface NodeTemplateSpec {
  /** Card title. Supports {{data.x}} interpolation. */
  title?: string;
  /** Icon name resolved against the built-in glyph set; unknown names render nothing. */
  icon?: string;
  /** Accent color (header text / left border). Any CSS color; Angular sanitizes the style binding. */
  accent?: string;
  /** Layout density. Default 'detailed'. */
  variant?: 'compact' | 'detailed';
  badges?: NodeTemplateBadge[];
  fields?: NodeTemplateField[];
  /** Free body text (interpolated), shown under fields. */
  body?: string;
  /** Defaults to one target handle (left) and one source handle (right) when omitted. */
  handles?: NodeTemplateHandle[];
}

interface NodeTemplateBadge {
  text: string;                       // Supports {{data.x}} interpolation.
  color?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';  // defaults to 'slate'
  showIf?: string;                    // Dotted data path; badge renders only when truthy.
}

interface NodeTemplateField {
  label: string;                      // Row label (literal, not interpolated).
  value: string;                      // Row value. Supports {{data.x}} interpolation.
  showIf?: string;                    // Dotted data path; row renders only when truthy.
}

interface NodeTemplateHandle {
  type: 'source' | 'target';
  position?: 'top' | 'right' | 'bottom' | 'left';  // Defaults: target → 'left', source → 'right'.
  id?: string;
}
```

### Interpolation semantics

String fields (`title`, `value`, `body`, badge `text`) support `{{data.x}}` placeholders:

- Paths are **dotted only** — `data.env`, `data.config.region`. No expressions, no bracket notation, no function calls.
- The leading `data` segment is **required** — `{{name}}` resolves nothing; use `{{data.name}}`.
- Own-properties only — prototype-chain properties are not accessible.
- Unknown paths render as an empty string (no error).
- Output is inserted via Angular text bindings only — never set as `innerHTML`. There is no XSS risk.

`showIf` fields use the **same path resolution** with truthiness evaluation — a badge or field renders when the resolved value is truthy, and is hidden otherwise.

### Badge palette

The `color` field on badges is restricted to an allowlisted palette: `slate`, `indigo`, `emerald`, `amber`, `rose`. The bridge rejects unknown color values with `-32602`. The `accent` field on the spec root is the only place a raw CSS color string is accepted; it is bound via Angular's sanitized style bindings.

### Icon names

The built-in glyph set recognizes: `database`, `server`, `queue`, `cloud`, `user`, `document`, `bolt`, `settings`. Any other value renders nothing (no error).

### Rendering precedence

When resolving a `node.type`, the renderer applies the following priority order (highest first):

1. Content-projected `<ng-template ngFlowNodeType>` — defined inside the `<ng-flow>` template by the host component.
2. Host `nodeTypes` component map — Angular components registered via the `[nodeTypes]` input.
3. Built-in types — `default`, `input`, `output`, `group`.
4. Agent templates — registered via `register_node_template`.
5. Default node fallback — used when no match is found.

This means agent templates cannot shadow builtin or host-registered types. `register_node_template` enforces this by rejecting `builtin` and `host` names with `-32602`.

### History note

Template registration and unregistration are **never captured by undo/redo**. Templates are rendering config, not graph state. Example sequence:

```
register_node_template { name: 'svc', spec: { title: '{{data.name}}' } }
add_node { id: 'n1', type: 'svc', ... }
undo
```

After `undo`: node `n1` is removed from the graph, but the `svc` template remains registered. The template outlives the undo stack entry that created nodes of that type.

### Lifecycle

Templates live in memory per `NgFlowService` instance. They are **not persisted** across page reloads. To restore templates after a reload, re-call `register_node_template` for each entry returned by `list_node_templates` from the previous session (or store the specs in your own persistence layer and replay them on boot).

## History

The bridge maintains per-flow snapshot stacks of `{ nodes, edges }` (viewport is intentionally excluded so post-mutation zoom/pan survives undo).

### Capture rule

Tools that **do** capture a history entry (mutating tools):
`add_node`, `add_nodes`, `add_edge`, `add_edges`, `update_node`, `update_node_data`, `update_edge`, `update_edge_data`, `delete_elements`, `set_nodes`, `set_edges`, `apply_changes` (when it includes at least one non-selection op), and `layout_nodes` (captures one entry per successful call that applied ≥1 position; a failed or empty layout captures nothing).

Tools that **do not** capture a history entry:
- Selection tools (`select_nodes`, `select_edges`, `deselect_all`)
- Viewport tools (`fit_view`, `set_viewport`, `zoom_in`, `zoom_out`, `zoom_to`, `set_center`, `fit_bounds`)
- Read / geometry / coordinate tools (all read-only by definition)
- Node/edge type discovery and template management (`list_node_types`, `list_edge_types`, `register_node_template`, `unregister_node_template`, `list_node_templates`) — templates are rendering config, not graph state
- `apply_changes` when all ops are selection-only
- A rolled-back `apply_changes`
- `layout_nodes` when the layout function throws or returns no valid positions

### Bridge-only scope — known limitation

History tracks only **bridge-initiated mutations**. User-driven changes — drag, connect, resize via the UI; `(nodesChange)` / `(edgesChange)` outputs applied by the parent component — are **not** tracked. Calling `undo` after a user-driven change will restore to the last bridge snapshot and may overwrite those changes. If you need full undo/redo across UI interactions, implement it in the host application.

### Configuration

```ts
provideAgentBridge({
  transports: [new WindowTransport()],
  history: { maxDepth: 100 },  // default maxDepth is 100
})

// Disable history entirely:
provideAgentBridge({
  transports: [new WindowTransport()],
  history: false,
})
```

When history is disabled, `undo` and `redo` return `{ undone/redone: 0, canUndo: false, canRedo: false }` and `history_status` returns `{ canUndo: false, canRedo: false, pastDepth: 0, futureDepth: 0 }`.

### `flow.history` push event

Shape: `{ flowId: string, canUndo: boolean, canRedo: boolean, pastDepth: number, futureDepth: number }`

Emitted synchronously after every mutating tool call (before `flow.state`), and after `undo`, `redo`, and `clear_history`. Useful for updating UI affordances in real time.

## Error codes (JSON-RPC)

| Code | Meaning |
|---|---|
| `-32601` | Unknown tool name — or a known tool whose required capability is absent (e.g. `layout_nodes` without a configured layout function) |
| `-32602` | Invalid params (wrong type, missing required key) |
| `-32000` | Flow not found (bad/missing `flowId`) |
| `-32603` | Internal error from the underlying `NgFlowService` call |

**Note:** `apply_changes` rollback errors use code `-32603` and carry `data: { failedIndex }` in the error object indicating which op caused the failure.

**`layout_nodes` without a configured layout function** returns `-32601` with the message `"layout_nodes unavailable: no layout function configured. Pass \`layout\` to provideAgentBridge (e.g. dagreLayout from @angflow/angular/layout)."`. This is `-32601` (not `-32602`) because the issue is a missing capability on the deployment side, not a malformed request.

**Swallowed transport failures.** A throwing `transport.send` or a rejected `transport.start()` does not crash the bridge. Pass `onError: (err, ctx)` to `provideAgentBridge` to receive these. `ctx.kind` is `'transport-start'`, `'transport-send'`, or `'dispatch'`. The bridge always remains responsive.

## Two ways to call

1. **In-process** — `bridge.callTool(method, params)` from Angular code (tests, devtools, other components).
2. **Via transport** — external callers send `{ id, method, params }` frames; transport returns `{ id, result }` or `{ id, error }`.

`WindowTransport` is a thin shim over option 2 that lets you do `await window.angflow.callTool(...)` from the devtools console.

## MCP server

`@angflow/mcp` (in `packages/mcp/`) exposes this entire tool catalog to MCP
clients (Claude Code, Claude Desktop, Cursor): it hosts the WebSocket endpoint
a `WebSocketTransport` dials and re-publishes every tool above 1:1, plus a
server-local `canvas_status` tool. Tool schemas are snapshotted from
`AGENT_TOOL_SCHEMAS` at build time — when you add or change a tool here,
rebuild/republish `@angflow/mcp` (its drift test fails until regenerated).
See [`packages/mcp/README.md`](../mcp/README.md) for setup.

**Auth.** The MCP server validates browser `Origin` headers against an allowlist
(localhost dev origins by default; `--allow-origin` to extend) and, unless started
with `--no-token`, enforces a token on non-browser connections (ephemeral and
printed to stderr when `--token` is omitted). Pass the token to the transport as
`new WebSocketTransport({ url, token })` — it is sent as the
`angflow.token.<token>` subprotocol, never in the URL.

## In-browser chat harness

`provideAgentChat({ complete })` + `<ng-flow-agent-chat>` (in
`src/lib/agent/chat/`) embed a canvas copilot directly in the app: a headless
`AgentChatService` runs an Anthropic-shaped tool-use loop, executing every
`tool_use` block in-process via `bridge.callTool` — same semantics, history,
and events as any other bridge caller. The `complete` function is the only
path to the model (typically a fetch to the host's own backend proxy holding
the API key server-side; the library never handles keys). Tools come straight
from `AGENT_TOOL_SCHEMAS` at runtime — no snapshot, no regeneration step.
See the `agent-chat` example and `examples/angular/server/agent-proxy.mjs`
for the reference wiring.

### Provider proxies (reference implementations in `examples/angular/server/`)

| Provider | File | Key env | Default model (June 2026) | Notes |
|---|---|---|---|---|
| Anthropic | `agent-proxy.mjs` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Near-passthrough (the wire shape is Anthropic's) |
| OpenAI | `agent-proxy-openai.mjs` | `OPENAI_API_KEY` | `gpt-5.2` | Tool-call/finish-reason translation |
| Ollama / OpenRouter / any OpenAI-compatible gateway | `agent-proxy-openai.mjs` + `OPENAI_BASE_URL` | `OPENAI_API_KEY` (dummy for Ollama) | set `ANGFLOW_AGENT_MODEL` (e.g. `qwen3`) | Local models: pick a tools-capable one; small models can degrade with the 52-tool catalog |
| Gemini | `agent-proxy-gemini.mjs` | `GEMINI_API_KEY` | `gemini-3.5-flash` | Synthesizes tool-call ids; strips `additionalProperties` from schemas |

All proxies accept an optional `x-angflow-model` request header for end-user
runtime model switching, honored only when `ANGFLOW_ALLOWED_MODELS`
(comma-separated) lists the value — the host's `complete()` fn sets the header;
the library is unaware. Model-name defaults age; override via
`ANGFLOW_AGENT_MODEL`.

## Adding a new tool

1. Add a schema entry in `src/lib/agent/tool-schemas.ts`.
2. Register a handler in `installHandlers()` inside `src/lib/agent/agent-bridge.service.ts`.
3. The handler receives `(flow: NgFlowService, params)` — call into the existing service API; do not reach into the store directly.
4. If the new behavior should appear in `flow.state` events, make sure the underlying mutation writes to one of the signals already watched (`nodes`, `edges`, `viewport`, `selectedNodes`, `selectedEdges`); if not, extend the watcher in `watchFlow()`.
5. If the tool mutates `nodes` or `edges`, add it to the `MUTATING_TOOLS` set at the top of `agent-bridge.service.ts` so history capture fires automatically.
6. If the tool's history capture is conditional (like `layout_nodes`, which only captures when ≥1 position was applied), handle it in `dispatch()` instead of `MUTATING_TOOLS`.
7. Update this doc — at minimum, add the tool to the catalog table.

## Known gaps

Not yet exposed (but planned or noted):
- **Undo/redo for user-driven changes** — bridge history only tracks bridge-initiated mutations (see History section).
- **Copy/paste** — no clipboard API in the bridge yet.
- **Pane/read-only toggles** — cannot toggle `panOnDrag`, `nodesDraggable`, `nodesConnectable`, etc. via the bridge yet.
- **Edge templates** — `register_edge_template` is not implemented; `list_edge_types` ships for discovery only.
