# Sub-project D1 — upstream 1.0 API and callback alignment (design)

Date: 2026-11-25. Roadmap: [`docs/reviews/2026-11-24-upstream-sync.md`](../../reviews/2026-11-24-upstream-sync.md) §3 and §5 row D.
Appendix: [`system-1.0.x.md`](../../reviews/2026-11-24-upstream-sync/system-1.0.x.md) rows 2–8, 13, 20 and sections A–F, H.
Predecessors: B ([spec](2026-11-25-bug-fix-release-design.md)) and C ([spec](2026-11-25-deletion-design.md)), both on `main` and pushed, both unpublished.

## Goal

The breaking half of upstream `@xyflow/system` 1.0 / React 13 that concerns API shapes and callbacks, adopted the way upstream did it: renamed and removed APIs are renamed and removed, with no deprecated aliases. After D1:

- types: `Handle` → `HandleBounds` (#5987);
- connections: `getNodeConnections({ nodeId, type?, handleId? })`, `NodeConnection`, no `getHandleConnections` (#6114);
- node clicks: `nodeClickDistance` removed, click suppression via `preventNextClick` (#5556), and XYDrag binds once per element (#6168);
- connection ends: `(connectEnd)`, `(reconnectEnd)` and `(clickConnectEnd)` carry a `FinalConnectionState` whose `to` is in flow coordinates, and so does `NgFlowService.connection()` (#6117);
- pane: `paneDragThreshold` (default 1) gates pan and marquee start and replaces `paneClickDistance` (#6115);
- fits: `fitView` / `fitBounds` resolve `boolean` (rest of #6064); numeric padding means pixels, default `'5%'` (#5927).

The two `pane click cancels a pending connection` known failures (owner D) are fixed and removed.

## Decisions (2026-11-25, by the user)

| Question | Decision |
|---|---|
| Breaking-change policy | Match upstream fully. No deprecate-and-alias |
| D split | D1 = this spec. D2 = `forceColorMode`, `light-dark()`, `@layer`. D3 = `NodeChangeset` / `EdgeChangeset` |
| `fitView` / `fitBounds` return | `Promise<boolean>`, as upstream. `FitViewResult` leaves the library API |
| Fit padding | A number is pixels. Default `'5%'`. `'10%'` / `'20px'` strings work |
| Agent `fit_view` / `fit_bounds` | Accept the library's padding semantics. The schema descriptions spell out the units. They keep returning `{ zoom, clamped, ended }`: the bridge computes `zoom` and `clamped` itself after the fit |
| Agent connection tools | `get_handle_connections` goes, like `getHandleConnections` |
| Tool changes | Each one updates `AGENT_BRIDGE.md` and regenerates the mcp snapshot in the same commit |
| Release | One final release: angular 0.4.0, system 0.2.0, mcp 0.1.0. The unreleased B/C entries (0.3.22 / 0.1.14 / 0.0.4) merge into them. Nothing is published before the end of the roadmap |
| **Version bump timing (chosen here)** | **In D1, as its first task.** Every later changelog entry (D1, D2, D3) then lands under its final heading, and the mcp snapshot is stamped `0.4.0` from the first tool change on |
| `(connectStart)`/`(connectEnd)` scope (was Open question 1) | Match upstream: click-connect stops firing them, and reconnect drags fire them. Changelog behaviour note |
| Bridge fit measurement (was Open question 2) | Add `NgFlowService.measureFitView` / `measureFitBounds`, marked `@internal` like `hasOnBeforeDeleteHook` |
| Test bar | Failing test first, or a known-failures entry removed, per item |
| Porting | One upstream change at a time, system paths only (`git diff <sha>^1 <sha> -- packages/system \| git apply`, or hand-port). Never wholesale |

## Starting point (verified 2026-11-25, `main` @ `b99aaa54a`)

**Every D1 system diff is a hand-port.** `git diff <merge>^1 <merge> -- packages/system | git apply --check --cached` fails for all of them: #5987 `7b8d854ae`, #6114 `f9420bc45`, #5556 `725baeb5f`, #6168 `d2bb47dc0`, #6117 `63b6e0295`, #6115 `d0338b48a`, #5927 `82e24caf8`. #5927 also targets `utils/constants.ts`, which angflow doesn't have: its constants live in `packages/system/src/constants.ts`. The main reason is that angflow lacks upstream's 1.0 typing refactors. There is no `utils/events.ts` / `XYFlowSourceEvent` (7976e13e7). `XYDrag` has no `NodeType`/`EdgeType` generics and no `isTouchEvent`. The appendix calls 7976e13e7 a prerequisite of #6115. D1 does **not** port it: the hand-port keeps angflow's `event: any` typing.

**Already done in B. D1 builds on these and does not redo them** (`git log 343756d6a..HEAD`):

| Done in B | Commit | What D1 still has to do |
|---|---|---|
| #6064 patch part: interrupted transitions settle, `PanZoomInstance.setViewport: Promise<boolean>` (`types/panzoom.ts:54`), `FitViewResult.ended`, `getD3Transition` interrupt/cancel | e03887a8e, 8a5acc908 | Flip `fitViewport` / `fitView` / `fitBounds` to `boolean` (item 7) |
| Shared fit promises (`runFitChain`, `flow-store.service.ts:1176-1214`), settle on destroy | f83837c0c, 07c29bc80 | Retype them to `boolean` |
| #6158 empty `nodesToFit` guard (`graph.ts:392-395`) | 8a5acc908 | Return `true` instead of a `FitViewResult` |
| #5922, #5902 / #6119 filter (`filter.ts:43-55`), #5850 extent cache | b9a3484ee, 412e2d7d5, 458124850 | These are #6115's XYPanZoom prerequisites and they are present. Keep the `!userSelectionActive` guard |
| Pane click order, `(clickConnectEnd)` emitted on pane cancel (payload = MouseEvent) | cf05e1cc3 | Add the `FinalConnectionState` payload (item 5) |
| Click-connect preview marker (`connectionIsClickPreview`, `connectionDragInProgress()`, `isClickConnectPreview()`, `flow-store.service.ts:1078-1109`) | 882902101 | Keep; it moves onto the raw connection (item 5) |
| Touch pans unless the selection key is held; pane `selection` class | fd6ddea25, 44ee73a51 | Pane threshold must respect both (item 6) |

**Per-item state today:**

| Item | Current code |
|---|---|
| #5987 | `system/src/types/handles.ts:8` `export type Handle` (angflow adds `data?` :18 and `floating?` :21). Used at `types/nodes.ts:1,130-131,175` (`NodeHandle = Omit<Optional<Handle,…>,'nodeId'>`), `types/general.ts:10,347,355`, `utils/dom.ts:1,77,84`, `utils/store.ts:1,189-190`, `utils/edges/positions.ts:6,101,127`, `xyhandle/types.ts:9,41,52,109`, `xyhandle/utils.ts:2,46-47,110,134,148,178`, `xyhandle/XYHandle.ts:14,58,100,385`. The dead `toHandleBounds` fallback is still in `getEdgePosition` (`positions.ts:34-35,74`). Angular: `public-api.ts:184` `Handle as SystemHandle`, no `HandleBounds` / `NodeHandle` export (`:173` exports `NodeHandleBounds`). `types/edges.ts:11,116,125`; the five built-in edges type `sourceHandle`/`targetHandle` as `Handle` (`bezier-edge.component.ts:2,64-65`, `simple-bezier-edge…:54-55`, `smooth-step-edge…:52-53`, `step-edge…:52-53`, `straight-edge…:49-50`). Example `typed-handles.component.ts:26,110,145-146`. Specs `connection-line.component.spec.ts:15`, `edge-renderer.memo.spec.ts:15`, `edge-renderer.data-enrichment.spec.ts:15` |
| #6114 | System `types/general.ts:87-98` has both `HandleConnection` and `NodeConnection`; `ConnectionLookup` uses `HandleConnection` (:390); `utils/connections.ts:1,6,34-42`, `utils/store.ts:1,731`. No `getConnectionLookupKey` / `getConnectionsFromLookup`. Angular `ng-flow.service.ts:937-953` `getHandleConnections({nodeId,type,id})` and `getNodeConnections(nodeId: string)` build keys by hand. `:995-1019` has `selectNodeConnections(nodeId)` and `selectHandleConnections({…})`. `types/general.ts:177-178`, `flow-store.service.ts:343`, `public-api.ts:186` (`HandleConnection`), `:230` (`NodeConnection`). Agent: `agent-bridge.service.ts:821-835`, `tool-schemas.ts:459-485` (descriptions say "HandleConnection"), `agent-bridge.spec.ts:695`, mcp `generated/tool-schemas.ts:753,771`, `AGENT_BRIDGE.md:125-126`, `README.md:184` |
| #5556 | `XYDrag.ts:86` `nodeClickDistance?` param, `:117` default 0, `:300` `.clickDistance(nodeClickDistance)`, so any 1px jitter suppresses the node click. No `preventNextClick`, and `dragStarted`/`autoPanStarted` are reset only at end (`:358-379`). Angular: input `ng-flow.component.ts:509-510` → `:815` → `FlowStore.nodeClickDistance` (`flow-store.service.ts:235`), never read. `drag.directive.ts:43-44,89` `ngFlowDragClickDistance`, never bound (`node-renderer.component.ts:99-103`). The input is dead. Example `kitchen-sink.component.ts:93,176,227,307,610-611` |
| #6168 | `XYDrag.ts:111-418`: every `update()` builds a new `drag()` and re-`.call()`s it (`:299,:417`). `drag.directive.ts:59-63,69-91` calls `update()` on every `ngOnChanges`. Upstream's nodes.spec touch-drag test (`nodes.spec.ts:150`) already passes for ng |
| #6117 | `XYHandle.ts:238-243` passes `previousConnection.to` (screen) into `finalConnectionState`. Angular: `FlowStore.connection` is a writable signal in **screen** coords (`flow-store.service.ts:261`), written by `cancelConnection`/`updateConnection`/`updateClickConnectPreview` (`:1084-1099`). `NgFlowService.connection` mirrors it (`ng-flow.service.ts:80`). `connection-line.component.ts:92-96` converts `to` by hand. `(connectEnd)` emits only the event (`ng-flow.component.ts:646`, `:923-925`; `handle.component.ts:216` drops the state). `(clickConnectEnd)` emits only the MouseEvent (`:651`, `:929-931`; emitted at `handle.component.ts:277,307` and `ng-flow.component.ts:1170-1172`). `(reconnectEnd)` already carries `connectionState` (`ng-flow.component.ts:658`, `edge-renderer.component.ts:810-813`). The angflow click-connect also fires `(connectStart)`/`(connectEnd)` (`handle.component.ts:264-268,278,308`), and reconnect drags fire neither (`edge-renderer.component.ts:780-813` passes no `onConnectStart`/`onConnectEnd`). Upstream does the opposite (`Handle/index.tsx:185-233`, `EdgeUpdateAnchors.tsx:73-97`). Generic host adapter `flow-props.ts:10-12` passes `undefined` as the state; `known-failures.ng.ts:31-48` |
| #6115 | System `types/panzoom.ts:46-47` (`paneClickDistance`, `selectionOnDrag`), `:65` `setClickDistance`. `XYPanZoom.ts:26-34` (no `pointerDrag`), `:165-167` (`clickDistance` = Infinity with `selectionOnDrag`), `:190-219` (handlers re-created only when `!userSelectionActive`, the 0.0.77 divergence), `:336-339,352`. `eventhandler.ts:173-194`: `onDraggingChange(true)` fires on every mousedown and the pan starts at once. Angular: input `ng-flow.component.ts:507` (default 0), `:814`, effect dependency `:899`, `panePointerDownPos` `:1068-1072`, manual distance check in `onPaneClick` `:1152-1158`, `:1250` `selectionOnDrag` and `:1261` `paneClickDistance` passed to `update()`. `FlowStore.paneClickDistance` `:234`. `pane.component.ts:147-198` starts a marquee on pointerdown with no threshold and emits `selectionStart` there (`:189`). `:200-212` marks `selectionInProgress` on the first move. Local `isLeftClickPan` `:13-14`. Examples `click-distance.component.ts:24-81` + `app.routes.ts:18,80`, `figma.component.ts:40`, `kitchen-sink.component.ts:92,175,227,306,606-607`. Specs `XYPanZoom.spec.ts:39`, `ng-flow.pane-click.spec.ts:381` |
| `fitView` → boolean | `graph.ts:381-412` returns `FitViewResult` (`types/general.ts:181-200`, `ZOOM_CLAMP_EPSILON` `graph.ts:378-379`). Angular `FlowStore.fitView`/`fitBounds` (`flow-store.service.ts:919-961`, `FitResolver` `:66-78`, `settlePendingFits` `:1216-1220`), `NgFlowService.fitView`/`fitBounds` (`ng-flow.service.ts:110-118,140-146`), `public-api.ts:226`. The instance types already say `boolean` (`types/general.ts:92` `FitView`, `:106` `fitBounds: FitBounds`), so they disagree with the implementation today. Agent `agent-bridge.service.ts:15,746-757,889-894` and `layout_nodes` `:1227-1238`. Generic page `viewport-transitions-node.component.ts:35` |
| #5927 | `utils/general.ts:233-235` numeric padding uses the legacy `(v - v/(1+p))/2`; `getViewportForBounds` has no defaults (`:341-348`); `graph.ts:401` `?? 0.1`; `FitBoundsOptions.padding: number` (`types/general.ts:257-258`); no `defaultFitViewPadding`. Angular `flow-store.service.ts:945,953` (`padding?: number`, `?? 0.1`), `ng-flow.service.ts:50` (`padding: 0.2` docstring), `:143`. Agent handlers accept numbers only (`agent-bridge.service.ts:747,891`); schemas `padding: { type: 'number' }` with no units (`tool-schemas.ts:317,608`); `AGENT_BRIDGE.md:179,185` |

## Porting rules

As B's plan Global Constraints, unchanged: system ports go one upstream change per commit, the body says `Ported from xyflow/xyflow#<PR> (<sha>)`, verbatim reference paths are never edited, and line endings are normalised before editing. **Divergences D1 keeps:** XYPanZoom's no-teardown `update()` and `.zoom`-stripping `destroy()` (`XYPanZoom.ts:142-162,249-257`), handlers re-created only when `!userSelectionActive` (`:190-219`), the filter's `!userSelectionActive` middle-button guard (`filter.ts:43-55`), `setDevWarnSink`, the `store.ts` carry-overs, and `getFitViewNodes`' size fallback (`graph.ts:365-368`). **Dropped by D1:** `FitViewResult` as an object (B's list said "D flips it").

## Design

### Task 0 — version bump and changelog merge

`packages/system` → 0.2.0, `packages/angular` → 0.4.0, `packages/mcp` → 0.1.0 (`npm version minor --no-git-tag-version`; nothing is published). In each `CHANGELOG.md`, the unreleased top entry (0.1.14 / 0.3.22 / 0.0.4) becomes the body of the new heading, marked *(unreleased)*, with a `### Breaking changes` section above it for D1. Regenerate the mcp snapshot, so `GENERATED_FROM_ANGULAR_VERSION` (`packages/mcp/src/generated/tool-schemas.ts:20`) reads `0.4.0`. No code change.

### 1. `Handle` → `HandleBounds` (#5987, `7b8d854ae`)

- **System:** rename the type in `types/handles.ts` and every use listed above. Keep angflow's `data?` and `floating?` fields. Redefine `NodeHandle` as upstream (`Omit<HandleBounds, 'nodeId' | 'width' | 'height'> & { width?; height? }`) and add the JSDoc. Remove the `toHandleBounds` fallback from `getEdgePosition`: angflow's `parseHandles` always fills `handleBounds` when `node.handles` is set (`store.ts:179-212`), and upstream calls the fallback dead. Its removal also stops `getEdgePosition` mutating `node.handles`.
- **Angular:** `public-api.ts` exports `HandleBounds` and `NodeHandle` and drops `SystemHandle`. `types/edges.ts` and the five edge components use `HandleBounds`. The three specs and the `typed-handles` example are updated.
- **API:** `Handle` / `SystemHandle` → `HandleBounds`. New export: `NodeHandle` (react appendix row 61).
- **Agent/mcp:** none (`get_internal_node` returns `handleBounds` data, not the type name).
- **Tests:** type-only; `tsc --noEmit` in both packages and the builds. The existing `connection-line` / `edge-renderer` data-enrichment specs still pass with the renamed type. Add one `getEdgePosition` vitest: a node with `handles` but no measured DOM gets positions through `parseHandles`.
- **Prerequisites:** none. It goes first because later items touch the same files.

### 2. `getNodeConnections({ nodeId, type?, handleId? })` / `NodeConnection` (#6114, `f9420bc45`)

- **System:** remove `HandleConnection` and use `NodeConnection` everywhere (`ConnectionLookup`, `connections.ts`, `store.ts`). Add `getConnectionLookupKey` and `getConnectionsFromLookup` to `utils/connections.ts`, verbatim.
- **Angular:** `NgFlowService.getNodeConnections(params: { nodeId: string; type?: HandleType | null; handleId?: string | null }): NodeConnection[]` via `getConnectionsFromLookup`. Delete `getHandleConnections`. `selectNodeConnections` takes the same params object; delete `selectHandleConnections`. Angular has no `useNodeConnections` `onConnect`/`onDisconnect`, so one param shape serves both. `NgFlowInstance` (`types/general.ts:177-178`) and `FlowStore.connectionLookup`'s type (`ConnectionLookup`) follow. `public-api.ts` drops `HandleConnection`. Fix the `README.md:184` row. The generic-test override `examples/angular/src/app/generic-tests/overrides/nodes/components/connection-updates-node.component.ts:24` changes `selectNodeConnections('a')` to `selectNodeConnections({ nodeId: 'a' })`. Its comment (`:4-8`) keeps the NOT COVERAGE note and maps React's `useNodeConnections({ id: 'a', … })` to the new params object.
- **API:** `getHandleConnections({nodeId,type,id})` → `getNodeConnections({nodeId,type,handleId})`. `getNodeConnections('a')` → `getNodeConnections({ nodeId: 'a' })`. `selectHandleConnections` → `selectNodeConnections({…})`. `HandleConnection` → `NodeConnection`.
- **Agent/mcp:** remove `get_handle_connections` (handler, schema, `agent-bridge.spec.ts:695` case, `AGENT_BRIDGE.md:126`). `get_node_connections` gains optional `type` (`'source' | 'target'`) and `handleId`. Its description says it returns `NodeConnection` objects (`Connection & { edgeId }`). A `handleId` without a `type` fails with `-32602`: upstream's key silently ignores it, which an agent would misread as "no connections". Update `AGENT_BRIDGE.md:125` and regenerate the snapshot.
- **Tests:** vitest for `getConnectionsFromLookup` (node, type, type+handle, handle without type ignored); service and signal tests for each param combination; agent spec for the new params, the `-32602` case and the removed tool (`-32601`). No ng e2e: `connection-hooks.spec.ts` is React-only (`:6`).
- **Prerequisites:** item 1 (it shares `types/general.ts`).

### 3. `nodeClickDistance` removed; `preventNextClick` (#5556, `725baeb5f`)

- **System:** hand-port the XYDrag hunks:
  - drop `nodeClickDistance` from `DragUpdateParams` and `update()`;
  - `clickDistance(Infinity)`;
  - `initialMousePosition`, and `Math.hypot` from it for the threshold;
  - reset `dragStarted`/`autoPanStarted` on `start`;
  - `preventNextClick` (a capture-phase window click listener, removed by `setTimeout(0)`; a timer that schedules logic is allowed by zoneless rule 3), called on `end` when `releasedOutside || nodePositionsChanged`.

  Keep angflow's abort path (`XYDrag.ts:358-372`: rAF cancel plus the `dragging:false` reset) and B's #6097 drag-item changes.
- **Angular:** delete `[nodeClickDistance]` (`ng-flow.component.ts:509-510`), its mirror (`:815`), `FlowStore.nodeClickDistance` (`:235`) and `ngFlowDragClickDistance` (`drag.directive.ts:43-44,89`). Update kitchen-sink.
- **Behaviour change:** only one. A press that moves less than `nodeDragThreshold` now fires `(nodeClick)`. Today d3-drag's `clickDistance(0)` suppresses it on 1px of jitter. Releasing a moved drag outside the node already produces no click today: d3-drag's window capture listener swallows the click after any movement. `preventNextClick` keeps that once `clickDistance` is `Infinity`.
- **Agent/mcp:** none.
- **Tests:**
  - New `system/src/xydrag/XYDrag.spec.ts` (jsdom MouseEvents):
    - jitter under the threshold leaves the click alone (fails today);
    - a drag that moved nodes suppresses exactly the next click, and the listener is gone after a task;
    - a moved drag released outside the node suppresses the click dispatched to the ancestor (passes before and after the change, and pins it);
    - the threshold is measured from the press point.
  - Angular vitest: `(nodeClick)` fires after a 1px jitter (fails today). A node drag released over the pane emits no `(paneClick)` (regression guard).
  - e2e that must stay green: `nodes.spec.ts:13,97,118,201`, `click-connect.spec.ts:89`.
- **Prerequisites:** none. Required by item 4.

### 4. XYDrag binds once per element (#6168, `d2bb47dc0`)

- **System:** hand-port the restructure on top of item 3:
  - the `drag()` instance is built once in the `XYDrag` closure;
  - `update()` only stores `noDragClassName`/`handleSelector`/`isSelectable`/`nodeId`, and rebinds only when `domNode` changes (`d3Selection?.on('.drag', null)` then `.call`);
  - the filter returns false without a bound node;
  - `destroy()` clears `d3Selection` and `domNode`.

  Keep angflow's touch-multitouch abort check (`XYDrag.ts:322-324`, `sourceEvent.type === 'touchmove'`) instead of porting `isTouchEvent` (e9286291e).
- **Angular:** `drag.directive.ts` is unchanged in shape. Its comment at `:74-77` ("re-bind on every input change") is rewritten: disable → `destroy()`, re-enable → `update()` rebinds because `destroy()` cleared `domNode`.
- **Agent/mcp:** none.
- **Tests:**
  - `XYDrag.spec.ts`: spy on the element's `addEventListener`/`removeEventListener`. A second `update()` with the same element adds and removes nothing, and new params (`isSelectable`, `handleSelector`) apply to the next gesture. `destroy()` followed by `update()` rebinds. A touch gesture that is in progress survives an `update()`.
  - e2e that must stay green: `nodes.spec.ts:150` (CDP touch drag).
- **Prerequisites:** item 3.

### 5. Connection-end payloads, `to` in flow coordinates (#6117, `63b6e0295`)

- **System:** `XYHandle.ts:240` adds `to: pointToRendererPoint(previousConnection.to, getTransform())` to `finalConnectionState`. Port the doc updates on `ConnectionInProgress` (`types/general.ts:344,352,360`: `from`/`to` are in flow coords, `pointer` is in screen coords). `getClickConnectionState` (angflow-only) keeps emitting screen `to`, like XYHandle's in-progress states.
- **Angular store, as upstream's React store (`deriveConnection`):**
  - The writable signal becomes `FlowStore.rawConnection = signal<ConnectionState>({ ...initialConnection })` (screen `to`). `updateConnection` / `updateClickConnectPreview` / `cancelConnection` write it and set the private preview flag (`connectionIsClickPreview`, `:1082`). `reset()` already calls `cancelConnection()` (`:1143`), so it resets `rawConnection` to `initialConnection` and clears the flag.
  - `FlowStore.connection` becomes a read-only `computed`: `raw.inProgress ? { ...raw, to: pointToRendererPoint(raw.to, transform()) } : raw`. It recomputes on a viewport change while a connection is in progress.
  - `updateNodePositions`' from-node follow (`:547-572`) and `getStoreItems().connection` use the raw state.
  - `connection-line.component.ts:92-96` drops its manual conversion.
  - The specs that call `store.connection.set(…)` (12 writes in 5 files) switch to `updateConnection`.
- **Angular outputs:**
  - `(connectEnd)`: `output<{ event: MouseEvent | TouchEvent; connectionState: FinalConnectionState }>` (the same shape as `(reconnectEnd)`). `handle.component.ts:216` forwards the state.
  - `(clickConnectEnd)`: `output<{ event: MouseEvent; connectionState: FinalConnectionState }>`. The state comes from a new public `FlowStore.getFinalClickConnectionState()`, built like upstream `Pane`/`Handle` `onClick`:
    - the source is the **derived** `connection()` (flow-coordinate `to`), but only while `isClickConnectPreview()` is true. Otherwise (no pointer move since arming, or a real connection drag owns the line) the source is `initialConnection`. A concurrent drag's state therefore never ends up in a click-end payload;
    - it is a copy without `inProgress`, with `toPosition: toHandle ? toHandle.position : null`;
    - it contains `ConnectionState` fields only. The preview flag is a private store field (`flow-store.service.ts:1076-1109`) and is never copied;
    - it is a **shallow** copy, not `structuredClone`, because node `data` holding functions would throw `DataCloneError`.
  - When the state is read and when it is cleared, per site:

    | Site | Today | D1 |
    |---|---|---|
    | Handle second click, completing (`handle.component.ts:279-308`) | `onConnect`, then clear `connectionClickStartHandle` (`:306`), then emit (`:307`) | `onConnect`; read state; clear; emit `{ event, connectionState }` |
    | Handle re-click, disarming (`:270-278`) | clear (`:276`), then emit (`:277`) | read state; clear; emit |
    | Pane click (`ng-flow.component.ts:1170-1172`) | emit (`:1171`), then clear (`:1172`) | read state; emit; clear (order kept) |

    Clearing `connectionClickStartHandle` makes `ClickConnectPreview` detach and call `cancelConnection()`. That runs in an effect, later. Reading first makes the payload independent of that timing.
  - `FlowStore.onConnectEnd` / `onClickConnectEnd` are typed with system `OnConnectEnd`.
- **Which interactions fire `(connectStart)`/`(connectEnd)`:** match upstream (Decisions). Click-connect stops firing them (`handle.component.ts:264-268,278,308`). Reconnect drags start firing them, as `EdgeUpdateAnchors` does (`EdgeUpdateAnchors.tsx:73-77,96`). `(reconnectStart)` moves from pointerdown (`edge-renderer.component.ts:778`) into XYHandle's `onConnectStart` callback and is emitted there **first**, with the original pointerdown event. `(connectStart)` follows. `onConnectEnd` is passed through to `(connectEnd)`. Behaviour note: like upstream, `(reconnectStart)` now waits for `connectionDragThreshold`.
- **API:** `(connectEnd)` / `(clickConnectEnd)` payload shapes; `(reconnectEnd).connectionState.to` and `NgFlowService.connection().to` are in flow coordinates; `FlowStore.connection` is read-only (`FlowStore.rawConnection` is new).
- **Examples:**
  - `add-node-on-edge-drop.component.ts:31,60` destructures `{ event }`;
  - `touch-device`, `cancel-connection`, `reconnect-edge` are checked;
  - the generic host adapter `flow-props.ts:12` becomes `({ event, connectionState }) => cb(event, connectionState)`. Its comment (`:10-11`) now says the output's `{ event, connectionState }` is unpacked into upstream's `(event, connection)` arguments. `flow-props.spec.ts:31-37` is updated.
- **Agent/mcp:** none (the bridge emits no connection events).
- **Tests:**
  - e2e: delete both `pane click cancels a pending connection` entries (`known-failures.ng.ts:31-48`). The spec JSON-parses the state and expects `isValid: null, toNode: null, toHandle: null, toPosition: null` and no `inProgress`.
  - vitest:
    - XYHandle final `to` at transform `[100, 50, 2]`;
    - `connection().to` is derived and recomputed on pan;
    - each of the three click-end sites emits flow-coordinate state, both with a preview and without (no pointer move); the payload has no `inProgress` and no extra keys;
    - a click-end while a real drag is in progress doesn't carry the drag's state;
    - `reset()` restores `rawConnection` to `initialConnection`;
    - `(connectEnd)` carries the state;
    - a reconnect fires `(reconnectStart)` → `(connectStart)` … `(connectEnd)` → `(reconnectEnd)` (XYHandle's order, `XYHandle.ts:245-248`);
    - the connection-line path is unchanged.
- **Prerequisites:** item 1 (`HandleBounds` in `ConnectionInProgress`).

### 6. `paneClickDistance` → `paneDragThreshold` (#6115, `d0338b48a` = b1ad016 + 59dffc0ec + 2bc771f5b)

- **System (hand-port):**
  - `PanZoomUpdateOptions`: `paneDragThreshold: number` replaces `paneClickDistance` and `selectionOnDrag`. `setClickDistance` is removed.
  - `ZoomPanValues`: `pointerDrag` replaces `usedRightMouseButton`.
  - `update()`: `clickDistance(dragThreshold)`, and the new handler params.
  - `eventhandler.ts` gets upstream's `startMove` / `startPointerDrag` / `isPointerMove` / `getPointerPosition` and the start/zoom/end handlers. Below the threshold they restore `__zoom` and skip `onTransformChange`. A multi-touch or lost touch starts at once. The end handler returns before `onDraggingChange(false)` / `onPanZoomEnd` when nothing moved.
  - `isLeftClickPan` is exported from `xypanzoom/utils.ts` / `index.ts`.
- **Interaction with angflow's divergences:**
  1. Handlers are re-created only when `!userSelectionActive` (`XYPanZoom.ts:190-219`). A threshold change during a marquee therefore takes effect after it. No pan gesture can start during a marquee anyway, because the filter rejects every event while `userSelectionActive` (`filter.ts:70`).
  2. Box selection: the marquee's pointerdown is `preventDefault`ed (`pane.component.ts:156-157`), so d3-zoom never sees a mousedown and `pointerDrag` stays `null`. Auto-pan transforms during a marquee take the `!pointerDrag` path and still reach `onTransformChange`; `XYPanZoom.spec.ts:76` must stay green. The middle-button `!userSelectionActive` guard is unchanged.
  3. Touch: the touchstart capture handler (`pane.component.ts:94-106`) still kills d3's touchstart for a selecting touch, so `pointerDrag` is created only for touches that pan.
  4. `onPaneContextMenu` is not passed to `update()` by angflow (the pane handles `contextmenu` itself, `ng-flow.component.ts:1184`). The right-click hunk is ported but inert (see Non-goals).
  5. `(moveStart)`/`(moveEnd)` (`ng-flow.component.ts:1208-1222`) and `paneDragging` no longer fire for a pane click below the threshold. This is upstream behaviour; changelog.
- **Angular:**
  - `paneDragThreshold = input(1)` replaces `:507`, and `FlowStore.paneDragThreshold = signal(1)` replaces `:234`.
  - The effect dependency is updated. `updatePanZoomOptions` passes `paneDragThreshold` and drops `selectionOnDrag`/`paneClickDistance` (`:1250,:1261`).
  - `onPaneClick` drops its manual distance check and `panePointerDownPos` (`:1068-1072,:1152-1158`). As in upstream React's Pane, d3-zoom's click distance now suppresses the click after a real pan.
  - `pane.component.ts`:
    - the marquee waits for `Math.hypot(current − screenStart) > (selectionKeyActive ? 0 : paneDragThreshold)` before it marks `moved`/`selectionInProgress`, draws the rect or auto-pans (upstream `Pane onPointerMove`);
    - `(selectionStart)` moves from pointerdown (`:189`) to the threshold crossing, and `(selectionEnd)` fires only after a crossing;
    - the local `isLeftClickPan` is replaced by the system export;
    - `userSelectionActive` is still set on pointerdown, because the box-select guard depends on it (kept divergence). On a press that never crosses the threshold, it is not left set. `finishSelection` clears it and `userSelectionRect` on pointerup or pointercancel (`pane.component.ts:345-347`). Because `moved` stays false, `selectionInProgress` and `nodesSelectionActive` are never set and `(selectionEnd)` isn't emitted, so the following click reaches `onPaneClick` and fires `(paneClick)`. The `ngOnDestroy` path (`finishSelection(null, false)`) clears it the same way.
- **Examples:**
  - `click-distance` mirrors upstream `ClickDistance` (`paneDragThreshold`, default 0 in the example);
  - `figma.component.ts:40` → `[paneDragThreshold]="100"`;
  - kitchen-sink control;
  - **port upstream `DragThreshold`** as `drag-threshold` (`examples/react/src/examples/DragThreshold`, added by #5556/#6115): it is the manual test bed for items 3 and 6.
- **API:** `[paneClickDistance]` (default 0) → `[paneDragThreshold]` (default 1). `PanZoomInstance.setClickDistance` removed. `FlowStore.paneClickDistance` → `paneDragThreshold`.
- **Agent/mcp:** none.
- **Tests:**
  - System vitest, new `xypanzoom/eventhandler.spec.ts`, driving the handlers with fake `D3ZoomEvent`s:
    - a mouse press below the threshold restores `__zoom`, calls no start / dragging / end, and a click follows;
    - crossing the threshold starts the move and dragging;
    - a threshold of 0 starts immediately;
    - single touch below and above the threshold; touch never toggles dragging;
    - a second touch starts immediately;
    - a wheel zoom while the button is held becomes the new resting transform;
    - a right-click pan without movement still reports a context menu to a passed handler.
  - Angular vitest: no marquee, rect or `(selectionStart)` below the threshold, and one above it; after a below-threshold press `userSelectionActive` is false and `(paneClick)` fires; the selection key makes the threshold 0; rewrite `ng-flow.pane-click.spec.ts:381` for the threshold.
  - e2e that must stay green:
    - `pane.spec.ts:58,82,185,219,237,263,293`;
    - `click-connect.spec.ts:39,70`;
    - `nodes.spec.ts:20,51`;
    - `viewport.spec.ts:34` (all four transitions, `fit view` included, are interrupted by a wheel scroll, which takes the non-pointer path);
    - `viewport.spec.ts:59` "fit view called again during its transition settles when the last fit ends";
    - `viewport.spec.ts:81` "an interrupted fit view does not run again when a node is dragged".

    `viewport.spec.ts:73` is Vue-only (skipped for ng). `props.spec.ts` has only `colorMode` tests (`:6-25`), so `paneDragThreshold = 1` doesn't affect it.
  - The generic host comment at `flow-props.ts:10-11` ("connection stays undefined until sub-project D") is replaced in item 5, when the adapter starts forwarding `connectionState`. No generic page sets `paneClickDistance`, so item 6 needs no adapter change.
  - **Touch testing:**
    - automated: the CDP tests `pane.spec.ts:219,237` and `nodes.spec.ts:150` (chromium);
    - manual on `drag-threshold`, with Chrome DevTools touch emulation **and** one real touch device:
      - a tap and a tap with jitter below the threshold fire `(paneClick)` and don't pan;
      - a drag pans only past the threshold;
      - a pinch zooms immediately;
      - with the selection key held, a touch marquee starts at 0px;
      - a touch node drag is unaffected;
      - `paneDragThreshold = 0` behaves like 0.3.x panning.
- **Prerequisites:** B's #5850 / #5922 / #5902 / #6119 (present). Item 3 first, so node-click and pane-click suppression change in separate commits.

### 7. `fitView` / `fitBounds` resolve `boolean` (#6064 major remainder)

- **System:**
  - `fitViewport` returns `Promise<boolean>`, as upstream (`graph.ts` on `upstream/main` 376-409): `true` when there is nothing to fit, otherwise `panZoom.setViewport(...)`.
  - `FitViewResult` and `ZOOM_CLAMP_EPSILON` are deleted.
  - To keep the bridge's numbers identical, the viewport computation moves into an angflow-only `@internal` export `getFitViewport(params, options): Viewport | null` (`null` = nothing to fit). `fitViewport` calls it.
- **Angular:**
  - `FlowStore.fitView`/`fitBounds` and the fit chains are typed `boolean`. With no panZoom they resolve `false`, like the React store. `settlePendingFits` resolves `false`.
  - `NgFlowService.fitView(): Promise<boolean>` and `fitBounds(bounds, options?: FitBoundsOptions & { minZoom?; maxZoom? }): Promise<boolean>`. `minZoom`/`maxZoom` are an angflow extension that the agent uses. `ease`/`interpolate` now pass through, as upstream.
  - `public-api.ts` drops `FitViewResult`. The instance types (`types/general.ts:92,106`) now match the implementation.
  - Generic page `viewport-transitions-node.component.ts`:
    - drop the `FitViewResult` import (`:2`);
    - rewrite the comment (`:7`) as "every helper resolves a boolean";
    - `Transition` becomes `() => Promise<boolean>`;
    - `track()` does `const ended = await transition();` in place of the `:35` shape check.
- **Agent:**
  - New `NgFlowService.measureFitView(options)` / `measureFitBounds(bounds, options)` return `{ zoom: number; clamped: boolean } | null` from the same inputs as the fit: `getFitViewport` / `getViewportForBounds`, the effective min/max zoom and the padding default. `null` means nothing to fit or no panZoom. Both carry `@internal` in their JSDoc and are documented as bridge helpers, like `hasOnBeforeDeleteHook` (`ng-flow.service.ts:788-795`). README and the migration guide don't list them.
  - The `fit_view`, `fit_bounds` and `layout_nodes` handlers:
    1. call `measure*` **before** starting the fit;
    2. then `await` the fit for `ended`;
    3. return `{ zoom: m?.zoom ?? null, clamped: m?.clamped ?? false, ended }`.

    Measuring first means an interrupted fit, or a graph change during the animation, still reports the target `zoom`/`clamped` that today's `FitViewResult` reports. That keeps results byte-identical, including `zoom: null` for the empty and uninitialised cases (`AGENT_BRIDGE.md:189`).
  - `AGENT_BRIDGE.md`: `:189` becomes "fit result", no longer a library type, and `:205`'s `fit` shape is corrected to `{ zoom, clamped, ended } | null`.
  - The schema descriptions don't change in this item, so the snapshot is regenerated in item 8.
- **Tests:**
  - `graph.spec`: `fitViewport` booleans, and `getFitViewport` returns `null` for an empty or filtered set;
  - the `flow-store` shared-promise and destroy tests flip to `boolean`;
  - the agent spec's `fit_view`/`fit_bounds`/`layout_nodes` result tests (ended, interrupted, empty, clamped) pass unchanged. A new case interrupts a fit and asserts that `zoom`/`clamped` are still the target values;
  - e2e that must stay green: `viewport.spec.ts:26-81`.
- **Prerequisites:** none. It lands before item 8 so the padding change touches only one fit shape.

### 8. Numeric padding = pixels, default `'5%'` (#5927, `82e24caf8` + `69dc311`/`7b52b50`)

- **System:**
  - `constants.ts` gains `defaultFitViewPadding = '5%'`, used by `fitViewport` / `getFitViewport`;
  - `parsePadding` reads a number as `Math.floor(padding)` px;
  - `getViewportForBounds` gets the defaults `minZoom = 0`, `maxZoom = Infinity`, `padding = 0`;
  - `FitBoundsOptions.padding: Padding`.
- **Angular:** `FlowStore.fitBounds` and `measureFitBounds` default to `defaultFitViewPadding`. `padding?: Padding`. The docstring at `ng-flow.service.ts:50` becomes `padding: '10%'`. The `[fitViewOptions]` and Controls `fitViewOptions` docs state the units.
- **Agent/mcp:**
  - `fit_view` / `fit_bounds` `padding: { type: ['number', 'string'] }` (the type-array form is already used at `tool-schemas.ts:141`). The description reads: *"Pixels when a number (40 = 40px per side). A string may be a percentage of the viewport ('10%') or pixels ('20px'). Default '5%'. Not a ratio: 0.1 is 0px."*
  - The handlers accept a finite number ≥ 0 or a string matching `^\d+(\.\d+)?(px|%)$`; anything else is `-32602`. The system would only `console.error` and use 0.
  - The schema intentionally leaves out the library's per-side object form (`{ top, right, bottom, left, x, y }`). It keeps the tool surface simple for LLM providers. An object is `-32602`, and `AGENT_BRIDGE.md` says so.
  - Update `AGENT_BRIDGE.md:179,185` and regenerate the snapshot.
- **Tests:**
  - `general.spec`: `parsePadding` for `20`, `'10%'`, `'20px'` and an invalid value. `getViewportForBounds` with its new defaults, and with object padding (`{ x: 20, top: '10%' }` and a mixed per-side object), to pin that numeric sides are now pixels;
  - `graph.spec`: the default is 5%;
  - the agent spec: string padding passes through, an invalid string or an object gets `-32602`, a number is pixels;
  - no e2e covers it.
- **Prerequisites:** item 7.

### 9. Release docs

- Changelogs: the 0.4.0 / 0.2.0 / 0.1.0 entries, with the migration guide below.
- Report: §2 rows `nodeClickDistance` and `(connectEnd)`, and §3 rows #5987, #6114, #5556, #6117, #6115, #5927 and `setViewport`, marked D1 ✓ with SHAs. §5 row D is split into D1/D2/D3, plus a "D1 — results" section.
- `known-failures.ng.ts`: the two colour-mode entries keep `owner: 'D'`, and their `reason` names D2.
- Memory: roadmap status.

## Order of work

| # | Item | Prerequisites | Unblocks |
|---|---|---|---|
| 0 | Version bump + changelog merge | — | all changelog entries |
| 1 | #5987 `HandleBounds` | — | 2, 5 (shared types) |
| 2 | #6114 `NodeConnection` + agent tool | 1 | — |
| 3 | #5556 `preventNextClick` | — | 4 |
| 4 | #6168 bind once | 3 (appendix: its diff is a restructure on top of #5556) | — |
| 5 | #6117 payloads + flow-coords connection | 1 | the 2 known failures |
| 6 | #6115 `paneDragThreshold` | 3; B's #5850/#5922/#5902/#6119 | — |
| 7 | `fitView`/`fitBounds` → boolean | — | 8 |
| 8 | #5927 pixel padding | 7 | — |
| 9 | Release docs | 0–8 | — |

#5989 and #6126 are not relevant: they fix regressions from #5972, which angflow doesn't port (appendix row 16). Each item gets a full checkpoint after it: vitest in all three packages, typecheck, lint, the builds, and the e2e verdict.

## Migration guide (0.4.0 changelog, "Breaking changes")

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

- jittery node clicks below `nodeDragThreshold` fire `(nodeClick)`;
- a pane press below `paneDragThreshold` fires no `(moveStart)`/`(moveEnd)`;
- `(selectionStart)` fires when the marquee crosses the threshold, not on press;
- click-connect no longer fires `(connectStart)`/`(connectEnd)`;
- reconnect drags fire them, and `(reconnectStart)` waits for `connectionDragThreshold`;
- `FlowStore` (public):
  - `connection` is read-only (new `rawConnection`), and `getFinalClickConnectionState()` is new;
  - `paneDragThreshold` replaces `paneClickDistance`, and `nodeClickDistance` is gone;
  - `fitView`/`fitBounds` resolve `boolean`.

System 0.2.0 lists the type-level changes:

- `HandleBounds`, `NodeHandle`, `HandleConnection` removed;
- `getConnectionLookupKey` / `getConnectionsFromLookup`;
- `DragUpdateParams.nodeClickDistance` removed;
- `PanZoomUpdateOptions.paneDragThreshold`, `setClickDistance` removed, `isLeftClickPan`;
- `fitViewport` → `boolean`, `FitViewResult` removed;
- `defaultFitViewPadding`, pixel `parsePadding`, `getViewportForBounds` defaults, `FitBoundsOptions.padding: Padding`;
- `toHandleBounds` fallback removed from `getEdgePosition`.

mcp 0.1.0 lists:

- `get_handle_connections` removed;
- `get_node_connections` `type?` / `handleId?`;
- `fit_view` / `fit_bounds` padding units.

## Non-goals

| Item | Why not D1 | Goes to |
|---|---|---|
| `forceColorMode`, `light-dark()`, `@layer xyflow`; the 2 colour-mode known failures | Decided split | D2 |
| `NodeChangeset` / `EdgeChangeset` | Decided split | D3 |
| `selectNode`/`selectEdge`, `changeParent`, `xy-theme.css`, other missing examples, #5996 subset + #6109 | Features / perf | E |
| `connectionInProgress` is never passed to `XYPanZoom.update()` (`ng-flow.component.ts:1241-1262`; the filter's non-wheel block at `filter.ts:75` is dead in angflow). Found while verifying | A bug, not an API change; no failing test | E (or a B-style follow-up) |
| Right-click-pan context-menu parity: the pane emits `(paneContextMenu)` itself, even after a right-drag pan. #6115's system hunk lands but stays inert | Needs `onPaneContextMenu` wiring through XYPanZoom and a pane change; no failing test | E |
| Upstream event typings (7976e13e7, `XYFlowSourceEvent`) and the XYDrag generics | Typing-only, large diff; the hand-ports work without them | Later typing pass |
| Escape / right-click cancelling a click-connect emit no `(clickConnectEnd)` (`key-handler.directive.ts:121`, `ng-flow.component.ts:1184-1189`) | Angflow-only cancel paths; upstream has no equivalent to match | Unchanged |

## Risks

- **#6115 hand-merge.** The `pointerDrag` state machine resets d3's `__zoom` below the threshold. That code sits next to angflow's no-teardown `update()` and the 150 ms pan-on-scroll end timer. Mitigation: handler-level vitest, the e2e list in item 6, and the manual touch matrix.
- **Silent payload changes.** `(connectEnd)` and `(clickConnectEnd)` handlers that read `$event.target` keep compiling in untyped templates and fail at runtime. Numeric padding changes silently: `0.1` becomes 0px. Mitigation: these two are listed first in the migration guide. The agent schema states units, so an old cached catalog is the only way an agent sends a legacy ratio.
- **XYDrag restructure.** Angflow's abort path and B's #6097 drag-item changes must survive two hand-ports. Mitigation: the new `XYDrag.spec.ts` covers abort and unselected-node drags too.
- **Derived connection.** Recomputing on every viewport change costs only while a connection is in progress. Code that wrote `store.connection` breaks at compile time (it becomes a `computed`).
- **Connect-event scope** (Decisions) changes what existing apps see in `(connectStart)`/`(connectEnd)` and when `(reconnectStart)` fires.

## Open questions

None. The two from the first draft are resolved in the Decisions table: connect-event scope matches upstream, and the fit-measure methods are added as `@internal`.

## Done when

- Items 0–9 have landed, each with its failing-first test.
- Vitest in system/angular/mcp, `pnpm typecheck`, `pnpm lint`, the three builds and the mcp schema-drift test are green.
- `pnpm --filter playwright test:angular` passes. Both `pane click cancels a pending connection` entries are removed and pass. `known-failures.ng.ts` holds exactly the 2 colour-mode entries (`owner: 'D'`, reason naming D2). `check-known-failures` reports 0 STALE and 0 NOT MATCHED.
- The manual touch matrix (item 6) is recorded in the D1 results section.
- `grep -rn "SystemHandle\|HandleConnection\|getHandleConnections\|selectHandleConnections\|get_handle_connections\|nodeClickDistance\|paneClickDistance\|setClickDistance\|FitViewResult" packages/{system,angular,mcp}/src examples/angular/src README.md packages/angular/AGENT_BRIDGE.md` returns only changelog/migration text.
- Versions read 0.2.0 / 0.4.0 / 0.1.0, unpublished. The changelogs carry the merged B/C entries plus D1's breaking section. `AGENT_BRIDGE.md`, the mcp snapshot (stamped 0.4.0), the report and memory are updated.
