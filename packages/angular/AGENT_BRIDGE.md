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

- **Bridge** — root-scoped service. Holds a registry of `flowId → NgFlowService`, routes inbound tool calls to the right service, and emits `flow.state` events when any registered flow's signals change (coalesced via microtask).
- **Transport** — anything implementing `AgentTransport`. Bundled: `WindowTransport` (exposes `window.angflow`), `WebSocketTransport`. Add custom ones for postMessage, CDP, MCP servers, etc.
- **Tool schemas** — `AGENT_TOOL_SCHEMAS` is a JSON-Schema array suitable for direct use as Anthropic/OpenAI `tools`.

## Wiring

```ts
// app.config.ts
import { provideAgentBridge, WindowTransport } from '@angflow/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgentBridge({ transports: [new WindowTransport()] }),
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

## Tool catalog

Every tool takes an optional `flowId` (omit when only one flow is registered; required otherwise). All payloads use the `Node` / `Edge` types from `@angflow/angular`.

### Discovery / read

| Tool | Params | Returns |
|---|---|---|
| `list_flows` | — | `string[]` of registered flow ids |
| `get_state` | — | `{ nodes, edges, viewport }` |
| `get_nodes` | — | `Node[]` |
| `get_edges` | — | `Edge[]` |
| `get_node` | `id` | `Node \| null` |
| `get_edge` | `id` | `Edge \| null` |
| `get_viewport` | — | `{ x, y, zoom }` |

### Mutate — incremental (preferred)

| Tool | Params | Notes |
|---|---|---|
| `add_node` | `node: { id, position:{x,y}, data, type?, … }` | Returns the created node |
| `add_edge` | `edge: { id, source, target, sourceHandle?, targetHandle?, type?, animated?, label?, data? }` | Use this to **link nodes** |
| `update_node` | `id`, `patch: Partial<Node>` | Shallow merge. Move with `patch.position`; edit body with `patch.data` |
| `update_edge` | `id`, `patch: Partial<Edge>` | Shallow merge |
| `delete_elements` | `nodeIds?: string[]`, `edgeIds?: string[]` | Edges to deleted nodes auto-removed. Returns `{ deletedNodeIds, deletedEdgeIds }` |

### Mutate — bulk (prefer incremental ops above)

| Tool | Params |
|---|---|
| `set_nodes` | `nodes: Node[]` — full replacement |
| `set_edges` | `edges: Edge[]` — full replacement |

### Viewport / camera

| Tool | Params |
|---|---|
| `fit_view` | `nodeIds?`, `padding?`, `duration?` |
| `set_viewport` | `viewport: { x, y, zoom }`, `duration?` |

## Events (push)

Subscribers (`angflow.subscribe(h)`) receive:

- `flow.registered` — `{ flowId }`
- `flow.unregistered` — `{ flowId }`
- `flow.state` — `{ flowId, nodes, edges, viewport, selection: { nodeIds, edgeIds } }`. Coalesced per microtask; duplicates suppressed via a cheap signature.

## Error codes (JSON-RPC)

| Code | Meaning |
|---|---|
| `-32601` | Unknown tool name |
| `-32602` | Invalid params (wrong type, missing required key) |
| `-32000` | Flow not found (bad/missing `flowId`) |
| `-32603` | Internal error from the underlying `NgFlowService` call |

## Two ways to call

1. **In-process** — `bridge.callTool(method, params)` from Angular code (tests, devtools, other components).
2. **Via transport** — external callers send `{ id, method, params }` frames; transport returns `{ id, result }` or `{ id, error }`.

`WindowTransport` is a thin shim over option 2 that lets you do `await window.angflow.callTool(...)` from the devtools console.

## Adding a new tool

1. Add a schema entry in `src/lib/agent/tool-schemas.ts`.
2. Register a handler in `installHandlers()` inside `src/lib/agent/agent-bridge.service.ts`.
3. The handler receives `(flow: NgFlowService, params)` — call into the existing service API; do not reach into the store directly.
4. If the new behavior should appear in `flow.state` events, make sure the underlying mutation writes to one of the signals already watched (`nodes`, `edges`, `viewport`, `selectedNodes`, `selectedEdges`); if not, extend the watcher in `watchFlow()`.
5. Update this doc — at minimum, add the tool to the catalog table.

## Known gaps

Not yet exposed (but supported by `NgFlowService`): programmatic selection, handle-aware connect validation, batch `addNodes`/`addEdges`, zoom-in/-out/center-on-node, undo/redo/copy/paste, runtime node/edge type registration, pane/read-only toggles.
