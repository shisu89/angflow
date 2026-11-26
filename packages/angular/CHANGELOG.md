# @angflow/angular

## 0.4.0 *(unreleased)*

Requires `@angflow/system` 0.2.0. Contains the unreleased 0.3.22 bug-fix (B) and deletion (C) entries, plus the upstream 1.0 API alignment (D1), whose breaking changes come first.

### Breaking changes

Upstream `@xyflow/system` 1.0 / React 13 API alignment. Renamed and removed APIs have no deprecated aliases.

**Two changes compile silently:** `(connectEnd)` / `(clickConnectEnd)` handlers that read `$event.target` now get an object, and a numeric fit padding such as `0.1` now means 0px.

```ts
// 1. Handle bounds type
import { type SystemHandle } from '@angflow/angular';          // before
import { type HandleBounds } from '@angflow/angular';          // after (also new: NodeHandle)
readonly sourceHandle = input<HandleBounds | null>(null);

// 2. Connection queries
flow.getHandleConnections({ nodeId: 'a', type: 'source', id: 'h1' });   // before
flow.getNodeConnections({ nodeId: 'a', type: 'source', handleId: 'h1' }); // after
flow.getNodeConnections('a');                                           // before
flow.getNodeConnections({ nodeId: 'a' });                               // after
flow.selectHandleConnections({ nodeId: 'a', type: 'target' });          // before
flow.selectNodeConnections('a');                                        // before
flow.selectNodeConnections({ nodeId: 'a' });                            // after
flow.selectNodeConnections({ nodeId: 'a', type: 'target' });           // after
// type HandleConnection → NodeConnection. Agents: get_handle_connections → get_node_connections { nodeId, type?, handleId? }
```

```html
<!-- 3. nodeClickDistance is gone: clicks are suppressed only when a drag moved the node -->
<ng-flow [nodeClickDistance]="5" />          <!-- before -->
<ng-flow [nodeDragThreshold]="5" />          <!-- after: below the threshold it is a click -->

<!-- 4. Connection-end payloads -->
<ng-flow (connectEnd)="onEnd($event)" />     <!-- before: $event = MouseEvent | TouchEvent -->
<ng-flow (connectEnd)="onEnd($event.event, $event.connectionState)" />   <!-- after -->
<ng-flow (clickConnectEnd)="onClickEnd($event.event, $event.connectionState)" />

<!-- 5. Pane threshold -->
<ng-flow [paneClickDistance]="10" />         <!-- before: click tolerance, panning started at once -->
<ng-flow [paneDragThreshold]="10" />         <!-- after: no pan or marquee until 10px; default 1 -->
```

```ts
// 4b. `to` is in flow coordinates in (connectEnd), (clickConnectEnd), (reconnectEnd) and flow.connection()
const p = flow.screenToFlowPosition(state.to);   // before: `to` was pane/screen-relative
const p = state.to;                               // after   (state.pointer stays in screen coordinates)

// 6. Fits resolve boolean
const { zoom, clamped } = await flow.fitView();  // before
const ended = await flow.fitView(); const zoom = flow.getZoom();   // after (false = interrupted / not ready)

// 7. Fit padding: numbers are pixels now, default '5%'
flow.fitView({ padding: 0.1 });    // before: ≈4.5% per side. After: 0px
flow.fitView({ padding: '5%' });   // after. Legacy ≈ %: 0.1→4.5%, 0.2→8.3%, 0.5→16.7%, 1→25%, 2→33%
flow.fitBounds(rect, { padding: 40 });            // 40px per side
// Same for [fitViewOptions], <ng-flow-controls [fitViewOptions]> and the agent tools fit_view / fit_bounds.
// Padding left unset (fitView(), fitBounds(), [fitView]="true" with no [fitViewOptions].padding, the
// Controls fit button) changes default from legacy 0.1 (≈4.5% per side) to '5%': nearly identical framing.
```

```ts
// 8. FlowStore (public): click-connect end state
store.connection.set(state);                 // before: writable, screen-space `to`
store.updateConnection(state);               // after: `connection` is a read-only computed (flow `to`);
                                             //        `rawConnection` holds the screen-space state
const s = store.getFinalClickConnectionState();   // new: the payload (clickConnectEnd) emits
```

Behaviour notes for the same entry:

- `nodeClickDistance` removal also drops the exported `DragDirective`'s `ngFlowDragClickDistance` input.
- Jittery node clicks below `nodeDragThreshold` fire `(nodeClick)`. A drag's crossing move only starts the drag (upstream semantics), so the first move past the threshold doesn't move the node.
- A pane press below `paneDragThreshold` fires no `(moveStart)`/`(moveEnd)`.
- `(selectionStart)` fires when the marquee crosses the threshold, not on press.
- Click-connect no longer fires `(connectStart)`/`(connectEnd)`.
- Reconnect drags fire them, and `(reconnectStart)` waits for `connectionDragThreshold`.
- `FlowStore` (public): `connection` is read-only (new `rawConnection`), and `getFinalClickConnectionState()` is new; `paneDragThreshold` replaces `paneClickDistance`, and `nodeClickDistance` is gone; `fitView`/`fitBounds` resolve `boolean`.
- A press on an edge's reconnect anchor that doesn't start a drag no longer hides the edge.
- `(selectionEnd)` fires only after a marquee started.
- Programmatic viewport transitions still fire `(moveStart)`/`(moveEnd)` (this differs from upstream React).
- Crossing the marquee threshold doesn't reset the current selection: unlike upstream's Pane, angflow doesn't call `resetSelectedElements()` there.
- `[selectionOnDrag]` now applies only when the primary button does not pan (`!isLeftClickPan(panOnDrag)`), as upstream. With the default `panOnDrag=true` a plain drag pans and `selectionOnDrag` no longer draws a marquee; use `[panOnDrag]="[1, 2]"` (or hold the selection key).
- On a completing click, `isValid` / `toHandle` in the `(clickConnectEnd)` connection state come from angflow's click-to-connect preview line's nearest-handle snap. Upstream has no preview line, so its click-end state carries no such snap.
- Agent tools: `fit_view` / `fit_bounds` still return `{ zoom, clamped, ended }`; `padding` units are described in the tool schema (see `@angflow/mcp`).

#### Theming (D2)

Upstream 1.0 theming: colour mode follows the system / page by default, all CSS is in `@layer xyflow`.

**Silent change:** without `forceColorMode`, a flow on a dark-mode OS now renders dark.

**Silent change:** angflow's CSS is now in `@layer xyflow`, so an app's **unlayered** global reset (e.g. `* { margin: 0; padding: 0; box-sizing: border-box }`) beats it and strips node padding, panel margins and control-button padding. It compiles fine and only shows up visually. Upstream behaves the same way. Put the reset in a layer declared before xyflow:

```css
@layer reset, xyflow;                 /* declare the order first */
@import '@angflow/angular/style.css'; /* @import must precede every other rule */
@layer reset { * { margin: 0; padding: 0; box-sizing: border-box; } }
```

The examples app does exactly this in `examples/angular/src/styles.css`.

**Silent change:** the default look changed (set the variables below to restore the old one):

| Default | Before | After |
|---|---|---|
| Edge stroke / width | `#999` / 1.5 | `#b1b1b7` / 1 |
| Connection line stroke / width | `#555` / 2 | `#b1b1b7` / 1 |
| Flow background, light mode | `#fafafa` | transparent |
| Node, controls-button and edge-label text, light mode | `inherit` | `CanvasText` |
| Handle size | 8px | 6px |
| MiniMap background, light mode | `#f0f0f0` | `#fff` |

Dark mode also gets its own attribution background (`rgba(150, 150, 150, 0.25)`) and selection colours.

```html
<!-- 1. colorMode input -->
<ng-flow [colorMode]="'dark'" />             <!-- before -->
<ng-flow forceColorMode="dark" />            <!-- after (also [forceColorMode]="'dark'") -->

<!-- 2. 'system' is the default: omit the input -->
<ng-flow [colorMode]="'system'" />           <!-- before -->
<ng-flow />                                  <!-- after: follows prefers-color-scheme or <html data-theme> -->

<!-- 3. The old default was 'light'. To keep it: -->
<ng-flow forceColorMode="light" />
<!-- or, for the whole page: <html data-theme="light"> -->
```

```css
/* 4. Keep the old edge and connection-line look */
.xy-flow {
  --xy-edge-stroke: #999;
  --xy-edge-stroke-width: 1.5;
  --xy-connectionline-stroke: #555;
  --xy-connectionline-stroke-width: 2;
  --xy-background-color: #fafafa;   /* old light-mode flow background */
}
```

- `@layer xyflow`: CSS overrides that only beat angflow by specificity or order still win, and now win more reliably, because unlayered CSS beats any layer. An app that put angflow's CSS in its own layer must order its layers (`@layer base, xyflow, overrides;`).
- `base.css` now matches upstream's minimal `base.css`: no built-in node padding or width, no handle size or border, no control-button styling, and none of angflow's own colour rules (the hover / selected box-shadow on custom node types, the connection-target drop outline). It keeps system's base tokens (edge, background, minimap colours; node border `#bbb`, handle `#333`), as upstream's does. Apps that imported `base.css` and relied on the removed styles should import `style.css` instead; `xy-theme.css` builds on `base.css` and doesn't carry them either.
- Short export paths: `@angflow/angular/style.css`, `base.css` and `xy-theme.css`. The old `@angflow/angular/dist/style.css` and `dist/base.css` keep working.
- Browser floor: `light-dark()` needs Chrome/Edge 123, Firefox 120, Safari 17.5.

Then, the `ColorModeClass` export is removed (`ColorMode` is `'light' | 'dark'`).

#### Changesets (D3)

Upstream 1.0 changes API (#5944, 5ff09ef77, plus follow-ups): `(nodesChange)` / `(edgesChange)` emit a `NodeChangeset` / `EdgeChangeset` instead of an array. Renamed and removed APIs have no deprecated aliases.

**Compiles loudly only under strict templates:** with `strictTemplates` (or `strictOutputEventTypes`) a handler typed `(changes: NodeChange[])` no longer type-checks. Without it, `$event` is `any`, so a handler that calls `changes.filter(...)` still compiles and throws at runtime. Grep your `(nodesChange)` / `(edgesChange)` handlers. The apply-semantics differences below are silent either way.

```ts
// 1. Handlers
onNodesChange(changes: NodeChange[]) {                     // before
  this.nodes = applyNodeChanges(changes, this.nodes);
}
onNodesChange(changes: NodeChangeset<MyNode>) {            // after
  this.nodes = changes.applyTo(this.nodes);
}

// 2. Inspecting changes
for (const c of changes) { /* ... */ }                     // iterate (grouped per element)
changes.getByType('position');                             // typed per-type lists
changes.getForNode('a');                                   // EdgeChangeset: getForEdge(id)
changes.toArray();                                         // NodeChange[] when you need the array

// 3. Applying outside a handler
import { applyNodeChanges } from '@angflow/system';
nodes = applyNodeChanges(nodes, changeset);                // (nodes, changeset), not (changes, nodes)
nodes = changes.applyTo(nodes);                            // same thing
```

- `@angflow/angular` no longer exports `applyNodeChanges` / `applyEdgeChanges`. Use `changes.applyTo(nodes)`, or `applyNodeChanges(nodes, changeset)` / `applyEdgeChanges(edges, changeset)` from `@angflow/system`. There is no array overload.
- `OnNodesChange` / `OnEdgesChange` are `(changes: NodeChangeset<NodeType>) => void` (edges likewise), matching React. The store's `onNodesChange` / `onEdgesChange` take the changesets too.
- `@angflow/angular` re-exports only the change type names, `NodeChangeset` / `EdgeChangeset` and `applyDimensionChanges`, matching React's export list. The creators (`selectionChange`, `removeChange`, `addChange`, `updateChange`, `dataChange`, ...) and `getSelectionChanges` / `getDeselectionChanges` are importable from `@angflow/system`.
- The internal `createSelectionChange`, `getSelectionChanges`, `elementToRemoveChange` and `getElementsDiffChanges` helpers are gone and replaced by those system creators. (`getElementsDiffChanges` was never public and nothing called it, so it is deleted rather than rewritten.)
- `applyDimensionChanges(nodes, changeset)`: arguments swapped to match `applyNodeChanges`, and it takes a `NodeChangeset`. Semantics are unchanged: the last change per node wins, only `measured` is written, and the input reference is returned when nothing applies.

| Before | After |
|---|---|
| `NodeDimensionChange` | `DimensionChange` |
| `NodePositionChange` | `PositionChange` |
| `NodeSelectionChange` / `EdgeSelectionChange` | `SelectionChange` |
| `NodeRemoveChange` / `EdgeRemoveChange` | `RemoveChange` |
| `NodeAddChange<T>` / `EdgeAddChange<T>` | `AddChange<T>` |
| `NodeReplaceChange<T>` / `EdgeReplaceChange<T>` | `ReplaceChange<T>` |

`AddChange.id` is now required. `NodeChange` / `EdgeChange` also include the new `'update'` and `'data'` types.

Apply-semantics differences (upstream's apply):

- A `remove` wins wherever it sits in the batch.
- A `replace` no longer short-circuits later changes for that element.
- An `add` for an id that already exists is ignored.
- `add` changes append; `index` is ignored.
- Iteration groups changes by element (adds first), not in emission order.
- Nodes and edges added through `addNodes` / `addEdges` are stored by reference (the apply pushes the item as-is) rather than shallow-copied.

`updateNode` / `updateEdge` now emit an `'update'` change carrying only the partial (an updater function is resolved first), and `updateNodeData` / `updateEdgeData` emit a merging `'data'` change. They no longer emit a full `'replace'`. Journaling or undo consumers that matched `'replace'` from these APIs must handle `'update'` / `'data'`. A key set to `undefined` in `updateNode` still clears it (`Object.assign` copies own undefined properties), so `setNodeGroup(id, null)` still detaches. `setNodeCollapsed` and `dissolveGroup` still emit `'replace'`. Note that `updateNode(id, { position })` emits one `'update'` change, not a `'position'` change, so `getByType('position')` does not see moves made through `updateNode`.

**Clearing the changeset in a handler does nothing.** angflow applies the changes before emitting, as React does, so `changes.clear()` or `changes.remove(...)` inside a handler cannot cancel a change (that is Svelte Flow-only behaviour). Both store paths emit a changeset built from exactly the changes that were applied; the change middleware still sees arrays.

**Behaviour change (agent tools and `groupNodes`):** because an `add` for an existing id is ignored, `add_node`, `add_nodes`, `add_edge`, `add_edges` and the matching `apply_changes` ops now fail with `InvalidParamsError` (`-32602`; the `apply_changes` batch rolls back with `-32603`) when the id already exists, including an id added earlier in the same batch, and reject duplicate ids within one bulk call. Before, they silently dropped the add and returned the old element. `NgFlowService.groupNodes` now throws when the group id already exists, as the agent `group_nodes` tool does, instead of re-parenting members into the existing node. The agent op-log also deep-clones recorded params, so a later move can no longer rewrite a logged `add_nodes` op.

No agent tool schema change; the `@angflow/mcp` snapshot is unchanged. Ported from xyflow/xyflow#5944 (5ff09ef77).

### Added (additive API)

- `setViewport` resolves `boolean`; `setCenter` / `zoomIn` / `zoomOut` / `zoomTo` resolve
  `false` when interrupted.
- Overlapping `fitView` calls share one promise (every caller gets
  the last fit's result), and `fitBounds` calls share theirs. Pending fits settle with
  `false` when the flow is destroyed.
- Agent tools: `fit_view` / `fit_bounds` results gain `ended`; `set_viewport` now awaits
  its animation and returns a boolean (its JSON-RPC reply arrives after the animation).
- `BaseEdgeComponent` label inputs (`label`, `labelX`, `labelY`, style inputs).
- Key combinations for `deleteKeyCode`, `selectionKeyCode` and `multiSelectionKeyCode`
  (e.g. `'Meta+Backspace'`), with upstream `useKeyPress` semantics.
- `ReconnectEdgeOptions.onError` / `AddEdgeOptions.onError` (from `@angflow/system`).
- `HandleBounds`, `NodeHandle` exports.
- `forceColorMode` input (`'light' | 'dark'`): forces one flow's scheme, overriding the page.
- `@angflow/angular/style.css`, `@angflow/angular/base.css` and `@angflow/angular/xy-theme.css` export paths. `xy-theme.css` is `base.css` plus upstream's optional full theme (import it instead of `style.css`).
- Examples: the `xy-theme` example (route `/xy-theme`, alias `/examples/xy-theme`), which loads `xy-theme.css` through a `<link>` for that page only.
- `FlowStore.rawConnection` and `FlowStore.getFinalClickConnectionState()`.
- Examples: the `drag-threshold` example (port of upstream DragThreshold), in the examples app.
- `onBeforeDelete` may return `{ nodes, edges }` to delete exactly that set (the
  `OnBeforeDelete` type widens; boolean returns keep working).

### FlowStore additions

- New public `FlowStore` members: `fitBounds()`, `detachFlow(owner?)`,
  `updateClickConnectPreview()`, `connectionDragInProgress()`, `isClickConnectPreview()`
  and the static `FLOW_CALLBACKS` list. `FlowStore.reset()` now also clears the flow
  callbacks and the DOM node.

### System type change

- `PanZoomInstance.setViewport` resolves `Promise<boolean>` (was
  `Promise<ZoomTransform | undefined>`). Affects direct `@angflow/system` users only.

### Behaviour changes

- Touch now pans instead of starting a marquee when `panOnDrag` is on. Migration: hold
  the selection key to marquee with touch.
- Selected edges are elevated by default, and edge z-index follows
  `getElevatedEdgeZIndex`: `edge.zIndex ?? 0`, plus 1000 when the edge is selected and
  `elevateEdgesOnSelect` is on, plus the higher internal z of the source/target node when
  that node is in a sub-flow (has a `parentId`) or is selected with elevation on. The old
  code gave every edge `max(source z, target z)`, so top-level edges now sit at 0 (below
  nodes) unless elevated. `[elevateEdgesOnSelect]="false"` does NOT restore the old look.
  Migration: set `zIndex` on the edges that must sit above nodes, or keep elevation on.
  (The input was previously a no-op; `EdgeToolbar` now uses `getElevatedEdgeZIndex` too.)
- The arrow-key step is 5px (was 1px), x4 with Shift, through snapping and extent
  clamping. The position after the move (post snap/clamp) is announced in the aria-live
  region, as upstream's NodeWrapper does. Arrow keys skip selected nodes that aren't
  draggable. The aria-live region is not rendered when `disableKeyboardA11y` is set.
- Built-in edge labels are SVG inside the edge `<g>` (no more HTML overlay).
  Migration: styles targeting `.xy-flow__edge-label` as an HTML div must be rewritten
  for `.xy-flow__edge-textwrapper` / `-textbg` / `-text`, or use `labelStyle` /
  `labelBgStyle`. Numeric style values get `px` as in React. `EdgeTextComponent` is now
  `<g ngFlowEdgeText>`.
- Custom edges no longer get a renderer-drawn label. Migration: render it with
  `<ng-flow-base-edge [label] [labelX] [labelY]>`. Layout still measures these labels
  (via `data-edge-label-for`), like built-in ones.
- Background pattern ids are `pattern-<flowId><id>` and the pattern geometry
  (`patternTransform`, sizes, shapes) matches upstream. `color` / `bgColor` now set the
  `--xy-background-pattern-color-props` / `--xy-background-color-props` custom
  properties (previously `color` had no effect). Dark-mode pattern colours added (#5839).
  The dots `size` was a radius and is now a diameter (upstream), so existing dots render
  at half size: double `size` to keep them. `lineWidth` no longer scales with zoom.
- The pane cursor moved to `.xy-flow__pane::before` (#6029). Migration: cursor overrides
  targeting `.xy-flow__pane` itself should target `::before`; overrides for `.selection`
  must target both the pane and its `::before`.
- A pane click that does not move no longer turns on `nodesSelection` after a
  `selectionOnDrag` press, so it reaches `(paneClick)`.
- `getNodesBounds` (and the `get_nodes_bounds` tool) uses absolute positions for sub-flow
  children and skips nodes that aren't in the store (upstream behaviour).
- `reconnectEdge` with an options object but no `shouldReplaceId` now replaces the id.
- Unmounting a flow that shares a store detaches only that flow's wiring; a sibling or
  newly mounted `<ng-flow>` keeps its callbacks, DOM node and size.
- Deleting a parent deletes its descendants (keyboard, Controls, `deleteElements`, agent
  tools). Migration: to keep children, reparent them first (`setNodeGroup`) or mark them
  `deletable: false`.
- Programmatic deletion (`deleteElements`, Controls, agent tools) respects
  `deletable: false`.
- A non-deletable child of a deleted parent, or a non-deletable edge connected to a
  deleted node, survives with a dangling `parentId` / endpoint (upstream semantics).
- `(nodesDelete)` / `(edgesDelete)` / `(delete)` fire once per deletion (keyboard,
  Controls, `deleteElements`, `delete_elements` tool, `dissolveGroup`), before the
  removal is applied, in upstream's order (edges, then nodes, then `delete`). Migration:
  handlers that read the store expecting the elements gone must defer. The
  `apply_changes` `delete_elements` op writes through `setNodes` / `setEdges` and does
  not fire them (unchanged).
- Keyboard deletion is asynchronous: it goes through `deleteElements` (it used to be
  synchronous) and clears `nodesSelectionActive`. Failures of keyboard and Controls
  deletion, such as a throwing `onBeforeDelete`, are reported through `onError` with id
  `'delete-failed'`; they are no longer unhandled rejections.
- `onBeforeDelete` returning `undefined` / `null` (untyped JS) now throws a `TypeError`;
  it used to veto. This matches upstream. Migration: return `false` to veto.
- `KeyHandlerDirective` no longer has `nodesDelete` / `edgesDelete` / `deleteElements`
  outputs. Used standalone, it requires `NgFlowService` in its injector. Migration: use
  `<ng-flow>`'s outputs.
- `dissolveGroup` (and `dissolve_group`) moves the children out first, then deletes the
  group: `onBeforeDelete` sees only the group and its edges. The children are restored
  if the group survives (a veto, a narrowing hook or `deletable: false`) and also if the
  hook throws or rejects. A move made to a child while an async veto is pending is
  reverted. The intermediate reparent shows in `(nodesChange)`. An `extent: 'parent'`
  child of a top-level group loses `extent`. Under a grandparent, children keep it and
  stay where drawn except an `extent: 'parent'` child overhanging the grandparent, which
  is clamped into it (drawn inside it; the raw `position` is unchanged).
- Agent: `delete_elements` (the tool and the `apply_changes` op) cascades and skips
  `deletable: false`. Results list the ids actually deleted (the op used to echo the
  requested ids). `apply_changes` still bypasses `onBeforeDelete`.
- Agent: an `apply_changes` batch containing a `delete_elements` op is no longer fully
  synchronous (runs of other ops stay synchronous; batches without a delete are
  unchanged). In-process callers (`bridge.callTool`, `window.angflow.callTool`) should
  await `apply_changes` before issuing other calls. WebSocket text frames are
  dispatched one per macrotask, so they don't interleave unless an async
  `AGENT_CAN_MUTATE` gate resolves several requests together; binary frames
  (`await Blob.text()`) can interleave.

### Fixed

- Viewport animations settle when interrupted (#6064, #6158); pane extent cache
  (#5850, #6108, #6054); `Control` pan activation (#5922); middle-mouse pan from
  selections (#5902, #6119).
- Child before parent (#5915; `groupNodes` / `group_nodes` produce this order); internal
  selection state no longer mutated (#6097); `getNodesBounds` (#5871); `extent: 'parent'`
  unmeasured parent (#5889); resizer (#5998, #6084); `getNodesInside` (#5806);
  smooth-step bends (#6036); `reconnectEdge` / `addEdge` `onError` (#6055); `NodeProps`
  narrowing (#6131); dark-mode background (#5839); pane cursor (#6029); de-branded
  dev warnings (#5793).
- Pane click follows upstream order: a marquee end, a connection dropped on the pane and
  clicks during a connection no longer cancel click-to-connect, fire `(paneClick)` or
  reset the selection; a cancelling pane click emits `(clickConnectEnd)`. The connection
  line gets the `connection` and valid/invalid classes (custom lines are wrapped).
- The pane `selection` class tracks upstream `isSelecting`.
- Arrow-key move announcement.
- The `delete_elements` tool description named the wrong result keys (`deletedNodes` /
  `deletedEdges`); the tool returns `deletedNodeIds` / `deletedEdgeIds`.
- Shared-store unmount; MiniMap follows a new `panZoom` after remount;
  `selectNodesData` only emits when node data changes.
- `base.css` no longer includes angflow's theme token block (it carried `style.css`'s colours).
- MiniMap: its background follows the colour scheme. `bgColor` now writes `--xy-minimap-background-color-props`, as upstream does; it used to paint an opaque `#f0f0f0` rect, so the minimap stayed light in dark mode.
- Built-in default, input and output nodes honour `sourcePosition` / `targetPosition`; they were hard-coded to top / bottom. As upstream's NodeWrapper, any node whose `type`, `sourcePosition` or `targetPosition` changes is re-measured, so its edges follow the moved handles.
- `NgFlowService.updateNodeInternals()` re-routes edges when only handle positions changed (same node size); edges used to keep the old handle bounds until an unrelated update.
- The shipped CSS contained un-flattened native `&` nesting (32 selectors in `style.css`, 24 in `base.css`), which browsers without CSS nesting dropped. The CSS is now bundled with postcss (`postcss-import`, `postcss-nested`, `autoprefixer`), which flattens everything.


## 0.3.2

### Changed

- Lowered the `@angular/core` / `@angular/common` peer range from `>=21.0.0` back
  to `>=19.0.0`. The published partial-Ivy output only requires linker 17.1+
  (its `minVersion` is set by the features used — signal inputs — not by the
  compiler that built it), so the library is consumable from Angular 19+ even
  though it is built and tested on Angular 21. Verified by building an Angular 19
  app against the packed output.

### Fixed

- `NgFlowService` now imports `DOCUMENT` from `@angular/common` instead of
  `@angular/core`. `@angular/core` only re-exports `DOCUMENT` on Angular 20+, so
  the previous import broke Angular 19 consumers at bundle time
  (`No matching export … for import "DOCUMENT"`). `@angular/common` exports it on
  both 19 and 21.

## 0.3.0

### Added

- `<ng-flow>` `[autoPanOnNodeFocus]` input (default `true`) — pans the viewport
  when a node receives keyboard focus, matching React's `autoPanOnNodeFocus`.
- Selection box is now draggable as a group and keyboard-movable (arrow keys,
  Shift = 4×, Escape clears the selection), matching React's `NodesSelection`.

### Changed

- Minimap wheel-zoom default changed: `zoomStep` now defaults to `1` (was `10`),
  matching React's runtime default. The minimap also gained functional
  `pannable`/`zoomable`/`inversePan` inputs (previously pan/zoom interactions
  were always-on and unclamped — they now respect `translateExtent` and the new
  inputs' React-parity defaults `pannable=false`/`zoomable=false`).
- `setCenter` now honors `options.interpolate` (`'smooth'` | `'linear'`);
  previously the option was accepted but ignored.

### Removed

- `(autoPanStart)` / `(autoPanEnd)` outputs. They were declared "Not yet wired",
  never emitted, and have no React equivalent. Removed as never-functional API.

## 0.2.0

Current release (group auto-size: `getGroupBounds` + `sizeGroupToChildren`).
For detailed history prior to this file's introduction, see
`git log --oneline -- packages/angular`. Future releases append entries here.
