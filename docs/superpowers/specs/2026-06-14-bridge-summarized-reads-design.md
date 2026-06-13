# Bridge summarized / scoped / collapse-aware reads (feedback #17)

**Date:** 2026-06-14
**Roadmap:** unit 2 of [agent-bridge parity roadmap](./2026-06-13-agent-bridge-parity-roadmap.md).
**Feedback:** `brainstorm_agentic_app/docs/angflow-feedback.md` #17 — bridge reads are raw whole-graph
dumps. `get_state`/`get_nodes` return the full graph; on a 100+ node board that is a context bomb for
the agent, and the agent's view doesn't reflect what the human sees (collapse-hidden nodes).

## Problem

The bridge has no compact digest and no scoped read:

- `get_state` returns `{ nodes, edges, viewport }` — every node with its full `data`, `style`,
  `measured`, etc. `get_nodes` is the same dump without the wrapper.
- There's no way to read just a region (a group's contents, or a screen rect).
- `get_state` doesn't report which nodes are currently hidden by collapse
  (`FlowStore.collapsedHiddenIds`), so the agent's model can diverge from what the human sees.

## Goal

1. A compact `get_summary` digest: counts, group overview, per-node titles (id/type/label only),
   viewport, canvas bounds, and the collapse-hidden set — small enough to read on a large board.
2. Scope `get_state` to a single group's subtree or a bounds rect.
3. Report `collapsedHiddenIds` from `get_state` so the agent's view matches the human's.

## Design

### New service method

`NgFlowService.getCollapsedHiddenIds(): string[]` — wraps the existing `FlowStore.collapsedHiddenIds()`
computed (a nesting-aware `Set<string>` of every node hidden because an ancestor group is collapsed) and
returns it as an array. Non-reactive read. This is the only new store touch; the bridge handlers compose
everything else from existing service reads (`getNodes`, `getEdges`, `getViewport`, `getNodesBounds`,
`isNodeIntersecting`).

### Bridge helpers (pure functions in `agent-bridge.service.ts`)

- `nodeTitle(node): string` — returns the first non-empty **own-property string** among
  `node.data?.label`, `node.data?.title`, `node.data?.name`, then `node.type`, then `node.id`. Works
  across builtin and custom nodes (best-effort).
- `descendantIdsOf(groupId, nodes): Set<string>` — nesting-aware. Builds a children-by-`parentId` map
  once, then BFS from `groupId` collecting every descendant id. **Excludes** the group node itself.
  Self-parent / cycles guarded (a visited set).
- induced-edges filter: given a node-id set, keep edges whose `source` **and** `target` are both in the
  set (the same pattern `layout_nodes` already uses for its subgraph).

### `get_state` — additive changes

Return type gains one key and stays otherwise unchanged (backward compatible):
`{ nodes, edges, viewport, collapsedHiddenIds }`.

- `collapsedHiddenIds: string[]` — always the **global** board-wide hidden set
  (`getCollapsedHiddenIds()`), regardless of scope. Empty array when nothing is collapsed.
- New optional, **mutually exclusive** params:
  - `groupId?: string` — scope to that node's nesting-aware descendant subtree. `nodes` =
    `descendantIdsOf(groupId)` resolved to node objects (group node excluded); `edges` = induced.
  - `bounds?: { x, y, width, height }` — scope to nodes intersecting the rect
    (`isNodeIntersecting(node, bounds, true)` — partial overlap); `edges` = induced.
- Validation: supplying both `groupId` and `bounds` → `-32602`. An unknown `groupId` (no such node)
  → `-32602`. A malformed `bounds` (missing/non-number x/y/width/height) → `-32602`.
- Unscoped (`groupId`/`bounds` both omitted): `nodes`/`edges` = all (unchanged behavior).
- Scoping **includes** collapse-hidden nodes that fall in scope — the agent explicitly asked for that
  region; `collapsedHiddenIds` lets it tell which of the returned nodes are hidden from the human.

### `get_summary` — new tool

Params: `flowId?` only. Returns:

```ts
{
  counts: { nodes: number; edges: number; groups: number };
  groups: Array<{ id: string; label: string; collapsed: boolean; memberCount: number }>;
  titles: Array<{ id: string; type: string; label: string }>;
  viewport: { x: number; y: number; zoom: number };
  bounds: { x: number; y: number; width: number; height: number } | null;
  collapsedHiddenIds: string[];
}
```

- `counts.groups` = number of nodes with `type === 'group'`.
- `groups` = one entry per `type === 'group'` node; `label` via `nodeTitle`; `collapsed` from
  `node.collapsed === true`; `memberCount` = `descendantIdsOf(group.id).size` (nesting-aware).
- `titles` = one `{ id, type, label }` per node (`type` defaults to `'default'` when unset; `label` via
  `nodeTitle`). This is the compact substitute for a whole-board `get_nodes` dump — **no** `data`,
  `style`, `measured`, or `position`. **Uncapped**: these are short strings; for full node data the agent
  uses `get_state` (optionally scoped).
- `bounds` = `getNodesBounds(allNodes)`; `null` when there are no nodes. Gives the agent the canvas
  extent (complements #18's clamp signal).
- `collapsedHiddenIds` = the same global hidden set as `get_state`, included here so the digest alone
  conveys what the human can't see.

### History

Both tools are read-only — not added to `MUTATING_TOOLS`, no history capture, no `flow.state` emission.

## Tool schema changes (`tool-schemas.ts`)

- `get_state`: add `groupId?: string` and `bounds?: { x, y, width, height }` to inputSchema (document
  the xor + the new `collapsedHiddenIds` return key + that scoping is by group subtree or rect).
- `get_summary`: new schema entry (params: `flowId?` only); description explains it's a compact digest
  for large boards and lists the return fields.

## Out of scope

- Edge labels in the digest (`counts.edges` conveys edge volume; YAGNI).
- Per-type count breakdowns beyond `groups` (the `titles` array already carries each node's `type`).
- Caps/truncation on `titles` (small strings; scoped `get_state` is the drill-in path).
- Changing `get_nodes`/`get_edges` (left as the full-array reads they are).

## Testing (TDD)

**`@angflow/angular` service spec:**
- `getCollapsedHiddenIds()` returns `[]` with nothing collapsed; returns the nesting-aware descendant
  ids after a group is collapsed (e.g. `setNodeCollapsed(group, true)`).

**`@angflow/angular` bridge spec** (uses the existing `setup()` / `newFlow()` / `makeNode` harness):
- `get_state` includes `collapsedHiddenIds`: `[]` normally; populated after a group node is collapsed.
- `get_state({ groupId })`: returns only that group's nesting-aware descendants + induced edges; the
  group node itself is excluded; unknown `groupId` → `-32602`.
- `get_state({ groupId, bounds })` (both) → `-32602`.
- `get_state({ bounds })`: returns nodes intersecting the rect + induced edges; a far-away node is
  excluded.
- `get_summary`: `counts` correct; `groups` lists only `type==='group'` with nesting-aware
  `memberCount` and `collapsed`; `titles` uses `data.label` when present and falls back (type/id) when
  not; `bounds` reflects all nodes (and is `null` for an empty flow); `collapsedHiddenIds` matches
  `get_state`'s.
- Neither tool captures a history entry.

## Closeout

- Update `packages/angular/AGENT_BRIDGE.md`: add `get_summary` to the Discovery/read table; update the
  `get_state` row (new params + the `collapsedHiddenIds` return key) and add a short note describing the
  digest shape + scoping.
- Regenerate the `@angflow/mcp` schema snapshot (`pnpm -F @angflow/mcp run generate:schemas`); the drift
  test gates CI.
- Publish: `@angflow/angular` patch → `@angflow/mcp` patch. (`@angflow/system` unchanged this unit.)
- Mark feedback #17 ✅ with the commit/PR reference.
