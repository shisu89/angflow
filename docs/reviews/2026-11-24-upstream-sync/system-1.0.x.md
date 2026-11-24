# Upstream @xyflow/system 1.0.0 + 1.0.1 → angflow triage

Scope: every changeset bullet in the `## 1.0.1` and `## 1.0.0` sections of the system changelog (21 bullets; #6064 and #5927 each appear twice).
Baseline: angflow HEAD 1638eba6c (@angflow/system 0.1.13, @angflow/angular 0.3.21), fork base a58568f11 (= upstream system 0.0.76).
Method: inspected each upstream commit/PR merge diff (`git diff <merge>^1 <merge>`), the matching packages/react change, and the corresponding angflow code at HEAD. Several changelog SHAs point at changeset-only commits; the code is in these PR merges:
#5915 → ed900c8bf, #5927 → 82e24caf8, #6029 → 30df074d5, #6084 → 57589724a (+254fd5f7d), #5989 → 549b6def0 (4798afc46), #6131 → c22d52810, #6064 → b6ec4b195 (f843c0a86), #6074 → 867023dd8, #6111 → 910eb791e, #6109 → 0062d4b57, #6114 → f9420bc45, #5556 → 725baeb5f, #6117 → 63b6e0295, #6115 → d0338b48a (b1ad016 + 59dffc0ec + 2bc771f5b), #6168 → d2bb47dc0, #6158 → a4ec3dff1.
#5996 has no merge of its own: its system code is cbd84d0c6 plus the `isParent`/`updatedNodes`/incremental `updateConnectionLookup` work from the conflict merge bb04a368f, merged via #6035 (a6c1ffa72). It sits on top of the unlisted 1.0.0 refactor #5972 (2cc386b61, 005e5ee2a) and #5915.

Result: **0 PRESENT, 0 PARTIAL, 19 ABSENT, 2 N/A.** None of the 1.0.x system changes are in angflow. The drift-sync commit 5978703ed only covers 0.0.77-era fixes.

## Table

| # | PR / SHA | Change | Status in angflow (evidence) | Breaking for angflow consumers? | Effort / risk |
|---|---|---|---|---|---|
| 1 | #6158 6bb426c (1.0.1) | fitView keeps the viewport when there are no nodes to fit | **ABSENT**. `packages/system/src/utils/graph.ts:379-389` only checks `nodes.size === 0`. If every node is unmeasured or hidden, `getFitViewNodes` returns an empty map, `getInternalNodesBounds` gets an empty map, and the fit zooms to maxZoom. | No | Trivial: add `if (nodesToFit.size === 0) return { zoom: NaN, clamped: false }` to match angflow's `FitViewResult` and the AGENT_BRIDGE.md:187 contract ("zoom null when no nodes to fit"). |
| 2 | #6168 853c44a (1.0.1) | XYDrag binds the d3-drag behaviour once per element (touch drag survives re-render) | **ABSENT**. `packages/system/src/xydrag/XYDrag.ts:111-415` still builds a new `drag()` and re-`.call()`s it on every `update()`. | No | Medium, low risk. Requires the #5556 XYDrag shape first (row 7): upstream's diff is a restructure on top of it. Lower urgency in angflow: `drag.directive.ts` only calls `update()` from `ngOnChanges`, and none of the inputs bound in `node-renderer.component.ts:99-103` normally change mid-drag. The bug only shows up if a consumer toggles draggable/selectable/dragHandle during a touch drag. |
| 3 | #6114 dff4dad | Remove `getHandleConnections`; `getNodeConnections({nodeId,type?,handleId?})`; `HandleConnection` → `NodeConnection`; adds `getConnectionLookupKey` / `getConnectionsFromLookup` | **ABSENT**. `system/src/types/general.ts:89` still exports `HandleConnection` and uses it in `ConnectionLookup` (:383). `utils/connections.ts` has no lookup helpers. Angular still has `getHandleConnections` and builds keys by hand. | **Yes** if adopted as-is. See blast radius A. | Small. Non-breaking route below. |
| 4 | #6117 dae45aa | `onConnectEnd` / `onReconnectEnd` receive `to` in flow coordinates | **ABSENT**. `xyhandle/XYHandle.ts:240-243` passes `previousConnection.to` through unchanged (screen/pane coords). | **Yes, but small blast radius.** See B. | Trivial in system (one line). Risk is semantic only. |
| 5 | #6115 b1ad016 (+59dffc0ec, 2bc771f5b) | `paneClickDistance` → `paneDragThreshold` (default 1). Pan/selection start only past the threshold. Works for every mouse button and touch. `setClickDistance` removed. | **ABSENT**. `types/panzoom.ts:46-47` has `paneClickDistance` / `selectionOnDrag`. `XYPanZoom.ts:134-135` still sets `clickDistance` from them. `setClickDistance` exists (:305). The `pointerDrag` state machine is missing from `eventhandler.ts`. | **Yes.** See C. | Medium–large, medium risk. Rewrites the panzoom start/zoom/end handlers. Upstream builds on XYPanZoom edits from 0.0.77 (#5677), 0.0.79 (#5850) and 0.0.80 (#5922, `isMouseEvent` / `D3ZoomInputEvent` typing). It also has to hand-merge angflow's deliberate `update()` divergence (no destroy during selection, `XYPanZoom.ts:111-131`) and its panOnScroll timeout fix. Needs touch e2e coverage. |
| 6 | #6064 de1e4c5 (major part) | `PanZoomInstance.setViewport` resolves `true`/`false` (finished/interrupted) | **ABSENT**. `types/panzoom.ts:53` returns `Promise<ZoomTransform \| undefined>`. `XYPanZoom.ts:241-247` returns the transform. | **Yes** for direct `@angflow/system` users of `PanZoomInstance` (also exposed via `angular/src/lib/types/store.ts:58`). No angflow code reads the return value. | Small. See D. |
| 7 | #5556 9fcddb8 | Remove `nodeClickDistance`. A click is suppressed only if the drag moved nodes or the pointer was released outside the node (`preventNextClick`). `clickDistance(Infinity)`. Threshold measured from the initial pointer position. | **ABSENT**. `XYDrag.ts:86,117,297` uses `.clickDistance(nodeClickDistance)` with default 0, so any 1px jitter suppresses the node click. No `preventNextClick` / `initialMousePosition`. | Formally **yes**, practically **no**. See E: the angflow input is already dead. | Small–medium, low–medium risk. Behaviour change: jittery clicks below `nodeDragThreshold` now fire `(nodeClick)`, and releasing a drag over the pane no longer fires `(paneClick)`. |
| 8 | #5987 615c5f6 | Type rename `Handle` → `HandleBounds`. `NodeHandle` redefined. Dead `toHandleBounds` fallback removed from `getEdgePosition`. | **ABSENT**. `types/handles.ts` still exports `Handle` (with angflow's added `floating` field). Used across `utils/dom.ts`, `store.ts`, `edges/positions.ts`, `xyhandle/*`. | **Yes** (types only). See F. | Trivial with a deprecated alias. Keep angflow's `floating` field. Keep `toHandleBounds` unless you confirm angflow never reaches `getEdgePosition` before `parseHandles`; it is harmless. |
| 9 | #6109 13bf20a | Connection lookup clones each affected map once ("snapshots"). `areConnectionMapsEqual` / `handleConnectionChange` compare `edgeId`. | **N/A today.** The bug comes from #5996's incremental, in-place `updateConnectionLookup`. Angflow still rebuilds everything (`store.ts:601-616` clears the lookup and allocates new maps every call). Angular has no `onConnect`/`onDisconnect` per-node-connection consumer: `areConnectionMapsEqual` / `handleConnectionChange` are unused in `packages/angular`, and the signals key off `store.version()`. | No | Trivial for the `connections.ts` part. **Mandatory** if #5996's incremental lookup is ported. Port it together with follow-ups c7a19b8ab (reversed connections) and 74d510a22 (#6120). |
| 10 | #6074 5d448e9 | `getElementsToRemove`: Map/Set lookups instead of O(n·m) `find` | **ABSENT** in system (`graph.ts:494-521` is still the 0.0.76 `matchingNodes.find` / `matchingEdges.find` code). **Bigger finding:** angular never calls `getElementsToRemove`. `NgFlowService.deleteElements` (`ng-flow.service.ts:742-785`) and `KeyHandlerDirective.handleDelete` (`key-handler.directive.ts:144-190`) have their own logic. The key handler's `allEdgesToDelete` uses `.filter(... !deletableEdges.some(...))`, which is the same quadratic pattern. | No | Trivial in system. Gives **no** benefit until the angular wrapper uses `getElementsToRemove` (see G). |
| 11 | #6119 fbe2ba5 | Middle-mouse pan on nodes/edges/selections respects `panOnDrag` | **ABSENT**. `xypanzoom/filter.ts:44-52` returns true for button 1 on node/edge regardless of `panOnDrag` (angflow added a `!userSelectionActive` guard). It also lacks the selection-box classes from 0.0.80 f72e31247. | No (bug fix) | Trivial. Keep angflow's `!userSelectionActive` guard. Optionally pull in the 0.0.80 `__selection` / `__nodesselection` classes (other agent's scope). |
| 12 | #5915 96b196f (code ed900c8bf) | Parent nodes no longer need to come before children in `nodes` (`resolveSubflowsForNode` defers children) | **ABSENT**. `store.ts:186-188` calls `updateChildNode` inline, and `:229-234` warns "Parent node … not found. Please make sure that parent nodes are in front…". **Verified** against built `@angflow/system` dist: `[child(parentId:g), g]` gives the warning, the child keeps its relative position as `positionAbsolute`, and it is missing from `parentLookup`. **Angflow's own `NgFlowService.groupNodes` (agent tool `group_nodes`) creates exactly this order**: `addNodes` appends the group after its members (`ng-flow.service.ts:353-364`, `utils/changes.ts:60-67`). | No (relaxes a constraint) | Small, low–medium risk. The `adoptUserNodes` diff (~60 lines) applies cleanly on top of angflow's edits (measured carry-over, `parseHandles` preservation). Caveat: angflow still calls `updateAbsolutePositions` (`flow-store.service.ts:499,780,1012`). That walks `nodeLookup` in array order, so a child placed before its parent reads the parent's previous-pass `positionAbsolute` when the parent's own absolute position changes in the same pass (origin/extent/measure changes). Make it parents-first too, or reuse the deferral. |
| 13 | #5927 69dc311 | Default fitView/fitBounds padding = `'5%'` (`defaultFitViewPadding`) | **ABSENT**. `graph.ts:389` uses `options?.padding ?? 0.1`. `ng-flow.service.ts:146` (`fitBounds`) uses `?? 0.1`. No `defaultFitViewPadding` constant. | Effectively no. Legacy 0.1 ≈ 4.55% per side, `'5%'` = 5%, so the framing change is negligible. | Trivial. |
| 14 | #6029 b872a5b (code 30df074d5) | Panning perf: cursor moved to `.xy-flow__pane::before` so cursor changes don't restyle the whole subtree | **ABSENT**. `system/src/styles/init.css:69-82` puts the cursor on `.xy-flow__pane.draggable/.dragging/.selection`. Angular overrides it again on the pane itself: `angular/src/lib/styles/style.css:21-31` (custom SVG grab/grabbing cursors) and `ng-flow.css:108-115` (`cursor: default`, `.selection`). The DOM matches React: viewport, edges, nodes and selection box are projected inside `<ng-flow-pane>` (`ng-flow.component.ts:193-236`), so every cursor flip restyles the whole flow. | No (pure CSS) | Small, low risk. Edit system `init.css` **and** both angular stylesheets, and keep the SVG cursors (move them to `::before`). Keep `.selection` on the pane itself: angflow also uses `setPointerCapture` (`pane.component.ts:149`). Pseudo-element hits still target the pane host, so `pane.component.ts:105` (`target === el`) is unaffected. |
| 15 | #6084 1d9b9cd (+254fd5f7d) | Resizing nodes with a fixed extent and non-default origin. Start values come from the clamped `positionAbsolute`; `nodeToChildExtent` is reworked. | **ABSENT**. `xyresizer/XYResizer.ts:90-102` uses the old `nodeToChildExtent(child,parent,nodeOrigin)`, and `:165-170` uses `node.position`. Builds on the 0.0.77 own-extent clamp, which **is** present (`XYResizer.ts:180-183`, from 5978703ed). | No | Small, low risk. Applies almost verbatim. |
| 16 | #5989 bf27626 (code 4798afc46) | No jumping nodes with per-node `origin` | **N/A.** The upstream bug was a regression from #5972 (2cc386b61), which stopped calling `updateAbsolutePositions` after `updateNodeInternals`. Angflow still makes that call (`flow-store.service.ts:499`), and it recomputes root positions with the measured size and `node.origin`. | No | None now. **Required** if #5972 is ported (prerequisite chain for #5996), together with #6126 (0cd64a416). |
| 17 | #6111 5161767 | Delete all descendants of a parent regardless of order | **ABSENT** (system). As with #6074, the angular wrapper never calls `getElementsToRemove` and **does not cascade descendants at all**: deleting a group leaves orphan children with a dangling `parentId`. Angular's `deleteElements` also ignores `deletable:false`, and `onBeforeDelete` is boolean-only (`flow-store.service.ts:308`). | No (system). Switching angular to it changes behaviour. See G. | Trivial in system (needs #6074 first). |
| 18 | #6064 de1e4c5 (patch part) | Animated viewport promises (`fitView`, `setCenter`, zoom*) resolve `false` on interrupt instead of hanging | **ABSENT**. `xypanzoom/utils.ts:27-35` `getD3Transition` only listens for `'end'`, so a user gesture or another viewport call during the animation **leaves the promise pending forever**. **Angflow impact:** agent tools `fit_view`, `fit_bounds`, `zoom_in/out/to`, `set_center` with `duration` await these promises (`agent-bridge.service.ts:747-893`), so the JSON-RPC call hangs if the user touches the canvas mid-animation. | Return-type change only (row 6) | Small, low risk. Add `.on('interrupt cancel', () => onEnd(false))`. High value. |
| 19 | #6131 8849014 (code c22d52810) | `NodeProps` distributive over node-type unions (narrow `data` by `type`) | **ABSENT** (`types/nodes.ts:114-125`). Angular re-exports it as `NodeProps` (`angular/src/lib/types/nodes.ts:47`); custom nodes get individual inputs, so it is rarely used. | No | Trivial, type-only. |
| 20 | #5927 7b52b50 | Numeric `padding` = **pixels** (was legacy fraction units) | **ABSENT**. `utils/general.ts:221-224` `parsePadding` still uses `(viewport - viewport/(1+p)) * 0.5`. `FitBoundsOptions.padding` is still `number` (`types/general.ts:251`). | **Yes, silent visual break.** See H. | Trivial code, high semantic risk. |
| 21 | #5996 885ac9e | Perf: optimized node/edge processing. Upstream: `hasSubflows` guard, `updatedNodes` set and `internals.isParent` in `adoptUserNodes` / `updateNodeInternals`, incremental `updateConnectionLookup` (only re-syncs edges whose endpoints/handles changed) returning `updatedEdges`. React side: pubsub/fine-grained stores/React Compiler. | **ABSENT** (`store.ts:134-196`, `:601-616`). | No, if `isParent` is made optional. Upstream makes it a required field on `InternalNodeBase.internals`, which breaks hand-built internals: 6 angular spec files build `internals: {}`. | **Large overall; medium for a useful subset.** See I. |

## Blast radius of the breaking items + non-breaking adoption

### A. #6114 getHandleConnections / HandleConnection (row 3)
Affected:
- `packages/system/src/types/general.ts:87-98,383`; `utils/connections.ts:1,6,34-42`; `utils/store.ts:1,575`
- `packages/angular/src/lib/public-api.ts:186` (exports `HandleConnection`), `types/general.ts:18,173-174` (instance type has `getHandleConnections` + `getNodeConnections(nodeId)`)
- `services/ng-flow.service.ts:17,881-897` (`getHandleConnections`, `getNodeConnections(nodeId: string)`, which differs from React's `getNodeConnections({nodeId,type,handleId})`), `:939-963` (`selectNodeConnections`, `selectHandleConnections`)
- `services/flow-store.service.ts:327` (`connectionLookup` typed with `HandleConnection`)
- Agent: `agent-bridge.service.ts:821-834` (`get_node_connections`, `get_handle_connections`), `tool-schemas.ts:455-477` (descriptions say "HandleConnection"), `packages/mcp/src/generated/tool-schemas.ts:753`, AGENT_BRIDGE.md
- README.md:184 (`selectHandleConnections`)

Non-breaking route:
1. System: add `getConnectionLookupKey` / `getConnectionsFromLookup`, switch internals to `NodeConnection`, keep `/** @deprecated */ export type HandleConnection = NodeConnection`. The two are structurally identical.
2. Angular: overload `getNodeConnections(nodeIdOrParams: string | {nodeId; type?; handleId?})` and the same for `selectNodeConnections`. Mark `getHandleConnections` / `selectHandleConnections` `@deprecated` and implement them via `getConnectionsFromLookup`.
3. Agent: keep `get_handle_connections` as an alias. Optionally add `type?` / `handleId?` to `get_node_connections`. That is a schema change: regenerate the mcp snapshot and update AGENT_BRIDGE.md in the same commit.

### B. #6117 `to` in flow coordinates (row 4)
Affected:
- `system/src/xyhandle/XYHandle.ts:240-243` (finalConnectionState)
- Angular: `edge-renderer.component.ts:332,794-797` and `ng-flow.component.ts:221,657`. `(reconnectEnd)` emits `connectionState`, so its `.to` changes coordinate space.
- Examples: `examples/angular/.../reconnect-edge/reconnect-edge.component.ts:67`, which only logs.
- Not affected: `(connectEnd)`. Angflow's output only emits the raw event (`ng-flow.component.ts:645,918`; `handle.component.ts:216` drops the state), so consumers can't read `to` today. That is a parity gap of its own: React's `onConnectEnd(event, connectionState)`.
- Not affected: the agent (no connection events).

Also note: `NgFlowService.connection` (`ng-flow.service.ts:79`) exposes the in-progress `to` in **screen** coords, while React's `useConnection` returned flow coords even at 0.0.76. The internal `connection-line.component.ts:80-83` converts it by hand.

Non-breaking route:
- The system change only affects the final state. Ship it as a documented behaviour change, or have angular convert back for `(reconnectEnd)` for one minor and flip later.
- Separately consider a new output (e.g. `connectEndState`) or an `(connectEnd)` overload that carries `FinalConnectionState`.

### C. #6115 paneClickDistance → paneDragThreshold (row 5)
Affected:
- System: `types/panzoom.ts:46-47,63` (`paneClickDistance`, `selectionOnDrag`, `setClickDistance`), `xypanzoom/XYPanZoom.ts:28,49,108-135,305-321`, `eventhandler.ts:172-259`
- Angular, `ng-flow.component.ts`:
  - `:506` input (default 0)
  - `:811` store mirror
  - `:894` effect dependency
  - `:1122-1128` manual click-distance check in `onPaneClick` with `panePointerDownPos` (`:1070-1073`)
  - `:1238` `paneClickDistance` passed to `panZoom.update`
- Angular, `flow-store.service.ts:218` (signal).
- `pane.component.ts:175-186` has **no** threshold for starting a marquee; React's Pane applies `paneDragThreshold` there (`requiredDistance = selectionKeyPressed ? 0 : paneDragThreshold`).
- Examples:
  - `click-distance/click-distance.component.ts` (whole example + route `app.routes.ts:18,77`)
  - `figma/figma.component.ts:40` (`[paneClickDistance]="100"`; upstream Figma example now uses `paneDragThreshold={100}`, so panning and marquee wait 100px)
  - `kitchen-sink/kitchen-sink.component.ts:92,175,227,306,606-607`
- Agent / mcp: none.

Default changes 0 → 1.

Non-breaking route:
- Add `paneDragThreshold = input<number | undefined>()`. Keep `paneClickDistance` as a deprecated input and compute `effective = paneDragThreshold() ?? paneClickDistance() ?? 1`. Decide whether to keep 0 as the default for one minor.
- In system, keep `paneClickDistance?` as an optional deprecated alias in `PanZoomUpdateOptions`, and keep `setClickDistance` as a deprecated shim.
- The semantics differ slightly: old = click tolerance while panning still starts immediately; new = no pan before the threshold. The alias is a reasonable approximation.
- Remove the manual check in `onPaneClick`; d3-zoom clickDistance plus the threshold handle it.

### D. #6064 setViewport → boolean (rows 6, 18)
Affected:
- System: `types/panzoom.ts:53`, `XYPanZoom.ts:~200-300` (`setTransform`/`scaleTo`/`scaleBy`/`setViewport`), `utils.ts:27-35`
- System `fitViewport` (`graph.ts:391`). Angflow returns `FitViewResult {zoom, clamped}`, not upstream's boolean.
- Angular:
  - `flow-store.service.ts:929-952`: `setCenter` always returns true; `setViewport` returns `Promise<void>`
  - `:954-970`: zoomIn/Out/To pass `scaleBy`'s boolean through, which can now be `false`
  - `ng-flow.service.ts:117,138-150` (`fitBounds` ignores the result)
  - `types/store.ts:58` exposes `PanZoomInstance`
- Agent: results of `set_center` / `zoom_*` / `fit_*` (AGENT_BRIDGE.md:179-187).

Non-breaking route:
- Change `PanZoomInstance.setViewport` to `Promise<boolean>`. Only direct system users who read the transform break, and angflow doesn't. Alternatively keep `ZoomTransform | undefined` and add a separate flag, but upstream parity favours boolean.
- Angular: make `setViewport` return `Promise<boolean>` (widening from `void` is source-compatible). Have `setCenter` return the real boolean. Extend `FitViewResult` with an optional `interrupted?: boolean` (additive).
- Agent results: document `false` / `interrupted` in AGENT_BRIDGE.md.

### E. #5556 nodeClickDistance removal (row 7)
Affected:
- System `XYDrag.ts:86,117,297`.
- Angular:
  - `ng-flow.component.ts:509` input and `:812` mirror into `store.nodeClickDistance`
  - `flow-store.service.ts:219` signal, **never read anywhere**
  - `drag.directive.ts:44,89` (`ngFlowDragClickDistance` input → `XYDrag.update`), **never bound** by `node-renderer.component.ts:99-103`
- Example: `kitchen-sink.component.ts:93,176,227,307,610-611`.

So the public `[nodeClickDistance]` input has been a no-op all along, and node clicks run with d3 clickDistance 0.

Non-breaking route: keep the input (and `ngFlowDragClickDistance`) as `@deprecated` no-ops, and drop the parameter from `DragUpdateParams`, or ignore it. The observable change is the click-suppression rule (a better UX). Mention it in the changelog.

### F. #5987 Handle → HandleBounds (row 8)
Affected:
- System types: `types/handles.ts`, `types/general.ts:10,340,348`, `types/nodes.ts:1,128-129,173`
- System utils: `utils/dom.ts:1,77,84`, `utils/store.ts:1,93-94`, `xyhandle/*`, `utils/edges/positions.ts`
- Angular:
  - `public-api.ts:184` (`Handle as SystemHandle`; no `HandleBounds` export)
  - `types/edges.ts:11,116,125` (`ConnectionLineComponentProps.fromHandle/toHandle`)
  - edge components: `bezier-edge.component.ts:2,48-49`, `straight-edge.component.ts`, `simple-bezier-edge.component.ts`, `step-edge.component.ts`, `smooth-step-edge.component.ts` (`sourceHandle`/`targetHandle` inputs)
- Example: `examples/angular/.../typed-handles/typed-handles.component.ts:26,110,145-146` (`SystemHandle`).

Non-breaking route: system adds `HandleBounds` (keep angflow's `floating?` field) plus `/** @deprecated */ export type Handle = HandleBounds`. Angular exports `HandleBounds` and keeps `SystemHandle` as a deprecated alias.

### G. Deletion (rows 10, 17), an angflow-specific gap
To benefit from #6074 / #6111, route `NgFlowService.deleteElements` and `KeyHandlerDirective.handleDelete` through `getElementsToRemove`. Today's angular code skips descendant cascade (and `deletable:false` in the service path) and does an O(n·m) `.some` merge.

Switching is a **behaviour change**:
- deleting a group removes its children (React semantics)
- `deletable:false` is honoured in programmatic deletes
- `onBeforeDelete` could accept the `{nodes, edges}` return

Touchpoints:
- `controls.component.ts:192-198`, agent `agent-bridge.service.ts:721,1370`, `ng-flow.component.ts:948`
- `dissolveGroup` already reparents children before removing the group, so it is unaffected.

Treat it as a separate, flagged change.

### H. #5927 numeric padding = px (row 20)
Affected:
- System `utils/general.ts:221-224`, `graph.ts:389`, `types/general.ts:251` (`FitBoundsOptions.padding: number`)
- Angular:
  - `ng-flow.service.ts:49` (docstring `fitView({ padding: 0.2 })`)
  - `:138-150,1210-1223` (`fitBounds`; `padding?: number`, default 0.1)
  - `ng-flow.component.ts:455` and `controls.component.ts:123` (`fitViewOptions` inputs)
  - `flow-store.service.ts:251`
- Agent: `agent-bridge.service.ts:746-756,890-893` and `tool-schemas.ts:313,601` (`padding: number`). AGENT_BRIDGE.md:179,185. mcp snapshot. An LLM sending `padding: 0.1` would silently get 0px.
- Examples: none pass numeric fit padding.

Non-breaking route:
- Adopt `defaultFitViewPadding = '5%'` now (visually identical).
- Widen `fitBounds` / agent `padding` to `number | string` (`Padding`).
- Keep legacy numeric semantics for one minor with a dev warning, then flip in a breaking release. Alternatively flip now in system but have the angular/agent layer convert numbers `< 1` as legacy fractions during a deprecation window.
- Any agent-schema change needs the mcp snapshot regenerated and AGENT_BRIDGE.md updated.

### I. #5996 performance (row 21): invasiveness

Upstream system parts:
- (a) `hasSubflows` guard (skip subflow resolution when no `parentId`)
- (b) `updatedNodes` set and `internals.isParent` maintenance in `adoptUserNodes` / `updateNodeInternals` / `updateParentLookup`
- (c) incremental `updateConnectionLookup` (`syncEdgeConnections`: edges re-synced only when source/target/handles change; `updatedEdges` returned)

These sit on #5915 and #5972, and #5972 is not in the system changelog. #5972 rewrote `updateNodeInternals`: child repositioning is inlined via `parentLookup`, the `clampPositionToParent` branch is dropped, and the `dimensionChange()` helper replaces the literal.

They collide with angflow's custom `store.ts` edits:
- measured carry-over `?? internalNode?.measured` (6e7190aa1)
- `parseHandles` always keeps handleBounds
- the `initial` flag on dimension changes (32ccdf29b, with 256 lines of `store.initial-dimensions.spec.ts`), which upstream's `dimensionChange()` helper would silently drop
- the parent guard in `updateNodeInternals` (5978703ed)

Angular can't use (b) without moving from the global `store.version()` signal to per-node signals, which is a large redesign. Most of upstream's gain is React-specific (pubsub, store split, React Compiler) and N/A.

Recommended subset (medium effort, low risk):
- (a) as-is
- (c) incremental lookup, plus #6109 + c7a19b8ab + 74d510a22. Safe in angflow: `applyEdgeChanges` clones changed edges (`angular/src/lib/utils/changes.ts:48-57`), no angular code mutates edge endpoints in place, and `edgeLookup` persists in `FlowStore`. It turns per-edge-change cost from "reallocate every lookup map" into an identity scan.
- Make `isParent` optional if (b) is ever taken.

Skip #5972 unless you also take #5989 + #6126 and re-add `initial`.

## Prerequisites from 0.0.77–0.0.84 (and unlisted 1.0.0 commits)
- #6084 (row 15) builds on the 0.0.77 node-own-extent resize clamp. **Present** (5978703ed).
- #6119 (row 11) builds on 0.0.80 f72e31247 (middle-mouse over `__selection` / `__nodesselection`). **Absent.**
- #6115 (row 5) builds on XYPanZoom changes in 0.0.77 #5677 (1466dcc8b, selection auto-pan), 0.0.79 #5850 (cached pane extent) / 7976e13e7 (typed guards, `isMouseEvent`), and 0.0.80 #5922 (42f367e7e). It also conflicts with angflow's deliberate `update()` divergence.
- #6168 (row 2) builds on #5556 (row 7); its `isTouchEvent` usage comes from e9286291e (1.0.0, unlisted).
- #6111 builds on #6074. #6109 builds on #5996(c). #5996 builds on #5915 and on unlisted 1.0.0 #5972 (+ fixes #5989, #6126/0cd64a416). The 1.0.0 changes API move (c3a844e62) is only needed for helper imports.
- #6158 is independent in angflow (upstream it followed #6064's boolean return).

## Suggested porting order
1. **Independent quick wins (system only, non-breaking):** #6158 (6bb426c) → #6119 (fbe2ba5; optionally with 0.0.80 f72e31247) → #6084 → #6131 → #6074 then #6111 (system `getElementsToRemove`) → #5927 default `'5%'` only.
2. **High value bug fixes:**
   - #6064: interrupt/cancel → `false`. Additive `FitViewResult` field, `PanZoomInstance.setViewport: Promise<boolean>`, AGENT_BRIDGE.md note. Fixes hung agent viewport tools.
   - #5915: deferred subflow resolution, plus make angular's `updateAbsolutePositions` calls order-safe. Fixes `groupNodes` / `group_nodes` child-before-parent arrays.
   - #6029: cursor `::before`, in system `init.css` and angular `style.css` / `ng-flow.css`.
3. **Angular wrapper parity (behaviour change, own release note):** route deletion through `getElementsToRemove` (descendant cascade, `deletable`, `onBeforeDelete` object return).
4. **Deprecate-and-alias breaking set (one minor):**
   - #5987 `HandleBounds` + deprecated `Handle` / `SystemHandle` aliases
   - #6114 lookup helpers + `NodeConnection`, `getNodeConnections` overload, deprecate `getHandleConnections`; mcp regen + AGENT_BRIDGE.md if the tool schema changes
   - #5556 `preventNextClick` / XYDrag restructure + deprecated no-op `nodeClickDistance`, **then** #6168 bind-once on top
   - #6117 flow-coords `to` (+ consider exposing `FinalConnectionState` on `(connectEnd)`)
   - #6115 `paneDragThreshold` with `paneClickDistance` alias. Biggest one; add a marquee threshold in `pane.component.ts`; needs touch e2e.
5. **Breaking flip (next breaking release):** #5927 numeric padding = px. Agent schema / docs change and mcp regen.
6. **Optional perf:** #5996 subset (`hasSubflows` + incremental connection lookup) with #6109 + c7a19b8ab + 74d510a22. Skip #5972 / `updatedNodes` unless angular moves to per-node signals.
