# Example Reconsolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redistribute Angular examples so `angflow` (OSS) becomes a dev harness that holds the canonical source for 15 free examples, and `angflow-pro` (private) becomes the public-showcase website at `angflow.dev` containing those free examples (auto-synced) plus all advanced pro examples and templates.

**Architecture:** Committed-mirror sync. Free examples author in angflow; a sync script in angflow-pro copies them into pro's categorized folder layout on demand, verified by CI. Pro's registry gains a `tier` field so the website can badge free/pro tiles. Six shippable PRs in sequence.

**Tech Stack:** Angular 21.2 (both repos), TypeScript 5.9, Vitest 4 (both repos). angflow uses pnpm + workspace packages; angflow-pro uses npm + published `@angflow/*` packages. No import rewriting needed during sync.

**Reference spec:** `docs/superpowers/specs/2026-04-18-example-reconsolidation-design.md`

**Cross-repo paths used throughout:**
- `$ANGFLOW = C:/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow`
- `$PRO = C:/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow-pro`

---

## File Map

### angflow-pro (create unless noted)

| Path | Purpose |
|---|---|
| `scripts/sync-manifest.ts` | Declares `{ from, to }` entries for each free example |
| `scripts/sync-free-examples.ts` | Copies folders per manifest; idempotent (`rm -rf` then copy) |
| `scripts/sync-free-examples.test.ts` | Vitest unit + integration tests |
| `.github/workflows/sync-check.yml` | CI: clones angflow, runs sync, fails on diff |
| `CONTRIBUTING.md` | How the sync flow works for pro contributors |
| `src/app/shared/types/example.ts` | **Modify**: add `'basics'` to union, `tier`/`sourceUrl` fields |
| `src/app/shared/data/examples.ts` | **Modify**: add `basics` category, free-tier entries, `tier: 'pro'` on existing |
| `src/app/examples/examples.routes.ts` | **Modify**: add lazy `basics` route |
| `src/app/examples/basics/basics.routes.ts` | Routes for 5 basics examples |
| `src/app/examples/basics/{overview,save-restore,backgrounds-variants,minimap-custom,drag-from-sidebar}/` | Synced folders |
| `src/app/examples/nodes/nodes.routes.ts` | **Modify**: add 3 routes |
| `src/app/examples/nodes/{custom-node,node-resizer,node-toolbar}/` | Synced folders |
| `src/app/examples/edges/edges.routes.ts` | **Modify**: add 4 routes |
| `src/app/examples/edges/{custom-edge,edge-types,edge-toolbar,floating-edges}/` | Synced folders |
| `src/app/examples/subflows/subflows.routes.ts` | **Modify**: add 1 route |
| `src/app/examples/subflows/sub-flows/` | Synced folder |
| `src/app/examples/node-io/node-io.routes.ts` | **Modify**: add 1 route |
| `src/app/examples/node-io/typed-handles/` | Synced folder |
| `src/app/examples/interaction/validation/` | **Modify** OR replace with synced `connection-validation` |
| `src/app/examples/examples-grid/examples-grid.{ts,html,scss}` | **Modify**: render tier badges + source links |
| `src/app/examples/example-shell/example-shell.{ts,html,scss}` | **Modify**: sidebar grouping includes `basics` |
| `src/app/templates/templates.routes.ts` | **Modify**: add `showcase` route |
| `src/app/templates/showcase/` | Full folder ported from angflow |
| `package.json` | **Modify**: add `sync-free-examples` script, `tsx` dev dep |

### angflow (modify/delete)

| Path | Change |
|---|---|
| `examples/angular/src/app/examples/connection-validation/` | Possibly modify during merge decision (PR3) |
| `examples/angular/src/app/showcase/` | **Delete** in PR4 |
| `examples/angular/src/app/shell/` | **Delete** in PR5 |
| `examples/angular/src/app/app.routes.ts` | **Rewrite** as flat list in PR5 |
| `examples/angular/src/app/app.{ts,html,css}` | **Rewrite** as minimal harness in PR5 |
| `examples/angular/README.md` | **Rewrite** as harness-purpose doc in PR5 |

---

## PR1: Sync Infrastructure

**Goal:** Land the sync script, types, and CI check with zero examples synced yet. Validates the plumbing in isolation.

**All work in angflow-pro unless noted.**

### Task 1.1: Add `tier` / `sourceUrl` to `ExampleMeta`; add `'basics'` to category union

**Files:** Modify `$PRO/src/app/shared/types/example.ts`

- [ ] **Step 1: Replace the file with the extended schema**

```ts
export interface ExampleMeta {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  route: string;
  type: 'example' | 'template';
  tier: 'free' | 'pro';
  sourceUrl?: string;
}

export type ExampleCategory =
  | 'basics'
  | 'layout'
  | 'interaction'
  | 'nodes'
  | 'edges'
  | 'subflows'
  | 'node-io'
  | 'templates';

export interface CategoryMeta {
  id: ExampleCategory;
  title: string;
  description: string;
  icon: string;
}
```

- [ ] **Step 2: Update every existing entry in `examples.ts` to add `tier: 'pro'`**

Open `$PRO/src/app/shared/data/examples.ts`. For every object in `EXAMPLES` (currently ~29) and every object in `TEMPLATES` (currently 2), add `tier: 'pro'` after `type: 'example' | 'template'`. No `sourceUrl` on pro entries.

Example before:
```ts
{ id: 'auto-layout', title: 'Auto layout', description: '...', category: 'layout', route: '/examples/layout/auto-layout', type: 'example' },
```

After:
```ts
{ id: 'auto-layout', title: 'Auto layout', description: '...', category: 'layout', route: '/examples/layout/auto-layout', type: 'example', tier: 'pro' },
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors. If errors reference missing `tier`, fix the entries that were missed.

- [ ] **Step 4: Commit**

```bash
cd $PRO
git add src/app/shared/types/example.ts src/app/shared/data/examples.ts
git commit -m "feat(examples): add tier and sourceUrl fields to ExampleMeta"
```

---

### Task 1.2: Add `tsx` dev dependency and npm scripts

**Files:** Modify `$PRO/package.json`

- [ ] **Step 1: Install tsx**

```bash
cd $PRO && npm install --save-dev tsx
```

Expected: `tsx` appears in `devDependencies`.

- [ ] **Step 2: Add sync npm scripts**

Edit `package.json` `"scripts"` block to include:

```json
"sync-free-examples": "tsx scripts/sync-free-examples.ts",
"sync-free-examples:check": "tsx scripts/sync-free-examples.ts --check"
```

- [ ] **Step 3: Commit**

```bash
cd $PRO
git add package.json package-lock.json
git commit -m "build: add tsx and sync npm scripts"
```

---

### Task 1.3: Create empty sync manifest

**Files:** Create `$PRO/scripts/sync-manifest.ts`

- [ ] **Step 1: Write the manifest stub**

```ts
export interface SyncEntry {
  from: string;
  to: string;
}

export const FREE_EXAMPLE_MANIFEST: SyncEntry[] = [];
```

Entries will be added in PR2/PR3 as examples are migrated. Keeping it empty in PR1 lets us land the script and CI without any behavioural change.

- [ ] **Step 2: Commit**

```bash
cd $PRO
git add scripts/sync-manifest.ts
git commit -m "feat(sync): add empty sync manifest stub"
```

---

### Task 1.4: TDD the sync script — write failing tests first

**Files:** Create `$PRO/scripts/sync-free-examples.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { syncEntries, diffFromExpected } from './sync-free-examples';
import type { SyncEntry } from './sync-manifest';

describe('syncEntries', () => {
  let source: string;
  let dest: string;

  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'sync-src-'));
    dest = mkdtempSync(join(tmpdir(), 'sync-dst-'));
  });

  afterEach(() => {
    rmSync(source, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  it('copies a single file', () => {
    mkdirSync(join(source, 'ex1'), { recursive: true });
    writeFileSync(join(source, 'ex1', 'file.ts'), 'export const x = 1;');
    const entries: SyncEntry[] = [{ from: 'ex1', to: 'basics/ex1' }];
    syncEntries(entries, source, dest);
    expect(readFileSync(join(dest, 'basics/ex1/file.ts'), 'utf8')).toBe('export const x = 1;');
  });

  it('copies nested directories recursively', () => {
    mkdirSync(join(source, 'ex1', 'sub'), { recursive: true });
    writeFileSync(join(source, 'ex1', 'a.ts'), 'a');
    writeFileSync(join(source, 'ex1', 'sub', 'b.ts'), 'b');
    const entries: SyncEntry[] = [{ from: 'ex1', to: 'out/ex1' }];
    syncEntries(entries, source, dest);
    expect(readFileSync(join(dest, 'out/ex1/a.ts'), 'utf8')).toBe('a');
    expect(readFileSync(join(dest, 'out/ex1/sub/b.ts'), 'utf8')).toBe('b');
  });

  it('wipes existing destination before copy (idempotent rename)', () => {
    mkdirSync(join(source, 'ex1'), { recursive: true });
    writeFileSync(join(source, 'ex1', 'new.ts'), 'new');
    mkdirSync(join(dest, 'out/ex1'), { recursive: true });
    writeFileSync(join(dest, 'out/ex1', 'stale.ts'), 'stale');
    const entries: SyncEntry[] = [{ from: 'ex1', to: 'out/ex1' }];
    syncEntries(entries, source, dest);
    expect(existsSync(join(dest, 'out/ex1/stale.ts'))).toBe(false);
    expect(readFileSync(join(dest, 'out/ex1/new.ts'), 'utf8')).toBe('new');
  });

  it('throws if a source path does not exist', () => {
    const entries: SyncEntry[] = [{ from: 'missing', to: 'out/missing' }];
    expect(() => syncEntries(entries, source, dest)).toThrow(/missing/);
  });

  it('handles multiple entries in one pass', () => {
    mkdirSync(join(source, 'a'), { recursive: true });
    mkdirSync(join(source, 'b'), { recursive: true });
    writeFileSync(join(source, 'a', 'x.ts'), 'ax');
    writeFileSync(join(source, 'b', 'y.ts'), 'by');
    const entries: SyncEntry[] = [
      { from: 'a', to: 'out/a' },
      { from: 'b', to: 'out/b' },
    ];
    syncEntries(entries, source, dest);
    expect(readFileSync(join(dest, 'out/a/x.ts'), 'utf8')).toBe('ax');
    expect(readFileSync(join(dest, 'out/b/y.ts'), 'utf8')).toBe('by');
  });
});

describe('diffFromExpected', () => {
  let source: string;
  let dest: string;

  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'diff-src-'));
    dest = mkdtempSync(join(tmpdir(), 'diff-dst-'));
  });

  afterEach(() => {
    rmSync(source, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  it('returns empty array when dest matches source per manifest', () => {
    mkdirSync(join(source, 'ex1'), { recursive: true });
    writeFileSync(join(source, 'ex1', 'f.ts'), 'content');
    mkdirSync(join(dest, 'out/ex1'), { recursive: true });
    writeFileSync(join(dest, 'out/ex1', 'f.ts'), 'content');
    const entries: SyncEntry[] = [{ from: 'ex1', to: 'out/ex1' }];
    expect(diffFromExpected(entries, source, dest)).toEqual([]);
  });

  it('reports path when dest content differs', () => {
    mkdirSync(join(source, 'ex1'), { recursive: true });
    writeFileSync(join(source, 'ex1', 'f.ts'), 'new');
    mkdirSync(join(dest, 'out/ex1'), { recursive: true });
    writeFileSync(join(dest, 'out/ex1', 'f.ts'), 'stale');
    const entries: SyncEntry[] = [{ from: 'ex1', to: 'out/ex1' }];
    expect(diffFromExpected(entries, source, dest)).toContain('out/ex1/f.ts');
  });

  it('reports path when dest is missing a file', () => {
    mkdirSync(join(source, 'ex1'), { recursive: true });
    writeFileSync(join(source, 'ex1', 'f.ts'), 'content');
    const entries: SyncEntry[] = [{ from: 'ex1', to: 'out/ex1' }];
    expect(diffFromExpected(entries, source, dest)).toContain('out/ex1/f.ts');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd $PRO && npx vitest run scripts/sync-free-examples.test.ts
```

Expected: tests fail with "Cannot find module './sync-free-examples'".

---

### Task 1.5: Implement the sync script

**Files:** Create `$PRO/scripts/sync-free-examples.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { FREE_EXAMPLE_MANIFEST, type SyncEntry } from './sync-manifest';

export function syncEntries(entries: SyncEntry[], sourceRoot: string, destRoot: string): void {
  for (const entry of entries) {
    const src = join(sourceRoot, entry.from);
    const dst = join(destRoot, entry.to);
    if (!existsSync(src)) {
      throw new Error(`Source missing: ${entry.from} (resolved to ${src})`);
    }
    if (existsSync(dst)) {
      rmSync(dst, { recursive: true, force: true });
    }
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true });
  }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

export function diffFromExpected(entries: SyncEntry[], sourceRoot: string, destRoot: string): string[] {
  const differences: string[] = [];
  for (const entry of entries) {
    const src = join(sourceRoot, entry.from);
    const dst = join(destRoot, entry.to);
    if (!existsSync(src)) continue;
    const srcFiles = walk(src).map((f) => relative(src, f).replace(/\\/g, '/'));
    const dstFiles = new Set(walk(dst).map((f) => relative(dst, f).replace(/\\/g, '/')));
    for (const rel of srcFiles) {
      const destFile = join(dst, rel);
      if (!dstFiles.has(rel)) {
        differences.push(`${entry.to}/${rel}`);
        continue;
      }
      const srcContent = readFileSync(join(src, rel));
      const dstContent = readFileSync(destFile);
      if (!srcContent.equals(dstContent)) {
        differences.push(`${entry.to}/${rel}`);
      }
    }
    for (const rel of dstFiles) {
      if (!srcFiles.includes(rel)) {
        differences.push(`${entry.to}/${rel} (extra)`);
      }
    }
  }
  return differences;
}

function main(): void {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const angflowRoot = process.env.ANGFLOW_ROOT ?? join(process.cwd(), '..', 'angflow');
  const destRoot = process.cwd();

  if (!existsSync(angflowRoot)) {
    console.error(`ANGFLOW_ROOT does not exist: ${angflowRoot}`);
    console.error(`Set ANGFLOW_ROOT env var to the path of a local angflow checkout.`);
    process.exit(1);
  }

  if (checkOnly) {
    const diffs = diffFromExpected(FREE_EXAMPLE_MANIFEST, angflowRoot, destRoot);
    if (diffs.length > 0) {
      console.error(`Sync drift detected (${diffs.length} files):`);
      for (const d of diffs) console.error(`  ${d}`);
      console.error(`\nRun \`npm run sync-free-examples\` and commit the result.`);
      process.exit(1);
    }
    console.log('Sync is up to date.');
    return;
  }

  console.log(`Syncing ${FREE_EXAMPLE_MANIFEST.length} entries from ${angflowRoot}...`);
  syncEntries(FREE_EXAMPLE_MANIFEST, angflowRoot, destRoot);
  console.log('Sync complete.');
}

if (process.argv[1]?.endsWith('sync-free-examples.ts') || process.argv[1]?.endsWith('sync-free-examples.js')) {
  main();
}
```

- [ ] **Step 2: Run the tests and confirm they pass**

```bash
cd $PRO && npx vitest run scripts/sync-free-examples.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 3: Run the script with an empty manifest to sanity-check**

```bash
cd $PRO && npm run sync-free-examples
```

Expected: `Syncing 0 entries from ... Sync complete.` Nothing changes on disk.

```bash
cd $PRO && npm run sync-free-examples:check
```

Expected: `Sync is up to date.` Exit 0.

- [ ] **Step 4: Commit**

```bash
cd $PRO
git add scripts/sync-free-examples.ts scripts/sync-free-examples.test.ts
git commit -m "feat(sync): implement sync script with tests"
```

---

### Task 1.6: Add CI workflow

**Files:** Create `$PRO/.github/workflows/sync-check.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Sync Check

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  verify-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout angflow-pro
        uses: actions/checkout@v4
        with:
          path: angflow-pro

      - name: Checkout angflow (public)
        uses: actions/checkout@v4
        with:
          repository: angflow/angflow
          path: angflow

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install angflow-pro deps
        working-directory: angflow-pro
        run: npm ci

      - name: Verify sync is up to date
        working-directory: angflow-pro
        env:
          ANGFLOW_ROOT: ${{ github.workspace }}/angflow
        run: npm run sync-free-examples:check
```

- [ ] **Step 2: Commit**

```bash
cd $PRO
git add .github/workflows/sync-check.yml
git commit -m "ci: verify free-example sync on every PR"
```

> **Note:** The `angflow/angflow` repo URL may need adjustment to the actual GitHub owner/org once confirmed. CI will fail until the public repo is reachable — acceptable, since PR1 lands the plumbing only.

---

### Task 1.7: Add CONTRIBUTING note

**Files:** Create `$PRO/CONTRIBUTING.md`

- [ ] **Step 1: Write the file**

````markdown
# Contributing to angflow-pro

## Free examples are synced from angflow

The `basics/`, `nodes/custom-*`, `edges/custom-*`, etc. folders under `src/app/examples/` are **synced copies** of free examples that live canonically in the public `angflow` repo at `examples/angular/src/app/examples/`.

**Do not edit those folders directly in this repo.** Your changes will be overwritten on the next sync.

### To update a free example

1. Clone `angflow` (public) next to `angflow-pro`:
   ```
   ../angflow
   ./         <- you are here
   ```
2. Edit the example in `../angflow/examples/angular/src/app/examples/<name>/`.
3. Open a PR in angflow.
4. Once merged, run in angflow-pro:
   ```bash
   npm run sync-free-examples
   ```
5. Commit the mirrored changes and open a PR in angflow-pro.
6. CI will fail any angflow-pro PR that has drifted free-example content.

### Which folders are synced?

See `scripts/sync-manifest.ts`. The entries map angflow paths to angflow-pro paths.

### Adding a new free example

1. Author it in angflow.
2. Add a `{ from, to }` entry to `scripts/sync-manifest.ts`.
3. Run `npm run sync-free-examples`.
4. Hand-write the route in the appropriate `*.routes.ts`.
5. Hand-add the `EXAMPLES` entry with `tier: 'free'` and `sourceUrl`.
````

- [ ] **Step 2: Commit**

```bash
cd $PRO
git add CONTRIBUTING.md
git commit -m "docs: explain free-example sync flow"
```

---

## PR2: Basics Category + First 5 Syncs

**Goal:** Introduce the `basics` category. Sync the 5 most foundational free examples.

### Task 2.1: Add `basics` to `CATEGORIES`

**Files:** Modify `$PRO/src/app/shared/data/examples.ts`

- [ ] **Step 1: Prepend `basics` entry**

In the `CATEGORIES` array, insert as the first entry:

```ts
{ id: 'basics', title: 'Basics', description: 'Start here — core APIs every flow uses', icon: '✦' },
```

- [ ] **Step 2: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd $PRO
git add src/app/shared/data/examples.ts
git commit -m "feat(examples): add basics category"
```

---

### Task 2.2: Add 5 manifest entries for basics

**Files:** Modify `$PRO/scripts/sync-manifest.ts`

- [ ] **Step 1: Replace `FREE_EXAMPLE_MANIFEST` with entries**

```ts
export const FREE_EXAMPLE_MANIFEST: SyncEntry[] = [
  { from: 'examples/angular/src/app/examples/overview',            to: 'src/app/examples/basics/overview' },
  { from: 'examples/angular/src/app/examples/save-restore',        to: 'src/app/examples/basics/save-restore' },
  { from: 'examples/angular/src/app/examples/backgrounds-variants', to: 'src/app/examples/basics/backgrounds-variants' },
  { from: 'examples/angular/src/app/examples/minimap-custom',      to: 'src/app/examples/basics/minimap-custom' },
  { from: 'examples/angular/src/app/examples/drag-from-sidebar',   to: 'src/app/examples/basics/drag-from-sidebar' },
];
```

- [ ] **Step 2: Run sync**

```bash
cd $PRO && npm run sync-free-examples
```

Expected: `Syncing 5 entries ... Sync complete.` Five directories now exist under `src/app/examples/basics/`.

- [ ] **Step 3: Spot-check one copied folder**

```bash
ls $PRO/src/app/examples/basics/overview/
```

Expected: TypeScript and CSS files copied verbatim from angflow.

---

### Task 2.3: Create `basics.routes.ts`

**Files:** Create `$PRO/src/app/examples/basics/basics.routes.ts`

- [ ] **Step 1: Inspect each synced component to find its class name**

Each example folder has one `*.component.ts` (or similarly named) file exporting a component class. Open each to note the exported class name:

- `overview/overview.component.ts` → `OverviewExampleComponent`
- `save-restore/save-restore.component.ts` → `SaveRestoreExampleComponent`
- `backgrounds-variants/backgrounds-variants.component.ts` → `BackgroundsVariantsExampleComponent`
- `minimap-custom/minimap-custom.component.ts` → `MinimapCustomExampleComponent`
- `drag-from-sidebar/drag-from-sidebar.component.ts` → `DragFromSidebarExampleComponent`

(Confirm these names by opening each file — they are Angular standalone components.)

- [ ] **Step 2: Write the routes file**

```ts
import { Routes } from '@angular/router';

export const BASICS_ROUTES: Routes = [
  {
    path: 'overview',
    loadComponent: () =>
      import('./overview/overview.component').then((m) => m.OverviewExampleComponent),
  },
  {
    path: 'save-restore',
    loadComponent: () =>
      import('./save-restore/save-restore.component').then((m) => m.SaveRestoreExampleComponent),
  },
  {
    path: 'backgrounds-variants',
    loadComponent: () =>
      import('./backgrounds-variants/backgrounds-variants.component').then(
        (m) => m.BackgroundsVariantsExampleComponent,
      ),
  },
  {
    path: 'minimap-custom',
    loadComponent: () =>
      import('./minimap-custom/minimap-custom.component').then((m) => m.MinimapCustomExampleComponent),
  },
  {
    path: 'drag-from-sidebar',
    loadComponent: () =>
      import('./drag-from-sidebar/drag-from-sidebar.component').then(
        (m) => m.DragFromSidebarExampleComponent,
      ),
  },
];
```

If any class-name guesses above were wrong, adjust accordingly before proceeding.

---

### Task 2.4: Wire `basics` into `examples.routes.ts`

**Files:** Modify `$PRO/src/app/examples/examples.routes.ts`

- [ ] **Step 1: Add the lazy child route**

Insert as the FIRST child route under the `ExampleShellComponent` children array (before `layout`):

```ts
{
  path: 'basics',
  loadChildren: () =>
    import('./basics/basics.routes').then((m) => m.BASICS_ROUTES),
},
```

- [ ] **Step 2: Type-check and build**

```bash
cd $PRO && npx tsc --noEmit && npm run build
```

Expected: no errors. Build produces `dist/` output.

---

### Task 2.5: Add 5 `EXAMPLES` registry entries with `tier: 'free'`

**Files:** Modify `$PRO/src/app/shared/data/examples.ts`

- [ ] **Step 1: Prepend basics entries at the top of `EXAMPLES`**

```ts
// Basics
{ id: 'overview',             title: 'Overview',              description: 'Nodes, edges, and events in a minimal flow',                       category: 'basics', route: '/examples/basics/overview',             type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/overview' },
{ id: 'save-restore',         title: 'Save and restore',      description: 'Serialize a flow to JSON and rehydrate it',                        category: 'basics', route: '/examples/basics/save-restore',         type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/save-restore' },
{ id: 'backgrounds-variants', title: 'Background variants',   description: 'Dots, lines, and cross background patterns',                       category: 'basics', route: '/examples/basics/backgrounds-variants', type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/backgrounds-variants' },
{ id: 'minimap-custom',       title: 'Minimap customization', description: 'Colour, size, and node styling on the minimap',                    category: 'basics', route: '/examples/basics/minimap-custom',       type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/minimap-custom' },
{ id: 'drag-from-sidebar',    title: 'Drag from sidebar',     description: 'Palette panel with draggable nodes onto the canvas',              category: 'basics', route: '/examples/basics/drag-from-sidebar',    type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/drag-from-sidebar' },
```

- [ ] **Step 2: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

---

### Task 2.6: Run dev server and verify each route renders

- [ ] **Step 1: Start the server**

```bash
cd $PRO && npm start
```

Expected: compiles without errors, serves on `http://localhost:4200`.

- [ ] **Step 2: Navigate to each basics route in a browser**

Visit and confirm each URL renders a live flow diagram:
- http://localhost:4200/examples/basics/overview
- http://localhost:4200/examples/basics/save-restore
- http://localhost:4200/examples/basics/backgrounds-variants
- http://localhost:4200/examples/basics/minimap-custom
- http://localhost:4200/examples/basics/drag-from-sidebar

Also visit http://localhost:4200/examples — confirm Basics tiles appear in the grid.

If a route 404s or the component errors, check the class name imports in `basics.routes.ts` and the route paths in the registry.

- [ ] **Step 3: Stop the dev server**

Ctrl+C in the terminal running `npm start`.

---

### Task 2.7: Commit PR2

- [ ] **Step 1: Commit**

```bash
cd $PRO
git add scripts/sync-manifest.ts src/app/examples/basics/ src/app/examples/examples.routes.ts src/app/shared/data/examples.ts
git commit -m "feat(examples): add basics category with 5 synced free examples"
```

---

## PR3: Distribute Remaining 10 Free Examples

**Goal:** Sync the remaining free examples into their existing pro categories and resolve the `validation` merge.

### Task 3.1: Add 10 more manifest entries

**Files:** Modify `$PRO/scripts/sync-manifest.ts`

- [ ] **Step 1: Append entries**

Extend `FREE_EXAMPLE_MANIFEST`:

```ts
// Nodes
{ from: 'examples/angular/src/app/examples/custom-node',   to: 'src/app/examples/nodes/custom-node' },
{ from: 'examples/angular/src/app/examples/node-resizer',  to: 'src/app/examples/nodes/node-resizer' },
{ from: 'examples/angular/src/app/examples/node-toolbar',  to: 'src/app/examples/nodes/node-toolbar' },
// Edges
{ from: 'examples/angular/src/app/examples/custom-edge',   to: 'src/app/examples/edges/custom-edge' },
{ from: 'examples/angular/src/app/examples/edge-types',    to: 'src/app/examples/edges/edge-types' },
{ from: 'examples/angular/src/app/examples/edge-toolbar',  to: 'src/app/examples/edges/edge-toolbar' },
{ from: 'examples/angular/src/app/examples/floating-edges', to: 'src/app/examples/edges/floating-edges' },
// Subflows
{ from: 'examples/angular/src/app/examples/sub-flows',     to: 'src/app/examples/subflows/sub-flows' },
// Node I/O
{ from: 'examples/angular/src/app/examples/typed-handles', to: 'src/app/examples/node-io/typed-handles' },
```

(Do NOT yet add `connection-validation` — handled in Task 3.6.)

- [ ] **Step 2: Run sync**

```bash
cd $PRO && npm run sync-free-examples
```

Expected: 14 entries synced (5 basics + 9 new).

---

### Task 3.2: Register the 3 nodes routes

**Files:** Modify `$PRO/src/app/examples/nodes/nodes.routes.ts`

- [ ] **Step 1: Open and inspect current routes**

```bash
cat $PRO/src/app/examples/nodes/nodes.routes.ts
```

Note the existing shape (currently holds `shapes` and `position-animation`).

- [ ] **Step 2: Append 3 new routes**

Add to `NODES_ROUTES`:

```ts
{
  path: 'custom-node',
  loadComponent: () =>
    import('./custom-node/custom-node.component').then((m) => m.CustomNodeExampleComponent),
},
{
  path: 'node-resizer',
  loadComponent: () =>
    import('./node-resizer/node-resizer.component').then((m) => m.NodeResizerExampleComponent),
},
{
  path: 'node-toolbar',
  loadComponent: () =>
    import('./node-toolbar/node-toolbar.component').then((m) => m.NodeToolbarExampleComponent),
},
```

(Confirm class names in each synced file before saving.)

- [ ] **Step 3: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3.3: Register the 4 edges routes

**Files:** Modify `$PRO/src/app/examples/edges/edges.routes.ts`

- [ ] **Step 1: Append routes**

```ts
{
  path: 'custom-edge',
  loadComponent: () =>
    import('./custom-edge/custom-edge.component').then((m) => m.CustomEdgeExampleComponent),
},
{
  path: 'edge-types',
  loadComponent: () =>
    import('./edge-types/edge-types.component').then((m) => m.EdgeTypesExampleComponent),
},
{
  path: 'edge-toolbar',
  loadComponent: () =>
    import('./edge-toolbar/edge-toolbar.component').then((m) => m.EdgeToolbarExampleComponent),
},
{
  path: 'floating-edges',
  loadComponent: () =>
    import('./floating-edges/floating-edges.component').then((m) => m.FloatingEdgesExampleComponent),
},
```

- [ ] **Step 2: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3.4: Register the `sub-flows` and `typed-handles` routes

**Files:** Modify `$PRO/src/app/examples/subflows/subflows.routes.ts` and `$PRO/src/app/examples/node-io/node-io.routes.ts`

- [ ] **Step 1: Append `sub-flows` to `SUBFLOWS_ROUTES`**

```ts
{
  path: 'sub-flows',
  loadComponent: () =>
    import('./sub-flows/sub-flows.component').then((m) => m.SubFlowsExampleComponent),
},
```

- [ ] **Step 2: Append `typed-handles` to `NODE_IO_ROUTES`**

```ts
{
  path: 'typed-handles',
  loadComponent: () =>
    import('./typed-handles/typed-handles.component').then((m) => m.TypedHandlesExampleComponent),
},
```

- [ ] **Step 3: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3.5: Add registry entries for the 9 distributed free examples

**Files:** Modify `$PRO/src/app/shared/data/examples.ts`

- [ ] **Step 1: Add to `EXAMPLES`**

Insert each entry in the section that matches its category (with existing pro entries). Exact placement doesn't matter for rendering — the grid filters by `category`.

```ts
// Free — Nodes
{ id: 'custom-node',   title: 'Custom node',   description: 'Author a custom node type with templated content and handles',  category: 'nodes',    route: '/examples/nodes/custom-node',   type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/custom-node' },
{ id: 'node-resizer',  title: 'Node resizer',  description: 'Resizable nodes with handles on every side and corner',         category: 'nodes',    route: '/examples/nodes/node-resizer',  type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/node-resizer' },
{ id: 'node-toolbar',  title: 'Node toolbar',  description: 'Floating action toolbar attached to selected nodes',             category: 'nodes',    route: '/examples/nodes/node-toolbar',  type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/node-toolbar' },
// Free — Edges
{ id: 'custom-edge',    title: 'Custom edge',     description: 'Draw a custom edge component with a bespoke path and label', category: 'edges',    route: '/examples/edges/custom-edge',     type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/custom-edge' },
{ id: 'edge-types',     title: 'Edge types',      description: 'Default, step, smoothstep, straight, and bezier edges',      category: 'edges',    route: '/examples/edges/edge-types',      type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/edge-types' },
{ id: 'edge-toolbar',   title: 'Edge toolbar',    description: 'Floating action toolbar attached to selected edges',         category: 'edges',    route: '/examples/edges/edge-toolbar',    type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/edge-toolbar' },
{ id: 'floating-edges', title: 'Floating edges',  description: 'Edges that attach to the nearest point on a node outline',   category: 'edges',    route: '/examples/edges/floating-edges',  type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/floating-edges' },
// Free — Subflows
{ id: 'sub-flows',      title: 'Subflows',        description: 'Nested subgraphs with parent/child relationships',           category: 'subflows', route: '/examples/subflows/sub-flows',    type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/sub-flows' },
// Free — Node I/O
{ id: 'typed-handles',  title: 'Typed handles',   description: 'Connection validation via type IDs on handles',              category: 'node-io',  route: '/examples/node-io/typed-handles', type: 'example', tier: 'free', sourceUrl: 'https://github.com/angflow/angflow/tree/main/examples/angular/src/app/examples/typed-handles' },
```

- [ ] **Step 2: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3.6: Resolve the `validation` merge

**Goal:** Pick the stronger of angflow's `connection-validation` and angflow-pro's `interaction/validation`. Converge on one canonical implementation.

- [ ] **Step 1: Compare the two implementations**

Open both:
- `$ANGFLOW/examples/angular/src/app/examples/connection-validation/connection-validation.component.ts`
- `$PRO/src/app/examples/interaction/validation/validation.ts`
- `$PRO/src/app/examples/interaction/validation/validation.spec.ts`

Compare feature sets, code quality, and teaching clarity.

- [ ] **Step 2: Decide merge outcome**

Pick **ONE** of three outcomes:

**Outcome A — angflow's version is stronger or good enough.**
Keep angflow's `connection-validation` as canonical. In angflow-pro, delete `src/app/examples/interaction/validation/`, add a manifest entry:
```ts
{ from: 'examples/angular/src/app/examples/connection-validation', to: 'src/app/examples/interaction/validation' },
```
Run `npm run sync-free-examples`. Re-tag the registry entry for `id: 'validation'` as `tier: 'free'` and add `sourceUrl` pointing to `connection-validation` in angflow. Update the route file if the class name differs (rename during sync is not supported; keep the folder name as `validation` in pro but the component file as-synced — angular doesn't care about the folder name).

**Outcome B — pro's version is stronger.**
Leave pro's `interaction/validation` unchanged (`tier: 'pro'`). In angflow, keep `connection-validation` as the free teaching example — but do NOT sync it into pro. Instead, add `connection-validation` as a distinct free entry under `interaction/`:
```ts
{ from: 'examples/angular/src/app/examples/connection-validation', to: 'src/app/examples/interaction/connection-validation' },
```
Register its route and add a `tier: 'free'` registry entry with `id: 'connection-validation'`.

**Outcome C — they teach different things and both deserve to exist.**
Same as outcome B.

- [ ] **Step 3: Implement the chosen outcome**

Apply the file changes described in the chosen outcome. Run sync + type-check + dev server.

- [ ] **Step 4: Record decision in the commit message**

When committing, lead with the outcome letter: "feat(examples): resolve validation merge — outcome A/B/C".

---

### Task 3.7: Verify all distributed routes render

- [ ] **Step 1: Run dev server**

```bash
cd $PRO && npm start
```

- [ ] **Step 2: Visit each new route**

Visit and confirm rendering:
- /examples/nodes/custom-node, /examples/nodes/node-resizer, /examples/nodes/node-toolbar
- /examples/edges/custom-edge, /examples/edges/edge-types, /examples/edges/edge-toolbar, /examples/edges/floating-edges
- /examples/subflows/sub-flows
- /examples/node-io/typed-handles
- /examples/interaction/validation (and /connection-validation if outcome B/C)

Also visit /examples — confirm all new tiles appear in their categories with expected tier badges (badge rendering lands in PR6, so for PR3 just confirm tiles exist).

- [ ] **Step 3: Stop the server**

---

### Task 3.8: Commit PR3

- [ ] **Step 1: Stage and commit**

```bash
cd $PRO
git add scripts/sync-manifest.ts src/app/examples src/app/shared/data/examples.ts
git commit -m "feat(examples): distribute remaining 9 free examples + resolve validation merge"
```

---

## PR4: Move `showcase` to Pro Templates

**Goal:** Port angflow's `showcase` mini-app into angflow-pro's `templates/` area.

### Task 4.1: Copy `showcase/` folder into pro

- [ ] **Step 1: Copy the directory**

```bash
cp -r $ANGFLOW/examples/angular/src/app/showcase $PRO/src/app/templates/showcase
```

- [ ] **Step 2: Inspect for external imports**

Open each file under `$PRO/src/app/templates/showcase/` and grep for imports that point outside the folder:

```bash
grep -rn "from '\.\./" $PRO/src/app/templates/showcase/
grep -rn "from 'src/" $PRO/src/app/templates/showcase/
```

Expected: no matches referencing code outside `showcase/`. If any exist, those files must be ported alongside or refactored inline before committing.

---

### Task 4.2: Register `showcase` route in templates

**Files:** Modify `$PRO/src/app/templates/templates.routes.ts`

- [ ] **Step 1: Open templates.routes.ts and add route**

Add to `TEMPLATES_ROUTES`:

```ts
{
  path: 'showcase',
  loadComponent: () =>
    import('./showcase/showcase.component').then((m) => m.ShowcaseComponent),
},
```

(Confirm the class name in `$PRO/src/app/templates/showcase/showcase.component.ts`.)

- [ ] **Step 2: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

Expected: no errors.

---

### Task 4.3: Add `TEMPLATES` registry entry

**Files:** Modify `$PRO/src/app/shared/data/examples.ts`

- [ ] **Step 1: Append to `TEMPLATES`**

```ts
{ id: 'showcase', title: 'Showcase', description: 'Interactive mini-application combining nodes, palette, inspector, and a simulation service', category: 'templates', route: '/templates/showcase', type: 'template', tier: 'pro' },
```

- [ ] **Step 2: Type-check**

```bash
cd $PRO && npx tsc --noEmit
```

---

### Task 4.4: Remove `showcase` from angflow

**Files:** Modify `$ANGFLOW/examples/angular/src/app/app.routes.ts`; delete `$ANGFLOW/examples/angular/src/app/showcase/`

- [ ] **Step 1: Delete the directory**

```bash
rm -rf $ANGFLOW/examples/angular/src/app/showcase
```

- [ ] **Step 2: Remove `showcase` import and route**

In `$ANGFLOW/examples/angular/src/app/app.routes.ts`, delete:

```ts
import { ShowcaseComponent } from './showcase/showcase.component';
```

And the route:

```ts
{ path: 'showcase', component: ShowcaseComponent },
```

- [ ] **Step 3: Build angflow examples app to confirm no broken imports**

```bash
cd $ANGFLOW/examples/angular && npm run build
```

Expected: build succeeds.

---

### Task 4.5: Verify and commit PR4

- [ ] **Step 1: Run angflow-pro dev server and visit showcase**

```bash
cd $PRO && npm start
```

Visit http://localhost:4200/templates/showcase — confirm the mini-app loads and interacts correctly.

- [ ] **Step 2: Stop the server**

- [ ] **Step 3: Commit in angflow-pro**

```bash
cd $PRO
git add src/app/templates/showcase src/app/templates/templates.routes.ts src/app/shared/data/examples.ts
git commit -m "feat(templates): port showcase mini-app from angflow"
```

- [ ] **Step 4: Commit in angflow**

```bash
cd $ANGFLOW
git add examples/angular/src/app
git commit -m "refactor(examples): remove showcase (now a pro template)"
```

---

## PR5: Strip `angflow/examples/angular` to Dev Harness

**Goal:** Replace the gallery shell with a reactflow-style flat-select dev harness. Keep all 15 examples + `kitchen-sink`.

### Task 5.1: Delete shell components

**Files:** Delete `$ANGFLOW/examples/angular/src/app/shell/`

- [ ] **Step 1: Delete the directory**

```bash
rm -rf $ANGFLOW/examples/angular/src/app/shell
```

---

### Task 5.2: Rewrite `app.routes.ts` as flat list

**Files:** Replace `$ANGFLOW/examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Write the new routes file**

```ts
import { Routes } from '@angular/router';
import { OverviewExampleComponent } from './examples/overview/overview.component';
import { CustomNodeExampleComponent } from './examples/custom-node/custom-node.component';
import { CustomEdgeExampleComponent } from './examples/custom-edge/custom-edge.component';
import { SubFlowsExampleComponent } from './examples/sub-flows/sub-flows.component';
import { NodeResizerExampleComponent } from './examples/node-resizer/node-resizer.component';
import { ConnectionValidationExampleComponent } from './examples/connection-validation/connection-validation.component';
import { DragFromSidebarExampleComponent } from './examples/drag-from-sidebar/drag-from-sidebar.component';
import { MinimapCustomExampleComponent } from './examples/minimap-custom/minimap-custom.component';
import { BackgroundsVariantsExampleComponent } from './examples/backgrounds-variants/backgrounds-variants.component';
import { SaveRestoreExampleComponent } from './examples/save-restore/save-restore.component';
import { EdgeTypesExampleComponent } from './examples/edge-types/edge-types.component';
import { NodeToolbarExampleComponent } from './examples/node-toolbar/node-toolbar.component';
import { EdgeToolbarExampleComponent } from './examples/edge-toolbar/edge-toolbar.component';
import { FloatingEdgesExampleComponent } from './examples/floating-edges/floating-edges.component';
import { TypedHandlesExampleComponent } from './examples/typed-handles/typed-handles.component';
import { KitchenSinkComponent } from './kitchen-sink/kitchen-sink.component';

export interface HarnessRoute {
  name: string;
  path: string;
  component: unknown;
}

export const HARNESS_ROUTES: HarnessRoute[] = [
  { name: 'Overview',              path: 'overview',              component: OverviewExampleComponent },
  { name: 'Custom node',           path: 'custom-node',           component: CustomNodeExampleComponent },
  { name: 'Custom edge',           path: 'custom-edge',           component: CustomEdgeExampleComponent },
  { name: 'Subflows',              path: 'sub-flows',             component: SubFlowsExampleComponent },
  { name: 'Node resizer',          path: 'node-resizer',          component: NodeResizerExampleComponent },
  { name: 'Connection validation', path: 'connection-validation', component: ConnectionValidationExampleComponent },
  { name: 'Drag from sidebar',     path: 'drag-from-sidebar',     component: DragFromSidebarExampleComponent },
  { name: 'Minimap custom',        path: 'minimap-custom',        component: MinimapCustomExampleComponent },
  { name: 'Backgrounds variants',  path: 'backgrounds-variants',  component: BackgroundsVariantsExampleComponent },
  { name: 'Save / restore',        path: 'save-restore',          component: SaveRestoreExampleComponent },
  { name: 'Edge types',            path: 'edge-types',            component: EdgeTypesExampleComponent },
  { name: 'Node toolbar',          path: 'node-toolbar',          component: NodeToolbarExampleComponent },
  { name: 'Edge toolbar',          path: 'edge-toolbar',          component: EdgeToolbarExampleComponent },
  { name: 'Floating edges',        path: 'floating-edges',        component: FloatingEdgesExampleComponent },
  { name: 'Typed handles',         path: 'typed-handles',         component: TypedHandlesExampleComponent },
  { name: 'Kitchen sink',          path: 'kitchen-sink',          component: KitchenSinkComponent },
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...HARNESS_ROUTES.map((r) => ({ path: r.path, component: r.component as never })),
];
```

If a component class name differs from what's imported above, open its file and correct the import.

- [ ] **Step 2: Type-check**

```bash
cd $ANGFLOW/examples/angular && npx tsc --noEmit
```

Expected: no errors.

---

### Task 5.3: Rewrite `AppComponent` as minimal shell

**Files:** Replace `$ANGFLOW/examples/angular/src/app/app.ts`, `app.html`, `app.css`

- [ ] **Step 1: Rewrite `app.ts`**

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { HARNESS_ROUTES } from './app.routes';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  private readonly router = inject(Router);

  protected readonly routes = HARNESS_ROUTES;

  protected readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.replace(/^\//, '')),
      startWith(this.router.url.replace(/^\//, '')),
    ),
    { initialValue: 'overview' },
  );

  protected onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.router.navigateByUrl('/' + value);
  }
}
```

- [ ] **Step 2: Rewrite `app.html`**

```html
<header class="harness-header">
  <strong>angflow dev harness</strong>
  <select [value]="currentPath()" (change)="onChange($event)" aria-label="Select an example">
    @for (route of routes; track route.path) {
      <option [value]="route.path">{{ route.name }}</option>
    }
  </select>
</header>
<router-outlet />
```

- [ ] **Step 3: Rewrite `app.css`**

```css
:host { display: flex; flex-direction: column; height: 100vh; }
.harness-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  font-family: system-ui, sans-serif;
}
.harness-header strong { font-size: 0.875rem; }
.harness-header select { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
router-outlet + * { flex: 1; min-height: 0; }
```

- [ ] **Step 4: Type-check and build**

```bash
cd $ANGFLOW/examples/angular && npx tsc --noEmit && npm run build
```

Expected: build succeeds.

---

### Task 5.4: Update `examples/angular/README.md`

**Files:** Replace or create `$ANGFLOW/examples/angular/README.md`

- [ ] **Step 1: Write the README**

````markdown
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
````

- [ ] **Step 2: Commit angflow changes**

```bash
cd $ANGFLOW
git add examples/angular
git commit -m "refactor(examples): strip gallery shell, convert to dev harness"
```

---

### Task 5.5: Re-run sync in angflow-pro to confirm no drift

- [ ] **Step 1: Run sync:check**

```bash
cd $PRO && npm run sync-free-examples:check
```

Expected: `Sync is up to date.` Exit 0.

Free-example folder paths are preserved in PR5, so the sync should still match. If it fails, the paths in `sync-manifest.ts` need adjustment.

---

## PR6: Website polish — tier badges and source links

**Goal:** Render tier badges and per-tile source/CTA links on the examples grid and detail shell.

### Task 6.1: Render tier badges in `examples-grid`

**Files:** Modify `$PRO/src/app/examples/examples-grid/examples-grid.html`, `examples-grid.scss`

- [ ] **Step 1: Add a badge element to each tile**

Open `examples-grid.html` and add within each example tile (next to `title`):

```html
<span class="tier-badge" [class.tier-badge--free]="example.tier === 'free'" [class.tier-badge--pro]="example.tier === 'pro'">
  {{ example.tier === 'free' ? 'Free' : 'Pro' }}
</span>
```

- [ ] **Step 2: Style the badges**

Append to `examples-grid.scss`:

```scss
.tier-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 9999px;
  margin-left: 0.5rem;
  vertical-align: middle;
}
.tier-badge--free {
  background: #dcfce7;
  color: #166534;
}
.tier-badge--pro {
  background: #fef3c7;
  color: #92400e;
}
```

- [ ] **Step 3: Verify visually**

```bash
cd $PRO && npm start
```

Visit http://localhost:4200/examples — confirm tiles now show "Free" / "Pro" badges. Stop the server.

---

### Task 6.2: Add source / CTA link on tiles

**Files:** Modify `$PRO/src/app/examples/examples-grid/examples-grid.html`, `examples-grid.scss`

- [ ] **Step 1: Add link block beneath tile body**

```html
@if (example.tier === 'free' && example.sourceUrl) {
  <a class="tile-link tile-link--source" [href]="example.sourceUrl" target="_blank" rel="noopener">
    View source →
  </a>
}
@if (example.tier === 'pro') {
  <a class="tile-link tile-link--cta" href="https://angflow.dev/pro" target="_blank" rel="noopener">
    Get Pro repo access →
  </a>
}
```

(Replace `https://angflow.dev/pro` with the actual pricing URL once defined; leave the `angflow.dev/pro` placeholder for now and note in CONTRIBUTING that it's provisional.)

- [ ] **Step 2: Style the links**

Append to `examples-grid.scss`:

```scss
.tile-link {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
}
.tile-link--source { color: #2563eb; }
.tile-link--source:hover { text-decoration: underline; }
.tile-link--cta {
  color: #92400e;
  background: #fef3c7;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
}
.tile-link--cta:hover { background: #fde68a; }
```

- [ ] **Step 3: Verify visually**

```bash
cd $PRO && npm start
```

Visit /examples. Confirm free tiles show a blue "View source →" link; pro tiles show an amber CTA button. Clicking a free link opens the GitHub URL; CTA opens the pricing placeholder.

- [ ] **Step 4: Commit**

```bash
cd $PRO
git add src/app/examples/examples-grid
git commit -m "feat(examples-grid): render tier badges and per-tile links"
```

---

### Task 6.3: Update `example-shell` sidebar to include `basics`

**Files:** Modify `$PRO/src/app/examples/example-shell/example-shell.html` (and `.ts`/`.scss` if grouping logic changes)

- [ ] **Step 1: Confirm sidebar renders basics**

The existing `ExampleShellComponent.groupedExamples` computed property iterates over `CATEGORIES`. Since we added `basics` to `CATEGORIES` in PR2, it should already render. Open `example-shell.html` and confirm the template iterates categories without any hard-coded list that would miss `basics`.

If the template hard-codes categories, replace with a loop over `categories` signal.

- [ ] **Step 2: Run dev server and inspect the sidebar**

```bash
cd $PRO && npm start
```

Visit any example URL (e.g. /examples/basics/overview) — confirm the left sidebar shows `Basics` at the top with 5 entries.

- [ ] **Step 3: Commit if changes were made**

```bash
cd $PRO
git add src/app/examples/example-shell
git commit -m "feat(example-shell): ensure basics category renders in sidebar"
```

---

### Task 6.4: Add Angular trademark disclaimer to pro website

**Files:** Modify the main layout / footer in `$PRO/src/app/` — likely `nav-header` or a new footer partial.

- [ ] **Step 1: Locate the main layout**

```bash
ls $PRO/src/app/shared/components/nav-header/
cat $PRO/src/app/app.html
```

Identify where page-level chrome lives (likely `app.html` or `nav-header`).

- [ ] **Step 2: Add footer text**

In whichever template renders the page frame, add at the bottom:

```html
<footer class="site-footer">
  <small>
    Angflow is an independent open-source project. Angular is a trademark of Google LLC and is used for identification purposes only. This project is not affiliated with or endorsed by Google or the Angular team.
  </small>
</footer>
```

- [ ] **Step 3: Minimal styling**

In the matching SCSS file:

```scss
.site-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 0.75rem;
  text-align: center;
}
```

- [ ] **Step 4: Verify**

```bash
cd $PRO && npm start
```

Confirm the disclaimer text appears at the bottom of every page. Stop the server.

- [ ] **Step 5: Commit**

```bash
cd $PRO
git add src/app
git commit -m "feat(site): add Angular trademark disclaimer in footer"
```

---

### Task 6.5: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd $PRO && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run full build**

```bash
cd $PRO && npm run build
```

Expected: production build succeeds.

- [ ] **Step 3: Re-run sync:check**

```bash
cd $PRO && npm run sync-free-examples:check
```

Expected: up to date.

- [ ] **Step 4: In angflow, run harness build**

```bash
cd $ANGFLOW/examples/angular && npm run build
```

Expected: build succeeds.

---

## Acceptance criteria (end-to-end)

After all six PRs merge:

- angflow `examples/angular` serves at `http://localhost:4200` with a `<select>` header, 15 example entries + `kitchen-sink`, no sidebar gallery.
- angflow-pro `npm start` serves at `http://localhost:4200` with 8 categories (`basics` first) + templates. Every tile has a tier badge and either a source link (free) or a CTA (pro).
- `npm run sync-free-examples:check` exits 0 on a fresh checkout.
- CI workflow `sync-check.yml` passes on a green PR.
- No example folder in angflow is referenced by an obsolete route.
- `showcase` loads under `angflow-pro/templates/showcase`; it is removed from angflow.
- `connection-validation` / `validation` merge outcome is recorded in the PR3 commit message and the spec is consistent.
