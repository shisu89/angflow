# Upstream Shared e2e Suite on Angular — Implementation Plan (sub-project A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run upstream xyflow's `tests/playwright` suite against `examples/angular` with `FRAMEWORK=ng`, in CI, on every push and PR.

**Architecture:**
- `tests/playwright/e2e` is refreshed to `upstream/main` and stays verbatim.
- `examples/angular` gains:
  - a generic `/tests/generic/**` host that renders upstream's data configs, imported straight from the React reference copy;
  - Angular overrides for the 6 configs that use React custom nodes;
  - `/examples/:name` aliases for the 3 specs that open regular example pages.
- Angular-only failures live in `known-failures.ng.ts`. CI runs the blocking project and the known-failures project in one Playwright invocation.

**Tech stack:** Angular 21 (`examples/angular`, zonal), `@angular/build:application` (esbuild), `@angular/build:unit-test` (`ng test`), Playwright `^1.65.1`, pnpm workspace, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-25-shared-e2e-suite-angular-design.md`

## Global Constraints

- **Never edit** these files. They stay byte-identical to `upstream/main`. Verify with `git diff --quiet upstream/main -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts`.
  - `tests/playwright/e2e/**`
  - `tests/playwright/playwright.{shared,react,svelte,vue}.config.ts`
  - anything under `examples/react|svelte|vue`
- **Don't change `packages/angular` or `packages/system`.** Library gaps that tests expose go on the known-failures list for B or D; this plan doesn't fix them.
- **Zoneless rule (CLAUDE.md):** never inject `NgZone`. The examples app is zonal, but drive view state through signals anyway.
- **Build before running the examples app.** It consumes `@angflow/angular` and `@angflow/system` through their `dist/`. Run `pnpm -F @angflow/system build && pnpm -F @angflow/angular build` first; a fresh clone fails with `TS2307` otherwise.
- **Blob pins** come from `git rev-parse HEAD:<path>`, never `git hash-object` on the working tree, because this machine checks out CRLF.
- **`upstream` remote.** It must exist and be fetched (`git fetch upstream`) for the verbatim checks. CI doesn't use the remote: the drift check compares against the committed reference copy in `examples/react`.
- **Commits:** trunk-based on `main`. Each task ends with one commit carrying the session's Co-Authored-By and Claude-Session trailers.
- **Model tiers per task** are given in each heading, per the workflow preference.

---

### Task 1 (sonnet): Spike — outside-root config imports build and serve

Proves the core decision with a real `ng build` and `ng serve`. If it fails, switch to the copy-sync fallback described at the end of this task before going on.

**Files:**
- Modify: `examples/angular/tsconfig.json` (`compilerOptions.paths`)
- Create: `examples/angular/src/app/generic-tests/xyflow-react-shim.ts`
- Create: `examples/angular/src/app/generic-tests/flow-config.d.ts`
- Create (temporary, deleted in Task 3): `examples/angular/src/app/generic-tests/spike.ts`

- [ ] **Step 1: Add the path alias.** In `examples/angular/tsconfig.json`, extend `paths`:
  ```json
  "paths": {
    "@examples-shared/*": ["./src/app/examples/_shared/*"],
    "@xyflow/react": ["./src/app/generic-tests/xyflow-react-shim.ts"]
  }
  ```

- [ ] **Step 2: Shim.** Create `xyflow-react-shim.ts`:
  ```ts
  // Lets upstream's React generic-test configs (imported verbatim from
  // examples/react/src/generic-tests) resolve `@xyflow/react` in the Angular app.
  // Only re-export what those configs actually use; check:generic-tests (Task 6)
  // fails if an upstream config imports a name missing here.
  export { MarkerType, Position } from '@angflow/angular';
  export type { Node, Edge } from '@angflow/angular';
  ```

- [ ] **Step 3: Global type.** Create `flow-config.d.ts`. This exact shape is required: `any` and `Record<string, any>` fail `noImplicitAny` on the upstream callback parameters.
  ```ts
  export {};
  declare global {
    interface FlowConfig {
      flowProps?: { [k: string]: any; [k: `on${string}`]: (...a: any[]) => void };
      [k: string]: any;
    }
  }
  ```

- [ ] **Step 4: Spike import.** Create `spike.ts`, and import it once from `src/main.ts` for the spike only:
  ```ts
  import edgesGeneral from '../../../../react/src/generic-tests/edges/general';
  import clickConnect from '../../../../react/src/generic-tests/pane/click-connect';
  import clickConnectSelection from '../../../../react/src/generic-tests/pane/click-connect-selection';
  console.log('[spike]', Object.keys(edgesGeneral), Object.keys(clickConnect), Object.keys(clickConnectSelection));
  ```

- [ ] **Step 5: Build.** From `examples/angular`, run `pnpm exec ng build --configuration development`.
  Expected: success, with no `TS2307` or `TS7006`.

- [ ] **Step 6: Serve.**
  1. Run `pnpm exec ng serve --port 4201` in the background and open `http://localhost:4201/overview`.
  2. Confirm the `[spike]` console line. Use `curl` for the bundle plus a headless check, or Playwright `page.on('console')`.
  3. Touch `examples/react/src/generic-tests/pane/click-connect.ts` (add and then remove a blank line) and confirm the watcher rebuilds.
  4. Stop the server.

- [ ] **Step 7: Revert the spike import.** Remove it from `main.ts` and keep `spike.ts` until Task 3. Commit the alias, shim and d.ts:
  `chore(examples): resolve upstream generic-test configs in the Angular app`.

**Fallback (only if Step 5 or 6 fails):**
- Create `examples/angular/scripts/sync-generic-tests.mjs`. It copies the 7 data-only upstream files into `src/app/generic-tests/upstream/<key>.ts`, verbatim, with a `// upstream: <path> @ <blob>` header line.
- The registry (Task 3) imports from there instead. The drift check (Task 6) then also verifies these copies' pins.
- Record the switch in the spec's Risks section in the same commit.

---

### Task 2 (sonnet): Refresh `tests/playwright` and join the workspace

**Files:**
- Overwrite from upstream: `tests/playwright/e2e/**`, `tests/playwright/playwright.{shared,react,svelte,vue}.config.ts`
- Modify: `tests/playwright/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- Delete: `tests/playwright/package-lock.json`

- [ ] **Step 1: Check out the verbatim files.**
  ```bash
  git fetch upstream
  git rm -rq tests/playwright/e2e
  git checkout upstream/main -- tests/playwright/e2e tests/playwright/playwright.shared.config.ts \
    tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts \
    tests/playwright/playwright.vue.config.ts
  ```

- [ ] **Step 2: `package.json`.** Keep angflow's file; don't take upstream's, which uses `catalog:`.
  - Set `@playwright/test` to `^1.65.1`.
  - Remove `@playwright/experimental-ct-react`.
  - Keep the scripts, and add `"test:vue": "FRAMEWORK=vue pnpm exec playwright test -c playwright.vue.config.ts"` so the file mirrors upstream's script set.

- [ ] **Step 3: Workspace.**
  - Add `- 'tests/playwright'` to `pnpm-workspace.yaml`.
  - Run `git rm tests/playwright/package-lock.json`.
  - Run `pnpm install` from the repo root, and confirm `pnpm install --frozen-lockfile` then passes.

- [ ] **Step 4: Verify.**
  - Run `git diff --quiet upstream/main -- tests/playwright/e2e` (exit 0).
  - Run `pnpm --filter playwright exec playwright --version`; it should print 1.65.x.

- [ ] **Step 5: Commit.** `test(e2e): refresh shared playwright suite to upstream xyflow main`. The angular config is temporarily stale; Task 7 rewrites it.

---

### Task 3 (sonnet): Generic host, registry for the data-only configs, route

**Files:**
- Create: `examples/angular/src/app/generic-tests/flow-props.ts` (pure prop partitioning)
- Create: `examples/angular/src/app/generic-tests/flow-props.spec.ts`
- Create: `examples/angular/src/app/generic-tests/registry.ts`
- Create: `examples/angular/src/app/generic-tests/generic-test-host.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`, `examples/angular/src/app/app.html` / `app.ts` (hide the harness header on `/tests/`)
- Delete: `examples/angular/src/app/generic-tests/spike.ts`

**Interfaces:**

`flow-props.ts`:
```ts
export interface OutputAdapter {
  output: string;                      // NgFlowComponent output templateName
  adapt: (cb: (...a: any[]) => void) => (payload: any) => void;
}

/** Explicit on* → output table. Never map by name convention: argument shapes differ. */
export const OUTPUT_ADAPTERS: Record<string, OutputAdapter> = {
  onPaneClick:         { output: 'paneClick',         adapt: (cb) => (e) => cb(e) },
  onClickConnectStart: { output: 'clickConnectStart', adapt: (cb) => (e) => cb(e) },
  // Angular's clickConnectEnd emits only the MouseEvent; upstream passes
  // (event, connection). connection stays undefined until sub-project D.
  onClickConnectEnd:   { output: 'clickConnectEnd',   adapt: (cb) => (e) => cb(e, undefined) },
};

/** Keys the host owns itself (controlled state) and never forwards. */
export const HOST_OWNED = new Set(['nodes', 'edges']);

export interface PartitionedProps {
  inputs: Record<string, unknown>;     // keyed by input templateName
  outputs: { output: string; handler: (payload: any) => void }[];
  className: string | undefined;
  unsupported: string[];
}

export function partitionFlowProps(
  flowProps: Record<string, unknown>,
  inputNames: ReadonlySet<string>,
): PartitionedProps;
```

**Rules for `partitionFlowProps`, in order:**
1. A key in `HOST_OWNED` is skipped.
2. `className` (a string) sets `className`.
3. A key in `OUTPUT_ADAPTERS` whose value is a function goes to `outputs`, with `adapt(value)` as the handler.
4. A key in `inputNames` goes to `inputs`.
5. Anything else is pushed to `unsupported`.

- [ ] **Step 1: Write the failing tests.** Create `flow-props.spec.ts` with vitest-style `describe`/`it`, which the `@angular/build:unit-test` builder runs. Cover:
  - `nodes` and `edges` are skipped;
  - `fitView`, `minZoom` and `deleteKeyCode: null` land in `inputs`, with `null` preserved;
  - `className: 'foo'` sets `className`;
  - `onPaneClick` maps to `paneClick`, and the handler forwards the payload;
  - `onClickConnectEnd`'s handler calls the callback as `(event, undefined)`;
  - `onNodeClick` (not in the table) and `bogusProp` land in `unsupported`.
  Run `pnpm -F angular-examples exec ng test --watch=false --include='src/app/generic-tests/**/*.spec.ts'`; expect them to fail (the module is missing).

- [ ] **Step 2: Implement `partitionFlowProps`.** Re-run the tests and expect them to pass.

- [ ] **Step 3: Registry.** Create `registry.ts`:
  ```ts
  // Keys mirror upstream routes: /tests/generic/<key>.
  // The DATA_ONLY imports point at the verbatim React reference copy.
  // check:generic-tests (Task 6) keeps this map in sync with upstream.
  import edgesGeneral from '../../../../react/src/generic-tests/edges/general';
  import edgesReconnect from '../../../../react/src/generic-tests/edges/reconnect';
  import paneActivationKeys from '../../../../react/src/generic-tests/pane/activation-keys';
  import paneClickConnect from '../../../../react/src/generic-tests/pane/click-connect';
  import paneClickConnectSelection from '../../../../react/src/generic-tests/pane/click-connect-selection';
  import paneGeneral from '../../../../react/src/generic-tests/pane/general';
  import paneNonDefaults from '../../../../react/src/generic-tests/pane/non-defaults';

  export const DATA_ONLY: Record<string, FlowConfig> = {
    'edges/general': edgesGeneral,
    'edges/reconnect': edgesReconnect,
    'pane/activation-keys': paneActivationKeys,
    'pane/click-connect': paneClickConnect,
    'pane/click-connect-selection': paneClickConnectSelection,
    'pane/general': paneGeneral,
    'pane/non-defaults': paneNonDefaults,
  };

  export const OVERRIDES: Record<string, FlowConfig> = {}; // filled in Tasks 4–5

  export const REGISTRY: Record<string, FlowConfig> = { ...DATA_ONLY, ...OVERRIDES };
  ```

- [ ] **Step 4: Host component.** Create `GenericTestHostComponent`, standalone with selector `generic-test-host`.
  - **Route key:** read it from `Router.url`, stripping the `/tests/generic/` prefix, query and hash. If `REGISTRY[key]` is missing, render the exact text `404: This route doesn't exists.`.
  - **Template:** `<div style="height: 100%" #host><ng-container #outlet /></div>`. Give the `:host` styles `display: block; width: 100vw; height: 100vh`.
  - **In an `afterNextRender` (or `ngOnInit` with `ViewContainerRef`):**
    1. `const ref = outlet.createComponent(NgFlowComponent)`.
    2. `inputNames = new Set(reflectComponentType(NgFlowComponent)!.inputs.map(i => i.templateName))`.
    3. `partitionFlowProps(config.flowProps ?? {}, inputNames)`.
    4. Apply each entry of `inputs` with `ref.setInput(name, value)`.
    5. Subscribe each output with `(ref.instance as any)[outputPropName].subscribe(handler)`. Resolve `outputPropName` from `reflectComponentType(...).outputs` by `templateName`, and unsubscribe on destroy.
    6. Add `className` to `ref.location.nativeElement.classList`.
    7. When `unsupported` is non-empty: `console.warn('[generic-tests] unsupported prop: ' + key)` once per key, and set the `data-unsupported-props` attribute on the flow host element to the comma-joined keys.
  - **Controlled state** (mirrors upstream `Flow.tsx`):
    - `nodes = signal(structuredClone(flowProps.nodes ?? []))`, and the same for `edges`. Use `structuredClone` only for plain data; node `data` carries no functions in these configs.
    - Push them with `ref.setInput('nodes', nodes())` and `ref.setInput('edges', edges())` inside an `effect`.
    - `nodesChange` → `nodes.update(n => applyNodeChanges(c, n))`, and `edgesChange` likewise with `applyEdgeChanges`.
    - `connect` → `edges.update(e => addEdge(c, e))`.
    - `reconnect` → `({ edge, connection }) => edges.update(e => reconnectEdge(edge, connection, e))`.
  - **Teardown:** destroy `ref` on destroy.

- [ ] **Step 5: Route and header.**
  - In `app.routes.ts`, add `{ path: 'tests/generic', children: [{ path: '**', component: GenericTestHostComponent }] }` before the catch-all. Don't add it to `HARNESS_ROUTES`, so it stays out of the dropdown.
  - In `app.ts`/`app.html`, hide `.harness-header` when the URL starts with `/tests/`, using a `computed` over a router-events signal.

- [ ] **Step 6: Delete `spike.ts`.** Then build and smoke-test:
  - `pnpm -F angular-examples exec ng build --configuration development`.
  - Serve on 4201 and check `/tests/generic/pane/general` (3 nodes visible) and `/tests/generic/nope` (the 404 text).
  - Run `pnpm --filter playwright exec playwright test -c playwright.angular.config.ts e2e/pane.spec.ts --project=chromium` with `FRAMEWORK=ng`. Most tests should pass.

- [ ] **Step 7: Commit.** `feat(examples): generic upstream test host for the Angular app`.

---

### Task 4 (sonnet): Overrides — the `nodes/*` configs

**Files:**
- Create: `examples/angular/src/app/generic-tests/overrides/nodes/{general,connection-updates,data-updates,intersection-origin}.ts`
- Create: `examples/angular/src/app/generic-tests/overrides/nodes/components/{drag-handle-node,connection-updates-node,nodes-data-updates-node,intersection-origin-node}.component.ts`
- Modify: `registry.ts` (`OVERRIDES`)

**For each config:**

- [ ] **Step 1: Read the sources.**
  - The upstream config `examples/react/src/generic-tests/nodes/<name>.ts` and its React component under `components/`.
  - The matching upstream spec(s) in `tests/playwright/e2e`, to see which DOM, classes, `data-testid`s and console logs the component must produce.
  - `git show f9ceca8b0^:examples/angular/src/app/generic-tests/nodes/components/drag-handle-node.component.ts` as a starting point for `DragHandleNode`.

- [ ] **Step 2: Write the override.**
  - The first line is exactly `// upstream: examples/react/src/generic-tests/nodes/<name>.ts @ <blob>`, with `<blob>` from `git rev-parse HEAD:examples/react/src/generic-tests/nodes/<name>.ts`.
  - The body is the upstream object, copied verbatim, except that `nodeTypes` values point at the Angular components. Keep `satisfies FlowConfig`.

- [ ] **Step 3: Write the Angular node component.**
  - It must reproduce the React component's rendered DOM contract: element structure, handles (`ng-flow-handle` with the same `type`, `position` and `id`), class names, `data-testid`s, text, and any `console.log` lines a spec reads. The specs are the acceptance test.
  - Hooks map to angflow APIs: `useNodeConnections` → `NgFlowService.selectNodeConnections` / `getNodeConnections`, `useNodesData` → `selectNodesData`, `useUpdateNodeInternals` → `updateNodeInternals`. Find the exact names in `packages/angular/src/lib/services/ng-flow.service.ts`.
  - If angflow lacks an API the component needs, implement the closest equivalent and note the gap in the commit message. Task 8 triages the resulting test failure. Don't change `packages/angular`.

- [ ] **Step 4: Register and run.**
  - Add the override to `OVERRIDES`.
  - Run that spec file: `FRAMEWORK=ng pnpm --filter playwright exec playwright test -c playwright.angular.config.ts e2e/<spec> --project=chromium`.
  - Record pass/fail for Task 8; failures don't block this task.

- [ ] **Step 5: Commit.** `feat(examples): Angular overrides for upstream nodes/* generic tests`.

---

### Task 5 (sonnet): Overrides — `node-toolbar/general` and `viewport/transitions`

Same procedure as Task 4.

**Files:**
- `overrides/node-toolbar/general.ts` + `components/toolbar-node.component.ts`. Start from `git show f9ceca8b0^:examples/angular/src/app/generic-tests/node-toolbar/components/toolbar-node.component.ts`. Upstream's config imports `Position` and `type Node` from `@xyflow/react`; in the override, import them from `@angflow/angular`.
- `overrides/viewport/transitions.ts` + `components/viewport-transitions-node.component.ts`. Upstream's `ViewportTransitionsNode` is 61 lines and calls viewport functions with durations; map them to `NgFlowService` (`setViewport`, `fitView`, `setCenter`, `zoomTo`, … with `{ duration }`).

- [ ] Steps 1–5 as in Task 4. Commit: `feat(examples): Angular overrides for node-toolbar and viewport generic tests`.

---

### Task 6 (sonnet): Drift check

**Files:**
- Create: `examples/angular/scripts/check-generic-tests.mjs`
- Modify: `examples/angular/package.json` (add `"check:generic-tests": "node scripts/check-generic-tests.mjs"`)

**Behaviour** (Node ≥22, no dependencies; shell out to `git` with `execFileSync`):

1. `UPSTREAM_DIR = examples/react/src/generic-tests`. List every `*.ts` under it except `components/**` with `git ls-files`, and turn each into a key (`pane/general`).
2. Parse `registry.ts` with a regex over the `DATA_ONLY` and `OVERRIDES` object literals to get the registered keys, plus each `DATA_ONLY` import path. Fail if:
   - an upstream key isn't registered: `new upstream test page <key>: add it to DATA_ONLY, or create an override`;
   - a registered key has no upstream file: `upstream removed <key>: delete it from the registry`;
   - a `DATA_ONLY` import path doesn't resolve to the file for its key.
3. For each file under `overrides/**/*.ts` (not `components/`), read the line-1 `// upstream: <path> @ <blob>` and compare `<blob>` with `git rev-parse HEAD:<path>`. Fail on a mismatch: `upstream changed <path>: re-sync the override data and update the pin to <newblob>`. A missing header also fails.
4. Scan every upstream config, including those behind overrides:
   - A top-level `controlsProps`, `panelProps`, `minimapProps` or `backgroundProps` key fails: `<key> uses <prop>: the generic host doesn't render plugin children yet (see spec §2a)`.
   - A `flowProps` key matching `/^\s{4}(on[A-Z]\w*):/m` that isn't in `OUTPUT_ADAPTERS` fails. Parse `flow-props.ts` for the table's keys.
   - An `import { … } from '@xyflow/react'` name that isn't exported by `xyflow-react-shim.ts` fails, for `DATA_ONLY` configs only.
5. Exit 1 with all messages, or print `generic-tests: N configs in sync` and exit 0.

- [ ] **Step 1:** Implement the script.
- [ ] **Step 2:** Run it; expect exit 0 with `13 configs in sync`.
- [ ] **Step 3: Negative checks.** Revert each one before committing:
  - change one character of an override's pin → mismatch message;
  - comment out one `DATA_ONLY` entry → not-registered message;
  - temporarily add `onNodeClick: () => {},` to a copy of a config → adapter message. Do this in a scratch copy, never by editing `examples/react`.
- [ ] **Step 4: Commit.** `test(examples): drift check for upstream generic-test configs`.

---

### Task 7 (sonnet): `/examples/:name` aliases and the backgrounds page

**Files:**
- Modify: `examples/angular/src/app/app.routes.ts`
- Create: `examples/angular/src/app/examples/backgrounds/backgrounds.component.ts`, or extend `backgrounds-variants`. Prefer a new, faithful page and leave `backgrounds-variants` alone.

- [ ] **Step 1: Alias map.**
  ```ts
  /** Upstream spec routes → Angular example. Upstream specs goto('/examples/<name>'). */
  const UPSTREAM_EXAMPLE_ALIASES: Record<string, string> = {
    'color-mode': 'color-mode',
    backgrounds: 'backgrounds',
  };
  ```
  Add `{ path: 'examples/:name', redirectTo: ({ params }) => UPSTREAM_EXAMPLE_ALIASES[params['name']] ?? 'overview' }`. Angular 21 supports function `redirectTo`. `measurement-race` intentionally has no alias; the upstream spec skips non-React frameworks.

- [ ] **Step 2: Backgrounds page.** Port `examples/react/src/examples/Backgrounds/index.tsx`:
  - four flows `flow-a` … `flow-d` in the same wrapper layout;
  - `flow-d` has two backgrounds: Lines gap 10, then Lines gap 100, offset 2, color `#ccc`;
  - each `<ng-flow>` gets `[flowId]` (or whichever input sets the flow id; check `ng-flow.component.ts`);
  - each `<ng-flow-background>` gets the id `'0'` / `'1'`.
  Confirm in the browser that pattern ids render as `pattern-flow-a0` … `pattern-flow-d1` (see `background.component.ts:121` `patternId`). If angflow's id scheme differs, keep the page faithful and leave the mismatch to Task 8 as a B or D finding. Don't change the library.

- [ ] **Step 3: Register the route.** Add `backgrounds` to `HARNESS_ROUTES`. Build, then run `e2e/background.spec.ts` and `e2e/props.spec.ts`. The color-mode specs need `forceColorMode`, so they are expected to fail until D.

- [ ] **Step 4: Commit.** `feat(examples): upstream example-route aliases and backgrounds page`.

---

### Task 8 (opus): Known-failures infrastructure and the first full run, triaged

**Files:**
- Create: `tests/playwright/known-failures.ng.ts`
- Create: `tests/playwright/check-known-failures.mjs`
- Rewrite: `tests/playwright/playwright.angular.config.ts`

**Interfaces:**
```ts
// known-failures.ng.ts
export type KnownFailureOwner = 'B' | 'C' | 'D' | 'E' | 'flaky-upstream' | 'wontfix';
export interface KnownFailure {
  file: string;          // e.g. 'pane.spec.ts'
  titlePath: string[];   // describe titles..., test title — exactly as Playwright reports
  reason: string;        // one sentence: observed failure + suspected cause
  owner: KnownFailureOwner;
  justification?: string; // required when owner === 'wontfix'
}
export const KNOWN_FAILURES: KnownFailure[] = [];

/** Anchored, regex-escaped pattern over Playwright's grep title (describe path + title, space-joined). */
export function toGrep(f: KnownFailure): RegExp;
```

- [ ] **Step 1: Config.** Rewrite `playwright.angular.config.ts`:
  - Start from `sharedConfigWithPort({ port: 4201, framework: 'ng' })`, and keep the existing `webServer` override (`pnpm --filter=angular-examples run dev --port 4201`, `cwd` = repo root).
  - Replace `projects` with:
    - `chromium`: `devices['Desktop Chrome']`, `grepInvert: KNOWN_FAILURES.map(toGrep)`. When the list is empty, omit `grepInvert`; Playwright rejects an empty array.
    - `ng-known-failures`: same device, `grep: KNOWN_FAILURES.map(toGrep)`, `retries: 0`. Include it only when the list is non-empty.
    - `firefox` / `webkit`: copied from the shared config, with the same `grepInvert`, for local use.
  - On CI, set the reporter to `[['dot'], ['json', { outputFile: 'test-results/report.json' }], ['html', { open: 'never' }]]`.

- [ ] **Step 2: `check-known-failures.mjs`.** It reads `test-results/report.json` (path overridable via argv) and walks `suites → specs → tests`, recording `projectName`, `file`, title path and final `status`. It prints three sections and exits 1 if the first or second is non-empty:
  1. `NOT MATCHED`: an entry with zero matching tests in project `ng-known-failures`.
  2. `WRONG FILE`: an entry matched in a different file.
  3. `STALE (now passing)`: a matched test with `status === 'expected'`. This section is informational; CI surfaces it in the job summary.
  It also exits 1 if any `chromium` test has an unexpected status. That makes it the single verdict for the CI job.

- [ ] **Step 3: First full run.** Build both packages, then run `FRAMEWORK=ng pnpm --filter playwright exec playwright test -c playwright.angular.config.ts --project=chromium`.

- [ ] **Step 4: Triage every failure.** Rerun once with `--retries=0 --repeat-each=3` to separate flakes. For each failing test, read the spec, the trace, and the Angular code involved, then classify it:
  - **B:** a real angflow bug that report §1/§2 covers, or a newly found one. Name the report row, or describe the bug.
  - **C:** deletion semantics.
  - **D:** a React-13 API angflow lacks: `forceColorMode`, `paneDragThreshold`, the `clickConnectEnd` connection payload, `NodeConnection`, …
  - **E:** a missing feature.
  - **flaky-upstream:** test fragility, such as sub-pixel rounding or SVG hit-testing. The 4 former in-spec skips start here unless investigation shows a real bug.
  - **wontfix:** only with a written justification.

  Add an entry per failure. Never edit a spec to make it pass. Fix a failure only if it's a bug in the examples-app host or override (Tasks 3–7), in which case fix it there.

- [ ] **Step 5: Verify.**
  - The full run is green: `chromium` has 0 failures.
  - `ng-known-failures` runs.
  - `node tests/playwright/check-known-failures.mjs` exits 0.
  - Run it with `--repeat-each=2` to confirm stability.

- [ ] **Step 6: Report section.** Append a `### A — first-run findings` subsection to `docs/reviews/2026-11-24-upstream-sync.md` §5: counts by owner, and any newly discovered bugs not yet in §1/§2.

- [ ] **Step 7: Commit.** `test(e2e): known-failures list and triaged first Angular run`.

---

### Task 9 (sonnet): CI job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** Add the job. Keep the existing `ci` job unchanged.
  ```yaml
  e2e-angular:
    name: Upstream e2e suite (Angular, Chromium)
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @angflow/system run build
      - run: pnpm --filter @angflow/angular run build
      - name: Drift check (upstream generic-test configs)
        run: pnpm --filter angular-examples run check:generic-tests
      - name: Playwright version
        id: pw
        run: echo "v=$(pnpm --filter playwright exec playwright --version | awk '{print $2}')" >> "$GITHUB_OUTPUT"
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ms-playwright-${{ runner.os }}-${{ steps.pw.outputs.v }}
      - run: pnpm --filter playwright exec playwright install --with-deps chromium
      - name: Run suite (blocking + known-failures projects, one server start)
        working-directory: tests/playwright
        env: { FRAMEWORK: ng, CI: 'true' }
        run: pnpm exec playwright test -c playwright.angular.config.ts --project=chromium --project=ng-known-failures || true
      - name: Verdict
        working-directory: tests/playwright
        run: node check-known-failures.mjs test-results/report.json | tee -a "$GITHUB_STEP_SUMMARY"
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-angular
          path: |
            tests/playwright/playwright-report
            tests/playwright/test-results
          retention-days: 7
  ```
  The `|| true` is intentional: the verdict step decides pass/fail from the JSON. Known-failure tests fail by design, so Playwright's own exit code can't be the verdict. Make sure `check-known-failures.mjs` also fails when `report.json` is missing, so a crashed run can't pass. If `--project=ng-known-failures` errors because the project doesn't exist (empty list), the config from Task 8 Step 1 omits it; in that case drop the flag through a small `scripts` entry instead of the inline command.

- [ ] **Step 2:** Validate the workflow syntax with `actionlint`, if available (`uvx actionlint` or `go run`). Otherwise do a careful read-through.

- [ ] **Step 3: Commit.** `ci: run upstream e2e suite against Angular on every push`. Record the first CI duration after the push; if it's over 8 minutes, open a follow-up to serve a production build.

---

### Task 10 (haiku): Docs

**Files:**
- Modify: `tests/playwright/README.md`. This is not an upstream-verbatim file: append an "Angular (angflow)" section only, and don't touch upstream text.
- Modify: `CLAUDE.md` Key Commands table
- Modify: `docs/reviews/2026-11-24-upstream-sync.md` §5 row A (link the spec and plan)

- [ ] **Step 1: README section.** Cover:
  - `pnpm --filter playwright test:angular`;
  - the known-failures workflow: add an entry with an owner, and remove an entry when CI reports it STALE;
  - overrides and their pins, and how to re-sync one;
  - `check:generic-tests`;
  - which paths stay verbatim and how to refresh them (`git checkout upstream/main -- <paths>`).
- [ ] **Step 2: `CLAUDE.md` rows.** Add `Run upstream e2e (Angular)` | `pnpm --filter playwright test:angular` | root, and `Check generic-test drift` | `pnpm --filter angular-examples run check:generic-tests` | root.
- [ ] **Step 3: Commit.** `docs: shared e2e suite on Angular`.

---

### Final review (opus)

- [ ] **Constraints.** Verify every Global Constraint:
  - the verbatim `git diff --quiet` command passes;
  - `packages/` is untouched: `git diff --stat <plan-start>..HEAD -- packages` is empty;
  - no `NgZone`.
- [ ] **Exit criteria.** Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, the examples' `ng test`, `check:generic-tests`, and the full Angular Playwright run plus `check-known-failures.mjs`.
- [ ] **Known failures.** Review every entry for a concrete reason and the right owner. Spot-check 3 entries against traces.
- [ ] **Push.** Offer to push `main`. This also publishes the 2026-11-24 report commits, which the monthly triage routine needs before 1 Dec.
