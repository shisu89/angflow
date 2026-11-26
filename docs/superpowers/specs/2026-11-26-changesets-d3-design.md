# D3 — NodeChangeset / EdgeChangeset (upstream 1.0 changes API)

Status: design, 2026-11-26. Part of the upstream 1.0 reconciliation (roadmap D, third slice).
Report: `docs/reviews/2026-11-24-upstream-sync.md` §3 ("`onNodesChange` / `onEdgesChange` receive a
`NodeChangeset` / `EdgeChangeset` class", upstream #5944).

## Goal

Match upstream xyflow 1.0's changes API fully. That means the change types, the creators, the
`Changeset` classes and `applyNodeChanges(nodes, changeset)`. As a result, `(nodesChange)` and
`(edgesChange)` emit a `NodeChangeset` / `EdgeChangeset`, and apps write `changes.applyTo(nodes)`.
The breaking-change policy is **match upstream fully**, with no aliases.

## Decisions (brainstorm 2026-11-26)

1. `updateNode` / `updateNodeData` / `updateEdge` / `updateEdgeData` emit upstream's new
   `'update'` / `'data'` change types, as Svelte Flow 1.0 does. They no longer emit a full `'replace'`.
2. `'add'` changes append, as upstream does. `applyTo` ignores `index` and the diff no longer sets it.
3. The angflow-only `applyDimensionChanges` becomes `applyDimensionChanges(nodes, changeset)`, using
   the same argument order and input type as upstream's `applyNodeChanges`.

## Upstream reference (upstream/main 9635a064f)

`packages/system/src/changes/`:
- `types.ts`: `NodeChange`, `EdgeChange`, `DimensionChange`, `PositionChange`, `SelectionChange`,
  `RemoveChange`, `AddChange` (now carries `id`), `ReplaceChange`, `UpdateChange` and `DataChange`.
- `create.ts`: `selectionChange`, `positionChange`, `dimensionChange`, `removeChange`, `addChange`,
  `replaceChange`, `updateChange` and `dataChange`.
- `index.ts`: `Changeset`, `NodeChangeset` and `EdgeChangeset`.
- `apply.ts`: `applyNodeChanges(nodes, changeset)` and `applyEdgeChanges(edges, changeset)`.
- `utils.ts`: `getSelectionChanges` and `getDeselectionChanges`.

Upstream removed `changes.test.ts` (9b421bfc3), so angflow writes its own suite.

Semantics of the new apply, which differ from angflow today:
- **`remove` wins** whatever its position in the batch. Today the last remove or replace overwrites
  any earlier changes for that id.
- **`replace` does not short-circuit.** It resets the element to `item`, and the changes after it in
  the batch apply on top.
- **An `add` for an id that already exists is ignored**, so the existing element is kept. Today a
  duplicate is pushed.
- **Adds append**; `index` is ignored.
- **Changes are grouped per element** in the order they were added, and elements keep their array
  order.

## Design

### @angflow/system

- Add `src/changes/{types,create,index,apply,utils}.ts` as verbatim ports, with `.js` import
  suffixes as the repo uses, and export them from `src/index.ts` as upstream does.
- **Kept divergence.** Port `DimensionChange.initial?: boolean` with its existing
  "DELIBERATE DIVERGENCE" comment. It is the only difference from upstream in the module.
- Delete `src/types/changes.ts` and remove its re-export from `types/index.ts`. The old names
  (`NodeDimensionChange`, `NodePositionChange`, `NodeSelectionChange`, `NodeRemoveChange`,
  `NodeAddChange`, `NodeReplaceChange`, `EdgeSelectionChange`, `EdgeRemoveChange`, `EdgeAddChange`,
  `EdgeReplaceChange`) go away, as upstream.
- Add a new `src/changes/changes.spec.ts` to cover:
  - `add`, `remove` and the iterator order;
  - `getByType`, `getForElement`, `removeForElement`, `clear`, `isEmpty`, `toArray` and `getNewElements`;
  - each apply rule listed above;
  - `'update'` / `'data'` (merge and replace);
  - `setAttributes`.

### @angflow/angular

- **`utils/changes.ts`:**
  - Delete the local `applyNodeChanges`, `applyEdgeChanges`, `createSelectionChange`,
    `getSelectionChanges` and `elementToRemoveChange`. Internal callers use the system versions
    (`selectionChange`, `getSelectionChanges`, `getDeselectionChanges` where it fits, and `removeChange`).
  - Keep `getElementsDiffChanges`, rewritten to match React's `utils/changes.ts`: creators, no `index`,
    and `replaceChange({ ...item })` / `addChange({ ...item })`.
  - Keep `applyDimensionChanges(nodes, changeset)`. It reads `changeset.getByType('dimensions')`.
- **Public API.**
  - Re-export from `@angflow/system`: `NodeChangeset`, `EdgeChangeset`, `applyNodeChanges`,
    `applyEdgeChanges`, the creators and the new type names, matching React's `index.ts` list.
  - `OnNodesChange` / `OnEdgesChange` take a `NodeChangeset<NodeType>` / `EdgeChangeset<EdgeType>`.
- **`FlowStore.triggerNodeChanges` / `triggerEdgeChanges`:**
  - Keep the array input and the array-based middleware. Upstream React's
    `onNodesChangeMiddlewareMap` is also array-based.
  - After the middleware runs, build the changeset once (`new NodeChangeset(changes)`) and apply it
    with `changeset.applyTo(...)`, replacing the old function.
  - Emit the same instance through `onNodesChange`.
  - The position-only fast path stays and also emits a changeset.
  - angflow applies before emitting, as React does, so clearing the changeset in the handler cannot
    cancel it. That Svelte-only behaviour is documented as not applying here.
- **`ng-flow.component.ts`:** `nodesChange = output<NodeChangeset<NodeType>>()` and
  `edgesChange = output<EdgeChangeset<EdgeType>>()`.
- **`NgFlowService`:**
  - `updateNode(id, u)` emits `updateChange(id, partial)`.
  - `updateNodeData(id, d)` emits `dataChange(id, partial)` (a merge).
  - The edge versions mirror these.
  - The updater-function forms compute the partial first.
  - `addNodes` / `addEdges` use `addChange`.
  - `deleteElements`-style removals use `removeChange`.
- **Agent bridge:** no tool or schema change. It drives the store through `NgFlowService`. Check that
  its history and undo snapshots still work when updates arrive as `'update'` instead of `'replace'`.
  The mcp snapshot is expected to stay unchanged.

### Examples, tests and docs

- **Examples.** Migrate every `examples/angular` handler (about 55 files) to
  `this.nodes.update((ns) => changes.applyTo(ns))`. The generic test pages are angflow-owned, so
  they are edited too. Handlers that inspect changes switch to `getByType(...)`, or iterate with
  `for…of`.
- **Specs** (about 8 files) that build arrays or call `applyNodeChanges(changes, nodes)` are updated.
- **Docs:**
  - `packages/angular/CHANGELOG.md` gets a "#### Changesets (D3)" breaking block with:
    - a before/after snippet;
    - the type-rename table;
    - the apply-semantics differences above;
    - the `updateNode` → `'update'` note, for consumers that journal `'replace'`.
  - `packages/system/CHANGELOG.md`.
  - The README "controlled mode" snippets.
  - `AGENT_BRIDGE.md` only if a code path there changes.
  - The upstream-sync report gets D3 rows and results.

## Out of scope

- `updateNodeData(..., { replace })` options parity. It is not in angflow today and goes to E.
- `changeParent` and other E items.

## Verification

- Every package's unit tests pass, and `tsc`, typecheck and lint are clean.
- Both example builds and the examples' `ng test` pass.
- The mcp snapshot is unchanged, and the never-edit, drift and codespell checks pass.
- The shared e2e verdict is OK with 0 known failures.
- A `grep` for the old type names and the `applyNodeChanges(changes,` argument order is empty
  outside reference copies.
- Manual check in a browser: drag, select, resize, connect and delete on the overview and
  controlled examples.
