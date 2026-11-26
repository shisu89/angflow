# Upstream 1.0 changes API (NodeChangeset / EdgeChangeset) — Implementation Plan (sub-project D3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt upstream xyflow 1.0's changes API (#5944 and follow-ups). After D3:
- **system:** `@angflow/system` ships upstream's `changes/` module verbatim. That covers the types, the creators, `Changeset` / `NodeChangeset` / `EdgeChangeset`, `applyNodeChanges(nodes, changeset)` and `getSelectionChanges` / `getDeselectionChanges`. The only divergence is `DimensionChange.initial`.
- **outputs:** `(nodesChange)` / `(edgesChange)` emit a `NodeChangeset` / `EdgeChangeset`.
- **update APIs:** `updateNode` / `updateNodeData` / `updateEdge` / `updateEdgeData` emit `'update'` / `'data'` changes.
- **adds:** `'add'` changes append; `index` is ignored.
- **helper:** `applyDimensionChanges(nodes, changeset)`.
- **examples:** every example uses `changes.applyTo(...)`.

**Release:** the single final release is unchanged: system 0.2.0, angular 0.4.0, mcp 0.1.0, already bumped and unpublished. D3 adds changelog entries under those headings. No agent tool changes, so the mcp snapshot stays untouched.

**Spec:** `docs/superpowers/specs/2026-11-26-changesets-d3-design.md`. It is the contract.

**BASE:** `1284ea381` (`docs: D3 changesets design spec`). D2 (`42b15702c..dd06f5b27`) is on `main`, pushed, and CI is green.

## Task map

| Task | Model | What | Spec § |
|---|---|---|---|
| 1 | sonnet | System `changes/` module port, type renames repo-wide, `id` on add changes, system changeset tests | system |
| 2 | opus | Angular core: store builds and emits changesets, outputs/types, system creators, update/data changes, `applyDimensionChanges(nodes, changeset)`, public API, specs | angular |
| 3 | sonnet | Migrate `examples/angular` (55 files) to `changes.applyTo(...)`; checkpoint | examples |
| 4 | sonnet | Changelogs, migration guide, READMEs, report | docs |

## Spec deviations

1. **`getElementsDiffChanges` is deleted, not rewritten.** At BASE nothing calls it. Its only export is the internal `utils/index.ts` barrel, which nothing imports, and it isn't in `public-api.ts`. The spec's "keep, rewritten" assumed a caller. Task 2 deletes it and removes it from the barrel.
2. **The module lineage lands as one commit.** That's 5ff09ef77 (#5944), plus c3a844e62, 18c0bab21, 6f45fba0b, a97985ae8, b4a02ca02, 9b421bfc3, 1f951d99a, 446e0c2d0, b23c67914 and ee44a8883, `packages/system` paths only. The files are new to angflow and no intermediate version ever shipped. The end state is `git show upstream/main:packages/system/src/changes/<file>.ts`, plus the `initial` field. The commit body lists every SHA.
3. **Type renames land in Task 1 across the whole repo.** Angular `tsc` resolves `@angflow/system` to `../system/src`, so deleting `types/changes.ts` breaks Angular unless its imports change in the same commit. This is the same constraint as D2 deviation 1. Task 1 renames the imports and adds `id` to add changes, and does nothing else on the Angular side. Angular's own array-based `applyNodeChanges` stays until Task 2. It ignores the unknown `'update'` / `'data'` types, which nothing emits yet.
4. **Examples are broken between Task 2 and Task 3.** Task 2 removes `applyNodeChanges` / `applyEdgeChanges` from `@angflow/angular`, and 55 example files import them. The library, its specs and `tsc` stay green after Task 2. The example builds and e2e first run at the checkpoint after Task 3.
5. **`@angflow/angular` re-exports less than the spec listed.** The spec said to re-export `applyNodeChanges` / `applyEdgeChanges`, the creators and the new type names "matching React's `index.ts` list". React's list at `upstream/main` doesn't include any of those. Svelte and Vue match React: their only change-related exports are the type names `NodeChange` … `ReplaceChange`, `EdgeChange`, `NodeChangeset` and `EdgeChangeset`. Under match-upstream-fully, `@angflow/angular` exports only that list, plus angflow's own `applyDimensionChanges`. Everything else stays importable from `@angflow/system`, as it is upstream from `@xyflow/system`. Examples use `changes.applyTo(...)` and need none of it.

## Global Constraints

- **Never edit** these. Verify before every commit with `git diff --quiet HEAD -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts packages/react packages/svelte packages/vue examples/react examples/svelte examples/vue examples/astro-xyflow` (exit 0).
  - `tests/playwright/e2e/**`
  - `tests/playwright/playwright.{shared,react,svelte,vue}.config.ts`
  - `packages/{react,svelte,vue}/**`
  - `examples/{react,svelte,vue,astro-xyflow}/**` (the reference you port *from*)

  Never edit a spec to make it pass. `tests/playwright/known-failures.ng.ts` stays an empty array.
- **Breaking-change policy: match upstream fully.**
  - Add no aliases for the old type names (`NodeDimensionChange`, …, `EdgeReplaceChange`).
  - Add no array overload of `applyNodeChanges` / `applyEdgeChanges`.
  - Add no `createSelectionChange` / `elementToRemoveChange` wrappers.
- **Porting rule (system).**
  - Copy from `upstream/main` with `git show upstream/main:<path>`, `packages/system` paths only.
  - Never cherry-pick.
  - Never take upstream's `packages/system/package.json` version line.
  - The commit body has `Ported from xyflow/xyflow#5944 (5ff09ef77)`, followed by the other SHAs from deviation 2.
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
- **Changelogs.** Tasks 1–3 don't edit `CHANGELOG.md`; Task 4 writes D3's entries from the commit bodies. Put whatever a release note needs into your commit body.
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

# Changes module vs upstream (the D3 end-state check; only the `initial` hunk may remain)
for f in apply create index types utils; do git diff --no-index <(git show upstream/main:packages/system/src/changes/$f.ts) packages/system/src/changes/$f.ts; done

# Old-name grep (must be empty outside reference copies and changelogs)
grep -rnE "NodeDimensionChange|NodePositionChange|NodeSelectionChange|NodeRemoveChange|NodeAddChange|NodeReplaceChange|EdgeSelectionChange|EdgeRemoveChange|EdgeAddChange|EdgeReplaceChange|createSelectionChange|elementToRemoveChange|getElementsDiffChanges|apply(Node|Edge|Dimension)Changes\(changes" packages/system/src packages/angular/src packages/mcp/src examples/angular/src README.md packages/angular/README.md packages/angular/AGENT_BRIDGE.md
```

---

## Preflight (no commit)

- [ ] **Step 1: Base.** `git status --short` is empty, and `git rev-parse --short HEAD` is `1284ea381`; otherwise record it as BASE. Then run `git fetch upstream`, and `git rev-parse 5ff09ef77 ee44a8883 upstream/main` resolves.
- [ ] **Step 2: Shim.** `PATH="$SHIM:$PATH" pnpm --version` prints a version.
- [ ] **Step 3: Codespell.** `uvx codespell docs/superpowers/plans/2026-11-26-changesets-d3.md` prints nothing.
- [ ] **Step 4: Baseline.**
  - Build, drop the cache, and run the full verdict: `known failures: 0 entries`, `verdict: OK`.
  - Run `PATH="$SHIM:$PATH" corepack pnpm test`: system 167, angular 1081, mcp 65.

---

## Tasks

### Task 1 (sonnet): System `changes/` module, type renames, add-change ids

**Files:**
- Create: `packages/system/src/changes/{apply,create,index,types,utils}.ts` and `packages/system/src/changes/changes.spec.ts`
- Modify: `packages/system/src/index.ts`, `packages/system/src/types/index.ts`, `packages/system/src/utils/store.ts`
- Delete: `packages/system/src/types/changes.ts`
- Modify (Angular renames only): `packages/angular/src/lib/public-api.ts`, `components/node-resizer/node-resizer.component.ts`, `services/flow-store.service.ts`, `services/ng-flow.service.ts`, `utils/changes.ts`, and any spec that names an old type

- [ ] **Step 1: Copy the module.** For each `f` in `apply create index types utils`, run `git show upstream/main:packages/system/src/changes/$f.ts > packages/system/src/changes/$f.ts`.
  - Keep upstream's import specifiers (`'./apply.js'`, `'.'`, `'../types'`) as they are. If the system rollup build or Angular `tsc` rejects a `.js` specifier, drop the suffix and say so in the commit body.
- [ ] **Step 2: Re-add the divergence.**
  - In `changes/types.ts`, add `initial?: boolean;` to `DimensionChange`, with the full "DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this." comment block copied verbatim from `types/changes.ts` at BASE (`NodeDimensionChange.initial`).
  - Nothing else in the module differs from upstream.
- [ ] **Step 3: Wire exports.**
  - Append upstream's five lines to `packages/system/src/index.ts`: `export * from './changes/apply';` through `'./changes/utils'`.
  - Remove `export * from './changes';` from `types/index.ts`, then delete `types/changes.ts`.
- [ ] **Step 4: System internals.** In `utils/store.ts` (`handleExpandParent` and any other user):
  - replace `NodeDimensionChange` / `NodePositionChange` with `DimensionChange` / `PositionChange`;
  - build changes with `dimensionChange` / `positionChange` where upstream does (compare `git show upstream/main:packages/system/src/utils/store.ts`);
  - keep angflow's own logic, and keep the parent-expand dimensions change without `initial`, as documented.
  - `grep -rn` the old names under `packages/system/src` returns nothing.
- [ ] **Step 5: Angular renames (compile-only).**
  - Replace every old type name with the new one:
    - `NodeDimensionChange` → `DimensionChange`, `NodePositionChange` → `PositionChange`;
    - `Node|EdgeSelectionChange` → `SelectionChange`, `Node|EdgeRemoveChange` → `RemoveChange`;
    - `Node|EdgeAddChange<T>` → `AddChange<T>`, `Node|EdgeReplaceChange<T>` → `ReplaceChange<T>`.
  - In `public-api.ts`, the "Change types" re-export lists exactly upstream React's names: `NodeChange`, `DimensionChange`, `PositionChange`, `SelectionChange`, `RemoveChange`, `AddChange`, `ReplaceChange` and `EdgeChange` (deviation 5). Task 2 adds `NodeChangeset` / `EdgeChangeset`.
  - Add `id: item.id` to the add changes in `NgFlowService.addNodes` / `addEdges` and in `utils/changes.ts` `getElementsDiffChanges` (Task 2 deletes the latter).
  - **Change no behaviour.** The angular `applyNodeChanges` stays as it is.
- [ ] **Step 6: System tests.** Write `changes.spec.ts` (vitest, LF) covering:
  - `add` with a single change and with an array; iteration order, which is adds first and then per element in insertion order; `toArray` returns the same order;
  - `getByType`, including `'add'` and a type that never appeared, which returns `[]`;
  - `getForElement`, `removeForElement`, `remove` by reference (including the last change of an element, which then leaves `isEmpty` true), `clear`, `isEmpty`, and `getNewNodes` / `getNewEdges`;
  - `applyTo`:
    - a remove anywhere in the batch drops the element;
    - `replace` followed by `position` applies both;
    - an `add` for an existing id keeps the existing element;
    - an add with `index` appends;
    - array order is preserved;
    - unchanged elements keep their identity;
  - `'update'` (`Object.assign`), `'data'` merge versus `replace: true`, and `dimensions` with `setAttributes` true / `'width'` / `'height'` plus `resizing`;
  - `getSelectionChanges` / `getDeselectionChanges`, including the `selected === undefined` skip and the `null` meaning "all";
  - a `DimensionChange` with `initial: true` type-checks and applies like any other.
- [ ] **Step 7: Verify.**
  - The system vitest suite, Angular vitest and `cd packages/angular && npx tsc --noEmit` pass, as do `typecheck`, `lint` and the system build.
  - The module-vs-upstream loop shows only the `initial` hunk.
  - Codespell is clean on the changed files.
- [ ] **Step 8: Commit** as `feat(system)!: port upstream changes module (Changeset, NodeChangeset, EdgeChangeset)`. The body:
  - lists the renames;
  - says `AddChange` requires `id`;
  - gives the apply-semantics differences from spec §"Upstream reference";
  - includes the `Ported from` lines.

### Task 2 (opus): Angular core emits changesets

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts`, `services/ng-flow.service.ts`, `container/ng-flow/ng-flow.component.ts`, `types/general.ts`, `types/store.ts`, `utils/changes.ts`, `utils/index.ts`, `public-api.ts`, `directives/key-handler.directive.ts`
- Modify the specs: `utils/changes.spec.ts`, `services/flow-store.service.spec.ts`, `flow-store.gesture.spec.ts`, `flow-store.initial-dimensions.spec.ts`, `ng-flow.service.spec.ts`, `agent/agent-bridge.spec.ts`, `components/ng-flow-provider/ng-flow-provider.component.spec.ts`, `container/edge-renderer/edge-renderer.memo.spec.ts`, `container/node-renderer/node-renderer.component.spec.ts`, plus any others the compiler flags

- [ ] **Step 1: `utils/changes.ts`.**
  - Delete the local `applyChanges`, `applyChange`, `applyNodeChanges`, `applyEdgeChanges`, `createSelectionChange`, `getSelectionChanges`, `getElementsDiffChanges` and `elementToRemoveChange`.
  - Keep `applyDimensionChanges`, with the signature `applyDimensionChanges<NodeType extends Node = Node>(nodes: NodeType[], changes: NodeChangeset<NodeType>): NodeType[]`. It reads `changes.getByType('dimensions')`, and keeps the semantics: last one wins, only `measured` is written, and the input reference is returned when nothing applies.
  - Update its JSDoc example to `this.nodes.update((ns) => applyDimensionChanges(ns, changes))`.
  - `utils/index.ts` exports only what still exists.
- [ ] **Step 2: Store.**
  - `triggerNodeChanges(changes: NodeChange<NodeType>[])` keeps its array input and the array middleware loop.
  - After the middleware, it builds `const changeset = new NodeChangeset<NodeType>(changes)`.
    - The full path becomes `this.setNodes(changeset.applyTo(this.nodes()))`.
    - The position-only fast path is unchanged.
    - Both paths end with `this.onNodesChange?.(changeset)`.
  - The same goes for edges with `EdgeChangeset`.
  - Selection helpers use system `selectionChange` / `getSelectionChanges`. Where the code deselects "all selected" (`unselectNodesAndEdges` and similar), use `getDeselectionChanges` only if it's an exact behavioural match; otherwise keep the loop with `selectionChange`.
  - `onNodesChange` / `onEdgesChange` field types (store and `types/store.ts`) take a `NodeChangeset<NodeType>` / `EdgeChangeset<EdgeType>`.
  - The debug log prints the array.
- [ ] **Step 3: Component and types.**
  - Declare `readonly nodesChange = output<NodeChangeset<NodeType>>({ alias: 'nodesChange' })` and the edges equivalent.
  - `OnNodesChange` / `OnEdgesChange` in `types/general.ts` match upstream React's `types/general.ts` (`(changes: NodeChangeset<NodeType>) => void`).
  - Update the class JSDoc example, which mentions `(nodesChange)="onNodesChange($event)"`, so its handler body is `this.nodes = changes.applyTo(this.nodes)`.
- [ ] **Step 4: `NgFlowService`.**
  - `updateNode(id, u)` resolves the updater against the current node and emits `[updateChange<NodeType>(id, partial)]`.
  - `updateNodeData(id, d)` resolves the updater against `current.data` and emits `[dataChange(id, partial)]` (a merge).
  - `updateEdge` / `updateEdgeData` mirror these.
  - All four still return early for an unknown id.
  - `addNodes` / `addEdges` use `addChange(item)`. The removal path (`elementToRemoveChange` users) uses `removeChange(el.id)`.
  - Check every internal caller of `updateNode` (group sizing, `parentId` moves): an `'update'` change with `parentId: undefined` must clear the parent the way the old `replace` did. `Object.assign` copies an own `undefined` property, so it does. Add a spec that proves it.
- [ ] **Step 5: Key handler.** `directives/key-handler.directive.ts` builds its changes with system creators, typed as `NodeChange[]` / `EdgeChange[]` arrays into `triggerNodeChanges`.
- [ ] **Step 6: Public API (deviation 5).**
  - The `./utils/changes` export line keeps only `applyDimensionChanges`.
  - Re-export from `@angflow/system` exactly what upstream React's `index.ts` exports: the types `NodeChange`, `DimensionChange`, `PositionChange`, `SelectionChange`, `RemoveChange`, `AddChange`, `ReplaceChange` and `EdgeChange`, plus the values `NodeChangeset` and `EdgeChangeset`.
  - Don't re-export `applyNodeChanges`, `applyEdgeChanges`, the creators, `getSelectionChanges` or `UpdateChange` / `DataChange` from `@angflow/angular`. Upstream React, Svelte and Vue don't, and they stay importable from `@angflow/system`.
- [ ] **Step 7: Specs.**
  - Each listed spec, and any the compiler flags, moves to the new API: `changes.applyTo(...)`, `applyNodeChanges(nodes, new NodeChangeset(arr))`, and emitted-payload assertions through `toArray()` / `getByType`.
  - Where a spec asserted `'replace'` from `updateNode` / `updateNodeData` / `updateEdge*`, it now asserts `'update'` / `'data'`.
  - Add:
    1. `(nodesChange)` emits a `NodeChangeset` instance, for both drag (fast path) and select (full path);
    2. `updateNode` then `updateNodeData` on the same node in one tick both take effect;
    3. the `parentId: undefined` case from Step 4;
    4. `applyDimensionChanges(nodes, changeset)`, covering the no-op identity and last-one-wins.
  - Never weaken an assertion just to pass.
- [ ] **Step 8: Agent bridge.**
  - Run `npx vitest run src/lib/agent` and confirm history / undo / `watchFlow` behave the same.
  - If `AGENT_BRIDGE.md` describes `updateNode` payloads or change shapes, update it in this commit.
  - Confirm the mcp snapshot is unchanged: `cd packages/mcp && npx vitest run test/schema-snapshot.spec.ts` and `git diff --quiet 1284ea381 -- packages/mcp/src/generated`.
- [ ] **Step 9: Verify.**
  - Angular vitest (all), `npx tsc --noEmit`, `typecheck`, `lint`, the system and angular builds, and codespell all pass.
  - **The example builds are expected to fail** until Task 3 (deviation 4); don't run e2e yet.
- [ ] **Step 10: Commit** as `feat(angular)!: (nodesChange)/(edgesChange) emit NodeChangeset/EdgeChangeset`. The body covers:
  - the output types;
  - the removed helpers;
  - `applyDimensionChanges(nodes, changeset)`;
  - `updateNode*` / `updateEdge*` emitting `'update'` / `'data'` (journaling consumers note);
  - that angflow applies before emitting, so clearing the changeset in a handler can't cancel it (Svelte-only behaviour);
  - deviation 1.

### Task 3 (sonnet): Migrate `examples/angular`; checkpoint

**Files:** every file under `examples/angular/src` that `grep -rlnE "applyNodeChanges|applyEdgeChanges|applyDimensionChanges|NodeChange|EdgeChange" examples/angular/src` lists (55 at BASE, generic-test pages included).

- [ ] **Step 1: Rewrite handlers to upstream's example shape.**
  - `onNodesChange(changes: NodeChangeset): void { this.nodes = changes.applyTo(this.nodes); }`
  - Signal and `set`/`update` forms become `this.nodes.update((ns) => changes.applyTo(ns))`, with edges the same.
  - Generic handlers type their parameter as `NodeChangeset<MyNode>` so `applyTo` returns `MyNode[]`. Drop the `as never` / `as Parameters<…>` / `as TeamNode[]` casts once they're no longer needed.
  - The `subscribe('nodesChange', (c) => …)` form becomes `c.applyTo(n)`.
  - Handlers that inspect changes use `changes.getByType('…')`, `for (const c of changes)` or `changes.toArray()`, with the same behaviour.
  - Remove the `applyNodeChanges` / `applyEdgeChanges` / `NodeChange` / `EdgeChange` imports that are now unused, and import `NodeChangeset` / `EdgeChangeset` from `@angflow/angular`.
  - Callers of `applyDimensionChanges` swap their arguments.
- [ ] **Step 2: Drift.** `PATH="$SHIM:$PATH" corepack pnpm --filter angular-examples run check:generic-tests` reports the configs in sync.
- [ ] **Step 3: Verify (this is the checkpoint).** Run every item under **Checkpoints** below, and also:
  - Run a quick manual pass in Chromium through a throwaway Playwright script in the scratchpad, time-boxed to 10 minutes and not committed: on `/overview` and one controlled example, drag a node, select it, resize it, connect two handles and delete with Backspace. No console errors, and the state persists.
  - Report what you saw.
- [ ] **Step 4: Commit** as `refactor(examples): use NodeChangeset/EdgeChangeset applyTo`.

### Task 4 (sonnet): Docs

**Files:** `packages/angular/CHANGELOG.md`, `packages/system/CHANGELOG.md`, `packages/angular/README.md`, `README.md` (root, if it has change snippets), `docs/reviews/2026-11-24-upstream-sync.md`, and `AGENT_BRIDGE.md` only if Task 2 didn't already cover it.

- [ ] **Step 1: Angular CHANGELOG.** Under the existing unreleased 0.4.0 heading, after "#### Theming (D2)", add "#### Changesets (D3)". It covers:
  - **Breaking.** `(nodesChange)` / `(edgesChange)` payloads, with a before/after snippet.
  - **Breaking.** `@angflow/angular` no longer exports `applyNodeChanges` / `applyEdgeChanges`. Use `changes.applyTo(nodes)`, or `applyNodeChanges(nodes, changeset)` from `@angflow/system`.
  - **Breaking.** The internal `createSelectionChange` / `elementToRemoveChange` / `getSelectionChanges` helpers are replaced by the system creators, which are importable from `@angflow/system`.
  - **The type-rename table** (old → new) and `AddChange.id` required.
  - **`applyDimensionChanges(nodes, changeset)`.**
  - **Apply-semantics differences:** remove wins; replace doesn't short-circuit; add for an existing id is ignored; `index` is ignored; iteration groups changes by element.
  - **`updateNode*` / `updateEdge*` emit `'update'` / `'data'`.** It also notes that journaling or undo consumers that matched `'replace'` must handle them.
  - **Clearing the changeset in a handler does nothing.** angflow applies before emitting, as React does.
  - **`Ported from` references:** #5944 (5ff09ef77).
- [ ] **Step 2: System CHANGELOG.** Add the matching 0.2.0 entry: the new `changes/` module, the removed `types/changes.ts` names, and the `initial` divergence.
- [ ] **Step 3: READMEs.** Every `(nodesChange)` / controlled-mode snippet uses `changes.applyTo(...)`. `packages/angular/README.md` gets a short "Changes" subsection listing the changeset methods.
- [ ] **Step 4: Report.** In `docs/reviews/2026-11-24-upstream-sync.md`:
  - mark the §3 Changeset row and the D3 roadmap row ✓;
  - add a "D3 results" section with the commit SHAs, spec deviations 1–4 and the test counts;
  - update the react 12.10.3–13.0.3 / system 1.0.x appendix rows for #5944 to present.
- [ ] **Step 5: Verify.** Codespell is clean on the changed docs, and the old-name grep returns no matches.
- [ ] **Step 6: Commit** as `docs: upstream 1.0 changesets (D3) changelog, migration guide, README and report`.

## Checkpoints

**After Task 3, and the final checkpoint after Task 4:**
- [ ] Build both packages, then drop the cache. Run the full verdict: `known failures: 0 entries`, `NOT MATCHED: 0`, `WRONG FILE: 0`, `STALE: 0`, `chromium failures: 0`, `verdict: OK`.
- [ ] Run the root `test`: system, angular and mcp vitest are green. Then `cd packages/angular && npx tsc --noEmit`, `typecheck` and `lint`.
- [ ] Run both example builds, then the examples unit tests.
- [ ] Generic-test drift is in sync.
- [ ] The mcp snapshot is unchanged: `git diff --quiet 1284ea381 -- packages/mcp/src/generated`.
- [ ] Run the never-edit check against `1284ea381`.
- [ ] Run `uvx codespell $(git diff --name-only 1284ea381..HEAD)`: no output.

**Final only:**
- [ ] The module-vs-upstream loop shows only the `initial` hunk.
- [ ] The old-name grep is empty.
- [ ] `PATH="$SHIM:$PATH" corepack pnpm build` succeeds (all three packages).
- [ ] Versions are still `0.2.0` / `0.4.0` / `0.1.0`, and nothing is published.

## Final review (opus)

The reviewer gets the diff `1284ea381..HEAD`, the spec and this plan, and checks:

- [ ] **Constraints.**
  - The never-edit check passes, and no `NgZone` appears.
  - `git diff 1284ea381..HEAD | grep -c $'\r'` is 0.
  - Every commit has both trailers, and the system commit has its `Ported from` lines.
  - The lockfile is untouched.
- [ ] **Upstream fidelity.**
  - The module equals upstream apart from `initial`.
  - No alias, array overload or wrapper remains.
  - The `OnNodesChange` / `OnEdgesChange` types match React's.
  - The change-related exports of `@angflow/angular` equal React's list, plus `applyDimensionChanges` (deviation 5).
- [ ] **Behaviour.**
  - Both store paths emit the same changeset instance they applied.
  - The middleware still sees arrays.
  - `updateNode` + `updateNodeData` in one tick compose.
  - `parentId: undefined` clears the parent.
  - `applyDimensionChanges` returns the same reference on a no-op.
  - Agent bridge history and undo are unaffected.
- [ ] **Examples.**
  - No leftover casts hide a type error.
  - Handlers that inspected arrays keep their behaviour.
- [ ] **Docs.**
  - The migration guide covers every breaking change: payload, signature, renames, `AddChange.id`, removed helpers, apply semantics, `'update'`/`'data'`, and clear-does-nothing.
  - The report SHAs are correct.
