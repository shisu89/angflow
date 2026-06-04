# @angflow/mcp

An MCP server that exposes a live [angflow](https://github.com/angflow/angflow) canvas to AI agents — Claude Code, Claude Desktop, and Cursor — while a human edits alongside. The server hosts the WebSocket endpoint that a `WebSocketTransport` in the browser dials out to, then re-publishes every tool in the `@angflow/angular` agent-bridge catalog 1:1 as MCP tools so agents can add nodes, connect them, run auto-layout, undo changes, and inspect state in real time.

## Quickstart

### Step 1 — Wire the canvas

In your Angular app's `app.config.ts`, add `WebSocketTransport` alongside `WindowTransport`. The transport retries silently with exponential backoff whenever no server is listening, so your app keeps working in development even when the MCP server is not running.

```ts
import { provideAgentBridge, WindowTransport, WebSocketTransport } from '@angflow/angular';
import { dagreLayout } from '@angflow/angular/layout';

provideAgentBridge({
  transports: [
    new WindowTransport(),
    new WebSocketTransport({ url: 'ws://localhost:8765' }),
  ],
  layout: dagreLayout,
});
```

### Step 2 — Register the server with your MCP client

**Claude Code:**

```bash
claude mcp add angflow -- npx @angflow/mcp
```

**Claude Desktop / Cursor** — add to `claude_desktop_config.json` / `.cursor/mcp.json`:

```json
{ "mcpServers": { "angflow": { "command": "npx", "args": ["@angflow/mcp"] } } }
```

### Step 3 — Open the app and ask the agent

Navigate to your angflow app in a browser. The canvas dials the server automatically. You can now prompt your AI agent:

> "Add a database node and connect it to the API service, then tidy the layout."

Use `canvas_status` whenever you need to check the connection:

> "Call canvas_status — is the canvas connected?"

## How it works

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

The MCP client (Claude Code, Claude Desktop, Cursor) launches the server as a subprocess over stdio. The server listens for the browser canvas on a local WebSocket port. Start order does not matter: `WebSocketTransport` reconnects automatically whenever the server comes up, and the server queues no requests until a canvas is connected.

The tool catalog is a build-time snapshot of `AGENT_TOOL_SCHEMAS` from `@angflow/angular`, committed inside this package. The server has no runtime dependency on `@angflow/angular` or Angular itself — tools are available immediately when the server starts, before any canvas connects.

## CLI reference

```
npx @angflow/mcp [options]
```

| Flag | Environment variable | Default | Description |
|------|---------------------|---------|-------------|
| `--port <n>` | `ANGFLOW_MCP_PORT` | `8765` | WebSocket port the canvas dials in on |
| `--host <addr>` | `ANGFLOW_MCP_HOST` | `127.0.0.1` | Bind address for the WebSocket listener |
| `--token <secret>` | `ANGFLOW_MCP_TOKEN` | _(none)_ | Shared secret; canvas must append `?token=<secret>` |
| `--timeout <ms>` | `ANGFLOW_MCP_TIMEOUT` | `30000` | Per-request timeout in milliseconds |
| `--log-level <l>` | `ANGFLOW_MCP_LOG_LEVEL` | `info` | `debug` \| `info` \| `silent` — all output goes to stderr |
| `--version` | — | — | Print `@angflow/mcp` version and the `@angflow/angular` version the tool schemas were generated from, then exit |
| `--help` | — | — | Print this usage summary and exit |

All logging goes to **stderr**. Stdout is reserved for the MCP stdio protocol; writing anything else there would corrupt the framing.

## Tools

Every tool in the `@angflow/angular` agent-bridge catalog is exposed 1:1 — the name, description, and JSON Schema input shape are passed through verbatim. That includes graph CRUD (`add_node`, `add_edge`, `delete_elements`, …), selection, viewport, transactional batch (`apply_changes`), auto-layout (`layout_nodes`), undo/redo, type discovery, and node templates. See [`packages/angular/AGENT_BRIDGE.md`](../angular/AGENT_BRIDGE.md) for the complete catalog and parameter reference.

One additional server-local tool is registered:

| Tool | Returns | Notes |
|------|---------|-------|
| `canvas_status` | `{ connected, flows, port, host }` | Reports whether a canvas is connected and which flow ids it has registered. Call this first when other tools fail. |

## Security

The server binds to `127.0.0.1` by default. Only processes on the same machine can reach it, and only whatever is running on your machine can pose as the canvas.

For **shared or multi-user machines**, use `--token` to require a secret on every canvas connection:

```bash
# Start the server with a token
npx @angflow/mcp --token mysecret

# Point the transport at the token-guarded URL
new WebSocketTransport({ url: 'ws://localhost:8765?token=mysecret' })
```

Connections without the correct token are closed immediately with code `4401`. The token is never sent to the MCP client.

Using `--host 0.0.0.0` or a non-loopback address exposes the WebSocket port to the network. This is not recommended and is entirely at your own risk. There is no TLS on the WebSocket listener.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tool returns `isError: No canvas connected` | The browser app has not dialed in yet, or `WebSocketTransport` is not wired | Open the app, check the transport URL matches the server's `--port`, confirm `provideAgentBridge` includes a `WebSocketTransport` |
| Server fails to start: `EADDRINUSE` / port in use | Another process is already using port 8765 | Pass `--port <other>` and update the transport URL to match |
| Agent edits the wrong browser tab | Two tabs of the app are open; the second connection replaces the first (close code `4000`) | Watch stderr for the takeover warning. Close the extra tab — the last canvas to connect is always the active one |
| Tool returns `[-32601] Unknown method: <tool>` | The canvas is running an older version of `@angflow/angular` whose tool catalog does not include that tool | Run `npx @angflow/mcp --version` to see which `@angflow/angular` version the server's snapshot was generated from, then update the app |
