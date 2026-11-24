# Upstream xyflow reconciliation — 2026-11-24

## Baseline

| | angflow fork point | upstream now (`upstream/main` @ 9635a064f, 2026-11-23) |
|---|---|---|
| `@xyflow/system` | 0.0.76 (merge-base a58568f11) | **1.0.1** (major release) |
| `@xyflow/react` | 12.10.2 | **13.0.3** |
| `@xyflow/svelte` | 1.x | **2.0.3** |
| `@xyflow/vue` | — | **2.0.3** (new in the monorepo) |

Angflow's only prior sync was 5978703ed (July 2026), which covered a handful of 0.0.77-era fixes.

**Reference copies refreshed.** `packages/{react,svelte,vue}` and `examples/{react,svelte,vue,astro-xyflow}`
now match `upstream/main` (625 paths; reference-only and outside the pnpm workspace; codespell clean).
`packages/system` was **not** merged wholesale: angflow's own changes conflict with the upstream diffs, so
fixes get ported one at a time (see below).

Detailed per-changeset triage, with file:line evidence, is in the appendices:
- [system 0.0.77–0.0.84](2026-11-24-upstream-sync/system-0.0.77-0.0.84.md): 28 entries, 8 present, 4 partial, 13 absent, 3 N/A
- [system 1.0.0–1.0.1](2026-11-24-upstream-sync/system-1.0.x.md): 21 entries, 0 present, 19 absent, 2 N/A
- [react 12.10.3–13.0.3 wrapper parity](2026-11-24-upstream-sync/react-12.10.3-13.0.3.md): 63 rows, ≈7 present, ≈12 partial, ≈12 absent, the rest system-only or React-only

## 1. Upstream fixes to port (non-breaking)

Ranked by user impact.

| Upstream | What it fixes for angflow | Effort |
|---|---|---|
| #6064 (patch part) | Animated viewport calls (`fitView`, `setCenter`, zoom with `duration`) never resolve when a user gesture interrupts them. **Agent-bridge JSON-RPC calls hang.** | S |
| #5915 | A child listed before its parent is drawn at its relative position and left out of the parent lookup. **angflow's own `groupNodes` / `group_nodes` tool produces exactly this order.** Also make angular's three `updateAbsolutePositions` call sites process parents first. | S |
| #5998 | Resizer keeps a rejected `shouldResize` frame's values; `onResizeEnd` can be skipped. Guard upstream's 0×0 edge case. | S |
| #6097 | Internal selection state is mutated (system `getDragItems` plus angular `flow-store.service.ts:839/855/868`, `utils/changes.ts`). Can desync controlled mode. Both halves land together. | M |
| #5922 | `panActivationKeyCode="Control"` never starts a drag-pan. | S |
| #6036 | Smooth-step bends sharper than `borderRadius` when nodes are close (clean cherry-pick). | XS |
| #5850 + #6108 + #6054 | Every wheel/pinch frame forces a synchronous layout. Port together, but keep angflow's box-selection `.zoom` listener fix. | S |
| #6029 | Every cursor change restyles the whole flow. Also touches angular `style.css` / `ng-flow.css` cursor overrides. | S |
| #5889, #6055, #6158, #6119, #6084, #6131 | Trivial fixes: unmeasured sized parent extent; `reconnectEdge` with `getEdgeId`; `fitView` with no nodes; middle-mouse respects `panOnDrag`; resize with origin + extent; `NodeProps` union narrowing. | XS each |
| #5839 | Dark-mode background pattern colour (must change angular `ng-flow.css` too). | XS |
| #5806, #5902, #5793 | `getNodesInside` allocations; middle-mouse pan from the selection rect (keep angflow's box-select guard); de-brand leftover "React Flow" dev-warning strings and links. | XS–S |

## 2. Angflow-native bugs found during reconciliation

These are not upstream ports; the comparison surfaced them. Each one was checked against the code.

| Bug | Where | Effort |
|---|---|---|
| `getNodesBounds` doesn't pass `nodeLookup`, so sub-flow children are bounded by their *relative* positions. The `get_nodes_bounds` agent tool inherits this. Fix together with upstream #5871. | `services/ng-flow.service.ts:859` | XS |
| `elevateEdgesOnSelect` does nothing: the input default `false` overrides the store default, the edge renderer never reads it, and `EdgeToolbar` uses `edge.zIndex + 1` instead of `getElevatedEdgeZIndex`. | `ng-flow.component.ts:520`, `edge-renderer.component.ts:392`, `edge-toolbar.component.ts:69` | S |
| `nodeClickDistance` is a dead input: the store signal is never read and `ngFlowDragClickDistance` is never bound. | `ng-flow.component.ts:509`, `drag.directive.ts:44` | XS (see §3) |
| The arrow-key a11y live announcement is missing entirely: `ariaLiveMessage` is rendered but never written. No Shift ×4 step and no snap/extent post-read. | `key-handler.directive.ts:225`, `flow-store.service.ts:295` | S |
| `(paneClick)` fires, and the selection resets, when a connection drag ends on the pane. | `ng-flow.component.ts` `onPaneClick` | S |
| A pane click cancels click-to-connect without firing `onClickConnectEnd`. | | S |
| Programmatic `deleteElements` doesn't cascade a parent's children, ignores `deletable: false`, and merges edges quadratically. Switching to system `getElementsToRemove` fixes all three and picks up #6074/#6111 perf, but it's a **behaviour change** and needs its own release note. | `ng-flow.service.ts:742` | M |
| Smaller issues: store `reset()` leaves state behind for a provider-shared store; MiniMap keeps a stale `panZoom` after remount; `selectNodesData` has no equality function; key combinations like `Meta+Backspace` aren't supported. | | S each |
| `(connectEnd)` emits no `FinalConnectionState`, and `NgFlowService.connection.to` is in screen coordinates while React's `useConnection` uses flow coordinates. | | S |

## 3. Breaking API changes in upstream 1.0 / React 13

Each needs a decision: adopt now with a deprecated alias (non-breaking, 0.4.0), or defer to a breaking release.

| Change | Angflow blast radius | Non-breaking path? |
|---|---|---|
| `Handle` type → `HandleBounds` (#5987) | `public-api.ts`, `types/edges.ts`, 5 edge components, one example | Yes: deprecated type alias |
| `getHandleConnections` removed; `getNodeConnections({nodeId, type?, handleId?})`; `HandleConnection` → `NodeConnection` (#6114) | service, instance type, `get_handle_connections` agent tool, mcp snapshot, `AGENT_BRIDGE.md`, README | Yes: overload, deprecate, alias |
| `nodeClickDistance` removed; a click is suppressed only if the drag moved the node (#5556, prerequisite for #6168 touch drag) | Input is already dead, so it's a no-op for consumers | Yes: keep as a deprecated no-op |
| `onConnectEnd` / `onReconnectEnd` `to` in flow coordinates (#6117) | Only `(reconnectEnd)`'s `connectionState` | Yes in practice (document it) |
| `paneClickDistance` → `paneDragThreshold` (default 1; gates pan **and** box-select start) (#6115) | System panzoom, `ng-flow.component.ts` input/effect/`onPaneClick`, pane marquee start, 3 examples | Yes: new input, old one becomes a deprecated alias. Largest item: hand-merge with angflow's `XYPanZoom.update()` changes, then touch testing. |
| Default fit padding becomes `'5%'`; **numeric padding is read as pixels** (#5927) | `fitBounds` default `0.1`, `fit_view`/`fit_bounds` agent schemas, mcp snapshot. An agent sending `0.1` would get 0px. | `'5%'` default is safe now (0.1 ≈ 4.5%). Pixel semantics only in a breaking release. |
| `setViewport` resolves `boolean` (#6064) | Direct `@angflow/system` users only | Yes |
| `colorMode` → `forceColorMode`, default follows the system scheme, CSS `light-dark()` | Host classes, `ng-flow.css` dark rules, matchMedia listener | Breaking release |
| Styles in `@layer xyflow` | Angflow's unlayered `ng-flow.css` would always override a layered theme | Breaking release (or ship angflow CSS in the same layer) |
| `onNodesChange` / `onEdgesChange` receive a `NodeChangeset` / `EdgeChangeset` class | Every app using `applyNodeChanges(changes, nodes)` | Probably skip, or offer it opt-in |

## 4. Feature and quality opportunities

- **Upstream features angflow lacks:** `selectNode` / `selectEdge` signals (the `useNode` / `useEdge` equivalents, trivial), `changeParent` (S), `xy-theme.css` (S).
- **Perf (optional, L):** a subset of #5996: skip subflow work when there are none, and use an incremental connection lookup (safe because angflow clones changed edges). Must ship with #6109 plus its follow-ups c7a19b8ab and 74d510a22. Avoid #5972's `updateNodeInternals` refactor, which would require re-porting angflow's `initial` flag.
- **Tests:** upstream added cross-framework `generic-tests` covering pane activation keys, click-connect, intersection with origin, viewport transitions and reconnect, plus Playwright specs and examples (DragThreshold, MeasurementRace, Remount, FixedExtentNode). Port these as regression scenarios into `tests/playwright` / `examples/angular`.
- **Process:** keep the reference copies tracking upstream and repeat this triage per upstream minor release, so the drift doesn't grow to ~1000 commits again.

## 5. Roadmap

The ecosystem lever: `tests/playwright` is upstream's shared cross-framework e2e suite. It already
has an Angular config (`test:angular`, `FRAMEWORK=ng`), but `examples/angular` has no
`/tests/generic/*` pages, so the suite can't run against angflow. Building those pages makes
upstream's own tests check angflow, and every future sync brings new tests along. Upstream has added
7 spec files since the fork (background, click-connect, connection-hooks, intersection-origin,
measurement-race, nodes-data-hooks, reconnect-edge, viewport).

| # | Sub-project | Notes |
|---|---|---|
| A | Angular generic-test pages + upstream e2e specs, run in CI | Mirrors `examples/{react,svelte,vue}/src/generic-tests`. Failures feed B. |
| B | Bug-fix release: §1 upstream fixes + §2 angflow-native bugs (except deletion) | Includes #6097. system 0.1.x / angular 0.3.x |
| C | Deletion via system `getElementsToRemove` (+ #6074/#6111) | Behaviour change, its own release note |
| D | 0.4.0: full upstream 1.0 API alignment (all of §3, Changeset class included) | Agent tools, mcp snapshot, `AGENT_BRIDGE.md` |
| E | Feature parity: `selectNode`/`selectEdge`, `changeParent`, `xy-theme.css`, DevTools panel, missing React examples (refresh `docs/examples-parity.md`), optional #5996 perf subset with #6109 | |
| F | `@angflow/ui`: Angular port of the React Flow UI components, as a new package with no Tailwind/spartan dependency | Verify the upstream license first. Never port React Flow **Pro** examples (not open source). |
| G | Monthly scheduled upstream triage (report only, no code changes) | Prevents drift from piling up again |

**Decisions (2026-11-24):** order A→B→C→D→E→F. For breaking changes, match upstream fully rather
than deprecate-and-alias. UI components ship as a separate `@angflow/ui` package. Upstream triage
runs monthly on a schedule.
