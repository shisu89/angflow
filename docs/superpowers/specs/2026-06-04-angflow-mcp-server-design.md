# @angflow/mcp Server — Design

**Date:** 2026-06-04
**Status:** Approved design; ready for implementation planning
**Scope:** Sub-project 2 of 3 in the "solidify the agentic entry point" effort (see `docs/superpowers/specs/2026-06-03-agent-tool-surface-completeness-design.md` for the decomposition and cross-cutting decisions). A standalone Node package, `@angflow/mcp`, that exposes a live angflow canvas to MCP clients (Claude Code, Claude Desktop, Cursor) by proxying the full `AGENT_TOOL_SCHEMAS` catalog over the existing browser-dialed WebSocket transport. No changes to `@angflow/angular` or `@angflow/system`.

## Context

Sub-project 1 completed the bridge tool surface: 51 JSON-RPC tools (graph CRUD, geometry, selection, viewport, transactional batch, undo/redo, type discovery, data-driven node templates, auto-layout), all described by `AGENT_TOOL_SCHEMAS` in `packages/angular/src/lib/agent/tool-schemas.ts`. The bridge already ships a `WebSocketTransport` (`packages/angular/src/lib/agent/transports/websocket.ts`) in which the **browser dials out** to a `ws://` URL with automatic exponential-backoff reconnect, sends `AgentResponse`/`AgentEvent` frames, and accepts `AgentRequest` frames.

This sub-project gives external AI agents a turnkey path to a running canvas: an MCP server process that an MCP client launches over stdio, which in turn hosts the WebSocket endpoint the canvas connects to.

```
MCP client (stdio) ──▶ McpServer ──▶ mcp-tools (passthrough handlers)
                                          │ callTool(name, args)
                                          ▼
                                    CanvasSocket ── ws://127.0.0.1:8765 ◀── browser dials in
                                          │                                  (WebSocketTransport,
                                          ├─ send AgentRequest {id,…}         existing reconnect)
                                          ├─ match AgentResponse by id
                                          └─ route AgentEvent → session mirror
```

## Problem

Today the only ways to drive the bridge are the devtools console (`window.angflow`) or hand-rolled WS clients. There is no supported path for the tools people actually use — Claude Code, Claude Desktop, Cursor — to manipulate a live canvas while a human works alongside. The pieces exist (tool catalog, transport); nothing connects them to MCP.

## Goals

- Ship `@angflow/mcp` as a new workspace package (`packages/mcp`), published to npm, runnable via `npx @angflow/mcp` (bin: `angflow-mcp`).
- Expose every `AGENT_TOOL_SCHEMAS` entry 1:1 as an MCP tool (name, description, inputSchema verbatim), plus one server-local `canvas_status` tool.
- Host a WebSocket server (default `127.0.0.1:8765`) implementing the bridge wire protocol with a single-active-canvas policy, request/response correlation, per-request timeout, and optional shared-token authentication.
- Consume push events (`flow.registered`, `flow.unregistered`, `flow.state`, `flow.history`) internally for a session mirror and diagnostics; agents read state via the existing tools.
- Obtain schemas via a build-time snapshot generated from the workspace source, committed, version-stamped, and guarded by a drift test — zero runtime dependency on `@angflow/angular`.
- Document end-to-end setup: canvas wiring (`WebSocketTransport`), `claude mcp add` / Claude Desktop / Cursor registration, CLI reference, security notes, troubleshooting.
- Stdio-safe logging: all logs to stderr; stdout is reserved for the MCP protocol.

## Non-goals

- **Multi-session.** One active canvas connection; a new connection replaces the old (loud stderr log). Driving multiple apps concurrently = run multiple server instances on different ports. A future optional `sessionId` param is backward-compatible if ever needed.
- **MCP resources / subscriptions.** No `angflow://` resources, no `notifications/resources/updated`. Possible later enhancement; uneven client support today.
- **Runtime schema discovery.** No `get_tool_schemas` bridge tool, no dynamic registration, no `tools/list_changed`. The snapshot pins the catalog; a connected older canvas answering `-32601` for an unknown tool is the defined mismatch behavior.
- **HTTP/SSE MCP transport.** Stdio only in v1.
- **Auth beyond the optional shared token; remote-deployment hardening.** Default binding is loopback-only; `--host` exists but non-localhost use is explicitly at-your-own-risk in docs.
- **Changes to `@angflow/angular` or `@angflow/system`.** The transport and tool catalog are consumed as-is. (Exception: `examples/angular` gains the WebSocketTransport wiring, and `AGENT_BRIDGE.md` gains a pointer section — docs/example only.)
- **Sub-project 3** (in-browser chat harness) — separate spec.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Tool exposure | 1:1 passthrough of all 51 tools | Zero maintenance (new bridge tools appear on next snapshot), descriptions already LLM-tuned, 51 tools is within what Claude handles well, MCP clients let users disable tools. Rejected: curated subset (second list to maintain, lost capabilities), meta-tool (indirect calls, no per-tool schemas). User-confirmed. |
| Push events | Internal-only consumption | Server tracks registered flows / liveness / last state; agents poll via existing tools. MCP clients handle request/response far better than server pushes. Rejected: MCP resources (uneven client support), dropping events (server goes blind). User-confirmed. |
| Connection model | Single active canvas; new connection replaces old | Matches the real workflow (one human, one canvas, one agent); keeps the 51 schemas un-augmented; tab refresh is invisible to the agent. Replacement is logged loudly; `canvas_status` makes it diagnosable. Multi-session deferred — addable compatibly. User-confirmed. |
| Schema sourcing | Build-time snapshot, committed, version-stamped, drift-tested | Keeps `npx @angflow/mcp` free of `@angular/*` peer baggage; tools available at server start before any canvas connects. Rejected: runtime discovery (needs new bridge tool + `list_changed`, tools invisible until connect), subpath runtime dependency (npm 7+ auto-installs Angular peers onto MCP users). User-confirmed (Approach A). |
| WS binding | `127.0.0.1` default; `--host` override | An open WS port would let any local process or webpage pose as the canvas. Loopback default removes the ambient risk. |
| Auth | Optional `--token <secret>`; canvas appends `?token=…`; bad token → close 4401 | Cheap defense for shared machines; off by default for dev ergonomics. |
| Request timeout | Per-request, default 30s, `--timeout` | A wedged canvas must not hang the MCP client indefinitely. |
| In-flight calls on disconnect/replace | Reject immediately with "canvas disconnected mid-call; effect unknown — call get_state after reconnect" | Honest semantics; the mutation may or may not have applied before the drop. |
| Error surface | MCP `isError` text content formatted as `[code] message`, preserving bridge JSON-RPC codes | The agent may have read AGENT_BRIDGE.md, which speaks in those codes; passthrough fidelity beats translation. |
| Server-local tool | `canvas_status` → `{ connected, flows, port }` | Lets an agent self-diagnose "no canvas connected" instead of flailing through failing calls. Only non-passthrough tool. |
| Tool naming | No prefix/rename — `add_node` stays `add_node` | The names are already namespaced by server selection in MCP clients; renaming would desync from AGENT_BRIDGE.md. |
| Logging | stderr only, `--log-level` | stdout is the stdio MCP protocol channel; writing logs there corrupts framing. |
| Build tooling | Plain `tsc` + vitest; `tsx` for the generation script | No Angular, no rollup; smallest viable toolchain consistent with workspace conventions. |
| Package deps | `@modelcontextprotocol/sdk`, `ws` | Official SDK; `ws` is the standard Node WS server. Nothing else at runtime. |

## Architecture

### Package layout

`pnpm-workspace.yaml` gains a `packages/mcp` entry (the current list enumerates packages individually rather than globbing).

```
packages/mcp/
  package.json            # name @angflow/mcp; bin { "angflow-mcp": "dist/cli.js" };
                          # deps: @modelcontextprotocol/sdk, ws
  tsconfig.json
  scripts/
    generate-schemas.ts   # snapshot AGENT_TOOL_SCHEMAS → src/generated/tool-schemas.ts
  src/
    cli.ts                # arg/env parsing → start server; SIGINT/SIGTERM teardown
    server.ts             # composition root: McpServer + CanvasSocket + session wiring
    mcp-tools.ts          # registers snapshot tools + canvas_status → proxies via callTool fn
    canvas-socket.ts      # WS server, single-connection policy, correlation, timeout
    session.ts            # event-fed mirror: flows, last state, connection metadata
    generated/
      tool-schemas.ts     # BUILD ARTIFACT (committed): snapshot + source-version stamp + banner
  test/                   # vitest; FakeCanvas harness + unit/e2e-in-process/drift tests
  README.md               # user-facing quickstart/reference
```

### Unit boundaries

- **CanvasSocket** — knows the wire protocol and connection policy; exposes `call(method, params): Promise<unknown>`, `status()`, and an `onEvent` callback. Knows nothing about MCP.
- **mcp-tools** — knows MCP registration; takes a `callTool` function and the schema list. Knows nothing about WebSockets.
- **session** — pure consumer of events; queried by `canvas_status` and logging.
- **server.ts** — the only file that knows about all of them.

### Wire protocol (consumed as-is from `packages/angular/src/lib/agent/types.ts`)

Server → canvas: `AgentRequest { id, method, params }`. Canvas → server: `AgentResponse ({ id, result } | { id, error: { code, message, data? } })` and `AgentEvent { event, params }`. Correlation by monotonic numeric id; responses matching no pending id are logged at debug and dropped.

### Connection policy

1. WS server listens on `host:port` (default `127.0.0.1:8765`).
2. If `--token` is set: reject connections lacking `?token=<secret>` with close code **4401**.
3. A new accepted connection closes any existing one with code **4000** ("replaced by newer canvas") and logs a prominent takeover warning.
4. On disconnect or replacement, all pending requests reject with the disconnected-mid-call error.
5. The canvas's own `WebSocketTransport` reconnect-backoff handles server-restart and start-order: server and app may start in any order.

### Error mapping

| Condition | MCP result |
|---|---|
| Bridge JSON-RPC error | `isError: true`, text `[<code>] <message>` (+ ` data: <json>` when present, e.g. `failedIndex`) |
| No canvas connected | `isError: true`, text instructing to open the app with `WebSocketTransport` pointed at the server URL, referencing the README |
| Request timeout | `isError: true`, names the tool and the timeout value |
| Disconnected mid-call | `isError: true`, "effect unknown — call get_state after reconnect" |
| Success | `content: [{ type: 'text', text: JSON.stringify(result) }]`; `null` results stringified as `"null"` |

### canvas_status (server-local tool)

Returns `{ connected: boolean, flows: string[], port: number, host: string }` from the session mirror — registered alongside the passthrough tools, documented in the README as the first thing an agent should call when other tools fail.

### CLI

```
npx @angflow/mcp [--port 8765] [--host 127.0.0.1] [--token <secret>] [--timeout 30000] [--log-level info|debug|silent]
```

Each flag has an env fallback: `ANGFLOW_MCP_PORT`, `ANGFLOW_MCP_HOST`, `ANGFLOW_MCP_TOKEN`, `ANGFLOW_MCP_TIMEOUT`, `ANGFLOW_MCP_LOG_LEVEL`. `--version` prints the package version and the `@angflow/angular` version the snapshot was generated from.

### Schema snapshot pipeline

- `npm run build` = `tsx scripts/generate-schemas.ts && tsc`.
- The script imports `AGENT_TOOL_SCHEMAS` from `../angular/src/lib/agent/tool-schemas.ts` (a dependency-free source file) and the angular `package.json` version, then writes `src/generated/tool-schemas.ts` with a do-not-edit banner and `export const GENERATED_FROM_ANGULAR_VERSION`.
- The generated file is committed so the package builds from a registry tarball or shallow checkout without the workspace.
- **Drift test:** deep-equals the generated array against the workspace source; fails whenever the catalog changes without regeneration. **Validity test:** every snapshot entry registers successfully with the MCP SDK.

## Canvas wiring (consumer docs, no library change)

```ts
provideAgentBridge({
  transports: [
    new WindowTransport(),
    new WebSocketTransport({ url: 'ws://localhost:8765' }),
  ],
  layout: dagreLayout,
})
```

`examples/angular` adds the `WebSocketTransport` line permanently — the transport silently retries when no server is listening, so `ng serve` without the MCP server keeps working unchanged.

## Documentation

- `packages/mcp/README.md`: 3-step quickstart (run server → wire transport → `claude mcp add angflow -- npx @angflow/mcp`), Claude Desktop/Cursor JSON snippets, CLI reference, security notes (loopback default, token), troubleshooting table (no canvas connected / port in use / two-tab takeover / version mismatch → `-32601`).
- `packages/angular/AGENT_BRIDGE.md`: short "MCP server" section pointing at the README (same-commit rule satisfied — docs only, no bridge behavior change).
- Root `CLAUDE.md`: add `packages/mcp` to the project-structure block and the build/publish tables.

## Testing

All vitest, no real browser:

1. **FakeCanvas harness** — test WS client speaking the bridge protocol: scripted responses per method, on-demand event emission, configurable delays/misbehavior (never-respond, wrong-id, malformed JSON).
2. **CanvasSocket** — lifecycle (connect/replace/disconnect), token rejection (4401), replacement close (4000), correlation incl. out-of-order responses, timeout rejection, in-flight rejection on drop, unknown-id and malformed-frame tolerance.
3. **mcp-tools** — registration count (snapshot + 1), passthrough fidelity (args forwarded verbatim; result stringified), all four error-mapping rows.
4. **End-to-end in-process** — real MCP SDK client ↔ server over the SDK's in-memory transport with FakeCanvas behind it: `tools/list` count, `add_node` round trip, failure surfaces as `isError`.
5. **Drift + validity tests** — per the snapshot pipeline section.
6. **Manual verification step (not CI):** `claude mcp add` against the running example app; register a template, add nodes, `layout_nodes`, undo — watching the canvas live.

## Versioning & publish

- New package starts at `0.0.1`; published `--access public` like the others.
- README and `--version` state the snapshot's source `@angflow/angular` version; republish (patch) whenever the catalog changes.
- No version bumps required in `@angflow/angular`/`@angflow/system` (docs/example changes only).
