# Upstream shared e2e suite on Angular — design (sub-project A)

Status: draft, revised after spec review, 2026-11-25. Parent roadmap:
`docs/reviews/2026-11-24-upstream-sync.md` §5 (A).

## Goal

Run upstream xyflow's own cross-framework Playwright suite (`tests/playwright`) against angflow with
`FRAMEWORK=ng` on every push and PR. Each upstream fix ported in B–E then arrives with upstream's
test for it, and every upstream sync brings new tests along without anyone hand-porting them.

## Context

- **Selectors.** `tests/playwright` is upstream's suite. Specs select elements by
  `.${FRAMEWORK}-flow__*`. Angflow emits both `ng-flow__*` and `xy-flow__*`, so `FRAMEWORK=ng`
  already resolves.
- **Pages the specs open:**
  - Most specs open `/tests/generic/<group>/<name>`. Each upstream example app has one generic `Flow`
    host that renders the data config for that route, from `examples/react/src/generic-tests/`.
  - Three specs open regular example pages instead:
    - `background.spec` → `/examples/backgrounds`, which needs pattern ids `#pattern-flow-a0` …
      `#pattern-flow-d1`.
    - `props.spec` → `/examples/color-mode`, three times.
    - `measurement-race.spec` → `/examples/measurement-race`. It is already
      `test.skip(FRAMEWORK !== 'react')` upstream.
- **History.** Angflow had Angular pages for this in `examples/angular/src/app/generic-tests/` until
  `f9ceca8b0` (Apr 2026) deleted them. They were hand-copied, with every input and default
  hard-coded, which is the drift this design avoids.
- **Our current copy.** `tests/playwright` is a 12.10.2-era copy with 4 Angular `test.skip` edits
  inside upstream specs: `edges.spec.ts:101` and `:137`, `node-toolbar.spec.ts:35`,
  `pane.spec.ts:17`. Upstream since then:
  - added 8 specs: background, click-connect, connection-hooks, intersection-origin,
    measurement-race, nodes-data-hooks, reconnect-edge, viewport;
  - changed 6 existing e2e files;
  - added `playwright.vue.config.ts`;
  - bumped `@playwright/test` to `^1.65.1`, and its `package.json` now uses `catalog:` specifiers.
- **Upstream's 13 configs** at `upstream/main`:
  - **Data-only (7):** `edges/general` (imports the `MarkerType` value from `@xyflow/react`),
    `edges/reconnect`, `pane/{activation-keys, click-connect, click-connect-selection, general,
    non-defaults}`. `click-connect-selection` imports `./click-connect`.
  - **React custom nodes (6):** `nodes/{general, connection-updates, data-updates,
    intersection-origin}`, `node-toolbar/general`, `viewport/transitions`.
  - **Callbacks (3 only):** `onPaneClick`, `onClickConnectStart`, `onClickConnectEnd`. `className`
    also appears.
  - **No config uses** `controlsProps`, `panelProps`, `minimapProps` or `backgroundProps`.
- **Verified in the spec-review experiment (`ngc --noEmit`):**
  - Relative imports of the upstream files from outside the Angular project root compile under
    `include: ["src/**/*.ts"]`.
  - A tsconfig `paths` alias `@xyflow/react` → shim resolves.
  - `examples/react`'s own `app.d.ts` and tsconfig don't interfere.
  - Still to confirm with a real `ng build` and `ng serve`: the esbuild bundling step and the watcher.

## Decisions (from brainstorm)

1. **Import upstream's configs directly** from the reference copy. Only configs that can't be
   imported get Angular overrides.
2. **Known-failures list.** Upstream spec files stay verbatim. Angular failures are listed in one file,
   each with a reason and owner.
3. **CI runs the suite on every push and PR**, Chromium only.

## Design

### 1. Refresh `tests/playwright` to upstream

- **Taken verbatim from `upstream/main`:** `e2e/`, `playwright.shared.config.ts`, and the
  react, svelte and vue configs.
- **Angflow-owned files:**
  - `playwright.angular.config.ts`, extended in §4.
  - `known-failures.ng.ts`.
  - `check-known-failures.mjs`.
  - `package.json`: angflow's version, not upstream's. Upstream's uses `catalog:` specifiers, which
    our workspace doesn't define. Bump `@playwright/test` to upstream's `^1.65.1`, drop
    `@playwright/experimental-ct-react` (unused), and keep the `test:angular` / `test:angular:ui`
    scripts.
- **The 4 in-spec skips:** dropped. Those cases move to the known-failures list (§4), with the same
  reasons.
- **Workspace:** add `tests/playwright` to `pnpm-workspace.yaml`, delete its `package-lock.json`,
  and regenerate and commit `pnpm-lock.yaml`. A workspace package named `playwright` doesn't collide
  with the npm package, because `--filter` matches workspace names.
- **Later syncs** are a checkout of the verbatim paths above. "Verbatim" is checked with
  `git diff --quiet upstream/main -- tests/playwright/e2e`, not a working-tree comparison, because
  of CRLF checkouts.

### 2. Test pages in `examples/angular`

#### 2a. Generic host — `tests/generic/**`

- **Routing.** `GenericTestHostComponent` resolves the rest of the URL to a registry key
  (`nodes/general`, …). An unknown key renders `404: This route doesn't exists.` (upstream's text).
- **Registry** (`src/app/generic-tests/registry.ts`):
  - An explicit map from key to config. Angular's builder has no `import.meta.glob`, and the drift
    check (§3) keeps the map complete.
  - Data-only configs are imported straight from the relative path to
    `examples/react/src/generic-tests/<key>`.
  - Override keys point at the Angular files.
- **Typing.**
  - A tsconfig `paths` alias maps `@xyflow/react` → `src/app/generic-tests/xyflow-react-shim.ts`.
    The shim re-exports `MarkerType`, `Position`, `Node` and `Edge` from `@angflow/angular`.
  - A global `FlowConfig` declaration lives under `src/**`. It needs this exact shape; `any` and
    `Record<string, any>` both fail `noImplicitAny` on the callback parameters:
    ```ts
    interface FlowConfig {
      flowProps?: { [k: string]: any; [k: `on${string}`]: (...a: any[]) => void };
      [k: string]: any;
    }
    ```
- **Host behaviour** (mirrors upstream `Flow.tsx`):
  - **State.** Controlled `nodes` / `edges` signals, seeded from the config.
    `nodesChange` / `edgesChange` → `applyNodeChanges` / `applyEdgeChanges`; `connect` → `addEdge`;
    `reconnect` → `reconnectEdge`. After D, these become `changes.applyTo(…)`, like upstream.
  - **Rendering.** `NgFlowComponent` is created with `ViewContainerRef.createComponent`.
  - **Value props.** Applied with `setInput(name, value)`. Names are validated at runtime against
    `reflectComponentType(NgFlowComponent).inputs`, the public API, whose `templateName`s are
    already the public aliases (`nodes`, `edges`, `width`, `height`, …).
  - **`className`.** Added to the host element's classes.
  - **Callbacks.** An explicit adapter table maps each `onXxx` callback to the Angular output and its
    argument shape. A blind `onXxx` → `xxx` mapping is wrong: Angular's `clickConnectEnd` emits only
    the `MouseEvent`, while upstream's callback expects `(event, connection)`.
    - Initial table: `onPaneClick` → `paneClick`, `onClickConnectStart` → `clickConnectStart`,
      `onClickConnectEnd` → `clickConnectEnd`.
    - `onClickConnectEnd` gets `connection` as `undefined` until D adds the missing payload, so
      click-connect starts on the known-failures list (owner D).
  - **Unsupported props.** A key that isn't an input, the class, or a table entry logs
    `console.warn('[generic-tests] unsupported prop: <key>')` and is listed in a
    `data-unsupported-props` host attribute. A missing API then shows up in failure traces instead of
    being silently dropped.
  - **Plugin children** (`controlsProps`, …) are not built, because no config uses them. When one
    first does, the drift check flags it. The route then is a host that provides `FlowStore` and
    `NgFlowService` itself, the way `ng-flow-provider` does: the flow reuses the store via `skipSelf`,
    and the plugins are created from the host's injector.
- **Overrides** (`src/app/generic-tests/overrides/<key>.ts`, plus Angular node components):
  - Each file starts with `// upstream: examples/react/src/generic-tests/<key>.ts @ <blob>`. Get the
    blob with `git rev-parse HEAD:<path>`; `git hash-object` on a CRLF working tree gives a different
    SHA.
  - The data is copied verbatim; only the component references change.
  - The deleted `DragHandleNode` and `ToolbarNode` from `f9ceca8b0^` are starting points.
  - Overrides needed: `nodes/general`, `nodes/connection-updates`, `nodes/data-updates`,
    `nodes/intersection-origin`, `node-toolbar/general`, `viewport/transitions`.

#### 2b. Example routes used by specs — `examples/*`

- **Alias.** Add `examples/:name`, with a name map, so `/examples/color-mode` resolves to the existing
  `color-mode` example.
- **`backgrounds`.** Port upstream's layout: four flows `flow-a` … `flow-d`, whose pattern ids match
  `#pattern-flow-a0` … `#pattern-flow-d1`. Either extend `backgrounds-variants` or add it as a
  dedicated page.
- **`measurement-race`.** Not ported. The spec skips every non-React framework itself.

### 3. Drift check

`examples/angular/scripts/check-generic-tests.mjs` is the pnpm script `check:generic-tests`, run in
CI. It fails when:

- an upstream config has no registry entry (a new upstream test page),
- an override's pinned blob differs from `git rev-parse HEAD:<upstream path>` (upstream changed it),
- a registry entry points at an upstream file that no longer exists, or
- an upstream config starts using a key the host doesn't support: `controlsProps`, `panelProps`,
  `minimapProps`, `backgroundProps`, or an `on*` callback missing from the adapter table.

Each failure message names the file and the fix.

### 4. Known failures

- **List.** `tests/playwright/known-failures.ng.ts` exports
  `{ file, titlePath: string[], reason, owner: 'B' | 'C' | 'D' | 'E' | 'flaky-upstream' | 'wontfix' }[]`.
- **Matching.** Playwright's `grep` and `grepInvert` match the describe path plus the test title, not
  the file. Each entry therefore becomes an anchored, regex-escaped `^<describe path> <title>$`
  pattern.
- **Projects** in `playwright.angular.config.ts`:
  - `chromium` — `grepInvert` = all entries. This is the blocking run.
  - `ng-known-failures` — `grep` = all entries, same `devices['Desktop Chrome']`, `retries: 0`.
    Non-blocking.
- **`check-known-failures.mjs`** reads the run's JSON report and fails when:
  - a listed test passed (stale: remove the entry),
  - an entry matched zero tests (a typo, or the test was removed upstream), or
  - an entry's `file` differs from the reporting file (a title collision).
  The stale-entry check is reported but non-blocking. The other two are blocking.
- **Initial content** is the triaged result of the first full run.
  - The 4 former in-spec skips are classified then: real bug (B) or test fragility
    (`flaky-upstream`).
  - `wontfix` needs a written justification.

### 5. CI

New job `e2e-angular` in `.github/workflows/ci.yml`:

1. `pnpm install --frozen-lockfile`, then build system and angular.
2. Cache `~/.cache/ms-playwright`, keyed on the `@playwright/test` version, then run
   `pnpm --filter playwright exec playwright install --with-deps chromium`.
3. Run the suite once, with both projects in a single invocation so `ng serve` starts only once:
   `FRAMEWORK=ng playwright test -c playwright.angular.config.ts --project=chromium --project=ng-known-failures --reporter=json,html`.
4. Derive the job result from the JSON report:
   - `chromium` failures fail the job;
   - `check-known-failures.mjs` runs on the same report.
5. Upload the HTML report and traces as artifacts.

`check:generic-tests` joins the existing lint step. Firefox and WebKit stay available locally; they
aren't run in CI.

### 6. Docs

- `tests/playwright/README.md`: add an Angular section covering running the suite, known failures,
  overrides, the drift check, and the files that stay verbatim.
- `CLAUDE.md`: add the commands to the Key Commands table.
- `docs/reviews/2026-11-24-upstream-sync.md` §5 A: link to this spec.

## Exit criteria

- `pnpm --filter playwright test:angular` passes locally and in CI. Every upstream spec either passes
  or is in `known-failures.ng.ts` with a reason and owner.
- `git diff --quiet upstream/main -- tests/playwright/e2e` succeeds.
- `check:generic-tests` and `check-known-failures.mjs` pass in CI. Stale known-failure entries are
  reported but don't block.
- The zonal `examples/angular` suite and the existing unit tests still pass.

## Out of scope

- Fixing the failures. They feed B and D, for example the missing `clickConnectEnd` connection
  payload.
- Running the React, Svelte or Vue suites in CI.
- Mobile and touch projects (commented out upstream).
- Plugin-child props (§2a), until a config needs them.

## Risks

- **Outside-root imports.** These are confirmed with `ngc` only. The first plan task runs a real
  `ng build` and `ng serve` with one outside-root import. **Fallback:** a sync script that copies the
  data-only configs into `src/app/generic-tests/upstream/` and checks their blobs, reusing the drift
  check.
- **React-13-only props** in configs show up as unsupported props until D, and get known-failure
  entries with owner D. This is expected.
- **CI time:** `ng serve` dev startup plus ~70 tests on a single worker. If the job runs past roughly
  8 minutes, serve a production `ng build` statically instead.
