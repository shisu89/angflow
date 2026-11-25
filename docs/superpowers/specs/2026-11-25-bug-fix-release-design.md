# Sub-project B — bug-fix release (design)

Date: 2026-11-25. Roadmap: [`docs/reviews/2026-11-24-upstream-sync.md`](../../reviews/2026-11-24-upstream-sync.md) §5, row B.
Predecessor: sub-project A (upstream `tests/playwright` suite running against `examples/angular` in CI).

## Goal

One patch release (`@angflow/system` 0.1.14, `@angflow/angular` 0.3.22, `@angflow/mcp` 0.0.4 only if
its snapshot changes) that:

1. ports every non-breaking upstream fix in report §1;
2. fixes every angflow-native bug in report §2 **except deletion** (sub-project C) and the items whose
   upstream fix is an API change (sub-project D, listed under Non-goals);
3. fixes the 5 bugs the shared e2e suite found (report §5 "A — first-run findings");
4. leaves **zero `owner: 'B'` entries** in `tests/playwright/known-failures.ng.ts`: 23 of the 25 are
   fixed; the 2 `pane click cancels a pending connection` entries depend on the `(clickConnectEnd)`
   payload, an API change, and are re-owned to D (the emission itself is fixed in B).

## Decisions (2026-11-25)

| Question | Decision |
|---|---|
| Scope | Everything in §1 + §2 minus deletion, plus the 5 suite-found bugs |
| #6064 return shapes | Interrupted promises settle. Additive only: `setViewport` resolves `boolean`, `FitViewResult` gains `ended`. The full flip of `fitView` to `boolean` is D |
| Shipping | One release at the end. Versions are bumped and release notes drafted; the user runs the npm publishes (2FA) |
| Test bar | Failing test first. A fix either removes its known-failures entry, or (when the e2e suite doesn't cover it) lands with a vitest test that fails before the fix |
| Touch pan vs marquee (react appendix row #48) | Match upstream (policy "match upstream fully"): touch pans when `panOnDrag` reserves the primary mouse button for selection, unless the selection key is held. The deliberate divergence comment in `pane.component.ts` goes |

## Porting rules

- **System fixes are applied one upstream change at a time, system paths only:**
  `git diff <merge>^1 <merge> -- packages/system | git apply -3`. A plain `git cherry-pick` would also
  apply the React/Svelte/Vue hunks, which conflict because `packages/{react,svelte,vue}` already sit at
  `upstream/main`. When the diff doesn't apply, port by hand. Either way the commit body says
  `Ported from xyflow/xyflow#<PR> (<sha>)`. Never merge `packages/system` wholesale. Upstream SHAs are in
  the report appendices (`docs/reviews/2026-11-24-upstream-sync/*.md`), and each task names the
  prerequisites listed in the appendix "Prerequisites" section.
- Keep angflow's deliberate system divergences that the report calls out (box-selection `.zoom`
  listener in #5850, the box-select guard in #5902, the `update()` divergence in XYPanZoom).
- One fix (or one tightly coupled group, e.g. #5850+#6108+#6054) per commit, its test in the same commit.
- Removing a known-failures entry happens in the commit that fixes it. `check-known-failures.mjs`
  reports a STALE entry if a fix lands without removing it; that is informational locally but the
  plan treats STALE as a failure to clean up before the task is done.

## Work packages

Ordered so the riskiest shared code (viewport promises, graph positions) lands first and the edge/
pane/connection work can then proceed independently.

### WP1 — Viewport

| Item | Change | Test |
|---|---|---|
| #6064 (patch part) | `xypanzoom/utils.ts getD3Transition` adds `.on('interrupt cancel', () => onEnd(false))` as upstream does, and `onEnd` takes `ended: boolean`. All three callers in `XYPanZoom.ts` (`setTransform`, `scaleTo`, `scaleBy`; today `() => resolve(true)` at ~:81/:275/:288) resolve `true` when ended, `false` when interrupted/cancelled. **Deliberate system type change:** `PanZoomInstance.setViewport` goes from `Promise<ZoomTransform \| undefined>` (`types/panzoom.ts:53`) to `Promise<boolean>`, matching upstream 1.0. No angflow code reads the old value; the changelog calls it out for direct `@angflow/system` users | e2e: 6 of the 7 `Viewport transitions` entries removed (the 7th needs the shared promise below) |
| angular viewport surface | `FlowStore`/`NgFlowService`: `setViewport` → `Promise<boolean>` (was `void`; covers the `pz.setViewport` call at `ng-flow.service.ts:147` too); `setCenter` passes the boolean through (was always `true`); zoomIn/Out/To pass it through. `FitViewResult` (system `types/general.ts`) gains `ended: boolean`; `fitView`/`fitBounds` fill it | vitest in `flow-store` / `graph` for each return value, including interruption |
| shared fit promise | As upstream React's store (`packages/react/src/store/index.ts` `latestFitViewId` / `fitViewResolver`): `FlowStore.fitView` keeps the latest fit id and one pending resolver; a call superseded by a later `fitView` doesn't resolve on its own interruption but receives the last fit's result. Same for `fitBounds`. Non-fit viewport calls (scroll, `setViewport`) still interrupt it with `ended: false` | e2e: `fit view called again during its transition settles when the last fit ends` removed; vitest for the superseded case |
| agent bridge | `fit_view`/`fit_bounds` results gain `ended`. `set_viewport` now awaits the animation and returns `boolean` (today it neither awaits nor returns, `agent-bridge.service.ts:759-763`), so its JSON-RPC reply arrives after the animation; documented. No tool can hang any more. `AGENT_BRIDGE.md` updated in the same commit. The `fit_view`/`fit_bounds` descriptions in `tool-schemas.ts` ("Returns { zoom, clamped }") change, so the mcp snapshot is regenerated and mcp 0.0.4 ships | agent-bridge spec: an interrupted `fit_view` call resolves with `ended: false` |
| generic-test page | `overrides/viewport/components/viewport-transitions-node.component.ts` reads `result.ended` for `fitView` and the boolean for `setViewport` instead of assuming "ended" | e2e above |
| #6158 | `fitViewport` already returns `{zoom: NaN, clamped: false}` for an empty lookup (`graph.ts:380`); port upstream's extra guard for an empty `nodesToFit` (e.g. `nodes: [{id: 'missing'}]`), resolving `ended: true` | vitest |
| #5850 + #6108 + #6054 | Cache the pane extent instead of a synchronous layout per wheel/pinch frame; ignore ResizeObserver entries without `contentRect`. Keep angflow's box-selection `.zoom` listener fix | vitest on the cache; existing e2e zoom tests stay green |
| #5922 | Port the system half, and `updatePanZoomOptions()` in the angular package passes `panActivationKeyPressed` through to `XYPanZoom.update` (report 0.0.77–0.0.84 row #5922) | e2e: `Pane activation keys` entry removed |
| #6119 (needs 0.0.80 `f72e31247` first) | Middle-mouse pan respects `panOnDrag`, also over `__selection` / `__nodesselection` | vitest on XYPanZoom's filter: middle button with `panOnDrag=[0]` is rejected, with `[1]` accepted, over a selection element |
| #5902 | Middle-mouse pan from the selection rect; keep angflow's box-select guard | vitest on the same filter: middle button over `__selection` pans, primary button still box-selects |

### WP2 — Graph and node correctness

| Item | Change | Test |
|---|---|---|
| #5915 | Deferred sub-flow resolution so a child listed before its parent gets its absolute position and parent lookup entry. Make the angular package's three `updateAbsolutePositions` call sites order-safe | vitest: `groupNodes` output order (child before parent) renders children at absolute positions |
| #6097 | System `getDragItems` `onlyDragNode` / `isUnselectedNodeDrag`, **and** angular `utils/changes.ts getSelectionChanges` + `flow-store.service.ts` (the `mutateItem` callers and `unselectNodesAndEdges`) stop mutating internal state. Both halves in one commit | vitest: controlled vs uncontrolled selection, dragging an unselected node while others are selected, `selectNodesOnDrag=false`, box selection |
| `getNodesBounds` | `NgFlowService.getNodesBounds` passes `nodeLookup` (with upstream #5871). The `get_nodes_bounds` agent tool inherits the fix | vitest with a sub-flow child |
| #5889 | Unmeasured sized parent extent | vitest (system) |
| #5998 | Resizer drops a rejected `shouldResize` frame's values; `onResizeEnd` always fires. Guard the 0×0 edge case | vitest (system) |
| #6084 | Resize with origin + extent | vitest (system) |
| #5806 | `getNodesInside` allocation reduction | existing tests |

### WP3 — Edges

| Item | Change | Test |
|---|---|---|
| Edge labels (suite-found) | Upstream's built-in edges render `edge.label` as **SVG** `<EdgeText>` inside the edge `<g>` (`packages/react/src/components/Edges/BaseEdge.tsx:59-68`); `EdgeLabelRenderer` is a separate, user-supplied HTML portal. Angflow instead renders `edge.label` as an HTML `div.xy-flow__edge-label[data-id]` with `pointer-events: all` in an overlay (`edge-renderer.component.ts:294-308`). Fix: built-in edges render `edge.label` through the existing `components/edges/edge-text.component.ts` inside `<g data-id>`, honouring `labelStyle`, `labelShowBg`, `labelBgStyle`, `labelBgPadding`, `labelBgBorderRadius`. The HTML overlay label and its duplicate `data-id` go, so a label click bubbles to the `<g>` and selects the edge. The user-facing edge-label-renderer component (if any) is untouched | e2e: 5 `Edges › properties` entries removed; vitest that the label sits inside the edge `<g>`; the examples app's custom-edge pages checked by hand |
| `elevateEdgesOnSelect` | Input default changes from `false` (`ng-flow.component.ts:520`) to upstream's `true` (the store default at `flow-store.service.ts:231` already is), the edge renderer uses `getElevatedEdgeZIndex`, and `EdgeToolbar` uses it instead of `edge.zIndex + 1`. **Behaviour change:** selected edges are elevated by default; changelog | e2e: `elevate edges on select` entry removed |
| #6036 | Smooth-step bends never sharper than `borderRadius` | upstream's test |
| #6055 | `reconnectEdge` honours `options.getEdgeId`, replaces the id when `shouldReplaceId` is omitted, and routes errors to `options.onError` instead of `devWarn` (add `onError` to `ReconnectEdgeOptions`) | e2e: 2 `reconnectEdge` entries removed |
| #6131 | `NodeProps` union narrowing, if angflow's node-component input type has the same shape; otherwise record N/A in the report | type test (`tsc`) |

### WP4 — Pane and connections

| Item | Change | Test |
|---|---|---|
`onPaneClick` (`ng-flow.component.ts`) is restructured to upstream's order (`packages/react/src/container/Pane/index.tsx` `onClick`): return early when a marquee selection is in progress, when a connection drag just ended on the pane (angflow's equivalent of `connectionEndedOnPane`), or while a connection is in progress; only then cancel a pending click-connect and fire `(paneClick)`.

| Item | Change | Test |
|---|---|---|
| Connection drag ending on pane | `(paneClick)` does not fire and the selection is not reset | e2e: `dropping a dragged connection on the pane does not fire pane click` entry removed (also needs the connection-line class below) |
| Pane click cancels click-connect | Emits `(clickConnectEnd)` when it cancels. The output keeps its `MouseEvent` payload; upstream's second argument (the final connection state, which the upstream spec JSON-parses) is an API change and goes to D with #6117 | vitest that the output fires. The 2 `pane click cancels a pending connection` entries stay, **re-owned to D** with the reason updated to the payload |
| Marquee drag vs click-connect (suite-found) | Covered by the early return above (today the `connectionClickStartHandle` clear at ~:1140 precedes the `selectionInProgress` check at ~:1148) | e2e: `dragging a selection does not cancel…` entry removed |
| Connection line classes (suite-found) | The default connection line `<g>` gets `ng-flow__connection` / `xy-flow__connection` and the valid/invalid status classes while dragging, removed after the drop | covered by the entry above |
| Pane `selection` class (suite-found) | Tracks upstream `isSelecting`: selection key held, an active marquee, or `selectionOnDrag` with `panOnDrag !== true`; touch counts only while the selection key is held (`Pane/index.tsx:162-164`). `selectionKeyPressed` is today a plain field on `key-handler.directive`; it becomes a store signal so the host binding at `pane.component.ts:22` updates | e2e: `selection key keeps touch drag in selection mode` entry removed |
| Touch pan (row #48) | Match upstream, see Decisions | e2e: `touch drag pans when primary mouse drag is reserved for selection` entry removed |

### WP5 — Accessibility and styling

| Item | Change | Test |
|---|---|---|
| Arrow-key announcement | As upstream (`useMoveSelectedNodes.ts`, `A11yDescriptions`): the aria-live div at `ng-flow.component.ts:242` gets id `${prefix}-flow__aria-live-<flowId>` (both `ng-` and `xy-` class/ids as elsewhere) and is rendered only when keyboard a11y is enabled. Arrow keys step **5px** (or `snapGrid[0]` when snapping; today 1px, `key-handler.directive.ts:216-217`), Shift ×4. After the move, the message from `ariaLabelConfig['node.a11yDescription.ariaLiveMessage']` (`system/src/constants.ts:45`) is written with the moved node's `~~positionAbsolute` after snap/extent. All selected nodes move; the announcement is for the focused node only (the node wrapper that has focus); no focused node, no announcement. **Behaviour change:** 5px step; changelog | e2e: `announces its new position` entry removed |
| Background ids (suite-found) | As upstream `Background`: pattern id `pattern-<flowId><id>`, and `pattern-<flowId>` when no id is given (replacing `ng-flow-bg-…`); each flow references its own pattern. Pattern `x`/`y` = `transform % scaledGap` with no offset; the offset moves to `patternTransform = translate(-(offset*zoom + dim/2), …)` where `dim` is `scaledSize` for `cross` and `scaledGap` otherwise. `patternOffset()` stops feeding `x`/`y`, or the offset counts twice | e2e: 2 `Background` entries removed (`flow-d1` expects `translate(-52,-52)`) |
| #5839 | Dark-mode background pattern colour (system CSS and angular `ng-flow.css`) | visual check in the examples app |
| #6029 | Cursor via `::before` so cursor changes don't restyle the whole flow (system `init.css`, angular `style.css` / `ng-flow.css` overrides) | existing e2e stays green |
| #5793 | De-brand leftover "React Flow" dev-warning strings and links | grep check |

### WP6 — Smaller store issues

| Item | Change | Test |
|---|---|---|
| Store `reset()` | Leaves no state behind for a provider-shared store | vitest |
| MiniMap `panZoom` | Re-reads `panZoom` after the flow remounts | vitest |
| `selectNodesData` | Equality function so unchanged data doesn't re-emit | vitest |
| Key combos | `deleteKeyCode` etc. accept combinations like `Meta+Backspace` (upstream `useKeyPress` semantics) | vitest |

### WP7 — Release

- Versions: system 0.1.14, angular 0.3.22 (its `workspace:^` dependency is rewritten by pnpm on publish),
  mcp 0.0.4 (its snapshot changes with the `fit_view`/`fit_bounds` descriptions).
- `CHANGELOG.md` entries for system and angular (both files are stale; add the new version on top,
  don't backfill). Call out:
  - additive API: `setViewport` boolean, `FitViewResult.ended`, agent tool results, `set_viewport` now
    awaiting its animation;
  - the system type change of `PanZoomInstance.setViewport`;
  - behaviour changes: touch pans instead of starting a marquee, selected edges elevated by default,
    5px arrow-key step, built-in edge labels are SVG inside the edge (anyone styling
    `.xy-flow__edge-label` as an HTML div must restyle), background pattern ids.
- Report: §1/§2 rows marked done with commit SHAs; known-failures summary updated (B: 0).
- Memory: roadmap status.
- The publish itself is the user's step; the plan ends with the exact commands and the packed-manifest check
  from `CLAUDE.md`.

## Non-goals (and where they go)

| Item | Why not B | Goes to |
|---|---|---|
| Deletion via `getElementsToRemove` (+ #6074/#6111) | Behaviour change with its own release note | C |
| `fitView` → `Promise<boolean>`, numeric padding = px (#5927) | Breaking | D |
| `nodeClickDistance` dead input | Upstream #5556 makes it a deprecated no-op; wiring it now only to delete it in D is waste | D (#5556 + #6168) |
| `(connectEnd)` and `(clickConnectEnd)` `FinalConnectionState` payloads, flow-coords `connection.to` | Upstream #6117 / callback signatures are an API change. The 2 `pane click cancels a pending connection` e2e entries depend on the payload and move to D | D |
| `paneDragThreshold` (#6115), `HandleBounds` (#5987), lookup helpers (#6114) | Breaking / API | D |
| `forceColorMode`, page-theme colour model | API; the 2 `owner: 'D'` entries stay | D |
| #5996 perf subset, #6109 | Optional perf | E |

## Risks

- **#6097 halves out of sync.** The angular half alone breaks dragging an unselected node while others are
  selected. Mitigation: one commit, the test matrix in WP2.
- **#5915 and angflow's `groupNodes`.** Changing resolution order can move nodes in existing apps that
  relied on the buggy order. Mitigation: vitest on the exact `groupNodes` output; examples app smoke check.
- **Edge-label restructure.** Built-in labels change from an HTML overlay div to SVG text inside the edge.
  Apps that styled the HTML label (CSS on `.xy-flow__edge-label`, HTML content in `label`) see a visual
  change; custom edges that place their own labels must keep working. Mitigation: the edges e2e spec,
  the examples app's custom-edge pages, and a changelog entry with the migration.
- **Touch-pan behaviour change.** Apps that relied on touch starting a marquee lose that; called out in
  the changelog.
- **Cherry-pick drift.** Upstream 1.0 commits may build on changes angflow lacks (report appendix
  "Prerequisites"). Each task names its prerequisites; hand-ports cite the upstream PR.

## Done when

- `pnpm --filter playwright test:angular` passes with only `owner: 'D'` entries left (the 2 colour-mode
  ones plus the 2 re-owned click-connect payload ones) and `check-known-failures` reports 0 STALE.
- CI is green on `main` (build/typecheck/lint/vitest + e2e).
- Versions bumped, changelogs written, report and memory updated, publish commands handed to the user.
