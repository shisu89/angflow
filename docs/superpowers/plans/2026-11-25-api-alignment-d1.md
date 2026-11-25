# Upstream 1.0 API and callback alignment — Implementation Plan (sub-project D1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the breaking API and callback half of upstream `@xyflow/system` 1.0 / React 13 the way upstream did it. Renamed APIs are renamed and removed APIs are removed, with no deprecated aliases. After D1:
- `Handle` → `HandleBounds`, plus a new `NodeHandle` export (#5987);
- `getNodeConnections({ nodeId, type?, handleId? })` and `NodeConnection` replace `getHandleConnections` / `HandleConnection` (#6114);
- `nodeClickDistance` is gone and clicks are suppressed with `preventNextClick` (#5556). XYDrag binds once per element (#6168);
- `(connectEnd)`, `(clickConnectEnd)` and `(reconnectEnd)` carry a `FinalConnectionState` whose `to` is in flow coordinates, and so does `NgFlowService.connection()` (#6117);
- `paneDragThreshold` (default 1) gates pan and marquee start and replaces `paneClickDistance` (#6115);
- `fitView` / `fitBounds` resolve `boolean` (the rest of #6064). Numeric padding means pixels, and the default is `'5%'` (#5927).

The two `pane click cancels a pending connection` known failures (owner D) are fixed and removed.

**Release:** one final release, unpublished until the end of the roadmap: system 0.2.0, angular 0.4.0, mcp 0.1.0. The versions are bumped in Task 0, so every later changelog entry lands under its final heading.

**Architecture:**
- Every system change is a hand-port of one upstream PR, system paths only (Global Constraints, "Porting rule").
- The Angular store follows upstream React's `deriveConnection`: a writable `rawConnection` holds XYHandle's screen-space state, and `connection` is a read-only `computed` with `to` in flow coordinates.
- Click-connect end states come from one store helper, `FlowStore.getFinalClickConnectionState()`.
- The agent bridge keeps returning `{ zoom, clamped, ended }` from its fit tools. It measures the target with two new `@internal` service helpers, `measureFitView` / `measureFitBounds`, before it starts the fit.

**Tech stack:**
- `@angflow/system`: TypeScript, rollup, vitest + jsdom (`src/**/*.spec.ts` only).
- `@angflow/angular`: Angular 21 build, peer ≥19, signals, zoneless-first. Vitest runs through `@analogjs/vite-plugin-angular` in JIT mode, with `@angflow/system` aliased to `../system/src`. `tsc` also resolves `@angflow/system` to `../system/src` (`tsconfig.json` `paths`), so a system type change breaks angular `tsc` in the same commit unless the Angular call sites move with it.
- `@angflow/mcp`: tsx snapshot generator, vitest.
- `examples/angular`: `@angular/build:application`, plus `@angular/build:unit-test` (`ng test`) for `src/app/generic-tests/**/*.spec.ts`.
- The upstream Playwright suite in `tests/playwright`: `FRAMEWORK=ng`, `playwright.angular.config.ts`.
- pnpm 11 workspace.

**Spec:** `docs/superpowers/specs/2026-11-25-api-alignment-d1-design.md`. It is the contract. Its work order is kept; large items are split into consecutive tasks (table below).

**BASE:** `3b96f518e7dec53b78e87555280ffce7deb87cb3` (`3b96f518e docs: upstream 1.0 API alignment (sub-project D1) design`). The spec was verified at `b99aaa54a`; BASE adds only the spec. B (`343756d6a..adbb7bcca` and its follow-ups) and C (`d54d18f8d..b99aaa54a`) are on `main`, pushed and unpublished. This plan was written against the code as of BASE.

---

## Task map

| Task | Model | Spec item | Title | Upstream |
|---|---|---|---|---|
| 0 | haiku | 0 | Version bump and changelog merge | — |
| 1 | sonnet | 1 | `Handle` → `HandleBounds`, `NodeHandle` | #5987 `7b8d854ae` |
| 2 | sonnet | 2 | `getNodeConnections({ nodeId, type?, handleId? })`, `NodeConnection`, agent tool | #6114 `f9420bc45` |
| 3 | opus | 3 | `nodeClickDistance` removed, `preventNextClick` | #5556 `725baeb5f` |
| 4 | opus | 4 | XYDrag binds once per element | #6168 `d2bb47dc0` |
| — | — | — | **Checkpoint A** (4 known failures) | — |
| 5 | opus | 5 (1/3) | `to` in flow coordinates: XYHandle final state, `rawConnection` + derived `connection` | #6117 `63b6e0295` |
| 6 | opus | 5 (2/3) | Connect-event scope: click-connect fires no connect events, reconnect fires both | #6117 (upstream behaviour) |
| 7 | opus | 5 (3/3) | `(connectEnd)` / `(clickConnectEnd)` payloads; the two known failures removed | #6117 `63b6e0295` |
| — | — | — | **Checkpoint B** (2 known failures) | — |
| 8 | opus | 6 (1/2) | `paneDragThreshold` in XYPanZoom (pointer-drag state machine) and the Angular API rename | #6115 `d0338b48a` |
| 9 | opus | 6 (2/2) | Marquee waits for `paneDragThreshold`; `drag-threshold` example; touch matrix | #6115 `d0338b48a` |
| — | — | — | **Checkpoint C** (2 known failures) | — |
| 10 | sonnet | 7 | `fitView` / `fitBounds` resolve `boolean`; `measureFitView` / `measureFitBounds` | #6064 remainder |
| 11 | sonnet | 8 | Numeric fit padding is pixels, default `'5%'`; agent schema units | #5927 `82e24caf8` |
| 12 | sonnet | 9 | Release docs: changelogs, migration guide, report | — |
| — | — | — | **Final checkpoint**, then **Final review** | — |

---

## Spec deviations

The spec stays the contract. In the places below, the code differs from what the spec says, so the plan follows the code as described. Each affected task restates the deviation it relies on.

1. **#6115's start-handler guard is not from `7976e13e7`.**
   - Upstream's `createPanZoomStartHandler` opens with `if (!sourceEvent || sourceEvent.internal) return;`. Both that guard and `XYFlowSourceEvent` came from `af9cf831e` ("Enable all linting rules"). `7976e13e7` touches only `utils/graph.ts`.
   - Angflow's guard is `if (event.sourceEvent?.internal) return;`. A programmatic transition (null `sourceEvent`) therefore still calls `onPanZoomStart` (angflow's `(moveStart)`) and sets `isZoomingOrPanning`. `update()`'s user-selection pause depends on the latter.
   - The spec keeps angflow's `event: any` typing and doesn't port the typing commit. **Task 8 keeps angflow's guard too**, and pins it with a test (`eventhandler.spec.ts`, "programmatic transitions").
2. **Item 1 misses one file.** `packages/angular/src/lib/services/flow-store.service.spec.ts` also imports `type Handle` (~:7, used ~:711). Task 1 updates it as the fourth spec.
3. **Item 5's derived `connection` breaks three test fixtures.**
   - The upstream-exact computed `raw.inProgress ? { ...raw, to: pointToRendererPoint(raw.to, transform) } : raw` throws on a partial in-progress state that has no `to`. Two fixtures write one:
     - `flow-store.gesture.spec.ts` `'is true while a connection is in progress'` writes `{ inProgress: true }`;
     - `flow-store.service.spec.ts` (~:53, the `reset()` test) writes `{ ...initialConnection, inProgress: true }`, whose `to` is `null`.
     Task 5 gives both a full in-progress fixture. The computed stays upstream-exact.
   - `click-connect-preview.service.spec.ts` asserts `expect(store.connection()).toBe(drag)` twice (~:107, :111). A computed returns a new object, so those assertions read `store.rawConnection()` instead.
   - `flow-store.service.spec.ts` `'updates connection.from when dragging the fromNode…'` replaces `store.updateConnection` with a spy and then writes the state. It must seed the state with the real `updateConnection` first.
4. **Item 5 is three tasks, and the event-scope change comes first.**
   - Task 6 changes which interactions fire `(connectStart)`/`(connectEnd)` before Task 7 changes the payload types.
   - Reversed, Task 7 would have to add a state argument to the click-connect `onConnectEnd` calls that Task 6 then deletes.
   - In Task 6, reconnect's XYHandle `onConnectEnd(evt, state)` already fits today's 1-argument store slot, so every commit typechecks.
5. **Item 6 is two tasks.**
   - Task 8 does the system hand-port and the Angular API rename. Until Task 9, the marquee still starts on pointerdown.
   - Task 9 adds the marquee threshold.
   - The spec says the rect is drawn only after the crossing. Task 9 therefore also stops writing the zero-size `userSelectionRect` on pointerdown, and emits `(selectionEnd)` only after a crossing.
6. **Item 7's `zoom` sentinel stays `NaN` in-process (Open question 2).**
   - The spec writes `zoom: m?.zoom ?? null` and wants the bridge's fit result tests to "pass unchanged".
   - `'fit_view returns { zoom, clamped }'` (`agent-bridge.spec.ts` ~:2193) asserts `typeof res.zoom === 'number'` through the in-process `callTool`, so `null` would break it.
   - Today's `FitViewResult.zoom` is `NaN`, which JSON serialises to `null`. The plan uses `m?.zoom ?? NaN`. That keeps both the in-process value and the wire bytes identical to today.
7. **Item 7's measure-first changes one edge case (Open question 3).**
   - Today, overlapping fits share one `FitViewResult`, so a superseded `fit_view` reports the *last* fit's zoom.
   - Measuring before the fit gives each call its own target `zoom`/`clamped`. `ended` stays shared.
   - The plan accepts this and documents it in `AGENT_BRIDGE.md`.
8. **Item 8 has one more numeric-padding user.** `packages/angular/examples/controlled-flow.example.ts` (~:106, `fitView({ padding: 0.2 })`) is not compiled by any build. Task 11 changes it to `'10%'` so the docs example keeps its framing.
9. **Report §3 has no Status column.** Task 12 appends `**D1 ✓** <shas>` to each row's last cell ("Non-breaking path?") instead of adding a column.
10. **Checkpoints.** The spec says every item gets a full checkpoint. The plan runs the full checkpoint four times: after Task 4, Task 7, Task 9 and Task 12. Every task's own verify step still runs the vitest suites it touches, `tsc`, root lint and its focused e2e specs.
11. **Pin tests.** A few tests the spec lists pass both before and after their change. They are kept as pins:
    - `getEdgePosition` through `parseHandles`;
    - XYDrag's released-outside and threshold-from-press cases;
    - the bridge's interrupted-fit target.

    Each task names the tests that do fail first.

## Open questions

Each has a default, and the plan implements the default. Answer before the named task if you want the alternative.

1. **`reconnectingEdgeId` timing (Task 6).**
   - Today `EdgeRendererComponent.handleEdgeReconnect` sets `reconnectingEdgeId` on pointerdown, and only `onReconnectEnd` clears it.
   - XYHandle calls `onReconnectEnd` only after the connection started (`connectionStarted`). A press on a reconnect anchor that never crosses `connectionDragThreshold` therefore hides the edge (`@if (reconnectingEdgeId() !== edge.id)`) until the next reconnect.
   - Upstream sets `setReconnecting(true)` inside `_onConnectStart` (`EdgeUpdateAnchors.tsx`).
   - **Default:** move `reconnectingEdgeId.set(edge.id)` into the same `onConnectStart` callback as `(reconnectStart)`.
   - **Alternative:** keep it on pointerdown.
2. **Agent fit `zoom` sentinel (Task 10).**
   - **Default:** `NaN` in-process, `null` on the wire, as today (Spec deviation 6).
   - **Alternative:** the spec's literal `null`. The in-process `callTool` would then return `null`, and the `typeof res.zoom` assertion would change.
3. **Overlapping agent fits (Task 10).**
   - **Default:** `zoom`/`clamped` are each call's own target, measured before its fit starts. `ended` is shared, and is the last fit's (Spec deviation 7).
   - **Alternative:** re-measure after the `await`. That reports the last fit's target, but a graph change during the animation would then change the reported zoom.
4. **Upstream Pane's `resetSelectedElements()` at the threshold crossing (Task 9).**
   - **Default:** not ported. The spec doesn't list it, and angflow's marquee selection semantics stay as they are.
   - **Alternative:** port it with the crossing.
5. **Agent `padding: null` (Task 11).**
   - **Default:** treated as omitted (the default padding), as today.
   - **Alternative:** `-32602`.
6. **The real-device row of the touch matrix (Task 9).**
   - **Default:** the implementer runs the Chrome DevTools touch-emulation matrix, and records the real-device row as "pending (user)" in the D1 results. The user fills it in before release.
   - **Alternative:** block Task 12 on it.

## Global Constraints

- **Never edit** these. Verify before every commit with `git diff --quiet HEAD -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts packages/react packages/svelte packages/vue examples/react examples/svelte examples/vue examples/astro-xyflow` (exit 0).
  - `tests/playwright/e2e/**`
  - `tests/playwright/playwright.{shared,react,svelte,vue}.config.ts`
  - `packages/{react,svelte,vue}/**`
  - `examples/{react,svelte,vue,astro-xyflow}/**` (the React examples are the reference you port *from*)

  Never edit a spec to make it pass. Fix the library, or the Angular examples-app page. `tests/playwright/known-failures.ng.ts` changes in exactly two places:
  - Task 7 deletes the two `pane click cancels a pending connection` entries;
  - Task 12 rewords the two colour-mode entries' `reason` to name D2 (`owner` stays `'D'`).
- **Breaking-change policy: match upstream fully.** Don't add deprecated aliases, overloads or no-op inputs for anything D1 renames or removes. Examples: no `SystemHandle` alias, no `getHandleConnections` overload, no `paneClickDistance` input.
- **Porting rule.**
  - Port one upstream change per commit, system paths only.
  - Start with `git diff <merge>^1 <merge> -- packages/system | git apply --check`. The spec verified that this fails for every D1 merge, which means a hand-port.
  - Read the upstream diff and the upstream file at `<merge>` (`git show <merge>:packages/system/src/<path>`), then edit angflow's file by hand. If one file's hunk does apply cleanly on its own (`git diff <merge>^1 <merge> -- <that file> | git apply --check`), apply it with **plain `git apply`, not `git apply -3`**. In this working tree `-3` fails after CRLF normalisation.
  - Never `git cherry-pick` and never port wholesale: a cherry-pick drags in React/Svelte/Vue hunks and `.changeset` files.
  - Every system-port commit body has `Ported from xyflow/xyflow#<PR> (<sha>)`.
- **Keep angflow's deliberate system divergences:**
  - `XYPanZoom`'s no-teardown `update()` and `.zoom`-stripping `destroy()`;
  - pan/zoom handlers re-created only when `!userSelectionActive`;
  - the filter's `!userSelectionActive` middle-button guard;
  - the start handler's `event.sourceEvent?.internal` guard (Spec deviation 1);
  - `setDevWarnSink`;
  - `store.ts`'s carry-overs;
  - `getFitViewNodes`' size fallback;
  - XYDrag's abort path (rAF cancel plus the `dragging: false` reset) and its `sourceEvent.type === 'touchmove'` multitouch check (not upstream's `isTouchEvent`);
  - B's #6097 drag-item changes (`isUnselectedNodeDrag`);
  - angflow's `event: any` typing (no `XYFlowSourceEvent`, no XYDrag generics).

  `FitViewResult` as an object is **dropped** by D1 (Task 10).
- **Zoneless rules (CLAUDE.md):**
  - never inject `NgZone`;
  - event handlers from outside Angular drive views by writing signals the template reads;
  - timers are fine for scheduling, never for forcing change detection. `preventNextClick`'s `setTimeout(0)` schedules logic and is allowed;
  - APIs used must exist in Angular 19 (the peer range);
  - `DOCUMENT` comes from `@angular/common`.
- **Build order and the Angular cache.**
  - `examples/angular` and the e2e suite consume both packages through `dist/`. After any library change, rebuild system, then angular.
  - **Then, before any e2e run, example build or examples `ng test`, delete the Angular CLI cache: `rm -rf examples/angular/.angular/cache`.** In B, a stale cache served the old build after a rebuild. Delete it every time.
  - **Before every e2e run, stop any server still listening on port 4201** (`fuser -k 4201/tcp 2>/dev/null || true`). Playwright's `webServer` reuses an existing server on that port, so a stale `ng serve` from an earlier run, or one started by hand, would serve the old build.
  - Angular vitest and angular `tsc` read `../system/src` directly, so they need no rebuild.
- **Line endings.** This working tree may be checked out CRLF (the index is LF; `git ls-files --eol` shows `i/lf w/crlf`).
  - Before editing *or applying a patch to* a file, normalise it: `sed -i 's/\r$//' <file…>`. Git still reports the file unchanged, because its content now equals the index.
  - New files are LF.
  - Before every commit, check `git diff --stat`. A file whose changed-line count is about its total length is CRLF churn: normalise it and redo the edit.
- **pnpm isn't on PATH. Rule: every `corepack pnpm …` invocation runs with the shim on PATH, written `PATH="$SHIM:$PATH" corepack pnpm …`.** Preflight creates `$SHIM`.
  - The root scripts (`build`, `lint`, `typecheck`, `test`) and Playwright's `webServer` call a bare `pnpm` internally, so `corepack pnpm` alone isn't enough.
  - Every command in this plan already carries the prefix; keep it when you adapt one.
  - `npx …` and `uvx …` need no shim.
  - Non-interactive installs also need `CI=true`.
  - Shell state doesn't persist between commands, so the prefix goes on each command.
- **Focused e2e runs need `FRAMEWORK=ng`**, together with `-c playwright.angular.config.ts` and `--project=chromium`. Without it the specs build `react-flow__*` selectors and every locator misses.
- **Visual and manual checks are time-boxed.**
  - Spend at most 10 minutes on a screenshot or a manual look in the example app.
  - Task 9's touch matrix is the exception, with at most 20 minutes.
  - Don't build pixel-measurement tooling: when a vitest or e2e assertion can say it, write that instead.
- **Lint is part of every verify step.**
  - Run `PATH="$SHIM:$PATH" corepack pnpm lint` from the root in each task's verify step and in each checkpoint.
  - In B, an unused import got through the task reviews. Watch for now-unused imports after removals: `Optional` in `types/nodes.ts`, `HandleConnection`, `FitViewResult`, `isNumeric`, `isRightClickPan`, `pointToRendererPoint` / `rendererPointToPoint` in the pane.
  - Angular non-spec files forbid `any` (`@typescript-eslint/no-explicit-any: error`). Unused variables must start with `_`.
- **Codespell runs in CI** (`.github/workflows/codespell.yml`, the stock action reading `.codespellrc`) on every file, specs included.
  - It lower-cases whole words without splitting camelCase, so an identifier that concatenates into a known misspelling fails CI. b99aaa54a had to rename a test variable made of the article "a" plus `Parent`, because codespell read it as a misspelling of "apparent". (This plan can't spell such words out: they would fail codespell here too.)
  - Avoid a single lowercase letter in front of a capitalised word (`a`/`o` + `Parent`/`Node`/`Ne`…), and two-letter abbreviations that are common typos of short English words ("to", "and", "the", "use", "of"). Prefer full words: `parentNode`, `first`, `edgeA`.
  - `.codespellrc` already ignores `currenty`, `alledges`, `doubleclick` and a few others. Don't extend that list to make your own identifier pass: rename the identifier.
  - Before every commit, run `uvx codespell <every file you changed or added>` from the repo root. Expected: no output.
- **Agent bridge:**
  - Any change to a tool's params, return shape, or behaviour updates `packages/angular/AGENT_BRIDGE.md` in the same commit.
  - Any change to `tool-schemas.ts` regenerates the mcp snapshot in the same commit: `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/mcp run generate:schemas`. The `packages/mcp` drift test (`test/schema-snapshot.spec.ts`) fails otherwise.
  - From Task 0 on, the stamp is `GENERATED_FROM_ANGULAR_VERSION = "0.4.0"`.
  - The in-browser chat harness reads `AGENT_TOOL_SCHEMAS` at runtime, so it needs no regeneration.
- **Changelogs.** Tasks 1–11 don't edit `CHANGELOG.md` files: Task 12 writes all of D1's entries from the commits. Put whatever a release note needs into your commit body.
- **Known failures.** The checkpoint verdict expects:
  - before Task 7: `known failures: 4 entries`, all `owner: 'D'` (2 click-connect payload, 2 colour-mode);
  - from Task 7 on: `known failures: 2 entries` (the 2 colour-mode ones);
  - always: `STALE (now passing): 0`, `NOT MATCHED: 0`, `WRONG FILE: 0`, `chromium failures: 0`.

  A partial run (single spec) can't use the checker, so focused runs use the blocking `chromium` project only.
- **Commits:** trunk-based on `main`, one commit per task.
  - Stage explicit paths only (`git add <paths>`), never `git add -A`.
  - Never touch or commit unrelated working-tree changes: run `git status --short` before staging.
  - Conventional-commit subjects; a breaking change carries `!`.
  - Every message ends with exactly these two lines:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
    ```
  - Use `git commit -F- <<'EOF' … EOF` so the trailers survive intact.
  - Subagents use exactly these two trailers, not whatever attribution their own harness suggests. The `Claude Opus 5.5` name is intentional and correct.
- **Locate code by symbol.**
  - Line numbers in this plan are as of BASE and are hints only.
  - Every location also names a symbol: a method, a field, a `describe`/`it` title or a tool name. Find code by that.
  - Once an earlier task has edited a file, a later task's `:NNN` is only approximate.
- **Model tiers** are given in each task heading (workflow preference):
  - haiku: a mechanical 1–2-file change with complete instructions;
  - sonnet: multi-file or integration work;
  - opus: high-risk work (#5556/#6168, #6117, #6115).
- **Self-contained tasks.** A task's implementer sees only its task, these Global Constraints and the two subsections below ("Commands used throughout", "Test helper: `flush`"). Every Spec deviation and Open-question default that a task relies on is restated inside that task. If the two ever disagree, the task text wins and the reviewer flags it.

### Commands used throughout (part of Global Constraints)

```bash
# Build (from repo root), then drop the Angular CLI cache before e2e / example builds / examples ng test
PATH="$SHIM:$PATH" corepack pnpm -F @angflow/system build && PATH="$SHIM:$PATH" corepack pnpm -F @angflow/angular build && rm -rf examples/angular/.angular/cache

# vitest, one file (from the package dir)
cd packages/system  && npx vitest run src/<path>.spec.ts
cd packages/angular && npx vitest run src/lib/<path>.spec.ts

# Typecheck: the angular package (includes its spec files), then all three
cd packages/angular && npx tsc --noEmit
PATH="$SHIM:$PATH" corepack pnpm typecheck

# Lint (root; all three packages)
PATH="$SHIM:$PATH" corepack pnpm lint

# Codespell (root; list the files you touched)
uvx codespell <files…>

# Examples unit tests (generic-test host; needs the build + cache drop first)
PATH="$SHIM:$PATH" corepack pnpm -F angular-examples exec ng test --watch=false --include='src/app/generic-tests/**/*.spec.ts'

# Stop a stale ng serve first: Playwright reuses whatever already listens on 4201
fuser -k 4201/tcp 2>/dev/null || true

# One e2e spec, blocking project only (from tests/playwright; Playwright starts ng serve on 4201)
cd tests/playwright && PATH="$SHIM:$PATH" FRAMEWORK=ng npx playwright test -c playwright.angular.config.ts e2e/<spec>.spec.ts --project=chromium

# Full verdict (chromium + ng-known-failures + check-known-failures.mjs), from repo root
PATH="$SHIM:$PATH" corepack pnpm --filter playwright test:angular

# mcp snapshot
PATH="$SHIM:$PATH" corepack pnpm -F @angflow/mcp run generate:schemas
cd packages/mcp && npx vitest run test/schema-snapshot.spec.ts
```

### Test helper: `flush` (part of Global Constraints)

`preventNextClick` removes its listener after `setTimeout(0)`, and the deletion paths are async. A `setTimeout(0)` drains every microtask and every earlier zero-delay timer before it fires.
```ts
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
```
- No shared test-utils module exists. Declare `flush` at the top of each spec file that uses it. In D1 that is `XYDrag.spec.ts` and `drag.directive.spec.ts`.
- Make sure `vi` is in that file's `vitest` import.
- Don't use `flush` under `vi.useFakeTimers()`. `eventhandler.spec.ts` uses fake timers and `vi.runAllTimers()` instead.

---

## Preflight (no commit)

- [ ] **Step 1: Base and remotes.**
  1. `git status --short` should be empty, or contain only changes you will leave alone.
  2. Check that `git rev-parse HEAD` is `3b96f518e7dec53b78e87555280ffce7deb87cb3`. If it isn't, record the actual value as `BASE` and tell the reviewer.
  3. Run `git fetch upstream`.
  4. Confirm that `git rev-parse 7b8d854ae f9420bc45 725baeb5f d2bb47dc0 63b6e0295 d0338b48a 82e24caf8 upstream/main` resolves.
- [ ] **Step 2: pnpm shim.** Pick a scratch dir (your session scratchpad), e.g. `SHIM=<scratch>/pnpm-shim`. Then run `mkdir -p "$SHIM" && corepack enable pnpm --install-directory "$SHIM" && PATH="$SHIM:$PATH" pnpm --version`. Expected: `11.21.0`.
- [ ] **Step 3: Codespell.** Run `uvx codespell --version` (any version). Then run `uvx codespell docs/superpowers/plans/2026-11-25-api-alignment-d1.md`. Expected: no output.
- [ ] **Step 4: Baseline.**
  - Build both packages and `rm -rf examples/angular/.angular/cache`, then run the full verdict. Expected:
    - `known failures: 4 entries`
    - `NOT MATCHED: 0`
    - `WRONG FILE: 0`
    - `STALE (now passing): 0`
    - `chromium failures: 0`
    - `verdict: OK`
  - Run `PATH="$SHIM:$PATH" corepack pnpm test` from the root: all three vitest suites are green.
  - Run `PATH="$SHIM:$PATH" corepack pnpm lint`: clean.
- [ ] **Step 5: Hand-port confirmation.** For each merge `7b8d854ae f9420bc45 725baeb5f d2bb47dc0 63b6e0295 d0338b48a 82e24caf8`, run `git diff <m>^1 <m> -- packages/system | git apply --check`. Expected: every one fails (spec "Starting point"). If one applies cleanly, tell the reviewer; that task may then apply it with plain `git apply` and only adapt the result.

---

## Tasks

### Task 0 (haiku): Version bump and changelog merge

No code change. Nothing is published.

**Files:**
- Modify: `packages/system/package.json`, `packages/angular/package.json`, `packages/mcp/package.json` (the `"version"` line only)
- Modify: `packages/system/CHANGELOG.md`, `packages/angular/CHANGELOG.md`, `packages/mcp/CHANGELOG.md` (the top entry's heading and intro)
- Regenerate: `packages/mcp/src/generated/tool-schemas.ts` (stamp only)

- [ ] **Step 1: Normalise** all seven files.
- [ ] **Step 2: Check the starting values.** Run `grep -n '"version"' packages/{system,angular,mcp}/package.json` and `grep -n GENERATED_FROM_ANGULAR_VERSION packages/mcp/src/generated/tool-schemas.ts`. Expected: `0.1.14`, `0.3.22`, `0.0.4`, and the stamp `"0.3.22"`.
- [ ] **Step 3: Bump.** Run `npm version minor --no-git-tag-version` in each of `packages/system`, `packages/angular` and `packages/mcp`. Expected: `v0.2.0`, `v0.4.0`, `v0.1.0`.
  - If `npm version` errors in a package (for example on the `workspace:` specifiers), edit that package's `"version"` line by hand instead.
  - Either way, `git diff packages/*/package.json` must show exactly one changed line per file.
  - No lockfile changes: `git status --short` lists no `pnpm-lock.yaml`.
- [ ] **Step 4: Changelogs.** In each file, the unreleased top entry becomes the body of the new heading:
  - `packages/system/CHANGELOG.md`:
    - rename `## 0.1.14` to `## 0.2.0 *(unreleased)*`;
    - directly under it, insert `### Breaking changes` followed by the line `<!-- D1: filled in by the release-docs task (Task 12). -->` and a blank line;
    - keep every existing subsection below it unchanged.
  - `packages/angular/CHANGELOG.md`:
    - rename `## 0.3.22` to `## 0.4.0 *(unreleased)*`;
    - replace the intro line `Bug-fix release. Requires \`@angflow/system\` 0.1.14.` with `Requires \`@angflow/system\` 0.2.0. Contains the unreleased 0.3.22 bug-fix (B) and deletion (C) entries, plus the upstream 1.0 API alignment (D1), whose breaking changes come first.`;
    - insert the same `### Breaking changes` heading and placeholder comment directly above `### Added (additive API)`.
  - `packages/mcp/CHANGELOG.md`:
    - rename `## 0.0.4` to `## 0.1.0 *(unreleased)*`;
    - change "regenerated from @angflow/angular 0.3.22" to "regenerated from @angflow/angular 0.4.0";
    - insert the `### Breaking changes` heading and placeholder comment directly under the heading, above that paragraph.
- [ ] **Step 5: Snapshot.** Run `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/mcp run generate:schemas`.
  - `git diff packages/mcp/src/generated/tool-schemas.ts` shows only the two `0.3.22` → `0.4.0` stamp lines (the header comment and the constant).
  - `cd packages/mcp && npx vitest run` is green.
- [ ] **Step 6: Verify.**
  - Run `PATH="$SHIM:$PATH" corepack pnpm lint`.
  - Run `uvx codespell` on the seven files.
  - Run `git diff --stat`: seven files, small counts.
- [ ] **Step 7: Commit.**
  ```bash
  git add packages/system/package.json packages/angular/package.json packages/mcp/package.json \
    packages/system/CHANGELOG.md packages/angular/CHANGELOG.md packages/mcp/CHANGELOG.md \
    packages/mcp/src/generated/tool-schemas.ts
  git commit -F- <<'EOF'
  chore(release): start system 0.2.0 / angular 0.4.0 / mcp 0.1.0 (unreleased)

  Bump the versions at the start of D1 so every later changelog entry lands
  under its final heading. The unreleased 0.1.14 / 0.3.22 / 0.0.4 entries
  (B and C) become the bodies of 0.2.0 / 0.4.0 / 0.1.0, each with an empty
  "Breaking changes" section for D1. The mcp snapshot is stamped 0.4.0.
  Nothing is published.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 1 (sonnet): `Handle` → `HandleBounds`, `NodeHandle` (#5987)

Upstream merge `7b8d854ae`. Hand-port (Porting rule).

Restated decisions this task relies on:
- **No alias.** `Handle` (system) and `SystemHandle` (angular) disappear. `HandleBounds` and `NodeHandle` are exported.
- **Spec deviation 2:** `flow-store.service.spec.ts` is a fourth spec file that imports `Handle`.
- Keep angflow's extra `HandleBounds` fields `data?: unknown` and `floating?: boolean`.
- The removed `toHandleBounds` fallback is dead code: angflow's `parseHandles` (`utils/store.ts`) always fills `internals.handleBounds` when `node.handles` is set.

**Files (system):**
- Modify: `packages/system/src/types/handles.ts` (`export type Handle`)
- Modify: `packages/system/src/types/nodes.ts` (`NodeHandleBounds`, `NodeHandle`, the `Optional` import)
- Modify: `packages/system/src/types/general.ts` (the import; `ConnectionInProgress.fromHandle` / `.toHandle`)
- Modify: `packages/system/src/utils/dom.ts` (`getHandleBounds` return type)
- Modify: `packages/system/src/utils/store.ts` (the import; `parseHandles`)
- Modify: `packages/system/src/utils/edges/positions.ts` (`getEdgePosition`, delete `toHandleBounds`, `getHandlePosition`, `getHandle`)
- Modify: `packages/system/src/xyhandle/types.ts`, `packages/system/src/xyhandle/utils.ts`, `packages/system/src/xyhandle/XYHandle.ts`
- Create: `packages/system/src/utils/edges/positions.spec.ts`

**Files (angular):**
- Modify: `packages/angular/src/lib/public-api.ts` (the `// Handle types` block of the system type re-export)
- Modify: `packages/angular/src/lib/types/edges.ts` (the import; `fromHandle`, `toHandle`)
- Modify: the five built-in edges, `packages/angular/src/lib/components/edges/{bezier,simple-bezier,smooth-step,step,straight}-edge.component.ts` (the import; the `sourceHandle` / `targetHandle` inputs)
- Modify (specs): `components/connection-line/connection-line.component.spec.ts`, `container/edge-renderer/edge-renderer.memo.spec.ts`, `container/edge-renderer/edge-renderer.data-enrichment.spec.ts`, `services/flow-store.service.spec.ts`
- Modify: `examples/angular/src/app/examples/typed-handles/typed-handles.component.ts` (`SystemHandle` import and its three uses)

- [ ] **Step 1: Normalise** every file above (except the new one).
- [ ] **Step 2: Failing checks.**
  - In the four Angular spec files, change `type Handle` to `type HandleBounds` in the `@angflow/system` import and every `Handle` type use in that file. Leave `Position` etc. alone.
  - Run `cd packages/angular && npx tsc --noEmit`. Expected: `Module '"@angflow/system"' has no exported member 'HandleBounds'`.
  - Create `positions.spec.ts`:
    ```ts
    import { describe, it, expect, vi } from 'vitest';
    import { getEdgePosition } from './positions';
    import { adoptUserNodes } from '../store';
    import {
      ConnectionMode,
      Position,
      type InternalNodeBase,
      type NodeBase,
      type NodeLookup,
      type ParentLookup,
    } from '../../types';

    function lookup(nodes: NodeBase[]): NodeLookup<InternalNodeBase<NodeBase>> {
      const nodeLookup = new Map() as NodeLookup<InternalNodeBase<NodeBase>>;
      adoptUserNodes(nodes, nodeLookup, new Map() as ParentLookup<InternalNodeBase<NodeBase>>);
      return nodeLookup;
    }

    // User-declared handles, no measured DOM: width/height are left out on purpose.
    const declared = (id: string, x: number): NodeBase => ({
      id,
      position: { x, y: 0 },
      data: {},
      width: 100,
      height: 40,
      handles: [
        { type: 'source', position: Position.Right, x: 100, y: 20 },
        { type: 'target', position: Position.Left, x: 0, y: 20 },
      ],
    });

    describe('getEdgePosition with user-declared handles (#5987)', () => {
      it('positions an edge from node.handles through parseHandles', () => {
        const l = lookup([declared('a', 0), declared('b', 300)]);
        const pos = getEdgePosition({
          id: 'e', sourceNode: l.get('a')!, sourceHandle: null, targetNode: l.get('b')!, targetHandle: null,
          connectionMode: ConnectionMode.Strict,
        });
        // parseHandles gives a declared handle a 1x1 box.
        expect(pos).toEqual({
          sourceX: 101, sourceY: 20.5, targetX: 300, targetY: 20.5,
          sourcePosition: Position.Right, targetPosition: Position.Left,
        });
      });

      it('has no toHandleBounds fallback: without internals.handleBounds there is no position, and node.handles is not mutated', () => {
        const l = lookup([declared('a', 0), declared('b', 300)]);
        const a = l.get('a')!;
        const bare = { ...a, internals: { ...a.internals, handleBounds: undefined } } as InternalNodeBase;
        const onError = vi.fn();
        const pos = getEdgePosition({
          id: 'e', sourceNode: bare, sourceHandle: null, targetNode: l.get('b')!, targetHandle: null,
          connectionMode: ConnectionMode.Strict, onError,
        });
        expect(pos).toBeNull();
        expect(onError).toHaveBeenCalledWith('008', expect.any(String));
        expect(bare.handles![0].width).toBeUndefined();
      });
    });
    ```
    - Before you run it, check the first test's numbers against `getHandlePosition` (same file). A `Position.Right` handle adds its width to `x` and half its height to `y`; a `Position.Left` handle adds only half its height. If the arithmetic differs, assert what the function computes for a 1×1 handle, exactly (never `toBeTruthy`).
    - Run `cd packages/system && npx vitest run src/utils/edges/positions.spec.ts`. Expected:
      - the first test passes (a pin: `parseHandles` already fills `handleBounds`);
      - the second fails: the fallback returns a position and sets `width = 1`.
- [ ] **Step 3: System hand-port.** Read `git diff 7b8d854ae^1 7b8d854ae -- packages/system`.
  - `types/handles.ts`: rename `export type Handle` to `export type HandleBounds`. Add upstream's JSDoc ("Measured position and size of a handle relative to the node", `@public`). Keep `data?` and `floating?` with their comments.
  - `types/nodes.ts`:
    - `NodeHandleBounds` uses `HandleBounds[]`, with upstream's JSDoc;
    - `NodeHandle` becomes `Omit<HandleBounds, 'nodeId' | 'width' | 'height'> & { width?: number; height?: number }`, with upstream's JSDoc;
    - drop the `Optional` import if nothing else uses it.
  - `types/general.ts`, `utils/dom.ts`, `utils/store.ts`, `xyhandle/types.ts`, `xyhandle/utils.ts`, `xyhandle/XYHandle.ts`: rename every *type* use of `Handle`. Find them with `grep -rnw Handle packages/system/src --include=*.ts`. Don't touch:
    - the `xyresizer/types.ts` enum member `Handle = 'handle'`;
    - error/aria strings;
    - comments.
  - `utils/edges/positions.ts`:
    - `sourceHandleBounds = sourceNode.internals.handleBounds` (same for the target), with no `|| toHandleBounds(...)`;
    - delete `toHandleBounds`;
    - retype `getHandlePosition` and `getHandle`;
    - fix the imports as upstream (`type HandleBounds, type InternalNodeBase` from `../../types`; drop the `NodeHandle` import).
  - Check: `grep -rnw "Handle" packages/system/src --include=*.ts | grep -v "xyresizer\|'Handle\|Handle:"` shows no type use.
- [ ] **Step 4: Angular.**
  - `public-api.ts`: replace `Handle as SystemHandle,` with `HandleBounds,` and add `NodeHandle,` in the `// Handle types` block.
  - `types/edges.ts`: `HandleBounds` in the import and in `fromHandle` / `toHandle`.
  - The five edge components: `type HandleBounds` in the import; `input<HandleBounds | null>(null)` for `sourceHandle` and `targetHandle`.
  - `typed-handles.component.ts`: `SystemHandle` → `HandleBounds` (import and three inputs).
  - Run `grep -rn "SystemHandle\|type Handle\b\|<Handle\b\|: Handle\b" packages/angular/src examples/angular/src`. Expected: nothing.
- [ ] **Step 5: Verify.**
  - `cd packages/system && npx vitest run`, and `PATH="$SHIM:$PATH" corepack pnpm -F @angflow/system typecheck`.
  - `cd packages/angular && npx tsc --noEmit && npx vitest run src/lib/components/connection-line src/lib/container/edge-renderer src/lib/services/flow-store.service.spec.ts`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages, drop the cache, then run `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build` (the `typed-handles` example compiles).
- [ ] **Step 6: Commit.**
  ```bash
  git add packages/system/src/types/handles.ts packages/system/src/types/nodes.ts packages/system/src/types/general.ts \
    packages/system/src/utils/dom.ts packages/system/src/utils/store.ts packages/system/src/utils/edges/positions.ts \
    packages/system/src/utils/edges/positions.spec.ts packages/system/src/xyhandle/types.ts \
    packages/system/src/xyhandle/utils.ts packages/system/src/xyhandle/XYHandle.ts \
    packages/angular/src/lib/public-api.ts packages/angular/src/lib/types/edges.ts \
    packages/angular/src/lib/components/edges/bezier-edge.component.ts \
    packages/angular/src/lib/components/edges/simple-bezier-edge.component.ts \
    packages/angular/src/lib/components/edges/smooth-step-edge.component.ts \
    packages/angular/src/lib/components/edges/step-edge.component.ts \
    packages/angular/src/lib/components/edges/straight-edge.component.ts \
    packages/angular/src/lib/components/connection-line/connection-line.component.spec.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.memo.spec.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.data-enrichment.spec.ts \
    packages/angular/src/lib/services/flow-store.service.spec.ts \
    examples/angular/src/app/examples/typed-handles/typed-handles.component.ts
  git commit -F- <<'EOF'
  refactor!: rename the Handle type to HandleBounds; export NodeHandle (#5987)

  System: Handle -> HandleBounds (angflow's data/floating fields kept),
  NodeHandle redefined as upstream, and the dead toHandleBounds fallback in
  getEdgePosition removed (it also mutated node.handles). Angular: public-api
  exports HandleBounds and NodeHandle and drops the SystemHandle alias; the
  five built-in edges type their handle inputs as HandleBounds.

  Ported from xyflow/xyflow#5987 (7b8d854ae)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 2 (sonnet): `getNodeConnections({ nodeId, type?, handleId? })` and `NodeConnection` (#6114)

Upstream merge `f9420bc45`. Hand-port. `getConnectionLookupKey` and `getConnectionsFromLookup` are copied verbatim from `git show f9420bc45:packages/system/src/utils/connections.ts`.

Restated decisions this task relies on:
- **No overloads or aliases.** `getHandleConnections`, `selectHandleConnections`, `HandleConnection` and the `get_handle_connections` tool are removed.
- `NgFlowService.getNodeConnections` and `selectNodeConnections` share one params shape. Angular has no `onConnect`/`onDisconnect` hook variant.
- **Agent:** `get_node_connections` gains optional `type` and `handleId`. A `handleId` without a `type` is `-32602`: upstream's key would silently ignore it, and an agent would misread that as "no connections". Removing a tool leaves 57 schemas, which still passes the snapshot test's `>= 51` check.

**Files:**
- Modify: `packages/system/src/types/general.ts` (delete `HandleConnection`; `UseNodeConnectionsParams` callbacks, if present; `ConnectionLookup`)
- Modify: `packages/system/src/utils/connections.ts` (types; add the two functions)
- Modify: `packages/system/src/utils/store.ts` (import; `addConnectionToLookup`)
- Create: `packages/system/src/utils/connections.spec.ts`
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`getHandleConnections`, `getNodeConnections`, `selectNodeConnections`, `selectHandleConnections`; imports)
- Modify: `packages/angular/src/lib/types/general.ts` (`NgFlowInstance` connection queries ~:177-178; the `HandleConnection` import)
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`connectionLookup` field type ~:343)
- Modify: `packages/angular/src/lib/public-api.ts` (drop `HandleConnection,`)
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`get_node_connections` and `get_handle_connections` handlers ~:821-835)
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (`get_node_connections`, delete `get_handle_connections` ~:459-485)
- Modify: `packages/angular/AGENT_BRIDGE.md` (rows ~:125-126)
- Regenerate: `packages/mcp/src/generated/tool-schemas.ts`
- Modify: `README.md` (~:184, the `useNodeConnections()` / `useHandleConnections()` row)
- Modify: `examples/angular/src/app/generic-tests/overrides/nodes/components/connection-updates-node.component.ts` (~:24 and the comment ~:4-8)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts`, `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Normalise** every existing file above.
- [ ] **Step 2: Failing tests.**
  - `packages/system/src/utils/connections.spec.ts`:
    ```ts
    import { describe, it, expect } from 'vitest';
    import { getConnectionLookupKey, getConnectionsFromLookup } from './connections';
    import { updateConnectionLookup } from './store';
    import type { ConnectionLookup, EdgeBase, EdgeLookup } from '../types';

    const edges: EdgeBase[] = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'h1' },
      { id: 'e2', source: 'a', target: 'c', sourceHandle: 'h2' },
      { id: 'e3', source: 'd', target: 'a', targetHandle: 't1' },
    ];

    function lookupFor(list: EdgeBase[]): ConnectionLookup {
      const connectionLookup: ConnectionLookup = new Map();
      updateConnectionLookup(connectionLookup, new Map() as EdgeLookup, list);
      return connectionLookup;
    }

    describe('getConnectionLookupKey', () => {
      it('builds node, node-type and node-type-handle keys; a handle id without a type is ignored', () => {
        expect(getConnectionLookupKey('a')).toBe('a');
        expect(getConnectionLookupKey('a', 'source')).toBe('a-source');
        expect(getConnectionLookupKey('a', 'source', 'h1')).toBe('a-source-h1');
        expect(getConnectionLookupKey('a', null, 'h1')).toBe('a');
      });
    });

    describe('getConnectionsFromLookup', () => {
      const connectionLookup = lookupFor(edges);
      const ids = (p: Parameters<typeof getConnectionsFromLookup>[1]) =>
        getConnectionsFromLookup(connectionLookup, p).map((c) => c.edgeId).sort();

      it('returns every connection of a node', () => expect(ids({ nodeId: 'a' })).toEqual(['e1', 'e2', 'e3']));
      it('filters by handle type', () => {
        expect(ids({ nodeId: 'a', type: 'source' })).toEqual(['e1', 'e2']);
        expect(ids({ nodeId: 'a', type: 'target' })).toEqual(['e3']);
      });
      it('filters by type and handle id', () => expect(ids({ nodeId: 'a', type: 'source', handleId: 'h2' })).toEqual(['e2']));
      it('ignores a handle id without a type', () => expect(ids({ nodeId: 'a', handleId: 'h2' })).toEqual(['e1', 'e2', 'e3']));
      it('returns [] for an unknown node', () => expect(ids({ nodeId: 'zz' })).toEqual([]));
    });
    ```
  - `ng-flow.service.spec.ts`: add a `describe('connection queries (#6114)')` inside `describe('NgFlowService')`:
    ```ts
    describe('connection queries (#6114)', () => {
      beforeEach(() => {
        service.setNodes([makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')]);
        service.setEdges([
          makeEdge('e1', 'a', 'b', { sourceHandle: 'h1' }),
          makeEdge('e2', 'a', 'c', { sourceHandle: 'h2' }),
          makeEdge('e3', 'd', 'a', { targetHandle: 't1' }),
        ]);
      });
      const ids = (cs: { edgeId: string }[]) => cs.map((c) => c.edgeId).sort();

      it('getNodeConnections takes { nodeId, type?, handleId? }', () => {
        expect(ids(service.getNodeConnections({ nodeId: 'a' }))).toEqual(['e1', 'e2', 'e3']);
        expect(ids(service.getNodeConnections({ nodeId: 'a', type: 'source' }))).toEqual(['e1', 'e2']);
        expect(ids(service.getNodeConnections({ nodeId: 'a', type: 'source', handleId: 'h1' }))).toEqual(['e1']);
        expect(ids(service.getNodeConnections({ nodeId: 'a', type: 'target', handleId: 't1' }))).toEqual(['e3']);
        expect(service.getNodeConnections({ nodeId: 'zz' })).toEqual([]);
      });

      it('selectNodeConnections takes the same params and tracks edge changes', () => {
        const sig = service.selectNodeConnections({ nodeId: 'a', type: 'source' });
        expect(ids(sig())).toEqual(['e1', 'e2']);
        service.setEdges([makeEdge('e1', 'a', 'b', { sourceHandle: 'h1' })]);
        expect(ids(sig())).toEqual(['e1']);
      });

      it('has no getHandleConnections / selectHandleConnections', () => {
        expect('getHandleConnections' in service).toBe(false);
        expect('selectHandleConnections' in service).toBe(false);
      });
    });
    ```
  - `agent-bridge.spec.ts`:
    - Delete `'get_handle_connections rejects an invalid \`type\` value'` (~:695). Its bad-`type` check moves to the new case below.
    - Add, using the file's `setup()` / `newFlow()` / `makeNode` helpers:
    ```ts
    describe('connection tools (#6114)', () => {
      function bridgeWithEdges() {
        const { bridge, newFlow } = setup();
        const flow = newFlow();
        bridge.register('main', flow);
        flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
        flow.setEdges([
          { id: 'e1', source: 'a', target: 'b', sourceHandle: 'h1' } as Edge,
          { id: 'e2', source: 'c', target: 'a' } as Edge,
        ]);
        return bridge;
      }
      const ids = (r: unknown) => (r as { edgeId: string }[]).map((c) => c.edgeId).sort();

      it('get_node_connections returns NodeConnections, filtered by type and handleId', async () => {
        const bridge = bridgeWithEdges();
        expect(ids(await bridge.callTool('get_node_connections', { nodeId: 'a' }))).toEqual(['e1', 'e2']);
        expect(ids(await bridge.callTool('get_node_connections', { nodeId: 'a', type: 'target' }))).toEqual(['e2']);
        expect(ids(await bridge.callTool('get_node_connections', { nodeId: 'a', type: 'source', handleId: 'h1' }))).toEqual(['e1']);
      });

      it('get_node_connections rejects a handleId without a type, and an invalid type, with -32602', async () => {
        const bridge = bridgeWithEdges();
        await expect(bridge.callTool('get_node_connections', { nodeId: 'a', handleId: 'h1' })).rejects.toMatchObject({ code: -32602 });
        await expect(bridge.callTool('get_node_connections', { nodeId: 'a', type: 'both' })).rejects.toMatchObject({ code: -32602 });
      });

      it('get_handle_connections no longer exists (-32601)', async () => {
        const bridge = bridgeWithEdges();
        await expect(bridge.callTool('get_handle_connections', { nodeId: 'a', type: 'source' })).rejects.toMatchObject({ code: -32601 });
      });
    });
    ```
  - Run `cd packages/system && npx vitest run src/utils/connections.spec.ts`: it fails (no such exports).
  - Run `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts src/lib/agent/agent-bridge.spec.ts -t "connection"`: it fails. The service takes a string, the methods exist, the filters are unknown, and `get_handle_connections` still answers.
- [ ] **Step 3: System hand-port** (`git diff f9420bc45^1 f9420bc45 -- packages/system`).
  - `types/general.ts`:
    - delete `HandleConnection` and its doc;
    - keep `NodeConnection` (drop the stray ` *` doc line as upstream);
    - `ConnectionLookup = Map<string, Map<string, NodeConnection>>`;
    - if `UseNodeConnectionsParams` exists, its callbacks take `NodeConnection[]`.
  - `utils/connections.ts`:
    - `import type { ConnectionLookup, HandleType, NodeConnection } from '../types';`;
    - copy `getConnectionLookupKey` and `getConnectionsFromLookup` with their JSDoc, verbatim;
    - retype `areConnectionMapsEqual` / `handleConnectionChange`.
  - `utils/store.ts`: import `type NodeConnection` instead of `HandleConnection`. Retype `addConnectionToLookup`.
  - Check: `grep -rn HandleConnection packages/system/src` shows nothing.
- [ ] **Step 4: Angular.**
  - `NgFlowService`:
    ```ts
    /**
     * Connections of a node (`Connection & { edgeId }`), optionally narrowed to one handle type
     * and, together with `type`, one handle id. A `handleId` without a `type` is ignored, as upstream.
     */
    getNodeConnections(params: { nodeId: string; type?: HandleType | null; handleId?: string | null }): NodeConnection[] {
      return getConnectionsFromLookup(this.store.connectionLookup, params);
    }
    ```
    - Delete `getHandleConnections`.
    - `selectNodeConnections(params: { nodeId: string; type?: HandleType | null; handleId?: string | null }): Signal<NodeConnection[]>` returns `computed(() => { this.store.version(); return getConnectionsFromLookup(this.store.connectionLookup, params); })`. Its doc says "Equivalent to React's `useNodeConnections({ id, handleType, handleId })`."
    - Delete `selectHandleConnections`.
    - Import `getConnectionsFromLookup`, `type NodeConnection` and `type HandleType` from `@angflow/system`. Drop `HandleConnection`.
  - `types/general.ts` `NgFlowInstance`:
    - delete the `getHandleConnections` member;
    - `getNodeConnections: (params: { nodeId: string; type?: HandleType | null; handleId?: string | null }) => NodeConnection[]`;
    - drop the `HandleConnection` import.
  - `FlowStore.connectionLookup: import('@angflow/system').ConnectionLookup = new Map()`.
  - `public-api.ts`: delete `HandleConnection,`. `NodeConnection` stays exported.
  - `README.md:184`: the Angular column becomes `` `flowService.selectNodeConnections({ nodeId, type?, handleId? })` ``. Its React column becomes `` `useNodeConnections()` ``. Keep the "Returns a `Signal<…>`" note.
  - `connection-updates-node.component.ts`:
    - `this.flow.selectNodeConnections({ nodeId: 'a' })`;
    - in the comment (~:4-8), keep the NOT COVERAGE note and say that React's `useNodeConnections({ id: 'a', … })` maps to `selectNodeConnections({ nodeId: 'a', … })`.
- [ ] **Step 5: Agent tool.**
  - Handler:
    ```ts
    this.handlers.set('get_node_connections', (flow, params) => {
      const nodeId = requireString(params, 'nodeId');
      const type = params['type'] ?? null;
      if (type !== null && type !== 'source' && type !== 'target') {
        throw new InvalidParamsError('Param "type" must be "source" or "target".');
      }
      const handleId = params['handleId'] ?? null;
      if (handleId !== null && typeof handleId !== 'string') {
        throw new InvalidParamsError('Param "handleId" must be a string.');
      }
      if (handleId !== null && type === null) {
        throw new InvalidParamsError('Param "handleId" requires "type": handle ids are only unique per handle type.');
      }
      return flow.getNodeConnections({ nodeId, type, handleId });
    });
    ```
    Delete the `get_handle_connections` handler.
  - Schema:
    - `get_node_connections` description: `'Return the NodeConnection objects (Connection & { edgeId }) of a node. Pass type ("source" | "target") to keep one side, and handleId together with type to keep one handle. A handleId without a type is an error.'`;
    - properties: `flowId`, `nodeId`, `type: { type: 'string', enum: ['source', 'target'] }`, `handleId: { type: 'string' }`;
    - `required: ['nodeId']`;
    - delete the `get_handle_connections` entry.
  - `AGENT_BRIDGE.md`:
    - replace the `get_node_connections` row with `` | `get_node_connections` | `nodeId: string`, `type?: 'source' \| 'target'`, `handleId?: string` (requires `type`) | `NodeConnection[]` (`Connection & { edgeId }`); `handleId` without `type` → `-32602` | ``;
    - delete the `get_handle_connections` row;
    - `grep -n get_handle_connections packages/angular/AGENT_BRIDGE.md` shows nothing.
  - Regenerate the snapshot. The drift test is green, and `git diff --stat packages/mcp` shows only `src/generated/tool-schemas.ts`.
- [ ] **Step 6: Verify.**
  - `cd packages/system && npx vitest run`.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `cd packages/mcp && npx vitest run`.
  - `PATH="$SHIM:$PATH" corepack pnpm typecheck && PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache, then run `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests` (in sync) and `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build`.
  - `grep -rn "getHandleConnections\|selectHandleConnections\|HandleConnection\b\|get_handle_connections" packages/{system,angular,mcp}/src examples/angular/src README.md packages/angular/AGENT_BRIDGE.md` shows nothing.
- [ ] **Step 7: Commit.**
  ```bash
  git add packages/system/src/types/general.ts packages/system/src/utils/connections.ts packages/system/src/utils/store.ts \
    packages/system/src/utils/connections.spec.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/src/lib/services/ng-flow.service.spec.ts packages/angular/src/lib/types/general.ts \
    packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/public-api.ts \
    packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/tool-schemas.ts \
    packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/AGENT_BRIDGE.md \
    packages/mcp/src/generated/tool-schemas.ts README.md \
    examples/angular/src/app/generic-tests/overrides/nodes/components/connection-updates-node.component.ts
  git commit -F- <<'EOF'
  refactor!: getNodeConnections({ nodeId, type?, handleId? }) and NodeConnection (#6114)

  System: HandleConnection is removed in favour of NodeConnection, and
  getConnectionLookupKey / getConnectionsFromLookup are added. Angular:
  getNodeConnections and selectNodeConnections take { nodeId, type?, handleId? };
  getHandleConnections and selectHandleConnections are removed. Agent:
  get_handle_connections is removed, and get_node_connections gains type and
  handleId (a handleId without a type is -32602). AGENT_BRIDGE.md, README and
  the @angflow/mcp snapshot are updated.

  Ported from xyflow/xyflow#6114 (f9420bc45)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 3 (opus): `nodeClickDistance` removed; `preventNextClick` (#5556)

Upstream merge `725baeb5f`. Hand-port the `XYDrag.ts` hunks only (`git diff 725baeb5f^1 725baeb5f -- packages/system/src/xydrag/XYDrag.ts`).

Restated decisions this task relies on:
- **The only behaviour change:** a press that moves less than `nodeDragThreshold` now fires the click (`(nodeClick)`). Today d3-drag's `clickDistance(0)` swallows it on 1px of jitter. A moved drag released outside the node already produces no click today (d3-drag's window capture listener); `preventNextClick` keeps that once `clickDistance` is `Infinity`.
- **Keep** angflow's abort path in the `end` handler:
  - the comment block;
  - `autoPanStarted = false; cancelAnimationFrame(autoPanId);`;
  - the `updateNodePositions(dragItems, false); nodePositionsChanged = false;` reset;
  - B's #6097 `isUnselectedNodeDrag`.
- `preventNextClick`'s `setTimeout(0)` schedules listener removal, which zoneless rule 3 allows.
- **No alias:** `[nodeClickDistance]`, `FlowStore.nodeClickDistance` and `[ngFlowDragClickDistance]` disappear.

**Files:**
- Modify: `packages/system/src/xydrag/XYDrag.ts` (`DragUpdateParams`, `XYDrag` closure state, `update()`, the d3 `drag()` chain)
- Create: `packages/system/src/xydrag/XYDrag.spec.ts`
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (the `nodeClickDistance` input ~:509-510; its store mirror ~:815)
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`nodeClickDistance` signal ~:235)
- Modify: `packages/angular/src/lib/directives/drag.directive.ts` (`nodeClickDistance` input ~:43-44; `updateDrag()` ~:89)
- Create: `packages/angular/src/lib/directives/drag.directive.spec.ts`
- Modify: `examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts` (every `nodeClickDistance` occurrence ~:93,176,227,307,610-611)

- [ ] **Step 1: Normalise** every existing file above.
- [ ] **Step 2: Failing tests.**
  - `XYDrag.spec.ts`. Use jsdom MouseEvents with `view: window`: d3-drag puts its move/up listeners on `event.view`, and its default container is the element's `parentNode`, so the node element lives inside a pane element in the document.
    ```ts
    import { describe, it, expect, vi, afterEach } from 'vitest';
    import { XYDrag } from './XYDrag';
    import { adoptUserNodes } from '../utils/store';
    import type { InternalNodeBase, NodeBase, NodeLookup, ParentLookup } from '../types';

    const flush = () => new Promise<void>((r) => setTimeout(r, 0));

    const box = (id: string, x = 0, extra: Partial<NodeBase> = {}): NodeBase => ({
      id, position: { x, y: 0 }, data: {}, measured: { width: 100, height: 40 }, ...extra,
    });

    function setup(opts: { nodes?: NodeBase[]; nodeId?: string; nodeDragThreshold?: number } = {}) {
      const pane = document.createElement('div');
      const nodeEl = document.createElement('div');
      pane.appendChild(nodeEl);
      document.body.appendChild(pane);
      const nodeLookup = new Map() as NodeLookup<InternalNodeBase>;
      adoptUserNodes(opts.nodes ?? [box('a')], nodeLookup, new Map() as ParentLookup<InternalNodeBase>);
      const updateNodePositions = vi.fn();
      const store = {
        nodes: [...nodeLookup.values()].map((n) => n.internals.userNode),
        nodeLookup,
        edges: [],
        nodeExtent: [[-Infinity, -Infinity], [Infinity, Infinity]],
        snapGrid: [15, 15],
        snapToGrid: false,
        nodeOrigin: [0, 0],
        multiSelectionActive: false,
        domNode: pane,
        transform: [0, 0, 1],
        autoPanOnNodeDrag: false,
        nodesDraggable: true,
        selectNodesOnDrag: true,
        nodeDragThreshold: opts.nodeDragThreshold ?? 1,
        panBy: vi.fn(async () => false),
        unselectNodesAndEdges: vi.fn(),
        updateNodePositions,
      };
      const drag = XYDrag({ getStoreItems: () => store as never });
      const nodeId = opts.nodeId ?? 'a';
      drag.update({ domNode: nodeEl, nodeId, isSelectable: true });
      const clicks = { node: vi.fn(), pane: vi.fn() };
      nodeEl.addEventListener('click', clicks.node);
      pane.addEventListener('click', clicks.pane);
      return { pane, nodeEl, store, drag, clicks, updateNodePositions, nodeLookup, nodeId };
    }

    const mouse = (type: string, target: EventTarget, x: number, y = 10) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }));
    const moved = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.some(([, dragging]) => dragging === true);
    /**
     * A full mouse drag. The move that crosses nodeDragThreshold only starts the drag (startDrag sets
     * lastPos = pointerPos, so that move moves nothing); updateNodePositions fires from the NEXT move on.
     * Every simulated drag therefore needs the crossing move plus at least one further move.
     */
    function drag(target: EventTarget, x0: number, x1: number, upTarget: EventTarget = target) {
      mouse('mousedown', target, x0);
      mouse('mousemove', target, x1); // crosses the threshold: starts the drag
      mouse('mousemove', target, x1 + 10); // first move that updates positions
      mouse('mouseup', upTarget, x1 + 10);
    }

    afterEach(() => {
      document.body.innerHTML = '';
    });

    describe('XYDrag click suppression (#5556)', () => {
      it('a press that moves less than nodeDragThreshold still clicks', () => {
        const { nodeEl, clicks, updateNodePositions } = setup({ nodeDragThreshold: 1 });
        mouse('mousedown', nodeEl, 10);
        mouse('mousemove', nodeEl, 11);
        mouse('mouseup', nodeEl, 11);
        mouse('click', nodeEl, 11);
        expect(moved(updateNodePositions)).toBe(false);
        expect(clicks.node).toHaveBeenCalledTimes(1);
      });

      it('a drag that moved nodes suppresses exactly the next click; the suppressor is gone after a task', async () => {
        const { nodeEl, clicks, updateNodePositions } = setup();
        drag(nodeEl, 10, 60);
        expect(moved(updateNodePositions)).toBe(true);
        mouse('click', nodeEl, 60);
        expect(clicks.node).not.toHaveBeenCalled();
        await flush();
        mouse('click', nodeEl, 60);
        expect(clicks.node).toHaveBeenCalledTimes(1);
      });

      it('a moved drag released outside the node suppresses the click dispatched to the ancestor', () => {
        const { pane, nodeEl, clicks } = setup();
        drag(nodeEl, 10, 60, pane);
        mouse('click', pane, 70);
        expect(clicks.pane).not.toHaveBeenCalled();
      });

      it('measures the threshold from the press point', () => {
        const { nodeEl, updateNodePositions } = setup({ nodeDragThreshold: 5 });
        mouse('mousedown', nodeEl, 10);
        mouse('mousemove', nodeEl, 13); // 3px from the press
        expect(moved(updateNodePositions)).toBe(false);
        mouse('mousemove', nodeEl, 16); // 3px from the last move, 6px from the press: crosses, starts the drag
        mouse('mousemove', nodeEl, 20); // the move after the crossing updates positions
        expect(moved(updateNodePositions)).toBe(true);
      });

      it('an aborted drag does not leak into the next press', () => {
        const { nodeEl, nodeLookup, updateNodePositions } = setup();
        const a = nodeLookup.get('a')!;
        mouse('mousedown', nodeEl, 10);
        mouse('mousemove', nodeEl, 60); // crossing: the drag starts (dragStarted = true, dragItems set)
        mouse('mousemove', nodeEl, 70); // positions update
        nodeLookup.delete('a'); // deleted mid-drag → abort
        mouse('mousemove', nodeEl, 80);
        mouse('mouseup', nodeEl, 80);
        expect(updateNodePositions).toHaveBeenLastCalledWith(expect.any(Map), false); // abort reset kept
        nodeLookup.set('a', a);
        updateNodePositions.mockClear();
        mouse('mousedown', nodeEl, 10);
        mouse('mousemove', nodeEl, 10.5); // below the threshold
        mouse('mouseup', nodeEl, 10.5);
        expect(moved(updateNodePositions)).toBe(false);
      });

      it('dragging an unselected node moves only that node (B #6097 kept)', () => {
        const { nodeEl, updateNodePositions } = setup({
          nodes: [box('a', 0, { selected: true }), box('b', 200)],
          nodeId: 'b',
        });
        mouse('mousedown', nodeEl, 210);
        mouse('mousemove', nodeEl, 260); // crossing
        mouse('mousemove', nodeEl, 270); // first position update
        const first = updateNodePositions.mock.calls.find(([, dragging]) => dragging === true)!;
        expect([...(first[0] as Map<string, unknown>).keys()]).toEqual(['b']);
      });
    });
    ```
    **Drag-simulation rule (applies to every XYDrag / DragDirective test in Tasks 3 and 4):** the move that crosses `nodeDragThreshold` calls `startDrag`, which sets `lastPos = pointerPos`. The "skip events without movement" check then skips that move, so `updateNodePositions(…, true)` and `nodePositionsChanged` happen only on a *later* move. Use `drag()` (or a crossing move plus at least one further move) whenever a test expects nodes to move, or a click to be suppressed because nodes moved.

    Run `cd packages/system && npx vitest run src/xydrag/XYDrag.spec.ts`. Expected:
    - the jitter case fails, because d3 suppresses the click;
    - the abort case fails, because `dragStarted` stays `true` after an abort, so the next sub-threshold move updates nodes;
    - the other four pass (pins).
  - `drag.directive.spec.ts`:
    ```ts
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
    import { Component } from '@angular/core';
    import { TestBed, type ComponentFixture } from '@angular/core/testing';
    import { provideZonelessChangeDetection } from '@angular/core';
    import { DragDirective } from './drag.directive';
    import { FlowStore } from '../services/flow-store.service';

    @Component({
      standalone: true,
      imports: [DragDirective],
      template: `<div class="pane" (click)="paneClicks = paneClicks + 1">
        <div class="node" [ngFlowDrag]="'a'" [ngFlowDragDisabled]="disabled" (click)="nodeClicks = nodeClicks + 1"></div>
      </div>`,
    })
    class HostComponent {
      nodeClicks = 0;
      paneClicks = 0;
      disabled = false;
    }

    const mouse = (type: string, target: EventTarget, x: number, y = 10) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }));
    /** Crossing move + one further move: XYDrag moves nothing on the move that crosses the threshold. */
    function drag(target: EventTarget, x0: number, x1: number, upTarget: EventTarget = target) {
      mouse('mousedown', target, x0);
      mouse('mousemove', target, x1);
      mouse('mousemove', target, x1 + 10);
      mouse('mouseup', upTarget, x1 + 10);
    }

    describe('DragDirective clicks (#5556)', () => {
      let fixture: ComponentFixture<HostComponent>;
      let store: FlowStore;
      let pane: HTMLElement;
      let node: HTMLElement;

      beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideZonelessChangeDetection(), FlowStore] });
        store = TestBed.inject(FlowStore);
        store.setNodes([{ id: 'a', position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 40 } }]);
        fixture = TestBed.createComponent(HostComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        pane = fixture.nativeElement.querySelector('.pane');
        node = fixture.nativeElement.querySelector('.node');
        store.domNode.set(pane as HTMLDivElement);
      });
      afterEach(() => {
        fixture.destroy();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
      });

      it('(click) fires after a 1px jitter below nodeDragThreshold', () => {
        mouse('mousedown', node, 10);
        mouse('mousemove', node, 11);
        mouse('mouseup', node, 11);
        mouse('click', node, 11);
        expect(fixture.componentInstance.nodeClicks).toBe(1);
      });

      it('a node drag released over the pane emits no pane click', () => {
        drag(node, 10, 80, pane);
        mouse('click', pane, 90);
        expect(fixture.componentInstance.paneClicks).toBe(0);
      });
    });
    ```
    - If `store.domNode` expects a different element type, cast it as the store field requires.
    - If the fixture needs a zoneless tick before the directive binds, use `await fixture.whenStable()` as the other zoneless specs do.
    - Run `cd packages/angular && npx vitest run src/lib/directives/drag.directive.spec.ts`. Expected: the jitter case fails; the pane case passes (pin).
- [ ] **Step 3: System hand-port** (the upstream diff hunks, adapted):
  1. Delete `nodeClickDistance?: number;` from `DragUpdateParams`, and `nodeClickDistance = 0,` from `update()`'s destructuring.
  2. Add closure state `let initialMousePosition: XYPosition = { x: 0, y: 0 };` next to `mousePosition`.
  3. Add `preventNextClick(sourceEvent: MouseEvent | TouchEvent)` with upstream's comment, verbatim from `git show 725baeb5f:packages/system/src/xydrag/XYDrag.ts`. Uses: `const view = sourceEvent.view ?? window;`; a capture listener that calls `preventDefault()` + `stopImmediatePropagation()`; `setTimeout(() => view.removeEventListener('click', suppressClick, { capture: true }), 0)`.
  4. `drag().clickDistance(Infinity)`.
  5. `start` handler: right after `containerBounds = …`, reset `dragStarted = false; autoPanStarted = false;`. After `mousePosition = getEventPosition(...)`, add `initialMousePosition = mousePosition;`.
  6. `drag` handler threshold block: measure from `initialMousePosition` with `Math.hypot(dx, dy)` (variables `dx`/`dy`, as upstream).
  7. `end` handler, first lines:
     ```ts
     // when released outside of the node, the browser dispatches the click to a common ancestor (e.g. the pane)
     const releasedOutside = !domNode.contains(event.sourceEvent.target as globalThis.Node | null);
     if (releasedOutside || nodePositionsChanged) {
       preventNextClick(event.sourceEvent);
     }
     ```
     `domNode` here is `update()`'s parameter: the `start` handler's `const { domNode } = getStoreItems()` is scoped to that handler.
     - Keep the abort block unchanged.
     - Delete only the success path's `autoPanStarted = false; dragStarted = false;` (upstream resets them on `start` now).
     - Keep `cancelAnimationFrame(autoPanId);`.
  Then run `git diff 725baeb5f -- packages/system/src/xydrag/XYDrag.ts` and read it. What's left should be only the kept divergences: generics/typing, the abort block, the touch check and `getEventHandlerParams` details.
- [ ] **Step 4: Angular.**
  - `NgFlowComponent`: delete the `nodeClickDistance` input with its doc, and its `this.store.nodeClickDistance.set(...)` line.
  - `FlowStore`: delete `readonly nodeClickDistance = signal(0);`.
  - `DragDirective`: delete the `nodeClickDistance` input (`ngFlowDragClickDistance`) and the `nodeClickDistance:` line in `updateDrag()`.
  - `kitchen-sink.component.ts`: delete `nodeClickDistance` from:
    - the settings type;
    - the defaults;
    - the `Behavior` key list;
    - the `[nodeClickDistance]` binding;
    - its slider control block.

    Don't add new controls.
  - `grep -rn "nodeClickDistance\|ngFlowDragClickDistance\|ClickDistance(" packages/angular/src examples/angular/src packages/system/src` shows nothing.
- [ ] **Step 5: Verify.**
  - `cd packages/system && npx vitest run`.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache. Then run `e2e/nodes.spec.ts` and `e2e/click-connect.spec.ts` (chromium, `FRAMEWORK=ng`). These must pass:
    - `nodes.spec.ts:13` `selecting a node by click`;
    - `:97` `dragging a node`;
    - `:118` `dragging one node of a selection moves the whole selection`;
    - `:150` (touch);
    - `:201` `custom drag handle works`;
    - `click-connect.spec.ts:89` `clicking a node does not cancel a pending click connection`.
- [ ] **Step 6: Commit.**
  ```bash
  git add packages/system/src/xydrag/XYDrag.ts packages/system/src/xydrag/XYDrag.spec.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/services/flow-store.service.ts \
    packages/angular/src/lib/directives/drag.directive.ts packages/angular/src/lib/directives/drag.directive.spec.ts \
    examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts
  git commit -F- <<'EOF'
  fix(system)!: drop nodeClickDistance; suppress the click only after a drag (#5556)

  XYDrag uses clickDistance(Infinity) and suppresses the next click itself
  (preventNextClick, a window capture listener removed after a task) when the
  drag moved nodes or was released outside the node. A press below
  nodeDragThreshold now fires the click; 1px of jitter no longer eats it.
  dragStarted/autoPanStarted reset on start, so an aborted drag can't leak
  into the next press. The dead [nodeClickDistance] input, its store signal
  and [ngFlowDragClickDistance] are removed.

  Ported from xyflow/xyflow#5556 (725baeb5f)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 4 (opus): XYDrag binds once per element (#6168)

Upstream merge `d2bb47dc0`. Hand-port the restructure on top of Task 3. The upstream file at `d2bb47dc0` (`git show d2bb47dc0:packages/system/src/xydrag/XYDrag.ts`) is the target shape.

Restated decisions this task relies on:
- The `drag()` instance is built once, in the `XYDrag` closure. `update()` stores `noDragClassName` / `handleSelector` / `isSelectable` / `nodeId`, and rebinds only when `domNode` changes.
- **Keep:**
  - angflow's generic signature `XYDrag<OnNodeDrag …>`;
  - the abort block;
  - the multitouch check `event.sourceEvent.type === 'touchmove' && event.sourceEvent.touches.length > 1` (don't port `isTouchEvent`, e9286291e);
  - `getEventHandlerParams`;
  - angflow's `autoPanId = requestAnimationFrame(autoPan)` form.
- `DragDirective` keeps its shape. Disabling calls `destroy()`; re-enabling calls `update()`, which rebinds because `destroy()` cleared `domNode`. `SelectionBoxComponent` calls `update()` from an effect and is unaffected.

**Files:**
- Modify: `packages/system/src/xydrag/XYDrag.ts`
- Test: `packages/system/src/xydrag/XYDrag.spec.ts` (from Task 3)
- Modify: `packages/angular/src/lib/directives/drag.directive.ts` (the comment in `updateDrag()` ~:74-77)
- Test: `packages/angular/src/lib/directives/drag.directive.spec.ts` (from Task 3)

- [ ] **Step 1: Normalise** the four files.
- [ ] **Step 2: Failing tests.** Append to `XYDrag.spec.ts`. It reuses `setup`, `mouse` and `moved` from Task 3.
  The Drag-simulation rule from Task 3 applies: every gesture that must move nodes has the crossing move plus at least one further move (`drag()` for mouse; `touchmove 40` then `touchmove 50` for touch).
  ```ts
  const touch = (type: string, target: EventTarget, x: number, y = 10, id = 1) => {
    const point = { identifier: id, clientX: x, clientY: y, pageX: x, pageY: y, target };
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(ev, {
      touches: { value: type === 'touchend' ? [] : [point] },
      changedTouches: { value: [point] },
      view: { value: window },
    });
    target.dispatchEvent(ev);
  };

  describe('XYDrag binds once per element (#6168)', () => {
    it('a second update() with the same element adds and removes no listeners; new params apply to the next gesture', () => {
      const { nodeEl, drag, updateNodePositions } = setup();
      const add = vi.spyOn(nodeEl, 'addEventListener');
      const remove = vi.spyOn(nodeEl, 'removeEventListener');
      drag.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true, handleSelector: '.grip' });
      expect(add).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();

      drag(nodeEl, 10, 60); // not on .grip → filtered out
      expect(moved(updateNodePositions)).toBe(false);

      const grip = document.createElement('span');
      grip.className = 'grip';
      nodeEl.appendChild(grip);
      drag(grip, 10, 60);
      expect(moved(updateNodePositions)).toBe(true);
    });

    it('destroy() then update() rebinds', () => {
      const { nodeEl, drag, updateNodePositions } = setup();
      drag.destroy();
      const add = vi.spyOn(nodeEl, 'addEventListener');
      drag.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true });
      expect(add.mock.calls.some(([type]) => type === 'mousedown')).toBe(true);
      drag(nodeEl, 10, 60);
      expect(moved(updateNodePositions)).toBe(true);
    });

    it('a touch drag in progress survives an update()', () => {
      const { nodeEl, drag, updateNodePositions } = setup();
      // d3-drag binds touch listeners only on touch-capable elements; mark the node element as one, then rebind.
      Object.defineProperty(nodeEl, 'ontouchstart', { value: null, configurable: true });
      drag.destroy();
      drag.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true });

      touch('touchstart', nodeEl, 10);
      touch('touchmove', nodeEl, 40); // crossing: starts the drag, moves nothing
      touch('touchmove', nodeEl, 50); // first position update
      const before = updateNodePositions.mock.calls.length;
      expect(before).toBeGreaterThan(0);
      drag.update({ domNode: nodeEl, nodeId: 'a', isSelectable: true }); // e.g. an input changed mid-gesture
      touch('touchmove', nodeEl, 80);
      expect(updateNodePositions.mock.calls.length).toBeGreaterThan(before);
      touch('touchend', nodeEl, 80);
      expect(updateNodePositions).toHaveBeenLastCalledWith(expect.any(Map), false);
    });
  });
  ```
  - The `ontouchstart` property on `nodeEl` is what makes d3-drag's `touchable` filter bind its touch listeners in jsdom.
  - If jsdom's d3-drag touch path needs more Touch fields, add them to `point`.
  - In `drag.directive.spec.ts`, add `'re-enabling after ngFlowDragDisabled rebinds the drag'`:
    - set `fixture.componentInstance.disabled = true`, mark for check and detect changes;
    - `drag(node, 10, 60)` (crossing move plus a further move): `store.nodeLookup.get('a')!.internals.positionAbsolute.x` stays `0`;
    - set `disabled = false`, detect changes, and `drag(node, 10, 60)` again: the x position is now `> 0`.

  Run both spec files. Expected:
  - the first and third XYDrag cases fail. Today's `update()` rebinds, which calls `addEventListener`/`removeEventListener` and drops the touch gesture's `touchmove` listener;
  - `destroy() then update()` and the directive re-enable case pass (pins), provided they use `drag()`. With a single move they would fail for the wrong reason (nothing moves on the crossing move).
- [ ] **Step 3: System hand-port.**
  - Move `updateNodes`, `autoPan` and `startDrag` out of `update()` into the `XYDrag` closure.
  - Add the closure state `noDragClassName`, `handleSelector`, `isSelectable`, `nodeId` and `domNode: Element | undefined`, with upstream's comment.
  - Build `const d3DragInstance = drag()…` once, in the closure.
  - The `filter` reads the closure state, and returns `false` when no element is bound (`const boundNode = domNode; if (!boundNode) return false;`).
  - The `end` handler's `releasedOutside` becomes `!domNode?.contains(...)`.
  - `update(params)`:
    ```ts
    function update(params: DragUpdateParams) {
      noDragClassName = params.noDragClassName;
      handleSelector = params.handleSelector;
      isSelectable = params.isSelectable;
      nodeId = params.nodeId;

      // re-binding would drop a running touch drag: d3 keeps the listeners of a touch gesture on the element
      if (params.domNode === domNode) {
        return;
      }

      domNode = params.domNode;
      d3Selection?.on('.drag', null);
      d3Selection = select(domNode);
      d3Selection.call(d3DragInstance);
    }
    ```
  - `destroy()`: `d3Selection?.on('.drag', null); d3Selection = null; domNode = undefined;`.
  - Then run `git diff d2bb47dc0 -- packages/system/src/xydrag/XYDrag.ts` and read it. What's left should be only:
    - generics/typing;
    - the abort block;
    - the touch check;
    - `requestAnimationFrame(autoPan)` vs `() => { void autoPan(); }`;
    - `getEventHandlerParams` argument details.
- [ ] **Step 4: Angular.** In `DragDirective.updateDrag()`, replace the "re-bind on every input change" comment with:
  ```ts
  // Mirrors React's useDrag effect. Disabled → destroy() unbinds and clears the bound element.
  // Enabled → update() only refreshes the flags (isSelectable, handleSelector, …) on the same
  // element, and rebinds after a destroy() because the element was cleared (#6168).
  ```
- [ ] **Step 5: Verify.**
  - `cd packages/system && npx vitest run`.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache, then run `e2e/nodes.spec.ts` (chromium, `FRAMEWORK=ng`). `:150` `dragging a node with a touch gesture` and every drag test must pass.
  - Run `e2e/pane.spec.ts`: the selection-box drag uses XYDrag without a `nodeId`.
- [ ] **Step 6: Commit.**
  ```bash
  git add packages/system/src/xydrag/XYDrag.ts packages/system/src/xydrag/XYDrag.spec.ts \
    packages/angular/src/lib/directives/drag.directive.ts packages/angular/src/lib/directives/drag.directive.spec.ts
  git commit -F- <<'EOF'
  fix(system): XYDrag binds d3-drag once per element (#6168)

  The drag behaviour is created once per XYDrag instance. update() stores the
  current flags and only rebinds when the element changes, so a running touch
  drag survives an update. destroy() clears the bound element, and the next
  update() rebinds. Angflow's abort path, touchmove multitouch check and
  #6097 drag items are kept.

  Ported from xyflow/xyflow#6168 (d2bb47dc0)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

## Checkpoint A (after Task 4)

- [ ] Build both packages, then `rm -rf examples/angular/.angular/cache`.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm --filter playwright test:angular`. Expected:
  - `known failures: 4 entries`, all `owner: 'D'` (2 click-connect payload, 2 colour-mode);
  - `NOT MATCHED: 0`, `WRONG FILE: 0`, `STALE (now passing): 0`;
  - `chromium failures: 0`;
  - `verdict: OK`.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm test`: system, angular and mcp vitest are all green.
- [ ] Run `cd packages/angular && npx tsc --noEmit`, then `PATH="$SHIM:$PATH" corepack pnpm typecheck` and `PATH="$SHIM:$PATH" corepack pnpm lint`. All are clean.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build` and `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build:zoneless`. Both succeed.
- [ ] Run the examples unit tests (Commands). Expected: green.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests`. Expected: in sync.
- [ ] Run `cd packages/mcp && npx vitest run test/schema-snapshot.spec.ts`: drift green, stamp `0.4.0`.
- [ ] Verbatim paths: run `git diff --quiet 3b96f518e -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts packages/react packages/svelte packages/vue examples/react examples/svelte examples/vue examples/astro-xyflow tests/playwright/known-failures.ng.ts`. Expected: exit 0.
- [ ] Run `uvx codespell $(git diff --name-only 3b96f518e..HEAD)`. Expected: no output.

---

### Task 5 (opus): `to` in flow coordinates: XYHandle's final state, `rawConnection` and derived `connection` (#6117, part 1)

Upstream merge `63b6e0295`. System: one line plus docs. Angular: hand-port upstream React's `deriveConnection` (`git diff 63b6e0295^1 63b6e0295 -- packages/react/src/store/index.ts`) onto `FlowStore`.

Restated decisions this task relies on:
- `FlowStore.rawConnection = signal<ConnectionState>({ ...initialConnection })` holds XYHandle's screen-space state. It is public, as upstream's raw state is to the store.
  - `updateConnection`, `updateClickConnectPreview` and `cancelConnection` write it, and set the private `connectionIsClickPreview` flag as today.
- `FlowStore.connection` becomes a read-only `computed`:
  - `raw.inProgress ? { ...raw, to: pointToRendererPoint(raw.to, transform()) } : raw`;
  - it recomputes on a viewport change while a connection is in progress;
  - no extra guard: it is upstream-exact.
- `updateNodePositions`' from-node follow, `connectionDragInProgress()`, `isClickConnectPreview()` and `getStoreItems().connection` read the raw state. `reset()` reaches `cancelConnection()` through `detachFlow()`.
- `getClickConnectionState` (angflow-only) keeps emitting screen `to`, like XYHandle's in-progress states.
- **Spec deviation 3 (fixtures):**
  - `flow-store.gesture.spec.ts` (`{ inProgress: true }`) and the `reset()` test in `flow-store.service.spec.ts` (`{ ...initialConnection, inProgress: true }`, `to: null`) would make the computed throw. Give both a full in-progress state.
  - `click-connect-preview.service.spec.ts`'s two `toBe(drag)` identity checks read `rawConnection()`.
  - The from-node test seeds with the real `updateConnection` before it installs its spy.
- After this task, `(reconnectEnd).connectionState.to` is in flow coordinates: the system change covers it.

**Files:**
- Modify: `packages/system/src/xyhandle/XYHandle.ts` (`onPointerUp`'s `finalConnectionState` ~:238-243)
- Modify: `packages/system/src/types/general.ts` (`ConnectionInProgress` docs: `from`, `to`, `pointer`)
- Test: `packages/system/src/xyhandle/XYHandle.spec.ts`
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`connection` ~:261; `updateNodePositions` from-node follow ~:547-572; `cancelConnection` / `updateConnection` / `updateClickConnectPreview` / `connectionDragInProgress` / `isClickConnectPreview` ~:1076-1109; `getStoreItems` ~:1304; import `pointToRendererPoint`)
- Modify: `packages/angular/src/lib/components/connection-line/connection-line.component.ts` (`connectionCoords` ~:92-96)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (the `connection` doc ~:79)
- Modify (specs; replace `store.connection.set(x)` with `store.updateConnection(x)`, 12 writes):
  - `components/connection-line/connection-line.component.spec.ts` (4);
  - `container/ng-flow/ng-flow.pane-click.spec.ts` (5);
  - `services/flow-store.gesture.spec.ts` (1);
  - `services/flow-store.service.spec.ts` (2);
  - and `services/click-connect-preview.service.spec.ts` (the `toBe(drag)` checks).
- Test: `packages/angular/src/lib/services/flow-store.service.spec.ts`, `packages/angular/src/lib/components/connection-line/connection-line.component.spec.ts`

- [ ] **Step 1: Normalise** every file above.
- [ ] **Step 2: Failing tests.**
  - `XYHandle.spec.ts`, inside `describe('XYHandle.onPointerDown — pointer-family teardown …')`. It reuses that block's `beforeEach` and `makeParams`/`makeFakeEvent`:
    ```ts
    it('reports the final `to` in flow coordinates and `pointer` in screen coordinates (#6117)', () => {
      const onConnectEnd = vi.fn();
      const params = { ...makeParams(), dragThreshold: 0, getTransform: () => [100, 50, 2] as any, onConnectEnd };
      XYHandle.onPointerDown(makeFakeEvent('pointerdown', 10, 10), params);
      document.dispatchEvent(makeFakeEvent('pointermove', 300, 250));
      document.dispatchEvent(makeFakeEvent('pointerup', 300, 250));
      const state = onConnectEnd.mock.calls[0][1];
      expect(state.to).toEqual({ x: 100, y: 100 }); // ((300 - 100) / 2, (250 - 50) / 2)
      expect(state.pointer).toEqual({ x: 300, y: 250 });
      expect(state).not.toHaveProperty('inProgress');
    });
    ```
  - `flow-store.service.spec.ts`, a new `describe('derived connection (#6117)')`. `inProgressConnection(to)` returns a full `ConnectionInProgress`, modelled on the from-node test's literal (~:723):
    ```ts
    it('connection().to is rawConnection().to in flow coordinates, recomputed on pan', () => {
      store.transform.set([100, 50, 2]);
      store.updateConnection(inProgressConnection({ x: 300, y: 250 }));
      expect(store.rawConnection().to).toEqual({ x: 300, y: 250 });
      expect(store.connection().to).toEqual({ x: 100, y: 100 });
      store.transform.set([0, 0, 1]);
      expect(store.connection().to).toEqual({ x: 300, y: 250 });
    });

    it('is the raw object itself when idle', () => {
      expect(store.connection()).toBe(store.rawConnection());
      expect(store.connection().inProgress).toBe(false);
    });

    it('reset() restores rawConnection to initialConnection and clears the preview flag', () => {
      store.updateClickConnectPreview(inProgressConnection({ x: 1, y: 1 }));
      store.reset();
      expect(store.rawConnection()).toEqual(initialConnection);
      expect(store.isClickConnectPreview()).toBe(false);
    });

    it('the from-node follow writes the raw state (no double conversion)', () => {
      store.setNodes([makeNode('n1', { position: { x: 0, y: 0 } })]);
      store.transform.set([100, 50, 2]);
      store.updateConnection({ ...inProgressConnection({ x: 300, y: 250 }), fromNode: store.nodeLookup.get('n1')! });
      store.updateNodePositions(
        new Map([['n1', { position: { x: 50, y: 75 }, internals: { positionAbsolute: { x: 50, y: 75 } }, measured: { width: 150, height: 40 } }]]) as never,
        true,
      );
      expect(store.rawConnection().to).toEqual({ x: 300, y: 250 }); // still screen space
      expect(store.connection().to).toEqual({ x: 100, y: 100 });
    });
    ```
    Fit the from-node test's `updateNodePositions` call to the existing from-node test's drag-item literal and call signature.
  - `connection-line.component.spec.ts`, a pin for "the connection-line path is unchanged":
    ```ts
    it('draws to the flow-space end point under a transform', () => {
      store.transform.set([100, 50, 2]);
      store.updateConnection({ ...makeInProgressConnection(), to: { x: 300, y: 250 } });
      fixture.detectChanges();
      const props = fixture.componentInstance.connectionProps() as { toX: number; toY: number };
      expect(props.toX).toBe(100);
      expect(props.toY).toBe(100);
    });
    ```
  - Run `cd packages/system && npx vitest run src/xyhandle/XYHandle.spec.ts`: the new case fails (`to` is `{ 300, 250 }`).
  - Run `cd packages/angular && npx vitest run src/lib/services/flow-store.service.spec.ts src/lib/components/connection-line`: the new store cases fail (`rawConnection` is undefined); the connection-line pin passes.
- [ ] **Step 3: System.**
  - In `onPointerUp`, set `to: pointToRendererPoint(previousConnection.to, getTransform())` in `finalConnectionState`, after the spread and before `toPosition`.
  - Port the three doc changes on `ConnectionInProgress` (`from`/`to` "in flow coordinates"; `pointer` "relative to the pane, in screen coordinates").
- [ ] **Step 4: Angular store.**
  ```ts
  /**
   * XYHandle's connection state, `to` in screen coordinates (pane-relative). Written by
   * updateConnection / updateClickConnectPreview / cancelConnection. Read `connection` instead
   * unless you need the raw screen-space state.
   */
  readonly rawConnection = signal<ConnectionState>({ ...initialConnection });

  /**
   * The current connection with `to` in flow coordinates, like upstream React's store
   * (`deriveConnection`). Recomputed when the raw state or, during a connection, the viewport changes.
   */
  readonly connection: Signal<ConnectionState> = computed(() => {
    const raw = this.rawConnection();
    return raw.inProgress ? { ...raw, to: pointToRendererPoint(raw.to, this.transform()) } : raw;
  });
  ```
  - `cancelConnection` / `updateConnection` / `updateClickConnectPreview` write `rawConnection`. Keep the flag handling.
  - `connectionDragInProgress()` and `isClickConnectPreview()` read `this.rawConnection().inProgress`.
  - `updateNodePositions`: `const conn = this.rawConnection();`. The rest of the follow is unchanged.
  - `getStoreItems()`: `connection: this.rawConnection()`. The system consumers expect XYHandle's own coordinates.
  - Import `pointToRendererPoint` (and `computed`/`Signal` if they aren't imported yet).
  - `NgFlowService.connection`'s doc: "Reactive connection state during a connection drag or the click-to-connect preview. `to` is in flow coordinates, `pointer` in screen coordinates."
- [ ] **Step 5: Connection line.** In `connectionCoords`, use `const toX = activeConn.to?.x ?? 0; const toY = activeConn.to?.y ?? 0;`. Delete the transform read and the manual conversion.
- [ ] **Step 6: Fixtures.**
  - Replace the 12 `store.connection.set(` writes with `store.updateConnection(`. Find them with `grep -rn "connection\.set(" packages/angular/src`, which afterwards shows nothing.
  - `flow-store.gesture.spec.ts`: write a full in-progress state (copy `makeInProgressConnection` from `ng-flow.pane-click.spec.ts`). Keep the cast-free form.
  - `flow-store.service.spec.ts` `reset()` test: same.
  - From-node test: call the real `store.updateConnection(state)` first, then install the spy (`store.updateConnection = updateConnectionSpy`).
  - `click-connect-preview.service.spec.ts`: `expect(store.rawConnection()).toBe(drag)` at both places.
- [ ] **Step 7: Verify.**
  - `cd packages/system && npx vitest run`.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache, then run `e2e/click-connect.spec.ts`, `e2e/reconnect-edge.spec.ts`, `e2e/edges.spec.ts` and `e2e/nodes.spec.ts` (chromium, `FRAMEWORK=ng`). All non-known-failure tests pass.
  - Optional, at most 10 minutes: in `ng serve`, the `moving-handles` and `easy-connect` examples still highlight targets during a connection drag.
- [ ] **Step 8: Commit.**
  ```bash
  git add packages/system/src/xyhandle/XYHandle.ts packages/system/src/types/general.ts packages/system/src/xyhandle/XYHandle.spec.ts \
    packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/src/lib/components/connection-line/connection-line.component.ts \
    packages/angular/src/lib/components/connection-line/connection-line.component.spec.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.pane-click.spec.ts \
    packages/angular/src/lib/services/flow-store.gesture.spec.ts packages/angular/src/lib/services/flow-store.service.spec.ts \
    packages/angular/src/lib/services/click-connect-preview.service.spec.ts
  git commit -F- <<'EOF'
  refactor!: connection().to in flow coordinates; FlowStore.rawConnection (#6117)

  XYHandle's final connection state reports `to` in flow coordinates, so
  (reconnectEnd).connectionState.to is flow-space. FlowStore follows upstream
  React's deriveConnection: rawConnection holds XYHandle's screen-space state
  and connection is a read-only computed with `to` in flow coordinates,
  recomputed on pan/zoom while a connection is in progress. The connection
  line drops its manual conversion. Writers use updateConnection.

  Ported from xyflow/xyflow#6117 (63b6e0295)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 6 (opus): Connect-event scope: click-connect fires no connect events, reconnect fires both (#6117, part 2)

Upstream behaviour, decided by the user (spec Decisions). The references are upstream `Handle/index.tsx` `onClick`, which fires only `onClickConnectStart`/`onClickConnectEnd`, and `EdgeUpdateAnchors.tsx` `handleEdgeUpdater`.

Restated decisions this task relies on:
- **Click-connect** stops firing `(connectStart)`/`(connectEnd)`. It keeps `(clickConnectStart)`/`(clickConnectEnd)`.
- **Reconnect drags** start firing them, as `EdgeUpdateAnchors` does:
  - `(reconnectStart)` moves from pointerdown into XYHandle's `onConnectStart` callback;
  - it is emitted **first**, with the original pointerdown event; `(connectStart)` follows;
  - XYHandle's `onConnectEnd` is passed through to `(connectEnd)`;
  - the order is `(reconnectStart)` → `(connectStart)` … `(connectEnd)` → `(reconnectEnd)`;
  - `(reconnectStart)` now waits for `connectionDragThreshold`, like upstream.
- **Open question 1 default:** `reconnectingEdgeId.set(edge.id)` moves into the same `onConnectStart` callback (upstream `setReconnecting(true)`). A sub-threshold press on a reconnect anchor no longer hides the edge.
- **Spec deviation 4:** this lands before Task 7's payload types. Reconnect's `onConnectEnd: (evt, state) => store.onConnectEnd?.(evt)` is fine against today's one-argument store slot. Task 7 forwards `state`.

**Files:**
- Modify: `packages/angular/src/lib/components/handle/handle.component.ts` (`onClick`: the `store.onConnectStart?.(…)` ~:264-268 and both `store.onConnectEnd?.(event)` ~:278, :308)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (`handleEdgeReconnect` ~:770-815)
- Test: `packages/angular/src/lib/components/handle/handle.component.spec.ts`, `packages/angular/src/lib/container/edge-renderer/edge-renderer.reconnect.spec.ts`

- [ ] **Step 1: Normalise** the four files.
- [ ] **Step 2: Failing tests.**
  - `handle.component.spec.ts`: add `describe('HandleComponent — click-connect fires only click-connect events')`. Copy the TestBed setup of `describe('HandleComponent — connection-start gating')`. Dispatch real clicks on the handle element (`fixture.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))`), so `event.target` is set for `XYHandle.isValid`.
    - First click: `store.onClickConnectStart` is called once; `store.onConnectStart` is never called.
    - Re-click of the armed handle: `store.onClickConnectEnd` is called; `store.onConnectEnd` is never called.
    - Second click completing on another handle: arm a different handle first with `store.connectionClickStartHandle.set({ nodeId: 'other', handleId: null, type: 'source' })`. Then `store.onConnectEnd` is never called.
  - `edge-renderer.reconnect.spec.ts`: add a `describe('EdgeRendererComponent reconnect — event order (#6117)')`, with the file's existing setup and its `vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(...)` idiom to capture `params`:
    ```ts
    it('fires reconnectStart → connectStart … connectEnd → reconnectEnd, and only after the drag starts', () => {
      store.setNodes([{ id: 'src', position: { x: 0, y: 0 }, data: {} }, { id: 'tgt', position: { x: 200, y: 0 }, data: {} }] as any[]);
      store.setEdges([makeEdge()]);
      const order: string[] = [];
      let startEvent: MouseEvent | undefined;
      component.reconnectStart.subscribe((e) => { order.push('reconnectStart'); startEvent = e.event; });
      component.reconnectEnd.subscribe(() => order.push('reconnectEnd'));
      store.onConnectStart = () => order.push('connectStart');
      store.onConnectEnd = () => order.push('connectEnd');
      const spy = vi.spyOn(system.XYHandle, 'onPointerDown').mockImplementation(() => {});
      try {
        const down = new MouseEvent('mousedown', { button: 0, bubbles: true });
        component.onReconnectSourceMouseDown(down, store.edges()[0]);
        expect(order).toEqual([]); // nothing on pointerdown
        expect(component.reconnectingEdgeId()).toBeNull(); // a sub-threshold press hides nothing

        const params = spy.mock.calls[0][1] as any;
        params.onConnectStart(new MouseEvent('pointermove'), { nodeId: 'tgt', handleId: null, handleType: 'target' });
        expect(order).toEqual(['reconnectStart', 'connectStart']);
        expect(startEvent).toBe(down); // the original pointerdown, as upstream
        expect(component.reconnectingEdgeId()).toBe('e1');

        const up = new MouseEvent('pointerup');
        const state = { isValid: null, to: { x: 0, y: 0 } };
        params.onConnectEnd(up, state);
        params.onReconnectEnd(up, state);
        expect(order).toEqual(['reconnectStart', 'connectStart', 'connectEnd', 'reconnectEnd']);
        expect(component.reconnectingEdgeId()).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });
    ```
    Use the edge id that `makeEdge()` in this file produces (`'e1'`).
  - Run `cd packages/angular && npx vitest run src/lib/components/handle src/lib/container/edge-renderer/edge-renderer.reconnect.spec.ts`. Expected failures:
    - click-connect calls `onConnectStart`/`onConnectEnd`;
    - reconnect emits `(reconnectStart)` on pointerdown, sets `reconnectingEdgeId` there, and passes no `onConnectStart`/`onConnectEnd`.
- [ ] **Step 3: Implement.**
  - `HandleComponent.onClick`: delete the `store.onConnectStart?.(event, {…})` call in the first-click branch, and both `store.onConnectEnd?.(event);` calls. Nothing else changes in this task.
  - `EdgeRendererComponent.handleEdgeReconnect`:
    - delete the pointerdown-time `this.reconnectStart.emit(...)` and `this.reconnectingEdgeId.set(edge.id)`;
    - add to the `XYHandle.onPointerDown` params:
      ```ts
      // Upstream EdgeUpdateAnchors: the reconnect starts with the connection drag (after
      // connectionDragThreshold). (reconnectStart) carries the original pointerdown event.
      onConnectStart: (evt: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
        this.reconnectingEdgeId.set(edge.id);
        this.reconnectStart.emit({ event, edge, handleType: oppositeHandle.type });
        store.onConnectStart?.(evt, params);
      },
      onConnectEnd: (evt: MouseEvent | TouchEvent, _connectionState: FinalConnectionState) => store.onConnectEnd?.(evt),
      ```
    - `onReconnectEnd` is unchanged.
    - Import `OnConnectStartParams` if it isn't imported yet. Lint accepts the `_connectionState` name; Task 7 forwards it.
  - Update the doc comments on `NgFlowComponent`'s `connectStart` / `connectEnd` outputs ("A connection drag started on a handle or an edge's reconnect anchor…"), and on `reconnectStart` ("…once the drag passes `connectionDragThreshold`").
- [ ] **Step 4: Verify.**
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache, then run `e2e/click-connect.spec.ts`, `e2e/reconnect-edge.spec.ts` and `e2e/edges.spec.ts` (chromium). Green.
  - Run `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build`. The `touch-device`, `cancel-connection` and `reconnect-edge` examples compile unchanged.
- [ ] **Step 5: Commit.**
  ```bash
  git add packages/angular/src/lib/components/handle/handle.component.ts packages/angular/src/lib/components/handle/handle.component.spec.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.reconnect.spec.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.component.ts
  git commit -F- <<'EOF'
  fix(angular)!: connect events follow upstream: click-connect fires none, reconnect fires both

  Click-to-connect fires only (clickConnectStart)/(clickConnectEnd), as
  upstream's Handle does. A reconnect drag fires (reconnectStart) then
  (connectStart) when the drag starts (after connectionDragThreshold), and
  (connectEnd) before (reconnectEnd), as upstream's EdgeUpdateAnchors does.
  (reconnectStart) still carries the pointerdown event. The edge is hidden as
  "reconnecting" only once the drag starts, so a click on a reconnect anchor
  no longer hides the edge.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 7 (opus): `(connectEnd)` / `(clickConnectEnd)` carry `FinalConnectionState`; the two known failures are removed (#6117, part 3)

Restated decisions this task relies on:
- `(connectEnd)`: `output<{ event: MouseEvent | TouchEvent; connectionState: FinalConnectionState }>`, the same shape as `(reconnectEnd)`.
- `(clickConnectEnd)`: `output<{ event: MouseEvent; connectionState: FinalConnectionState }>`.
- `FlowStore.onConnectEnd` and `FlowStore.onClickConnectEnd` are typed `OnConnectEnd | null` (system type). The `<ng-flow>` wiring casts the click event to `MouseEvent`.
- The click state comes from a new public `FlowStore.getFinalClickConnectionState(): FinalConnectionState`, built like upstream `Pane`/`Handle` `onClick`:
  - the source is the **derived** `connection()` (flow-coordinate `to`), but only while `isClickConnectPreview()` is true. Otherwise the source is `initialConnection`: either nothing moved since arming, or a real connection drag owns the line;
  - it is a copy without `inProgress`, with `toPosition: toHandle ? toHandle.position : null`;
  - only `ConnectionState` fields; the private preview flag is never copied;
  - a **shallow** copy, not `structuredClone` (node `data` holding functions would throw `DataCloneError`).
- **Read before clear**, at every site. Clearing `connectionClickStartHandle` makes `ClickConnectPreview` detach and cancel the preview later, in an effect.

  | Site | D1 order |
  |---|---|
  | Handle second click, completing (`HandleComponent.onClick` else-branch) | `onConnect` (if valid); read state; clear; `onClickConnectEnd(event, state)` |
  | Handle re-click, disarming (`HandleComponent.onClick` re-click branch) | read state; clear; `onClickConnectEnd(event, state)` |
  | Pane click (`NgFlowComponent.onPaneClick`) | read state; `onClickConnectEnd(event, state)`; clear (order kept) |
- Escape and right-click cancels still emit no `(clickConnectEnd)` (spec non-goal).
- The generic host adapter unpacks the output into upstream's `(event, connection)` arguments.

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`onConnectEnd`, `onClickConnectEnd` ~:319-321; new `getFinalClickConnectionState` next to `isClickConnectPreview`)
- Modify: `packages/angular/src/lib/components/handle/handle.component.ts` (`onPointerDown`'s `onConnectEnd` ~:216; `onClick`'s two end sites)
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts` (reconnect `onConnectEnd` from Task 6: forward the state)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (`connectEnd` / `clickConnectEnd` outputs ~:646, :651; the store wiring ~:923-931; `onPaneClick`'s click-connect cancel ~:1170-1172)
- Modify: `examples/angular/src/app/examples/add-node-on-edge-drop/add-node-on-edge-drop.component.ts` (`onConnectEnd` ~:60)
- Modify: `examples/angular/src/app/generic-tests/flow-props.ts` (`onClickConnectEnd` adapter and its comment ~:10-12), `examples/angular/src/app/generic-tests/flow-props.spec.ts` (`'calls onClickConnectEnd as (event, undefined)'`)
- Modify: `tests/playwright/known-failures.ng.ts` (delete both `pane click cancels a pending connection` entries and the now-empty `click-connect.spec.ts` section comment)
- Test: `flow-store.service.spec.ts`, `handle.component.spec.ts`, `ng-flow.pane-click.spec.ts`

- [ ] **Step 1: Normalise** every file above.
- [ ] **Step 2: Failing tests.** Shared fixture in each file:
  ```ts
  const EMPTY_FINAL = {
    isValid: null, from: null, fromHandle: null, fromPosition: null, fromNode: null,
    to: null, toHandle: null, toPosition: null, toNode: null, pointer: null,
  };
  ```
  - `flow-store.service.spec.ts`, `describe('getFinalClickConnectionState (#6117)')`:
    - **No preview**, for example a fresh store, or after `connectionClickStartHandle.set(...)` with no move: `toEqual(EMPTY_FINAL)`, and `Object.keys(state).sort()` equals `Object.keys(EMPTY_FINAL).sort()`.
    - **Preview at transform `[100, 50, 2]`**, via `store.updateClickConnectPreview(inProgressConnection({ x: 300, y: 250 }))` with `toHandle: null`:
      - `state.to` is `{ x: 100, y: 100 }`;
      - `state.toPosition` is `null`;
      - `state` has no `inProgress`;
      - its keys are exactly `EMPTY_FINAL`'s.
    - **A preview with a `toHandle`** of `position: Position.Left`: `state.toPosition === Position.Left`.
    - **A real drag in progress** (`store.updateConnection(...)`): `toEqual(EMPTY_FINAL)`. The drag's state never reaches a click-end payload.
    - **A function in `fromNode.internals.userNode.data`**: the call doesn't throw, and `state.fromNode` is the same object as `store.connection().fromNode` (a shallow copy).
  - `handle.component.spec.ts`, `describe('HandleComponent — click-connect end payload (#6117)')`. Use the TestBed and real-click setup from Task 6, and set `store.onClickConnectEnd = vi.fn()`.
    - Completing second click with a preview at `[100, 50, 2]`:
      - the spy is called with `(event, state)`;
      - `state.to` is `{ x: 100, y: 100 }`;
      - `'inProgress' in state` is `false`;
      - `store.connectionClickStartHandle()` is `null` afterwards.
    - The same without a preview: `state` equals `EMPTY_FINAL`.
    - Re-click of the armed handle with a preview: same shape as the completing case.
    - Drag connection: capture `XYHandle.onPointerDown`'s params (the spy idiom from `describe('HandleComponent — isNodeVisible wiring …')`) and call `params.onConnectEnd(evt, state)`. Then `store.onConnectEnd` is called with `(evt, state)`.
  - `ng-flow.pane-click.spec.ts`. Use the file's `setup()` and its `clickConnectEndSpy`:
    - with an armed handle and a preview at `[100, 50, 2]`, `inst.onPaneClick(makePaneClick())` emits `{ event, connectionState }`;
    - `connectionState.to` is `{ x: 100, y: 100 }`;
    - the handle is cleared afterwards.

    Also add: after `fixture.detectChanges()`, calling `store.onConnectEnd!(evt, state)` makes `inst.connectEnd` emit `{ event: evt, connectionState: state }`.
  - Run `cd packages/angular && npx vitest run src/lib/services/flow-store.service.spec.ts src/lib/components/handle src/lib/container/ng-flow/ng-flow.pane-click.spec.ts`. Expected:
    - `getFinalClickConnectionState` doesn't exist;
    - the outputs carry bare events;
    - the drag `onConnectEnd` drops the state.
- [ ] **Step 3: Store.**
  ```ts
  onConnectEnd: OnConnectEnd | null = null;
  onClickConnectEnd: OnConnectEnd | null = null;

  /**
   * The final state of a click-to-connect, as `(clickConnectEnd)` reports it (upstream Pane/Handle
   * onClick): the preview line's state with `to` in flow coordinates while the preview is shown,
   * otherwise the empty state, so a concurrent connection drag never leaks into it. A shallow copy
   * without `inProgress`; `toPosition` is the end handle's position or null.
   */
  getFinalClickConnectionState(): FinalConnectionState {
    const source = this.isClickConnectPreview() ? this.connection() : initialConnection;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inProgress, ...rest } = source;
    return { ...rest, toPosition: rest.toHandle ? rest.toHandle.position : null } as FinalConnectionState;
  }
  ```
  Import `type OnConnectEnd, type FinalConnectionState` from `@angflow/system`. If lint accepts an `_inProgress` rename instead of the disable comment, use the rename.
- [ ] **Step 4: Sites and outputs.**
  - `HandleComponent.onPointerDown`: `onConnectEnd: (event, connectionState) => store.onConnectEnd?.(event, connectionState)`.
  - `HandleComponent.onClick`:
    - re-click branch: `const connectionState = store.getFinalClickConnectionState(); store.connectionClickStartHandle.set(null); store.onClickConnectEnd?.(event, connectionState);`;
    - completing branch: after the `if (isValid && connection) { … }` block, the same three lines.
  - `EdgeRendererComponent` reconnect: `onConnectEnd: (evt, connectionState) => store.onConnectEnd?.(evt, connectionState)`.
  - `NgFlowComponent`:
    - `connectEnd = output<{ event: MouseEvent | TouchEvent; connectionState: FinalConnectionState }>({ alias: 'connectEnd' })`, with the doc "A connection drag ended (valid or not). `connectionState.to` is in flow coordinates.";
    - `clickConnectEnd = output<{ event: MouseEvent; connectionState: FinalConnectionState }>({ alias: 'clickConnectEnd' })`, with the doc "A click-to-connect ended: the second click, a re-click of the armed handle, or a pane click. `connectionState` is the preview's final state (`to` in flow coordinates) or the empty state.";
    - wiring: `this.store.onConnectEnd = (event, connectionState) => this.connectEnd.emit({ event, connectionState });` and `this.store.onClickConnectEnd = (event, connectionState) => this.clickConnectEnd.emit({ event: event as MouseEvent, connectionState });`;
    - `onPaneClick`: `const connectionState = this.store.getFinalClickConnectionState(); this.store.onClickConnectEnd?.(event, connectionState); this.store.connectionClickStartHandle.set(null);`.
  - `add-node-on-edge-drop.component.ts`: `onConnectEnd({ event }: { event: MouseEvent | TouchEvent; connectionState: FinalConnectionState }): void`. The rest of the body is unchanged; import the type.
  - `flow-props.ts`:
    ```ts
    // Angular's clickConnectEnd emits { event, connectionState }; upstream calls
    // onClickConnectEnd(event, connection). Unpack the payload into those two arguments.
    onClickConnectEnd: { output: 'clickConnectEnd', adapt: (cb) => ({ event, connectionState }) => cb(event, connectionState) },
    ```
    `flow-props.spec.ts`: rename the case to `'calls onClickConnectEnd as (event, connectionState)'`. It calls `r.outputs[0].handler({ event: 'evt', connectionState: { to: null } })` and expects `cb` to be called with `('evt', { to: null })`.
  - `known-failures.ng.ts`: delete both entries and the `// ── click-connect.spec.ts ──` comment line above them.
- [ ] **Step 4b: Run the click-connect e2e right away**, before the rest of the verify step: build both packages, drop the cache, stop any server on 4201, then run `e2e/click-connect.spec.ts` (chromium, `FRAMEWORK=ng`). These two tests are the reason for the task, so find out first whether they pass.
  - The upstream fixture (`examples/react/src/generic-tests/pane/click-connect.ts`, verbatim, never edited) logs `JSON.stringify(connection)` on the second argument. The payload must therefore be JSON-serialisable: `fromNode` / `toNode` are `InternalNode`s, and `JSON.stringify` throws on a circular reference.
  - Add a vitest to `describe('getFinalClickConnectionState (#6117)')`: with a preview whose `fromNode` is a real `store.nodeLookup` entry, `expect(() => JSON.stringify(store.getFinalClickConnectionState())).not.toThrow()`, and the parsed object `toMatchObject({ isValid: null, toNode: null, toHandle: null, toPosition: null })` without `inProgress`. That is exactly what the e2e asserts.
  - If either fails because of a cycle, find which angflow field on the internal node or handle creates it. Fix it in the library: the payload keeps upstream's fields (it is not `structuredClone`d, and fields aren't dropped to make the test pass). Don't edit the fixture or the e2e spec. If the only fix would change the payload's shape, stop and report to the controller.
- [ ] **Step 5: Verify.**
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache. Run the examples unit tests (flow-props) and `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build`.
  - Re-run `e2e/click-connect.spec.ts` (chromium, `FRAMEWORK=ng`). Both `pane click cancels a pending connection (click-connect)` and `(click-connect-selection)` pass in the blocking project, together with the rest of the file.
- [ ] **Step 6: Commit.**
  ```bash
  git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts \
    packages/angular/src/lib/components/handle/handle.component.ts packages/angular/src/lib/components/handle/handle.component.spec.ts \
    packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/container/ng-flow/ng-flow.pane-click.spec.ts \
    examples/angular/src/app/examples/add-node-on-edge-drop/add-node-on-edge-drop.component.ts \
    examples/angular/src/app/generic-tests/flow-props.ts examples/angular/src/app/generic-tests/flow-props.spec.ts \
    tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  feat(angular)!: (connectEnd) / (clickConnectEnd) carry FinalConnectionState (#6117)

  (connectEnd) emits { event, connectionState } like (reconnectEnd), and
  (clickConnectEnd) emits { event, connectionState } from the new
  FlowStore.getFinalClickConnectionState(): the preview line's final state
  with `to` in flow coordinates, or the empty state. Each click-end site reads
  the state before it clears the armed handle. The generic test host forwards
  the state as upstream's second argument, and the two "pane click cancels a
  pending connection" known failures are removed.

  Ported from xyflow/xyflow#6117 (63b6e0295)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

## Checkpoint B (after Task 7)

Same steps as Checkpoint A, with these differences:
- The verdict expects `known failures: 2 entries` (the colour-mode ones, `owner: 'D'`), with `STALE (now passing): 0` and `NOT MATCHED: 0`. Both `pane click cancels a pending connection` tests are in the passing set of the blocking `chromium` project.
- The verbatim-paths command drops `tests/playwright/known-failures.ng.ts` from its path list; Task 7 edited that file. Then run `git diff 3b96f518e -- tests/playwright/known-failures.ng.ts` and check that it only deletes the two click-connect entries and their section comment.

---

### Task 8 (opus): `paneDragThreshold` in XYPanZoom and the Angular API rename (#6115, part 1)

Upstream merge `d0338b48a` (b1ad016 + 59dffc0ec + 2bc771f5b). Hand-port `git diff d0338b48a^1 d0338b48a -- packages/system`: `types/panzoom.ts`, `xypanzoom/XYPanZoom.ts`, `xypanzoom/eventhandler.ts`, `xypanzoom/utils.ts`, `xypanzoom/index.ts`.

Restated decisions this task relies on:
- **API:**
  - `PanZoomUpdateOptions.paneDragThreshold: number` replaces `paneClickDistance` and `selectionOnDrag`;
  - `PanZoomInstance.setClickDistance` is removed;
  - `ZoomPanValues.pointerDrag` replaces `usedRightMouseButton`;
  - `isLeftClickPan` is exported from `xypanzoom/utils.ts` and `xypanzoom/index.ts`.
- **Angular:**
  - `[paneDragThreshold]` (default 1) replaces `[paneClickDistance]` (default 0), and `FlowStore.paneDragThreshold = signal(1)` replaces `paneClickDistance`;
  - `onPaneClick` drops its manual distance check and `panePointerDownPos`. As in upstream React's Pane, d3-zoom's `clickDistance(threshold)` suppresses the click after a real pan;
  - `onPanePointerDown` stays: it still resets the swallow flags. No aliases.
- **Keep (Spec deviation 1 and Global Constraints):**
  - the start handler's `if (event.sourceEvent?.internal) return;` guard, and `zoomPanValues.mouseButton = event.sourceEvent?.button || 0;`. A programmatic transition (null `sourceEvent`) still calls `onPanZoomStart` and sets `isZoomingOrPanning`; only `mousedown`/`touchstart` create a `pointerDrag`;
  - `event: any` typing;
  - handlers re-created only when `!userSelectionActive`, while `clickDistance` is set on every `update()`;
  - `destroy()` and the filter.
- **Interactions** (spec item 6):
  - A threshold change during a marquee takes effect after it. The filter rejects every event while `userSelectionActive`.
  - A marquee's pointerdown is `preventDefault`ed, so d3 never sees a mousedown and `pointerDrag` stays `null`. Auto-pan transforms during a marquee take the `!pointerDrag` path and still reach `onTransformChange`; `XYPanZoom.spec.ts` `'propagates programmatic transforms during box selection'` must stay green.
  - The touchstart capture handler still kills d3's touchstart for a selecting touch.
  - Angflow passes no `onPaneContextMenu` to `update()`, so the right-click hunk lands but stays inert.
- **Behaviour (changelog):** a pane press below the threshold fires no `(moveStart)`/`(moveEnd)` and doesn't set `paneDragging`.
- The marquee itself still starts on pointerdown in this task. Task 9 adds its threshold (Spec deviation 5).

**Files:**
- Modify: `packages/system/src/types/panzoom.ts`, `packages/system/src/xypanzoom/XYPanZoom.ts`, `packages/system/src/xypanzoom/eventhandler.ts`, `packages/system/src/xypanzoom/utils.ts`, `packages/system/src/xypanzoom/index.ts`
- Create: `packages/system/src/xypanzoom/eventhandler.spec.ts`
- Modify: `packages/system/src/xypanzoom/XYPanZoom.spec.ts` (`updateOptions` ~:39-40; `setup()` returns its `onDraggingChange`; one new describe)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`:
  - `paneClickDistance` input ~:507 and its doc;
  - store mirror ~:814;
  - the pan/zoom effect's dependency reads ~:893, :899;
  - `panePointerDownPos`, `onPanePointerDown`, `onPaneClick` ~:1068-1158;
  - `updatePanZoomOptions` ~:1250, :1261.
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`paneClickDistance` ~:234)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.pane-click.spec.ts` (`'with paneClickDistance > 0, …'` ~:381)
- Modify: `examples/angular/src/app/examples/click-distance/click-distance.component.ts`, `examples/angular/src/app/examples/figma/figma.component.ts` (~:40), `examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts` (`paneClickDistance` ~:92,175,227,306,606-607)

- [ ] **Step 1: Normalise** every existing file above.
- [ ] **Step 2: Failing tests.**
  - `eventhandler.spec.ts`. It drives the exported handlers directly with fake `D3ZoomEvent`s:
    ```ts
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
    import { zoomIdentity, type ZoomTransform } from 'd3-zoom';
    import { createPanZoomStartHandler, createPanZoomHandler, createPanZoomEndHandler } from './eventhandler';
    import type { ZoomPanValues } from './XYPanZoom';

    const T0 = zoomIdentity;
    const T1 = zoomIdentity.translate(30, 0);
    const T2 = zoomIdentity.scale(2);
    const mouse = (type: string, x = 0, y = 0, button = 0) => ({ type, clientX: x, clientY: y, button });
    const touches = (type: string, pts: [number, number, number][]) => ({
      type, touches: pts.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
    });
    const ev = (sourceEvent: unknown, transform: ZoomTransform = T0) => ({ sourceEvent, transform }) as never;

    function harness(threshold: number, extra: { panOnDrag?: boolean | number[]; onPaneContextMenu?: (e: unknown) => void } = {}) {
      const zoomPanValues: ZoomPanValues = {
        isZoomingOrPanning: false, prevViewport: { x: 0, y: 0, zoom: 1 }, mouseButton: 0,
        timerId: undefined, panScrollTimeout: undefined, isPanScrolling: false, pointerDrag: null,
      };
      const d3Selection = { property: vi.fn() };
      const spies = {
        onDraggingChange: vi.fn(), onPanZoomStart: vi.fn(), onPanZoom: vi.fn(),
        onPanZoomEnd: vi.fn(), onTransformChange: vi.fn(),
      };
      const start = createPanZoomStartHandler({
        zoomPanValues, paneDragThreshold: threshold, onDraggingChange: spies.onDraggingChange, onPanZoomStart: spies.onPanZoomStart,
      });
      const zoom = createPanZoomHandler({
        zoomPanValues, d3Selection: d3Selection as never, paneDragThreshold: threshold,
        onDraggingChange: spies.onDraggingChange, onPanZoomStart: spies.onPanZoomStart,
        onPanZoom: spies.onPanZoom, onTransformChange: spies.onTransformChange,
      });
      const end = createPanZoomEndHandler({
        zoomPanValues, panOnDrag: extra.panOnDrag ?? true, panOnScroll: false,
        onDraggingChange: spies.onDraggingChange, onPanZoomEnd: spies.onPanZoomEnd, onPaneContextMenu: extra.onPaneContextMenu,
      });
      return { zoomPanValues, d3Selection, spies, start, zoom, end };
    }

    describe('pan/zoom pointer-drag threshold (#6115)', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('a mouse press below the threshold restores __zoom and reports nothing', () => {
        const h = harness(5);
        h.start(ev(mouse('mousedown', 0, 0)));
        h.zoom(ev(mouse('mousemove', 3, 0), T1));
        expect(h.d3Selection.property).toHaveBeenCalledWith('__zoom', T0);
        h.end(ev(mouse('mouseup', 3, 0)));
        vi.runAllTimers();
        for (const spy of Object.values(h.spies)) expect(spy).not.toHaveBeenCalled();
      });

      it('crossing the threshold starts the move and the dragging state', () => {
        const h = harness(5);
        h.start(ev(mouse('mousedown', 0, 0)));
        h.zoom(ev(mouse('mousemove', 10, 0), T1));
        expect(h.spies.onPanZoomStart).toHaveBeenCalledTimes(1);
        expect(h.spies.onDraggingChange).toHaveBeenCalledWith(true);
        expect(h.spies.onTransformChange).toHaveBeenCalledWith([30, 0, 1]);
        expect(h.spies.onPanZoom).toHaveBeenCalledTimes(1);
        h.end(ev(mouse('mouseup', 10, 0), T1));
        vi.runAllTimers();
        expect(h.spies.onDraggingChange).toHaveBeenLastCalledWith(false);
        expect(h.spies.onPanZoomEnd).toHaveBeenCalledTimes(1);
      });

      it('a threshold of 0 starts on press', () => {
        const h = harness(0);
        h.start(ev(mouse('mousedown', 0, 0)));
        expect(h.spies.onPanZoomStart).toHaveBeenCalledTimes(1);
        expect(h.spies.onDraggingChange).toHaveBeenCalledWith(true);
      });

      it('a single touch respects the threshold and never sets dragging', () => {
        const h = harness(5);
        h.start(ev(touches('touchstart', [[1, 0, 0]])));
        h.zoom(ev(touches('touchmove', [[1, 3, 0]]), T1));
        expect(h.d3Selection.property).toHaveBeenCalledWith('__zoom', T0);
        expect(h.spies.onTransformChange).not.toHaveBeenCalled();
        h.zoom(ev(touches('touchmove', [[1, 10, 0]]), T1));
        expect(h.spies.onTransformChange).toHaveBeenCalled();
        expect(h.spies.onDraggingChange).not.toHaveBeenCalledWith(true);
      });

      it('a second touch (pinch) or a lost first touch starts at once', () => {
        const pinch = harness(50);
        pinch.start(ev(touches('touchstart', [[1, 0, 0]])));
        pinch.zoom(ev(touches('touchmove', [[1, 0, 0], [2, 1, 1]]), T2));
        expect(pinch.spies.onTransformChange).toHaveBeenCalledWith([0, 0, 2]);
        const lost = harness(50);
        lost.start(ev(touches('touchstart', [[1, 0, 0]])));
        lost.zoom(ev(touches('touchmove', [[2, 1, 1]]), T1));
        expect(lost.spies.onTransformChange).toHaveBeenCalled();
      });

      it('a wheel zoom while the button is held becomes the new resting transform', () => {
        const h = harness(5);
        h.start(ev(mouse('mousedown', 0, 0)));
        h.zoom(ev({ type: 'wheel' }, T2));
        expect(h.spies.onTransformChange).toHaveBeenCalledWith([0, 0, 2]);
        expect(h.spies.onPanZoomStart).toHaveBeenCalledTimes(1);
        expect(h.spies.onDraggingChange).not.toHaveBeenCalled();
        h.zoom(ev(mouse('mousemove', 1, 0), T1));
        expect(h.d3Selection.property).toHaveBeenLastCalledWith('__zoom', T2);
      });

      it('a right-click pan without movement still reports a context menu', () => {
        const onPaneContextMenu = vi.fn();
        const h = harness(5, { panOnDrag: [2], onPaneContextMenu });
        h.start(ev(mouse('mousedown', 0, 0, 2)));
        h.end(ev(mouse('mouseup', 0, 0, 2)));
        expect(onPaneContextMenu).toHaveBeenCalledTimes(1);
      });

      it('programmatic transitions (null sourceEvent) keep angflow behaviour: start, zoom and end are reported', () => {
        const h = harness(5);
        h.start(ev(null));
        expect(h.spies.onPanZoomStart).toHaveBeenCalledWith(null, { x: 0, y: 0, zoom: 1 });
        expect(h.zoomPanValues.isZoomingOrPanning).toBe(true);
        expect(h.zoomPanValues.pointerDrag).toBeNull();
        h.zoom(ev(null, T1));
        expect(h.spies.onTransformChange).toHaveBeenCalledWith([30, 0, 1]);
        expect(h.spies.onPanZoom).toHaveBeenCalledTimes(1);
        h.end(ev(null, T1));
        vi.runAllTimers();
        expect(h.spies.onDraggingChange).toHaveBeenCalledWith(false);
        expect(h.spies.onPanZoomEnd).toHaveBeenCalledTimes(1);
      });
    });
    ```
    Note: a `0` threshold makes `pointerDrag` cross immediately in the start handler (`startPointerDrag`).
  - `XYPanZoom.spec.ts`:
    - `updateOptions` uses `paneDragThreshold: 1` in place of `paneClickDistance: 0, selectionOnDrag: true`;
    - `setup()` creates the `onDraggingChange` spy as a named `const` (today it is an inline `vi.fn()` in the `XYPanZoom({...})` call) and returns it: `return { domNode, onTransformChange, onDraggingChange, panZoom };`;
    - add the describe below. Its `domNode` must be attached to `document.body`: d3-zoom's click suppressor (`dragEnable(view, true)`) is a capture listener on `window`, and only clicks dispatched to an element in the document pass through it. Detach it again in `afterEach`.
    ```ts
    describe('XYPanZoom paneDragThreshold (#6115)', () => {
      let attached: HTMLElement | null = null;
      function setupAttached() {
        const s = setup();
        document.body.appendChild(s.domNode);
        attached = s.domNode;
        s.onTransformChange.mockClear();
        s.onDraggingChange.mockClear();
        return s;
      }
      afterEach(() => {
        attached?.remove();
        attached = null;
      });
      const opts = (x: number) => ({ bubbles: true, cancelable: true, view: window, clientX: x, clientY: 100, button: 0 });
      function press(domNode: HTMLElement, dx: number) {
        domNode.dispatchEvent(new MouseEvent('mousedown', opts(100)));
        window.dispatchEvent(new MouseEvent('mousemove', opts(100 + dx)));
        window.dispatchEvent(new MouseEvent('mouseup', opts(100 + dx)));
        const click = vi.fn();
        domNode.addEventListener('click', click);
        domNode.dispatchEvent(new MouseEvent('click', opts(100 + dx)));
        return click;
      }

      it('below the threshold: no transform, no dragging, __zoom unchanged, the click is kept', () => {
        const { domNode, panZoom, onTransformChange, onDraggingChange } = setupAttached();
        panZoom.update(updateOptions(onTransformChange, { paneDragThreshold: 5 }));
        const click = press(domNode, 3);
        expect(onTransformChange).not.toHaveBeenCalled();
        expect(onDraggingChange).not.toHaveBeenCalled();
        expect((domNode as unknown as { __zoom: { x: number; k: number } }).__zoom).toMatchObject({ x: 0, k: 1 });
        expect(click).toHaveBeenCalledTimes(1);
      });

      it('past the threshold: pans, toggles dragging, and d3 suppresses the click', () => {
        const { domNode, panZoom, onTransformChange, onDraggingChange } = setupAttached();
        panZoom.update(updateOptions(onTransformChange, { paneDragThreshold: 5 }));
        const click = press(domNode, 20);
        expect(onTransformChange).toHaveBeenCalled();
        expect(onDraggingChange).toHaveBeenNthCalledWith(1, true);
        expect(onDraggingChange).toHaveBeenLastCalledWith(false);
        expect(click).not.toHaveBeenCalled();
      });
    });
    ```
    `setupAttached()` clears both spies, because `setup()`'s initial `update()` may already have called them. `afterEach` must be in this file's `vitest` import.
  - `ng-flow.pane-click.spec.ts`: replace `'with paneClickDistance > 0, …'` with:
    ```ts
    it('the click after a connection drop consumes its flag, whatever paneDragThreshold is', () => {
      const { inst, store, paneClickSpy } = setup();
      inst.fixtureRef.setInput('paneDragThreshold', 5);
      store.updateConnection({ ...makeInProgressConnection() });
      inst.onPanePointerUp(makePanePointerUp('mouse'));
      store.cancelConnection();
      inst.onPaneClick(makePaneClick(100, 100));
      expect(paneClickSpy).not.toHaveBeenCalled();
      expect((inst as any).connectionEndedOnPane).toBe(false);
      inst.onPanePointerDown({ clientX: 200, clientY: 200 } as PointerEvent);
      inst.onPaneClick(makePaneClick(200, 200));
      expect(paneClickSpy).toHaveBeenCalledTimes(1);
    });

    it('onPaneClick measures no distance: a click that arrives is a pane click (d3-zoom suppresses post-pan clicks)', () => {
      const { inst, paneClickSpy } = setup();
      inst.fixtureRef.setInput('paneDragThreshold', 5);
      inst.onPanePointerDown({ clientX: 0, clientY: 0 } as PointerEvent);
      inst.onPaneClick(makePaneClick(100, 100));
      expect(paneClickSpy).toHaveBeenCalledTimes(1);
    });

    it('paneDragThreshold defaults to 1 and reaches the store', () => {
      const { inst, store } = setup();
      expect(store.paneDragThreshold()).toBe(1);
      inst.fixtureRef.setInput('paneDragThreshold', 7);
      // run change detection / effects the way the other setInput tests in this file do
      expect(store.paneDragThreshold()).toBe(7);
    });
    ```
  - Run the two system spec files and `ng-flow.pane-click.spec.ts`. Expected:
    - the new system cases fail (unknown options/params; `usedRightMouseButton` in the type);
    - `programmatic transitions` passes once it compiles (a pin; it fails only if upstream's `!sourceEvent` guard is copied);
    - the Angular cases fail: no such input, and the manual distance check drops the 100px click.
- [ ] **Step 3: System hand-port.**
  - `types/panzoom.ts`: `paneDragThreshold: number;` in place of `paneClickDistance: number; selectionOnDrag?: boolean;`. Delete `setClickDistance` from `PanZoomInstance`.
  - `xypanzoom/utils.ts`: add `export const isLeftClickPan = (panOnDrag: boolean | number[]) => panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(0));`. `xypanzoom/index.ts`: `export { isLeftClickPan } from './utils';`.
  - `XYPanZoom.ts`:
    - `ZoomPanValues`: delete `usedRightMouseButton`; add `pointerDrag` with upstream's type and field comments, verbatim. Initial value `pointerDrag: null`.
    - `update()`: destructure `paneDragThreshold` (drop the two old fields).
    - Replace the `clickDistance(...)` call with `const dragThreshold = isNumeric(paneDragThreshold) && paneDragThreshold > 0 ? paneDragThreshold : 0; d3ZoomInstance.clickDistance(dragThreshold);`. Keep it where it is: before `if (!userSelectionActive)`, so it runs on every update.
    - Inside `if (!userSelectionActive)`:
      - `createPanZoomStartHandler({ zoomPanValues, paneDragThreshold: dragThreshold, onDraggingChange, onPanZoomStart })`;
      - `createPanZoomHandler({ zoomPanValues, d3Selection, paneDragThreshold: dragThreshold, onPanZoomStart, onPanZoom, onDraggingChange, onTransformChange })`;
      - the end handler call is unchanged.
    - Delete `setClickDistance` and its return entry.
  - `eventhandler.ts`:
    - `PanZoomStartParams` gains `paneDragThreshold: number`.
    - `PanZoomParams` becomes `{ zoomPanValues; d3Selection: D3SelectionInstance; paneDragThreshold; onDraggingChange; onTransformChange; onPanZoomStart?; onPanZoom? }`.
    - Add upstream's `startMove`, `startPointerDrag`, `isPointerMove` and `getPointerPosition` helpers, verbatim, with `sourceEvent` typed `any` where upstream uses `XYFlowSourceEvent`.
    - Start handler: keep angflow's head (`if (event.sourceEvent?.internal) return;`, the `viewport`, `mouseButton = event.sourceEvent?.button || 0`, `isZoomingOrPanning = true`, `prevViewport`). Then port upstream's body:
      - `zoomPanValues.pointerDrag = null;`;
      - for `mousedown`/`touchstart`, create `pointerDrag` and call `startPointerDrag` when the threshold is `0`, then `return`;
      - otherwise `onPanZoomStart?.(event.sourceEvent, viewport)`.

      Delete the old `if (… === 'mousedown') onDraggingChange(true);`.
    - Zoom handler: upstream's body, verbatim (the `pointerDrag` block, then `!sourceEvent?.sync` → `onTransformChange`, then `onPanZoom` guarded by `(!pointerDrag || pointerDrag.moveStarted)`), reading `event.sourceEvent` as `any`. Delete the `usedRightMouseButton` assignment.
    - End handler: keep angflow's head. Add `const pointerDrag = zoomPanValues.pointerDrag; zoomPanValues.pointerDrag = null;`. The context-menu condition uses `!pointerDrag?.thresholdCrossed`, with upstream's comment. Delete `usedRightMouseButton = false`. Add `if (pointerDrag && !pointerDrag.moveStarted) return;` before `onDraggingChange(false)`.
    - Drop now-unused imports; lint will tell you which.
  - Run `git diff d0338b48a -- packages/system/src/xypanzoom packages/system/src/types/panzoom.ts` and read it. What's left should be only:
    - the kept divergences (`update()` teardown, `!userSelectionActive` handler re-creation, the filter, `destroy()`, the start guard, `any` typing);
    - angflow-only code (extent cache, `setViewportConstrained`, etc.).
- [ ] **Step 4: Angular.**
  - `NgFlowComponent`:
    - replace the `paneClickDistance` input with
      ```ts
      /**
       * Pixels the pointer must move on the pane before a pan or a box selection starts
       * (upstream `paneDragThreshold`). A press that moves less is a click. 0 starts at once.
       */
      readonly paneDragThreshold = input(1);
      ```
    - the store mirror becomes `this.store.paneDragThreshold.set(this.paneDragThreshold())`;
    - the pan/zoom effect reads `this.paneDragThreshold()` in place of `this.paneClickDistance()`. Delete its `this.effectiveSelectionOnDrag();` read only if nothing in `updatePanZoomOptions` uses it any more (the template's `[selectionOnDrag]` binding stays);
    - `updatePanZoomOptions`: delete `selectionOnDrag:` and `paneClickDistance:`; add `paneDragThreshold: this.paneDragThreshold(),`;
    - delete `panePointerDownPos`, its write in `onPanePointerDown` and the `panePointerDownPos = null` lines;
    - in `onPaneClick`, delete the `threshold` block and reword the swallow comment (drop "Consumed before the paneClickDistance check …").
  - `FlowStore`: `readonly paneDragThreshold = signal(1);`.
  - Examples:
    - `click-distance.component.ts` mirrors upstream `ClickDistance`:
      - the field is `paneDragThreshold = signal(0)`;
      - the binding is `[paneDragThreshold]="paneDragThreshold()"`;
      - the label reads `pane drag threshold: {{ paneDragThreshold() }}px`, with `aria-label="Pane drag threshold"`;
      - the description reads "How far the pointer must move before a pane press becomes a pan. Below it the press is a click (watch the console)."
      - Keep the route and component names.
    - `figma.component.ts`: `[paneDragThreshold]="100"`.
    - `kitchen-sink.component.ts`: rename `paneClickDistance` to `paneDragThreshold` in the type, the default (now `1`), the `Behavior` key list, the binding and the slider (label `paneDragThreshold (…)`).
  - `grep -rn "paneClickDistance\|setClickDistance\|usedRightMouseButton" packages/{system,angular}/src examples/angular/src` shows nothing.
- [ ] **Step 5: Verify.**
  - `cd packages/system && npx vitest run`. `XYPanZoom.spec.ts` `'propagates programmatic transforms during box selection'` is green.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm typecheck && PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache. Then run (chromium, `FRAMEWORK=ng`):
    - `e2e/pane.spec.ts` (all, including the CDP touch tests `:219`, `:237`);
    - `e2e/click-connect.spec.ts` (`:39`, `:70`);
    - `e2e/nodes.spec.ts` (`:20`, `:51`);
    - `e2e/viewport.spec.ts` (`:34` all four transitions, `:59`, `:81`).

    All green.
  - Run `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build`.
- [ ] **Step 6: Commit.**
  ```bash
  git add packages/system/src/types/panzoom.ts packages/system/src/xypanzoom/XYPanZoom.ts packages/system/src/xypanzoom/eventhandler.ts \
    packages/system/src/xypanzoom/utils.ts packages/system/src/xypanzoom/index.ts packages/system/src/xypanzoom/eventhandler.spec.ts \
    packages/system/src/xypanzoom/XYPanZoom.spec.ts packages/angular/src/lib/container/ng-flow/ng-flow.component.ts \
    packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/container/ng-flow/ng-flow.pane-click.spec.ts \
    examples/angular/src/app/examples/click-distance/click-distance.component.ts \
    examples/angular/src/app/examples/figma/figma.component.ts examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts
  git commit -F- <<'EOF'
  feat!: paneDragThreshold replaces paneClickDistance in pan/zoom (#6115)

  XYPanZoom tracks mouse and touch presses (pointerDrag). A pan starts only
  once the pointer passes paneDragThreshold; below it d3's stored transform is
  restored and no start/dragging/end is reported, so the press stays a click.
  Pinches and wheel zooms during a press start at once. PanZoomUpdateOptions
  gains paneDragThreshold and loses paneClickDistance/selectionOnDrag,
  setClickDistance is removed, and isLeftClickPan is exported. Angular:
  [paneDragThreshold] (default 1) replaces [paneClickDistance] (default 0);
  onPaneClick drops its own distance check. Programmatic transitions still
  report moveStart/moveEnd (angflow's start-handler guard is kept).

  Ported from xyflow/xyflow#6115 (d0338b48a)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 9 (opus): Marquee waits for `paneDragThreshold`; `drag-threshold` example; touch matrix (#6115, part 2)

The reference is upstream React's Pane `onPointerMove` (`git show upstream/main:packages/react/src/container/Pane/index.tsx`, the `requiredDistance` block).

Restated decisions this task relies on:
- **The threshold.** The marquee waits until `Math.hypot(current − screenStart) > (selectionKeyActive ? 0 : paneDragThreshold)`, where `screenStart = rendererPointToPoint(selectionOrigin, transform)`. Only then does it:
  - set `moved`;
  - set `selectionInProgress`;
  - emit `(selectionStart)`;
  - write `userSelectionRect`;
  - select nodes;
  - auto-pan.
- **Spec deviation 5:** pointerdown no longer writes the zero-size `userSelectionRect`, and `(selectionEnd)` fires only after a crossing.
- **Kept divergence:** `userSelectionActive` is still set on pointerdown (the box-select guard depends on it). On a press that never crosses the threshold, `finishSelection` clears it and `userSelectionRect` on pointerup/pointercancel (and on destroy). Because `moved` stays false, `selectionInProgress` and `nodesSelectionActive` are never set and `(selectionEnd)` isn't emitted. The following click therefore reaches `onPaneClick` and fires `(paneClick)`.
- **Open question 4 default:** upstream's `resetSelectedElements()` at the crossing is not ported.
- **Open question 6 default:** the implementer runs the DevTools emulation matrix. The real-device row is recorded as "pending (user)".
- The local `isLeftClickPan` is replaced by the system export from Task 8.

**Files:**
- Modify: `packages/angular/src/lib/container/pane/pane.component.ts` (`isLeftClickPan` const ~:13-14; `draggable`; `onPointerDown` ~:147-198; `onPointerMove` ~:200-220; `finishSelection`)
- Create: `packages/angular/src/lib/container/pane/pane.drag-threshold.spec.ts`
- Create: `examples/angular/src/app/examples/drag-threshold/drag-threshold.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts` (import + `HARNESS_ROUTES` entry after `Click distance`)

- [ ] **Step 1: Normalise** `pane.component.ts` and `app.routes.ts`.
- [ ] **Step 2: Failing tests.** In `pane.drag-threshold.spec.ts`, copy these helpers:
  - `FakeResizeObserver`, `setSignalInput` and `stubDomNode` from `pane.selection-target-guard.spec.ts`;
  - the `pointerEvent` helper from `pane.auto-pan.spec.ts`.

  Install the listener with `pane.initSelectionListener()`, as `pane.auto-pan.spec.ts` does.
  ```ts
  describe('PaneComponent marquee paneDragThreshold (#6115)', () => {
    let fixture: ComponentFixture<PaneComponent>;
    let pane: PaneComponent;
    let store: FlowStore;
    let el: HTMLElement;
    const starts = vi.fn();
    const ends = vi.fn();
    const down = (x: number, y: number) => el.dispatchEvent(pointerEvent('pointerdown', { x, y }));
    const move = (x: number, y: number) => document.dispatchEvent(pointerEvent('pointermove', { x, y }));
    const up = (x: number, y: number) => document.dispatchEvent(pointerEvent('pointerup', { x, y }));

    beforeEach(() => {
      // stubGlobal ResizeObserver / matchMedia and configure TestBed as pane.selection-target-guard.spec.ts does
      fixture = TestBed.createComponent(PaneComponent);
      pane = fixture.componentInstance;
      store = TestBed.inject(FlowStore);
      el = fixture.nativeElement;
      setSignalInput(pane, 'selectionOnDrag', true);
      setSignalInput(pane, 'panOnDrag', [1, 2]);
      setSignalInput(pane, 'autoPanOnSelection', false);
      stubDomNode(store);
      pane.initSelectionListener();
      starts.mockClear();
      ends.mockClear();
      pane.selectionStart.subscribe(starts);
      pane.selectionEnd.subscribe(ends);
    });
    afterEach(() => {
      fixture.destroy();
      vi.unstubAllGlobals();
    });

    it('no rect, no selectionInProgress and no (selectionStart) at or below the threshold', () => {
      store.paneDragThreshold.set(5);
      down(100, 100);
      move(103, 104); // exactly 5px: not past it
      expect(store.userSelectionRect()).toBeNull();
      expect(store.selectionInProgress()).toBe(false);
      expect(starts).not.toHaveBeenCalled();
      expect(store.userSelectionActive()).toBe(true); // kept: set on press
    });

    it('crossing the threshold starts the marquee once; (selectionEnd) follows on release', () => {
      store.paneDragThreshold.set(5);
      down(100, 100);
      move(106, 100);
      move(120, 110);
      expect(starts).toHaveBeenCalledTimes(1);
      expect(store.selectionInProgress()).toBe(true);
      expect(store.userSelectionRect()).toMatchObject({ x: 100, y: 100, width: 20, height: 10 });
      up(120, 110);
      expect(ends).toHaveBeenCalledTimes(1);
    });

    it('a press that never crosses leaves no selection state, so its click is a pane click', () => {
      store.paneDragThreshold.set(5);
      down(100, 100);
      move(102, 100);
      up(102, 100);
      expect(store.userSelectionActive()).toBe(false);
      expect(store.userSelectionRect()).toBeNull();
      expect(store.selectionInProgress()).toBe(false);
      expect(store.nodesSelectionActive()).toBe(false);
      expect(ends).not.toHaveBeenCalled();
    });

    it('with the selection key held the threshold is 0', () => {
      store.paneDragThreshold.set(50);
      store.selectionKeyActive.set(true);
      down(100, 100);
      move(100.5, 100);
      expect(starts).toHaveBeenCalledTimes(1);
    });
  });
  ```
  - Run `cd packages/angular && npx vitest run src/lib/container/pane`. Expected:
    - the first and third cases fail: the rect is written and `(selectionStart)` emitted on press, and `(selectionEnd)` is emitted without movement;
    - the selection-key case passes (a pin).
  - The existing `pane.auto-pan.spec.ts`, `pane.selection-class.spec.ts` and `pane.selection-target-guard.spec.ts` must stay green. Their moves are well past 1px. If one asserts a rect or `(selectionStart)` right after pointerdown, move that assertion after its first move. That is the behaviour change; say so in the commit body.
- [ ] **Step 3: Implement** (`PaneComponent`):
  - Import `isLeftClickPan` from `@angflow/system` and delete the local const. `draggable` becomes `computed(() => isLeftClickPan(this.panOnDrag()))`.
  - `onPointerDown`:
    - keep everything up to and including `this.store.userSelectionActive.set(true);`;
    - delete the `userSelectionRect.set({ … width: 0 … })` block and the `this.selectionStart.emit(event);` line;
    - keep the listener registration.
  - `onPointerMove`: after computing `this.pointerPosition`, replace the "first actual movement" block with:
    ```ts
    // Upstream Pane onPointerMove: the marquee starts only once the pointer passes
    // paneDragThreshold (0 while the selection key is held). Below it, the press is a click.
    if (!this.moved) {
      if (!this.selectionOrigin) return;
      const start = rendererPointToPoint(this.selectionOrigin, this.store.transform());
      const required = this.store.selectionKeyActive() ? 0 : this.store.paneDragThreshold();
      if (Math.hypot(this.pointerPosition.x - start.x, this.pointerPosition.y - start.y) <= required) return;
      this.moved = true;
      this.store.selectionInProgress.set(true);
      this.selectionStart.emit(event);
    }
    ```
    Then `updateSelectionFromPointer()` and `scheduleAutoPan()`, as today. The `pointerPosition` computation must come before this block, so move the `containerEl`/`bounds` lines up if needed.
  - `finishSelection`: `if (event && emitEnd && moved) this.selectionEnd.emit(event);`. Update the doc comment.
- [ ] **Step 4: Example.** Port upstream `examples/react/src/examples/DragThreshold/index.tsx` to `drag-threshold.component.ts`:
  ```ts
  import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
  import { NgFlowComponent, PanelComponent, BackgroundComponent, applyNodeChanges } from '@angflow/angular';
  import type { Node, NodeChange } from '@angflow/angular';
  import { ExampleCardComponent } from '@examples-shared/example-card.component';

  const PAN_ON_DRAG: Record<string, boolean | number[]> = {
    true: true, false: false, '[1, 2]': [1, 2], '[0, 1, 2]': [0, 1, 2], '[2]': [2],
  };

  @Component({
    selector: 'app-drag-threshold-example',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgFlowComponent, PanelComponent, BackgroundComponent, ExampleCardComponent],
    template: `
      <app-example-card
        title="Drag threshold"
        description="nodeDragThreshold and paneDragThreshold decide when a press becomes a drag; below them it is a click. The log lists clicks, moves and selections (port of upstream DragThreshold)."
      >
        <ng-flow
          [nodes]="nodes"
          [nodeDragThreshold]="dragThreshold()"
          [paneDragThreshold]="paneDragThreshold()"
          [snapToGrid]="snapGridSize() > 0"
          [snapGrid]="[snapGridSize() || 15, snapGridSize() || 15]"
          [selectionOnDrag]="selectionOnDrag()"
          [panOnDrag]="panOnDragValue()"
          [fitView]="true"
          (nodesChange)="onNodesChange($event)"
          (nodeClick)="log('node click: node ' + $event.node.id)"
          (paneClick)="log('pane click')"
          (paneContextMenu)="onPaneContextMenu($event)"
          (moveStart)="log('move start')"
          (moveEnd)="log('move end')"
          (selectionStart)="log('selection start')"
          (selectionEnd)="log('selection end')"
        >
          <ng-flow-background [gap]="snapGridSize() || 20" />
          <ng-flow-panel position="top-left">
            <div class="dt-panel">
              <label>nodeDragThreshold
                <input type="number" min="0" [value]="dragThreshold()" (input)="dragThreshold.set(+$any($event.target).value)" />
              </label>
              <label>paneDragThreshold
                <input type="number" min="0" [value]="paneDragThreshold()" (input)="paneDragThreshold.set(+$any($event.target).value)" />
              </label>
              <label>panOnDrag
                <select [value]="panOnDrag()" (change)="panOnDrag.set($any($event.target).value)">
                  @for (option of panOnDragOptions; track option) { <option [value]="option">{{ option }}</option> }
                </select>
              </label>
              <label>selectionOnDrag
                <input type="checkbox" [checked]="selectionOnDrag()" (change)="selectionOnDrag.set($any($event.target).checked)" />
              </label>
              <label>snapGrid size (0 = off)
                <input type="number" min="0" [value]="snapGridSize()" (input)="snapGridSize.set(+$any($event.target).value)" />
              </label>
              <button type="button" (click)="messages.set([])">clear</button>
              <ul>
                @for (message of messages(); track message) { <li>{{ message }}</li> }
              </ul>
            </div>
          </ng-flow-panel>
        </ng-flow>
      </app-example-card>
    `,
    styles: [`
      :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
      .dt-panel { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 5px;
        background: var(--xy-node-background-color-default, #fff); color: var(--xy-node-color-default, #222);
        border: var(--xy-node-border-default, 1px solid #1a192b); font-size: 12px; }
      .dt-panel ul { margin: 0; padding-left: 20px; }
      .dt-panel button { align-self: flex-start; }
    `],
  })
  export class DragThresholdExampleComponent {
    readonly panOnDragOptions = Object.keys(PAN_ON_DRAG);
    readonly dragThreshold = signal(1);
    readonly paneDragThreshold = signal(1);
    readonly selectionOnDrag = signal(true);
    readonly panOnDrag = signal('[1, 2]');
    readonly snapGridSize = signal(0);
    readonly messages = signal<string[]>([]);
    readonly panOnDragValue = computed(() => PAN_ON_DRAG[this.panOnDrag()]);
    private count = 0;

    nodes: Node[] = [
      { id: '1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: '2', data: { label: 'Node 2' }, position: { x: 200, y: 100 } },
      { id: '3', data: { label: 'Node 3' }, position: { x: 0, y: 200 } },
    ];

    onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
    onPaneContextMenu(event: MouseEvent): void { event.preventDefault(); this.log('pane context menu'); }
    log(message: string): void {
      this.count += 1;
      this.messages.update((list) => [`#${this.count} ${message}`, ...list].slice(0, 10));
    }
  }
  ```
  - In `app.routes.ts`, import it and add `{ name: 'Drag threshold', path: 'drag-threshold', component: DragThresholdExampleComponent },` after the `Click distance` row (match the column alignment).
  - If `ng build` flags a template type (for example the `snapGrid` tuple), fix it with a typed `computed`, not `$any`.
- [ ] **Step 5: Verify.**
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache. Run `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build` and `… run build:zoneless`.
  - Then run (chromium, `FRAMEWORK=ng`):
    - `e2e/pane.spec.ts`, all, including `:58`, `:82`, `:185`, `:219`, `:237`, `:263`, `:293`;
    - `e2e/click-connect.spec.ts`, including `:39` and `:70`;
    - `e2e/nodes.spec.ts`, including `:20`, `:51` and `:150`;
    - `e2e/viewport.spec.ts`.

    All green.
- [ ] **Step 6: Touch matrix** (at most 20 minutes; `ng serve`, route `drag-threshold`; Chrome DevTools touch emulation, e.g. through the claude-in-chrome tools if available). Record each row as pass/fail in your report. Task 12 copies the result into the D1 results:
  1. a tap, and a tap with sub-threshold jitter, fire `(paneClick)` and don't pan;
  2. a drag pans only past the threshold;
  3. a pinch zooms immediately;
  4. with the selection key held, a touch marquee starts at 0px;
  5. a touch node drag is unaffected;
  6. `paneDragThreshold = 0` behaves like 0.3.x panning;
  7. real touch device: "pending (user)" (Open question 6 default).
- [ ] **Step 7: Commit.**
  ```bash
  git add packages/angular/src/lib/container/pane/pane.component.ts packages/angular/src/lib/container/pane/pane.drag-threshold.spec.ts \
    examples/angular/src/app/examples/drag-threshold/drag-threshold.component.ts examples/angular/src/app/app.routes.ts
  # plus any existing pane spec you had to adjust (name it in the body)
  git commit -F- <<'EOF'
  feat(angular): the box-selection marquee waits for paneDragThreshold (#6115)

  As upstream's Pane onPointerMove: the marquee starts, emits
  (selectionStart), draws its rect, selects and auto-pans only once the
  pointer passes paneDragThreshold (0 while the selection key is held).
  (selectionEnd) fires only after a marquee started, and a press that never
  crosses leaves no selection state, so its click is a pane click.
  userSelectionActive is still set on press. Unlike upstream, the crossing
  does not call resetSelectedElements() (not in the D1 spec). The pane uses
  the system's isLeftClickPan. New example: drag-threshold (port of upstream
  DragThreshold).

  Ported from xyflow/xyflow#6115 (d0338b48a)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

## Checkpoint C (after Task 9)

Same as Checkpoint B: 2 known failures (colour-mode), `STALE 0`, and the verbatim-paths check without `known-failures.ng.ts`. In addition:
- run `grep -rn "paneClickDistance\|setClickDistance\|nodeClickDistance" packages/{system,angular,mcp}/src examples/angular/src README.md packages/angular/AGENT_BRIDGE.md`. Expected: nothing;
- the `drag-threshold` route renders in `ng serve` (at most 10 minutes).

---

### Task 10 (sonnet): `fitView` / `fitBounds` resolve `boolean`; `measureFitView` / `measureFitBounds` (#6064 remainder)

Upstream: `fitViewport` on `upstream/main` (`git show upstream/main:packages/system/src/utils/graph.ts`, ~376-409) returns `Promise<boolean>`. Hand-port.

Restated decisions this task relies on:
- `fitViewport` resolves `true` when there is nothing to fit, and otherwise `panZoom.setViewport(...)`'s boolean.
- `FitViewResult` and `ZOOM_CLAMP_EPSILON` are deleted. The viewport computation moves into an angflow-only `@internal` export, `getFitViewport(params, options): Viewport | null` (`null` = nothing to fit), which `fitViewport` calls.
- **Angular:**
  - `FlowStore.fitView` / `fitBounds` and the fit chains are typed `boolean`; with no panZoom they resolve `false`, and `settlePendingFits` resolves `false`;
  - `NgFlowService.fitView(): Promise<boolean>`;
  - `NgFlowService.fitBounds(bounds, options?: FitBoundsOptions & { minZoom?: number; maxZoom?: number }): Promise<boolean>`. `minZoom`/`maxZoom` are an angflow extension, and `ease`/`interpolate` pass through.
- **Agent:**
  - new `NgFlowService.measureFitView(options)` / `measureFitBounds(bounds, options)` return `{ zoom, clamped } | null` (`null` = nothing to fit, or no panZoom). They are `@internal` bridge helpers like `hasOnBeforeDeleteHook`, and README/the migration guide don't list them;
  - the `fit_view`, `fit_bounds` and `layout_nodes` handlers measure **before** starting the fit, `await` the fit for `ended`, and return `{ zoom: m?.zoom ?? NaN, clamped: m?.clamped ?? false, ended }`;
  - **Spec deviation 6 / Open question 2 default:** `NaN`, not `null`. It serialises to JSON `null`, so the wire is byte-identical, and the in-process `callTool` result is unchanged;
  - **Spec deviation 7 / Open question 3 default:** overlapping fits each report their own target `zoom`/`clamped`; `ended` is shared;
  - no schema change, so no snapshot regeneration in this task. `AGENT_BRIDGE.md` changes.
- Padding defaults stay `0.1` in this task; Task 11 changes them.

**Files:**
- Modify: `packages/system/src/utils/graph.ts` (`ZOOM_CLAMP_EPSILON`, `fitViewport`, new `getFitViewport`; imports)
- Modify: `packages/system/src/types/general.ts` (delete `FitViewResult` ~:178-200)
- Test: `packages/system/src/utils/graph.spec.ts` (`describe('fitViewport')`)
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`FitResolver`, `createFitResolver` ~:66-78; `fitView` / `fitBounds` ~:919-961; `runFitChain`, `settlePendingFits`, `resolveFitView` ~:1176-1240; imports)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`fitView` / `fitBounds` ~:110-146; new `measureFitView` / `measureFitBounds` next to `hasOnBeforeDeleteHook`)
- Modify: `packages/angular/src/lib/public-api.ts` (drop `FitViewResult,`)
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (import ~:15; `fit_view` ~:746-757; `fit_bounds` ~:889-894; `layout_nodes` ~:1227-1238)
- Modify: `packages/angular/AGENT_BRIDGE.md` (the `**FitViewResult**` paragraph ~:189; `layout_nodes` Returns `fit: { zoom, clamped } | null` ~:199)
- Modify: `examples/angular/src/app/generic-tests/overrides/viewport/components/viewport-transitions-node.component.ts` (~:2, :7-8, :35)
- Test: `flow-store.service.spec.ts` (the fit-chain block ~:1118-1270), `ng-flow.service.spec.ts` (`describe('fitBounds')` ~:514), `agent-bridge.spec.ts` (`describe('fit clamp signal')` ~:2152; the `FitViewResult` import ~:11)

- [ ] **Step 1: Normalise** every file above.
- [ ] **Step 2: Failing tests.**
  - `graph.spec.ts`:
    - import `getFitViewport`;
    - rewrite the `fitViewport` cases to boolean results:
      - `ended`-true / interrupted cases: `expect(await fitViewport(...)).toBe(true)` / `.toBe(false)`;
      - the "nothing to fit" cases (empty lookup, `nodes: []`, all hidden, no fittable node #6158): `toBe(true)`, and `setViewport` not called;
    - move the zoom/clamp assertions to `getFitViewport` (same fixtures, no `panZoom`):
      - "too big" → `zoom ≈ minZoom 0.5`;
      - "fits" → `zoom` strictly inside `[0.5, 2]`;
      - "tiny board" → `zoom ≈ 2`;
      - the `minZoom` override is honoured;
    - add `getFitViewport` returns `null` for an empty lookup, for `nodes: []`, and for all-hidden nodes.
  - `flow-store.service.spec.ts`, fit-chain block: flip every `resolves.toMatchObject({ ended: X })` to `resolves.toBe(X)`, and every `{ zoom: NaN, clamped: false, ended: false }` to `false`. Keep each test's scenario: shared promise, non-fit interruption, `fitBounds` interrupting `fitView`, destroy settles, no panZoom.
  - `ng-flow.service.spec.ts` `describe('fitBounds')`:
    - the delegate test's `result` becomes `true`;
    - the options become `{ padding: 0.2, duration: 100, ease: (t: number) => t }`, and the test expects them to be passed through unchanged.

    Add `describe('measureFitView / measureFitBounds (@internal)')`:
    - `null` without panZoom;
    - with a stub panZoom (`store.panZoom.set({ setViewport: async () => true, getViewport: () => ({ x: 0, y: 0, zoom: 1 }) } as never)`, `store.width.set(800)`, `store.height.set(600)`):
      - `measureFitView()` for nodes `a` (0,0) and `b` (100000,0), each `{ width: 100, height: 50 }`, with `minZoom 0.5`, returns `{ zoom: ≈0.5, clamped: true }`;
      - for a single small node it returns `clamped: false`;
      - for no nodes it returns `null`;
    - `measureFitBounds({ x: 0, y: 0, width: 200, height: 100 }, { minZoom: 0.2 })` returns `clamped: false` and a finite zoom.
  - `agent-bridge.spec.ts`:
    - drop the `FitViewResult` import; type the cast in `'an interrupted fit_view resolves with ended: false'` as `{ zoom: number; clamped: boolean; ended: boolean }`;
    - add, inside `describe('fit clamp signal')` (reuse `stubPanZoom`):
    ```ts
    it('an interrupted fit still reports its target zoom and clamped', async () => {
      const { bridge, newFlow } = setup();
      const flow = newFlow();
      bridge.register('main', flow);
      flow.setNodes([makeNode('a', { width: 100, height: 50 }), makeNode('b', { position: { x: 100000, y: 0 }, width: 100, height: 50 })]);
      stubPanZoom(flow, vi.fn().mockResolvedValue(false));
      const res = (await bridge.callTool('fit_view', { duration: 500, minZoom: 0.5 })) as { zoom: number; clamped: boolean; ended: boolean };
      expect(res.ended).toBe(false);
      expect(res.clamped).toBe(true);
      expect(res.zoom).toBeCloseTo(0.5, 5);
    });

    it('a graph change during the animation does not change the reported target', async () => {
      const { bridge, newFlow } = setup();
      const flow = newFlow();
      bridge.register('main', flow);
      flow.setNodes([makeNode('a', { width: 100, height: 50 })]);
      let finish!: (ended: boolean) => void;
      stubPanZoom(flow, () => new Promise<boolean>((r) => (finish = r)));
      const expected = flow.measureFitView({})!.zoom;
      const call = bridge.callTool('fit_view', { duration: 500 });
      await Promise.resolve();
      flow.setNodes([makeNode('a', { width: 100, height: 50 }), makeNode('far', { position: { x: 50000, y: 0 }, width: 100, height: 50 })]);
      finish(true);
      expect(await call).toEqual({ zoom: expected, clamped: false, ended: true });
    });
    ```
    `'fit_view returns { zoom, clamped }'` stays **unchanged**: `typeof res.zoom === 'number'`, because `NaN` is a number.
  - Run the four spec files. Expected:
    - the system cases fail (`FitViewResult` objects; no `getFitViewport`);
    - the store cases fail (objects, not booleans);
    - the measure cases fail (no such methods);
    - the bridge's interrupted-target case passes (a pin: today's `FitViewResult` reports the target too), and the graph-change case fails (`measureFitView` doesn't exist).
- [ ] **Step 3: System.**
  ```ts
  /**
   * The viewport `fitViewport` animates to, or `null` when there is nothing to fit.
   * angflow-only: the agent bridge measures a fit's target with it before starting the fit.
   * @internal
   */
  export function getFitViewport<
    Params extends Omit<FitViewParamsBase<NodeBase>, 'panZoom'>,
    Options extends FitViewOptionsBase<NodeBase>
  >({ nodes, width, height, minZoom, maxZoom }: Params, options?: Omit<Options, 'nodes' | 'includeHiddenNodes'>): Viewport | null {
    if (nodes.size === 0) return null;
    const nodesToFit = getFitViewNodes(nodes, options);
    if (nodesToFit.size === 0) return null;
    const bounds = getInternalNodesBounds(nodesToFit);
    return getViewportForBounds(bounds, width, height, options?.minZoom ?? minZoom, options?.maxZoom ?? maxZoom, options?.padding ?? 0.1);
  }

  export async function fitViewport<
    Params extends FitViewParamsBase<NodeBase>,
    Options extends FitViewOptionsBase<NodeBase>
  >(params: Params, options?: Omit<Options, 'nodes' | 'includeHiddenNodes'>): Promise<boolean> {
    const viewport = getFitViewport(params, options);
    if (!viewport) return true;
    return params.panZoom.setViewport(viewport, {
      duration: options?.duration,
      ease: options?.ease,
      interpolate: options?.interpolate,
    });
  }
  ```
  - Keep `getFitViewNodes` exactly as it is (its size fallback is a kept divergence).
  - Delete `ZOOM_CLAMP_EPSILON` and the `FitViewResult` import. Delete the `FitViewResult` type from `types/general.ts`.
  - If the `Omit<Options, 'nodes' | 'includeHiddenNodes'>` quirk (copied from upstream's `fitViewport`) stops `getFitViewNodes` from typechecking, keep the shape `fitViewport` has today. An `options as FitViewOptionsBase<NodeBase>` cast at the `getFitViewNodes` / `getFitViewport` call site is also fine, as long as it changes no runtime value. Don't widen the exported signatures to `any`.
- [ ] **Step 4: Angular store and service.**
  - `FitResolver` / `createFitResolver` / `runFitChain`: `boolean` in place of `FitViewResult`.
  - `settlePendingFits`: `resolver?.resolve(false)`; its doc says "settle … with `false`".
  - `fitView`: `if (!pz) return Promise.resolve(false);`.
  - `fitBounds(bounds, options?: FitBoundsOptions & { minZoom?: number; maxZoom?: number }): Promise<boolean>`:
    ```ts
    if (!pz) return Promise.resolve(false);
    return this.runFitChain('fitBounds', () => {
      const viewport = getViewportForBounds(
        bounds, this.width(), this.height(),
        options?.minZoom ?? this.minZoom(), options?.maxZoom ?? this.maxZoom(), options?.padding ?? 0.1
      );
      return pz.setViewport(viewport, { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate });
    });
    ```
    Delete the clamp computation and the "1e-6 matches ZOOM_CLAMP_EPSILON" comment.
  - `resolveFitView` is unchanged apart from types.
  - `NgFlowService`:
    - `fitView(options?): Promise<boolean>`, with the doc "Resolves `true` when the fit ran to the end or there was nothing to fit, and `false` when a user gesture or another viewport call interrupted it, or pan/zoom isn't initialised. Overlapping `fitView` calls share one promise, which settles with the last fit's result.";
    - `fitBounds(bounds, options?: FitBoundsOptions & { minZoom?: number; maxZoom?: number }): Promise<boolean>`, with a matching doc;
    - add, next to `hasOnBeforeDeleteHook` and with the same `@internal` style:
    ```ts
    /** Zoom at or below `minZoom + FIT_CLAMP_EPSILON` counts as clamped at the floor. */
    // (module-level) const FIT_CLAMP_EPSILON = 1e-6;

    /**
     * @internal Agent-bridge helper, not public API (like hasOnBeforeDeleteHook): the zoom
     * `fitView(options)` would land on and whether the min-zoom floor clamps it, from the same
     * inputs as the fit. `null` when there is nothing to fit or pan/zoom isn't initialised.
     */
    measureFitView(options?: FitViewOptionsBase<NodeType>): { zoom: number; clamped: boolean } | null {
      if (!this.store.panZoom()) return null;
      const viewport = getFitViewport(
        { nodes: this.store.nodeLookup, width: this.store.width(), height: this.store.height(), minZoom: this.store.minZoom(), maxZoom: this.store.maxZoom() },
        options
      );
      if (!viewport) return null;
      const effMin = options?.minZoom ?? this.store.minZoom();
      return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + FIT_CLAMP_EPSILON };
    }

    /** @internal Agent-bridge helper: the target of `fitBounds(bounds, options)`; `null` without pan/zoom. */
    measureFitBounds(bounds: Rect, options?: { padding?: Padding; minZoom?: number; maxZoom?: number }): { zoom: number; clamped: boolean } | null {
      if (!this.store.panZoom()) return null;
      const effMin = options?.minZoom ?? this.store.minZoom();
      const effMax = options?.maxZoom ?? this.store.maxZoom();
      const viewport = getViewportForBounds(bounds, this.store.width(), this.store.height(), effMin, effMax, options?.padding ?? 0.1);
      return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + FIT_CLAMP_EPSILON };
    }
    ```
    - Cast `this.store.nodeLookup` only if the generic requires it, the same way `FlowStore.fitView` passes it to `fitViewport`.
    - Import `getFitViewport`, `getViewportForBounds`, `type Padding` and `type FitBoundsOptions` as needed. Drop `FitViewResult`.
  - `public-api.ts`: delete `FitViewResult,`.
  - **Instance types.** `packages/angular/src/lib/types/general.ts` already declares `FitView` (~:92) as `(fitViewOptions?) => Promise<boolean>`, and `ViewportHelperFunctions.fitBounds` as the system `FitBounds` (`(bounds, options?: FitBoundsOptions) => Promise<boolean>`). Check that `NgFlowService` is still assignable to `NgFlowInstance` / `ViewportHelperFunctions` wherever the code relies on it (`tsc` is the check; the `(init)` output emits the service). The new `fitBounds` options type `FitBoundsOptions & { minZoom?; maxZoom? }` is a supertype of `FitBoundsOptions`, so it stays assignable. Don't change those type aliases unless `tsc` requires it, and report any change.
- [ ] **Step 5: Bridge.**
  ```ts
  this.handlers.set('fit_view', async (flow, params) => {
    // … padding / duration / minZoom / nodes parsing unchanged …
    const options = { padding, duration, minZoom, nodes };
    // Measure first: an interrupted fit, or a graph change mid-animation, still reports this call's target.
    const target = flow.measureFitView(options);
    const ended = await flow.fitView(options);
    return { zoom: target?.zoom ?? NaN, clamped: target?.clamped ?? false, ended };
  });
  ```
  - `fit_bounds`: same pattern, with `flow.measureFitBounds(bounds, { padding, minZoom })` and `flow.fitBounds(bounds, { padding, duration, minZoom })`.
  - `layout_nodes`: `let fit: { zoom: number; clamped: boolean; ended: boolean } | null = null;`. Inside the existing `try`: `const target = flow.measureFitView({ minZoom }); const ended = await flow.fitView({ minZoom }); fit = { zoom: target?.zoom ?? NaN, clamped: target?.clamped ?? false, ended };`.
  - Delete the `FitViewResult` import.
  - `AGENT_BRIDGE.md`:
    - replace the `**FitViewResult**` paragraph with a **Fit result** paragraph (`fit_view`, `fit_bounds`, `layout_nodes`' `fit`). It says:
      - `{ zoom: number; clamped: boolean; ended: boolean }`, computed by the bridge, not a library type;
      - `zoom` and `clamped` are this call's target, measured before the animation starts, so an interrupted fit or a graph change mid-animation still reports the target;
      - `zoom` is JSON `null` when the fit is a no-op: nothing to fit, or the canvas isn't initialised (no panZoom);
      - `clamped` means the min-zoom floor limited the fit, and clamping at `maxZoom` is not flagged;
      - `ended` is `false` when a user gesture or another viewport call interrupted the animation, and when pan/zoom isn't initialised;
      - overlapping fits of the same kind share `ended` (the last one's), but each reports its own target `zoom`/`clamped`;
    - the `layout_nodes` row's Returns becomes `fit: { zoom, clamped, ended } | null`.
  - Tool descriptions don't change, so there's no snapshot regeneration. Check that `git diff packages/angular/src/lib/agent/tool-schemas.ts` is empty.
- [ ] **Step 6: Generic page** (`viewport-transitions-node.component.ts`):
  - drop the `FitViewResult` import;
  - the comment becomes `// every helper resolves a boolean: true when it ran to the end, false when interrupted.`;
  - `type Transition = () => Promise<boolean>;`;
  - in `track()`: `const ended = await transition();`.
- [ ] **Step 7: Verify.**
  - `cd packages/system && npx vitest run`.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `cd packages/mcp && npx vitest run` (drift green, no snapshot change).
  - `PATH="$SHIM:$PATH" corepack pnpm typecheck && PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache, then run `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests` and `e2e/viewport.spec.ts` (chromium). `:26-81` are green.
  - `grep -rn "FitViewResult\|ZOOM_CLAMP_EPSILON" packages/{system,angular,mcp}/src examples/angular/src packages/angular/AGENT_BRIDGE.md` shows nothing.
- [ ] **Step 8: Commit.**
  ```bash
  git add packages/system/src/utils/graph.ts packages/system/src/types/general.ts packages/system/src/utils/graph.spec.ts \
    packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts \
    packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts \
    packages/angular/src/lib/public-api.ts packages/angular/src/lib/agent/agent-bridge.service.ts \
    packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/AGENT_BRIDGE.md \
    examples/angular/src/app/generic-tests/overrides/viewport/components/viewport-transitions-node.component.ts
  git commit -F- <<'EOF'
  refactor!: fitView / fitBounds resolve boolean; FitViewResult removed

  As upstream 1.0: fitViewport resolves true (ran to the end, or nothing to
  fit) or false (interrupted); FlowStore/NgFlowService fitView and fitBounds
  follow (false without pan/zoom), and fitBounds passes ease/interpolate
  through. FitViewResult and ZOOM_CLAMP_EPSILON are removed. The viewport
  computation is the angflow-only @internal getFitViewport. The agent tools
  keep returning { zoom, clamped, ended }: the bridge measures the target with
  the new @internal measureFitView / measureFitBounds before starting the fit.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 11 (sonnet): Numeric fit padding is pixels, default `'5%'` (#5927)

Upstream merge `82e24caf8` (+ changesets `69dc311` / `7b52b50`). Hand-port. Upstream's `utils/constants.ts` is angflow's `packages/system/src/constants.ts`.

Restated decisions this task relies on:
- **System:**
  - `defaultFitViewPadding = '5%'`, used by `getFitViewport` (and so `fitViewport`);
  - `parsePadding` reads a number as `Math.floor(padding)` px;
  - `getViewportForBounds` gets the defaults `minZoom = 0`, `maxZoom = Infinity`, `padding = 0`;
  - `FitBoundsOptions.padding: Padding`.
- **Angular:** `FlowStore.fitBounds` and `NgFlowService.measureFitBounds` default to `defaultFitViewPadding`, and their `padding` is typed `Padding`.
- **Agent:**
  - `fit_view` / `fit_bounds` `padding: { type: ['number', 'string'] }`, with a description that spells out the units;
  - the handlers accept a finite number ≥ 0, or a string matching `^\d+(\.\d+)?(px|%)$`;
  - anything else, including the library's per-side object form, is `-32602`;
  - **Open question 5 default:** `null` counts as omitted.

**Files:**
- Modify: `packages/system/src/constants.ts` (add `defaultFitViewPadding` after `infiniteExtent`)
- Modify: `packages/system/src/utils/general.ts` (`parsePadding`, `getViewportForBounds`)
- Modify: `packages/system/src/utils/graph.ts` (`getFitViewport` default; import)
- Modify: `packages/system/src/types/general.ts` (`FitBoundsOptions.padding`)
- Test: `packages/system/src/utils/general.spec.ts`, `packages/system/src/utils/graph.spec.ts`
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (`fitBounds` default)
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (class doc example ~:50 `padding: 0.2`; `measureFitBounds` default)
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (`fitViewOptions` input doc ~:456)
- Modify: `packages/angular/src/lib/components/controls/controls.component.ts` (`fitViewOptions` input doc ~:123)
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`fit_view`, `fit_bounds` padding parsing; a new `optionalPadding` helper next to `optionalPositiveNumber`)
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (`fit_view` ~:317, `fit_bounds` ~:608)
- Modify: `packages/angular/AGENT_BRIDGE.md` (`fit_view`, `fit_bounds` rows ~:179, :185)
- Regenerate: `packages/mcp/src/generated/tool-schemas.ts`
- Modify: `packages/angular/examples/controlled-flow.example.ts` (~:106; Spec deviation 8)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Normalise** every file above.
- [ ] **Step 2: Failing tests.**
  - `general.spec.ts`. `parsePadding` is private, so test it through `getViewportForBounds`. The fixture is bounds `{ x: 0, y: 0, width: 100, height: 100 }` in a 400×400 viewport:
    ```ts
    describe('getViewportForBounds padding (#5927)', () => {
      const bounds = { x: 0, y: 0, width: 100, height: 100 };
      const zoomFor = (padding?: Padding) => getViewportForBounds(bounds, 400, 400, 0, 10, padding as Padding).zoom;

      it('a number is pixels per side', () => expect(zoomFor(20)).toBeCloseTo(3.6)); // (400 - 2*20) / 100
      it('0.1 is 0px, not a ratio', () => expect(zoomFor(0.1)).toBeCloseTo(4));
      it("'10%' is a share of the viewport", () => expect(zoomFor('10%')).toBeCloseTo(3.2));
      it("'20px' is pixels", () => expect(zoomFor('20px')).toBeCloseTo(3.6));
      it('an invalid value logs and counts as 0', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(zoomFor('abc' as Padding)).toBeCloseTo(4);
        expect(err).toHaveBeenCalled();
        err.mockRestore();
      });
      it('defaults: minZoom 0, maxZoom Infinity, padding 0', () => {
        expect(getViewportForBounds(bounds, 400, 400).zoom).toBeCloseTo(4);
        expect(getViewportForBounds({ x: 0, y: 0, width: 1, height: 1 }, 400, 400).zoom).toBeCloseTo(400);
      });
      it('object padding: numeric sides are pixels', () => {
        expect(zoomFor({ x: 20, top: '10%' })).toBeCloseTo(3.6);
        expect(zoomFor({ top: 10, right: '5%', bottom: '10px', left: 0 })).toBeCloseTo(3.8);
      });
    });
    ```
    Import `getViewportForBounds` and `type Padding` if they aren't imported yet.
  - `graph.spec.ts`: `it('defaults to 5% padding (#5927)')`. Use `getFitViewport({ nodes: buildLookup([sized('a', 0, 0)]), width: 800, height: 600, minZoom: 0.1, maxZoom: 100 })!.zoom`, and expect it `toBeCloseTo(7.2)`: `'5%'` of 800 is 40 per side, and (800 − 80) / 100 = 7.2. The legacy `0.1` gives ≈ 7.28.
  - `agent-bridge.spec.ts`, inside `describe('fit clamp signal')`:
    - `fit_view` with `padding: '10%'` and `fit_bounds` with `padding: '20px'` pass the string through (spy `toHaveBeenCalledWith(expect.objectContaining({ padding: '10%' }))`, and the bounds equivalent);
    - `padding: 40` is passed as `40`;
    - `padding: null` is passed as `undefined`;
    - each of `'ten'`, `'10em'`, `-5` and `{ top: 10 }` rejects with `{ code: -32602 }`, for both tools.
  - Run the three spec files. Expected:
    - the pixel cases fail (legacy maths);
    - the defaults case fails (`NaN` zoom without min/max);
    - `5%` fails (7.28);
    - the invalid padding cases resolve instead of rejecting.
- [ ] **Step 3: System.**
  - `constants.ts`:
    ```ts
    /** Default padding used by `fitView` / `fitBounds` when none is provided. */
    export const defaultFitViewPadding = '5%';
    ```
  - `parsePadding`: `if (typeof padding === 'number') return Math.floor(padding);`.
  - `getViewportForBounds(bounds, width, height, minZoom: number = 0, maxZoom: number = Infinity, padding: Padding = 0)`.
  - `graph.ts` `getFitViewport`: `options?.padding ?? defaultFitViewPadding` (import from `'../constants'`).
  - `types/general.ts`: `FitBoundsOptions.padding?: Padding`.
- [ ] **Step 4: Angular.**
  - `FlowStore.fitBounds` and `NgFlowService.measureFitBounds`: `options?.padding ?? defaultFitViewPadding`.
  - The class doc example: `zoomToFit() { this.flow.fitView({ padding: '10%' }); }`.
  - The `fitViewOptions` input docs (`NgFlowComponent`, `ControlsComponent`) gain: "`padding`: pixels when a number (`40` = 40px per side), or `'10%'` / `'20px'`; default `'5%'`."
  - `controlled-flow.example.ts`: `fitView({ padding: '10%' })`.
- [ ] **Step 5: Agent.**
  ```ts
  /** Fit padding param: pixels (a number >= 0) or '<n>px' / '<n>%'. null/undefined → the default. */
  function optionalPadding(params: Record<string, unknown>): number | `${number}px` | `${number}%` | undefined {
    const v = params['padding'];
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === 'string' && /^\d+(\.\d+)?(px|%)$/.test(v)) return v as `${number}px`;
    throw new InvalidParamsError('Param "padding" must be pixels (a number >= 0) or a string like "10%" or "20px".');
  }
  ```
  - `fit_view` / `fit_bounds` use `const padding = optionalPadding(params);`.
  - Schemas, both tools:
    ```ts
    padding: {
      type: ['number', 'string'],
      description:
        "Pixels when a number (40 = 40px per side). A string may be a percentage of the viewport ('10%') " +
        "or pixels ('20px'). Default '5%'. Not a ratio: 0.1 is 0px.",
    },
    ```
  - `AGENT_BRIDGE.md`:
    - the `fit_view` and `fit_bounds` rows read `padding?: number | string` with the same unit sentence;
    - add after the table: "The library's per-side padding object (`{ top, right, bottom, left, x, y }`) is not accepted by the tools (`-32602`), which keeps the schema simple for LLM providers."
  - Regenerate the snapshot. The drift test is green, and `git diff --stat packages/mcp` shows only `src/generated/tool-schemas.ts`.
- [ ] **Step 6: Verify.**
  - `cd packages/system && npx vitest run`.
  - `cd packages/angular && npx vitest run && npx tsc --noEmit`.
  - `cd packages/mcp && npx vitest run`.
  - `PATH="$SHIM:$PATH" corepack pnpm typecheck && PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the touched files.
  - Build both packages and drop the cache, then run `e2e/viewport.spec.ts` (chromium) and `PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build`.
  - Optional, at most 10 minutes: an example with `[fitView]="true"` frames as before.
- [ ] **Step 7: Commit.**
  ```bash
  git add packages/system/src/constants.ts packages/system/src/utils/general.ts packages/system/src/utils/graph.ts \
    packages/system/src/types/general.ts packages/system/src/utils/general.spec.ts packages/system/src/utils/graph.spec.ts \
    packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/ng-flow.service.ts \
    packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/components/controls/controls.component.ts \
    packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/tool-schemas.ts \
    packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/AGENT_BRIDGE.md \
    packages/mcp/src/generated/tool-schemas.ts packages/angular/examples/controlled-flow.example.ts
  git commit -F- <<'EOF'
  feat!: numeric fit padding is pixels, default '5%' (#5927)

  parsePadding reads a number as pixels (0.1 is 0px, no longer a ratio); fit
  padding defaults to '5%' (defaultFitViewPadding, close to the legacy 0.1);
  getViewportForBounds defaults minZoom 0 / maxZoom Infinity / padding 0; and
  FitBoundsOptions.padding is a Padding. Agent: fit_view / fit_bounds take a
  number (px) or '<n>%' / '<n>px' and describe the units; anything else
  (including the per-side object) is -32602. AGENT_BRIDGE.md and the
  @angflow/mcp snapshot are updated.

  Ported from xyflow/xyflow#5927 (82e24caf8)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

### Task 12 (sonnet): Release docs: changelogs, migration guide, report (memory skipped)

**Files:**
- Modify: `packages/angular/CHANGELOG.md`, `packages/system/CHANGELOG.md`, `packages/mcp/CHANGELOG.md` (the `### Breaking changes` placeholders from Task 0, and a few lines in existing subsections)
- Modify: `docs/reviews/2026-11-24-upstream-sync.md` (§2 rows, §3 rows, §5 row D, a new `### D1 — results`)
- Modify: `tests/playwright/known-failures.ng.ts` (the two colour-mode entries' `reason`)

**Memory is not updated** (user decision): don't touch `~/.claude/…/memory/`. Versions stay 0.2.0 / 0.4.0 / 0.1.0, unpublished.

**Inputs:**
- the spec, `docs/superpowers/specs/2026-11-25-api-alignment-d1-design.md`: its "Migration guide" section and its behaviour notes;
- the commit bodies `git log --format='%h %s%n%b' 3b96f518e..HEAD`;
- Task 9's touch-matrix results, which the controller passes in with this task.

- [ ] **Step 1: Normalise** the five files. Collect the SHAs with `git log --oneline 3b96f518e..HEAD`.
- [ ] **Step 2: Angular changelog** (`## 0.4.0 *(unreleased)*`). Replace the placeholder comment under `### Breaking changes` with:
  1. One sentence: "Upstream `@xyflow/system` 1.0 / React 13 API alignment. Renamed and removed APIs have no deprecated aliases."
  2. The spec's **migration guide**, verbatim: the four code blocks under `## Migration guide (0.4.0 changelog, "Breaking changes")` in `docs/superpowers/specs/2026-11-25-api-alignment-d1-design.md` (items 1–8). Copy them from that file, not from memory. List the two silent changes first, as the spec's Risks require. Add this bold line above the code blocks: "**Two changes compile silently:** `(connectEnd)` / `(clickConnectEnd)` handlers that read `$event.target` now get an object, and a numeric fit padding such as `0.1` now means 0px."
  3. The spec's **behaviour notes** (the "Behaviour notes for the same entry" list in the same section of `docs/superpowers/specs/2026-11-25-api-alignment-d1-design.md`), verbatim as a bullet list, plus:
     - "A press on an edge's reconnect anchor that doesn't start a drag no longer hides the edge" (Task 6);
     - "`(selectionEnd)` fires only after a marquee started" (Task 9);
     - "Programmatic viewport transitions still fire `(moveStart)`/`(moveEnd)`" (Task 8; this differs from upstream React);
     - "Crossing the marquee threshold doesn't reset the current selection: unlike upstream's Pane, angflow doesn't call `resetSelectedElements()` there" (Task 9, Open question 4 default; say so only if that default was kept).
  4. Under `### Added (additive API)`, append:
     - `HandleBounds`, `NodeHandle` exports;
     - `FlowStore.rawConnection` and `FlowStore.getFinalClickConnectionState()`;
     - the `drag-threshold` example (it lives in the examples app, so put it under a short "Examples" line).
- [ ] **Step 3: System changelog** (`## 0.2.0 *(unreleased)*`). Under `### Breaking changes`, the spec's system list, phrased precisely:
  - "`Handle` renamed `HandleBounds`; `NodeHandle` redefined (`Omit<HandleBounds, 'nodeId' | 'width' | 'height'>` with optional size); `HandleConnection` removed in favour of `NodeConnection` (#5987, #6114)";
  - "new `getConnectionLookupKey` / `getConnectionsFromLookup` (#6114)";
  - "`DragUpdateParams.nodeClickDistance` removed; XYDrag suppresses the click after a moved drag itself and binds once per element (#5556, #6168)";
  - "`PanZoomUpdateOptions.paneDragThreshold` replaces `paneClickDistance` / `selectionOnDrag`; `PanZoomInstance.setClickDistance` removed; `isLeftClickPan` exported (#6115)";
  - "XYHandle's final connection state reports `to` in flow coordinates (#6117)";
  - "`fitViewport` resolves `boolean`; `FitViewResult` removed; `@internal` `getFitViewport` added (#6064)";
  - "`defaultFitViewPadding` (`'5%'`); numeric padding is pixels; `getViewportForBounds` defaults `minZoom 0` / `maxZoom Infinity` / `padding 0`; `FitBoundsOptions.padding: Padding` (#5927)";
  - "the `toHandleBounds` fallback is removed from `getEdgePosition` (#5987)".
- [ ] **Step 4: mcp changelog** (`## 0.1.0 *(unreleased)*`). Under `### Breaking changes`:
  - "`get_handle_connections` removed; use `get_node_connections { nodeId, type?, handleId? }`";
  - "`fit_view` / `fit_bounds` `padding`: a number is pixels, strings `'10%'` / `'20px'` are accepted, default `'5%'`; other values are `-32602`".
- [ ] **Step 5: Report** (`docs/reviews/2026-11-24-upstream-sync.md`):
  - §2, the `nodeClickDistance` row and the `(connectEnd)` row: Status `D1 ✓ <sha>`. The SHAs are Task 3's, and Tasks 5–7's.
  - §3: append ` **D1 ✓** <sha(s)>` to the last cell of each of these rows (Spec deviation 9):
    - #5987 (Task 1);
    - #6114 (Task 2);
    - #5556 (Tasks 3–4);
    - #6117 (Tasks 5–7);
    - #6115 (Tasks 8–9);
    - #5927 (Task 11);
    - `setViewport` (B; plus Task 10 for `fitView`/`fitBounds`).

    The colour-mode, `@layer` and Changeset rows get ` → D2` / ` → D2` / ` → D3`.
  - §5: split row D into three rows:
    - **D1**: "Upstream 1.0 API and callback alignment (§3 rows 1–7). Spec: [design](../superpowers/specs/2026-11-25-api-alignment-d1-design.md), plan: [plan](../superpowers/plans/2026-11-25-api-alignment-d1.md). Done (unpublished, in system 0.2.0 / angular 0.4.0 / mcp 0.1.0)";
    - **D2**: "`forceColorMode`, `light-dark()`, `@layer xyflow`; the 2 colour-mode known failures";
    - **D3**: "`NodeChangeset` / `EdgeChangeset`".
  - Add `### D1 — results` after `### C — results`:
    - known failures 4 → 2: the two click-connect payload entries are fixed (Task 7), and the 2 colour-mode entries remain, re-pointed to D2;
    - the full verdict: 0 NOT MATCHED, 0 STALE, 0 chromium failures;
    - every D1 system change is a hand-port, plus the kept divergences (Spec deviation 1);
    - the touch matrix results from Task 9, with the real-device row "pending (user)". **The controller passes these results in with this task** (they are in Task 9's report, not in the repo). If they are missing, ask for them; don't re-run the matrix or invent results;
    - the commit range `3b96f518e..HEAD`.
- [ ] **Step 6: Known failures.** In the two `props.spec.ts` colour-mode entries, end each `reason` with ` Owner D2 (sub-project D2: forceColorMode / light-dark()).`. `owner` stays `'D'`.
- [ ] **Step 7: Verify.**
  - `PATH="$SHIM:$PATH" corepack pnpm lint`; `uvx codespell` on the five files.
  - `git diff --stat`: only the five files.
  - Every heading is still in order: `grep -n '^## \|^### ' packages/angular/CHANGELOG.md | head -12`.
- [ ] **Step 8: Commit.**
  ```bash
  git add packages/angular/CHANGELOG.md packages/system/CHANGELOG.md packages/mcp/CHANGELOG.md \
    docs/reviews/2026-11-24-upstream-sync.md tests/playwright/known-failures.ng.ts
  git commit -F- <<'EOF'
  docs: upstream 1.0 API alignment (D1) changelog, migration guide and report

  Breaking-changes sections and the migration guide for angular 0.4.0,
  system 0.2.0 and mcp 0.1.0 (unreleased); report §2/§3 rows marked D1 with
  SHAs, §5 row D split into D1/D2/D3, and D1 results. The two remaining
  colour-mode known failures now name D2.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
  EOF
  ```

---

## Final checkpoint (after Task 12)

Every Checkpoint A step, with the Checkpoint B differences: 2 known failures, and verbatim paths without `known-failures.ng.ts`. In addition:
- [ ] `git diff 3b96f518e -- tests/playwright/known-failures.ng.ts`:
  - removes exactly the two click-connect entries and their section comment (Task 7);
  - changes only the two colour-mode `reason` strings (Task 12).
- [ ] The spec's Done-when grep: `grep -rn "SystemHandle\|HandleConnection\|getHandleConnections\|selectHandleConnections\|get_handle_connections\|nodeClickDistance\|paneClickDistance\|setClickDistance\|FitViewResult" packages/{system,angular,mcp}/src examples/angular/src README.md packages/angular/AGENT_BRIDGE.md`. It returns nothing. Changelogs aren't in that path list.
- [ ] Versions: `grep -n '"version"' packages/{system,angular,mcp}/package.json` reads `0.2.0` / `0.4.0` / `0.1.0`. The snapshot stamp is `0.4.0`. Nothing is published: `npm view @angflow/angular version` is still the last published version.
- [ ] Run `PATH="$SHIM:$PATH" corepack pnpm build` (all three packages, including mcp).

---

## Final review (opus)

The final reviewer gets the diff `3b96f518e..HEAD`, the spec, and this plan. They check:

- [ ] **Constraints.**
  - The never-edit check passes: `git diff --quiet 3b96f518e..HEAD -- <the Checkpoint A list without known-failures.ng.ts>`.
  - `git diff --quiet upstream/main -- tests/playwright/e2e` passes.
  - `grep -rn "NgZone" packages/angular/src` finds nothing.
  - No CRLF churn: `git diff 3b96f518e..HEAD | grep -c $'\r'` is 0, and `git diff --stat` has no implausibly large file.
  - There are 13 commits (Tasks 0–12), plus any review-fix commits, which must be named in the report. Each has a conventional subject and both trailers: `git log --format=%B 3b96f518e..HEAD | grep -c "Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W"` equals the commit count.
  - The bodies of Tasks 1, 2, 3, 4, 5, 7, 8, 9 and 11 have their `Ported from xyflow/xyflow#…` line.
  - `uvx codespell $(git diff --name-only 3b96f518e..HEAD)` prints nothing.
- [ ] **No aliases.** No deprecated re-export, overload or no-op input survives:
  - `grep -rn "@deprecated" packages/angular/src packages/system/src` shows nothing new from D1;
  - no `Handle` type alias;
  - no `paneClickDistance` input.
- [ ] **Hand-ports match upstream, minus the kept divergences.** Read each of these and check that every remaining hunk is a listed divergence or angflow-only code:
  - `git diff d2bb47dc0 -- packages/system/src/xydrag/XYDrag.ts`;
  - `git diff d0338b48a -- packages/system/src/xypanzoom packages/system/src/types/panzoom.ts`;
  - `git diff 63b6e0295 -- packages/system/src/xyhandle/XYHandle.ts`;
  - `git diff f9420bc45 -- packages/system/src/utils/connections.ts`;
  - `git diff 82e24caf8 -- packages/system/src/utils/general.ts`.

  Specifically:
  - the start handler still uses `event.sourceEvent?.internal` (no `!sourceEvent ||`);
  - XYDrag keeps the abort block and the `touchmove` check;
  - `getFitViewNodes` is unchanged.
- [ ] **Correctness hot spots.**
  - **XYDrag:**
    - `preventNextClick` runs on `releasedOutside || nodePositionsChanged`, and its listener is removed by `setTimeout(0)`;
    - `dragStarted`/`autoPanStarted` reset on `start`;
    - `update()` returns early for the same element;
    - `destroy()` clears `domNode`;
    - the filter returns `false` without a bound node.
  - **Derived connection:**
    - `connection` is a `computed` that reads `transform` only while in progress;
    - every writer goes through `updateConnection` / `updateClickConnectPreview` / `cancelConnection`;
    - the from-node follow and `getStoreItems().connection` use the raw state;
    - no `connection.set(` remains.
  - **Click-end payloads:**
    - all three sites read `getFinalClickConnectionState()` before clearing (the pane emits before clearing);
    - the payload has no `inProgress` and no extra keys;
    - it is the empty state during a real drag;
    - it is built without `structuredClone`.
  - **Connect-event scope:**
    - `HandleComponent.onClick` calls no `onConnectStart`/`onConnectEnd`;
    - the reconnect order is `reconnectStart → connectStart … connectEnd → reconnectEnd`;
    - `(reconnectStart)` carries the pointerdown event;
    - `reconnectingEdgeId` is set in `onConnectStart`.
  - **Pan threshold:**
    - `__zoom` is restored below the threshold;
    - the end handler returns before `onDraggingChange(false)` when nothing moved;
    - auto-pan during a marquee still reaches `onTransformChange`;
    - `clickDistance` is set on every `update()`.
  - **Marquee:**
    - no rect and no `(selectionStart)` before the crossing;
    - `userSelectionActive` is cleared on a sub-threshold release;
    - `(selectionEnd)` only after a crossing.
  - **Fits:**
    - `fitView`/`fitBounds` resolve booleans everywhere (`false` without panZoom, `false` on destroy);
    - the bridge measures before it awaits;
    - its results are `{ zoom, clamped, ended }`, with `NaN` → JSON `null` (Open question 2 default);
    - `ease`/`interpolate` pass through `fitBounds`.
  - **Padding:**
    - the number is pixels;
    - the default is `'5%'` in `getFitViewport`, `FlowStore.fitBounds` and `measureFitBounds`;
    - agent validation rejects objects and bad strings with `-32602`.
- [ ] **Docs.**
  - `AGENT_BRIDGE.md` matches the handlers: the `get_node_connections` row, no `get_handle_connections`, the fit result paragraph, the `layout_nodes` fit shape, padding units, and the per-side object note.
  - The mcp drift test passes, with the stamp at `0.4.0`.
  - The angular changelog carries the spec's migration guide verbatim and every behaviour note.
  - The report rows' SHAs are correct.
- [ ] **Exit criteria.**
  - Run `CI=true PATH="$SHIM:$PATH" corepack pnpm install --frozen-lockfile`, `PATH="$SHIM:$PATH" corepack pnpm build`, `typecheck`, `lint` and `test`.
  - Run the examples unit tests, `check:generic-tests`, `build` and `build:zoneless`.
  - Run the full `test:angular` verdict, then once more with `--repeat-each=2`: the same command line as `test:angular`, with `--repeat-each=2` appended before `--reporter`.

**Done when** (spec):
- Items 0–9 have landed, each with its failing-first test.
- Vitest in system/angular/mcp, `pnpm typecheck`, `pnpm lint`, the three builds and the mcp schema-drift test are green.
- `pnpm --filter playwright test:angular` passes. Both `pane click cancels a pending connection` entries are removed and pass. `known-failures.ng.ts` holds exactly the 2 colour-mode entries (`owner: 'D'`, with a reason naming D2). `check-known-failures` reports 0 STALE and 0 NOT MATCHED.
- The touch matrix (Task 9) is recorded in the D1 results, with the real-device row pending the user.
- The Done-when grep returns nothing outside changelogs.
- The versions read 0.2.0 / 0.4.0 / 0.1.0, unpublished. The changelogs carry the merged B/C entries plus D1's breaking section. `AGENT_BRIDGE.md`, the mcp snapshot (stamped 0.4.0) and the report are updated. Memory is not.
