# @angflow/angular

## 0.3.22

Bug-fix release. Requires `@angflow/system` 0.1.14.

### Added (additive API)

- `setViewport` resolves `boolean`; `setCenter` / `zoomIn` / `zoomOut` / `zoomTo` resolve
  `false` when interrupted.
- `FitViewResult.ended`. Overlapping `fitView` calls share one promise (every caller gets
  the last fit's result), and `fitBounds` calls share theirs. Pending fits settle with
  `ended: false` when the flow is destroyed.
- Agent tools: `fit_view` / `fit_bounds` results gain `ended`; `set_viewport` now awaits
  its animation and returns a boolean (its JSON-RPC reply arrives after the animation).
- `BaseEdgeComponent` label inputs (`label`, `labelX`, `labelY`, style inputs).
- Key combinations for `deleteKeyCode`, `selectionKeyCode` and `multiSelectionKeyCode`
  (e.g. `'Meta+Backspace'`), with upstream `useKeyPress` semantics.
- `ReconnectEdgeOptions.onError` / `AddEdgeOptions.onError` (from `@angflow/system`).
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
- `(nodesDelete)` / `(edgesDelete)` / `(delete)` fire once per deletion, before the
  removal is applied, in upstream's order (edges, then nodes, then `delete`). Migration:
  handlers that read the store expecting the elements gone must defer.
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
  are clamped to the grandparent (drawn inside it; the raw `position` is unchanged).
- Agent: `delete_elements` (the tool and the `apply_changes` op) cascades and skips
  `deletable: false`. Results list the ids actually deleted (the op used to echo the
  requested ids). `apply_changes` still bypasses `onBeforeDelete`.
- Agent: an `apply_changes` batch containing a `delete_elements` op is no longer fully
  synchronous (runs of other ops stay synchronous; batches without a delete are
  unchanged). In-process callers (`bridge.callTool`, `window.angflow.callTool`) should
  await `apply_changes` before issuing other calls. WebSocket requests are unaffected.

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
- The `delete_elements` tool description named the wrong result keys
  (`deletedNodeIds` / `deletedEdgeIds`).
- Shared-store unmount; MiniMap follows a new `panZoom` after remount;
  `selectNodesData` only emits when node data changes.


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
