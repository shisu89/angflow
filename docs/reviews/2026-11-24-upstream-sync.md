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

| Upstream | What it fixes for angflow | Effort | Status |
|---|---|---|---|
| #6064 (patch part) | Animated viewport calls (`fitView`, `setCenter`, zoom with `duration`) never resolve when a user gesture interrupts them. **Agent-bridge JSON-RPC calls hang.** | S | B ✓ e03887a8e, 8a5acc908, 299f8897d, f83837c0c, 07c29bc80, 559152cbd |
| #5915 | A child listed before its parent is drawn at its relative position and left out of the parent lookup. **angflow's own `groupNodes` / `group_nodes` tool produces exactly this order.** Also make angular's three `updateAbsolutePositions` call sites process parents first. | S | B ✓ 5dbc740f0, 29234d5e5, 5ef33a18e |
| #5998 | Resizer keeps a rejected `shouldResize` frame's values; `onResizeEnd` can be skipped. Guard upstream's 0×0 edge case. | S | B ✓ 6ddcb228b |
| #6097 | Internal selection state is mutated (system `getDragItems` plus angular `flow-store.service.ts:839/855/868`, `utils/changes.ts`). Can desync controlled mode. Both halves land together. | M | B ✓ 8998cffee |
| #5922 | `panActivationKeyCode="Control"` never starts a drag-pan. | S | B ✓ b9a3484ee |
| #6036 | Smooth-step bends sharper than `borderRadius` when nodes are close (clean cherry-pick). | XS | B ✓ 6fda4c901 |
| #5850 + #6108 + #6054 | Every wheel/pinch frame forces a synchronous layout. Port together, but keep angflow's box-selection `.zoom` listener fix. | S | B ✓ 458124850 |
| #6029 | Every cursor change restyles the whole flow. Also touches angular `style.css` / `ng-flow.css` cursor overrides. | S | B ✓ c68594a71 |
| #5889, #6055, #6158, #6119, #6084, #6131 | Trivial fixes: unmeasured sized parent extent; `reconnectEdge` with `getEdgeId`; `fitView` with no nodes; middle-mouse respects `panOnDrag`; resize with origin + extent; `NodeProps` union narrowing. | XS each | B ✓ 45df8bcd8 (#5889), bf1482363 (#6055), e03887a8e/8a5acc908 (#6158), 412e2d7d5 (#6119), 6ddcb228b (#6084), 03e44b699 (#6131: applied; angflow's `NodeProps` is the system alias) |
| #5839 | Dark-mode background pattern colour (must change angular `ng-flow.css` too). | XS | B ✓ a03a0ac1d, 0caa5566e |
| #5806, #5902, #5793 | `getNodesInside` allocations; middle-mouse pan from the selection rect (keep angflow's box-select guard); de-brand leftover "React Flow" dev-warning strings and links. | XS–S | B ✓ 705ebdd1c (#5806), 412e2d7d5 (#5902), c57ebaffa (#5793) |

## 2. Angflow-native bugs found during reconciliation

These are not upstream ports; the comparison surfaced them. Each one was checked against the code.

| Bug | Where | Effort | Status |
|---|---|---|---|
| `getNodesBounds` doesn't pass `nodeLookup`, so sub-flow children are bounded by their *relative* positions. The `get_nodes_bounds` agent tool inherits this. Fix together with upstream #5871. | `services/ng-flow.service.ts:859` | XS | B ✓ a450c4298 |
| `elevateEdgesOnSelect` does nothing: the input default `false` overrides the store default, the edge renderer never reads it, and `EdgeToolbar` uses `edge.zIndex + 1` instead of `getElevatedEdgeZIndex`. | `ng-flow.component.ts:520`, `edge-renderer.component.ts:392`, `edge-toolbar.component.ts:69` | S | B ✓ 3b2ec12e9 |
| `nodeClickDistance` is a dead input: the store signal is never read and `ngFlowDragClickDistance` is never bound. | `ng-flow.component.ts:509`, `drag.directive.ts:44` | XS (see §3) | D1 ✓ 35bb42d24 |
| The arrow-key a11y live announcement is missing entirely: `ariaLiveMessage` is rendered but never written. No Shift ×4 step and no snap/extent post-read. | `key-handler.directive.ts:225`, `flow-store.service.ts:295` | S | B ✓ d1139cfc6 |
| `(paneClick)` fires, and the selection resets, when a connection drag ends on the pane. | `ng-flow.component.ts` `onPaneClick` | S | B ✓ cf05e1cc3, 882902101 |
| A pane click cancels click-to-connect without firing `onClickConnectEnd`. | | S | B ✓ cf05e1cc3 (`(clickConnectEnd)` emitted; its `FinalConnectionState` payload stays D) |
| Programmatic `deleteElements` doesn't cascade a parent's children, ignores `deletable: false`, and merges edges quadratically. Switching to system `getElementsToRemove` fixes all three and picks up #6074/#6111 perf, but it's a **behaviour change** and needs its own release note. | `ng-flow.service.ts:742` | M | C ✓ ae51254f7, 63875b8b8, 46145dc89, 73382f3a8, 48630023f, ff43a6b19, 346fe2de8, e083f0f2b, 7826af094 |
| Smaller issues: store `reset()` leaves state behind for a provider-shared store; MiniMap keeps a stale `panZoom` after remount; `selectNodesData` has no equality function; key combinations like `Meta+Backspace` aren't supported. | | S each | B ✓ 92ea25a81, eeb20bbee (store reset / shared store), 0bdafc7ad, ee5b6c33d (MiniMap), cc81221fa (`selectNodesData`), 81c535327 (key combinations) |
| `(connectEnd)` emits no `FinalConnectionState`, and `NgFlowService.connection.to` is in screen coordinates while React's `useConnection` uses flow coordinates. | | S | D1 ✓ 4734b80f4, c4778393e, 525057729 |

## 3. Breaking API changes in upstream 1.0 / React 13

Each needs a decision: adopt now with a deprecated alias (non-breaking, 0.4.0), or defer to a breaking release.

| Change | Angflow blast radius | Non-breaking path? |
|---|---|---|
| `Handle` type → `HandleBounds` (#5987) | `public-api.ts`, `types/edges.ts`, 5 edge components, one example | Yes: deprecated type alias **D1 ✓** 21f9e39bf |
| `getHandleConnections` removed; `getNodeConnections({nodeId, type?, handleId?})`; `HandleConnection` → `NodeConnection` (#6114) | service, instance type, `get_handle_connections` agent tool, mcp snapshot, `AGENT_BRIDGE.md`, README | Yes: overload, deprecate, alias **D1 ✓** a8c1dd275 |
| `nodeClickDistance` removed; a click is suppressed only if the drag moved the node (#5556, prerequisite for #6168 touch drag) | Input is already dead, so it's a no-op for consumers | Yes: keep as a deprecated no-op **D1 ✓** 35bb42d24, 48e112d6a |
| `onConnectEnd` / `onReconnectEnd` `to` in flow coordinates (#6117) | Only `(reconnectEnd)`'s `connectionState` | Yes in practice (document it) **D1 ✓** 4734b80f4, bc26279de, c4778393e, 525057729, 761312dde |
| `paneClickDistance` → `paneDragThreshold` (default 1; gates pan **and** box-select start) (#6115) | System panzoom, `ng-flow.component.ts` input/effect/`onPaneClick`, pane marquee start, 3 examples | Yes: new input, old one becomes a deprecated alias. Largest item: hand-merge with angflow's `XYPanZoom.update()` changes, then touch testing. **D1 ✓** 768dbe548, cfb93c138, 3f34382f6 |
| Default fit padding becomes `'5%'`; **numeric padding is read as pixels** (#5927) | `fitBounds` default `0.1`, `fit_view`/`fit_bounds` agent schemas, mcp snapshot. An agent sending `0.1` would get 0px. | `'5%'` default is safe now (0.1 ≈ 4.5%). Pixel semantics only in a breaking release. **D1 ✓** 61e01fa3b, 1c5560800 |
| `setViewport` resolves `boolean` (#6064) | Direct `@angflow/system` users only | Yes **D1 ✓** B; 5dc910013 (`fitView` / `fitBounds`) |
| `colorMode` → `forceColorMode`, default follows the system scheme, CSS `light-dark()` | Host classes, `ng-flow.css` dark rules, matchMedia listener | Breaking release → D2 **D2 ✓** 9ac83daed, 786f09a62, 93f9a8b81 |
| Styles in `@layer xyflow` | Angflow's unlayered `ng-flow.css` would always override a layered theme | Breaking release (or ship angflow CSS in the same layer) → D2 **D2 ✓** 2cbf2cec4 |
| `onNodesChange` / `onEdgesChange` receive a `NodeChangeset` / `EdgeChangeset` class | Every app using `applyNodeChanges(changes, nodes)` | Match upstream fully, no opt-in → D3 **D3 ✓** 49c7d0700, cba6dc331, d7dc98c1e |

## 4. Feature and quality opportunities

- **Upstream features angflow lacks:** `selectNode` / `selectEdge` signals (the `useNode` / `useEdge` equivalents, trivial) **done (E1)**, `changeParent` (S) **done (E1)**, `xy-theme.css` (S).
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
| A | Angular generic-test pages + upstream e2e specs, run in CI | Mirrors `examples/{react,svelte,vue}/src/generic-tests`. Failures feed B. Spec: [design](../superpowers/specs/2026-11-25-shared-e2e-suite-angular-design.md), plan: [plan](../superpowers/plans/2026-11-25-shared-e2e-suite-angular.md). |
| B | Bug-fix release: §1 upstream fixes + §2 angflow-native bugs (except deletion) | Includes #6097. system 0.1.x / angular 0.3.x. Plan: [plan](../superpowers/plans/2026-11-25-bug-fix-release.md). Done: system 0.1.14 / angular 0.3.22 / mcp 0.0.4 |
| C | Deletion via system `getElementsToRemove` (+ #6074/#6111) | Behaviour change, its own release note. Plan: [plan](../superpowers/plans/2026-11-25-deletion.md). Done (unpublished, in 0.1.14 / 0.3.22 / 0.0.4) |
| D1 | Upstream 1.0 API and callback alignment (§3 rows 1–7) | Spec: [design](../superpowers/specs/2026-11-25-api-alignment-d1-design.md), plan: [plan](../superpowers/plans/2026-11-25-api-alignment-d1.md). Done (unpublished, in system 0.2.0 / angular 0.4.0 / mcp 0.1.0) |
| D2 | `forceColorMode`, `light-dark()`, `@layer xyflow`; the 2 colour-mode known failures | Done. Spec: [design](../superpowers/specs/2026-11-26-theming-d2-design.md), plan: [plan](../superpowers/plans/2026-11-26-theming-d2.md). Unpublished, in system 0.2.0 / angular 0.4.0 / mcp 0.1.0 |
| D3 | `NodeChangeset` / `EdgeChangeset` (#5944 and follow-ups) | Done. Spec: [design](../superpowers/specs/2026-11-26-changesets-d3-design.md), plan: [plan](../superpowers/plans/2026-11-26-changesets-d3.md). Unpublished, in system 0.2.0 / angular 0.4.0 / mcp 0.1.0 |
| E | Feature parity. **E1 ✓** (`selectNode`/`selectEdge`/`selectInternalNodes`, `changeParent`, update-API alignment); **E2** and **E3** pending (DevTools panel, missing React examples (refresh `docs/examples-parity.md`), optional #5996 perf subset with #6109). | E1 done, unpublished, in system 0.2.0 / angular 0.4.0 / mcp 0.1.0. Spec: [design](../superpowers/specs/2026-11-26-feature-parity-e1-design.md), plan: [plan](../superpowers/plans/2026-11-26-feature-parity-e1.md). |
| F | `@angflow/ui`: Angular port of the React Flow UI components, as a new package with no Tailwind/spartan dependency | Verify the upstream license first. Never port React Flow **Pro** examples (not open source). |
| G | Monthly scheduled upstream triage (report only, no code changes) | Prevents drift from piling up again |

**Decisions (2026-11-24):** order A→B→C→D→E→F. For breaking changes, match upstream fully rather
than deprecate-and-alias. UI components ship as a separate `@angflow/ui` package. Upstream triage
runs monthly on a schedule.

### A — first-run findings

First full run of upstream's `tests/playwright` suite against `examples/angular` (2026-11-25,
chromium, Playwright 1.65.1): **85 tests, 52 passed, 6 skipped by the specs themselves**
(React-only hook/measurement specs, the React selection-rectangle drag test and the Vue-only
`fitView` test), **27 failed**. All 27 are listed in `tests/playwright/known-failures.ng.ts` and
were stable across `--repeat-each=3`. None was caused by the generic host, the overrides or the
example pages.

| Owner | Entries | What |
|---|---|---|
| B | 25 | 14 hit rows already in §1/§2: #6064 ×7, #5922, #6055 ×2, the arrow-key announcement, `elevateEdgesOnSelect`, pane click cancelling click-to-connect without `onClickConnectEnd` ×2. 1 is the touch pan-vs-marquee divergence (react appendix row #48). The other 10 trace to 5 new bugs (below). |
| C | 0 | |
| D | 2 | `forceColorMode` and the page-theme colour model (`props.spec` colorMode) |
| E | 0 | |
| flaky-upstream / wontfix | 0 | The 4 former in-spec Angular skips were re-checked: node-toolbar positioning and pane panning now pass; edges `deletable=false` and `interactionWidth` are real bugs (edge-label row below), not hit-test fragility |

**New bugs not yet in §1/§2** (all owner B, fixed in B):

| Bug | Where | Failing tests |
|---|---|---|
| HTML edge labels are rendered as `.xy-flow__edge-label[data-id]` siblings outside the edge `<g>`. They duplicate the edge's `data-id`, and with `pointer-events: all` they cover the edge centre without selecting the edge (upstream renders the label inside the edge). | `edge-renderer.component.ts:294-308` | `edges.spec` animated, selectable=false, deletable=false, aria-label, interactionWidth |
| Background pattern ids ignore the flow id: `id` is used verbatim (upstream `pattern-<flowId><id>`), so several flows on one page share `#0` and every flow paints the first one's pattern. No half-gap `patternTransform` either. | `background.component.ts:121` | `background.spec` (both) |
| The click synthesised after a marquee drag cancels a pending click-to-connect: `onPaneClick` clears `connectionClickStartHandle` before its `selectionInProgress` guard. | `ng-flow.component.ts` `onPaneClick` | `click-connect.spec` dragging a selection does not cancel a pending click connection |
| The default connection line's `<g>` lacks the `ng-flow__connection` class and the valid/invalid status classes. | `connection-line.component.ts:27` | `click-connect.spec` dropping a dragged connection on the pane does not fire pane click |
| The pane's `selection` class tracks only an active marquee (`userSelectionActive`), not upstream's `isSelecting` (selection key held or `selectionOnDrag`). | `pane.component.ts:22` | `pane.spec` selection key keeps touch drag in selection mode |

### B — results

Known-failures entries 27 → 4. B: 25 → 0 (23 fixed, 2 re-owned to D: the two "pane click
cancels a pending connection" click-connect entries need the `FinalConnectionState`
payload, #6117). D: 2 → 4 (2 colour-mode, 2 click-connect payload). Commit range:
`343756d6a..HEAD` of the B work (everything on `main` after `343756d6a`, including the 0.3.22 release commit and the final-review fix commits).

### C — results

Known failures unchanged at 4 (all D), verified by the full e2e verdict (0 NOT MATCHED, 0 STALE, 0 chromium failures); vitest, lint, typecheck and builds green. The five entry points (`deleteElements`, keyboard
delete, Controls delete, the `delete_elements` tool and the `apply_changes` op) and
`dissolveGroup` all go through `getElementsToRemove`. Upstream #6074 / #6111 are ported
into system `getElementsToRemove` (ae51254f7). Commit range: `d54d18f8d..HEAD`.

### D1 — results

Known failures 4 → 2: the two click-connect payload entries are fixed (Task 7), and the 2 colour-mode entries remain, re-pointed to D2. Full verdict: 0 NOT MATCHED, 0 STALE, 0 chromium failures. Every D1 system change is a hand-port of one upstream PR, keeping angflow's deliberate system divergences (no-teardown `XYPanZoom.update()`, the start handler's `internal` guard, XYDrag's abort path, and so on). Commit range: `3b96f518e..HEAD`. The only remaining grep hits for the removed names (`SystemHandle`, `getHandleConnections`, `nodeClickDistance`, `paneClickDistance`, …) are negative tests.

Differences from upstream, recorded in the changelog: `selectionOnDrag` applies only when the primary button doesn't pan (matches upstream, 3f34382f6); on a completing click, `isValid` / `toHandle` come from angflow's preview-line snap; the marquee crossing doesn't call `resetSelectedElements()`; a drag's crossing move only starts the drag.

Touch matrix (#6115), emulated with Playwright and CDP touch on chromium:

| # | Case | Result |
|---|---|---|
| 1 | Tap, and tap with 3px jitter → `(paneClick)`, no pan | pass (Chrome emulation drops sub-~15px touchmoves, so a real device should confirm the jitter case) |
| 2 | 30px drag under a 40px threshold doesn't pan; 100px pans | pass |
| 3 | Pinch zooms at once (threshold 100) | pass |
| 4 | Selection key held: marquee starts after 2px (threshold 50) | pass |
| 5 | Node drag identical at threshold 0 and 50 | pass |
| 6 | Threshold 0 pans on the first move | pass |
| 7 | Real touch device | pending (user) |

### D2 — results

Known failures 2 → 0: the two `props.spec` colorMode entries are removed (786f09a62). Full verdict: 0 NOT MATCHED, 0 WRONG FILE, 0 STALE, 0 chromium failures, `verdict: OK`. Commit range: `42b15702c..HEAD`.

- **System styles end state.** `git diff HEAD upstream/main -- packages/system/src/styles` shows only angflow's deliberate `transform-origin` on `.xy-flow__viewport-portal`. Each upstream change is its own commit with a `Ported from` line: 997a67b16, 9ac83daed, 5bb87f807, 41abd847b, 58715e6ee, a3ef3c022 (`xy-theme.css`).
- **Angular.** `forceColorMode` replaces `colorMode` (786f09a62); `'system'`, `ColorModeClass` and the matchMedia listener are gone, with no alias.
- **CSS bundler (2cbf2cec4).** The regex pipeline became postcss-import, postcss-nested and autoprefixer, with everything in `@layer xyflow`. Compared against the old output from the same sources: 151 selectors in `style.css` and 142 in `base.css` on both sides, no declaration differences; the only additions are autoprefixer's `-webkit-`/`-moz-user-select`. The old bundler had left 32 (`style.css`) / 24 (`base.css`) selectors as un-flattened native `&` nesting, which browsers without CSS nesting dropped. An unlayered app reset now beats angflow's rules, so the examples app layers its reset (`@layer reset, xyflow;`); without it pane.spec "panning the pane moves it" failed by 1px.
- **`ng-flow.css` audit (93f9a8b81).** Duplicates of system rules were deleted, divergent tokens now defer to system tokens, and Angular structural and colour rules were kept (colour rules in `ng-flow-theme.css`, `style.css` only). Visible default changes: edges `#b1b1b7`/1 (was `#999`/1.5), connection line `#b1b1b7`/1 (was `#555`/2), transparent light-mode background (was `#fafafa`), `CanvasText` for node, controls-button and edge-label text, 6px handles (was 8px). `base.css` now matches upstream's minimal one. The premise that the `ng-flow__edge-text*` fill selectors were dead was wrong: `edge-text.component.ts` renders both class names, so the fills always applied; they were renamed to `xy-flow__` with no visible change. Computed styles on `/examples/color-mode`: light edge `rgb(177, 177, 183)` 1px, node `rgb(255, 255, 255)`; dark edge `rgb(62, 62, 62)`, node `rgb(30, 30, 30)`; light page with `forceColorMode="dark"` matches dark.
- **Two extra fixes found on the way.** MiniMap background follows the colour scheme and `bgColor` writes `--xy-minimap-background-color-props` (c5fdff34d); the built-in default, input and output nodes honour `sourcePosition` / `targetPosition` (ae29242ce).
- **Final review (opus).** Two real issues were fixed:
  - A runtime change to `sourcePosition`/`targetPosition` moved the handle but left edges on the old bounds. The node renderer now re-measures a node with `force` when its `type`/`sourcePosition`/`targetPosition` changes, as upstream's NodeWrapper does.
  - The root cause was pre-existing: `FlowStore.updateNodeInternals` never bumped `version`, so a handle-only re-measure (including the public `NgFlowService.updateNodeInternals()`) didn't re-route edges.

  Checked in Chromium on `/layouting`: after "horizontal layout" the edge starts on the right-side handle (distance 0, was 76px). The review also fixed an invalid `@import` order in the changelog's reset snippet and corrected the `base.css` wording. Not done (nits): the unused `matchMedia` test stubs, and the kitchen-sink chrome following `prefers-color-scheme` rather than `forceColorMode` (pre-existing).
- **`xy-theme.css` (821c07e5f).** Ships as `@angflow/angular/xy-theme.css` (`base.css` plus upstream's theme); the `/xy-theme` example loads it for that page only.
- **Left out of scope on purpose.** The in-browser agent chat (`src/lib/agent/chat/`) is not themed for dark mode, and neither is an angflow brand palette.
- The D1 real-device touch check for `paneDragThreshold` (row 7 above) is still pending (user).

### D3 — results

Known failures stay at 0. Full e2e verdict at the Task 3 checkpoint: 0 known failures, 0 NOT MATCHED, 0 WRONG FILE, 0 STALE, 0 chromium failures, `verdict: OK` (79 passed, 6 skipped). Tests: system 187, angular 1106, mcp 65, examples `ng test` 6. The mcp snapshot is unchanged (no agent tool change). Commit range: `1284ea381..HEAD`; commits: 49c7d0700 (system `changes/` module, #5944 5ff09ef77 plus 10 follow-ups, listed in its body), cba6dc331 (Angular emits changesets), d7dc98c1e (55 examples migrated).

Deviations from the plan, as executed:

1. `getElementsDiffChanges` was deleted, not rewritten: nothing called it and it was never in `public-api.ts`.
2. The module lineage landed as one system commit (all follow-ups from c3a844e62 to ee44a8883, `packages/system` paths only). The only divergence from upstream is `DimensionChange.initial`.
3. The type renames landed repo-wide in the system commit, because Angular `tsc` resolves `@angflow/system` to its source.
4. The examples were broken between the Angular commit and the examples commit (55 files imported the removed helpers); the library, its specs and `tsc` stayed green.
5. `@angflow/angular` re-exports only React's change-related list (the type names, `NodeChangeset`, `EdgeChangeset`) plus angflow's `applyDimensionChanges`; the creators and `applyNodeChanges(nodes, changeset)` stay importable from `@angflow/system`, as upstream.

Found during execution:

- `NodeBase.resizing` was added from upstream c3a844e62, because the ported `apply.ts` needs it.
- An old middleware spec passed vacuously (it asserted nothing against the changeset path) and was fixed.
- The `kitchen-sink` example's `any[]` handler was found only by the example build, not by the library's `tsc`.

Behaviour notes: `setNodeCollapsed` and `dissolveGroup` still emit `'replace'`; `addNodes` / `addEdges` store items by reference; a key set to `undefined` in `updateNode` clears it; clearing a changeset inside a handler does nothing, as in React.

Final-review fixes (after the docs commit): the agent add tools (`add_node`, `add_nodes`, `add_edge`, `add_edges` and the matching `apply_changes` ops) reject ids that already exist, because changesets ignore an `'add'` for an existing id; `NgFlowService.groupNodes` throws when the group id exists; `recordOp` deep-clones params so a later fast-path move cannot rewrite a logged op; and doc corrections (README, changelog qualifiers, review-report counts and citations).

### E1 — results

Commits: 3136449f0 (selectors), f0cba51ee (selectors notify on in-place drag), a766a0eed (system `changeParentNode`), 839a7dd79 (update APIs and `changeParent`), 7a75ccef8 (pan/zoom fixes), plus the docs commit.

Known failures stay at 0. Full e2e verdict: 0 known failures, `verdict: OK` (79 passed, 6 skipped). Tests: system 187, angular 1155, mcp 65, examples `ng test` 6. The mcp snapshot is unchanged (no agent tool change).

Deviations from the plan, as executed:

1. `connectionInProgress` excludes the click-connect preview, so panning while a click connection is pending still works.
2. `positionAbsolute` is compared by value in the internal-node selectors, because `updateAbsolutePositions` reassigns a fresh object for every root node on parented moves, which would otherwise notify unrelated nodes.
3. `groupNodes` / `dissolveGroup` do not use `changeParent` (see the 839a7dd79 body): they are unchanged, and only `setNodeGroup` delegates to it.

Manual Chromium check (7a75ccef8 work): on the figma example a right-click emits `(paneContextMenu)` once and a right-drag pan does not; on the subflows example `changeParent` keeps the node at the same on-screen position.
