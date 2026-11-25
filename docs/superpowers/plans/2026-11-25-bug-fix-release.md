# Bug-fix Release — Implementation Plan (sub-project B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One patch release (`@angflow/system` 0.1.14, `@angflow/angular` 0.3.22, `@angflow/mcp` 0.0.4) that ports the non-breaking upstream fixes in report §1, fixes the angflow-native bugs in report §2 (except deletion), fixes the 5 bugs the shared e2e suite found, and leaves **zero `owner: 'B'` entries** in `tests/playwright/known-failures.ng.ts`.

**Architecture:**
- System fixes are ported one upstream change at a time, system paths only (`git diff <merge>^1 <merge> -- packages/system | git apply -3`, or a hand-port when it doesn't apply). Each commit body cites `Ported from xyflow/xyflow#<PR> (<sha>)`.
- Angular wrapper fixes follow upstream React's behaviour (`packages/react` is the verbatim reference).
- Every fix lands with its test in the same commit: either it deletes its known-failures entry (e2e) or it adds a vitest that fails before the fix.
- Work packages run in the spec's order, WP1 (viewport) → WP7 (release), with a full verification checkpoint after each.

**Tech stack:** `@angflow/system` (TypeScript, d3-zoom/d3-drag, rollup, vitest + jsdom), `@angflow/angular` (Angular 21 build, peer ≥19, signals, zoneless-first; vitest via `@analogjs/vite-plugin-angular`, JIT), `@angflow/mcp` (tsx snapshot generator, vitest), upstream Playwright suite in `tests/playwright` (`FRAMEWORK=ng`, `playwright.angular.config.ts`, Playwright 1.65.1), pnpm 11 workspace.

**Spec:** `docs/superpowers/specs/2026-11-25-bug-fix-release-design.md`

---

## Spec deviations

The spec stays the contract. These are places where the code or upstream differs from what the spec says; the plan follows the code/upstream as described.

1. **`git apply` mostly needs hand-ports.** Checked against the index with `git apply --cached --check`: #6064, #6158, #6108 (alone), #6054, #5922, #5902, #6119, #5998, #6084, #6131, #6029 and #5793 don't apply. Clean, in the order this plan uses them: #5850 → #6108, #5915, #6097, #5871, #5889, #5806, #6036, #6055, #5839. Each task says which.
2. **#6064's `utils.ts` hunk conflicts too.** Only `types/panzoom.ts` applies. Its context line `wheelDelta = (event: WheelEvent)` doesn't exist in angflow (`event: any`). `graph.ts` conflicts because angflow returns `FitViewResult`, not a boolean, and has no `defaultFitViewPadding` (#5927).
3. **#6158 adds `graph.test.ts`;** angflow's file is `graph.spec.ts`. Hand-ported. Angflow returns `{ zoom: NaN, clamped: false, ended: true }` instead of upstream's `true`.
4. **#5902 == f72e31247.** Both produce the identical `filter.ts` blob (`1ad80c040`). Porting #5902 satisfies #6119's "0.0.80 f72e31247" prerequisite, so #5902 goes first and the two land as one coupled task (spec order was #6119, then #5902). Upstream's `isMouseEvent`/`D3ZoomInputEvent` typing (7976e13e7) is not ported. The filter keeps `event: any`.
5. **#6054 is only its `destroy()` hunk plus the comment.** Its `update()` hunk replaces `destroy()` with `on('zoom', null)` during a selection. Angflow removed that teardown on purpose (the DELIBERATE DIVERGENCE block in `XYPanZoom.update`), so the hunk doesn't apply and isn't ported.
6. **Shared promise for `fitBounds` is angflow-only.** Upstream React's `fitBounds` (`useViewportHelper.ts:65-82`) returns `panZoom.setViewport(...)` directly, with no shared promise. The spec says "same for `fitBounds`", so the plan gives `fitBounds` its own latest-call chain, separate from `fitView`'s. To make that possible, `fitBounds`' viewport call moves from `NgFlowService` into `FlowStore`. See Open question 2.
7. **`updateAbsolutePositions` order-safety lives in the system function, not at the three angular call sites.** One parents-first walk in `packages/system/src/utils/store.ts:61` covers all three callers (`flow-store.service.ts:499, :780, :1012`). Upstream React no longer calls this function, so this is an angflow-only system divergence and gets a comment.
8. **#5915's dev warning uses `process.env.NODE_ENV`.** Angflow's system never reads `process.env` (see the `setDevWarnSink` note, `utils/general.ts:157-180`). The leftover-deferred-children warning becomes a plain `console.warn`. That matches the unconditional `console.warn` it replaces as the only missing-parent signal.
9. **#6055 `onError` keeps a `devWarn` fallback.** Upstream calls only `options.onError?.()`, because React wraps `reconnectEdge` and injects its own dev warning. Angflow re-exports system's `reconnectEdge` directly (`public-api.ts:136`), so `options.onError ?? devWarn` keeps today's warnings. The same `onError` option is added to `AddEdgeOptions`/`addEdge` for parity (Task 17). Upstream's own doc comment says "If not provided, a default dev warning is used".
10. **#6036 ships no upstream test.** The merge (8523d8dd9) touches only `smoothstep-edge.ts`, so the plan adds a vitest with a case verified to differ (Task 16).
11. **Edge labels: the existing `edge-text.component.ts` can't be used as-is.** Today it's an element-selector component (`ng-flow-edge-text`) that renders HTML in a `<foreignObject>` and has no `labelStyle`/`labelBg*` inputs. An element-selector component inside an `<svg>` gets an unknown SVG-namespace host, whose children don't render. Task 14a rewrites it as an SVG attribute component (`g[ngFlowEdgeText]`) with upstream `EdgeText`'s structure. See Open question 3.
12. **Edge labels: the layout label measurement reads the HTML label.** The spec doesn't mention it. `NgFlowService.withLiveEdgeLabels` (`ng-flow.service.ts:602-619`) queries `.xy-flow__edge-label[data-id]` to give `layoutNodes` the label sizes, and `ng-flow.service.spec.ts:485` mocks that selector. Task 14a moves both to the SVG label.
13. **Pane `selection` class condition.** Upstream is `selectionOnDrag && !isLeftClickPan(panOnDrag)` (`FlowRenderer/index.tsx:80`), where `isLeftClickPan = panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(0))`. The spec's "`panOnDrag !== true`" is slightly off. Angflow's system has no `isLeftClickPan` export, so it's a local helper.
14. **`selectionKeyPressed` doesn't need to become a store signal.** It already is one: `store.selectionKeyActive`, set in `key-handler.directive.ts:67/114`. The private `selectionKeyPressed`/`multiSelectionKeyPressed` fields (`:53-54`) are dead and get removed. The host binding at `pane.component.ts:22` reads `store.userSelectionActive()` today.
15. **Arrow-key step lives at `key-handler.directive.ts:220`,** not `:216-217`. Upstream's `useMoveSelectedNodes` moves only nodes that are **selected and draggable**, applies `snapPosition`, then `calculateNodePosition` (extent/origin). Task 22 ports all of that, so the announcement reports the post-snap/extent position.
16. **Existing tests that encode the old behaviour change in the fixing commit:**
    - `XYPanZoom.spec.ts:115` ("allows a middle-click pan that starts on a node", `panOnDrag: [0]`) flips with #6119.
    - `edge-toolbar.component.spec.ts:33-41` (`zIndex + 1`) changes with `getElevatedEdgeZIndex`.
    - `pane.auto-pan.spec.ts:342` (touch starts a marquee) changes with the touch-pan decision.
    - `ng-flow.service.spec.ts:485` (label selector) changes with the edge-label restructure.
    - `dev-warn.spec.ts` changes if the help URL changes (Open question 5).
17. **mcp snapshot is regenerated twice.** Once in Task 4 (descriptions change), and once in Task 31 after the angular bump, so `GENERATED_FROM_ANGULAR_VERSION` reads 0.3.22 (precedent: c8f40bd12).

## Open questions

Each has a default the plan implements. The plan review accepted every default (question 5 was changed by the review); they go to the user with the plan. Answer before the named task if you want the alternative.

1. **Store reset semantics (Task 27).** Upstream resets the *whole* store on every `<ReactFlow>` unmount, provider stores included (`StoreUpdater/index.tsx:107-117`, `store/index.ts:464-477`). Angflow deliberately keeps a provider store's graph across an inner `<ng-flow>` unmount, and a test asserts it (`ng-flow-provider.component.spec.ts:99`; comment at `ng-flow.component.ts:1060`). Angflow's `reset()` also keeps configuration on purpose (`flow-store.service.spec.ts:41`).
   - **Default (accepted by review):** keep angflow's graph-retention semantics. On *every* `<ng-flow>` destroy (both branches), clear the per-component wiring that stays behind today: the `on*` callbacks pointing at the destroyed component's outputs, `domNode`, `width`/`height`, connection and interaction state. `reset()` calls the same helper.
   - **Alternative:** match upstream fully (reset provider stores on unmount). That flips the provider test and needs a changelog behaviour-change entry.
2. **`fitBounds` shared promise (Task 3).** **Default (accepted by review):** as the spec says (own chain). **Alternative:** match upstream (no sharing, interrupted `fitBounds` resolves `ended: false`).
3. **Custom edges and `EdgeTextComponent`'s selector (Tasks 14a, 14b).** Today the HTML overlay draws `edge.label` for *custom* edges too. Upstream draws nothing for a custom edge unless the component renders it (React's `BaseEdge` accepts `label*` props).
   - **Default (accepted by review):** the renderer stops drawing labels for every edge type. `BaseEdgeComponent` gains upstream `BaseEdge`'s label inputs. The built-in edge components forward their label inputs to it. `EdgeTextComponent` becomes `g[ngFlowEdgeText]`. The changelog carries the migration for custom edges and for `<ng-flow-edge-text>`.
   - **Alternative:** keep an overlay label for custom edges only (without `data-id`, `pointer-events: none`).
4. **Background geometry (Task 23).** Moving the offset into `patternTransform = translate(-(offset*zoom + dim/2), …)` only lands the grid where upstream draws it if the pattern shapes are upstream's too. Upstream's shapes:
   - dots: `<circle cx=r cy=r r=scaledSize/2>`;
   - lines/cross: `M{w/2} 0 V{h} M0 {h/2} H{w}`, unscaled `strokeWidth=lineWidth`;
   - default `size`: cross 6, others 1.

   Angflow's shapes sit at the tile corner (`background.component.ts:45-87`), so with the new transform they'd shift half a cell.
   - **Default (accepted by review):** full upstream parity of the `<pattern>` element (ids, x/y, `patternTransform`, child shapes, default sizes). This is a visual behaviour change and gets a changelog entry; dots get smaller for the same `size`, because upstream's `size` is a diameter.
   - **Alternative:** ids + `patternTransform` only, keep angflow's shapes and accept the half-cell shift.
5. **De-branded help URL (Task 26).** **Decision (review):** the system default sink keeps upstream's default, `[xyflow]: … Help: https://xyflow.com/error#<id>`. Angflow's own `ngDevWarn` drops the `Help:` URL and prints `[angflow]: <message>`, because angflow-only ids (and angflow's divergent messages) would point at nothing. **Alternative:** keep a link in `ngDevWarn`.
6. **Key-combo scope (Task 30).** **Default (accepted by review):** upstream `useKeyPress` combo semantics for `deleteKeyCode`, `selectionKeyCode` and `multiSelectionKeyCode`. `panActivationKeyCode`/`zoomActivationKeyCode` keep their current physical-key tracking (the `panActivationKeyCode`/`zoomActivationKeyCode` blocks in `KeyHandlerDirective.onKeyDown`, and the activation-key tests in `key-handler.directive.spec.ts`). **Alternative:** move the activation keys onto the same tracker too.

## Global Constraints

- **Never edit** these. Verify before every commit with `git diff --quiet HEAD -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts packages/react packages/svelte packages/vue examples/react examples/svelte examples/vue examples/astro-xyflow` (exit 0).
  - `tests/playwright/e2e/**`
  - `tests/playwright/playwright.{shared,react,svelte,vue}.config.ts`
  - `packages/{react,svelte,vue}/**`
  - `examples/{react,svelte,vue,astro-xyflow}/**`

  Never edit a spec to make it pass: fix the library (or the Angular examples-app page) and delete the entry.
- **Porting rule.** Port one upstream change at a time, system paths only: `git diff <sha>^1 <sha> -- packages/system | git apply -3`. Never `git cherry-pick`: it would also apply React/Svelte/Vue hunks onto reference copies that already sit at `upstream/main`. When a hunk doesn't apply, apply the clean files with an explicit path list and hand-port the rest. Never merge `packages/system` wholesale. Every system-port commit body has `Ported from xyflow/xyflow#<PR> (<sha>)`.
- **Keep angflow's deliberate system divergences:**
  - `XYPanZoom.update()` never tears down d3 listeners during a selection, and `destroy()` also removes `.zoom` DOM listeners (`XYPanZoom.ts:111-131, :217-224`);
  - the `!userSelectionActive` guard in the filter's middle-button branch (`filter.ts:36-50`);
  - `setDevWarnSink` (don't adopt upstream `createDevWarn`);
  - `store.ts`'s measured carry-over, `parseHandles` preservation, the `initial` dimension flag, and the parent guard;
  - `getFitViewNodes`' broader size fallback (#5851);
  - `FitViewResult` as an object (D flips it to boolean).
- **Zoneless rules (CLAUDE.md):** never inject `NgZone`. Event handlers from outside Angular (d3, native listeners, rAF) drive views by writing signals the template reads. Timers are fine for scheduling, never for forcing change detection. APIs used must exist in Angular 19 (the peer range). `afterRenderEffect` exists in 19. `DOCUMENT` comes from `@angular/common`.
- **Build order.** `examples/angular` and the e2e suite consume both packages through `dist/`. After any library change, rebuild system, then angular, before running the examples app or e2e:
  `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/system build && PATH="$SHIM:$PATH" corepack pnpm -F @angflow/angular build`.
  Angular vitest aliases `@angflow/system` to `../system/src` (`packages/angular/vitest.config.ts`), so vitest needs no rebuild. If an e2e run still shows the old behaviour after a rebuild, delete `examples/angular/.angular/cache` and rerun.
- **Line endings.** This working tree may be checked out CRLF (the index is LF; `git ls-files --eol` shows `i/lf w/crlf`).
  - Before editing *or applying a patch to* a file, normalise it: `sed -i 's/\r$//' <file…>`. Git still reports the file unchanged, because its content now equals the index.
  - For a port: `git diff <sha>^1 <sha> --name-only -- packages/system | xargs sed -i 's/\r$//'`.
  - New files are LF.
  - Before every commit, check `git diff --stat`: a file whose changed-line count is about its total length is CRLF churn. Normalise and redo the edit.
- **pnpm isn't on PATH. Rule: every `corepack pnpm …` invocation runs with the shim on PATH, written `PATH="$SHIM:$PATH" corepack pnpm …`** (Preflight creates `$SHIM`).
  - The root scripts (`build`, `lint`, `typecheck`, `test` in the root `package.json`) and Playwright's `webServer` (`pnpm --filter=angular-examples run dev`) call a bare `pnpm` internally, so `corepack pnpm` alone isn't enough.
  - Every command in this plan already carries the prefix; keep it when you adapt one.
  - `npx …` needs no shim.
  - Non-interactive installs also need `CI=true`.
  - Shell state doesn't persist between commands, so the prefix goes on each command.
  - Exception: the publish commands in Task 31 Step 8 are for the user's own shell.
- **Agent bridge:**
  - Any change to a tool's params, return shape, or behaviour updates `packages/angular/AGENT_BRIDGE.md` in the same commit.
  - Any change to `tool-schemas.ts` regenerates the mcp snapshot in the same commit: `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/mcp run generate:schemas`. The `packages/mcp` drift test (`test/schema-snapshot.spec.ts`) fails otherwise.
- **Known failures:**
  - A fix deletes its `known-failures.ng.ts` entry in the same commit.
  - `check-known-failures.mjs` lists a fixed-but-still-listed entry under `STALE (now passing)`. That's informational to the script, but this plan treats any STALE as a failure to clean up before the task is done.
  - A partial run (single spec) can't use the checker: it would report entries from other files as NOT MATCHED. Focused runs use the blocking `chromium` project only; the WP checkpoints run the full verdict.
- **Commits:** trunk-based on `main`, one commit per task.
  - Stage explicit paths only (`git add <paths>`), never `git add -A`.
  - Never touch or commit unrelated working-tree changes: run `git status --short` before staging.
  - Conventional-commit subjects.
  - Every message ends with exactly these two lines:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
    ```
  - Use `git commit -F- <<'EOF' … EOF` so the trailers survive intact.
  - Subagents use exactly these two trailers, not whatever attribution their own harness suggests. The `Claude Opus 5.5` name is intentional and correct.
- **Line numbers** in this plan are as of `$BASE`. Once an earlier task has edited a file, a later task's `:NNN` is only a hint: locate the code by the symbol named next to it.
- **Model tiers** are given in each task heading (workflow preference): haiku = mechanical 1–2-file change with complete instructions; sonnet = multi-file/integration; opus = high-risk/design-heavy.

### Commands used throughout

```bash
# Build (from repo root)
PATH="$SHIM:$PATH" corepack pnpm -F @angflow/system build && PATH="$SHIM:$PATH" corepack pnpm -F @angflow/angular build

# vitest, one file (from the package dir)
cd packages/system  && npx vitest run src/<path>.spec.ts
cd packages/angular && npx vitest run src/lib/<path>.spec.ts

# Typecheck the angular package (includes its spec files; tsconfig.json has no spec exclude)
cd packages/angular && npx tsc --noEmit

# One e2e spec, blocking project only (from tests/playwright; Playwright starts ng serve on 4201)
cd tests/playwright && PATH="$SHIM:$PATH" FRAMEWORK=ng npx playwright test -c playwright.angular.config.ts e2e/<spec>.spec.ts --project=chromium

# Full verdict (chromium + ng-known-failures + check-known-failures.mjs), from repo root
PATH="$SHIM:$PATH" corepack pnpm --filter playwright test:angular
```

**Failing-test-first for an e2e-covered fix:**
1. Delete the entry from `known-failures.ng.ts`.
2. Rebuild, then run the spec on `--project=chromium`. The deleted test now runs in the blocking project and fails.
3. Fix, rebuild, rerun. It passes.

---

## Preflight (no commit)

- [ ] **Step 1: Base and remotes.**
  1. `git status --short` should be empty, or contain only changes you will leave alone.
  2. Record `BASE=$(git rev-parse HEAD)` in your notes; the final review diffs against it.
  3. `git fetch upstream`.
  4. Confirm `git rev-parse upstream/main` resolves.
- [ ] **Step 2: pnpm shim.** Pick a scratch dir (your session scratchpad), e.g. `SHIM=<scratch>/pnpm-shim`. Then run `mkdir -p "$SHIM" && corepack enable pnpm --install-directory "$SHIM" && PATH="$SHIM:$PATH" pnpm --version`. Expected: `11.21.0`.
- [ ] **Step 3: Baseline.** Build both packages, then run the full verdict.
  Expected: `known failures: 27 entries`, `NOT MATCHED: 0`, `WRONG FILE: 0`, `STALE (now passing): 0`, `chromium failures: 0`, `verdict: OK`.
  Also run `PATH="$SHIM:$PATH" corepack pnpm test` from the root (all three vitest suites green).

---

## WP1 — Viewport

### Task 1 (sonnet): System — settle interrupted viewport transitions (#6064 patch part, #6158)

Upstream: #6064 merge `b6ec4b195` (commit de1e4c5); #6158 merge `a4ec3dff1` (commit 6bb426c). No prerequisites in angflow. Upstream's #6158 followed #6064's boolean return; angflow keeps `FitViewResult`.

**Files:**
- Modify: `packages/system/src/xypanzoom/utils.ts` (`getD3Transition`, :26-34)
- Modify: `packages/system/src/xypanzoom/XYPanZoom.ts` (`setTransform` :77-88, `setViewport` :241-247, `scaleTo` :271-282, `scaleBy` :284-295)
- Modify: `packages/system/src/types/panzoom.ts` (:53)
- Modify: `packages/system/src/types/general.ts` (`FitViewResult`, :181-194)
- Modify: `packages/system/src/utils/graph.ts` (`fitViewport`, :372-399)
- Modify (keep angular compiling): `packages/angular/src/lib/services/flow-store.service.ts` (:898), `packages/angular/src/lib/services/ng-flow.service.ts` (`fitBounds`, :137-150)
- Modify: `packages/angular/AGENT_BRIDGE.md` (the `fit_view`/`fit_bounds` rows of the Viewport table and the `FitViewResult` paragraph, :177-187). This is the first commit that changes those tools' result shape, so the doc changes with it (AGENT_BRIDGE same-commit rule).
- Test: `packages/system/src/xypanzoom/XYPanZoom.spec.ts`, `packages/system/src/utils/graph.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Normalise line endings** for every file above (`sed -i 's/\r$//' …`).

- [ ] **Step 2: Failing tests.** Append to `XYPanZoom.spec.ts` (reuses its `setup()`; d3-transition runs on real timers in jsdom):
  ```ts
  describe('XYPanZoom transition promises (#6064)', () => {
    it('resolves true when a transition runs to the end', async () => {
      const { panZoom } = setup();
      await expect(panZoom.setViewport({ x: 10, y: 0, zoom: 1 }, { duration: 20 })).resolves.toBe(true);
      await expect(panZoom.scaleTo(1.5, { duration: 20 })).resolves.toBe(true);
      await expect(panZoom.scaleBy(1.1, { duration: 20 })).resolves.toBe(true);
    });

    it('resolves true immediately without a duration', async () => {
      const { panZoom } = setup();
      await expect(panZoom.setViewport({ x: 10, y: 0, zoom: 1 })).resolves.toBe(true);
    });

    it('resolves false when another viewport call cancels a scheduled transition', async () => {
      const { panZoom } = setup();
      const pending = panZoom.setViewport({ x: 300, y: 0, zoom: 1 }, { duration: 5000 });
      void panZoom.setViewport({ x: 0, y: 0, zoom: 1 }); // interrupts before the transition starts → 'cancel'
      await expect(pending).resolves.toBe(false);
    });

    it('resolves false when a running transition is interrupted', async () => {
      const { panZoom } = setup();
      const pending = panZoom.scaleTo(1.8, { duration: 5000 });
      await new Promise((r) => setTimeout(r, 50)); // let it start
      void panZoom.setViewport({ x: 0, y: 0, zoom: 1 }); // → 'interrupt'
      await expect(pending).resolves.toBe(false);
    });
  });
  ```
  In `graph.spec.ts`, extend `describe('fitViewport')`:
  - `ended` is `true` with the existing `fakePanZoom()`;
  - `ended` is `false` when `setViewport` resolves `false` (`({ setViewport: async () => false }) as unknown as PanZoomInstance`);
  - the empty-lookup case returns `ended: true`;
  - **#6158:** a lookup whose only node is unmeasured and sizeless (or `fitViewport(..., { nodes: [{ id: 'missing' }] })` via the options path) resolves `{ zoom: NaN, clamped: false, ended: true }`, and a spy `setViewport` is **not** called. Today it zooms to `maxZoom`.

  Run `cd packages/system && npx vitest run src/xypanzoom/XYPanZoom.spec.ts src/utils/graph.spec.ts`. Expected: the new tests fail. Interrupted promises time out (vitest 5s default) or resolve `true`/a `ZoomTransform`; `ended` is `undefined`.

- [ ] **Step 3: Apply the clean file.** `git diff b6ec4b195^1 b6ec4b195 -- packages/system/src/types/panzoom.ts | git apply` makes `setViewport: (…) => Promise<boolean>`. Drop the now-unused `ZoomTransform` import only if nothing else in the file uses it; `setViewportConstrained` (:55-58) still does.

- [ ] **Step 4: Hand-port the rest.**
  - `utils.ts`: replace `getD3Transition` with upstream's body. `onEnd: (ended: boolean) => void = () => {}`; no duration calls `onEnd(true)`; otherwise
    ```ts
    selection.transition().duration(duration).ease(ease)
      .on('end', () => onEnd(true))
      .on('interrupt cancel', () => onEnd(false))
    ```
    Keep upstream's comment ("A user gesture or another viewport update stops a running transition with "interrupt" (or with "cancel" if it has not started yet) and the transition never sends "end"").
  - `XYPanZoom.ts`:
    - in `setTransform`, `scaleTo` and `scaleBy`, pass `resolve` instead of `() => resolve(true)`;
    - `setViewport` becomes `const nextTransform = viewportToTransform(viewport); return setTransform(nextTransform, options);`.
  - `types/general.ts` `FitViewResult`: add
    ```ts
    /**
     * False when a user gesture or another viewport call interrupted the fit's
     * animation before it finished. True when it ran to the end or there was
     * nothing to animate (no nodes to fit, or duration 0).
     */
    ended: boolean;
    ```
  - `graph.ts` `fitViewport`:
    - the `nodes.size === 0` return gets `ended: true`;
    - after `const nodesToFit = getFitViewNodes(nodes, options);` add the #6158 guard `if (nodesToFit.size === 0) return { zoom: NaN, clamped: false, ended: true };`;
    - `const ended = await panZoom.setViewport(…)`;
    - return `{ zoom: viewport.zoom, clamped: …, ended }`.

- [ ] **Step 5: Keep the angular package compiling.** `FitViewResult.ended` is now required, and angular resolves `@angflow/system` to its source.
  - `flow-store.service.ts:898`: return `{ zoom: NaN, clamped: false, ended: false }`.
  - `ng-flow.service.ts` `fitBounds`:
    - no-panZoom return gets `ended: false`;
    - `const ended = await pz.setViewport(…)`;
    - return `{ zoom: viewport.zoom, clamped: …, ended }`;
    - update its doc comment.
  - Run `cd packages/angular && npx tsc --noEmit` and fix any other `FitViewResult` literal it reports (spec files included).

- [ ] **Step 5b: `AGENT_BRIDGE.md`.**
  - The `fit_view` and `fit_bounds` rows return `{ zoom, clamped, ended }`.
  - The `FitViewResult` paragraph gains: "`ended` is `false` when a user gesture or another viewport call interrupted the fit's animation, and `true` when it ran to the end or there was nothing to animate."

  The `tool-schemas.ts` descriptions and the mcp snapshot stay as they are until Task 4.

- [ ] **Step 6: Known failures.** `zoomTo`/`zoomIn` already pass `scaleTo`/`scaleBy`'s boolean through (`flow-store.service.ts:954-970`), so their two entries pass now. In `known-failures.ng.ts`, change the viewport `.map` array from `['fit view', 'set center', 'zoom to', 'zoom in']` to `['fit view', 'set center']`.

- [ ] **Step 7: Verify.**
  - Run `cd packages/system && npx vitest run` (all green).
  - Run `cd packages/angular && npx vitest run` (all green; mocks returning `undefined` from `setViewport` are fine).
  - Build, then run `e2e/viewport.spec.ts` on `--project=chromium`. Expected: `zoom to …` and `zoom in resolves with false when a scroll interrupts it` pass. The other five viewport known failures are still excluded.

- [ ] **Step 8: Commit.**
  ```bash
  git add packages/system/src/xypanzoom/utils.ts packages/system/src/xypanzoom/XYPanZoom.ts packages/system/src/xypanzoom/XYPanZoom.spec.ts \
    packages/system/src/types/panzoom.ts packages/system/src/types/general.ts packages/system/src/utils/graph.ts packages/system/src/utils/graph.spec.ts \
    packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/AGENT_BRIDGE.md tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(system): settle interrupted viewport transitions

  A user gesture or another viewport call interrupts or cancels a d3 transition,
  which never sends "end", so fitView/setCenter/zoom* with a duration hung forever.
  getD3Transition now reports ended=false on interrupt/cancel, PanZoomInstance.setViewport
  resolves boolean, FitViewResult gains `ended`, and fitViewport keeps the viewport when
  nothing is fittable.

  Ported from xyflow/xyflow#6064 (b6ec4b195) and xyflow/xyflow#6158 (a4ec3dff1).
  System type change: PanZoomInstance.setViewport now resolves Promise<boolean>.
  AGENT_BRIDGE.md: fit_view/fit_bounds results document `ended`.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 2 (sonnet): Angular viewport surface reports interruption

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`setCenter` :929-945, `setViewport` :947-952)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (doc comments on `fitView` :107-114, `setViewport` :116-119, `setCenter` :131-134, zoom* :88-105)
- Modify: `examples/angular/src/app/generic-tests/overrides/viewport/components/viewport-transitions-node.component.ts`
- Test: `packages/angular/src/lib/services/flow-store.service.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.** In `flow-store.service.spec.ts`, next to `describe('setCenter interpolate forwarding')` (~:1034), add `describe('viewport helpers report interruption')`:
  - `setViewport` resolves `true`/`false` from `panZoom.setViewport` (`vi.fn().mockResolvedValue(false)`);
  - `setViewport` resolves `false` without panZoom;
  - `setCenter` resolves `false` when `panZoom.setViewport` resolves `false`;
  - `zoomTo` resolves `false` when `scaleTo` resolves `false`.

  Run `cd packages/angular && npx vitest run src/lib/services/flow-store.service.spec.ts`. Expected: these fail. `setViewport` resolves `undefined` today; `setCenter` always `true`.

- [ ] **Step 2: Implement.**
  - `setViewport(viewport, options): Promise<boolean>`: `if (!pz) return false; return pz.setViewport(viewport, options);`.
  - `setCenter`: `return pz.setViewport({ … }, { … });` (drop the trailing `return true`).
  - `NgFlowService`: types come through. Update the doc comments: each animated helper "resolves `true` when the animation ran to the end and `false` when a user gesture or another viewport call interrupted it"; `fitView` "resolves `{ zoom, clamped, ended }`".

- [ ] **Step 3: Generic-test page.** In `viewport-transitions-node.component.ts`:
  - `track()`: `const ended = typeof result === 'boolean' ? result : (result as FitViewResult).ended;` (import `type FitViewResult` from `@angflow/angular`; it's exported, `public-api.ts:226`).
  - Replace the header comment with one line: "fitView resolves { zoom, clamped, ended }; the other helpers resolve a boolean."

  This file is an Angular component, not an override config, so it has no pin and `check:generic-tests` is unaffected.

- [ ] **Step 4: Known failures.** Delete the whole viewport `.map(...)` block (`fit view`, `set center`), plus the entries titled `a transition resolves with false when a viewport change cancels it before it starts` and `an interrupted fit view does not run again when a node is dragged`. Keep `fit view called again during its transition settles when the last fit ends` (Task 3).

- [ ] **Step 5: Verify.**
  - Build, then run `e2e/viewport.spec.ts` on `--project=chromium`. Expected: everything passes except the still-excluded `fit view called again …`.
  - Run `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests`. Expected: in sync.

- [ ] **Step 6: Commit.**
  ```bash
  git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/src/lib/services/flow-store.service.spec.ts \
    examples/angular/src/app/generic-tests/overrides/viewport/components/viewport-transitions-node.component.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): viewport helpers resolve false when interrupted

  setViewport now resolves boolean (was void) and setCenter passes the panZoom result
  through (was always true), so callers can tell an interrupted animation from a
  finished one. The viewport-transitions test page reads FitViewResult.ended.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 3 (opus): Shared fit promise for `fitView` (and `fitBounds`)

Upstream reference: `packages/react/src/store/index.ts:75-114` (`latestFitViewId`, `fitViewResolver`) and `packages/react/src/hooks/useReactFlow.ts:298-304`. Angflow's `fitBounds` gets its own chain (Spec deviation 6, Open question 2).

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`fitView` :896-911, `resolveFitView` :1065-1092; new `fitBounds`)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`fitBounds` :137-150 delegates; `getViewportForBoundsInternal` :1210 stays for its other callers)
- Test: `packages/angular/src/lib/services/flow-store.service.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

**Interfaces:**
```ts
// flow-store.service.ts (private)
type FitResolver = { promise: Promise<FitViewResult>; resolve: (r: FitViewResult) => void; reject: (e: unknown) => void };
type FitChain = { latestId: number; resolver: FitResolver | null };
private readonly fitChains: Record<'fitView' | 'fitBounds', FitChain> = {
  fitView: { latestId: 0, resolver: null },
  fitBounds: { latestId: 0, resolver: null },
};

/**
 * Runs `run` and settles the chain's shared promise with the LATEST call's result.
 * A call superseded by a newer one on the same chain never settles on its own
 * interruption; it receives the newer call's result. Non-fit viewport calls
 * (scroll, setViewport, zoom*) still interrupt it and settle it with ended: false.
 */
private runFitChain(kind: 'fitView' | 'fitBounds', run: () => Promise<FitViewResult>): Promise<FitViewResult>;

fitBounds(bounds: Rect, options?: { padding?: number; duration?: number; minZoom?: number; maxZoom?: number }): Promise<FitViewResult>;
```

- [ ] **Step 1: Failing tests.** Add `describe('shared fit promise')` to `flow-store.service.spec.ts`. The `setViewport` stub hands out controllable promises:
  ```ts
  function deferredPanZoom() {
    const pending: Array<(ended: boolean) => void> = [];
    const setViewport = vi.fn(() => new Promise<boolean>((r) => pending.push(r)));
    return { pz: { setViewport, getViewport: () => ({ x: 0, y: 0, zoom: 1 }) }, pending, setViewport };
  }

  beforeEach(() => {
    store.width.set(800);
    store.height.set(600);
    store.setNodes([makeNode('a', { width: 100, height: 50 }), makeNode('b', { position: { x: 300, y: 0 }, width: 100, height: 50 })]);
  });

  it('a fitView superseded by a later fitView settles with the last fit', async () => {
    const { pz, pending } = deferredPanZoom();
    store.panZoom.set(pz as never);
    const first = store.fitView({ duration: 5000 });
    const second = store.fitView({ duration: 2000 });
    let firstSettled = false;
    void first.then(() => (firstSettled = true));
    pending[0](false); // the second fit interrupted the first
    await Promise.resolve(); await Promise.resolve();
    expect(firstSettled).toBe(false);
    pending[1](true);
    await expect(first).resolves.toMatchObject({ ended: true });
    await expect(second).resolves.toMatchObject({ ended: true });
  });

  it('a non-fit interruption settles the pending fit with ended: false', async () => {
    const { pz, pending } = deferredPanZoom();
    store.panZoom.set(pz as never);
    const fit = store.fitView({ duration: 5000 });
    pending[0](false);
    await expect(fit).resolves.toMatchObject({ ended: false });
  });

  it('a fitView after the shared promise settled gets a fresh promise', async () => { /* two sequential fits; the second is a new promise that settles independently */ });

  it('fitBounds keeps its own chain', async () => { /* fitBounds twice → the first settles with the second's result; an interleaved fitView does not join it */ });
  ```
  Also assert that `NgFlowService.fitBounds` delegates to `store.fitBounds`: `vi.spyOn(store, 'fitBounds')` in `ng-flow.service.spec.ts`, or keep it to the store test if a service test already covers `fitBounds`.
  Run `npx vitest run src/lib/services/flow-store.service.spec.ts`. Expected: the superseded test fails (`first` settles with `ended: false`); `store.fitBounds` is not a function.

- [ ] **Step 2: Implement `runFitChain`.**
  ```ts
  private runFitChain(kind: 'fitView' | 'fitBounds', run: () => Promise<FitViewResult>): Promise<FitViewResult> {
    const chain = this.fitChains[kind];
    const resolver = (chain.resolver ??= createFitResolver());
    const id = ++chain.latestId;
    run().then(
      (result) => {
        // A newer call on this chain started while this one ran; it settles the shared promise.
        if (id !== chain.latestId) return;
        resolver.resolve(result);
        if (chain.resolver === resolver) chain.resolver = null;
      },
      (error) => {
        if (id !== chain.latestId) return;
        if (chain.resolver === resolver) chain.resolver = null;
        resolver.reject(error);
      },
    );
    return resolver.promise;
  }
  ```
  `createFitResolver()` is a module-level helper building `{ promise, resolve, reject }` by hand. `Promise.withResolvers` is ES2024 and the package targets ES2022.

- [ ] **Step 3: Route the fits through it.**
  - `fitView`: no panZoom → `Promise.resolve({ zoom: NaN, clamped: false, ended: false })`. Otherwise `this.runFitChain('fitView', () => fitViewport({ … }, options))`. Drop `async` so the shared promise itself is returned.
  - `resolveFitView` (queued `[fitView]` input path) uses the `fitView` chain too, so a user `fitView()` during the initial fit shares its promise. `await this.runFitChain('fitView', () => fitViewport({ …, }, this.fitViewOptions()))`, then the existing transform sync.
  - New `FlowStore.fitBounds`: move the body of `NgFlowService.fitBounds` here (`getViewportForBounds(bounds, width, height, effMin, effMax, options?.padding ?? 0.1)`, then `pz.setViewport(…, { duration })`, then `{ zoom, clamped, ended }`) inside `runFitChain('fitBounds', …)`.
  - `NgFlowService.fitBounds` becomes `return this.store.fitBounds(bounds, options);`.

- [ ] **Step 4: Known failures.** Delete the entry `fit view called again during its transition settles when the last fit ends`.

- [ ] **Step 5: Verify.**
  - Run `cd packages/angular && npx vitest run`.
  - Run `npx tsc --noEmit`.
  - Build, then run `e2e/viewport.spec.ts` on `--project=chromium`: every test passes or is skipped by the spec (the Vue-only one).

- [ ] **Step 6: Commit.**
  ```bash
  git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/src/lib/services/flow-store.service.spec.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): share one promise between overlapping fitView calls

  As upstream React's store: a fitView superseded by a later fitView no longer settles
  on its own interruption; every caller receives the last fit's result. fitBounds gets
  its own chain (it moves into FlowStore). Other viewport calls still interrupt a fit
  with ended: false.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 4 (sonnet): Agent bridge viewport results (`ended`, `set_viewport` awaits)

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`set_viewport` :759-763)
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`:
  - `fit_view` :305-320;
  - `set_viewport` :322-…;
  - `fit_bounds` :583-605;
  - optionally the `zoom_in`/`zoom_out`/`zoom_to`/`set_center` descriptions, to mention the boolean.
- Modify: `packages/angular/AGENT_BRIDGE.md` (Viewport table rows for `set_viewport`, `zoom_*`, `set_center`; the `ended` rows came with Task 1)
- Regenerate: `packages/mcp/src/generated/tool-schemas.ts`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts` (`describe('fit clamp signal')` ~:2048)

- [ ] **Step 1: Failing tests.** In `describe('fit clamp signal')`:
  ```ts
  function stubPanZoom(flow: NgFlowService, setViewport: (...a: unknown[]) => Promise<boolean>) {
    const store = (flow as unknown as { store: FlowStore }).store; // NgFlowService.store is private (ng-flow.service.ts:55)
    store.width.set(800);
    store.height.set(600);
    store.panZoom.set({ setViewport, getViewport: () => ({ x: 0, y: 0, zoom: 1 }) } as never);
  }

  it('an interrupted fit_view resolves with ended: false', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a', { width: 100, height: 50 }), makeNode('b', { position: { x: 300, y: 0 }, width: 100, height: 50 })]);
    stubPanZoom(flow, vi.fn().mockResolvedValue(false));
    const res = (await bridge.callTool('fit_view', { duration: 500 })) as FitViewResult;
    expect(res.ended).toBe(false);
  });

  it('set_viewport awaits the animation and returns its boolean', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    let finish!: (ended: boolean) => void;
    stubPanZoom(flow, () => new Promise<boolean>((r) => (finish = r)));
    let settled = false;
    const call = bridge.callTool('set_viewport', { viewport: { x: 1, y: 2, zoom: 1 }, duration: 500 }).then((r) => { settled = true; return r; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish(true);
    await expect(call).resolves.toBe(true);
  });
  ```
  Also add `expect(res).toHaveProperty('ended')` to the existing `fit_view`/`fit_bounds` shape tests (:2049, :2082).
  Run `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts`. Expected: `set_viewport` resolves `undefined` immediately.

- [ ] **Step 2: Implement.** `set_viewport` handler: `return flow.setViewport(viewport, { duration });`.

- [ ] **Step 3: Descriptions.**
  - `fit_view`: "Zoom and pan so all (or the given) nodes are visible. Returns { zoom, clamped, ended }; clamped is true when the content was too large to frame at minZoom, ended is false when a user gesture or another viewport call interrupted the animation."
  - Same `ended` wording for `fit_bounds`, and in both `minZoom` property descriptions ("Returns { zoom, clamped, ended }").
  - `set_viewport`: "Set the viewport to an absolute { x, y, zoom }. With duration, the call resolves after the animation: true when it ran to the end, false when it was interrupted."

- [ ] **Step 4: `AGENT_BRIDGE.md`.** Task 1 already documented `ended` for `fit_view`/`fit_bounds` and in the `FitViewResult` paragraph; don't duplicate it.
  - Viewport table:
    - `set_viewport` "Awaits the animation; returns `true` when it ran to the end, `false` when interrupted (a user gesture or another viewport call). The JSON-RPC reply therefore arrives after the animation.";
    - `zoom_in`/`zoom_out`/`zoom_to`/`set_center`: "Returns `true`, or `false` if the animation was interrupted."
  - One sentence: "No viewport tool can hang any more: an interrupted animation settles its call."

- [ ] **Step 5: Regenerate the mcp snapshot.**
  1. Run `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/mcp run generate:schemas`.
  2. Run `cd packages/mcp && npx vitest run test/schema-snapshot.spec.ts` (green).
  3. Check `git diff --stat packages/mcp`: only `src/generated/tool-schemas.ts`.

- [ ] **Step 6: Verify.** Run `cd packages/angular && npx vitest run && npx tsc --noEmit`.

- [ ] **Step 7: Commit.**
  ```bash
  git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/tool-schemas.ts \
    packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/AGENT_BRIDGE.md packages/mcp/src/generated/tool-schemas.ts
  git commit -F- <<'EOF'
  feat(agent): viewport tools report interrupted animations

  fit_view/fit_bounds results gain `ended`; set_viewport now awaits its animation and
  returns a boolean (it used to return nothing immediately). AGENT_BRIDGE.md and the
  @angflow/mcp schema snapshot are updated.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 5 (sonnet): Cache the pane extent (#5850 + #6108 + #6054 system half)

Upstream: #5850 merge `69003667d`, #6108 merge `c1251bbbc`, #6054 merge `017a41c69`. #6108 and #6054 build on #5850. #5850 and #6108 apply cleanly in sequence. #6054's `update()` hunk targets the `destroy()` teardown angflow removed (Spec deviation 5): port only its comment and the `destroy()` line.

**Files:**
- Modify: `packages/system/src/xypanzoom/XYPanZoom.ts` (zoom construction :56-58, `destroy` :217-224)
- Test: `packages/system/src/xypanzoom/XYPanZoom.spec.ts`

- [ ] **Step 1: Failing tests.** Add `describe('XYPanZoom pane extent cache (#5850)')`. Stub `ResizeObserver` with `vi.stubGlobal`, capturing the callback and `disconnect`. Reuse `setup()` (bbox mocked 800×600). Restore with `vi.unstubAllGlobals()` in `afterEach`.
  - **No layout read per gesture:** `const clientWidth = vi.fn(() => 800); Object.defineProperty(domNode, 'clientWidth', { get: clientWidth });` (same for `clientHeight`) after `setup()`; then `await panZoom.scaleBy(2)`. Expect `clientWidth` not called. d3's `defaultExtent` reads it today.
  - **Uses the observed size:** call the captured RO callback with `[{ contentRect: { width: 400, height: 300 } }]`, then `await panZoom.scaleTo(2)`. `panZoom.getViewport()` is `{ x: -200, y: -150, zoom: 2 }` (scaled around the 400×300 centre). With the 800×600 bbox it would be `{ x: -400, y: -300 }`.
  - **#6108:** calling the RO callback with `[{}]` doesn't throw and doesn't change the extent.
  - **#6054:** `panZoom.destroy()` calls the observer's `disconnect`.

  Run `npx vitest run src/xypanzoom/XYPanZoom.spec.ts`. Expected: these fail.

- [ ] **Step 2: Apply.**
  ```bash
  git diff 69003667d^1 69003667d -- packages/system | git apply -3
  git diff c1251bbbc^1 c1251bbbc -- packages/system | git apply -3
  ```
  Then hand-port #6054:
  - replace the cache comment with: "…and pinching. The observer stays connected while zooming is paused during a user selection (angflow never tears listeners down there; see update()), so the cache stays fresh, and is disconnected in destroy(), which in angflow only runs on unmount."
  - add `extentResizeObserver?.disconnect();` to `destroy()`, keeping the existing `d3Selection.on('.zoom', null)`;
  - don't port the `update()` hunk.

- [ ] **Step 3: Verify.**
  - Run `npx vitest run` in `packages/system` and in `packages/angular`. Several angular specs stub `ResizeObserver` with no-op classes; the `contentRect` guard keeps them safe.
  - Build, then run `e2e/pane.spec.ts` on `--project=chromium` (the zoom and pan tests stay green).

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/xypanzoom/XYPanZoom.ts packages/system/src/xypanzoom/XYPanZoom.spec.ts
  git commit -F- <<'EOF'
  perf(system): cache the pane extent instead of a layout per wheel frame

  d3-zoom read clientWidth/clientHeight on every wheel/pinch frame. The extent is now
  cached from a ResizeObserver, entries without contentRect are ignored, and the
  observer is disconnected in destroy(). Angflow's update() keeps its listeners during
  a selection, so #6054's on('zoom', null) change is not ported.

  Ported from xyflow/xyflow#5850 (69003667d), xyflow/xyflow#6108 (c1251bbbc) and the
  system half of xyflow/xyflow#6054 (017a41c69).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 6 (sonnet): `Control` as pan activation key (#5922)

Upstream: merge `42f367e7e`. Builds on typed guards from 7976e13e7, which angflow lacks: hand-port, untyped.

**Files:**
- Modify: `packages/system/src/types/panzoom.ts` (`PanZoomUpdateOptions`: `panActivationKeyPressed?: boolean`)
- Modify: `packages/system/src/xypanzoom/XYPanZoom.ts` (`update` destructuring :91-110 with `panActivationKeyPressed = false`; `createFilter({...})` :190-202)
- Modify: `packages/system/src/xypanzoom/filter.ts` (`FilterParams`, destructuring, final return :105-109)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (`updatePanZoomOptions` :1219-1240; effect :880-900)
- Test: `packages/system/src/xypanzoom/XYPanZoom.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.**
  - System: `describe('createFilter pan activation key (#5922)')`. With `panOnDrag: true` and `{ type: 'mousedown', button: 0, ctrlKey: true, target, composedPath }` (target a plain `div`, not a node):
    - returns `false` without `panActivationKeyPressed`;
    - returns `true` with `panActivationKeyPressed: true`;
    - a ctrl+wheel event is unaffected (`zoomOnPinch` rules still apply).
  - E2E: delete the entry `Pane activation keys › Control and primary-button drag pans the pane`.
  - Run `npx vitest run src/xypanzoom/XYPanZoom.spec.ts` and the e2e `pane.spec.ts` on `--project=chromium`. Expected: both fail. The viewport doesn't move.

- [ ] **Step 2: Implement.**
  - System, as upstream: type field; `FilterParams.panActivationKeyPressed?: boolean`; final line `return (!event.ctrlKey || isWheelEvent || panActivationKeyPressed) && buttonAllowed;` with upstream's three-line comment; `update()` passes it to `createFilter`.
  - Angular: `updatePanZoomOptions()` adds `panActivationKeyPressed: this.store.panActivationKeyActive()`. The effect (:880-900) adds an explicit `this.store.panActivationKeyActive();` read next to `zoomActivationKeyActive()`: `effectivePanOnDrag()` already depends on it, but say it explicitly.

- [ ] **Step 3: Verify.**
  - Run `npx vitest run` in system and angular.
  - Build.
  - Run `e2e/pane.spec.ts` on `--project=chromium` (green).

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/types/panzoom.ts packages/system/src/xypanzoom/XYPanZoom.ts packages/system/src/xypanzoom/filter.ts \
    packages/system/src/xypanzoom/XYPanZoom.spec.ts packages/angular/src/lib/container/ng-flow/ng-flow.component.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix: Control as panActivationKeyCode starts a primary-button drag pan

  d3-zoom's default filter rejects ctrl-modified drags. The filter now allows them while
  the pan activation key is held, and NgFlowComponent passes the held state to
  XYPanZoom.update.

  Ported from xyflow/xyflow#5922 (42f367e7e).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 7 (sonnet): Middle-mouse pan from selections, respecting `panOnDrag` (#5902 + #6119)

Upstream: #5902 merge `360f5b13e` (identical result to 0.0.80 f72e31247, the prerequisite of #6119); #6119 merge `88b31e619` (commit fbe2ba5). Neither applies (filter drift): hand-port. Keep angflow's `!userSelectionActive` guard and its comment.

**Files:**
- Modify: `packages/system/src/xypanzoom/filter.ts` (middle-button branch :36-50)
- Test: `packages/system/src/xypanzoom/XYPanZoom.spec.ts` (`describe('createFilter middle-click pan')` :92-125)

- [ ] **Step 1: Failing tests.** Rework the existing block.
  - Parameterise `filterFor(userSelectionActive, panOnDrag)`.
  - Give the test element a `nopan` class (`'ng-flow__node nopan'`), so the middle-button branch is the only path that can return `true` (the nopan check rejects everything after it).
  - Cases:
    - node, `panOnDrag: [0, 1]` → `true`;
    - node, `panOnDrag: [0]` → `false` (#6119; **this flips the existing `:115` test**);
    - node, `[0, 1]`, `userSelectionActive: true` → `false` (the angflow guard);
    - `'ng-flow__nodesselection nopan'`, `panOnDrag: true` → `true` (#5902);
    - `'ng-flow__selection nopan'`, `true` → `true` (#5902);
    - `'ng-flow__nodesselection nopan'`, `false` → `false` (#6119).

  Run `npx vitest run src/xypanzoom/XYPanZoom.spec.ts`. Expected: the `[0]` case and the two #5902 cases fail.

- [ ] **Step 2: Implement.**
  ```ts
  const middleMousePanAllowed = panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(1));

  /*
   * Nodes, edges and selections are marked nopan, but a middle-button drag on them still
   * pans as long as panOnDrag allows button 1. `!userSelectionActive` is load-bearing
   * (angflow): … (keep the existing explanation)
   */
  if (
    middleMousePanAllowed &&
    event.button === 1 &&
    event.type === 'mousedown' &&
    !userSelectionActive &&
    (isWrappedWithClass(event, `${lib}-flow__node`) ||
      isWrappedWithClass(event, `${lib}-flow__edge`) ||
      // Unreachable for the user-selection rect under angflow's !userSelectionActive guard:
      // that rect only exists while a marquee runs. Kept for upstream parity. It still
      // matches the nodes-selection box, which carries both __selection and __nodesselection.
      isWrappedWithClass(event, `${lib}-flow__selection`) ||
      isWrappedWithClass(event, `${lib}-flow__nodesselection`))
  ) {
    return true;
  }
  ```
  The `'ng-flow__selection nopan'` unit case in Step 1 exercises the class match with `userSelectionActive: false`. That state can't occur for the real marquee rect; the case guards the parity branch only.

- [ ] **Step 3: Verify.** Run `npx vitest run` in system. Then build and run `e2e/nodes.spec.ts` on `--project=chromium`; upstream's #5902 test lives there and stays green.

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/xypanzoom/filter.ts packages/system/src/xypanzoom/XYPanZoom.spec.ts
  git commit -F- <<'EOF'
  fix(system): middle-mouse pan from selections, respecting panOnDrag

  A middle-button drag can now start from the user selection rect and the nodes
  selection, and only pans when panOnDrag allows button 1. Angflow's
  !userSelectionActive guard is kept.

  Ported from xyflow/xyflow#5902 (360f5b13e, same result as f72e31247) and
  xyflow/xyflow#6119 (88b31e619 / fbe2ba5).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

### WP1 checkpoint

- [ ] Build both packages.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm --filter playwright test:angular`. Expected: `known failures: 19 entries` (17 B + 2 D), `STALE (now passing): 0`, `chromium failures: 0`, `verdict: OK`.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm test`: system, angular and mcp vitest all green.
- [ ] Run `cd packages/angular && npx tsc --noEmit`, then `PATH="$SHIM:$PATH" corepack pnpm typecheck` and `PATH="$SHIM:$PATH" corepack pnpm lint`.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build` and `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build:zoneless`. Both succeed.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests`. Expected: in sync.
- [ ] Run the verbatim-paths `git diff --quiet HEAD -- …` from Global Constraints, comparing against `$BASE` instead of `HEAD`. Expected: exit 0.

---

## WP2 — Graph and node correctness

### Task 8 (opus): Child before parent (#5915) and order-safe absolute positions

Upstream: merge `ed900c8bf` (changeset 96b196f); applies cleanly. Caveat from the appendix: angflow still calls `updateAbsolutePositions` (`flow-store.service.ts:499, :780, :1012`). It walks `nodeLookup` in array order, so a child before its parent reads the parent's previous-pass `positionAbsolute` (Spec deviation 7).

**Files:**
- Modify: `packages/system/src/utils/store.ts` (`adoptUserNodes` :134-200, new `resolveSubflowsForNode`, `updateChildNode` warning, `updateAbsolutePositions` :61-77)
- Test: `packages/system/src/utils/store.spec.ts`, `packages/angular/src/lib/services/ng-flow.service.spec.ts` (`describe('groupNodes')` :963)

- [ ] **Step 1: Failing tests.**
  - System `store.spec.ts`, new `describe('subflow order (#5915)')`:
    - `adoptUserNodes([{ id: 'c', parentId: 'g', position: { x: 10, y: 20 }, data: {} }, { id: 'g', position: { x: 100, y: 200 }, data: {}, width: 300, height: 300 }], nodeLookup, parentLookup)` → `nodeLookup.get('c')!.internals.positionAbsolute` is `{ x: 110, y: 220 }` and `parentLookup.get('g')?.has('c')` is `true`;
    - three generations listed `[grandchild, child, group]` resolve the same way;
    - a child whose parent is missing warns once with `Parent node with id "g" is missing for child node with id "c"` (spy `console.warn`);
    - **order-safe recompute:** adopt `[c, g]`, then set `nodeLookup.get('g')!.position = { x: 500, y: 500 }` and call `updateAbsolutePositions(nodeLookup, parentLookup)` → `c` is at `{ x: 510, y: 520 }`. Today the child is computed first, from the parent's stale absolute.
  - Angular `describe('groupNodes')`: after `await service.groupNodes(['a', 'b'])` (members added before the group, the order the service produces), `store.parentLookup.get(groupId)` contains both members, and each member's `internals.positionAbsolute` equals its pre-group absolute.

  Run `cd packages/system && npx vitest run src/utils/store.spec.ts` and `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`. Expected: these fail. Today: "Parent node g not found…", the child at its relative position, the parent lookup missing.

- [ ] **Step 2: Apply.** `git diff ed900c8bf^1 ed900c8bf -- packages/system | git apply -3`. Then replace the hunk's `if (process.env.NODE_ENV === 'development') { … }` with an unconditional loop over the leftover `deferredChildNodes` that `console.warn`s the same message (Spec deviation 8). Confirm angflow's own edits survived: measured carry-over, `parseHandles`, `checkEquality`, `initial`.

- [ ] **Step 3: Order-safe `updateAbsolutePositions`.**
  ```ts
  /**
   * DELIBERATE DIVERGENCE FROM xyflow UPSTREAM (which no longer calls this): parents are
   * resolved before their children, whatever the lookup's insertion order, so a child
   * listed before its parent (#5915) never reads the parent's previous-pass position.
   */
  export function updateAbsolutePositions<NodeType extends NodeBase>(nodeLookup, parentLookup, options?) {
    const _options = mergeObjects(defaultOptions, options);
    const done = new Set<string>();
    const visit = (id: string) => {
      if (done.has(id)) return;
      done.add(id); // before recursing: a parentId cycle can't loop
      const node = nodeLookup.get(id);
      if (!node) return;
      if (node.parentId) {
        visit(node.parentId);
        updateChildNode(nodeLookup.get(id)!, nodeLookup, parentLookup, _options); // updateChildNode may replace the entry
      } else {
        // existing root branch, unchanged
      }
    };
    for (const id of [...nodeLookup.keys()]) visit(id);
  }
  ```

- [ ] **Step 4: Verify.**
  - Run `npx vitest run` in system and angular. `store.initial-dimensions.spec.ts` (system and angular) must stay green.
  - Build, then run `e2e/nodes.spec.ts` on `--project=chromium`.
  - Smoke-check the examples app's sub-flow/group pages (`/subflows`, `/group-collapse` or the equivalent routes in `app.routes.ts`): nodes sit where they did before.

- [ ] **Step 5: Commit.**
  ```bash
  git add packages/system/src/utils/store.ts packages/system/src/utils/store.spec.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
  git commit -F- <<'EOF'
  fix(system): resolve child nodes listed before their parent

  adoptUserNodes defers a child until its parent is processed, so a child before its
  parent gets its absolute position and parent-lookup entry (NgFlowService.groupNodes /
  the group_nodes tool produce exactly that order). updateAbsolutePositions now
  resolves parents first as well.

  Ported from xyflow/xyflow#5915 (ed900c8bf). The missing-parent warning is a plain
  console.warn (angflow's system never reads process.env).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 9 (opus): Don't mutate internal selection state (#6097, both halves)

Upstream: merge `c4fdcb115`. The system half applies cleanly. The angular half mirrors upstream's React changes (`packages/react/src/store/index.ts`, `utils/changes.ts`). **Both halves land in this one commit:** the angular half alone breaks dragging an unselected node while others are selected.

**Files:**
- Modify: `packages/system/src/xydrag/XYDrag.ts` (`startDrag` ~:263-278), `packages/system/src/xydrag/utils.ts` (`getDragItems` :35-…)
- Modify: `packages/angular/src/lib/utils/changes.ts` (`getSelectionChanges` :194-212: drop `mutateItem`. Not part of the public API: `public-api.ts:62` exports only `apply*Changes`)
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`addSelectedNodes` :839, `addSelectedEdges` :855, `unselectNodesAndEdges` :864-870)
- Test: create `packages/system/src/xydrag/utils.spec.ts`; extend `packages/angular/src/lib/services/flow-store.service.spec.ts`

- [ ] **Step 1: Failing tests.**
  - System `xydrag/utils.spec.ts`: build a lookup with `adoptUserNodes` (`a`, `b` selected; `c` not). `getDragItems(lookup, true, { x: 0, y: 0 }, 'c', true)` yields only `c`. Without the flag it yields `a`, `b`, `c`. Parented `child` of selected `p` with `onlyDragNode` and `nodeId: 'child'` yields `child`.
  - Angular `flow-store.service.spec.ts`, `describe('selection does not mutate internal state (#6097)')`. Reject select changes with `store.nodesChangeMiddleware.set('reject', (c) => c.filter((x) => x.type !== 'select'))`, then:
    - `addSelectedNodes(['b'])` leaves `nodeLookup.get('b')!.selected` falsy;
    - with `a` selected, `addSelectedEdges(['e1'])` leaves `nodeLookup.get('a')!.selected === true`;
    - `unselectNodesAndEdges()` with `a` selected leaves `nodeLookup.get('a')!.selected === true`.

  Run both. Expected: `getDragItems` ignores the 5th argument; the angular lookups are mutated.

- [ ] **Step 2: Apply the system half.** `git diff c4fdcb115^1 c4fdcb115 -- packages/system | git apply -3`.

- [ ] **Step 3: Angular half.** As upstream:
  - remove `mutateItem` and its branch from `getSelectionChanges`;
  - drop the `true` arguments at `:839` and `:855`;
  - delete the `internalNode.selected = false` block in `unselectNodesAndEdges` (`:865-868`).

  Search for other callers: `grep -rn "getSelectionChanges(" packages/angular/src`.

- [ ] **Step 4: Verify the matrix.**
  - Run `npx vitest run` in system and angular, including `selection-box.drag.spec.ts`, `pane.auto-pan.spec.ts` (box selection → `addSelectedNodes`) and `selection-box.keyboard.spec.ts`.
  - Build, then run `e2e/nodes.spec.ts` and `e2e/pane.spec.ts` on `--project=chromium`. They cover drag, multi-select drag and box selection.
  - By hand in the examples app:
    - controlled vs uncontrolled flow (`/overview` and a `defaultNodes` page);
    - drag an unselected node while two others are selected: only it moves;
    - `selectNodesOnDrag=false` (kitchen-sink toggle);
    - box selection then drag.

- [ ] **Step 5: Commit.**
  ```bash
  git add packages/system/src/xydrag/XYDrag.ts packages/system/src/xydrag/utils.ts packages/system/src/xydrag/utils.spec.ts \
    packages/angular/src/lib/utils/changes.ts packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts
  git commit -F- <<'EOF'
  fix: stop mutating internal node selection state

  getSelectionChanges and unselectNodesAndEdges no longer write `selected` onto lookup
  nodes before the change reaches the user, which could desync controlled flows.
  XYDrag drags only the grabbed node when it isn't part of the selection, which is what
  the mutation used to achieve. Both halves land together.

  Ported from xyflow/xyflow#6097 (c4fdcb115).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 10 (sonnet): `getNodesBounds` with `nodeLookup` (+ #5871)

Upstream: #5871 merge `f149d8c05`; applies cleanly. It makes the bug latent today (an unresolvable id stretches the bounds to the origin) live once `nodeLookup` is passed, so both land together.

**Files:**
- Modify: `packages/system/src/utils/graph.ts` (`getNodesBounds` :208-…)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`getNodesBounds` :859-861)
- Test: `packages/system/src/utils/graph.spec.ts`, `packages/angular/src/lib/services/ng-flow.service.spec.ts`

- [ ] **Step 1: Failing tests.**
  - System: `getNodesBounds(['missing', 'a'], { nodeLookup })` with `a` at (100, 100), 50×50 → `{ x: 100, y: 100, width: 50, height: 50 }`. Today it stretches to (0, 0). `getNodesBounds(['missing'], { nodeLookup })` → all zeros.
  - Angular: parent `p` at (100, 100), child `c` (`parentId: 'p'`, position (10, 10), `width: 50, height: 50`). `service.getNodesBounds([service.getNode('c')!])` → `x: 110, y: 110`. Today `x: 10`.

  Run both. Expected: fail.

- [ ] **Step 2: Implement.**
  1. `git diff f149d8c05^1 f149d8c05 -- packages/system | git apply -3`.
  2. In `ng-flow.service.ts`: `return getNodesBoundsSystem(nodes, { nodeLookup: this.store.nodeLookup, nodeOrigin: this.store.nodeOrigin() });`.

  The `get_nodes_bounds` agent tool (`agent-bridge.service.ts:781-785`) inherits the fix. Its documented return shape doesn't change, so `AGENT_BRIDGE.md` needs no edit.

- [ ] **Step 3: Verify.** Run `npx vitest run` in system and angular (including `agent-bridge.spec.ts` `get_nodes_bounds`). Record for Task 31's changelog: "`getNodesBounds` now skips nodes that aren't in the store (upstream behaviour)". Before, an unknown id stretched the bounds to the origin; with `nodeLookup` passed, a node object not yet in the store is ignored too.

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/utils/graph.ts packages/system/src/utils/graph.spec.ts \
    packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
  git commit -F- <<'EOF'
  fix: getNodesBounds uses absolute positions for sub-flow children

  NgFlowService.getNodesBounds (and the get_nodes_bounds agent tool) now passes the
  nodeLookup, so children are bounded by their absolute positions, and unresolvable
  ids no longer stretch the bounds to the origin.

  Changelog: getNodesBounds now skips nodes that aren't in the store (upstream
  behaviour); a node passed but not yet added contributes nothing.

  Ported from xyflow/xyflow#5871 (f149d8c05).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 11 (haiku): `extent: 'parent'` with an unmeasured sized parent (#5889)

Upstream: merge `185ec2cb1`; applies cleanly (`calculateNodePosition`, `graph.ts:~430`, uses `getNodeDimensions(parentNode)`).

**Files:**
- Modify: `packages/system/src/utils/graph.ts`
- Test: `packages/system/src/utils/graph.spec.ts`

- [ ] **Step 1: Failing test.**
  - Lookup with parent `p`: `width: 100, height: 100`, **no** `measured`.
  - Child `c`: `parentId: 'p'`, `extent: 'parent'`, `measured`/`width` 20×20.
  - `calculateNodePosition({ nodeId: 'c', nextPosition: { x: 500, y: 500 }, nodeLookup, nodeOrigin: [0, 0] })` → `position` clamped to `{ x: 80, y: 80 }`.

  Today the extent isn't applied. Run `npx vitest run src/utils/graph.spec.ts`. Expected: fail.

- [ ] **Step 2: Apply.** `git diff 185ec2cb1^1 185ec2cb1 -- packages/system | git apply -3`.

- [ ] **Step 3: Verify.** Run `npx vitest run` in system.

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/utils/graph.ts packages/system/src/utils/graph.spec.ts
  git commit -F- <<'EOF'
  fix(system): extent 'parent' applies before the parent is measured

  Ported from xyflow/xyflow#5889 (185ec2cb1).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 12 (sonnet): Resizer — rejected frames, always end, origin + extent (#5998, #6084)

Upstream: #5998 merge `159995fe7`, then #6084 merge `57589724a` (commits 82dfa9da4 + 254fd5f7d). #6084 builds on #5998 and on the 0.0.77 own-extent clamp (present, 5978703ed). Neither applies, because of angflow's `parentExtent` naming from the #5784 port. Hand-port both, keeping `parentExtent`/`nodeToParentExtent`.

**Files:**
- Modify: `packages/system/src/xyresizer/XYResizer.ts` (`nodeToChildExtent` :90-102, start :149-223, drag :224-337, end :338-347)
- Test: create `packages/system/src/xyresizer/XYResizer.spec.ts`

- [ ] **Step 1: Failing tests.** Drive d3-drag with real mouse events. It binds `mousedown.drag` on the control, then `mousemove`/`mouseup` on `event.view`.
  ```ts
  const mouse = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window }));

  function setup(nodes: NodeBase[], nodeId: string, controlPosition: ControlPosition, callbacks: Partial<XYResizerUpdateParams> = {}) {
    const nodeLookup = new Map(); const parentLookup = new Map();
    adoptUserNodes(nodes, nodeLookup, parentLookup);
    const pane = document.createElement('div'); const control = document.createElement('div');
    pane.appendChild(control); document.body.appendChild(pane);
    const onChange = vi.fn(); const onEnd = vi.fn();
    const resizer = XYResizer({
      domNode: control, nodeId, onChange, onEnd,
      getStoreItems: () => ({ nodeLookup, transform: [0, 0, 1], snapGrid: [15, 15], snapToGrid: false, nodeOrigin: [0, 0], paneDomNode: pane }),
    });
    resizer.update({ controlPosition, boundaries: { minWidth: 10, minHeight: 10, maxWidth: 1000, maxHeight: 1000 }, keepAspectRatio: false,
      onResizeStart: vi.fn(), onResize: vi.fn(), onResizeEnd: vi.fn(), shouldResize: undefined, ...callbacks } as XYResizerUpdateParams);
    return { control, onChange, onEnd, nodeLookup };
  }
  ```
  Match `getStoreItems` to `XYResizerParams` at the top of the file. If jsdom can't drive d3-drag (no `start` fires), fall back to invoking the registered handlers: `select(control).on('mousedown.drag')` and the window listeners.

  Cases:
  - **#5998 always end:** bottom-right, `mousedown(100, 100)` then `mouseup(100, 100)` with no move. `onResizeStart` and `onResizeEnd` are each called once. Today end is skipped.
  - **#5998 rollback:** a 100×100 node at (0, 0), bottom-right. `shouldResize = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)`. Then `mousedown(100, 100)`, `mousemove(150, 150)` (rejected), `mousemove(150, 150)` (accepted), `mouseup`. `onResize` is called once with `width: 150`, and `onChange` once. Today the rejected frame already wrote `prevValues`, so the accepted frame looks like "no change" and is dropped.
  - **End guard:** `nodeId` not in the lookup: mousedown/mouseup don't throw and don't call `onEnd`.
  - **#6084:** node `extent: [[0, 0], [200, 200]]`, `position: { x: 300, y: 0 }`, 100×100, so it's drawn at the clamped `positionAbsolute` x=100. A bottom-right resize by +10 → `onResize`'s params have `x: 100`. Today `x: 300`.
  - **#6084:** a child with `extent: 'parent'` inside a parent with `origin: [0.5, 0.5]`: the child extent is computed from absolute positions. Use upstream's FixedExtentNode scenario, `examples/react/src/examples/NodeResizer/` (the reference copy), for exact values.

  Run `npx vitest run src/xyresizer/XYResizer.spec.ts`. Expected: fail.

- [ ] **Step 2: Hand-port #5998.**
  - Remove `resizeDetected`.
  - Snapshot `lastValid` (`prevValues` copy, `startValues.x/y`, child positions) right after the no-change early return.
  - On `callResize === false`, restore it and return.
  - `end` always fires `onResizeEnd`/`onEnd`, with the angflow guard `if (!node) return;` first (upstream emits the 0×0 `initPrevValues` there).

- [ ] **Step 3: Hand-port #6084.**
  - Show both diffs side by side: `git diff 57589724a^1 57589724a -- packages/system`.
  - `nodeToChildExtent(child, parent, parentPosition)` uses `internals.positionAbsolute`.
  - The start handler derives `prevValues.x/y` from `positionAbsolute - parentPosition + origin * size`.
  - Children use `nodeToChildExtent(child, node, prevValues)`.
  - Import `XYPosition`.

- [ ] **Step 4: Verify.**
  - Run `npx vitest run` in system and angular (`node-resizer.component.spec.ts`, `node-resizer.gesture.spec.ts`).
  - By hand: the examples app's node-resizer page (`/node-resizer`), including a child with `extent: 'parent'`.

- [ ] **Step 5: Commit.**
  ```bash
  git add packages/system/src/xyresizer/XYResizer.ts packages/system/src/xyresizer/XYResizer.spec.ts
  git commit -F- <<'EOF'
  fix(system): resizer rollback, always-paired end, origin with extent

  A frame rejected by shouldResize no longer leaves its values behind, onResizeEnd
  always follows onResizeStart (guarded for a node that vanished), and resizing a node
  with a fixed extent and a non-default origin starts from the position it is drawn at.

  Ported from xyflow/xyflow#5998 (159995fe7) and xyflow/xyflow#6084 (57589724a).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 13 (haiku): `getNodesInside` without per-node allocations (#5806)

Upstream: merge `de45101ad`; applies cleanly after Tasks 10–11. Semantics are unchanged; the existing tests are the bar (spec).

**Files:**
- Modify: `packages/system/src/utils/general.ts` (adds `getRectsOverlappingArea`), `packages/system/src/utils/graph.ts` (`getNodesInside` :270-…)

- [ ] **Step 1: Baseline.** Run `npx vitest run` in system and angular, and note the counts. Covering today: `pane.auto-pan.spec.ts`, the culling tests in `node-renderer.component.spec.ts`. If no system test calls `getNodesInside`, add one now: a full vs partial selection over two nodes, one inside, one overlapping. It passes before and after; it's a regression guard.
- [ ] **Step 2: Apply.** `git diff de45101ad^1 de45101ad -- packages/system | git apply -3`. Check that `nodeToRect`/`pointToRendererPoint` are still imported in `graph.ts` only if something else uses them (lint flags unused imports).
- [ ] **Step 3: Verify.** Same counts, all green. Run `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/system lint`.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/utils/general.ts packages/system/src/utils/graph.ts packages/system/src/utils/graph.spec.ts
  git commit -F- <<'EOF'
  perf(system): getNodesInside without a Rect allocation per node

  Ported from xyflow/xyflow#5806 (de45101ad).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```
  Leave `graph.spec.ts` out of `git add` if Step 1 added nothing to it.

### WP2 checkpoint

- [ ] Same commands as the WP1 checkpoint. Expected verdict: `known failures: 19 entries`, `STALE: 0`, `verdict: OK`. WP2 is vitest-covered, so the count doesn't change.
- [ ] Smoke-check the examples app: `/overview`, sub-flows/groups, node-resizer, drag/multi-select.

---

## WP3 — Edges

### Task 14a (opus): Built-in edge labels as SVG inside the edge `<g>`

Upstream reference:
- `packages/react/src/components/Edges/EdgeText.tsx` (SVG `<g transform><rect/><text/></g>`, measured with `getBBox`, hidden until measured);
- `packages/system/src/styles/init.css` (`.xy-flow__edge-textwrapper { pointer-events: all }`).

See Spec deviations 11–12 and Open question 3. Task 14b adds the custom-edge path (`BaseEdgeComponent` label inputs).

**Between 14a and 14b, custom edges show no renderer-drawn label.** 14a removes the overlay for every edge type. Land 14b next, before any checkpoint run is reported.

**Files:**
- Rewrite: `packages/angular/src/lib/components/edges/edge-text.component.ts` (public `EdgeTextComponent`, `public-api.ts:21`)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`:
  - inside `<g data-id>` in the built-in `@else` branch, :222-233;
  - delete the label overlay :294-308;
  - update the memo comment :580-587;
  - `imports`.
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`withLiveEdgeLabels` :602-619)
- Modify: `packages/angular/src/lib/styles/ng-flow.css` / `style.css`, only if the `ng-flow__edge-textbg`/`-text` rules need the `xy-` twins
- Test: create `packages/angular/src/lib/container/edge-renderer/edge-renderer.labels.spec.ts`; update `packages/angular/src/lib/services/ng-flow.service.spec.ts` (:480-540)
- Modify: `tests/playwright/known-failures.ng.ts`

**Interfaces:**
```ts
@Component({
  selector: 'g[ngFlowEdgeText]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__edge-textwrapper xy-flow__edge-textwrapper',
    '[attr.transform]': 'transform()',
    '[attr.visibility]': 'bbox().width ? "visible" : "hidden"',
  },
  template: `
    @if (showBg()) {
      <svg:rect class="ng-flow__edge-textbg xy-flow__edge-textbg"
        [attr.x]="-padding()[0]" [attr.y]="-padding()[1]"
        [attr.width]="bbox().width + 2 * padding()[0]" [attr.height]="bbox().height + 2 * padding()[1]"
        [attr.rx]="radius()" [attr.ry]="radius()" [attr.style]="bgStyle()" />
    }
    <svg:text #text class="ng-flow__edge-text xy-flow__edge-text" [attr.y]="bbox().height / 2" dy="0.3em"
      [attr.style]="textStyle()">{{ label() }}</svg:text>
  `,
})
export class EdgeTextComponent {
  readonly x = input(0);
  readonly y = input(0);
  readonly label = input<string>();
  readonly labelStyle = input<CSSProperties>();
  readonly labelShowBg = input<boolean | undefined>();          // default true
  readonly labelBgStyle = input<CSSProperties>();
  readonly labelBgPadding = input<[number, number] | undefined>(); // default [2, 4]
  readonly labelBgBorderRadius = input<number | undefined>();    // default 2
  readonly bbox = signal({ x: 1, y: 0, width: 0, height: 0 });
}
```
- Bound `undefined` overrides an input default, so defaults resolve in `computed`s: `showBg`, `padding`, `radius`.
- Styles are CSS strings built like `getEdgePathStyle`.
- Root SVG elements in a component template need the `svg:` prefix.

- [ ] **Step 1: Failing tests.**
  - New `edge-renderer.labels.spec.ts`. Use the TestBed pattern from `edge-renderer.selection.spec.ts`. Render an edge with `label: 'hello'`, `labelBgPadding: [6, 3]`, `labelShowBg: false` variants, and assert:
    - exactly **one** element with `[data-id="e1"]` (today 2);
    - `g[data-id="e1"] text.xy-flow__edge-text` has text `hello`;
    - no `.xy-flow__edge-label` element remains;
    - `labelShowBg: false` renders no `rect.xy-flow__edge-textbg`;
    - `labelStyle: { fill: 'red' }` lands in the text's `style`;
    - clicking the text element selects the edge (`store.addSelectedEdges` spy, or the edge becomes `selected`).
  - Update `ng-flow.service.spec.ts:485`'s `querySelector` mock to the new selector, and keep its expectations (`labelWidth` 140). Specify the new behaviour first so it fails: the SVG wrapper is measured with `getBBox()`, so stub `getBBox` on the mocked element.
  - E2E: delete the five `Edges › properties` entries (`animated=true add "animated" class`, `selectable=false prevents selecting of edges`, `deletable=false prevents deleting of edges`, `aria-lable is working`, `interactionWidth is working`) and the now-unused `EDGE_LABEL` constant.

  Run `npx vitest run src/lib/container/edge-renderer/edge-renderer.labels.spec.ts src/lib/services/ng-flow.service.spec.ts`. Then build and run `e2e/edges.spec.ts` on `--project=chromium`. Expected: fail (strict-mode violations; the label isn't inside the `<g>`).

- [ ] **Step 2: `EdgeTextComponent`.** Implement the interface above. Measure in `afterRenderEffect` (Angular ≥19): read `this.label()` so a new label re-measures. `const b = this.textRef()?.nativeElement.getBBox?.();` (jsdom has no `getBBox`; keep the zero bbox). Write `bbox` only when width or height actually changed (compare inside `untracked`), so the effect doesn't loop. This is a signal write, so it is zoneless-safe. `transform = computed(() => \`translate(${x() - bbox().width / 2} ${y() - bbox().height / 2})\`)`.

- [ ] **Step 3: Renderer.** Inside `<g [attr.data-id]>`, after the built-in paths:
  ```html
  @if (edge.label) {
    <g ngFlowEdgeText
       [x]="getEdgeCenterX(ei)" [y]="getEdgeCenterY(ei)" [label]="edge.label"
       [labelStyle]="edge.labelStyle" [labelShowBg]="edge.labelShowBg" [labelBgStyle]="edge.labelBgStyle"
       [labelBgPadding]="edge.labelBgPadding" [labelBgBorderRadius]="edge.labelBgBorderRadius" />
  }
  ```
  - Add `EdgeTextComponent` to `imports`.
  - Delete the `.xy-flow__edgelabel-renderer` overlay div (:294-308). User `<ng-flow-edge-label-renderer>` is a separate component and is untouched.
  - Fix the memo comment: there are two `getEdgeInputs` call sites now.

- [ ] **Step 4: Layout label measurement.** `withLiveEdgeLabels`:
  ```ts
  const el = container.querySelector(`.xy-flow__edge [data-id="${escaped}"] .xy-flow__edge-textwrapper`) as SVGGraphicsElement | null;
  const box = el?.getBBox?.();
  ```
  `getBBox` is in the label's own user units (flow units, unaffected by the viewport scale), so it's comparable to the old `offsetWidth`. Update the doc comment.

- [ ] **Step 5: Verify.**
  - Run `npx vitest run` in angular (all edge-renderer specs, `ng-flow.service.spec.ts`).
  - Run `npx tsc --noEmit`.
  - Build, then run `e2e/edges.spec.ts` on `--project=chromium`. All pass except the still-excluded `elevate edges on select` (Task 15).
  - By hand in the examples app:
    - `/edge-routing` and `/reconnect-edge`: built-in labels sit on the path with a background, and clicking a label selects its edge;
    - dark mode (`/color-mode`): the label background follows `--xy-edge-label-background-color`.

- [ ] **Step 6: Commit.**
  ```bash
  git add packages/angular/src/lib/components/edges/edge-text.component.ts packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.labels.spec.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/src/lib/services/ng-flow.service.spec.ts tests/playwright/known-failures.ng.ts
  # add the stylesheet(s) only if changed
  git commit -F- <<'EOF'
  fix(angular): render built-in edge labels as SVG inside the edge

  Built-in edges now draw edge.label like upstream: an SVG EdgeText inside the edge's
  <g data-id>, honouring labelStyle, labelShowBg, labelBgStyle, labelBgPadding and
  labelBgBorderRadius. The HTML overlay label (which duplicated data-id and swallowed
  clicks without selecting the edge) is gone. EdgeTextComponent is now the SVG
  component <g ngFlowEdgeText>, and layout label measurement reads the SVG label.

  BREAKING (visual): styles targeting the HTML .xy-flow__edge-label div no longer apply.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 14b (sonnet): Custom edges render labels through `BaseEdgeComponent`

Upstream reference: `packages/react/src/components/Edges/BaseEdge.tsx:59-68` (renders `EdgeText` when `label` and numeric `labelX`/`labelY` are set). The built-in edge components (`BezierEdge` etc.) pass their label props to it. Open question 3 default.

**Files:**
- Modify: `packages/angular/src/lib/components/edges/base-edge.component.ts` (label inputs + `<g ngFlowEdgeText>` inside its inline `<svg>`)
- Modify: the five built-in edge components in `packages/angular/src/lib/components/edges/` (`bezier-edge`, `straight-edge`, `step-edge`, `smooth-step-edge`, `simple-bezier-edge`): forward `label*`, `labelX`, `labelY` to `ng-flow-base-edge`
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (`getEdgeComponentInputs`/`buildEdgeInputs` input bag)
- Test: create `packages/angular/src/lib/components/edges/base-edge.component.spec.ts`; extend `edge-renderer.labels.spec.ts`

- [ ] **Step 1: Failing tests.**
  - `base-edge.component.spec.ts`:
    - `label: 'hi'`, `labelX: 10`, `labelY: 20` renders `g.xy-flow__edge-textwrapper text` with `hi` inside the component's `<svg>`;
    - without `labelX` (non-numeric), nothing renders;
    - `labelShowBg: false` renders no bg rect.
  - `edge-renderer.labels.spec.ts`: a custom edge type mapped to `BezierEdgeComponent` with `label: 'custom'` renders exactly one label, inside the custom-edge overlay.

  Run `npx vitest run src/lib/components/edges src/lib/container/edge-renderer/edge-renderer.labels.spec.ts`. Expected: fail (unknown inputs; no label).

- [ ] **Step 2: Implement.**
  - `BaseEdgeComponent` gains `label`, `labelX`, `labelY`, `labelStyle`, `labelShowBg`, `labelBgStyle`, `labelBgPadding`, `labelBgBorderRadius` inputs. When `label` is set and `labelX`/`labelY` are numbers, it renders `<g ngFlowEdgeText …>` inside its inline `<svg>`, as upstream `BaseEdge` does. Import `EdgeTextComponent`.
  - The five built-in edge components forward these. They compute `labelX`/`labelY` from their path generator (`getBezierPath(...)[1..2]` etc.), as upstream does.
  - `getEdgeComponentInputs` already carries `label`, `labelX`, `labelY` (`buildEdgeInputs` :558, memo :630). Confirm it filters inputs by `reflectComponentType` before passing keys; add `labelStyle`, `labelShowBg`, `labelBgStyle`, `labelBgPadding`, `labelBgBorderRadius` to the bag.

- [ ] **Step 3: Verify.**
  - Run `npx vitest run` in angular and `npx tsc --noEmit`.
  - Build, then run `e2e/edges.spec.ts` on `--project=chromium`.
  - By hand in the examples app: `/custom-edge`, `/default-overwrites`, `/edge-toolbar` and `/typed-handles` keep their labels, with no duplicates.

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/components/edges packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.labels.spec.ts
  git commit -F- <<'EOF'
  feat(angular): BaseEdgeComponent renders edge labels like upstream BaseEdge

  Custom edges no longer get a renderer-drawn label; they render one through
  <ng-flow-base-edge [label] [labelX] [labelY] …>, and the built-in edge components
  forward their label inputs. Labels drawn this way live in the custom-edge overlay,
  so withLiveEdgeLabels (layout label measurement) does not measure them.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 15 (sonnet): `elevateEdgesOnSelect` works and defaults to `true`

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (:520, `input(false)` → `input(true)`; doc comment)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (`getEdgeZIndex` :392-397)
- Modify: `packages/angular/src/lib/components/edge-toolbar/edge-toolbar.component.ts` (`zIndex` :69-71)
- Test: `packages/angular/src/lib/components/edge-toolbar/edge-toolbar.component.spec.ts` (:33-41); extend `packages/angular/src/lib/container/edge-renderer/edge-renderer.selection.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.**
  - Renderer:
    - a selected edge between two root nodes renders `z-index: 1000` by default, and `0` with `store.elevateEdgesOnSelect.set(false)`;
    - an edge with `zIndex: 7` renders 7 unselected and 1007 selected.
  - Toolbar: replace the two `+ 1` tests:
    - `zIndex` equals `getElevatedEdgeZIndex(...)` for the edge: 7 for `zIndex: 7` unselected; 1007 selected (with nodes `a`/`b` in the store);
    - 0 with no `zIndex`.
  - E2E: delete the entry `elevate edges on select for overlapping reconnect anchors › selected edge gets elevated z-index above non-selected overlapping edge`.

  Run the two specs, then build and run `e2e/edges.spec.ts` on `--project=chromium`. Expected: fail.

- [ ] **Step 2: Implement.**
  ```ts
  getEdgeZIndex(edge: Edge): number {
    const sourceNode = this.store.nodeLookup.get(edge.source);
    const targetNode = this.store.nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) return edge.zIndex ?? 0;
    return getElevatedEdgeZIndex({
      selected: edge.selected, zIndex: edge.zIndex, sourceNode, targetNode,
      elevateOnSelect: this.store.elevateEdgesOnSelect(), zIndexMode: this.store.zIndexMode(),
    });
  }
  ```
  The toolbar does the same via `this.store.nodeLookup` (keep `store.version()` in the computed, so lookup changes re-run it). Flip the input default to `true` to match the store default (`flow-store.service.ts:231`) and upstream.

- [ ] **Step 3: Verify.**
  - Run `npx vitest run` in angular.
  - Build, then run `e2e/edges.spec.ts` on `--project=chromium`. All green, including `zIndex sets z-index of edge svgs` (3141592) and both sub-flow z-index tests (1).

- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.selection.spec.ts packages/angular/src/lib/components/edge-toolbar/edge-toolbar.component.ts \
    packages/angular/src/lib/components/edge-toolbar/edge-toolbar.component.spec.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): elevateEdgesOnSelect elevates selected edges, default true

  The input was a no-op: its false default overwrote the store's true, the edge
  renderer never read it, and EdgeToolbar used zIndex + 1. Both now use
  getElevatedEdgeZIndex.

  Behaviour change: selected edges are elevated by default (upstream default).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 16 (haiku): Smooth-step bends never sharper than `borderRadius` (#6036)

Upstream: merge `8523d8dd9` (commit cba335d); applies cleanly. No upstream test (Spec deviation 10).

**Files:**
- Modify: `packages/system/src/utils/edges/smoothstep-edge.ts`
- Test: create `packages/system/src/utils/edges/smoothstep-edge.spec.ts`

- [ ] **Step 1: Failing test.** This case was verified to differ between the two versions:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { getSmoothStepPath } from './smoothstep-edge';
  import { Position } from '../../types';

  describe('getSmoothStepPath (#6036)', () => {
    it('keeps the full borderRadius when a gap point lies on a straight segment', () => {
      const [path] = getSmoothStepPath({
        sourceX: 0, sourceY: 0, sourcePosition: Position.Top,
        targetX: -60, targetY: -50, targetPosition: Position.Bottom,
      });
      expect(path).toBe('M0 0L 0,-20Q 0,-25 -5,-25L -55,-25Q -60,-25 -60,-30L-60 -50');
      // before: 'M0 0L0 -20L 0,-22.5Q 0,-25 -2.5,-25L -57.5,-25Q -60,-25 -60,-27.5L-60 -30L-60 -50'
    });
  });
  ```
  Run `npx vitest run src/utils/edges/smoothstep-edge.spec.ts`. Expected: fail (2.5px bends).
- [ ] **Step 2: Apply.** `git diff 8523d8dd9^1 8523d8dd9 -- packages/system | git apply -3`.
- [ ] **Step 3: Verify.** Run `npx vitest run` in system and angular (path snapshots, if any, are updated only if they encoded the old collapsed bend).
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/utils/edges/smoothstep-edge.ts packages/system/src/utils/edges/smoothstep-edge.spec.ts
  git commit -F- <<'EOF'
  fix(system): smooth-step bends keep borderRadius when nodes are close

  Points on a straight segment are dropped so they no longer shrink the next bend.

  Ported from xyflow/xyflow#6036 (8523d8dd9 / cba335d).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 17 (sonnet): `reconnectEdge` id replacement; `onError` on `reconnectEdge`/`addEdge` (#6055)

Upstream: merge `654ba5a5e` (commit 9dcbd29); applies cleanly. `onError` comes from upstream #5793 (`5d64c5f0d`), hand-added with a `devWarn` fallback (Spec deviation 9), to `ReconnectEdgeOptions` **and** `AddEdgeOptions`. The `addEdge` half is the same trivial change and is ported here for parity. The e2e spec imports `packages/system/src/utils/edges/general` directly, so it needs no build.

**Files:**
- Modify: `packages/system/src/utils/edges/general.ts` (`AddEdgeOptions` :114-119, `addEdge` :134-…, `ReconnectEdgeOptions` :172-…, `reconnectEdge` :200-232)
- Test: create `packages/system/src/utils/edges/general.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.**
  - Vitest:
    - `reconnectEdge(old, { source: '', target: 'c', … }, [old], { onError })` calls `onError('006', …)` and returns the edges unchanged;
    - a missing old edge calls `onError('007', …)`;
    - without `onError` the sink still fires: `setDevWarnSink(spy)`, then `setDevWarnSink(null)` in `afterEach`;
    - `addEdge({ source: '', target: 'b' }, [], { onError })` calls `onError('006', …)`.
  - E2E: delete both `reconnectEdge › …` entries (`replaces the id with getEdgeId when shouldReplaceId is omitted`, `replaces the id when only onError is passed`).
  - Run the vitest file, and `e2e/reconnect-edge.spec.ts` on `--project=chromium`. Expected: fail.
- [ ] **Step 2: Implement.**
  1. `git diff 654ba5a5e^1 654ba5a5e -- packages/system | git apply -3` (`const shouldReplaceId = options.shouldReplaceId ?? true`).
  2. Add `onError?: OnError` to `ReconnectEdgeOptions` with upstream's doc ("Called when edge validation fails. If not provided, a default dev warning is used.").
  3. In `reconnectEdge`: `const onError = options.onError ?? devWarn;` and use it for `006`/`007`.
  4. Do the same for `AddEdgeOptions.onError` / `addEdge`'s `006`.
- [ ] **Step 3: Verify.** Run `npx vitest run` in system. Then run `e2e/reconnect-edge.spec.ts` on `--project=chromium`: all 4 pass.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/utils/edges/general.ts packages/system/src/utils/edges/general.spec.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(system): reconnectEdge replaces the id unless told not to

  An options object without shouldReplaceId (e.g. only getEdgeId or onError) kept the
  old id. Validation errors from reconnectEdge and addEdge now go to options.onError,
  falling back to the dev-warn sink.

  Ported from xyflow/xyflow#6055 (654ba5a5e / 9dcbd29); onError on ReconnectEdgeOptions
  and AddEdgeOptions as in xyflow/xyflow#5793 (5d64c5f0d).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 18 (haiku): `NodeProps` narrows `data` by `type` (#6131)

Upstream: merge `c22d52810` (changeset 8849014). It doesn't apply (doc-comment context differs): hand-port the type. Angflow's angular `NodeProps` is an alias of system `NodeProps` (`packages/angular/src/lib/types/nodes.ts:47`), so the change applies to angular as-is.

**Files:**
- Modify: `packages/system/src/types/nodes.ts` (`NodeProps` :112-125)
- Test: create `packages/angular/src/lib/types/node-props.spec.ts` (type-checked by `npx tsc --noEmit` in `packages/angular`)

- [ ] **Step 1: Failing type test.**
  ```ts
  import { describe, it, expect } from 'vitest';
  import type { Node, NodeProps } from '../public-api';

  type A = Node<{ a: string }, 'a'>;
  type B = Node<{ b: number }, 'b'>;

  function read(props: NodeProps<A | B>): string | number {
    return props.type === 'a' ? props.data.a : props.data.b; // only compiles if NodeProps distributes over the union
  }

  describe('NodeProps (#6131)', () => {
    it('narrows data by type', () => {
      expect(read({ type: 'a', data: { a: 'x' } } as NodeProps<A | B>)).toBe('x');
    });
  });
  ```
  Run `cd packages/angular && npx tsc --noEmit`. Expected: `Property 'a' does not exist on type '{ a: string } | { b: number }'`.
- [ ] **Step 2: Implement.** Wrap the existing type as upstream: `export type NodeProps<NodeType extends NodeBase> = NodeType extends unknown ? (existing intersection) : never;`.
- [ ] **Step 3: Verify.** Run `npx tsc --noEmit` (passes), then `npx vitest run src/lib/types/node-props.spec.ts`, then `PATH="$SHIM:$PATH" corepack pnpm typecheck`.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/types/nodes.ts packages/angular/src/lib/types/node-props.spec.ts
  git commit -F- <<'EOF'
  fix(types): NodeProps distributes over node-type unions

  Ported from xyflow/xyflow#6131 (c22d52810).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

### WP3 checkpoint

- [ ] Same commands as the WP1 checkpoint. Expected: `known failures: 11 entries` (9 B + 2 D), `STALE: 0`, `verdict: OK`.
- [ ] Repeat the by-hand edge checks from Tasks 14a Step 5 and 14b Step 3 on the production build (`PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build`, then serve `dist`, or use `ng serve`).

---

## WP4 — Pane and connections

### Task 19 (opus): `onPaneClick` in upstream's order, connection-line classes, `(clickConnectEnd)` on cancel

Upstream reference:
- `packages/react/src/container/Pane/index.tsx` `onClick` (:108-139) and `onPointerUp`'s `connectionEndedOnPane` (:334-340);
- `packages/react/src/components/ConnectionLine/index.tsx:49` (`cc(['react-flow__connection', getConnectionStatus(isValid)])`).

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`:
  - template: `(pointerup)` on `<ng-flow-pane>`, :193-209;
  - `onPaneClick` :1121-1158;
  - new `onPanePointerUp` and `connectionEndedOnPane`.
- Modify: `packages/angular/src/lib/components/connection-line/connection-line.component.ts` (`<g>` :28)
- Test: `packages/angular/src/lib/container/ng-flow/ng-flow.pane-click.spec.ts`, `packages/angular/src/lib/components/connection-line/connection-line.component.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

**Armed click-connect sets `inProgress` (review blocker).**
- While a handle is armed for click-to-connect and the mouse moves, `ClickConnectPreview.update` (`services/click-connect-preview.service.ts`) calls `store.updateConnection(...)` with `XYHandle.getClickConnectionState`, which carries `inProgress: true`.
- So `store.connection().inProgress` is true whenever click-connect is armed and the pointer has moved.
- An "in progress" check must therefore mean "a connection *drag* is in progress": `this.store.connection().inProgress && !this.store.connectionClickStartHandle()`. That applies in both the `onPaneClick` swallow and the `onPanePointerUp` flag; otherwise the cancelling click is eaten.

- [ ] **Step 1: Failing tests.**
  - `ng-flow.pane-click.spec.ts` (reuse `makePaneClick`):
    - **cancel emits:** set `store.connectionClickStartHandle` to `{ nodeId: '1', type: 'source', handleId: null }` (use the store's real shape), `vi.spyOn(inst.clickConnectEnd, 'emit')`, call `onPaneClick`. Expect the emit called once with the event, the handle `null`, and `paneClick` emitted.
    - **marquee keeps a pending click-connect:** handle set + `store.selectionInProgress.set(true)`, then `onPaneClick`. Expect the handle unchanged, no `clickConnectEnd`, no `paneClick`, and `selectionInProgress` consumed (false).
    - **connection dropped on the pane:** `store.connection.set({ ...inProgressConnection })` (build it from the store's `ConnectionInProgress` type), then `inst.onPanePointerUp({ target: paneEl, currentTarget: paneEl, pointerType: 'mouse' } as unknown as PointerEvent)`, reset the connection, then `onPaneClick`. Expect no `paneClick` and no `resetSelectedElements`. A *second* click emits `paneClick`: the flag is consumed.
    - **touch drop sets no flag:** the same with `pointerType: 'touch'`. The next click emits `paneClick`, because a moved touch fires no synthesised click.
    - **any click while a connection drag is in progress** (no handle armed) is swallowed.
    - **armed click-connect with a moved preview still cancels:** set the handle **and** `store.connection.set({ ...inProgressConnection })` (what the preview service writes). Then:
      - `inst.onPanePointerUp({ … pointerType: 'mouse', target: paneEl, currentTarget: paneEl })`;
      - `onPaneClick(makePaneClick())`.

      Expect `clickConnectEnd.emit` called once, `paneClick.emit` called once, and `store.connectionClickStartHandle()` `null`. This guards the `&& !connectionClickStartHandle()` qualification in both places.
  - `connection-line.component.spec.ts`: with an in-progress connection and `isValid: true`, the default line's `<g>` has classes `ng-flow__connection`, `xy-flow__connection` and `valid`; with `isValid: false`, `invalid`; with `null`, neither. Today it's a bare `<g>`.
  - E2E: delete `Click connections › dragging a selection does not cancel a pending click connection` and `Click connections › dropping a dragged connection on the pane does not fire pane click`.

    **Re-own** the two `pane click cancels a pending connection (click-connect)` / `(click-connect-selection)` entries: `owner: 'D'`, reason:
    > "The pane click now cancels the pending connection and emits `(clickConnectEnd)` (fixed in B), but the output's payload is only the MouseEvent; the spec JSON-parses upstream's second argument, the final connection state, which is the #6117 / `FinalConnectionState` API change (D)."

  Run both vitest files, then build and run `e2e/click-connect.spec.ts` on `--project=chromium`. Expected: fail.

- [ ] **Step 2: `onPaneClick`.** Keep the `paneClickDistance` check and the node/edge/handle/selection target guard. Then:
  ```ts
  // Upstream Pane onClick order: the click that ends a marquee, the click after a
  // connection drag dropped on the pane, and any click while a connection is in progress
  // are swallowed — they must not cancel a pending click-to-connect or reset the selection.
  // An armed click-to-connect also reports inProgress (ClickConnectPreview writes the preview
  // state on pointermove), so only a connection *drag* counts here.
  const connectionDragInProgress = this.store.connection().inProgress && !this.store.connectionClickStartHandle();
  if (this.store.selectionInProgress() || this.connectionEndedOnPane || connectionDragInProgress) {
    this.store.selectionInProgress.set(false);
    this.connectionEndedOnPane = false;
    return;
  }

  // A genuine empty-canvas click cancels a pending click-to-connect and reports it.
  if (this.store.connectionClickStartHandle()) {
    this.store.onClickConnectEnd?.(event);
    this.store.connectionClickStartHandle.set(null);
  }

  if (this.store.nodesSelectionActive()) {
    this.store.nodesSelectionActive.set(false);
    return;
  }

  this.store.resetSelectedElements();
  this.paneClick.emit(event);
  ```
  Keep angflow's existing `nodesSelectionActive` branch: it's not in scope (spec) and `ng-flow.pane-click.spec.ts:59-110` covers it.

- [ ] **Step 3: `connectionEndedOnPane`.**
  ```ts
  /** Set when a connection drag is released over the empty pane; the synthesised click consumes it. */
  private connectionEndedOnPane = false;

  onPanePointerUp(event: PointerEvent): void {
    // The pane's pointerup bubbles before XYHandle's document listener ends the connection,
    // so the connection is still in progress here. Only a mouse release is followed by a
    // synthesised click; a moved touch/pen gesture fires none, and the flag would otherwise
    // swallow the next genuine tap (same reasoning as pane.component.ts finishSelection).
    // An armed click-to-connect preview also reports inProgress; its cancelling click must not be eaten.
    const connectionDragInProgress = this.store.connection().inProgress && !this.store.connectionClickStartHandle();
    if (event.pointerType === 'mouse' && event.target === event.currentTarget && connectionDragInProgress) {
      this.connectionEndedOnPane = true;
    }
  }
  ```
  Bind `(pointerup)="onPanePointerUp($event)"` on `<ng-flow-pane>`.

- [ ] **Step 4: Connection line classes.** `<g [attr.class]="connectionClass()">` with `connectionClass = computed(() => ['ng-flow__connection', 'xy-flow__connection', getConnectionStatus(conn.isValid)].filter(Boolean).join(' '))`. Import `getConnectionStatus` from `@angflow/system` (`utils/connections.ts:55`). Leave custom connection-line components alone.

- [ ] **Step 5: Verify.**
  - Run `npx vitest run` in angular.
  - Build, then run `e2e/click-connect.spec.ts` on `--project=chromium`. Green; the two re-owned tests stay excluded.
  - **Confirm the two re-owned entries now fail only on the payload.** Run:
    ```bash
    cd tests/playwright && PATH="$SHIM:$PATH" FRAMEWORK=ng npx playwright test -c playwright.angular.config.ts e2e/click-connect.spec.ts --project=ng-known-failures --reporter=list
    ```
    Both `pane click cancels a pending connection (…)` tests must fail with a `SyntaxError` from `JSON.parse`, i.e. at the `JSON.parse(…)` of the end state (`click-connect.spec.ts:26-28`). They must not fail on the `click-connect-end` or `pane-click` count polls (:24-25), which now pass. If one still fails on a count, the emission fix is incomplete: fix it before committing.

- [ ] **Step 6: Commit.**
  ```bash
  git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/container/ng-flow/ng-flow.pane-click.spec.ts \
    packages/angular/src/lib/components/connection-line/connection-line.component.ts \
    packages/angular/src/lib/components/connection-line/connection-line.component.spec.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): pane click follows upstream order; report cancelled click-connect

  onPaneClick now swallows the click that ends a marquee, the click after a connection
  drag dropped on the pane, and clicks while a connection is in progress before it
  touches a pending click-to-connect, so a marquee no longer cancels it and a dropped
  connection no longer fires (paneClick) or resets the selection. A pane click that does
  cancel a click-to-connect emits (clickConnectEnd). The default connection line <g>
  gets the ng-/xy-flow__connection and valid/invalid classes.

  The two "pane click cancels a pending connection" e2e entries move to D: they need
  the FinalConnectionState payload (#6117).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 20 (sonnet): Pane `selection` class tracks upstream `isSelecting`

Upstream: `packages/react/src/container/FlowRenderer/index.tsx:78-81`, Pane class `selection: isSelecting` (`Pane/index.tsx:381`). See Spec deviations 13–14.

**Files:**
- Modify: `packages/angular/src/lib/container/pane/pane.component.ts` (host :22; new `isSelecting` computed)
- Modify: `packages/angular/src/lib/directives/key-handler.directive.ts` (remove dead `selectionKeyPressed`/`multiSelectionKeyPressed`, :53-54, :66, :72, :113, :118, :243-244)
- Test: create `packages/angular/src/lib/container/pane/pane.selection-class.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.**
  - Vitest, using the `PaneComponent` TestBed pattern from `ng-flow.pane-click.spec.ts:195-210`. The host has class `selection` when:
    - `store.selectionKeyActive` is true;
    - `store.userSelectionActive` is true;
    - `selectionOnDrag` is true with `panOnDrag: [1, 2]`.

    It does **not** have it with `selectionOnDrag` + `panOnDrag: true`, nor with `selectionOnDrag` + `[0, 1]`.
  - E2E: delete `Pane non-default › pan & zoom › touch input › selection key keeps touch drag in selection mode`.
  - Run both. Expected: fail.
- [ ] **Step 2: Implement.**
  ```ts
  /** Upstream FlowRenderer isLeftClickPan: the primary button pans. */
  const isLeftClickPan = (panOnDrag: boolean | number[]) => panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(0));

  /** Upstream `isSelecting`: selection key held, a marquee running, or drag-selection enabled without left-click pan. */
  readonly isSelecting = computed(
    () => this.store.selectionKeyActive() || this.store.userSelectionActive() || (this.selectionOnDrag() && !isLeftClickPan(this.panOnDrag()))
  );
  ```
  Bind `'[class.selection]': 'isSelecting()'`. Delete the two dead private fields in the key handler and their writes; `store.selectionKeyActive`/`multiSelectionActive` stay.
- [ ] **Step 3: Verify.** Run `npx vitest run` in angular (`key-handler.directive.spec.ts`). Then build and run `e2e/pane.spec.ts` on `--project=chromium`.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/container/pane/pane.component.ts packages/angular/src/lib/container/pane/pane.selection-class.spec.ts \
    packages/angular/src/lib/directives/key-handler.directive.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): pane selection class tracks upstream isSelecting

  The pane gets `selection` while the selection key is held, a marquee runs, or
  selectionOnDrag is on without left-click pan — not only during an active marquee.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 21 (sonnet): Touch pans when mouse drag is reserved for selection (react row #48)

Upstream: `Pane/index.tsx:162-164` in `onPointerDownCapture`. Decision: match upstream. The divergence explanation in `pane.component.ts` goes.

**Files:**
- Modify: `packages/angular/src/lib/container/pane/pane.component.ts` (`initSelectionListener` comment + touchstart handler :59-92, `onPointerDown` :123-128)
- Test: `packages/angular/src/lib/container/pane/pane.auto-pan.spec.ts` (:342 `it.each`)
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.**
  - In `pane.auto-pan.spec.ts`:
    - split `it.each(['mouse', 'touch', 'pen'])` so `touch` holds the selection key: `store.selectionKeyActive.set(true)` before `startSelectionAt`;
    - add "a touch drag does not start a marquee unless the selection key is held": `startSelectionAt(80, 80, 'touch')` without the key leaves `store.userSelectionActive()` false;
    - add "the touchstart suppressor lets d3 see the touch": dispatch a `TouchEvent('touchstart', { touches: [one touch] })` (or a minimal `Event` with `touches`) on the pane after `initSelectionListener()`, and expect `defaultPrevented` false;
    - with `panOnDrag: false`, touch still starts a marquee.
  - E2E: delete `Pane non-default › pan & zoom › touch input › touch drag pans when primary mouse drag is reserved for selection`.
  - Run both. Expected: fail.
- [ ] **Step 2: Implement.**
  ```ts
  /**
   * Mouse-button arrays only restrict mouse input: a touch gesture pans (d3-zoom) unless
   * the user explicitly activated selection with the selection key, or panning is off.
   * Upstream Pane onPointerDownCapture.
   */
  private touchPans(): boolean {
    return this.panOnDrag() !== false && !this.store.selectionKeyActive();
  }
  ```
  - `onPointerDown`: `if (event.pointerType === 'touch' && this.touchPans()) return;` before `shouldStartSelectionFor`.
  - Touchstart suppressor: `if (this.touchPans()) return;` after the multi-touch check.
  - Rewrite the `initSelectionListener` doc so it describes the upstream rule. Delete the "touch marquee is intended" reasoning.
- [ ] **Step 3: Verify.**
  - Run `npx vitest run` in angular.
  - Build, then run `e2e/pane.spec.ts` on `--project=chromium`. Both touch tests and `primary mouse drag still creates a selection marquee` pass.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/container/pane/pane.component.ts packages/angular/src/lib/container/pane/pane.auto-pan.spec.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): touch pans when mouse drag is reserved for selection

  As upstream: with panOnDrag enabled, a touch drag pans instead of starting a marquee
  unless the selection key is held. Mouse-button arrays only restrict mouse input.

  Behaviour change: touch no longer starts a marquee with selectionOnDrag unless the
  selection key is held (or panOnDrag is false).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

### WP4 checkpoint

- [ ] Same commands as the WP1 checkpoint. Expected: `known failures: 7 entries` (3 B + 4 D), `STALE: 0`, `verdict: OK`.
- [ ] By hand (examples app):
  - click-to-connect then marquee, then complete the connection;
  - drag a connection onto the pane: selection kept, no `(paneClick)`;
  - on a touch device or Chrome DevTools touch emulation, a touch drag on `/tests/generic/pane/non-defaults` pans.

---

## WP5 — Accessibility and styling

### Task 22 (sonnet): Arrow-key move announcement, 5px step, Shift ×4

Upstream: `packages/react/src/hooks/useMoveSelectedNodes.ts`, `components/NodeWrapper/index.tsx:134-155`, `components/A11yDescriptions/index.tsx` (`react-flow__aria-live-${rfId}`, rendered only without `disableKeyboardA11y`).

**Files:**
- Modify: `packages/angular/src/lib/directives/key-handler.directive.ts` (`KeyHandlerDirective.handleArrowKey`; locate by symbol, since Task 20 changed this file)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (aria-live div :242-245)
- Test: `packages/angular/src/lib/directives/key-handler.directive.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.** New `describe('arrow keys')` in `key-handler.directive.spec.ts`:
  - ArrowRight moves a selected node by 5;
  - Shift+ArrowRight by 20;
  - with `snapToGrid` + `snapGrid [15, 15]`, by 15, and the result snaps;
  - `nodeExtent [[0, 0], [100, 100]]` clamps;
  - a non-draggable selected node (`draggable: false`) doesn't move;
  - with a focused node, `store.ariaLiveMessage()` is `Moved selected node right. New position, x: 5, y: 0` (focus a `.xy-flow__node[data-id]` element appended to `store.domNode()`);
  - with no focused node, the nodes move and the message stays `''`.

  Plus an ng-flow test: the live region has `id="ng-flow__aria-live-<rfId>"` and isn't rendered with `disableKeyboardA11y`.
  E2E: delete `Nodes › keyboard › moving a selected node with arrow keys announces its new position`.
  Run both. Expected: fail.
- [ ] **Step 2: Implement `handleArrowKey`.**
  ```ts
  private static readonly arrowDirections: Record<string, XYPosition> = {
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  };

  private handleArrowKey(event: KeyboardEvent): void {
    const direction = KeyHandlerDirective.arrowDirections[event.key];
    const nodesDraggable = this.store.nodesDraggable();
    const selected = this.store.selectedNodes().filter((n) => n.draggable ?? nodesDraggable); // upstream selectedAndDraggable
    if (!direction || selected.length === 0) return;
    event.preventDefault();

    // by default a node moves 5px per press, snapGrid when snapping; Shift ×4 (upstream)
    const snapToGrid = this.store.snapToGrid();
    const snapGrid = this.store.snapGrid();
    const factor = event.shiftKey ? 4 : 1;
    const dx = direction.x * (snapToGrid ? snapGrid[0] : 5) * factor;
    const dy = direction.y * (snapToGrid ? snapGrid[1] : 5) * factor;
    const focusedId = this.focusedNodeId();
    let focusedAbsolute: XYPosition | undefined;

    const changes = [];
    for (const node of selected) {
      const internal = this.store.nodeLookup.get(node.id);
      if (!internal) continue;
      let nextPosition = { x: internal.internals.positionAbsolute.x + dx, y: internal.internals.positionAbsolute.y + dy };
      if (snapToGrid) nextPosition = snapPosition(nextPosition, snapGrid);
      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id, nextPosition, nodeLookup: this.store.nodeLookup,
        nodeExtent: this.store.nodeExtent(), nodeOrigin: this.store.nodeOrigin(), onError: this.store.onError,
      });
      changes.push({ id: node.id, type: 'position' as const, position, positionAbsolute });
      if (node.id === focusedId) focusedAbsolute = positionAbsolute;
    }
    this.store.triggerNodeChanges(changes as NodeChange[]);

    if (focusedAbsolute) {
      this.store.ariaLiveMessage.set(
        this.store.ariaLabelConfig()['node.a11yDescription.ariaLiveMessage']({
          direction: event.key.replace('Arrow', '').toLowerCase(), x: ~~focusedAbsolute.x, y: ~~focusedAbsolute.y,
        }),
      );
    }
  }

  /** The node wrapper inside this flow that has focus, if any. */
  private focusedNodeId(): string | null {
    const root = this.store.domNode();
    const active = root?.ownerDocument.activeElement;
    if (!root || !active || !root.contains(active)) return null;
    return active.closest('.xy-flow__node')?.getAttribute('data-id') ?? null;
  }
  ```
  Check the exact `onError`/`ariaLabelConfig` member names on `FlowStore` and the `calculateNodePosition` signature (`graph.ts:408`). Import `snapPosition`, `calculateNodePosition` and `type XYPosition` from `@angflow/system`.
- [ ] **Step 3: Live region.** In the ng-flow template:
  ```html
  @if (!disableKeyboardA11y()) {
    <div [id]="'ng-flow__aria-live-' + store.rfId()" class="ng-flow__aria-live xy-flow__aria-live xy-flow__a11y-descriptions" aria-live="assertive" aria-atomic="true" style="…">
      {{ store.ariaLiveMessage() }}
    </div>
  }
  ```
  Keep the inline visually-hidden style.
- [ ] **Step 4: Verify.**
  - Run `npx vitest run` in angular.
  - Build, then run `e2e/nodes.spec.ts` on `--project=chromium` (green).
  - By hand: `/a11y` example with a screen reader or the Accessibility pane shows the announcements.
- [ ] **Step 5: Commit.**
  ```bash
  git add packages/angular/src/lib/directives/key-handler.directive.ts packages/angular/src/lib/directives/key-handler.directive.spec.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.component.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): announce arrow-key node moves; 5px step, Shift x4

  As upstream: arrow keys move selected draggable nodes 5px (snapGrid when snapping,
  x4 with Shift), through snapping and extent clamping, and the focused node's new
  position is written to the aria-live region (ng-flow__aria-live-<flowId>), which is
  rendered only when keyboard a11y is enabled.

  Behaviour change: the arrow-key step is 5px (was 1px).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 23 (opus): Background pattern ids and `patternTransform`

Upstream: `packages/react/src/additional-components/Background/Background.tsx` and `Patterns.tsx`. Open question 4 default: full parity of the `<pattern>` element.

**Files:**
- Modify: `packages/angular/src/lib/components/background/background.component.ts` (template :25-97, `patternId` :121-124, `patternOffset` :157-163, size/lineWidth defaults :107-109, `crossPath` :165-172)
- Test: `packages/angular/src/lib/components/background/background.component.spec.ts`
- Modify: `tests/playwright/known-failures.ng.ts`

- [ ] **Step 1: Failing tests.** Extend `background.component.spec.ts` (it drives inputs via `ɵSIGNAL`):
  - With `store.rfId.set('flow-a')` and `id = '0'`, the pattern id is `pattern-flow-a0` and the rect fills `url(#pattern-flow-a0)`. Without `id`, it's `pattern-flow-a`.
  - Defaults at zoom 1, transform 0: `patternTransform="translate(-10,-10)"`, `x="0"`, `y="0"`.
  - Lines, gap 100, offset 2 → `translate(-52,-52)`.
  - Cross, size 6 → `translate(-(offset + 3),…)`, because `dim` is `scaledSize`.
  - Transform `[15, 7, 1]`, gap 20 → `x="15"`, `y="7"`: the offset no longer feeds x/y.
  - With Open question 4's default, the shapes match upstream:
    - dots: `circle[cx=r][cy=r][r=scaledSize/2]`;
    - lines: `path[d="M{w/2} 0 V{h} M0 {h/2} H{w}"]`, keeping `fill="none"` (the existing regression tests).

  E2E: delete both `Background › …` entries.
  Run both. Expected: fail.
- [ ] **Step 2: Implement.**
  ```ts
  readonly patternId = computed(() => `pattern-${this.store.rfId()}${this.bgId() ?? ''}`);
  private readonly scaledGap = computed<[number, number]>(() => [this.gapX() * this.zoom() || 1, this.gapY() * this.zoom() || 1]);
  // upstream: `size || defaultSize[variant]`, so `size: 0` also falls back to the default
  private readonly patternSize = computed(() => this.size() || (this.variant() === 'cross' ? 6 : 1)); // size input becomes optional (no default value)
  readonly scaledSize = computed(() => this.patternSize() * this.zoom());
  private readonly patternDimensions = computed<[number, number]>(() =>
    this.variant() === 'cross' ? [this.scaledSize(), this.scaledSize()] : this.scaledGap());
  readonly patternX = computed(() => this.store.transform()[0] % this.scaledGap()[0]);
  readonly patternY = computed(() => this.store.transform()[1] % this.scaledGap()[1]);
  readonly patternTransform = computed(() => {
    const [dx, dy] = this.patternDimensions();
    const z = this.zoom();
    return `translate(-${this.offsetX() * z + dx / 2},-${this.offsetY() * z + dy / 2})`;
  });
  ```
  - One `<pattern [attr.id]="patternId()" [attr.x]="patternX()" [attr.y]="patternY()" [attr.width]="scaledGap()[0]" [attr.height]="scaledGap()[1]" patternUnits="userSpaceOnUse" [attr.patternTransform]="patternTransform()">` with the variant-specific child.
  - Dots: `<svg:circle>` at `r = scaledSize/2`.
  - Lines/cross: `<svg:path [attr.d]="'M' + w/2 + ' 0 V' + h + ' M0 ' + h/2 + ' H' + w" [attr.stroke-width]="resolvedLineWidth()" fill="none">`, with `[w, h] = patternDimensions()`.
  - **lineWidth default:** upstream destructures `lineWidth = 1`: undefined becomes 1, 0 stays 0, and the stroke width is **not** scaled by zoom.
    - Today angflow's `resolvedLineWidth` falls back to `size` for dots and multiplies by zoom (`background.component.ts:151-155`, `:67`, `:85`).
    - New: `resolvedLineWidth = computed(() => this.lineWidth() ?? 1)`, unscaled.
    - Lines/cross get visibly thinner when zoomed in. Changelog: part of the "pattern geometry matches upstream" entry.
  - Keep the `xy-flow__background-pattern <variant>` classes, `patternClassName`, `color`, `bgColor`.
  - Remove `patternOffset()` and `crossPath()`.
  - Update the input docs:
    - `size` is upstream's: dot diameter / cross size; default 1, cross 6; `0` means default;
    - `lineWidth` defaults to 1 and is in screen px (not scaled by zoom);
    - `id` is appended to `pattern-<flowId>`.
- [ ] **Step 3: Verify.**
  - Run `npx vitest run` in angular.
  - Build, then run `e2e/background.spec.ts` on `--project=chromium` (green).
  - By hand: `/backgrounds` and `/backgrounds-variants` in the examples app. Compare with the React example (`examples/react`, `pnpm dev` there is not in the workspace; compare against reactflow.dev's Backgrounds example instead). Lines and cross sit on the flow-origin grid, and several flows on one page each paint their own pattern.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/components/background/background.component.ts \
    packages/angular/src/lib/components/background/background.component.spec.ts tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  fix(angular): background pattern ids per flow and upstream patternTransform

  Pattern ids are pattern-<flowId><id> (pattern-<flowId> without an id), so several
  flows on one page no longer share one pattern. As upstream, x/y track the transform
  modulo the gap and the offset plus half a cell moves to patternTransform; the
  pattern shapes and size defaults match upstream.

  Behaviour change: pattern ids and the rendered pattern geometry changed.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 24 (haiku): Dark-mode background pattern colours (#5839)

Upstream: merge `d02a3c63b`; applies cleanly to `init.css`. Angular's `ng-flow.css:85-87` duplicates the variables and is appended after `init.css` in both bundles (`scripts/bundle-css.js`), so it needs the same edit or the port has no visible effect.

**Files:**
- Modify: `packages/system/src/styles/init.css` (:48-50), `packages/angular/src/lib/styles/ng-flow.css` (:85-87)

- [ ] **Step 1: Check the current values.** `grep -n "background-pattern-.*-color-default" packages/system/src/styles/init.css packages/angular/src/lib/styles/ng-flow.css`. The dark block shows `#777` three times in each file (spec: visual check, no vitest).
- [ ] **Step 2: Apply.** `git diff d02a3c63b^1 d02a3c63b -- packages/system | git apply -3`. In `ng-flow.css`'s dark block set dots `#555`, lines `#333`, cross `#333`.
- [ ] **Step 3: Verify.**
  - Run the grep again: the dark values are `#555`/`#333` in both files, and the light values are unchanged.
  - Build both packages. Then `grep -c "#555" packages/angular/dist/style.css` ≥ 1.
  - By hand: `/color-mode` in dark mode.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/styles/init.css packages/angular/src/lib/styles/ng-flow.css
  git commit -F- <<'EOF'
  style: dark-mode background pattern colours

  Ported from xyflow/xyflow#5839 (d02a3c63b), applied to angular's ng-flow.css too
  (it overrides init.css in both bundles).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 25 (sonnet): Cursor on `.xy-flow__pane::before` (#6029)

Upstream: merge `30df074d5` (changeset b872a5b). It doesn't apply (init.css context differs): hand-port.
- Angular overrides the pane cursor twice: `style.css:21-31` (custom SVG grab/grabbing) and `ng-flow.css:108-115`.
- Keep the SVG cursors: move them to `::before`.
- Keep `.selection` on the pane itself, because the pane uses `setPointerCapture` (`pane.component.ts:149`).
- Pseudo-element hits still target the pane host, so `pane.component.ts:105` (`target === el`) is unaffected.

**Files:**
- Modify: `packages/system/src/styles/init.css` (`.xy-flow__pane` :69-82), `packages/angular/src/lib/styles/style.css` (:21-31), `packages/angular/src/lib/styles/ng-flow.css` (:108-115)

- [ ] **Step 1: Baseline.** Build, then run `e2e/pane.spec.ts` and `e2e/nodes.spec.ts` on `--project=chromium` and record that they're green. The spec's bar for this item is "existing e2e stays green".
- [ ] **Step 2: Implement.**
  - `init.css`: as upstream. `&::before { content: ''; position: absolute; inset: 0; }`, `&.draggable::before { cursor: grab }`, `&.dragging::before { cursor: grabbing }`, `&.selection, &.selection::before { cursor: pointer }`, with upstream's two comments.
  - `style.css`: split the selectors. `.xy-flow__pane.draggable::before` gets the open-hand SVG cursor, and `.xy-flow__node.draggable` keeps it on the node. Likewise `.xy-flow__pane.dragging::before` and `.xy-flow__node.draggable.dragging` for the closed hand.
  - `ng-flow.css`: keep `.xy-flow__pane { cursor: default; touch-action: none; }`. Change `.xy-flow__pane.selection { cursor: pointer; }` to `.xy-flow__pane.selection, .xy-flow__pane.selection::before { cursor: pointer; }`.
  - Confirm the pane host still has `position: absolute` (`pane.component.ts:19`), which `::before` needs.
- [ ] **Step 3: Verify.**
  - Build. Then `grep -n "xy-flow__pane.draggable::before" packages/angular/dist/style.css`, and `grep -n "xy-flow__pane.draggable {" packages/angular/dist/style.css` → no pane-level cursor rule left.
  - Rerun both specs: green.
  - By hand: the pane shows grab, then grabbing while panning; nodes keep their own cursor; a Shift marquee shows pointer.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/styles/init.css packages/angular/src/lib/styles/style.css packages/angular/src/lib/styles/ng-flow.css
  git commit -F- <<'EOF'
  perf: pane cursor on ::before so cursor changes don't restyle the flow

  Ported from xyflow/xyflow#6029 (30df074d5), including angflow's custom SVG cursors
  in style.css and the selection cursor in ng-flow.css.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 26 (sonnet): De-brand "React Flow" dev-warning strings and links (#5793 leftovers)

Upstream: merge `5d64c5f0d`. Don't adopt `createDevWarn`: angflow's `setDevWarnSink` covers routing. Port only the strings. URL per Open question 5 (review decision). `AddEdgeOptions.onError` already landed in Task 17. Upstream's `error016` (an edge removed before `onEdgeClick` runs) is **not** ported: no angflow code path raises it.

**Files:**
- Modify:
  - `packages/system/src/constants.ts` (:4-5 `error001`, :9 `error004`);
  - `packages/system/src/utils/general.ts` (:152 default sink, :241 `parsePadding`);
  - `packages/angular/src/lib/utils/dev-warn.ts` (:29: drop the `Help:` link).
- Test: `packages/angular/src/lib/utils/dev-warn.spec.ts` (update expectations); the grep check below.

- [ ] **Step 1: Failing check.** `grep -rn "React Flow\]\|reactflow.dev\|The React Flow parent" packages/system/src packages/angular/src --include=*.ts | grep -v "\.spec\.ts"` lists 5 hits today. Comments that say "Mirrors React Flow's …" are parity notes and stay.
- [ ] **Step 2: Implement.**
  - `error001: () => 'Seems like you have not used zustand provider as an ancestor.'`. Drop the link: the system sink appends its own `Help:`, and the wording is upstream's.
  - `error004: () => 'The parent container needs a width and a height to render the graph.'`.
  - Default sink: `` console.warn(`[xyflow]: ${message} Help: https://xyflow.com/error#${id}`) ``.
  - `parsePadding`: drop the `[React Flow] ` prefix.
  - `ngDevWarn`: `` console.warn(`[angflow]: ${message}`) ``, with no `Help:` URL. Angflow-only ids would point at nothing (Open question 5).
  - Update `dev-warn.spec.ts` to the new message.
- [ ] **Step 3: Verify.** The grep from Step 1 prints nothing. Run `npx vitest run` in system and angular.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/system/src/constants.ts packages/system/src/utils/general.ts \
    packages/angular/src/lib/utils/dev-warn.ts packages/angular/src/lib/utils/dev-warn.spec.ts
  git commit -F- <<'EOF'
  chore: remove "React Flow" branding from dev warnings

  Library-neutral messages, as in xyflow/xyflow#5793 (5d64c5f0d). The system default
  sink uses upstream's xyflow.com help link; angflow's ngDevWarn prints no help link.
  Angflow keeps its setDevWarnSink routing instead of createDevWarn. Not ported from
  5d64c5f0d: error016 (no angflow code path raises it). AddEdgeOptions.onError landed
  with the reconnectEdge fix.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

### WP5 checkpoint

- [ ] Same commands as the WP1 checkpoint. Expected: `known failures: 4 entries` (all `owner: 'D'`: 2 colour-mode, 2 click-connect payload), `STALE: 0`, `verdict: OK`.
- [ ] Check `grep -c "owner: 'B'" tests/playwright/known-failures.ng.ts` → `0`.

---

## WP6 — Smaller store issues

### Task 27 (sonnet): No per-flow state left behind in a shared store

Open question 1 default.

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (new `detachFlow()`; `reset()` :1039-1061 calls it)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (`NgFlowComponent.ngOnDestroy`; locate by symbol)
- Test: `packages/angular/src/lib/components/ng-flow-provider/ng-flow-provider.component.spec.ts`, `packages/angular/src/lib/services/flow-store.service.spec.ts`

- [ ] **Step 1: Failing tests.**
  - Provider spec, next to `unmounting the inner <ng-flow> keeps the shared store state` (:99). After unmounting the inner flow:
    - `store.onNodesChange`, `onEdgesChange`, `onConnect*`, `onClickConnect*`, `onNodeDrag*`, `onSelectionDrag*`, `onNodesDelete`, `onEdgesDelete`, `onDelete` are all `undefined`/`null` (whatever "unset" is for each field);
    - `store.domNode()` is `null`; `width()`/`height()` are 0;
    - `store.connection()` is the initial connection;
    - `store.triggerNodeChanges([{ id: 'n1', type: 'select', selected: true }])` doesn't throw (today it emits into a destroyed `OutputRef`, NG0953);
    - the graph is still there (existing assertion).
  - Store spec: `reset()` also clears those fields.

  Run both. Expected: fail.
- [ ] **Step 2: Implement.** `detachFlow()` resets:
  - every callback field `NgFlowComponent` installs: `grep -n "this.store.on[A-Z][A-Za-z]* =" ng-flow.component.ts` (the `onBeforeDelete` sync, the `onNodesChange`…`onDelete` block in the constructor);
  - `domNode`, `width`, `height`, `panZoom`;
  - `connection`, `connectionClickStartHandle`, `paneDragging`, `userSelectionActive`, `userSelectionRect`, `selectionInProgress`;
  - the key flags.

  Read the field list from the component; don't guess. It keeps nodes, edges, lookups and configuration signals. `reset()` = `detachFlow()` + the existing graph clearing. `NgFlowComponent.ngOnDestroy` calls `this.store.detachFlow()` in both branches, replacing the lone `panZoom.set(null)`. Update the ngOnDestroy comment.
- [ ] **Step 3: Verify.** Run `npx vitest run` in angular. In particular, the `onError` wrapping tests must still pass, and the `ngOnInit` re-wiring after a remount must too (add a remount-then-change test if none covers it).
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/components/ng-flow-provider/ng-flow-provider.component.spec.ts
  git commit -F- <<'EOF'
  fix(angular): unmounting a flow leaves no per-flow state in a shared store

  A provider-shared FlowStore kept the destroyed <ng-flow>'s output callbacks, DOM node,
  size and connection state. They are now cleared on every unmount (and by reset());
  the provider's graph is still kept across inner unmounts.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 28 (sonnet): MiniMap re-reads `panZoom` after the flow remounts

Upstream: React MiniMap 12.11.4 recreates `XYMinimap` when `panZoom` changes.

**Files:**
- Modify: `packages/angular/src/lib/components/minimap/minimap.component.ts` (creation effect :211-226, field :200)
- Test: `packages/angular/src/lib/components/minimap/minimap.component.spec.ts` (next to `does NOT create the XYMinimap instance until panZoom exists`, :254)

- [ ] **Step 1: Failing test.** With the existing harness:
  1. set panZoom instance A → a minimap is created on A;
  2. set `null`, then instance B;
  3. the minimap is destroyed and recreated against B. Spy on A's and B's methods that `XYMinimap` calls, or spy `XYMinimap` through the same seam the `:254` test uses.

  Today it keeps A. Run it. Expected: fail.
- [ ] **Step 2: Implement.** Track `private minimapPanZoom: PanZoomInstance | null`. In the effect: if `panZoom !== this.minimapPanZoom`, run `this.minimap?.destroy(); this.minimap = null; this.minimapPanZoom = panZoom;`, then create when both `panZoom` and the SVG exist. Destroy on `null` too.
- [ ] **Step 3: Verify.** Run `npx vitest run src/lib/components/minimap`.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/components/minimap/minimap.component.ts packages/angular/src/lib/components/minimap/minimap.component.spec.ts
  git commit -F- <<'EOF'
  fix(angular): MiniMap follows a new panZoom after the flow remounts

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 29 (haiku): `selectNodesData` doesn't re-emit unchanged data

Upstream: React 13 `useNodesData` with `shallowNodeData`. Angflow's system already exports `shallowNodeData` (`utils/shallow-node-data.ts`).

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`selectNodesData` :920-933)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (`describe('selectNodesData reads from nodeLookup')` :256)

- [ ] **Step 1: Failing test.**
  1. `const sig = service.selectNodesData(['a']); const first = sig();`
  2. Move node `a` (position change, same `data` reference) and bump the version (`store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x: 5, y: 5 } }])`).
  3. `expect(sig()).toBe(first)`: same array reference.
  4. Changing `data` yields a new value.

  Today a new array comes every version. Run it. Expected: fail.
- [ ] **Step 2: Implement.** `computed(() => …, { equal: shallowNodeData })`. Import `shallowNodeData` from `@angflow/system`. Its signature accepts arrays.
- [ ] **Step 3: Verify.** Run `npx vitest run src/lib/services/ng-flow.service.spec.ts`. Build, then run `e2e/nodes-data-hooks.spec.ts` (it's React-only and skips) and `e2e/nodes.spec.ts` on `--project=chromium`.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
  git commit -F- <<'EOF'
  perf(angular): selectNodesData only emits when node data changes

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 30 (sonnet): Key combinations (`Meta+Backspace`) for delete/selection keys

Upstream: `packages/react/src/hooks/useKeyPress.ts`:
- `getKeyCodes` splits on `+` (a literal `+` key is supported);
- `isMatchingKey` filters `keys.length === pressedKeys.size` on keydown;
- `getKeyOrCode`;
- a Meta keyup clears the set (the macOS no-keyup quirk);
- blur/contextmenu reset.

Scope per Open question 6.

**Files:**
- Create: `packages/angular/src/lib/utils/key-press.ts` (pure tracker)
- Create: `packages/angular/src/lib/utils/key-press.spec.ts`
- Modify: `packages/angular/src/lib/directives/key-handler.directive.ts` (the selection, multi-selection and delete-key branches of `KeyHandlerDirective.onKeyDown` and `onKeyUp`, `resetHeldKeys`, `matchesKey`; Tasks 20 and 22 have changed this file, so locate code by symbol, not line number)
- Test: `packages/angular/src/lib/directives/key-handler.directive.spec.ts`

**Interfaces:**
```ts
/** Upstream useKeyPress semantics for one KeyCode input, without the React state. */
export class KeyPressTracker {
  constructor(keyCode: KeyCode | null);
  /** Returns true when this keydown completes one of the combinations. */
  down(event: KeyboardEvent): boolean;
  /** Returns true when the combination was held and this keyup releases it. */
  up(event: KeyboardEvent): boolean;
  reset(): void;
  readonly pressed: boolean;
}
```

- [ ] **Step 1: Failing tests.**
  - `key-press.spec.ts`:
    - `'Meta+Backspace'` matches Meta down then Backspace down, not Backspace alone;
    - `['Backspace', 'Delete']` matches either;
    - `'Shift'` while `a` is also held doesn't match (upstream's exact-size rule);
    - a Meta keyup clears the set;
    - `'+'` matches the plus key;
    - code-based specs (`'KeyA'`) match via `event.code`.
  - `key-handler.directive.spec.ts`:
    - `deleteKeyCode: 'Meta+Backspace'` deletes the selection on Meta+Backspace, but not on Backspace;
    - `selectionKeyCode: 'Shift+s'` sets `store.selectionKeyActive` only while both are held.

  Run both. Expected: fail (module missing; single-key matching).
- [ ] **Step 2: Implement `KeyPressTracker`** by porting `getKeyCodes`/`isMatchingKey`/`getKeyOrCode` and the down/up handler logic verbatim (minus React state). In the directive:
  - recreate a tracker for each input when it changes (a `computed(() => new KeyPressTracker(this.deleteKeyCode()))` per input, or `effect`-free lazy rebuild on read);
  - in `onKeyDown`: `if (deleteTracker.down(event)) this.handleDelete();`, and the selection/multi trackers set `store.selectionKeyActive`/`multiSelectionActive` from `.pressed`;
  - in `onKeyUp`: call `.up(event)` and write the flags again;
  - in `resetHeldKeys`: `reset()` all three.

  The activation keys keep their current code. Keep `isInputDOMNode` handling as today. Upstream's `actInsideInputWithModifier` default is true: a modifier combo works inside inputs. Match it for the combo trackers.
- [ ] **Step 3: Verify.** Run `npx vitest run` in angular (all 16 existing key-handler tests stay green). Build, then run `e2e/edges.spec.ts` and `e2e/nodes.spec.ts` on `--project=chromium`: they use `deleteKeyCode: 'd'` and `multiSelectionKeyCode: 's'`.
- [ ] **Step 4: Commit.**
  ```bash
  git add packages/angular/src/lib/utils/key-press.ts packages/angular/src/lib/utils/key-press.spec.ts \
    packages/angular/src/lib/directives/key-handler.directive.ts packages/angular/src/lib/directives/key-handler.directive.spec.ts
  git commit -F- <<'EOF'
  feat(angular): key combinations for delete and selection key codes

  deleteKeyCode, selectionKeyCode and multiSelectionKeyCode accept combinations such as
  'Meta+Backspace' with upstream useKeyPress semantics.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

### WP6 checkpoint

- [ ] Same commands as the WP1 checkpoint. Expected: `known failures: 4 entries` (all D), `STALE: 0`, `verdict: OK`.

---

## WP7 — Release

### Task 31 (sonnet): Versions, changelogs, report, memory, publish hand-off

**Files:**
- Modify: `packages/system/package.json` (0.1.13 → 0.1.14), `packages/angular/package.json` (0.3.21 → 0.3.22), `packages/mcp/package.json` (0.0.3 → 0.0.4)
- Modify: `packages/system/CHANGELOG.md`, `packages/angular/CHANGELOG.md`, `packages/mcp/CHANGELOG.md`
- Regenerate: `packages/mcp/src/generated/tool-schemas.ts` (stamp 0.3.22)
- Modify: `docs/reviews/2026-11-24-upstream-sync.md` (§1, §2, §5)
- Modify (outside the repo, not committed): `~/.claude/projects/-run-media-shisu-OS-Code-products-web-angflow/memory/upstream-sync-roadmap.md`

- [ ] **Step 1: Versions.**
  ```bash
  (cd packages/system && npm version 0.1.14 --no-git-tag-version)
  (cd packages/angular && npm version 0.3.22 --no-git-tag-version)
  (cd packages/mcp && npm version 0.0.4 --no-git-tag-version)
  ```
  `--no-git-tag-version`: no commit or tag from npm. Angular's `"@angflow/system": "workspace:^"` stays as it is; pnpm rewrites it on publish.
  Then run `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/mcp run generate:schemas`. The banner now says `@angflow/angular@0.3.22`.
  Check that `CI=true PATH="$SHIM:$PATH" corepack pnpm install --frozen-lockfile` still passes (versions of workspace packages don't change the lockfile's specifiers; if it complains, run `CI=true PATH="$SHIM:$PATH" corepack pnpm install` and include `pnpm-lock.yaml`).

- [ ] **Step 2: Changelogs.** Add the new version on top; don't backfill.
  - `packages/system/CHANGELOG.md`: insert `## 0.1.14` directly under `# @angflow/system`, above `## @angflow fork`.
  - `packages/angular/CHANGELOG.md`: `## 0.3.22` above `## 0.3.2`.
  - `packages/mcp/CHANGELOG.md`: `## 0.0.4`.

  The entries must call out:
  - **Added (additive API):**
    - `setViewport` resolves `boolean`;
    - `setCenter`/`zoomIn`/`zoomOut`/`zoomTo` resolve `false` when interrupted;
    - `FitViewResult.ended`;
    - overlapping `fitView` calls share one promise (and `fitBounds` calls theirs);
    - agent tools: `fit_view`/`fit_bounds` results gain `ended`, and `set_viewport` now awaits its animation and returns a boolean (its JSON-RPC reply arrives after the animation);
    - `BaseEdgeComponent` label inputs;
    - key combinations for `deleteKeyCode`/`selectionKeyCode`/`multiSelectionKeyCode`;
    - `ReconnectEdgeOptions.onError`.
  - **System type change:** `PanZoomInstance.setViewport` resolves `Promise<boolean>` (was `Promise<ZoomTransform | undefined>`); affects direct `@angflow/system` users only.
  - **Behaviour changes**, each with a one-line migration:
    - touch pans instead of starting a marquee when `panOnDrag` is on (hold the selection key to marquee);
    - selected edges are elevated by default (`[elevateEdgesOnSelect]="false"` restores the old look);
    - the arrow-key step is 5px, ×4 with Shift;
    - built-in edge labels are SVG inside the edge. Anyone styling `.xy-flow__edge-label` as an HTML div must restyle `.xy-flow__edge-textwrapper`/`-textbg`/`-text`, or use `labelStyle`/`labelBgStyle`. `EdgeTextComponent` is now `<g ngFlowEdgeText>` (per Open question 3's outcome);
    - background pattern ids are `pattern-<flowId><id>` and the pattern geometry matches upstream (per Open question 4's outcome);
    - `reconnectEdge` with an options object but no `shouldReplaceId` now replaces the id;
    - `getNodesBounds` (and `get_nodes_bounds`) uses absolute positions for sub-flow children and skips nodes that aren't in the store (upstream behaviour);
    - custom edges no longer get a renderer-drawn label: render it via `<ng-flow-base-edge [label] [labelX] [labelY]>`. Labels drawn that way are not measured by layout (`withLiveEdgeLabels` only reads built-in edge labels), so pass `labelWidth`/`labelHeight` on the edge if `layoutNodes` must reserve space for them.
  - **Fixed:** one line per remaining fix, citing the upstream PR where there is one:
    - #6064, #6158, #5850/#6108/#6054, #5922, #5902/#6119, #5915, #6097, #5871 + `getNodesBounds`, #5889, #5998, #6084, #5806, #6036, #6055, #6131, #5839, #6029, #5793;
    - pane click / click-connect / connection-line classes;
    - the pane `selection` class;
    - the a11y announcement;
    - shared-store unmount;
    - MiniMap remount;
    - `selectNodesData`.
  - mcp 0.0.4: "Tool snapshot regenerated from @angflow/angular 0.3.22 (`fit_view`/`fit_bounds`/`set_viewport` descriptions)."

- [ ] **Step 3: Report.** `docs/reviews/2026-11-24-upstream-sync.md`:
  - §1 and §2: add a `Status` column. Fill `B ✓ <short sha>` per row (get SHAs with `git log --oneline $BASE..HEAD`). Deletion stays `C`. `nodeClickDistance` and `(connectEnd)`/`connection.to` stay `D`. For #6131, note that it was applied (angflow's `NodeProps` is the system alias).
  - §5 `### A — first-run findings`: add a `### B — results` subsection:
    - entries 27 → 4;
    - B 25 → 0 (23 fixed, 2 re-owned to D);
    - D 2 → 4;
    - the commit range.
  - §5 roadmap row B: link this plan.

- [ ] **Step 4: Memory.** In `upstream-sync-roadmap.md`, update the status line: "B implemented locally (2026-11-…): 0 B entries, 4 D left (2 colour-mode, 2 click-connect payload); versions bumped to system 0.1.14 / angular 0.3.22 / mcp 0.0.4, publish pending (user, 2FA)." Not committed: it lives outside the repo.

- [ ] **Step 5: Final verification.** Build all three packages (`PATH="$SHIM:$PATH" corepack pnpm build`). Then run `PATH="$SHIM:$PATH" corepack pnpm typecheck`, `PATH="$SHIM:$PATH" corepack pnpm lint`, `PATH="$SHIM:$PATH" corepack pnpm test`, and the full Angular e2e verdict (4 entries, 0 STALE, OK).

- [ ] **Step 6: Packed-manifest check** (no publish):
  ```bash
  cd packages/angular && PATH="$SHIM:$PATH" corepack pnpm pack && tar -xzOf angflow-angular-0.3.22.tgz package/package.json | grep angflow/system
  # expect: "@angflow/system": "^0.1.14"   (never "workspace:^")
  rm angflow-angular-0.3.22.tgz
  ```

- [ ] **Step 7: Commit.**
  ```bash
  git add packages/system/package.json packages/angular/package.json packages/mcp/package.json \
    packages/system/CHANGELOG.md packages/angular/CHANGELOG.md packages/mcp/CHANGELOG.md \
    packages/mcp/src/generated/tool-schemas.ts docs/reviews/2026-11-24-upstream-sync.md
  # + pnpm-lock.yaml only if Step 1 changed it
  git commit -F- <<'EOF'
  chore(release): system 0.1.14, angular 0.3.22, mcp 0.0.4

  Bug-fix release (sub-project B): changelogs, regenerated mcp snapshot, and the
  upstream-sync report updated with commit SHAs and the new known-failures counts
  (B: 0, D: 4).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

- [ ] **Step 8: Hand the publish to the user.** The plan does not publish: npm 2FA prompts for browser approval. Give the user these commands, from CLAUDE.md, with the versions already bumped. System first, because angular depends on it.
  ```bash
  # 1. System
  cd packages/system
  npm run build
  npm publish --access public

  # 2. Angular — MUST be pnpm (rewrites workspace:^ → ^0.1.14; the prepack guard aborts npm)
  cd ../angular
  npm run build
  corepack pnpm pack && tar -xzOf angflow-angular-0.3.22.tgz package/package.json | grep angflow/system
  # expect: "@angflow/system": "^0.1.14"   (never "workspace:^")
  rm angflow-angular-0.3.22.tgz
  corepack pnpm publish --access public

  # 3. MCP (snapshot already regenerated from angular 0.3.22)
  cd ../mcp
  npm run build
  npm publish --access public
  ```
  Then offer to push `main`. CI must be green (build/typecheck/lint/vitest plus the `e2e-angular` job).

---

## Final review (opus)

The final reviewer gets the diff `$BASE..HEAD`, the spec, and this plan. They check:

- [ ] **Constraints.**
  - The never-edit `git diff --quiet $BASE..HEAD -- tests/playwright/e2e tests/playwright/playwright.{shared,react,svelte,vue}.config.ts packages/react packages/svelte packages/vue examples/react examples/svelte examples/vue examples/astro-xyflow` passes.
  - `git diff --quiet upstream/main -- tests/playwright/e2e` still passes.
  - `grep -rn "NgZone" packages/angular/src` finds nothing.
  - No CRLF churn: `git diff --stat $BASE..HEAD` has no file with an implausibly large line count, and `git diff $BASE..HEAD | grep -c $'\r'` is 0.
  - One commit per task, conventional subjects, both trailers on every commit (`git log --format=%B $BASE..HEAD | grep -c "Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W"` equals the commit count).
- [ ] **Ports.**
  - Every system-port commit body has `Ported from xyflow/xyflow#<PR> (<sha>)`.
  - Spot-check three hand-ports (#6064, #5998/#6084, #6119) against `git show <sha> -- packages/system`: same behaviour, angflow divergences intact (XYPanZoom `update()`/`destroy()`, the filter's `!userSelectionActive`, `setDevWarnSink`, the `store.ts` carry-overs).
- [ ] **Correctness hot spots.**
  - Shared fit promise: no promise left pending on any path (no panZoom, instant fit, rejection, superseded chains).
  - #6097: both halves present; dragging an unselected node while others are selected moves only that node.
  - #5915: `updateAbsolutePositions` has no cycle hazard and re-reads replaced lookup entries.
  - Edge labels: one `[data-id]` per edge; clicks on labels select; custom edges per Open question 3; layout label measurement still feeds `layoutNodes`.
  - `onPaneClick`: flag consumption can't swallow a genuine click (touch path).
  - Background: ids are unique per flow; the geometry decision is applied consistently.
  - Store detach: no remount regressions (callbacks re-installed by the next `<ng-flow>`).
- [ ] **Docs.**
  - `AGENT_BRIDGE.md` matches the handlers.
  - The mcp snapshot drift test passes.
  - The changelogs list every callout from spec WP7.
  - The report's §1/§2 statuses and SHAs are correct.
  - The re-owned D entries' reasons name the payload.
- [ ] **Exit criteria.**
  - Run `CI=true PATH="$SHIM:$PATH" corepack pnpm install --frozen-lockfile`, `PATH="$SHIM:$PATH" corepack pnpm build`, `PATH="$SHIM:$PATH" corepack pnpm typecheck`, `PATH="$SHIM:$PATH" corepack pnpm lint` and `PATH="$SHIM:$PATH" corepack pnpm test`.
  - Run `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests`, plus `build` and `build:zoneless`.
  - Run the full `test:angular` verdict, then once more with `--repeat-each=2` (run the same command line as `test:angular` with `--repeat-each=2` appended before `--reporter`) for stability.

**Done when** (spec):
- `pnpm --filter playwright test:angular` passes with only `owner: 'D'` entries left (the 2 colour-mode ones plus the 2 re-owned click-connect payload ones), and `check-known-failures` reports 0 STALE.
- CI is green on `main` (build/typecheck/lint/vitest + e2e).
- Versions are bumped, changelogs written, report and memory updated, and the publish commands handed to the user.
