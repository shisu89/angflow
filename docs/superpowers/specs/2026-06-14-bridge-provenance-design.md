# Bridge provenance subsystem — source, canMutate guard, op-log (feedback #15 + #16)

**Date:** 2026-06-14
**Roadmap:** unit 4 of [agent-bridge parity roadmap](./2026-06-13-agent-bridge-parity-roadmap.md).
**Feedback:** `brainstorm_agentic_app/docs/angflow-feedback.md` #15 (no authorship/provenance or host
mutation guard) and #16 (no durable op-log / replay / change-cursor). Designed together as one
provenance subsystem — surfacing per-op author on events requires an op stream, so the two are coupled.

## Problem

The bridge's premise is an external agent editing *alongside a human*, yet:
- Every mutation is **anonymous** — no per-call source/author, no way for the host to attribute or audit.
- The host has **no way to protect** human-authored content — an external agent can `delete_elements`
  anything with nothing to stop it.
- The only "what changed" signal is the full `flow.state` push; over MCP (request/response) an agent
  must re-read the whole graph to learn what the human (or another agent) did, and nothing survives a
  reconnect.

## Goal

1. An optional **`source`** on every call (or injected per transport), threaded to the guard, the
   op-log, and the `flow.history` event for attribution.
2. A host-pluggable **`canMutate(op, source)`** write guard so the host can protect/scope/rate-limit
   agent writes.
3. A bounded **op-log** with a monotonic cursor, an **`onOp`** host sink for durable persistence, and a
   poll-friendly **`get_changes_since(cursor)`** read tool — the MCP-ergonomic complement to push
   `flow.state`.

Granularity is **tool-call level**: the unit of guard/log is the mutating tool call
(`op = { method, params }`); `apply_changes` carries its `ops[]` for the host to inspect. This matches
the bridge's dispatch seam; per-element decomposition would require a diff layer the bridge does not
model and is out of scope.

## Design

### Source plumbing (#15)

- `AgentInbound` (`types.ts`) gains optional `source?: string`. It is **host-defined** — e.g.
  `"agent:claude"`, `"user"`, `"mcp:cursor"`; an author id can be encoded in it. A single field (the
  host attaches whatever semantics it wants); no separate `author`.
- `bridge.callTool(method, params?, opts?: { source?: string })` — in-process callers pass source via
  `opts`. (Backward compatible: `opts` is optional.)
- Transports may inject a default source: `AgentTransport` implementations can attach `source` to
  inbound frames lacking one (e.g. `new WebSocketTransport({ url, source })`). This is the transport's
  responsibility — the bridge simply reads `req.source`.
- `dispatch` resolves the effective `source = req.source` and threads it to `canMutate`, the op-log /
  `onOp`, and the `flow.history` emission.

### `canMutate` write guard (#15)

- `provideAgentBridge({ canMutate })` where
  `canMutate?: (op: { method: string; params: Record<string, unknown> }, source?: string) => boolean | string | Promise<boolean | string>`.
  Return `true` to allow; `false` or a non-empty string to deny (the string is the denial reason).
- Invoked in `dispatch` **before** executing a mutating tool, for the gated set:
  `add_node`, `add_nodes`, `add_edge`, `add_edges`, `update_node`, `update_node_data`, `update_edge`,
  `update_edge_data`, `delete_elements`, `set_nodes`, `set_edges`, `apply_changes`, `layout_nodes`,
  `group_nodes`, `set_node_group`, `set_group_collapsed`, `dissolve_group`.
  Reads, selection, viewport, template management, and `undo`/`redo`/`clear_history` are **not** gated.
- A `GATED_TOOLS` set holds this list (it is `MUTATING_TOOLS` plus `apply_changes`, `layout_nodes`, and
  the four mutating group tools).
- On deny: reject with a new error code **`-32001`** ("mutation denied by host"); the message is the
  returned reason (or a default). The mutation is **not** executed, no op-log entry, no `flow.history`.
- `canMutate` is awaited (async-capable). A `canMutate` that throws is treated as a deny (surfaced via
  `onError` with `kind: 'dispatch'`), failing safe.
- When no `canMutate` is configured, all mutations proceed (today's behavior).

### op-log + `get_changes_since` + `onOp` (#16)

- **op-log:** per-flow in-memory ring buffer. Config `opLog?: { maxOps: number } | false` on
  `provideAgentBridge` (default `{ maxOps: 1000 }`; `false` disables the op-log and makes
  `get_changes_since` return an empty log — see below). A per-flow monotonic `cursor`
  starts at 0; the first appended op is `cursor: 1`.
- An `OpLogEntry = { cursor: number; flowId: string; method: string; params: Record<string, unknown>; source?: string }`.
  After a mutating tool call succeeds (and only then), `dispatch` appends one entry (one per tool call;
  `apply_changes` is a single entry carrying its `ops[]` in `params`).
- **`onOp` sink:** `provideAgentBridge({ onOp })` where `onOp?: (entry: OpLogEntry) => void`. Called
  synchronously after the entry is appended, so the host can persist/replay. A throwing `onOp` is
  isolated (forwarded to `onError`, never breaks the bridge). The bridge owns no durable storage — it
  just emits the stream.
- **`get_changes_since` tool** (read-only): params `{ since?: number }` (+ `flowId`). Returns
  `{ ops: OpLogEntry[], cursor: number, truncated: boolean }`:
  - `ops` = retained entries with `cursor > since` (all retained entries when `since` is omitted or 0).
  - `cursor` = the latest cursor (so the agent stores it for the next poll).
  - `truncated` = `true` when `since` is non-zero and predates the oldest retained entry (the ring
    buffer dropped entries the caller hadn't seen) — the agent should re-sync via `get_state`.
  - When the op-log is disabled (`opLog: false`), the tool returns `{ ops: [], cursor: 0, truncated: false }`.

### Event surfacing

- The `flow.history` event params gain optional `source?` — the source of the mutation that triggered
  it. Emitted **synchronously** in `dispatch` (per-mutation), so attribution is reliable.
- `flow.state` stays source-less: it is coalesced/throttled, so multiple mutations (possibly from
  different sources) can merge into one emission — per-op attribution there would be unreliable.

### Configuration (`provide-agent-bridge.ts`)

`AgentBridgeConfig` gains:
```ts
canMutate?: (op: { method: string; params: Record<string, unknown> }, source?: string) => boolean | string | Promise<boolean | string>;
onOp?: (entry: OpLogEntry) => void;
opLog?: { maxOps: number } | false;   // default { maxOps: 1000 }
```
New injection tokens (`AGENT_CAN_MUTATE`, `AGENT_ON_OP`, `AGENT_OPLOG_OPTIONS`) mirror the existing
`AGENT_ON_ERROR` / `AGENT_HISTORY_OPTIONS` pattern.

### New module: `op-log.ts`

A small `OpLog` class (per the existing `history.ts` precedent) holding the per-flow ring buffers,
cursor sequence, append, `since(cursor)` query (with truncation detection), and `dropFlow(id)`. Keeps
`agent-bridge.service.ts` from growing another responsibility inline. `OpLogEntry` type exported from
the agent index.

## Scope / limitations

- **Bridge-initiated forward mutations only.** Like the existing undo history, the op-log records only
  mutations that went through `callTool`/a transport. UI-driven changes and `undo`/`redo` are not
  logged. (Documented, mirroring the history "Bridge-only scope" note.)
- Single host-defined `source` string (no structured author object).
- Tool-call granularity (no per-element deltas).
- No new push event (onOp + `flow.history.source` + `get_changes_since` cover host persistence, live
  attribution, and polling).

## Tool schema changes (`tool-schemas.ts`)

- Add `get_changes_since` (params: `since?: number`, `flowId?`). Note: `source` is a frame-level field,
  not a per-tool param, so no per-tool schema change for source.

## Error codes

- Add `-32001` ("mutation denied by host") to `AGENT_BRIDGE.md`'s error table. It is server-defined
  (JSON-RPC reserves `-32000..-32099` for server errors; `-32000` is already "flow not found").

## Testing (TDD)

**`op-log.ts` unit spec:** append assigns increasing cursors; `since(c)` returns entries after `c`;
ring buffer drops oldest past `maxOps`; `since` older than retained → `truncated`; `dropFlow` clears.

**`agent-bridge.spec.ts`:**
- `source`: `callTool(method, params, { source })` threads to `onOp` entry, `flow.history` event, and
  `get_changes_since` entries.
- `canMutate`: returning `false`/reason denies a mutating tool with `-32001`, nothing applied, no op-log
  entry; returning `true` allows; async `canMutate` awaited; a throwing `canMutate` denies (fail-safe).
- `canMutate` is **not** called for read/selection/viewport tools (spy asserts no call).
- `onOp`: fires once per applied mutating tool call with the right `{ method, source }`; a throwing
  `onOp` doesn't break the call.
- `get_changes_since`: empty initially; returns ops after a cursor; `truncated` after the buffer
  overflows past a stale cursor; disabled (`opLog:false`) → `{ ops:[], cursor:0, truncated:false }`.
- `flow.history` event carries `source`.
- read tools (`get_state`, etc.) produce no op-log entries.

## Closeout

- Update `packages/angular/AGENT_BRIDGE.md`: a **Provenance** section (source, `canMutate`, op-log,
  `onOp`, `get_changes_since`), the `get_changes_since` row in the Discovery/read table, the `-32001`
  error row, the `flow.history` event's new `source` field, and the `provideAgentBridge` config block.
- Regenerate the `@angflow/mcp` schema snapshot (`pnpm -F @angflow/mcp run generate:schemas`) — tool
  count 57 → 58; drift test gates CI.
- Publish: `@angflow/angular` patch → `@angflow/mcp` patch. (`@angflow/system` unchanged this unit.)
- Mark feedback #15 and #16 ✅ with the commit/PR reference (adoption N/A — the app uses its own
  CanvasOp protocol; both were parity suggestions citing it as the reference impl).
