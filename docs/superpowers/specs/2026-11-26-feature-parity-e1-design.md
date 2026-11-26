# E1 — API parity and deferred bugs

Status: design, 2026-11-26. Part of the upstream 1.0 reconciliation, roadmap E. E is split into three parts:
- E1: API parity and bugs (this spec);
- E2: missing React examples, plus a DevTools example;
- E3: the #5996 perf subset with #6109.

Report: `docs/reviews/2026-11-24-upstream-sync.md` §4. The react appendix rows are #18 (`changeParent`) and #22 (`useNode` / `useEdge`).

## Goal

Close the remaining instance and hook gaps with upstream React 13 / Svelte 1.0, and fix the two bugs D1 deferred. The breaking-change policy is **match upstream fully**.

## Decisions (brainstorm 2026-11-26)

1. **Updater argument.** When `updateNodeData` / `updateEdgeData` get an updater function, it receives the **node / edge**, as upstream does. It no longer receives the `data` object.
2. **`{ replace }` option.** It is added to `updateNode` / `updateNodeData` / `updateEdge` / `updateEdgeData`.
3. **`changeParent`.** Add `changeParent(nodeId, parentId | null)` as upstream has it. `setNodeGroup` delegates to it and keeps its own guards and its `Promise` return.

## Design

### 1. Selectors: `selectNode`, `selectEdge`, `selectInternalNodes`

`NgFlowService` gains three signal selectors. They are the equivalents of React's `useNode(id)`, `useEdge(id)` and `useInternalNodes(ids)`; `selectInternalNode` already covers `useInternalNode`.

- `selectNode(id): Signal<NodeType | undefined>`. This is a `computed` over `store.nodes()` that returns the user node object. Default `Object.is` equality means consumers are notified only when that node object changes.
- `selectEdge(id): Signal<EdgeType | undefined>`. The same, over `store.edges()`.
- `selectInternalNodes(ids: readonly string[]): Signal<InternalNode<NodeType>[]>`.
  - The ids go into a `Set`, and the result follows the order of the given ids. Ids that don't exist are skipped.
  - An empty `ids` returns `[]`.
  - It uses a custom `equal` (same length, and the same element at each index) so an unrelated node change doesn't notify.
  - It tracks `store.version()`, as `selectInternalNode` does.
- **`selectInternalNode`'s equality.** Check whether it notifies on every `version` bump. If it does, add the same identity `equal`; it is already "Equivalent to React's `useInternalNode()`". Record what it did before and after.
- Add the new selectors to `NgFlowInstance` only if the instance type already lists `select*` members. Otherwise they stay as service methods, as the existing `select*` ones are.

### 2. Update APIs (React `types/instance.ts`, Svelte `useSvelteFlow`)

The signatures follow React's `types/instance.ts`:

```ts
updateNode(id, nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>), options?: { replace: boolean }): void
updateNodeData(id, dataUpdate: Partial<NodeType['data']> | ((node: NodeType) => Partial<NodeType['data']>), options?: { replace: boolean }): void
updateEdge(id, edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>), options?: { replace: boolean }): void
updateEdgeData(id, dataUpdate: Partial<EdgeType['data']> | ((edge: EdgeType) => Partial<EdgeType['data']>), options?: { replace: boolean }): void
```

The emitted changes follow Svelte 1.0's `useSvelteFlow.updateNode` / `updateEdge`, since angflow already routes updates through changesets as Svelte does.

- **`updateNode`:**
  - With `replace: true` and a full node (`isNode`), it emits `replaceChange(nextNode)`.
  - Otherwise it splits `{ position, data, ...rest }`:
    - a `positionChange` when the position actually differs;
    - a `dataChange(id, data, true)` when `data` is present and differs by reference;
    - an `updateChange(id, rest)` when `rest` has keys.

  As a result, `getByType('position')` now sees moves made through `updateNode`; D3's final review raised this.
- **`updateNodeData`:** the updater gets the node. It emits `dataChange(id, nextData, true)` when `replace` is set, and otherwise a merging `dataChange(id, nextData)`.
- **`updateEdge` / `updateEdgeData`:** the same, without a position.
- **Unchanged:**
  - An unknown id still returns early.
  - A key set to `undefined` in `rest` still clears that field, through `updateChange`. This keeps `setNodeGroup`'s detach working.
- **Update the types:** `NgFlowInstance` (`types/general.ts`), the `NgFlowService` signatures, and every internal caller. The agent bridge calls `updateNodeData(id, patch)` with an object, which is unaffected.
- **Examples / specs.** Callers that use the function form with a `data` argument change to `(node) => …node.data…`.

### 3. `changeParent` (#5939, system helper 8843870d5)

- **System.** Port `changeParentNode` (`packages/system/src/utils/subflows.ts`) verbatim, and add `export * from './subflows'` to `utils/index.ts`.
- **`NgFlowService.changeParent(nodeId, parentId: string | null): void`.** It calls `changeParentNode(nodeId, store.nodeLookup, parentId, store.nodeOrigin(), ({ nodeId, parentId, x, y }) => this.updateNode(nodeId, { parentId: parentId ?? undefined, position: { x, y } }))`. That is one synchronous `updateNode`, so the changeset holds one update change and one position change.
- **`setNodeGroup(nodeId, groupId)`:**
  - It keeps its guards: the node exists, the group exists, and the agent bridge's cycle check stays where it is.
  - It keeps its `async … Promise<void>` signature, so its callers and the agent tool are unchanged.
  - Its body becomes `this.changeParent(nodeId, groupId)`.
  - **Behaviour change:** the node is reparented in one batch, without a `setNodePositions` animation step. The position is origin-corrected the upstream way.
  - **Verify:** a spec checks that the node's absolute position is unchanged after a reparent, including with a non-zero `nodeOrigin` and with a nested parent. The agent `set_node_group` specs must stay green.
- `changeParent` is added to `NgFlowInstance`.

### 4. Bug: `connectionInProgress` is never passed to pan/zoom

- **The bug.** `NgFlowComponent.updatePanZoomOptions()` doesn't pass `connectionInProgress`. As a result, the system filter's "no pinch-zoom or pan while connecting" rule (`xypanzoom/filter.ts`) never applies in angflow. React passes `connection.inProgress` (`ZoomPane`).
- **The fix.** Pass `connectionInProgress: this.store.connection().inProgress`, or angflow's equivalent signal, and make sure the effect that calls `updatePanZoomOptions()` re-runs when it changes.
- **Spec.** While a connection is in progress, the filter rejects a non-wheel event, and it accepts the event again after the connection ends.

### 5. Bug: the context menu with right-click panning

- **The bug.**
  - Upstream XYPanZoom emits `onPaneContextMenu` itself on a right-button click without a drag, when `panOnDrag` includes `2` (`eventhandler.ts`). React's pane swallows the native `contextmenu` in that mode, so a right-drag pan doesn't also open the menu.
  - angflow never passes `onPaneContextMenu` to XYPanZoom. Its pane emits `(paneContextMenu)` on every native `contextmenu`, including at the end of a right-drag pan.
- **The fix,** matching React's `Pane.onContextMenu` and `ZoomPane`:
  - The pane's `(contextmenu)` handler calls `preventDefault()`. When `panOnDrag` is an array that includes `2`, it returns without emitting.
  - Pass `onPaneContextMenu` to the XYPanZoom init and `update()`. It goes through the same component method, so the click-to-connect cancel still runs, and it emits `(paneContextMenu)`.
- **Spec.** With `panOnDrag=[2]`:
  - a right-click without moving emits once;
  - a right-drag pan emits nothing;
  - with the default `panOnDrag`, a right-click emits once, as today.

## Docs

- **`packages/angular/CHANGELOG.md`** gets an "#### API parity (E1)" block under the unreleased 0.4.0 entry:
  - **Breaking:** the updater argument, with a before/after snippet.
  - **New:** `{ replace }`, `changeParent`, `selectNode` / `selectEdge` / `selectInternalNodes`.
  - **Behaviour:** `updateNode` now emits separate `'position'` / `'data'` / `'update'` changes; `setNodeGroup` reparents in one batch.
  - **Fixed:** the two bugs.
- **`packages/system/CHANGELOG.md`:** `changeParentNode`.
- **`packages/angular/README.md`:** document the new selectors and methods where the existing API sections list them.
- **`AGENT_BRIDGE.md`:** update it only if `set_node_group`'s observable behaviour changes, for example its change events or its timing.
- **Report:** mark the react appendix rows #18 and #22 present, mark the deferred-bug notes done, and add an "E1 results" section.

## Out of scope

- E2 and E3.
- Svelte-only APIs.
- An agent `change_parent` tool, because `set_node_group` already covers it.

## Verification

- Unit tests (system, angular, mcp), `tsc`, typecheck, lint and codespell pass.
- Both example builds and the examples' `ng test` pass.
- The mcp snapshot is unchanged, unless a tool description changes.
- The e2e verdict is OK with 0 known failures.
- Manual check in Chromium:
  - right-click and right-drag on a `panOnDrag=[2]` page;
  - `changeParent` on a subflow example keeps the node in place.
