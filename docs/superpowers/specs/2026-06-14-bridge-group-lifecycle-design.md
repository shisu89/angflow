# Bridge group / container lifecycle + server-minted ids (feedback #14)

**Date:** 2026-06-14
**Roadmap:** unit 3 of [agent-bridge parity roadmap](./2026-06-13-agent-bridge-parity-roadmap.md).
**Feedback:** `brainstorm_agentic_app/docs/angflow-feedback.md` #14 — the bridge has graph CRUD,
selection, viewport, `apply_changes`, group-aware `layout_nodes`, and undo/redo, but **no group verbs**.
To build a container an agent must add a `type:'group'` node, reparent each child, set `collapsed`, and
size the box itself. Also: every tool requires an agent-supplied `id`, a collision/retry risk over a
transport.

## Problem

Grouping is only expressible as low-level `parentId` edits plus manual box sizing and coordinate
conversion. There is no `group_nodes` / `set_node_group` / `set_group_collapsed` / `dissolve_group` /
`get_group_bounds`. And `add_node` (like every mutating tool) requires the agent to invent a unique
`id`; over a transport an id collision means a failed call and a retry.

The Angular layer already has the primitives: `NgFlowService.updateNode` (reparent via `parentId`),
`getAbsolutePosition`, `setNodePositions({ coordinateSpace: 'absolute' })`, `sizeGroupToChildren`,
`setNodeCollapsed`, and the pure `getGroupBounds(members, opts)`. This unit composes them into group
verbs on the service and exposes them through the bridge.

## Goal

1. First-class group lifecycle bridge tools: `group_nodes`, `set_node_group`, `set_group_collapsed`,
   `dissolve_group`, `get_group_bounds`.
2. Server-minted ids: `add_node` and `group_nodes` mint a unique id when the agent omits one.

All reparenting is **visually stable** — a node keeps its on-screen (absolute) position when grouped,
re-grouped, or ungrouped; only its stored parent-relative `position` changes.

## Design

### New `NgFlowService` methods

The non-trivial coordinate logic lives in the service (reusable beyond the agent, unit-testable). Each
mutation captures absolute positions **before** changing `parentId`, then re-bases via
`setNodePositions(map, { coordinateSpace: 'absolute' })` so members stay visually pinned (the same
combined-absolute-map technique `sizeGroupToChildren` already uses).

```ts
/** Create a group node wrapping the given nodes; reparent + pin them. Returns the group id. */
groupNodes(nodeIds: string[], opts?: {
  groupId?: string;        // caller-supplied id; minted by the bridge when omitted
  label?: string;          // → group node data.label
  collapsed?: boolean;     // → group node collapsed
  padding?: number;        // box inset, default 20
  headerHeight?: number;   // top inset for the title bar, default 40
}): Promise<string>;

/** Reparent one node into a group (or detach to top-level when null), visually stable. */
setNodeGroup(nodeId: string, groupId: string | null): Promise<void>;

/** Remove a group node; its direct children survive, reparented to the group's own parent. Returns freed ids. */
dissolveGroup(groupId: string): Promise<string[]>;

/** Current rendered box of a group: absolute top-left + measured (or width/height) size. null if absent. */
getGroupBox(groupId: string): { x: number; y: number; width: number; height: number } | null;
```

**`groupNodes` algorithm:**
1. Resolve each `nodeId` to its internal node; capture `abs[id] = getAbsolutePosition(id)` and size
   (`measured ?? width ?? 0`).
2. `box = getGroupBounds(membersWithAbsPositions, { padding, headerHeight })` (absolute box).
3. `addNodes({ id: groupId, type: 'group', position: box.position, width: box.width, height: box.height,
   data: { label }, collapsed })`.
4. For each member: `updateNode(id, { parentId: groupId })`.
5. `setNodePositions({ [groupId]: box.position, ...abs }, { coordinateSpace: 'absolute', animate: false })`
   — re-bases each member relative to the group's new position; members stay visually pinned.

**`setNodeGroup` algorithm:** capture `abs = getAbsolutePosition(nodeId)`; `updateNode(nodeId,
{ parentId: groupId ?? undefined })`; `setNodePositions({ [nodeId]: abs }, { coordinateSpace:
'absolute', animate: false })`. Cycle guard: throw if `groupId === nodeId` or `groupId` is a descendant
of `nodeId`.

**`dissolveGroup` algorithm:** find direct children (`parentId === groupId`); capture their absolute
positions; resolve the group's own `parentId` (`newParent`); for each child `updateNode(child,
{ parentId: newParent })`; delete the group node (`deleteElements({ nodes: [{ id: groupId }] })`);
`setNodePositions(childAbs, { coordinateSpace: 'absolute', animate: false })`. Return the child ids.

**`getGroupBox`:** `node = getNode(groupId)`; if absent return `null`; `pos = getAbsolutePosition(groupId)`;
`internal = getInternalNode(groupId)`; `width = internal?.measured?.width ?? node.width ?? 0` (same for
height). Returns `{ x: pos.x, y: pos.y, width, height }`.

### Bridge tools (`agent-bridge.service.ts`)

| Tool | Params | Returns | Notes |
|---|---|---|---|
| `group_nodes` | `nodeIds: string[]`, `label?: string`, `collapsed?: boolean`, `groupId?: string`, `padding?: number`, `headerHeight?: number` | `{ groupId }` | Mints `groupId` when omitted; mutating |
| `set_node_group` | `nodeId: string`, `groupId: string \| null` | `{ nodeId, groupId }` | `null` detaches to top-level; mutating |
| `set_group_collapsed` | `groupId: string`, `collapsed: boolean` | `{ groupId, collapsed }` | wraps `setNodeCollapsed`; mutating |
| `dissolve_group` | `groupId: string` | `{ dissolvedGroupId, memberIds }` | mutating |
| `get_group_bounds` | `groupId: string` | `{ x, y, width, height } \| null` | read-only |

`get_group_bounds` returns the group's **current** box on the canvas (where it is now), not a recomputed
wrap of its children.

### Server-minted ids

```ts
// instance method on the bridge; counter is a private field
private mintId(flow: NgFlowService, prefix: string): string {
  let id: string;
  do { id = `${prefix}_${++this.nextNodeIdSeq}`; } while (flow.getNode(id));
  return id;
}
```

- `add_node`: `node.id` becomes optional. When missing or empty, mint `node_*` and inject it into the
  payload **before** `validateNodeShape`. The created `Node` (with the id) is returned as today.
- `group_nodes`: `groupId = params.groupId ?? mintId(flow, 'group')`.
- Collision-safe against agent-supplied ids (the `while (flow.getNode(id))` loop skips taken ids).
  Dependency-free — no `crypto`/`Math.random` (keeps the zoneless/SSR story clean and tests
  deterministic-enough: assert the returned id exists, not its exact value).
- `apply_changes` `add_node`/`add_nodes` ops still require ids (batch minting is out of scope).

### Validation / errors (`-32602`)

- `group_nodes`: `nodeIds` missing / not a string array / empty → `-32602`; any unknown id → `-32602`.
- `set_node_group`: unknown `nodeId` → `-32602`; `groupId` neither `null` nor an existing node id →
  `-32602`; cycle (target is the node itself or its descendant) → `-32602`.
- `set_group_collapsed` / `dissolve_group` / `get_group_bounds`: missing/unknown `groupId` → `-32602`.
- Targets need only **exist** — not strictly be `type:'group'` (lenient, consistent with #17's
  `groupId` scoping). A non-group target simply has no/auto box behavior.

### History

`group_nodes`, `set_node_group`, `set_group_collapsed`, `dissolve_group` are added to `MUTATING_TOOLS`
so each is one undoable step. `get_group_bounds` is read-only (no capture). The mutating group tools are
async (`setNodePositions`); `dispatch` already awaits the handler before committing the history snapshot.

### Coordinate correctness

Every reparent path captures absolute positions before mutating `parentId` and re-bases with
`setNodePositions({ coordinateSpace: 'absolute' })`, so nodes never jump. `getGroupBounds` is fed
absolute member positions and returns an absolute box (consistent space). Nesting-aware via
`getAbsolutePosition` (walks the `parentId` chain).

## Out of scope

- Batch id minting inside `apply_changes`.
- Enforcing `type:'group'` on targets (lenient by design).
- Auto-resizing a group as its children move later (that's the existing `sizeGroupToChildren` / the
  app's declarative recompute; the bridge sizes once at `group_nodes` time).
- Recomputed-wrap variant of `get_group_bounds` (returns the current box).

## Tool schema changes (`tool-schemas.ts`)

- Add five entries: `group_nodes`, `set_node_group`, `set_group_collapsed`, `dissolve_group`,
  `get_group_bounds`.
- `add_node`: drop `id` from the `node` object's `required` array (it stays in `properties`); update the
  description to note an id is minted + returned when omitted.

## Testing (TDD)

**`NgFlowService` service spec:**
- `groupNodes`: creates a `type:'group'` node; members get `parentId === groupId`; each member's absolute
  position is unchanged (visually pinned) before/after; box wraps members with padding/header.
- `setNodeGroup(node, group)`: node reparented, absolute position preserved; `setNodeGroup(node, null)`
  detaches (parentId cleared), absolute preserved.
- `setNodeGroup` cycle: grouping a node into its own descendant throws.
- `dissolveGroup`: group node removed; children survive with parentId = group's old parent (top-level
  here); children's absolute positions preserved; returns the child ids.
- `getGroupBox`: returns absolute box for an existing group; `null` for unknown id.

**Bridge spec** (existing `setup()` / `newFlow()` / `makeNode` harness; no panZoom needed — these are
node-model ops):
- `group_nodes` returns a `{ groupId }`, creates the group, reparents members; minted id is unique and
  present in the flow; `groupId` honored when supplied.
- `add_node` with no `id` mints one (returned node has a non-empty `node_*` id and exists); with an id,
  honors it.
- `set_node_group` reparents / detaches; unknown ids and cycles → `-32602`.
- `set_group_collapsed` flips `collapsed` (and `get_state.collapsedHiddenIds` reflects it).
- `dissolve_group` removes the group, returns member ids, members survive.
- `get_group_bounds` returns a rect for a group, `null` for unknown; does not capture history.
- Each mutating group tool captures exactly one history entry (undo restores prior state).

## Closeout

- Update `packages/angular/AGENT_BRIDGE.md`: a new "Groups" subsection in the tool catalog (the five
  tools), and note `add_node`'s id is now optional (minted + returned when omitted).
- Regenerate the `@angflow/mcp` schema snapshot (`pnpm -F @angflow/mcp run generate:schemas`) — tool
  count 52 → 57; drift test gates CI.
- Publish: `@angflow/angular` patch → `@angflow/mcp` patch. (`@angflow/system` unchanged this unit.)
- Mark feedback #14 ✅ with the commit/PR reference.
