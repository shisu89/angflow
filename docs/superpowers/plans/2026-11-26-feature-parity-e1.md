# Upstream 1.0 API parity and deferred bugs — Implementation Plan (sub-project E1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining instance and hook gaps with upstream, and fix the two bugs D1 deferred. After E1:
- **selectors:** `NgFlowService` has `selectNode(id)`, `selectEdge(id)` and `selectInternalNodes(ids)` (React `useNode` / `useEdge` / `useInternalNodes`);
- **update APIs:** `updateNode` / `updateNodeData` / `updateEdge` / `updateEdgeData` take `options?: { replace: boolean }`. The `*Data` updater receives the node or edge. `updateNode` emits Svelte-style split `'position'` / `'data'` / `'update'` changes;
- **reparenting:** `changeParent(nodeId, parentId | null)` exists, through system `changeParentNode`. `setNodeGroup` delegates to it;
- **pan/zoom while connecting:** XYPanZoom receives `connectionInProgress`, so a connection drag blocks pinch and pan;
- **context menu:** with `panOnDrag` including `2`, a right-drag pan no longer fires `(paneContextMenu)`, and a plain right-click still does (emitted by XYPanZoom).

**Release:** the single final release is unchanged: system 0.2.0, angular 0.4.0, mcp 0.1.0, unpublished. E1 adds changelog entries under those headings. No agent tool schema changes, so the mcp snapshot stays untouched.

**Spec:** `docs/superpowers/specs/2026-11-26-feature-parity-e1-design.md`. It is the contract.

**BASE:** `4bee7e139` (`docs: E1 API parity design spec`). D3 (`1284ea381..c351d7b25`) is on `main`, pushed, and CI is green.

## Task map

| Task | Model | What | Spec § |
|---|---|---|---|
| 1 | sonnet | `selectNode` / `selectEdge` / `selectInternalNodes`, and a `selectInternalNode` equality check | 1 |
| 2 | opus | Update APIs (`{ replace }`, node/edge updater argument, Svelte split), system `changeParentNode` port, `changeParent`, `setNodeGroup` delegation | 2, 3 |
| 3 | sonnet | Pan/zoom `connectionInProgress` and the right-click context-menu fix; manual check; checkpoint | 4, 5 |
| 4 | sonnet | Changelogs, README, report (and `AGENT_BRIDGE.md` if needed) | Docs |

## Spec deviations

None at plan time. Implementers report any they need.

## Global Constraints

- **Never edit** these. Verify before every commit with `git diff --quiet HEAD -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts packages/react packages/svelte packages/vue examples/react examples/svelte examples/vue examples/astro-xyflow` (exit 0).
  - `tests/playwright/e2e/**`
  - `tests/playwright/playwright.{shared,react,svelte,vue}.config.ts`
  - `packages/{react,svelte,vue}/**`
  - `examples/{react,svelte,vue,astro-xyflow}/**` (the reference you port *from*)

  Never edit a spec to make it pass. `tests/playwright/known-failures.ng.ts` stays an empty array.
- **Breaking-change policy: match upstream fully.** Add no overload or flag that keeps the old `data` updater argument.
- **Porting rule (system).**
  - Copy from `upstream/main` with `git show upstream/main:<path>`, `packages/system` paths only.
  - Never cherry-pick.
  - Never take upstream's `packages/system/package.json` version line.
  - The commit body has `Ported from xyflow/xyflow#5939 (8843870d5)`.
- **Zoneless rules (CLAUDE.md):**
  - never inject `NgZone`;
  - views update through signal writes;
  - APIs must exist in Angular 19.
- **Build order and the Angular cache.**
  - `examples/angular` and e2e consume `dist/`. Rebuild system, then angular.
  - **Then delete `examples/angular/.angular/cache`** before any e2e run, example build or examples `ng test`.
  - **Before every e2e run, run `fuser -k 4201/tcp 2>/dev/null || true`.**
- **Line endings.** The working tree may be CRLF while the index is LF.
  - Normalise before editing: `sed -i 's/\r$//' <files>`.
  - New files are LF.
  - Before each commit, `git diff --stat` must have no file whose changed-line count is about its length.
- **pnpm isn't on PATH.** Every `corepack pnpm …` runs as `PATH="$SHIM:$PATH" corepack pnpm …`, with `SHIM=/tmp/claude-1000/-run-media-shisu-OS-Code-products-web-angflow/40b950f6-b40d-44c0-b6e9-00aaacaa06f9/scratchpad/pnpm-shim`.
  - If that directory is gone, recreate it: `mkdir -p "$SHIM" && corepack enable pnpm --install-directory "$SHIM"`.
  - Shell state doesn't persist, so put the prefix on each command.
- **Focused e2e runs need `FRAMEWORK=ng`**, plus `-c playwright.angular.config.ts --project=chromium`.
- **Lint and codespell in every verify step.**
  - Run `PATH="$SHIM:$PATH" corepack pnpm lint`.
  - Run `uvx codespell <files you changed or added>`: no output.
  - Codespell lower-cases whole words without splitting camelCase. Avoid a single lowercase letter glued to a capitalised word, and avoid two-letter abbreviations of common words. Rename an identifier rather than extend `.codespellrc`.
  - Angular non-spec files forbid `any`, and unused variables start with `_`. Watch for now-unused imports after removals.
- **No dependency changes.** `package.json` dependencies and `pnpm-lock.yaml` stay untouched.
- **Changelogs.** Tasks 1–3 don't edit `CHANGELOG.md`; Task 4 writes E1's entries from the commit bodies. Put whatever a release note needs into your commit body.
- **Known failures (checkpoint verdict):** `known failures: 0 entries`, `NOT MATCHED: 0`, `WRONG FILE: 0`, `STALE (now passing): 0`, `chromium failures: 0`, `verdict: OK`.
- **Commits:** trunk-based on `main`.
  - Stage explicit paths (never `git add -A`), and run `git status --short` first.
  - Use conventional subjects; breaking changes carry `!`.
  - Write messages with `git commit -F- <<'EOF' … EOF`, ending in exactly:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01TsDvoakbnQWDQDb6ZCYo5W
    ```
  - Subagents use exactly these trailers. The model name is intentional.
- **Locate code by symbol.** Line numbers are hints as of BASE.
- **Self-contained tasks.** An implementer sees its task, these Global Constraints and "Commands used throughout". If the two disagree, the task text wins and the reviewer flags it.

### Commands used throughout (part of Global Constraints)

```bash
SHIM=/tmp/claude-1000/-run-media-shisu-OS-Code-products-web-angflow/40b950f6-b40d-44c0-b6e9-00aaacaa06f9/scratchpad/pnpm-shim

# Build (root), then drop the Angular CLI cache
PATH="$SHIM:$PATH" corepack pnpm -F @angflow/system build && PATH="$SHIM:$PATH" corepack pnpm -F @angflow/angular build && rm -rf examples/angular/.angular/cache

# vitest, one file (from the package dir)
cd packages/system && npx vitest run src/changes/changes.spec.ts
cd packages/angular && npx vitest run src/lib/<path>.spec.ts

# Typecheck / lint (root)
cd packages/angular && npx tsc --noEmit
PATH="$SHIM:$PATH" corepack pnpm typecheck
PATH="$SHIM:$PATH" corepack pnpm lint

# Codespell (root)
uvx codespell <files…>

# Example builds
PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build
PATH="$SHIM:$PATH" corepack pnpm -F angular-examples run build:zoneless

# Examples unit tests (needs build + cache drop)
PATH="$SHIM:$PATH" corepack pnpm -F angular-examples exec ng test --watch=false --include='src/app/generic-tests/**/*.spec.ts'

# Stale server, then one e2e spec (from tests/playwright)
fuser -k 4201/tcp 2>/dev/null || true
cd tests/playwright && PATH="$SHIM:$PATH" FRAMEWORK=ng npx playwright test -c playwright.angular.config.ts e2e/<spec>.spec.ts --project=chromium

# Full verdict (root)
PATH="$SHIM:$PATH" corepack pnpm --filter playwright test:angular

# subflows helper vs upstream (must be empty)
git diff --no-index <(git show upstream/main:packages/system/src/utils/subflows.ts) packages/system/src/utils/subflows.ts
```

---

## Preflight (no commit)

- [ ] **Step 1: Base.** `git status --short` is empty, and `git rev-parse --short HEAD` is `4bee7e139` (or the plan commit on top of it). Then run `git fetch upstream`, and `git rev-parse 8843870d5 upstream/main` resolves.
- [ ] **Step 2: Shim.** `PATH="$SHIM:$PATH" pnpm --version` prints a version.
- [ ] **Step 3: Baseline.** D3's final checkpoint (c351d7b25) was green: system 187, angular 1112, mcp 65, examples 6, e2e verdict OK. Re-run only `PATH="$SHIM:$PATH" corepack pnpm test` to confirm.

---

## Tasks

### Task 1 (sonnet): Selectors

**Files:** `packages/angular/src/lib/services/ng-flow.service.ts`, `services/ng-flow.service.spec.ts`; `types/general.ts` only if `NgFlowInstance` already lists `select*` members (check first).

- [ ] **Step 1: `selectNode(id): Signal<NodeType | undefined>`.**
  - It is `computed(() => this.store.nodes().find(n => n.id === id))`, or a lookup through `store.nodeLookup.get(id)?.internals.userNode` if that is equivalent and cheaper. Check that `userNode` is the same object as the entry in `nodes()`.
  - Default equality, so it notifies only when the node object changes.
  - JSDoc: "Equivalent to React's `useNode()`".
- [ ] **Step 2: `selectEdge(id): Signal<EdgeType | undefined>`.** The same over `store.edges()` (or `store.edgeLookup`). JSDoc: "Equivalent to React's `useEdge()`".
- [ ] **Step 3: `selectInternalNodes(ids: readonly string[]): Signal<InternalNode<NodeType>[]>`.**
  - It tracks `store.version()`, collects `nodeLookup.get(id)` for each unique id in the given order, and skips missing ids. An empty `ids` gives `[]`.
  - It uses `equal: (a, b) => a.length === b.length && a.every((n, i) => n === b[i])`.
  - JSDoc: "Equivalent to React's `useInternalNodes()`".
- [ ] **Step 4: `selectInternalNode` equality.**
  - Write a spec first: an unrelated node moves, and the signal's consumer for node `a` should not be notified (use an `effect` counter, or compare `computed` reads with a spy).
  - If it fails today, add `equal: Object.is` semantics. A `computed`'s default `equal` is already `Object.is`, so the likely problem is a new lookup entry per update. In that case, record the finding in the commit body and leave the behaviour as it is: the lookup entry is legitimately replaced when the node changes.
  - Only change code if a genuine spurious notification exists.
- [ ] **Step 5: Specs.** For each new selector, cover:
  - the initial value;
  - the update when its element changes;
  - no notification when another element changes;
  - the missing id;
  - for `selectInternalNodes`: order, duplicates, and an empty array.

  Use `TestBed.flushEffects()` / `fixture.whenStable()` as the existing selector specs do.
- [ ] **Step 6: Verify.** Angular vitest, `tsc`, `typecheck`, `lint` and codespell all pass.
- [ ] **Step 7: Commit** as `feat(service): selectNode, selectEdge and selectInternalNodes signals`.

### Task 2 (opus): Update APIs and `changeParent`

**Files:**
- Create: `packages/system/src/utils/subflows.ts`
- Modify: `packages/system/src/utils/index.ts`, `packages/angular/src/lib/services/ng-flow.service.ts`, `types/general.ts` (`NgFlowInstance`), the agent bridge only if a call site needs it, and specs (`ng-flow.service.spec.ts`, `ng-flow.component.spec.ts`, `agent/agent-bridge.spec.ts`), plus any caller the compiler flags, including `examples/angular`.

- [ ] **Step 1: System port.**
  - `git show upstream/main:packages/system/src/utils/subflows.ts > packages/system/src/utils/subflows.ts`.
  - Add `export * from './subflows';` to `utils/index.ts`, where upstream has it.
  - The subflows diff command prints nothing.
  - Commit it on its own as `feat(system): add changeParentNode helper`, with the `Ported from` line.
- [ ] **Step 2: `updateNode(id, nodeUpdate, options = { replace: false })`.** Mirror Svelte's `updateNode` (`git show upstream/main:packages/svelte/src/lib/hooks/useSvelteFlow.svelte.ts`, around lines 375–405):
  - an unknown id returns early;
  - resolve the updater against the current node;
  - `replace && isNode(next)` gives `[replaceChange(next)]`;
  - otherwise, split `{ position, data, ...rest }`:
    - `positionChange(id, position)` if x or y differs;
    - `dataChange(id, data, true)` if `data` is present and `data !== node.data`;
    - `updateChange(id, rest)` if `Object.keys(rest).length > 0`;
  - send everything to the store in one `triggerNodeChanges` call. Skip the call if there are no changes.

  Use angflow's `isNode` / `isEdge` helpers if they exist; otherwise import them from where the library already gets them. A key set to `undefined` in `rest` must still clear the field; there is an existing spec for it.
- [ ] **Step 3: `updateEdge(id, edgeUpdate, options)`.** The same, without a position.
- [ ] **Step 4: `updateNodeData(id, dataUpdate, options = { replace: false })`.**
  - The updater receives the **node**: `typeof dataUpdate === 'function' ? dataUpdate(node) : dataUpdate`.
  - Emit `dataChange(id, next, true)` when `options.replace` is set, otherwise `dataChange(id, next)`.
  - The types follow React's `types/instance.ts`: `Partial<NodeType['data']> | ((node: NodeType) => Partial<NodeType['data']>)`.
  - `updateEdgeData` is the same, with `(edge: EdgeType) => Partial<EdgeType['data']>`. React's edge type is `Partial<EdgeType['data']>`; check against `git show upstream/main:packages/react/src/types/instance.ts`.
- [ ] **Step 5: `NgFlowInstance`.** Update the four signatures and add `changeParent: (nodeId: string, parentId: string | null) => void`. If the component or service builds an instance object, wire `changeParent` into it.
- [ ] **Step 6: `changeParent(nodeId, parentId)`.**
  - It is `changeParentNode(nodeId, this.store.nodeLookup, parentId, this.store.nodeOrigin(), ({ nodeId, parentId, x, y }) => this.updateNode(nodeId, { parentId: parentId ?? undefined, position: { x, y } } as Partial<NodeType>))`.
  - JSDoc: "Changes the parent of a node, keeping it visually in place. Equivalent to React's `changeParent`".
- [ ] **Step 7: `setNodeGroup` delegates.**
  - Keep `async setNodeGroup(nodeId, groupId): Promise<void>` and its two guards (the node exists; a non-null group exists).
  - Replace the body after the guards with `this.changeParent(nodeId, groupId)`.
  - Check the agent bridge's `set_node_group` handler and its specs. If any spec asserted the old two-step behaviour (a `setNodePositions` call or an animation), update the assertion to the new single batch. Never weaken the "visually in place" check.
- [ ] **Step 8: Callers.**
  - `grep -rnE "update(Node|Edge)Data\(" packages/angular/src examples/angular/src packages/mcp/src`. Every function-form caller now takes the node or edge: `(n) => ({ x: n.data.x + 1 })`.
  - At BASE no example uses the function form; confirm. Run the example builds if you touched any example.
- [ ] **Step 9: Specs.** Add or adapt:
  1. `updateNode` with `{ position }` emits exactly one `'position'` change, and `getByType('position')` sees it;
  2. `{ position, data, label }` emits position + data(replace) + update;
  3. an unchanged position emits no position change;
  4. `replace: true` emits a `'replace'` with the full node;
  5. the `updateNodeData` updater receives the node;
  6. `updateNodeData(..., { replace: true })` replaces `data` entirely;
  7. the edge equivalents of 4–6;
  8. `changeParent`:
     - into a parent, out of a parent (`null`), and into a nested parent;
     - with a non-zero `nodeOrigin`;
     - `parentId === nodeId` is a no-op, and a missing node or parent warns and changes nothing;
     - in each case, assert the node's `internals.positionAbsolute` is unchanged after the reparent;
  9. `setNodeGroup` still resolves, and still no-ops on a missing group.
- [ ] **Step 10: Verify.** Angular and system vitest, `tsc`, `typecheck`, `lint`, both builds and codespell all pass. The agent specs are green, and the mcp snapshot is unchanged.
- [ ] **Step 11: Commit** as `feat(service)!: update APIs take { replace } and the node/edge updater; add changeParent`. The body covers:
  - the breaking updater argument, with a before/after snippet;
  - `{ replace }`;
  - the split changes, and that `getByType('position')` now sees moves made through `updateNode`;
  - `changeParent`;
  - `setNodeGroup` reparenting in one batch.

### Task 3 (sonnet): Pan/zoom bugs; checkpoint

**Files:** `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`, `services/flow-store.service.ts` (only to add a computed), and the specs (`ng-flow.component.spec.ts` or a new focused spec).

- [ ] **Step 1: `connectionInProgress`.**
  - Add `readonly connectionInProgress = computed(() => this.rawConnection().inProgress)` to the store, unless an equivalent exists. A boolean `computed` keeps the pan/zoom effect from re-running on every pointer move.
  - In the effect that calls `updatePanZoomOptions()` (it reads `effectivePanOnDrag()`, …, `userSelectionActive()`), read `this.store.connectionInProgress()`.
  - Pass `connectionInProgress: this.store.connectionInProgress()` in `updatePanZoomOptions()`.
- [ ] **Step 2: Context menu.**
  - Add `onPaneContextMenu: (event: MouseEvent) => this.emitPaneContextMenu(event)` to `updatePanZoomOptions()`. The `PanZoomUpdateOptions` type accepts it; check `packages/system/src/xypanzoom/XYPanZoom.ts` `update({...})`.
  - Split the current `onPaneContextMenu(event)` handler:
    - `emitPaneContextMenu(event)` cancels a pending click-to-connect and emits `(paneContextMenu)`;
    - the template's `(contextmenu)` handler calls `event.preventDefault()`, and returns early when `Array.isArray(this.effectivePanOnDrag())` and it includes `2`; otherwise it calls `emitPaneContextMenu`. This mirrors React's `Pane.onContextMenu`.
  - Use the same `panOnDrag` value that is passed to XYPanZoom.
- [ ] **Step 3: Specs.**
  1. While `rawConnection` has `inProgress: true`, `panZoomInstance.update` was last called with `connectionInProgress: true`. After the connection ends, it was called with `false`. Spy on `update`.
  2. With `panOnDrag=[2]`, a native `contextmenu` on the pane emits nothing. Invoking the `onPaneContextMenu` that was passed to `update` emits once and cancels a pending click-to-connect.
  3. With the default `panOnDrag`, a native `contextmenu` emits once, as today.
  - Check `packages/system/src/xypanzoom/eventhandler.spec.ts`, which already covers the system side; don't duplicate it.
- [ ] **Step 4: Manual check** in Chromium, time-boxed to 10 minutes, with a throwaway Playwright script in the scratchpad (`createRequire('<repo>/tests/playwright/package.json')('@playwright/test')`).
  - On an example with `panOnDrag=[2]` (find one with `grep -rn "panOnDrag" examples/angular/src`, or use a generic-test page that accepts the prop), a right-click without moving logs or emits once, and a right-drag pan does not.
  - On a subflow example, `changeParent` (via `setNodeGroup` from the console, through `ng.getComponent`) keeps the node's on-screen position.
  - Report what you saw.
- [ ] **Step 5: Checkpoint.** Run every item under **Checkpoints**.
- [ ] **Step 6: Commit** as `fix(pane): pass connectionInProgress and onPaneContextMenu to XYPanZoom`.

### Task 4 (sonnet): Docs

**Files:** `packages/angular/CHANGELOG.md`, `packages/system/CHANGELOG.md`, `packages/angular/README.md`, `docs/reviews/2026-11-24-upstream-sync.md`, `docs/reviews/2026-11-24-upstream-sync/react-12.10.3-13.0.3.md`, and `AGENT_BRIDGE.md` only if `set_node_group`'s observable behaviour changed.

- [ ] **Step 1: Angular CHANGELOG.** Under the unreleased 0.4.0 heading, after "#### Changesets (D3)", add "#### API parity (E1)". Write it from the commit bodies (`git log --format=%B 4bee7e139..HEAD`). It covers:
  - **Breaking:** the updater argument, with a before/after snippet;
  - **New:** `{ replace }`, `changeParent`, `selectNode` / `selectEdge` / `selectInternalNodes`;
  - **Behaviour:** `updateNode`'s split changes, and `setNodeGroup` reparenting in one batch;
  - **Fixed:** pinch and pan during a connection drag, and the context menu after a right-drag pan.
- [ ] **Step 2: System CHANGELOG.** Add `changeParentNode` to 0.2.0.
- [ ] **Step 3: README.** Add the new methods and selectors where `packages/angular/README.md` lists `NgFlowService` APIs. Every `updateNodeData` function-form snippet uses the node argument.
- [ ] **Step 4: Report.**
  - Mark react appendix rows #18 and #22 PRESENT, and adjust the summary counts.
  - In the main report: mark the §4 "Upstream features angflow lacks" items done, and change the E roadmap row to E1 ✓ / E2 / E3.
  - Add an "E1 results" section with the SHAs, test counts and the e2e verdict.
- [ ] **Step 5: Verify.** Codespell is clean, and the never-edit check passes.
- [ ] **Step 6: Commit** as `docs: E1 API parity changelog, README and report`.

## Checkpoints

**After Task 3, and the final checkpoint after Task 4:**
- [ ] Build both packages, then drop the cache. Run the full verdict: `known failures: 0 entries`, `NOT MATCHED: 0`, `WRONG FILE: 0`, `STALE: 0`, `chromium failures: 0`, `verdict: OK`.
- [ ] Run the root `test`: system, angular and mcp vitest are green. Then `cd packages/angular && npx tsc --noEmit`, `typecheck` and `lint`.
- [ ] Run both example builds, then the examples unit tests.
- [ ] Generic-test drift is in sync.
- [ ] The mcp snapshot is unchanged: `git diff --quiet 4bee7e139 -- packages/mcp/src/generated`.
- [ ] Run the never-edit check against `4bee7e139`.
- [ ] Run `uvx codespell $(git diff --name-only --diff-filter=d 4bee7e139..HEAD)`: no output.

**Final only:**
- [ ] The subflows diff is empty.
- [ ] `PATH="$SHIM:$PATH" corepack pnpm build` succeeds (all three packages).
- [ ] Versions are still `0.2.0` / `0.4.0` / `0.1.0`, and nothing is published.
- [ ] Every commit in `4bee7e139..HEAD` has exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Final review (opus)

The reviewer gets the diff `4bee7e139..HEAD`, the spec and this plan, and checks:

- [ ] **Constraints.** The never-edit check passes, there's no `NgZone`, the CR count is 0, the trailers are exact, the system commit has its `Ported from` line, and the lockfile is untouched.
- [ ] **Upstream fidelity.**
  - The signatures equal React's `types/instance.ts` for the four update APIs and `changeParent`.
  - The emitted changes equal Svelte's `updateNode` / `updateEdge`.
  - `subflows.ts` is verbatim.
- [ ] **Behaviour.**
  - Selectors don't notify on unrelated changes.
  - The `undefined`-clears-the-field rule still holds.
  - `changeParent` keeps `positionAbsolute` in every case.
  - `setNodeGroup` callers (the agent, `groupNodes`, `dissolveGroup`) still work.
  - The pan/zoom effect doesn't re-run on every pointer move during a connection.
  - The right-click paths emit exactly once, and click-to-connect is still cancelled.
- [ ] **Docs.** The migration note covers the breaking updater argument, and the README snippets are current.
