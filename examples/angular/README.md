# angflow dev harness

This Angular app is the internal development harness for `@angflow/angular` and `@angflow/system`. It is **not** a consumer-facing example gallery.

Use it for:
- Iterating on the library during development.
- Regression-testing every example against library changes.
- Reproducing bugs for issue tracking.

For the polished example gallery (free and pro examples alike), visit **https://angflow.dev**.

## Running locally

```bash
pnpm install      # run from the repo root
pnpm --filter angular-examples dev
```

Open http://localhost:4200, pick an example from the header `<select>`.

## Adding a new example

1. Create `src/app/examples/<name>/<name>.component.ts` as a standalone Angular component.
2. Register it in `src/app/app.routes.ts` under `HARNESS_ROUTES`.

If the example should also appear in the public showcase website, add a corresponding `{ from, to }` entry to `scripts/sync-manifest.ts` in the `angflow-pro` repo.

## Kitchen sink

`src/app/kitchen-sink/` is an everything-bagel scratchpad used for cross-feature regression checks. It is intentionally large and messy.

---

*Angflow is an independent open-source project. Angular is a trademark of Google LLC and is used for identification purposes only. This project is not affiliated with or endorsed by Google or the Angular team.*
