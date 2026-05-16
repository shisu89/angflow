# angflow dev harness

This Angular app is the internal development harness for `@angflow/angular` and `@angflow/system`. It is **not** a consumer-facing example gallery.

Use it for:
- Iterating on the library during development.
- Regression-testing every example against library changes.
- Reproducing bugs for issue tracking.

For the polished example gallery (free and pro examples alike), visit **https://angflow.dev**.

## Running locally

```bash
# From the repo root — first-time setup
pnpm install
pnpm -F @angflow/system build
pnpm -F @angflow/angular build

# Start the dev server
pnpm --filter angular-examples dev
```

Open http://localhost:4200, pick an example from the header `<select>`.

The example consumes `@angflow/angular` and `@angflow/system` via pnpm `workspace:*` — but both packages' `exports` point at `dist/`, which is gitignored. So a fresh clone needs the two `build` commands above before `ng serve` can resolve the workspace packages. Subsequent edits in `packages/angular/src/` need a rebuild (`pnpm -F @angflow/angular build`) before the dev server picks them up; `packages/system` has a watch script (`npm run dev` inside `packages/system/`) for live rebuilds.

## Adding a new example

1. Create `src/app/examples/<name>/<name>.component.ts` as a standalone Angular component.
2. Register it in `src/app/app.routes.ts` under `HARNESS_ROUTES`.

If the example should also appear in the public showcase website, add a corresponding `{ from, to }` entry to `scripts/sync-manifest.ts` in the `angflow-pro` repo.

## Kitchen sink

`src/app/kitchen-sink/` is an everything-bagel scratchpad used for cross-feature regression checks. It is intentionally large and messy.

## Zoneless harness

`src/zoneless/` is a separate Angular app bootstrapped with `provideZonelessChangeDetection()`. It loads a 200-node graph and exercises the interaction surfaces audited in the `0.1.0` Angular 19 + zoneless upgrade: node drag, pan/zoom, box-select, edge connection drag, keyboard delete, minimap interaction.

```bash
pnpm --filter angular-examples dev:zoneless    # dev server
pnpm --filter angular-examples build:zoneless  # production build → dist/zoneless
```

This is the release gate referenced in `docs/superpowers/specs/2026-04-18-angular-19-zoneless-upgrade-design.md` — `@angflow/angular@0.1.0` tags only after this harness passes the FPS bar in Chrome DevTools Performance.

---

*Angflow is an independent open-source project. Angular is a trademark of Google LLC and is used for identification purposes only. This project is not affiliated with or endorsed by Google or the Angular team.*
