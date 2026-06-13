# Agent-Bridge Parity Roadmap (#14–18)

**Date:** 2026-06-13
**Status:** Roadmap (umbrella) — each feature below gets its own spec → plan → implement → archive cycle.
**Source:** `brainstorm_agentic_app/docs/angflow-feedback.md` entries #14–18 — MCP / agent-bridge parity
gaps surfaced by comparing the brainstorm app's journaled **CanvasOp** protocol against the
`@angflow/angular` agent bridge that `@angflow/mcp` re-publishes 1:1.

## Context

`AngflowAgentBridge` (`packages/angular/src/lib/agent/`) is a thin JSON-RPC layer that wraps
`NgFlowService`. Handlers call service methods (never the store directly), the bridge emits
coalesced `flow.state` snapshots plus synchronous `flow.history` events, and it keeps an in-memory
snapshot undo/redo stack. It has **no per-op log, no notion of a mutation's source/author, and no
host-pluggable write guard** — the three structural gaps behind #14–18.

The five feedback entries collapse into **four implementation units** (#15 and #16 are coupled —
surfacing per-op author on `flow.state`/`flow.history` requires an op stream, so they are designed
together as one provenance subsystem).

## Sequence

Ascending risk / blast-radius. Cheap isolated wins first to lock the shared conventions; the
cross-cutting provenance layer last so its guard + op-log automatically cover every tool, including
the group tools added in unit 3.

| Order | Unit | Why here | Surface touched |
|---|---|---|---|
| 1 | **#18** clamp signal | Smallest, fully isolated (viewport only). Warm-up that locks conventions. | `fit_view`, `layout_nodes` handlers; `NgFlowService.fitView` return |
| 2 | **#17** summarized / scoped reads | Read-only, isolated. Needs one service getter (`collapsedHiddenIds`). | new `get_summary`; `get_state` gains scope + hidden ids |
| 3 | **#14** group lifecycle | Self-contained feature; mostly wraps existing service methods. Highest standalone value. | new `group_nodes` / `set_node_group` / `set_group_collapsed` / `dissolve_group` / `get_group_bounds`; optional server-minted ids |
| 4 | **#15+#16** provenance subsystem | Cross-cutting — touches `dispatch` + every mutating handler. Last so it wraps the final tool set. | `provideAgentBridge` config (`canMutate`, `onOp`); per-call `source`; new `get_changes_since`; op-log |

## Shared conventions

Every unit follows these (they fall out of `AGENT_BRIDGE.md` "Adding a new tool"):

1. New behavior goes through a `NgFlowService` method; handlers never reach into `FlowStore` directly.
2. Each tool gets a schema entry in `tool-schemas.ts` + a handler in `installHandlers()`. Mutating
   tools are added to `MUTATING_TOOLS` (or get conditional capture in `dispatch()` when capture is
   conditional, as `layout_nodes` does).
3. `AGENT_BRIDGE.md` is updated **in the same commit**, and the `@angflow/mcp` schema snapshot is
   regenerated (`pnpm -F @angflow/mcp run generate:schemas`) — its drift test gates CI.
4. Param validation reuses existing helpers (`requireString`, `requireObject`, `optionalStringArray`,
   the 5000-element bulk cap); errors use the existing JSON-RPC codes (`-32601` missing tool/capability,
   `-32602` invalid params, `-32000` flow not found, `-32603` internal/rollback).
5. Each unit is its own change, merged to `main` (trunk-based), with system → angular → mcp publish +
   patch bumps wherever the published surface changed.
6. Each unit keeps the zonal example suite green and meets the zoneless bar (no `NgZone`; view updates
   driven by signal writes).

## Per-feature scope

Full design lives in each feature's own spec; these are the boundaries only.

### #18 — fit/layout clamp signal
Add an optional per-call `minZoom` to `fit_view` and `layout_nodes` (override the host's configured
`minZoom` for that fit only), and return `{ zoom, clamped }` so an agent can tell it could not frame
the whole board (and split into regions / `set_center` instead). `NgFlowService.fitView` must return
the achieved zoom + a clamp flag.

### #17 — summarized / scoped / collapse-aware reads
- `get_summary → { counts, groups: [{ id, label, collapsed, memberCount }], titles, viewport }` —
  a compact digest instead of a whole-board dump (a context bomb on 100+ node boards).
- `get_state({ groupId? | bounds? })` — scoped read.
- `get_state` also reports `collapsedHiddenIds` so the agent's model matches what the human sees.
- Requires a service getter exposing `FlowStore.collapsedHiddenIds`.

### #14 — group / container lifecycle
- `group_nodes(nodeIds, { label?, collapsed? }) → { groupId }` — creates the `type:'group'` node,
  reparents members, sizes the box via `getGroupBounds`.
- `set_node_group(nodeId, groupId | null)` — reparent / ungroup one node.
- `set_group_collapsed(groupId, boolean)` — drives the native `collapsed` fold (0.1.0+).
- `dissolve_group(groupId)` — members survive, ungrouped.
- `get_group_bounds(groupId)` — read the box geometry.
- **Server-minted ids:** make `id` optional on `add_node` and `group_nodes`; when omitted the bridge
  mints + returns one (removes the agent-supplied-id collision/retry risk over a transport).
- New service methods (`groupNodes`, `setNodeGroup`, `dissolveGroup`) compose the existing reparent /
  `sizeGroupToChildren` / `setNodeCollapsed` primitives.

### #15+#16 — provenance subsystem
- `provideAgentBridge({ canMutate(op, source) → boolean | reason, onOp(op, source) })` —
  host-pluggable write guard + op stream (host owns durable storage).
- Optional `source` / `author` accepted per call (or injected per transport), surfaced on
  `flow.state` / `flow.history` for attribution + audit.
- `get_changes_since(cursor) → { ops, cursor }` — poll-friendly read, the MCP-ergonomic complement
  to the push `flow.state`, so an agent can cheaply react to human edits without re-dumping state.
- Designed as one coherent layer so #15 does not need rework when #16's op-log lands.

## Out of scope (this roadmap)

- Edge templates, copy/paste, pane/read-only toggles (tracked under `AGENT_BRIDGE.md` "Known gaps").
- Changes to the brainstorm app itself — it drives its own CanvasOp protocol, not this bridge; the
  feedback entries cite it only as a reference implementation.

## Process note

When a unit ships, link its PR/commit and mark the corresponding ⛳ entry ✅ in
`brainstorm_agentic_app/docs/angflow-feedback.md`.
