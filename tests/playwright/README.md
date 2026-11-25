# End-to-End with Playwright
Here you can find our framework independent E2E tests written with [playwright](https://playwright.dev/).

## Installation
```bash
cd tests/playwright # check if you are in the correct directory 

pnpm install # install node dependencies
npx playwright install # follow the instructions to install browsers
```

## Running the tests
```bash
pnpm run test:react # runs all the tests headless for react
pnpm run test:react:ui # runs tests for react in UI mode, good for debugging

pnpm run test:svelte # runs all the tests headless for svelte
pnpm run test:svelte:ui # runs tests for svelte in UI mode, good for debugging 
```

## Creating new tests
You can find all test implementations in the respective example projects under `/examples/react` and `/examples/svelte`. These example projects are also used for active development, so you can ignore most of the code in them. 

### Create new example or use an existing one
You will find all of the flows currently implemented for E2E testing at `/examples/{framework}/src/generic-tests`. Here you can create a new flow you want to write you test on by creating a new file and defining all of the props that will be applied to the components like this:
```javascript
// NewFolder/NewTest.ts
export default {
  flowProps: {
    minZoom: 0.25,
    maxZoom: 4,
    fitView: true,
    nodes: [
      {
        id: '1',
        data: { label: '1' },
        position: { x: 0, y: 0 },
        type: 'input',
      },
      {
        id: '2',
        data: { label: '2' },
        position: { x: -100, y: 100 },
      },
      {
        id: '3',
        data: { label: '3' },
        position: { x: 100, y: 100 },
      },
    ],
    edges: [
      {
        id: 'first-edge',
        source: '1',
        target: '2',
      },
      {
        id: 'second-edge',
        source: '1',
        target: '3',
      },
    ],
  },
  backgroundProps: { /*... */},
  panelProps: { /*... */},
  minimapProps:  { /*... */},
  controlsProps:  { /*... */},
} satisfies FlowConfig;
```

:warning: The directory and filename you choose will determine the route of the test case. Here it will reachable under `http://localhost:3000/tests/generic/newDirectory/newTest`. (3000 is the port of the react examples, it might differ for other frameworks)

### Create new E2E test case
Now you can start writing you new test case under `/tests/playwright/e2e`



## Angular (angflow)

The Angular example runs the same upstream specs (`e2e/`) against `examples/angular`.

**Running:** `pnpm --filter playwright test:angular` (sets `FRAMEWORK=ng`, uses `playwright.angular.config.ts`).
The config's `webServer` starts `ng serve` on port 4201. Outside CI an already-running server on that port is reused.

**Test pages:** `examples/angular/src/app/generic-tests/` serves upstream's `/tests/generic/*` routes through `GenericTestHostComponent`.
- `registry.ts` maps each upstream key to its config. Data-only configs are imported directly from the React reference copy in `examples/react/src/generic-tests/`.
- `overrides/` holds configs that use custom React nodes, reimplemented as Angular components. Each override starts with a pin line, `// upstream: <path> @ <blob>`.
- `/examples/<name>` redirects to the Angular example. Names that differ are listed in `UPSTREAM_EXAMPLE_ALIASES` in `app.routes.ts`; unknown names fall back to `overview`.

**Known failures:** `known-failures.ng.ts` lists upstream tests that fail against angflow. They run in the non-blocking `ng-known-failures` project.
- To add one, append an entry with `file`, `titlePath` (describe titles plus test title, as Playwright reports them), `reason`, and `owner` (`B`, `C`, `D`, `E`, `flaky-upstream` or `wontfix`; `wontfix` also needs `justification`). Owner letters map to `docs/reviews/2026-11-24-upstream-sync.md` §5.
- When `check-known-failures.mjs` reports an entry as `STALE` (now passing), delete that entry.
- Verdict, from `tests/playwright` (CI runs the same script): `pnpm run test:angular`. It runs only the `chromium` and `ng-known-failures` projects, writes `test-results/report.json`, then runs `check-known-failures.mjs` and exits with its code (Playwright's own exit code is ignored, since known failures fail by design).
  The script exits 1 on `NOT MATCHED`, `WRONG FILE`, any failing `chromium` test, report-level `errors`, or a run where no `chromium` test executed. `test:angular:ui` opens the interactive UI for the `chromium` project only.

**Re-syncing an override:** when upstream changes a config, copy its data into the override file, keep the Angular components, and update the pin to `git rev-parse HEAD:<upstream path>`.
`pnpm --filter angular-examples run check:generic-tests` reports drift (and, when an `upstream/main` ref exists locally, a drifted `examples/react/src/generic-tests` copy): new or removed upstream keys, stale pins, DATA_ONLY imports that point elsewhere, and unsupported plugin children or imports.

**Verbatim paths:** `tests/playwright/e2e/` and `playwright.{shared,react,svelte,vue}.config.ts` are kept identical to upstream. Don't edit them here. To refresh them:
```bash
git fetch upstream && git checkout upstream/main -- examples/react/src/generic-tests tests/playwright/e2e tests/playwright/playwright.shared.config.ts tests/playwright/playwright.react.config.ts tests/playwright/playwright.svelte.config.ts tests/playwright/playwright.vue.config.ts
```
