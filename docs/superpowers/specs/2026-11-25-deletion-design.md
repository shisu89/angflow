# Sub-project C — deletion via `getElementsToRemove` (design)

Date: 2026-11-25. Roadmap: [`docs/reviews/2026-11-24-upstream-sync.md`](../../reviews/2026-11-24-upstream-sync.md) §2 (deletion row) and §5 row C.
Predecessor: sub-project B (pushed at `adbb7bcca`, unpublished; the user publishes once at the end of the roadmap).

## Goal

Every way of deleting elements in angflow behaves like upstream React Flow's `deleteElements`:

- deleting a parent deletes its descendants;
- `deletable: false` is respected, for nodes and edges;
- edges connected to deleted nodes are removed;
- `onBeforeDelete` can veto (`false`) **or narrow/replace the set** (return `{ nodes, edges }`);
- the delete callbacks fire once, in upstream's order.

## Starting point (verified 2026-11-25)

- System `getElementsToRemove` (`packages/system/src/utils/graph.ts:489`) is byte-identical to `upstream/main`, including #6074 and #6111 (both reverse-apply). **No system port is needed**; C is wiring in the Angular package.
- Five entry points, three separate implementations (keyboard, `NgFlowService`, the `apply_changes` op):

| Path | Where | Today |
|---|---|---|
| Keyboard delete | `key-handler.directive.ts` `handleDelete` | Filters `deletable`, adds connected edges (O(n·m) merge), no child cascade; emits the directive's own `nodesDelete`/`edgesDelete`/`deleteElements` outputs, then triggers changes |
| `NgFlowService.deleteElements` | `ng-flow.service.ts:748` | Ignores `deletable`, no child cascade; boolean `onBeforeDelete`; triggers edge then node changes, then store `onNodesDelete`/`onEdgesDelete`/`onDelete` |
| Controls delete button | `controls.component.ts:190` | Calls `NgFlowService.deleteElements` |
| Agent `delete_elements` tool | `agent-bridge.service.ts:718` | Calls `NgFlowService.deleteElements` |
| Agent `apply_changes` → `delete_elements` op | `agent-bridge.service.ts:~1367` | Synchronous `setNodes`/`setEdges` filter for rollback; bypasses `onBeforeDelete` (warns once); no `deletable`, no cascade |

- `dissolveGroup` (`ng-flow.service.ts:385`) depends on deletion **not** cascading: it deletes the group and keeps the children. It is also the `dissolve_group` agent tool (`tool-schemas.ts:206`, `agent-bridge.service.ts:683`, `AGENT_BRIDGE.md:164`).
- Today the keyboard path fires `<ng-flow>`'s delete outputs once: the directive emits its own outputs (`key-handler.directive.ts:197-202`), which the component re-emits (`ng-flow.component.ts:189-191`); it never calls the store callbacks. The service path fires them through the store callbacks (`ng-flow.component.ts:954-956`).
- `flow-history.service.ts` doesn't hook deletion (snapshot-based, explicit `commit`/`transaction`); no change needed there.
- `getElementsToRemove` semantics (match upstream; adopted as-is):
  - nodes with `deletable: false` are skipped **before** the cascade, and the cascade walks only deletable nodes. A non-deletable child of a deleted parent therefore survives with a dangling `parentId`, and its descendants are not reached;
  - edges connected to deleted nodes are removed only if they're deletable; a non-deletable connected edge survives with a dangling endpoint;
  - output nodes keep store order; the cascade reaches grandchildren;
  - an `onBeforeDelete` result of `false` deletes nothing, `true` deletes the matched set, an object is used verbatim (not validated).

## Decisions (2026-11-25)

| Question | Decision |
|---|---|
| Which paths | All of them share one implementation, as upstream. Agent `apply_changes` keeps its snapshot-rollback batch, but its `delete_elements` op uses the same element selection (cascade + `deletable`) by awaiting `getElementsToRemove` without the hook, still without `onBeforeDelete` |
| `onBeforeDelete` returning `{ nodes, edges }` | Adopt now. Boolean returns keep working, so it's additive |
| `dissolveGroup` | Reparent the children out of the group first, then delete the group. `onBeforeDelete` sees the group (and its connected edges) only. On veto, move the children back |
| Agent `delete_elements` cascade | Cascades like the UI. Tool description, `AGENT_BRIDGE.md` and the mcp snapshot are updated; the result lists every deleted id, cascaded children included |

## Design

### One implementation: `NgFlowService.deleteElements`

Rewritten to mirror upstream `useReactFlow().deleteElements` (`packages/react/src/hooks/useReactFlow.ts` on `upstream/main`):

```ts
const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove({
  nodesToRemove, edgesToRemove, nodes: store.nodes(), edges: store.edges(), onBeforeDelete: store.onBeforeDelete,
});
if (matchingEdges.length) { store.onEdgesDelete?.(matchingEdges); store.triggerEdgeChanges(removeChanges(matchingEdges)); }
if (matchingNodes.length) { store.onNodesDelete?.(matchingNodes); store.triggerNodeChanges(removeChanges(matchingNodes)); }
if (matchingNodes.length || matchingEdges.length) store.onDelete?.({ nodes: matchingNodes, edges: matchingEdges });
return { deletedNodes: matchingNodes, deletedEdges: matchingEdges };
```

- Callback order changes to upstream's: each `on*Delete` fires **before** its changes are applied (today: after). Release note.
- `DeleteElementsOptions` accepts `{ id }`-only stubs, as today (the agent and `dissolveGroup` pass stubs); `getElementsToRemove` matches by id.
- Empty input or nothing matching: no callbacks, no changes, `{ deletedNodes: [], deletedEdges: [] }`.

### Keyboard delete

`key-handler.directive.ts` `handleDelete` becomes `void this.flow.deleteElements({ nodes: selectedNodes, edges: selectedEdges })` (upstream `useGlobalKeyHandler`), with `flow = inject(NgFlowService)`. There's no injection cycle: `NgFlowService` is provided in `<ng-flow>`'s `providers` (`ng-flow.component.ts:127-140`) and injects only `FlowStore`, `DestroyRef` and `DOCUMENT`. The publicly exported standalone `KeyHandlerDirective` (`public-api.ts:46`) now requires `NgFlowService` in its injector; changelog note.

**Both** the directive's own `nodesDelete`/`edgesDelete`/`deleteElements` outputs **and** their template bindings in `ng-flow.component.ts` (~:189-191) are removed in the same commit — leaving either behind double-fires, because the service path already emits through the store callbacks. `<ng-flow>`'s public `(nodesDelete)`/`(edgesDelete)`/`(delete)` outputs fire exactly once per deletion; a test asserts it.

After a keyboard delete, `nodesSelectionActive` is cleared, as upstream does.

### Controls button

Same call site. Its own `deletable` pre-filter is dropped (the shared implementation does it), and `deleteClick` keeps emitting the actually-deleted set.

### `onBeforeDelete` type

Angular's exported `OnBeforeDelete<NodeType, EdgeType>` (`packages/angular/src/lib/types/general.ts:114`) widens from `=> boolean | Promise<boolean>` to `=> boolean | { nodes: NodeType[]; edges: EdgeType[] } | Promise<boolean | { nodes: NodeType[]; edges: EdgeType[] }>`, matching system `OnBeforeDeleteBase` (`packages/system/src/types/general.ts:392`). The `<ng-flow>` input and `FlowStore.onBeforeDelete` use it. Docs on the input describe both forms.

`matchingEdges` (and therefore `(edgesDelete)` / `(delete)` payloads) includes the edges removed because they connect to deleted nodes.

### `dissolveGroup`

1. Capture each child's raw `{ parentId, position, extent }` and its absolute position, plus the new parent's absolute position (as today the capture happens while the group exists).
2. Reparent in **one** batch, writing raw values (no clamping pass): `parentId: group.parentId`, `position: childAbs − newParentAbs` (or `childAbs` when the group was top-level). A child with `extent: 'parent'` whose new parent is `undefined` gets `extent` cleared (it would otherwise raise error005); under a grandparent it keeps `extent: 'parent'` and the grandparent's clamp applies, as it would today. `expandParent` side effects on the grandparent are accepted.
3. `deleteElements({ nodes: [{ id: groupId }] })`. The cascade finds no children; `onBeforeDelete` sees the group plus its connected edges.
4. If `deletedNodes` does **not** contain `groupId` (veto, a narrowing `onBeforeDelete` that kept the group, or a `deletable: false` group), restore every child's captured raw `{ parentId, position, extent }` in one batch — raw writes, not `setNodePositions`, so nothing re-clamps — and return `[]`.
5. Otherwise return the child ids.

The intermediate reparent is observable through `(nodesChange)`; accepted and documented. The `dissolve_group` agent tool inherits this; its description needs no change, and its `AGENT_BRIDGE.md` row gains the veto-restore note.

### Agent tools

- `delete_elements` tool: no code change beyond the shared implementation. Its description in `tool-schemas.ts` (~:267) is corrected — it currently says "Returns { deletedNodes, deletedEdges }" but the handler returns `{ deletedNodeIds, deletedEdgeIds }` — and says deletion cascades to descendants, skips `deletable: false`, and that the ids list everything actually deleted. `AGENT_BRIDGE.md` and the mcp snapshot are updated in the same commit.
- `apply_changes` → `delete_elements` op: keeps bypassing `onBeforeDelete` (and its one-time warning). `applyOp` becomes `async` and the op does `await getElementsToRemove({ nodesToRemove, edgesToRemove, nodes: flow.getNodes(), edges: flow.getEdges() })` with no hook, then removes the result with the existing `setNodes`/`setEdges` filter. Rollback is snapshot-based, so awaiting is safe; without a hook `getElementsToRemove` only yields microtasks, so no user event can interleave mid-batch. No duplicated selection logic. The op result returns the actually-deleted ids (today it echoes the requested `nodeIds`, including unknown or non-deletable ones).

## Tests

Failing test first for each item (vitest; the upstream e2e suite has no deletion spec beyond the already-passing `deletable=false` ones, which must stay green).

- `deleteElements`: cascade (3 levels, child listed before parent), `deletable: false` node and edge, a non-deletable child of a deleted parent survives (orphaned, as upstream) and the store tolerates the missing parent (one warning, no throw), connected edges, `onBeforeDelete` `false` / `true` / `{ nodes, edges }` / async, callback order and once-only firing, stubs by id, empty input.
- Keyboard: selected parent with unselected children deletes all; `deletable: false` respected; outputs fire once; `onBeforeDelete` object return honoured; `nodesSelectionActive` cleared.
- Controls button: deletes the cascaded set; `deleteClick` payload is the deleted set.
- `dissolveGroup`: children survive at the same absolute positions under the group's parent; `extent: 'parent'` child of a top-level group loses `extent` and doesn't error; veto restores raw parent/position/extent; a narrowing `onBeforeDelete` that keeps the group restores; `deletable: false` group restores.
- Agent: `delete_elements` cascades and reports all ids; `apply_changes` op cascades, reports actually-deleted ids (unknown / non-deletable ids omitted), and rolls back on a later failing op.

## Release notes (append to the unreleased angular 0.3.22 entry; publish happens at the end of the roadmap)

- Behaviour: deleting a parent deletes its descendants (keyboard, Controls, `deleteElements`, agent tools).
- Behaviour: programmatic deletion now respects `deletable: false`.
- Behaviour: delete callbacks fire before their changes are applied (upstream order), once per deletion.
- Additive: `onBeforeDelete` may return `{ nodes, edges }`.
- `dissolveGroup` reparents children before deleting the group; a veto restores them.
- Behaviour: a non-deletable child of a deleted parent, or a non-deletable edge connected to a deleted node, survives with a dangling reference (upstream semantics).
- `KeyHandlerDirective` used standalone now requires `NgFlowService` in its injector.
- Agent: `delete_elements` (tool and `apply_changes` op) cascades; results list the actually-deleted ids. mcp snapshot regenerated; versions stay at the unpublished system 0.1.14 / angular 0.3.22 / mcp 0.0.4 (the snapshot is stamped 0.3.22 already).

## Non-goals

- `nodeClickDistance`, `(connectEnd)` payloads and the rest of the 1.0 API alignment: D.
- `onBeforeDelete` for `apply_changes`: still bypassed (rollback can't await it); unchanged warning.
- Undo/redo (`flow-history.service.ts`): snapshot-based, doesn't hook deletion; no change.

## Done when

- All five entry points go through `getElementsToRemove`; vitest suites, typecheck, lint green.
- Upstream e2e verdict unchanged (4 known failures, all D; 0 STALE).
- `AGENT_BRIDGE.md`, tool descriptions, mcp snapshot, changelogs and the report's §2 deletion row updated.
