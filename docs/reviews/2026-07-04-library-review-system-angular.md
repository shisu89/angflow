# @angflow Library Review — `system` + `angular`

**Date:** 2026-07-04
**Scope:** `packages/system` (framework-agnostic core) and `packages/angular` (Angular wrapper), plus `packages/angular/src/lib/agent` and `packages/mcp` for the agent-bridge security review. The `react` and `svelte` reference wrappers were excluded by request.

**Method:** Five parallel focused reviews — agent-bridge security, system core correctness, angular core (store/services/container) correctness, angular components/plugins correctness + a11y, and feature-parity analysis against the React/Svelte references. Every finding below was verified against the actual code path.

---

## Executive summary

The library is in genuinely good shape for a young port: the zoneless-first invariant holds everywhere (no `NgZone` anywhere in scope, all outside-Angular callbacks drive views via signal writes), lifecycle/cleanup is careful, there's no XSS surface (all user data flows through text bindings; no `innerHTML`/`bypassSecurityTrust`), and the system core tracks its upstream xyflow baseline faithfully with cleanly-layered, unit-tested local additions. The agent bridge is unusually security-conscious (runtime param validation, spread-based merges that neutralize `__proto__`, server-side API keys in the chat harness).

The problems cluster in a few places:

- **Two high-severity Angular-core bugs at the `NgFlowComponent` boundary** break documented features outright: uncontrolled mode (`defaultNodes`/`defaultEdges`) and initial `fitView` with pre-measured nodes. Both were confirmed empirically and are invisible to the current test suite.
- **One high-severity handle bug** lets non-connectable handles start and complete connections (a real validation hole), plus the connectable-state CSS contract diverges from what the system package validates against.
- **Upstream drift in `system`**: the most impactful defects (aborted-drag `dragging`-state reset, an auto-pan rAF leak, a `panOnScroll` start/end imbalance, a parent-clamp crash) are already fixed at upstream xyflow HEAD — a periodic upstream-diff pass would recover them.
- **A cluster of silently-dead documented inputs and coordinate-space confusion** in the toolbar/portal/label-renderer/resizer family.
- **Security gaps that matter against a compromised/injected agent**: the CSS `url()` exfiltration guard misses the `update_*` mutation paths and only checks style values (not keys), and there's no read-side authorization on any transport.
- **The node-to-node connection interaction "feels off"** — traced to a hardcoded `dragThreshold: 0` in the handle (should be `connectionDragThreshold`, default 1), which flashes/spams connect events on every click and causes surprise near-tap connections. Much worse on touch. One-line fix. See the dedicated *Connection interaction* section.
- **Mobile/touch: the core canvas works, but marquee/box selection is mouse-only (a port regression), edge reconnection is mouse-only, and `touch-action: none` is missing from most surfaces.** See the dedicated *Mobile / touch interactions* section.

Feature parity with React/Svelte is near-total; the gaps are small and there are strong Angular-native expansion opportunities.

---

## Critical / High severity

### 1. [HIGH] Uncontrolled mode (`defaultNodes`/`defaultEdges`) is broken
`packages/angular/src/lib/container/ng-flow/ng-flow.component.ts:281-284,685-699,865-871`
`nodesModel = input<NodeType[]>([], {alias:'nodes'})` defaults to `[]`, not `undefined`. The input-sync effect fires for that default `[]` and runs `store.setNodes([])`, overwriting the `setDefaultNodesAndEdges(...)` that `ngOnInit` just applied. `<ng-flow [defaultNodes]="nodes">` renders an empty canvas. Confirmed empirically (TestBed: store ends first CD with 0 nodes). **Fix:** default the model inputs to `undefined` so the existing `!== undefined` guard distinguishes "unbound" from "bound empty".

### 2. [HIGH] Initial `[fitView]` with pre-measured nodes loses the fit and desyncs store vs d3 transform
`packages/angular/src/lib/container/ng-flow/ng-flow.component.ts:1030-1038`; `flow-store.service.ts:828-835`
In `initPanZoom`, `store.setPanZoom(panZoom)` synchronously drains the queued fitView, but XYPanZoom only attaches its `'zoom'` handlers later in `update()`, so `onPanZoom`/`onTransformChange` never fire and `store.transform` isn't updated; line 1035 then overwrites `store.transform` with the initial viewport anyway. The fit is permanently lost, the rendered viewport stays at default, and d3's internal `__zoom` holds the fitted transform — so the first user pan/zoom jumps. Hits the common "restore a `toObject()` serialization with `[fitView]="true"`" path. Confirmed empirically. **Fix:** set the initial transform and call `updatePanZoomOptions()` (attaching handlers) *before* `store.setPanZoom(panZoom)`, or have `resolveFitView` write the computed viewport into `store.transform`.

### 3. [HIGH] Handle ignores `isConnectable` — disabled handles start and complete connections
`packages/angular/src/lib/components/handle/handle.component.ts:49,128-131,171`
The `connectionindicator` host class is hardcoded `true`, so a non-connectable handle keeps `pointer-events: all` + crosshair cursor and swallows `pointerdown`. `onPointerDown` gates only on `isConnectableStart()`, never `isConnectable()`. Since `XYHandle.isValid` only checks the *target's* connectable classes, an edge can be created **from** a handle with `[isConnectable]="false"` (or from any handle after the Controls lock button sets `nodesConnectable=false`). Also passes hardcoded `dragThreshold: 0`, ignoring `[connectionDragThreshold]`. **Fix:** compute `connectionindicator` from `isConnectable()`/`isConnectableStart()`/`isConnectableEnd()` like React, early-return in the start path when not connectable, and pass `store.connectionDragThreshold()`.

### 4. [HIGH] Aborted drag never resets nodes' `dragging` state (missing upstream 0.0.77 fix)
`packages/system/src/xydrag/XYDrag.ts:354-357`
The `end` handler early-returns on `abortDrag` (multitouch second finger, or node deleted mid-drag) without `updateNodePositions(dragItems, false)`. The node keeps `dragging: true` indefinitely. This bites harder in angflow than upstream because `FlowStore.tweenNodePositions` deliberately skips `dragging` nodes — so agent-driven tweens permanently ignore the stuck node, and `getNodesInside` force-renders it forever. **Fix:** port the upstream 0.0.77 block (reset positions + `nodePositionsChanged = false` on the abort path).

---

## Medium severity

### System core (upstream drift — most already fixed at xyflow HEAD)

- **Auto-pan rAF loop survives an aborted drag → endless panning.** `XYDrag.ts:222-247,355-361` — `cancelAnimationFrame(autoPanId)` only runs on the non-aborted path; an abort inside the 40px edge zone pans the canvas forever. Fix: cancel the rAF + reset `autoPanStarted` before the abort early-return.
- **`panOnScroll`: a single wheel tick fires `onPanZoomStart` but never `onPanZoomEnd`.** `xypanzoom/eventhandler.ts:127-139` — the end-timeout is only armed in the `else` branch, so the first wheel event leaves `isPanScrolling` stuck `true` and never pairs start/end. Fix: arm the 150ms end-timeout on every event (as at HEAD).
- **`updateNodeInternals` crashes on a dangling `parentId` with `extent:'parent'`.** `utils/store.ts:459` — `nodeLookup.get(node.parentId)!` throws a `TypeError` when the parent was deleted the same tick a child measurement arrives, aborting internals updates for the whole batch. Fix: guard `if (parent)` (as at HEAD).

### Angular core

- **`(selectionChange)` output is declared + documented but never emitted.** `ng-flow.component.ts:647` — no `.emit` anywhere. Fix: effect over `selectedNodes()`/`selectedEdges()` with set-equality + initial guard.
- **`selectionOnDrag` swallows plain pane clicks** — click-to-deselect and `(paneClick)` need two clicks. `pane.component.ts:147-174` — `selectionInProgress(true)` is set unconditionally on every mouseup (including a zero-movement click); React sets it only on actual pointer-move. Fix: set the flag in `onMouseMove`.
- **`nodeExtent`/`node.extent` not enforced on the position fast path** (arrow keys, tweens, `setNodePositions`). `flow-store.service.ts:622-704` — clamping only runs for parented/parent/non-zero-origin nodes; a top-level node walks out of a finite extent via ArrowRight or a layout apply. Fix: also recompute when `isCoordinateExtent(node.extent)` or a finite store `nodeExtent`.
- **SSR: unguarded `ResizeObserver`/`MutationObserver` in `ngAfterViewInit`.** `ng-flow.component.ts:918-925`; `node-renderer.component.ts:211-237` — the package guards SSR elsewhere but these throw `ReferenceError` under Angular SSR. Fix: `afterNextRender(...)` or `isPlatformBrowser` guard.
- **Provider-store reuse leaves stale component callbacks + growing `onError` chain.** `ng-flow.component.ts:818-863` — under `<ng-flow-provider>` reuse, store callbacks emit into destroyed components and each remount adds an `onError` wrapper layer. Fix: `DestroyRef.onDestroy` to null/restore.
- **Modifier-key state sticks on window blur.** `key-handler.directive.ts:53-101`; `ng-flow.service.ts:1025-1056` — no blur/visibilitychange reset, so Shift+Cmd+Tab leaves `multiSelectionActive` stuck true. Fix: window `blur`/`contextmenu` listener resetting pressed flags.

### Components

- **NodeResizer emits `resize`/`resizeEnd` twice per event.** `node-resizer.component.ts:251,262,288-293` — outputs emitted from both the `onChange`/`onEnd` and the default `onResize*`/`onEnd` paths, with two different payload shapes; non-idempotent handlers (history, API calls) run twice. Fix: emit from exactly one path.
- **Arrow keys on the nodes-selection box move nodes twice.** `selection-box.component.ts:138-151` — `onKeyDown` calls `preventDefault()` but not `stopPropagation()`, so the document-level `KeyHandlerDirective` also moves nodes (6px instead of 5, or two grid cells). Fix: `stopPropagation()` for handled keys.
- **Nodes-selection box is never focused** — its keyboard support is unreachable (`tabindex=-1`, nothing focuses it). Fix: focus it when it enters the DOM (respecting `disableKeyboardA11y`).
- **EdgeToolbar scales inversely with zoom.** `edge-toolbar.component.ts:73-79` — positions in screen space but appends `scale(1/zoom)` (only correct inside the viewport), so it's visibly the wrong size at any zoom ≠ 1. Fix: drop the `1/zoom` factor for this placement.
- **NodeToolbar `[nodeId]` targeting another node positions against the wrong node** — the documented "render it anywhere" mode is broken (transform omits the target's `positionAbsolute`); arrays use only `ids[0]`. Fix: include target `positionAbsolute` (+ viewport transform if outside), compute the union rect for arrays, or fix the doc.
- **ViewportPortal content renders beneath the pane** — the pane (`z-index:1`) paints and hit-tests above the portal (`z-index:auto`), so interactive portal content is dead and it draws under nodes. Fix: project into the viewport layer (React-style) or fix z-order + pointer-events.

### Security (agent bridge)

- **CSS `url()` exfiltration guard is bypassable.** `agent-bridge.service.ts:691-703,1299-1334,1580-1609`; sink at `edge-renderer.component.ts:346-350` — the blocklist runs only for add/set tools, not `update_node`/`update_edge`/`update_*_data`, and only checks style *values*, not *keys*. Edge styles render via raw `[attr.style]` string concatenation (unsanitized), so an agent can set `background-image: url(https://evil/beacon)`. Fix: run `validateStyleAndClassName` on every style-setting mutation and validate keys too (or use a structured style binding).
- **No read-side authorization on any transport; `WindowTransport` exposes the full tool surface globally.** `transports/window.ts:60-70`; `agent-bridge.service.ts:311-324` — `canMutate` gates only writes; all reads are ungated, and `window.angflow.callTool` exposes the whole catalog to any in-page script (a compromised dependency can `get_state` and POST the entire graph out). Fix: document the trust model; add an optional `canRead` hook; make `WindowTransport` opt-in per tool / namespaced behind a capability token.

---

## Low severity

**System core:** `isEdgeBase`/`isNodeBase`/`isInternalNodeBase` throw on `null`/primitive via `'id' in element` (`utils/graph.ts:41-56`); `FinalConnectionState` types `toPosition` non-null but runtime delivers `null` (`XYHandle.ts:226-229`); resizer ignores a node's own coordinate `extent` (`XYResizer.ts:181-184`); destroy paths leave d3 listeners attached — use `selection.on('.zoom', null)` (`XYPanZoom.ts:200-202`, `xyminimap/index.ts:117-119`). All inherited from the upstream baseline; the first three are fixed at HEAD.

**Angular core:** `onlyRenderVisibleElements` culls edges crossing the viewport when both endpoints are offscreen (`edge-renderer.component.ts:306-311`); runtime `[nodeExtent]`/`[nodeOrigin]` changes don't re-clamp existing nodes (`ng-flow.component.ts:732-733`); programmatic `deleteElements()` doesn't emit `(nodesDelete)`/`(edgesDelete)`/`(delete)` (`ng-flow.service.ts:741-775`); the position fast path aliases `position`/`positionAbsolute`/`userNode.position` to one shared object (`flow-store.service.ts:637-641`); NodeRenderer per-node caches can leak for nodes removed before the observer registers them (`node-renderer.component.ts:237`); `PaneComponent.selectionKeyCode` is `input<any>` (`pane.component.ts:26`).

**Components:** connection-feedback classes (`connectingfrom`/`connectingto`/`valid`) are never applied, so shipped CSS is dead (`handle.component.ts:41-61`); MiniMap renders `hidden:true` nodes (`minimap.component.ts:240-253`) and hardcodes a ±10 000-unit mask/background (`minimap.component.ts:64,325-331`); NodeResizer `handleStyle`/`lineStyle`/`autoScale` inputs are dead and `nodeId` is read once (`node-resizer.component.ts:152-159`); a11y edge description is hardcoded + unreferenced and Controls/MiniMap ignore `ariaLabelConfig` (`a11y-descriptions.component.ts:19-21`, `controls.component.ts:30-102`); EdgeLabelRenderer only works inside a custom edge, not as a `<ng-flow>` child (`edge-label-renderer.component.ts:7-16`); built-in edge `label` input is dead and labels use the straight-line midpoint instead of the path `labelX/labelY` (`edge-renderer.component.ts:619-625`).

**Security:** `register_node_template`/`unregister_node_template` bypass the `canMutate` guard and op-log (`agent-bridge.service.ts:61-78,1057-1079`); `apply_changes` allows multiplicative bulk growth past the 5000 cap (`agent-bridge.service.ts:933-934`); ephemeral-token mode lets any localhost-origin page hijack the single canvas slot (`packages/mcp/src/canvas-socket.ts:240-292`); browser `WebSocketTransport` executes every inbound frame as a tool call over plaintext `ws://` with no server auth (`transports/websocket.ts:104-115`).

---

## Connection interaction (node-to-node linking)

A dedicated end-to-end trace of both drag-to-connect and click-to-connect (`connectOnClick`), mouse and touch. The connection *logic* is faithfully ported and correct — orientation swap (start from a `target` handle yields `source`=source-side handle), strict/loose `connectionMode`, `isValidConnection`, coordinate math, and click-vs-drag state all match React. But one hardcoded value spoils the feel:

### [HIGH] Handle hardcodes `dragThreshold: 0`, breaking connection UX
`packages/angular/src/lib/components/handle/handle.component.ts:171`
Should pass `store.connectionDragThreshold()` (default 1), which is what React does and what this codebase's own edge-reconnect path already does (`edge-renderer.component.ts:703`). In `XYHandle.onPointerDown`, `dragThreshold === 0` starts the connection synchronously on pointerdown before any drag (`XYHandle.ts:123-125`); threshold 1 defers the start to first real movement.
- **Desktop:** every click on a connector flashes a zero-length connection line, toggles all handles' connecting styling, and fires spurious `onConnectStart`/`onConnectEnd` pairs (~3× each for a two-tap connect) around the real click-connect events — any "connecting…" UI flickers on every handle click. A click that drifts 1–2px near another handle within the 20px `connectionRadius` silently completes a drag connection, firing `onConnect` for a link the user never dragged.
- **Touch:** worse — finger jitter almost always exceeds "0px," so taps meant to arm click-to-connect kick into the drag path and either abort with a flash or auto-connect to an unintended nearby handle on lift. This is the primary cause of connections "feeling off" on mobile.
- **Fix:** `dragThreshold: store.connectionDragThreshold(),` — one line; eliminates the flashing, the event noise, and surprise near-tap connections.

### [MEDIUM] No mouse-button guard on handle pointerdown
`packages/angular/src/lib/components/handle/handle.component.ts:128-132`
React only starts a connection for `event.button === 0` on mouse pointers; Angular has no button check, so a right/middle-click on a handle starts a connection (and, with the threshold-0 bug, immediately flashes/aborts one). **Fix:** guard `if (event.pointerType === 'mouse' && event.button !== 0) return;` before starting.

### [MEDIUM] `nodesConnectable` / lock button doesn't reach handles
`packages/angular/src/lib/components/handle/handle.component.ts:74-78`; lock toggle at `controls.component.ts:151`
The handle's `isConnectable`/`isConnectableStart`/`isConnectableEnd` are plain inputs defaulting `true` and drive the `.connectable*` classes; they never consult `store.nodesConnectable()`. So the Controls lock button has zero effect on user-authored handles, and since completion validity in `isValidHandle` reads those same classes (`XYHandle.ts:316`), the lock blocks neither starting nor completing a connection. (Related to the `isConnectable` handle finding above.) **Fix:** AND the node's connectable context — `node-renderer.component.ts:494` already computes `node.connectable ?? nodesConnectable` — into the handle's class bindings and the pointerdown guard.

---

## Mobile / touch interactions

Tapping is not clicking, and three interaction paths don't survive the difference. The d3-backed paths (node drag, pane pan, pinch-zoom, double-tap zoom, minimap) and — notably — **connection dragging from a handle** are correctly touch-capable (`handle.component.ts:59` uses `(pointerdown)`; `XYHandle` registers `touchmove`/`touchend`). But:

### [HIGH] Marquee / box selection is mouse-only (port regression)
`packages/angular/src/lib/container/pane/pane.component.ts:48-108,147-159`
The pane reimplements rubber-band selection with a capture-phase `mousedown` + document `mousemove`/`mouseup`. React uses pointer events — the code comment at line 59 even cites `onPointerDownCapture` as the parity source, but the implementation dropped to `mousedown`. A finger-drag on the pane produces no selection box, and because the group-drag box only appears after a marquee selects nodes, **group select and group drag are entirely unreachable by touch.** **Fix:** rewrite on Pointer Events + `setPointerCapture`.

### [MED-HIGH] Edge reconnection is mouse-only and hover-gated
`packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts:218-232,649-665`
Reconnect anchors start via `(mousedown)` and their active affordance is toggled by `(mouseenter)`/`(mouseleave)` — neither exists on touch, so edges can't be reconnected by finger and the "over the anchor" cue never shows. Mirrors the React reference (inherited xyflow gap, not a port regression), but still a real hole; `XYHandle` already handles touch internally, so only the entry binding blocks it. **Fix:** change anchor bindings to `(pointerdown)`; drop the button gate for non-mouse pointers.

### [MEDIUM] `touch-action: none` applied to only the handle
`packages/angular/src/lib/styles/ng-flow.css:266`
Missing from `.xy-flow__pane`, `.xy-flow__node`, `.xy-flow__resize-control`, `.xy-flow__minimap`, `.xy-flow__nodesselection-rect`. Those rely purely on d3 v3's non-passive `preventDefault`, which some mobile browsers can pre-empt for native scroll → stuttering/failed drags and page-scroll during pinch. **Fix:** add `touch-action: none;` to those selectors.

### Lower severity
- **No touch equivalent for hover affordances.** `nodeMouseEnter`/`edgeMouseEnter`/`:hover` (`node-renderer.component.ts:117-119`, `ng-flow.css:199,332`) never fire/apply on touch, so consumer UI built on them is dead. **Fix:** emit enter/leave from pointer events too, or document a tap-reveal pattern.
- **`getEventPosition` throws on empty `touches`** (`packages/system/src/utils/dom.ts:52-61`) — latent (callers currently guard), crashes on any future `touchend`-path call. **Fix:** fall back to `changedTouches?.[0]`.
- **Touch targets below 44px** — resize lines are 2px and corners shrink with zoom (~2.5px at low zoom, nearly untappable — `node-resizer.component.ts:98-119`); handles 8px; control buttons 26px. **Fix:** enlarge hit areas on coarse pointers independent of visual size; clamp resize-control hit area to a px minimum regardless of zoom.

**Verdict:** usable for the core canvas, broken for selection and edge-editing on touch. The single highest-leverage touch fix overlaps with the connection review — restoring `connectionDragThreshold` fixes tap-to-connect; a Pointer Events rewrite of the pane fixes marquee/group selection.

---

## Feature expansion opportunities

Parity with React/Svelte is **near-total** — all hooks, ~70 main-component inputs / ~45 outputs, all plugin components (Background variants, Controls, MiniMap incl. `pannable`/`zoomable`/`nodeComponent`, NodeToolbar, NodeResizer, EdgeToolbar), sub-flows/`parentId`/`expandParent`/extent, reconnectable edges, box selection, `onlyRenderVisibleElements`, `colorMode:'system'`, snap grid, node origin, connection radius/click-connect, and even React's experimental change-middleware hooks are present and real. Remaining gaps are small.

**Parity gaps worth closing (ordered roadmap):**

1. **Fix `SimpleBezierEdge` — the one real parity correctness gap.** No `getSimpleBezierPath` util exists; `simple-bezier-edge.component.ts:42` calls plain `getBezierPath`, so it renders an identical curvature bezier, not a midpoint-control simple bezier. Port the util into `system`, export from both packages.
2. **Public undo/redo service.** `AgentHistory` (snapshots + `HistoryStatus`) already exists and is exercised by the bridge; promote it to a public `FlowHistoryService`. React Flow core lacks this — a genuine differentiator.
3. **`ease`/`interpolate` on all viewport helpers.** `zoomIn/zoomOut/zoomTo/setViewport/setCenter` accept only `{duration}` even though the system layer already types `ease`/`interpolate`; pure plumbing for full `useReactFlow` parity.
4. **`selectKeyPressed` combos + options** — currently exact-`e.key` only; no `'a+d'` combos, `KeyboardEvent.code`, or `target`/input-guard options. Largest remaining hook delta.
5. **`model()` two-way bindings for `nodes`/`edges`/`viewport`** — biggest Angular-native DX win; removes the `(nodesChange)` + `applyNodeChanges` boilerplate for the common case.
6. **Export `ControlButtonComponent`** — trivial; completes the Controls custom-button story.
7. **Export-to-image utility (`toPng`/`toSvg`) + matching agent tool** — most-requested React Flow recipe; natural agent-bridge extension.
8. **Helper lines / alignment-snap plugin** — beyond-parity (React Flow paywalls this); the drag middleware hooks already exist to build it.
9. **`ng add` schematic + CDK drag-drop palette recipe** — lowers adoption friction; leverages the existing `NgFlowDropZoneDirective`.
10. **Polish batch:** `includeHiddenNodes` for `selectNodesInitialized`; `onConnect`/`onDisconnect` options for connection selectors; surface/document the `@angflow/angular/layout` subpath (and consider an ELK adapter behind the existing `AgentLayoutFn`).

**Angular-native opportunities (beyond parity):** CDK `ComponentHarness` test harnesses for NgFlow/nodes/edges (nothing comparable in react/svelte); RxJS `toObservable` bridges for `FlowStore` signals; agent-bridge `export_image` and graph-validation (cycle/orphan) tools.

---

## Suggested priority order

1. Fix the three high-severity Angular bugs (uncontrolled mode, initial fitView, handle `isConnectable`) — they break documented, advertised features. Add uncontrolled-mode and initial-fitView-transform assertions to the spec suite (both currently uncovered).
2. Pull the upstream 0.0.77+ system fixes (drag-abort `dragging` reset first, then the auto-pan rAF leak, `panOnScroll` end-timeout, parent-clamp guard).
3. Close the security gaps that matter against an injected agent: style-injection guard coverage (`update_*` paths + style keys) and a documented read-side trust model.
4. Fix the never-emitted `(selectionChange)` and the double-emit NodeResizer — silent contract violations.
5. Work the coordinate-space cluster (edge-toolbar scale, node-toolbar `[nodeId]`, viewport-portal z-order, edge-label-renderer) together, since they share root causes.
6. Then the feature roadmap above.
