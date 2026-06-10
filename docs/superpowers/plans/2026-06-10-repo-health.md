# Repo Health (CI, Packaging, Supply Chain, Tooling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken inherited xyflow CI with a real pipeline, fix packaging/supply-chain issues (unbounded `>=` dependency, peer-range lie, missing LICENSE/engines/repository metadata), repair `pnpm lint`, and clean repo hygiene.

**Architecture:** Pure repo-infrastructure changes — no library source code is touched. One new GitHub Actions workflow replaces three dead ones; package manifests are corrected; minimal flat ESLint configs are added to angular and mcp.

**Tech Stack:** pnpm workspaces, GitHub Actions, ESLint 9 (flat config) + typescript-eslint, vitest.

**Part of:** `2026-06-10-review-remediation-master.md` (Plan E). Independent of all other plans — can run in parallel with them, but coordinate on `packages/angular/package.json` if another plan bumps versions.

---

Verified findings beyond the review brief: the lockfile records `'@angflow/system': specifier '>=0.0.93', version 0.0.93` (registry resolution, stale vs. the `>=0.0.94` in package.json); the real remote is `https://github.com/shisu89/angflow.git` (not `angflow/angflow` as all four package.json files claim); mcp's build imports angular **source** (`../../angular/src/lib/agent/tool-schemas`) via tsx, so it does not need angular's dist — but angular's build does need system's dist; all three packages have `"test": "vitest run"`; `declarationMap: true` lives in three places (`tooling/tsconfig/base.json` — inherited by system and mcp — plus `packages/angular/tsconfig.json` and `tsconfig.lib.json`); the composite actions `ci-setup`/`ci-checks` are referenced only by `release.yml` and `playwright.yml` (codespell.yml is self-contained and worth keeping); no package references `@changesets/*` in devDependencies, so deleting `.changeset/` is clean.

### Task 1: Clean working tree — .gitignore gaps and screenshot artifacts

**Files:** Modify: `.gitignore`. Create (directory only, via shell): `screenshots/`

- [ ] **Step 1** Confirm no PNGs at repo root are tracked (must print nothing):
  ```
  git ls-files -- '*.png'
  ```
  Expected output: empty (the 9 root PNGs — `01-overview.png`, `custom-node-broken.png`, `demo-1-baseline.png` … `demo-5-chat-degraded.png`, `smoke-1-initial.png`, `smoke-2-final.png` — are all untracked, per `git status --short`).
- [ ] **Step 2** Move the session-artifact PNGs into an ignored directory (PowerShell; bash equivalent `mkdir screenshots && mv ./*.png screenshots/`):
  ```
  mkdir screenshots; mv *.png screenshots/
  ```
- [ ] **Step 3** Append to `.gitignore` (after the existing last line `.worktrees`, keeping the file's bare-pattern style):
  ```
  .worktrees
  *.tgz
  .env
  .env.*
  !.env.example
  /screenshots/
  ```
  (Only the last five lines are new; `.worktrees` shown for anchor context.)
- [ ] **Step 4** Verify:
  ```
  git status --short
  ```
  Expected output: only `M .gitignore` — all 9 `??` PNG entries gone.
- [ ] **Step 5** Commit:
  ```
  git add .gitignore
  git commit -m "chore: ignore tarballs, env files, and session screenshots"
  ```

### Task 2: `@angflow/system` dependency → `workspace:^` and lockfile refresh

**Files:** Modify: `packages/angular/package.json`, `pnpm-lock.yaml` (regenerated)

- [ ] **Step 1** Edit `packages/angular/package.json` dependencies block.
  Before:
  ```json
  "dependencies": {
    "@angflow/system": ">=0.0.94"
  },
  ```
  After:
  ```json
  "dependencies": {
    "@angflow/system": "workspace:^"
  },
  ```
  (pnpm rewrites this to `^0.0.94` in the published tarball; locally it always links `packages/system`, eliminating the registry/workspace split and the manual version-sync step.)
- [ ] **Step 2** Refresh the lockfile from the repo root:
  ```
  pnpm install
  ```
  Expected outcome: succeeds; `pnpm-lock.yaml` diff shows the stale entry under `packages/angular` change from `specifier: '>=0.0.93'` / `version: 0.0.93` to `specifier: workspace:^` / `version: link:../system`, and the registry-resolved `'@angflow/system@0.0.93'` snapshot entries disappear.
- [ ] **Step 3** Verify the link:
  ```
  grep -A 2 "'@angflow/system'" pnpm-lock.yaml
  ```
  Expected output includes `specifier: workspace:^` and `version: link:../system` under the `packages/angular` importer.
- [ ] **Step 4** Sanity-build (angular consumes system dist via tsconfig paths):
  ```
  pnpm --filter @angflow/system run build
  pnpm --filter @angflow/angular run build
  ```
  Expected outcome: both succeed (rollup → `packages/system/dist`, ngc + CSS bundle → `packages/angular/dist`).
- [ ] **Step 5** Commit:
  ```
  git add packages/angular/package.json pnpm-lock.yaml
  git commit -m "fix(angular): depend on @angflow/system via workspace:^ instead of unbounded >=0.0.94"
  ```

### Task 3: Fix the Angular peer-range lie (>=19 → >=21)

**Files:** Modify: `packages/angular/package.json`

- [ ] **Step 1** Edit `peerDependencies`. The library is compiled with `@angular/compiler-cli ^21.2.15` in `compilationMode: "partial"` (see `tsconfig.lib.json`); ngc-21 partial-Ivy output cannot be linked by Angular 19/20 consumers, so the advertised range is false advertising.
  Before:
  ```json
  "peerDependencies": {
    "@angular/common": ">=19.0.0",
    "@angular/core": ">=19.0.0",
    "@dagrejs/dagre": ">=3.0.0",
    "rxjs": ">=7.0.0"
  },
  ```
  After:
  ```json
  "peerDependencies": {
    "@angular/common": ">=21.0.0",
    "@angular/core": ">=21.0.0",
    "@dagrejs/dagre": ">=3.0.0",
    "rxjs": ">=7.0.0"
  },
  ```
  (`@angular/common` and `@angular/core` are the only `@angular/*` peers present; `rxjs`/`dagre` are unaffected.)
- [ ] **Step 2** Verify install still resolves cleanly (examples/angular pins `@angular/* ^21.2.x`, which satisfies the new range):
  ```
  pnpm install
  ```
  Expected output: no peer-dependency warnings for `@angflow/angular`.
- [ ] **Step 3** Commit:
  ```
  git add packages/angular/package.json pnpm-lock.yaml
  git commit -m "fix(angular): require @angular/core and @angular/common >=21 to match ngc-21 partial-Ivy output"
  ```

**Semver note for the release owner:** narrowing a peer range is semver-significant — the next `@angflow/angular` publish should be a **minor** bump. Do not publish as part of this plan.

### Task 4: Replace inherited xyflow CI with one real ci.yml

**Files:** Delete: `.github/workflows/release.yml`, `.github/workflows/playwright.yml`, `.github/workflows/dispatchWebsiteUpdate.yaml`, `.github/actions/ci-setup/action.yml`, `.github/actions/ci-checks/action.yml`, `.changeset/config.json`, `.changeset/README.md`. Create: `.github/workflows/ci.yml`. Modify: `package.json` (root). Keep: `codespell.yml` (self-contained, still useful). Test: every command the workflow runs, executed locally.

Rationale (verified): `release.yml` invokes `xyflow/changeset-action@v1` with `publish: pnpm release` — no `release` script exists anywhere, and `.changeset/config.json` still points at `repo: xyflow/xyflow` with `access: restricted` (would block the public `@angflow/*` scope even if it ran). `playwright.yml` runs `pnpm test:react` — no such script. `dispatchWebsiteUpdate.yaml` dispatches to `xyflow/web` with `secrets.PAT`. The composite `ci-checks` runs only root `pnpm build` + `pnpm typecheck`, which cover only system+angular — `@angflow/mcp` is never built or tested, making its schema-drift test (`packages/mcp/test/schema-snapshot.spec.ts`) dead weight. The composite actions are referenced only by the two deleted workflows, so inline everything and delete them. The documented release flow is manual `npm publish` (CLAUDE.md), so changesets goes too; no package depends on `@changesets/*`.

- [ ] **Step 1** Delete the dead CI surface:
  ```
  git rm .github/workflows/release.yml .github/workflows/playwright.yml .github/workflows/dispatchWebsiteUpdate.yaml
  git rm -r .github/actions .changeset
  ```
- [ ] **Step 2** Extend the root scripts so the whole workspace is covered (mcp was missing from `build` and `typecheck`; add a root `test`). Edit root `package.json`:
  Before:
  ```json
    "build": "pnpm --filter @angflow/system run build && pnpm --filter @angflow/angular run build",
    "build:system": "pnpm --filter @angflow/system run build",
    "build:angular": "pnpm --filter @angflow/angular run build",
    "lint": "pnpm --filter @angflow/system run lint && pnpm --filter @angflow/angular run lint",
    "typecheck": "pnpm --filter @angflow/system run typecheck && pnpm --filter @angflow/angular run typecheck",
  ```
  After:
  ```json
    "build": "pnpm --filter @angflow/system run build && pnpm --filter @angflow/angular run build && pnpm --filter @angflow/mcp run build",
    "build:system": "pnpm --filter @angflow/system run build",
    "build:angular": "pnpm --filter @angflow/angular run build",
    "build:mcp": "pnpm --filter @angflow/mcp run build",
    "lint": "pnpm --filter @angflow/system run lint && pnpm --filter @angflow/angular run lint",
    "typecheck": "pnpm --filter @angflow/system run typecheck && pnpm --filter @angflow/angular run typecheck && pnpm --filter @angflow/mcp run typecheck",
    "test": "pnpm --filter @angflow/system run test && pnpm --filter @angflow/angular run test && pnpm --filter @angflow/mcp run test",
  ```
  (Build order matters: angular's `tsconfig.lib.json` maps `@angflow/system` to `../system/dist/esm/index.d.ts`. mcp's build needs neither dist — its schema generator imports angular *source* via tsx — but keeping it last is the natural dependency order.)
- [ ] **Step 3** Create `.github/workflows/ci.yml` with exactly this content:
  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]

  concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: true

  jobs:
    ci:
      name: Build, typecheck, test
      runs-on: ubuntu-latest
      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Setup pnpm
          uses: pnpm/action-setup@v4

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: pnpm

        - name: Install dependencies
          run: pnpm install --frozen-lockfile

        - name: Build @angflow/system
          run: pnpm --filter @angflow/system run build

        - name: Build @angflow/angular
          run: pnpm --filter @angflow/angular run build

        - name: Build @angflow/mcp
          run: pnpm --filter @angflow/mcp run build

        - name: Typecheck
          run: pnpm typecheck

        - name: Test @angflow/system
          run: pnpm --filter @angflow/system run test

        - name: Test @angflow/angular
          run: pnpm --filter @angflow/angular run test

        - name: Test @angflow/mcp
          run: pnpm --filter @angflow/mcp run test
  ```
  (`pnpm/action-setup@v4` reads the pnpm version from the root `packageManager` field; it must run before `setup-node` so the pnpm cache works. `--frozen-lockfile` is now safe because Task 2 refreshed the lockfile.)
- [ ] **Step 4** Validate the YAML parses:
  ```
  pnpm dlx js-yaml .github/workflows/ci.yml
  ```
  Expected output: the parsed document printed as JSON, exit code 0 (no parse errors).
- [ ] **Step 5** Local dry-run of every command the workflow executes (no push required):
  ```
  pnpm install --frozen-lockfile
  pnpm --filter @angflow/system run build
  pnpm --filter @angflow/angular run build
  pnpm --filter @angflow/mcp run build
  pnpm typecheck
  pnpm --filter @angflow/system run test
  pnpm --filter @angflow/angular run test
  pnpm --filter @angflow/mcp run test
  ```
  Expected outcomes: install reports "Lockfile is up to date"; all three builds emit `dist/`; typecheck exits 0 for all three packages; vitest reports all suites passing in each package — including `packages/mcp/test/schema-snapshot.spec.ts`, which is now actually enforced in CI. If any test fails, fix the underlying drift (`pnpm -F @angflow/mcp run generate:schemas` for snapshot drift) before committing.
- [ ] **Step 6** Commit:
  ```
  git add .github .changeset package.json
  git commit -m "ci: replace inherited xyflow workflows with a single build/typecheck/test pipeline covering system, angular, and mcp"
  ```

### Task 5: Fix `pnpm lint` — flat ESLint configs for angular and mcp, wire into CI

**Files:** Create: `packages/angular/eslint.config.mjs`, `packages/mcp/eslint.config.mjs`. Modify: `packages/angular/package.json`, `packages/mcp/package.json`, `package.json` (root), `.github/workflows/ci.yml`. Test: `pnpm lint`

Verified state: `packages/angular` has `"lint": "eslint --ext .ts src"` but no ESLint config and no eslint devDependency — root `pnpm lint` chains into it and dies. Only `packages/system/.eslintrc.js` exists (extends the private eslintrc-style `@angflow/eslint-config`, pinned to eslint 8.57 — leave system alone). `angular-eslint` appears nowhere in the repo, so keep the new configs minimal (plain typescript-eslint, no Angular template plugin). pnpm isolates per-package eslint versions, so eslint 9 in angular/mcp coexists with system's eslint 8.

- [ ] **Step 1** Create `packages/angular/eslint.config.mjs`:
  ```js
  // @ts-check
  import tseslint from 'typescript-eslint';

  export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**'] },
    ...tseslint.configs.recommended,
    {
      files: ['**/*.ts'],
      rules: {
        // Baseline-friendly: the port has intentional `any` at framework boundaries.
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
  );
  ```
- [ ] **Step 2** Create `packages/mcp/eslint.config.mjs` with identical content (same imports, same rules — the two files are intentionally the same minimal baseline).
- [ ] **Step 3** Edit `packages/angular/package.json` — fix the script (eslint 9 flat config rejects `--ext`) and add devDeps.
  Script before/after:
  ```json
  "lint": "eslint --ext .ts src",
  ```
  ```json
  "lint": "eslint src",
  ```
  devDependencies — add `"eslint": "^9.39.0"` and `"typescript-eslint": "^8.46.0"` (alphabetical position among existing devDeps).
- [ ] **Step 4** Edit `packages/mcp/package.json` — add to scripts:
  ```json
  "lint": "eslint src",
  ```
  and add the same two devDependencies (`"eslint": "^9.39.0"`, `"typescript-eslint": "^8.46.0"`).
- [ ] **Step 5** Edit root `package.json` lint chain.
  Before:
  ```json
  "lint": "pnpm --filter @angflow/system run lint && pnpm --filter @angflow/angular run lint",
  ```
  After:
  ```json
  "lint": "pnpm --filter @angflow/system run lint && pnpm --filter @angflow/angular run lint && pnpm --filter @angflow/mcp run lint",
  ```
- [ ] **Step 6** Install the new devDependencies (required after devDep edits; run from repo root):
  ```
  pnpm install
  ```
  Expected outcome: succeeds; lockfile gains eslint 9.x and typescript-eslint 8.x entries under `packages/angular` and `packages/mcp`.
- [ ] **Step 7** Run and stabilize:
  ```
  pnpm lint
  ```
  Expected outcome: exits 0 for all three packages. Contingency, in order of preference: (a) if a recommended rule fires en masse across angular/mcp sources (likely candidates: `@typescript-eslint/no-unused-vars` on intentionally-unused params, `no-empty`, `@typescript-eslint/ban-ts-comment`), turn that rule off or down in the package's `eslint.config.mjs` `rules` block rather than touching source files; (b) only fix source for genuine one-or-two-line findings. If `pnpm -F @angflow/system lint` (untouched eslint-8 setup) fails, diagnose its `@angflow/eslint-config` resolution before changing anything — it is expected to pass as-is. The goal is a passing, useful baseline, not a style crusade.
- [ ] **Step 8** Wire lint into CI. Edit `.github/workflows/ci.yml`, inserting after the `Typecheck` step:
  ```yaml
        - name: Lint
          run: pnpm lint
  ```
  Re-validate: `pnpm dlx js-yaml .github/workflows/ci.yml` → parses, exit 0. Local dry-run of the new step: `pnpm lint` → exit 0.
- [ ] **Step 9** Commit:
  ```
  git add packages/angular/eslint.config.mjs packages/mcp/eslint.config.mjs packages/angular/package.json packages/mcp/package.json package.json pnpm-lock.yaml .github/workflows/ci.yml
  git commit -m "fix(lint): add flat eslint configs to angular and mcp, repair broken lint scripts, run lint in CI"
  ```

### Task 6: Tarball and metadata polish

**Files:** Create: `packages/mcp/LICENSE`. Modify: `package.json` (root), `packages/system/package.json`, `packages/angular/package.json`, `packages/mcp/package.json`, `tooling/tsconfig/base.json`, `packages/angular/tsconfig.json`, `packages/angular/tsconfig.lib.json`

- [ ] **Step 1 (LICENSE)** Copy the root LICENSE (MIT — identical file already exists in `packages/angular` and `packages/system`) into mcp:
  ```
  cp LICENSE packages/mcp/LICENSE
  ```
  (npm always includes `LICENSE` in the tarball even though mcp's `files` is `["dist", "README.md"]`.)
- [ ] **Step 2 (repository URLs)** `git remote -v` shows the real origin is `https://github.com/shisu89/angflow.git`; all four manifests claim the nonexistent `angflow/angflow`. Fix all four:
  Root `package.json` before/after:
  ```json
  "repository": "git@github.com:angflow/angflow.git",
  ```
  ```json
  "repository": "git+https://github.com/shisu89/angflow.git",
  ```
  In each of `packages/system/package.json`, `packages/angular/package.json`, `packages/mcp/package.json` (each keeps its own `directory` value):
  ```json
  "repository": {
    "type": "git",
    "url": "https://github.com/angflow/angflow.git",
    "directory": "packages/system"
  },
  ```
  becomes
  ```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/shisu89/angflow.git",
    "directory": "packages/system"
  },
  ```
- [ ] **Step 3 (engines)** Add to `packages/system/package.json` and `packages/angular/package.json` (mcp already has it), placed after `"license"`:
  ```json
  "engines": {
    "node": ">=20"
  },
  ```
- [ ] **Step 4 (declarationMap)** Published tarballs ship only `dist` (`files: ["dist"]`), so emitted `.d.ts.map` files reference a `../src` that consumers never receive — dead weight plus broken go-to-source. Flip all three occurrences:
  - `tooling/tsconfig/base.json` (inherited by system **and** mcp): `"declarationMap": true` → `"declarationMap": false`
  - `packages/angular/tsconfig.json`: `"declarationMap": true` → `"declarationMap": false`
  - `packages/angular/tsconfig.lib.json` (the actual publish build): `"declarationMap": true` → `"declarationMap": false`
  Nothing in the repo depends on declaration maps (the angular package consumes system via the `paths` alias to source/dist `.d.ts`, not via maps).
- [ ] **Step 5 (system exports)** Add `types` to the `browser` condition in `packages/system/package.json`. Before:
  ```json
  "browser": {
    "import": "./dist/esm/index.js",
    "require": "./dist/umd/index.js"
  },
  ```
  After:
  ```json
  "browser": {
    "types": "./dist/esm/index.d.ts",
    "import": "./dist/esm/index.js",
    "require": "./dist/umd/index.js"
  },
  ```
  (The `node` condition already carries `types`; `browser` resolvers — bundler TS setups with `customConditions` — currently lose typings.)
- [ ] **Step 6** Verify:
  ```
  pnpm build
  ls packages/system/dist/esm/*.d.ts.map packages/angular/dist/esm/*.d.ts.map packages/mcp/dist/*.d.ts.map
  ```
  Expected: build succeeds; the `ls` finds **no** `.d.ts.map` files. Contingency: if system's dist still contains maps, the rollup TypeScript plugin in `tooling/rollup-config` is overriding the tsconfig — inspect it and set `declarationMap: false` there. Then dry-run the packing metadata without publishing:
  ```
  pnpm --filter @angflow/system exec npm pack --dry-run
  pnpm --filter @angflow/angular exec npm pack --dry-run
  pnpm --filter @angflow/mcp exec npm pack --dry-run
  ```
  Expected: each lists LICENSE (including mcp's new one), no `.map` declaration files, and the angular tarball's `package.json` shows `"@angflow/system": "^0.0.94"` (the `workspace:^` rewrite). `--dry-run` writes nothing.
- [ ] **Step 7** Commit:
  ```
  git add packages/mcp/LICENSE package.json packages/system/package.json packages/angular/package.json packages/mcp/package.json tooling/tsconfig/base.json packages/angular/tsconfig.json packages/angular/tsconfig.lib.json
  git commit -m "chore(packaging): fix repository URLs, add mcp LICENSE and engines fields, drop declaration maps from published dist, add browser types export"
  ```

### Task 7: Supply-chain hygiene — .npmrc cleanup and pinned preinstall

**Files:** Delete: `.npmrc`. Modify: `package.json` (root)

- [ ] **Step 1** `.npmrc` contains exactly two lines: `legacy-peer-deps=true` (npm-only; pnpm ignores it) and `strict-peer-dependencies=false` (pnpm's default since v7 — redundant). Nothing pnpm needs remains, so delete the file:
  ```
  git rm .npmrc
  ```
- [ ] **Step 2** Pin the preinstall guard. Root `package.json` before/after:
  ```json
  "preinstall": "npx only-allow pnpm",
  ```
  ```json
  "preinstall": "npx only-allow@1 pnpm",
  ```
- [ ] **Step 3** Verify:
  ```
  pnpm install
  ```
  Expected outcome: completes normally (preinstall guard passes, no behavior change without `.npmrc`).
- [ ] **Step 4** Commit:
  ```
  git add .npmrc package.json
  git commit -m "chore: remove npm-only .npmrc leftovers and pin only-allow to major 1"
  ```

### Task 8: Changelogs for angular, mcp, and a fork notice for system

**Files:** Create: `packages/angular/CHANGELOG.md`, `packages/mcp/CHANGELOG.md`. Modify: `packages/system/CHANGELOG.md`

- [ ] **Step 1** Create `packages/angular/CHANGELOG.md`:
  ```markdown
  # @angflow/angular

  ## 0.2.0

  Current release (group auto-size: `getGroupBounds` + `sizeGroupToChildren`).
  For detailed history prior to this file's introduction, see
  `git log --oneline -- packages/angular`. Future releases append entries here.
  ```
  (Adjust the version heading to the actual current version in `packages/angular/package.json` at execution time.)
- [ ] **Step 2** Create `packages/mcp/CHANGELOG.md`:
  ```markdown
  # @angflow/mcp

  ## 0.0.1

  Initial release: MCP server exposing a live angflow canvas over the
  agent-bridge WebSocket transport. For history, see
  `git log --oneline -- packages/mcp`. Future releases append entries here.
  ```
  (Adjust the version heading to the actual current version at execution time.)
- [ ] **Step 3** `packages/system/CHANGELOG.md` currently opens with `# @xyflow/system` / `## 0.0.76` — the stale upstream changelog. Prepend above the existing first line, keeping everything below intact:
  ```markdown
  # @angflow/system

  ## @angflow fork

  This package diverged from `@xyflow/system` at v0.0.76. Everything below this
  section is the inherited upstream xyflow changelog and does not describe
  @angflow releases. For @angflow/system history (0.0.77+), see
  `git log --oneline -- packages/system`.

  ---
  ```
- [ ] **Step 4** Verify: `head -12 packages/system/CHANGELOG.md` shows the fork notice first; both new files exist.
- [ ] **Step 5** Commit:
  ```
  git add packages/angular/CHANGELOG.md packages/mcp/CHANGELOG.md packages/system/CHANGELOG.md
  git commit -m "docs(changelog): seed angular and mcp changelogs, mark system changelog as upstream fork baseline"
  ```

### Task 9: CLAUDE.md drift fixes

**Files:** Modify: `CLAUDE.md`

- [ ] **Step 1** Publish flow: the comment `# Update @angflow/system version in package.json if system was bumped` is obsolete after Task 2. Before:
  ```bash
  # Angular
  cd packages/angular
  # Update @angflow/system version in package.json if system was bumped
  npm version patch          # bump 0.0.1 → 0.0.2
  ```
  After:
  ```bash
  # Angular
  cd packages/angular
  # @angflow/system is a workspace:^ dependency — pnpm rewrites it to ^<current system version>
  # on publish, so no manual version sync is needed. Publish with pnpm (not npm) so the
  # workspace protocol is rewritten: pnpm publish --access public
  npm version patch          # bump 0.0.1 → 0.0.2
  ```
  and change the angular publish line below it from `npm publish --access public` to `pnpm publish --access public` (also update the corresponding row in the Key Commands table). This matters: a raw `npm publish` would ship a literal `workspace:^` specifier.
- [ ] **Step 2** Add a short CI note under "Build & Local Dev Flow" (new subsection):
  ```markdown
  ### CI

  `.github/workflows/ci.yml` runs on pushes/PRs to main: `pnpm install --frozen-lockfile`,
  builds system → angular → mcp, then `pnpm typecheck`, `pnpm lint`, and vitest in all
  three packages. The mcp schema-drift test runs in CI — regenerate the snapshot
  (`pnpm -F @angflow/mcp run generate:schemas`) when the agent tool catalog changes.
  ```
- [ ] **Step 3** Line 3 ("Published as `@angflow/system` and `@angflow/angular`") omits mcp — extend to "…, `@angflow/angular`, and `@angflow/mcp`". (Verified: the Consumer Apps section's `workspace:*` statement is accurate — leave it.)
- [ ] **Step 4** Commit:
  ```
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md for workspace:^ publish flow and new CI pipeline"
  ```

---

**Sequencing recap (hard order):** Task 1 (clean status) → Task 2 (workspace:^ + lockfile, unblocks `--frozen-lockfile`) → Task 3 (peers) → Task 4 (CI, depends on knowing the three `test` scripts pass) → Task 5 (lint + CI wiring) → Task 6 (packaging polish) → Task 7 (supply chain) → Task 8 (changelogs) → Task 9 (docs). No publishing anywhere in this plan; CI verification is entirely local dry-runs.
