# React wrapper changelog 12.10.3 -> 13.0.3 vs @angflow/angular

Paths below are relative to packages/angular/src/lib unless noted. "SYS" = substance lives in @xyflow/system; Angular inherits it on a system bump, wrapper plumbing noted where needed.
Kinds: BUG = bug fix, FEAT = feature, BRK = breaking, PERF = perf.

| # | Version | Entry | Kind | Status | Angular evidence | Effort |
|---|---------|-------|------|--------|------------------|--------|
| 1 | 13.0.3 | MiniMap `zoomStep` doc default is 1 | doc | PRESENT | components/minimap/minimap.component.ts:143 `zoomStep = input(1)` | none |
| 2 | 13.0.2 | Arrow-key move announces NEW position (a11y live region) | BUG | ABSENT | `store.ariaLiveMessage` (services/flow-store.service.ts:295) is rendered in ng-flow.component.ts:244 but NEVER written anywhere; `node.a11yDescription.ariaLiveMessage` key not in config either. Arrow keys handled in directives/key-handler.directive.ts:225 (handleArrowKey) with no announce, no shift x4, no snap/extent post-read. So the whole announcement feature (12.x too) is missing, not just the stale-position bug. | small |
| 3 | 13.0.2 | EdgeToolbar uses elevated edge zIndex | BUG | PARTIAL | components/edge-toolbar/edge-toolbar.component.ts:69 uses `edge.zIndex + 1` (hand-rolled, no selected elevation, ignores node z / zIndexMode). Upstream uses system `getElevatedEdgeZIndex`. Root cause bigger: see #25 (Angular edge-renderer never elevates edges). | small |
| 4 | 13.0.1 | npm readme | n/a | N/A | packaging | - |
| 5 | 13.0.0 | BRK: `getHandleConnections` removed; `getNodeConnections({nodeId,type?,handleId?})`; `HandleConnection` type -> `NodeConnection` | BRK | PARTIAL | services/ng-flow.service.ts:882 `getHandleConnections({nodeId,type,id})` and :893 `getNodeConnections(nodeId)` (positional string), signals `selectNodeConnections/selectHandleConnections` :936/:949; types/general.ts:173-174; agent/agent-bridge.service.ts:823,833 + tool-schemas.ts:466 call them (AGENT_BRIDGE.md + mcp snapshot ripple). Angular keeps the old shape. | small (breaking) |
| 6 | 13.0.0 | BRK: `onConnectEnd`/`onReconnectEnd` `to` in flow coords | BRK/BUG | SYS | One-liner in system XYHandle (dae45aa82). Angular passes callbacks straight through (flow-store onConnectEnd); components/connection-line/connection-line.component.ts:80 treats in-progress `connection.to` as SCREEN coords - that is unchanged (derived `to` lives only in final state). Inherited on system bump; document it. | trivial |
| 7 | 13.0.0 | BRK: parents no longer must precede children in nodes array | BRK(relax) | SYS | system adoptUserNodes (82aabad9d). Angular calls adoptUserNodes (services/flow-store.service.ts:441). Inherited. | none |
| 8 | 13.0.0 | BRK: default fitView/fitBounds padding 5% (`'5%'`), numeric padding now PIXELS | BRK | PARTIAL | SYS for fitViewport. Angular-owned bits: services/ng-flow.service.ts:146 `fitBounds` hard-codes `padding ?? 0.1` (ratio semantics) and getViewportForBoundsInternal :1212; controls.component.ts passes fitViewOptions; agent tool-schemas padding at :168/:313/:601 are ratios. Semantics flip silently for every consumer passing `padding: 0.2`. | small |
| 9 | 13.0.0 | Remove deprecated `useHandleConnections` | BRK | N/A | Angular has `selectHandleConnections`/`getHandleConnections` (see #5), no deprecated hook | - |
| 10 | 13.0.0 | `useStore` -> useNodesStore/useEdgesStore/... (6 stores) + perf "separate stores", "lib entry removed" | BRK/PERF | N/A | React/zustand-specific. FlowStore is already signal-based | - |
| 11 | 13.0.0 | `paneClickDistance` -> `paneDragThreshold` (default 1; gates pan AND selection start, every mouse button) | BRK/FEAT | ABSENT | container/ng-flow/ng-flow.component.ts:506 `paneClickDistance = input(0)`; used only in onPaneClick (:1122) as a click-vs-drag filter; never gates pan/marquee start. System XYPanZoom here still takes `paneClickDistance` (system/src/xypanzoom/XYPanZoom.ts:108) | medium (SYS + pane.component marquee threshold + XYPanZoom param) |
| 12 | 13.0.0 | BRK: system colour mode default; `colorMode` prop replaced by `forceColorMode` (CSS `light-dark()`, `color-scheme`, `.dark` rules removed) | BRK | ABSENT | ng-flow.component.ts:514 `colorMode = input<ColorMode>('light')`, :284 resolvedColorMode, host `[class.dark]/[class.light]` :172; ng-flow.css has its own dark rules. Needs system CSS (init.css `light-dark()`) + removal/rename of `colorMode`, drop matchMedia listener | medium |
| 13 | 13.0.0 | BRK: remove `nodeClickDistance` (click suppressed only if drag actually moved node) | BRK | ABSENT | ng-flow.component.ts:509 input; flow-store :219; directives/drag.directive.ts:44,89 `ngFlowDragClickDistance`; system XYDrag still supports it | small (SYS + delete 3 plumbing sites) |
| 14 | 13.0.0 | Type `Handle` -> `HandleBounds` rename | BRK | SYS | types/edges.ts:11,116,125 import `Handle`; public-api.ts:184 `Handle as SystemHandle`, :173 `NodeHandleBounds`. Compile break on system bump; mechanical rename | trivial |
| 15 | 13.0.0 | BRK: fitViewOptions.padding numbers are pixels (0.1 ~ 4.5%) | BRK | SYS (see #8) | same as #8 | - |
| 16 | 13.0.0 | Min React 18; UMD removal; style.css import path | BRK | N/A | n/a (Angular peer >=19, ESM only) | - |
| 17 | 13.0.0 | BRK: `onNodesChange`/`onEdgesChange` receive `NodeChangeset`/`EdgeChangeset` class (not array) | BRK | PRESENT (D3: 49c7d0700, cba6dc331, d7dc98c1e; #5944) | Was: Angular emitted plain `NodeChange[]` (ng-flow.component.ts:903 `store.onNodesChange`, `(nodesChange)` output) and has its own utils/changes.ts (applyNodeChanges etc.) rather than system changes module. System 1.0 has `packages/system/src/changes/*` (Changeset, `.applyTo`, `getByType`, new `update`/`data` change types, `changeParentNode`). Matching = swap utils/changes.ts for system's and change output payload; very invasive for apps using `applyNodeChanges(changes, nodes)` | large (breaking) |
| 18 | 13.0.0 | `changeParent` on useReactFlow | FEAT | PRESENT (E1: a766a0eed, 839a7dd79) | Was: services/ng-flow.service.ts has `updateNode(id,{parentId})` (:381,:408) + setNodeGroup (:376) but no position-preserving re-parent helper; system `changeParentNode` (8843870d5) not in local system | small (after system bump; setNodeGroup partially covers) |
| 19 | 13.0.0 | `elevateEdgesOnSelect` defaults true | BRK/FEAT | ABSENT (and a latent no-op) | ng-flow.component.ts:520 default false; flow-store :231 default true but overwritten by effect :807. container/edge-renderer/edge-renderer.component.ts:392 `getEdgeZIndex` = `edge.zIndex ?? max(sourceZ,targetZ)`; never uses elevateEdgesOnSelect/zIndexMode/`getElevatedEdgeZIndex`. So the input is documented but has no effect on edge rendering today (selected edges only elevated if CSS does it) | small |
| 20 | 13.0.0 | Exported styles in `@layer xyflow` | FEAT/BRK | PARTIAL | styles/base.css imports system CSS verbatim (4 lines), so layering is inherited on a system bump, but angflow's own styles/ng-flow.css (461 lines) and inline styles stay un-layered and would always win over layered theme; consumers' override assumptions change | small |
| 21 | 13.0.0 | `xy-theme.css` (default theme on top of base) | FEAT | ABSENT | styles/ has base.css/style.css/ng-flow.css only; package exports dist/style.css, dist/base.css (package.json:36-37). Needs SYS theme.css then an `ng-theme.css` wrapper | small |
| 22 | 13.0.0 | `useNode` / `useEdge` hooks | FEAT | PRESENT (E1: 3136449f0, f0cba51ee) | Was: NgFlowService has `selectNodesData`, `selectInternalNode` (:918-975), `selectNodeConnections`; no `selectNode(id)` / `selectEdge(id)` / `selectInternalNodes(ids)` | trivial |
| 23 | 13.0.0 | Fine-grained reactivity, perf (pubsub, React Compiler, optimized processing, handles, pane cursor style recalc) | PERF | N/A | React render model. Angular already signal/OnPush. Only analogue: selectNodesData (ng-flow.service.ts:921) returns a fresh array each version bump with no `equal`, so consumers re-run on every graph version (see #26) | - |
| 24 | 13.0.0 | `useEqualSelector` | FEAT | N/A | React hook | - |
| 25 | 13.0.0 | Source maps/src in package | pkg | N/A | - | - |
| 26 | 13.0.0 | Avoid re-render of useNodesData consumers on position/selection/measure changes | PERF | PARTIAL | ng-flow.service.ts:921 `selectNodesData` computed has no `equal` -> new array + objects each `store.version()` bump | trivial |
| 27 | 13.0.0 | Fix resizing with fixed extent + non-default origin; node jump w/ origin; extent beyond absolute | BUG | SYS | components/node-resizer/node-resizer.component.ts:258 builds XYResizer from system; passes `nodeOrigin`. Inherited | none |
| 28 | 13.0.0 | Skip selection scan when no onSelectionChange handler | PERF | N/A | ng-flow.component.ts:775-789 effect only emits on id-set change; no per-update scan | - |
| 29 | 13.0.0 | Animated viewport fns (fitView/setCenter/...) resolve `false` if interrupted | BUG/BRK | PARTIAL | SYS makes `panZoom.setViewport` resolve boolean. Angular: services/flow-store.service.ts:896 `fitView(): Promise<FitViewResult>` ({zoom,clamped}) and ng-flow.service.ts:147 `await pz.setViewport(...)` ignore the boolean; zoomIn/zoomTo/setCenter return store results. No `interrupted` signal and React's latest-fitView-id guard (4988e2bf8) not ported -> overlapping fitViews leave earlier promises pending semantics | small |
| 30 | 13.0.0 | `NodeProps` narrows `data` by `type` for unions | types | N/A | Angular nodes use inputs/templates | - |
| 31 | 13.0.0 | Fix missing edges when controlled node updates overlap measurement | BUG | N/A (not susceptible) | container/node-renderer/node-renderer.component.ts:224-285 observes every `.xy-flow__node` via MutationObserver regardless of init state; no isInitialized gate | - |
| 32 | 13.0.0 | `useConnection` re-render every pointermove | PERF | N/A | signal `NgFlowService.connection` (:79) | - |
| 33 | 12.12.1 | Pane click cancels pending click-connection AND fires `onClickConnectEnd` | BUG | PARTIAL | container/ng-flow/ng-flow.component.ts:1140 and :1165 clear `connectionClickStartHandle` but never call `store.onClickConnectEnd` (only handle.component.ts:277,307 does). Also Angular's callback is `(event)` only; React passes `(event, FinalConnectionState)` | small |
| 34 | 12.12.1 | Don't mutate internal selection state | BUG | ABSENT | utils/changes.ts:194-209 `getSelectionChanges(..., mutateItem)` still sets `item.selected` on lookup items; called with `true` at services/flow-store.service.ts:839 and :855 (same code upstream removed). Affects controlled-mode consumers who reject/delay select changes: internal lookup says selected while user nodes say not | small |
| 35 | 12.12.1 | `pathOptions` in EdgeProps inferred from edge type | types | PARTIAL | types/edges.ts:45-52 has per-variant `pathOptions`, so mostly typed already | trivial |
| 36 | 12.12.1 | `isNodeIntersecting`/`getIntersectingNodes` respect nodeOrigin when passed node object | BUG | N/A (not affected) | ng-flow.service.ts:795-856 always resolve through `nodeLookup` `internals.positionAbsolute` (already origin-adjusted); returns [] / false if node not in lookup (differs from React which accepts unknown objects) | - |
| 37 | 12.12.1 | Disconnect ResizeObservers on unmount | BUG | PRESENT | node-renderer.component.ts:258-261 and ng-flow.component.ts:1055 call `disconnect()` | - |
| 38 | 12.12.0 | `onResizeEnd` always fires after `onResizeStart`; correct values when `shouldResize` false (rollback) | BUG/FEAT | SYS | node-resizer.component.ts uses XYResizer + shouldResize input (:171); `onEnd` (:306) always emits dimensions resizing:false. Inherited on system bump | none |
| 39 | 12.11.6 | Reset all provider-store props on unmount | BUG | PARTIAL | flow-store.service.ts:1039 `reset()` only clears lookups, nodes/edges, transform, flags; leaves width/height, callbacks (onNodesChange...), defaultEdgeOptions, panZoom, domNode. Only invoked for fresh-store branch (ng-flow.component.ts:145); reused provider store never reset by design | small |
| 40 | 12.11.6 | No attribution warning when pane not rendered | n/a | N/A | angflow own attribution (components/attribution), no proOptions warn | - |
| 41 | 12.11.4 | MiniMap works after flow remounts | BUG | PARTIAL | minimap.component.ts:215-222 captures `panZoom` once and guards `!this.minimap`; if panZoom instance is replaced (flow re-init with shared provider store) the minimap keeps the destroyed instance. Low likelihood (minimap normally dies with ng-flow) | small |
| 42 | 12.11.4 | Dev log when attribution hidden | n/a | N/A | own branding | - |
| 43 | 12.11.4 | MiniMap bounds when all nodes hidden | BUG | PRESENT | minimap.component.ts:261-319 filters hidden, falls back to `viewBB` when empty | - |
| 44 | 12.11.4 | MiniMap conditional useCallback | BUG | N/A | React hooks | - |
| 45 | 12.11.3 | Middle-mouse pan from selection rectangle | BUG | SYS | filter.ts class list; Angular selection element class differs (`.xy-flow__selection` in container/ng-flow click guards). Verify class matches system filter after bump | trivial |
| 46 | 12.11.3 | `extent:'parent'` with width/initialWidth; getNodesBounds skip missing; setNodes nodeExtent | BUG | PRESENT/SYS | setNodes passes nodeExtent: flow-store.service.ts:441-447. Others in system | - |
| 47 | 12.11.3 | Invoke error if handle can't be found | BUG | SYS | system XYHandle/updateNodeInternals; Angular wires `onError = ngDevWarn` (utils/dev-warn.ts) | none |
| 48 | 12.11.3 | Touch panning preferred over drag-selection when selectionOnDrag + mouse-button panOnDrag | BUG | PARTIAL (deliberate divergence) | container/pane/pane.component.ts:60-135: pointerdown capture + touchstart capture make touch start a marquee whenever selectionOnDrag; comment says touch marquee is intended. Upstream now lets touch pan unless selection key is held | small (decision) |
| 49 | 12.11.3 | `Control` key as pan activation key + primary drag | BUG | ABSENT | no `panActivationKeyPressed` in system XYPanZoom filter locally (grep empty); Angular tracks `store.panActivationKeyActive` (key-handler.directive.ts:123) but never passes it to panZoom update. Need SYS filter change + plumb in ng-flow.component.ts ~:1238 update params | small |
| 50 | 12.11.3 | `useKeyPress` combos of 3+ keys | BUG | N/A / ABSENT | No useKeyPress equivalent; key-handler.directive.ts:243 `matchesKey` matches single key/code only, so `deleteKeyCode='Meta+Backspace'`-style combos are not supported at all | small (feature) |
| 51 | 12.11.3 | Background pattern offset math | BUG | N/A (not affected) | components/background/background.component.ts:158 computes offset independently (no `|| 1` precedence bug) | - |
| 52 | 12.11.2 | Only create XYDrag for draggable nodes | PERF | PRESENT (equivalent) | directives/drag.directive.ts:73 destroys instance when `disabled`; node-renderer.component.ts:100 binds `[ngFlowDragDisabled]` | - |
| 53 | 12.11.2 | MiniMap re-render / Viewport single render | PERF | N/A | React | - |
| 54 | 12.11.1 | `FinalConnectionState` discriminated union | types | SYS | types/edges.ts:116-125 | none |
| 55 | 12.11.1 | Attribution link | n/a | N/A | - | - |
| 56 | 12.11.1 | Don't fire pane click when connection ends on pane | BUG | ABSENT | ng-flow.component.ts:1121 `onPaneClick` has no connection-ended guard. A connection dragged from a handle and released over the pane yields a `click` whose target is the pane (common ancestor), emitting `(paneClick)` and `resetSelectedElements()`. `paneClickDistance` default 0 disables the only mitigation. Upstream tracks `connectionEndedOnPane` flag in Pane pointerup | small |
| 57 | 12.11.1 | Handle config via context / shared connection state / stable edge position | PERF | N/A | React render perf | - |
| 58 | 12.11.0 | `autoPanOnSelection` | FEAT | PRESENT | container/pane/pane.component.ts:35,228,245; ng-flow.component.ts; types/store.ts | - |
| 59 | 12.11.0 | Type error handleId w/o handleType in useNodeConnections | types | N/A | Angular APIs differ (see #5) | - |
| 60 | 12.11.0 | Library-specific dev warnings + docs links | FEAT | PRESENT | utils/dev-warn.ts `ngDevWarn` (links still reactflow.dev/error#id) | - |
| 61 | 12.11.0 | Export `NodeHandle` type | types | PARTIAL | public-api.ts:173 exports `NodeHandleBounds` only; confirm `NodeHandle` after #14 rename | trivial |
| 62 | 12.11.0 | `@types/react` peers; StoreUpdater useEffect; onNodeDrag event type | n/a | N/A | React | - |
| 63 | 12.11.0 | Fix node resizing beyond absolute extents | BUG | SYS | inherited via XYResizer | - |

## Counts (63 rows; some rows merge several changelog bullets)
- PRESENT: 10 (#1, 17 via D3, 18 and 22 via E1, 37, 43, 46, 52, 58, 60; #46 is PRESENT/SYS)
- PARTIAL: 12 (#3, 5, 8, 20, 26, 29, 33, 35, 39, 41, 48, 61)
- ABSENT: 9 (#2, 11, 12, 13, 19, 21, 34, 49, 56), plus #50, which is N/A / ABSENT (a feature gap)
- SYS (inherited on system bump, little/no wrapper work): 10 (#6, 7, 14, 15, 27, 38, 45, 47, 54, 63), plus bits of 8/29
- N/A (React-specific or not affected): 21
- Total: 10 + 12 + 9 + 1 (#50) + 10 + 21 = 63

## Ranked work list (ABSENT/PARTIAL), by user impact

Bugs first
1. #34 Internal selection mutated (`getSelectionChanges(..., true)` in flow-store.service.ts:839,855). Controlled-mode correctness bug. small.
2. #56 paneClick/deselect fires when a connection drag is released on the pane. small. Very visible UX bug.
3. #19/#3 `elevateEdgesOnSelect` is a no-op in edge-renderer; EdgeToolbar zIndex hand-rolled. Use system `getElevatedEdgeZIndex` in getEdgeZIndex + EdgeToolbar. small.
4. #2 Arrow-key a11y live announcement never populated (whole feature missing, rendered empty region). small.
5. #33 Pane click cancels click-connect but does not call onClickConnectEnd. small.
6. #49 Control key pan activation (needs system filter + plumb). small.
7. #29 Viewport promise semantics / overlapping fitView guard. small.
8. #39 Store reset incomplete for provider-shared store; #41 minimap stale panZoom after remount; #26 selectNodesData equality. small/trivial.
9. #48 touch pan vs marquee (deliberate divergence, decide). #50 key combos. small.

Features
10. #22 selectNode/selectEdge/selectInternalNodes (trivial). #18 changeParent (small). #21 xy-theme (small, needs system theme.css). #20 @layer (small).
11. #17 Changeset API (large, breaking). #11 paneDragThreshold (medium). #12 forceColorMode/system default (medium).

## Breaking changes angflow would inherit if it matched React 13 API
- `getHandleConnections` removed; `getNodeConnections({nodeId,type?,handleId?})`; `HandleConnection` -> `NodeConnection` (also agent bridge tools get_handle_connections/get_node_connections + AGENT_BRIDGE.md + mcp snapshot).
- `paneClickDistance` -> `paneDragThreshold` (default 1, behaviour change: small pointer jitter no longer pans/selects).
- `nodeClickDistance` removed.
- `colorMode` -> `forceColorMode`; default becomes system (`light-dark()`); consumers who relied on default 'light' flip to dark on dark OS.
- fitView/fitBounds default padding 5% and numeric padding = pixels (all `padding: 0.x` callers change; agent tool schemas too).
- `onConnectEnd`/`onReconnectEnd` `to` in flow coords.
- `onNodesChange`/`onEdgesChange` receive Changeset class (largest break; wrapper currently emits arrays and ships its own applyNodeChanges).
- `elevateEdgesOnSelect` default true (visual).
- Styles in `@layer xyflow` (override ordering changes for custom CSS).
- `Handle` type -> `HandleBounds`.
- Viewport promises can resolve false on interruption.

## Other upstream wrapper work not in the changelog (a58568f11..upstream/main, 250 commits touching packages/react + examples/react)
- New shared cross-framework "generic-tests" in packages/react/src/generic-tests (pane/activation-keys, click-connect, nodes/connection-updates, data-updates, intersection-origin, viewport/transitions, edges/reconnect) driven by tests/playwright e2e (pane.spec, nodes.spec, background.spec, reconnect-edge.spec, measurement-race.spec). angflow has tests/playwright already; these are good regression specs to port as Angular scenarios (selection-mutation, connection end on pane, reconnect id, interrupted viewport).
- New examples: DragThreshold, MeasurementRace, Remount, NodeResizer/FixedExtentNode (all would map to Angular examples; Remount maps to #41/#39).
- Cypress component tests for calculate-node-position and update-node-internals (system-level).
- React-only infra: pubsub store, useShallow, HandleConfigContext, tsdown build, React Compiler. N/A.
- reconnectEdge id replacement fix (9dcbd29a8) and getNodesBounds skipping unknown ids: system, check angflow's use of reconnectEdge in handle/edge anchors on system bump.
- packages/vue: NEW upstream package (Vue Flow integrated, Vue 3 wrapper, examples/vue). Not relevant to angflow beyond being a third reference wrapper that sometimes implements fixes first (e.g. touch/selection fixes c62aee54c, selection over node with selection key 63d077b8b).
