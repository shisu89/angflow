# Angular 19 + Zoneless-First Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise `@angflow/angular` peer-dep floor to Angular 19 and remove every `NgZone` usage from the Angular package so the library is zoneless-native while remaining functional for zonal consumers. Ship as `@angflow/angular@0.1.0`.

**Architecture:** The Angular package currently injects `NgZone` in two components (`pane.component.ts`, `ng-flow.component.ts`) and wraps D3 event handlers in `runOutsideAngular` / `zone.run` pairs. Under zoneless change detection and signal-driven CD (Angular 18+), these wrappers are unnecessary — signal writes notify the reactive graph directly without Zone.js involvement. The refactor removes the wrappers, removes the `NgZone` injections, and documents the pattern for future contributors. `@angflow/system` is already zoneless-safe (framework-agnostic timers) and receives no code changes. Ships as three commits on a single branch, one published minor version.

**Tech Stack:** Angular 19 (peer floor), TypeScript 5.9, Vitest, rollup, ng-packagr via `ngc`. Runs on Windows with bash shell (use Unix-style paths and forward slashes in commands).

**Spec reference:** `docs/superpowers/specs/2026-04-18-angular-19-zoneless-upgrade-design.md`.

---

## File Structure

**Files modified:**

- `packages/angular/package.json` — peer-dep and devDep floor bumps.
- `packages/angular/tsconfig.lib.json` — verify `target` is `ES2022` or newer (Angular 19 requirement).
- `packages/angular/src/lib/container/pane/pane.component.ts` — remove `NgZone` injection; remove `runOutsideAngular` and `zone.run` wrappers.
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` — remove `NgZone` injection; remove `zone.run` wrapper around `onPanZoom` callback; leave `setTimeout(..., 50)` at line 636 unchanged (zoneless-safe as-is — signals drive CD).
- `CLAUDE.md` — add three-rule pattern guide under a new section.

**Files created:**

- `docs/upgrade/0.1.0-migration.md` — consumer-facing breaking-changes document.

**Files deliberately not touched:**

- `packages/angular/src/lib/components/minimap/minimap.component.ts` — `requestAnimationFrame` calls already drive signal writes; zoneless-safe.
- `packages/system/src/**` — framework-agnostic timers; all seven `setTimeout` / `requestAnimationFrame` call sites invoke registered callbacks that write to signals in the Angular layer, which drive CD correctly in both modes.
- `packages/angular/src/lib/services/flow-store.service.ts` — FlowStore reactivity redesign is carved out to its own sibling spec, not touched here.

---

## Branch

Work on branch `feat/angular-19-zoneless`. All tasks commit to that branch. The publish happens manually after merge per the spec's release steps.

```bash
cd /c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow
git checkout main
git pull
git checkout -b feat/angular-19-zoneless
```

---

## Task 1: Bump Angular peer-dep floor to 19

**Goal:** Floor bump only. No source changes. Verify the package still builds and typechecks under the new floor.

**Files:**
- Modify: `packages/angular/package.json`
- Modify: `packages/angular/tsconfig.lib.json` (only if `target` is older than ES2022)

- [ ] **Step 1: Inspect current `target` in `tsconfig.lib.json`**

Run (from repo root, bash):
```bash
grep -E '"target"|"lib"' packages/angular/tsconfig.lib.json
```

If `target` is already `"ES2022"` or newer, skip Step 4. Otherwise proceed with the tsconfig edit in Step 4.

- [ ] **Step 2: Edit `packages/angular/package.json` — peerDependencies**

Change the `peerDependencies` block from:
```jsonc
"peerDependencies": {
  "@angular/common": ">=17.0.0",
  "@angular/core": ">=17.0.0",
  "rxjs": ">=7.0.0"
},
```

To:
```jsonc
"peerDependencies": {
  "@angular/common": ">=19.0.0",
  "@angular/core": ">=19.0.0",
  "rxjs": ">=7.0.0"
},
```

- [ ] **Step 3: Edit `packages/angular/package.json` — devDependencies compiler floors**

Change the `devDependencies` block entries for `@angular/compiler` and `@angular/compiler-cli` from:
```jsonc
"@angular/compiler": ">=17.0.0",
"@angular/compiler-cli": ">=17.0.0",
```

To:
```jsonc
"@angular/compiler": ">=19.0.0",
"@angular/compiler-cli": ">=19.0.0",
```

Leave `@angular/platform-browser` and `@angular/platform-browser-dynamic` at `^21.2.7` — they're top pins used for CI testing against current Angular, not floors.

- [ ] **Step 4: Bump `target` in `tsconfig.lib.json` if needed**

If Step 1 showed a `target` older than `ES2022` (e.g. `ES2020`), edit `packages/angular/tsconfig.lib.json` and set:
```jsonc
"target": "ES2022",
```

Angular 19 requires ES2022 or newer. If the existing value is already at ES2022 or newer, skip this step.

- [ ] **Step 5: Run typecheck to verify nothing broke**

```bash
cd packages/angular
npx tsc --noEmit
```

Expected: exits 0, no output.

- [ ] **Step 6: Run build to verify compilation**

```bash
cd packages/angular
npm run build
```

Expected: `ngc` completes without errors, `dist/esm/` populated, `dist/style.css` produced.

- [ ] **Step 7: Run existing test suite to confirm no regressions**

```bash
cd packages/angular
npm run test
```

Expected: all existing Vitest specs pass (flow-store, ng-flow.service, handle, handle-group, connection-line, edge-renderer.data-enrichment, changes).

- [ ] **Step 8: Commit**

From repo root:
```bash
git add packages/angular/package.json packages/angular/tsconfig.lib.json
git commit -m "chore(angular): raise peer-dep floor to >=19"
```

(Drop `packages/angular/tsconfig.lib.json` from the `git add` command if Step 4 was skipped.)

---

## Task 2: Remove NgZone from `pane.component.ts`

**Goal:** Remove the `NgZone` injection and the three `runOutsideAngular` / `zone.run` wrappers. The box-selection mouse handlers now write directly to FlowStore signals; signal writes drive CD in both zoneless and zonal modes.

**Files:**
- Modify: `packages/angular/src/lib/container/pane/pane.component.ts`

- [ ] **Step 1: Read the current file and confirm it matches the expected starting state**

```bash
grep -n "NgZone\|zone\." packages/angular/src/lib/container/pane/pane.component.ts
```

Expected output:
```
1:import { Component, ChangeDetectionStrategy, input, output, inject, NgZone, OnDestroy, ElementRef } from '@angular/core';
21:  private zone = inject(NgZone);
93:    this.zone.runOutsideAngular(() => {
118:    this.zone.run(() => {
151:    this.zone.run(() => {
```

If the output doesn't match (e.g. extra usages have appeared), stop and inspect before proceeding.

- [ ] **Step 2: Edit the import on line 1**

Change:
```typescript
import { Component, ChangeDetectionStrategy, input, output, inject, NgZone, OnDestroy, ElementRef } from '@angular/core';
```

To:
```typescript
import { Component, ChangeDetectionStrategy, input, output, inject, OnDestroy, ElementRef } from '@angular/core';
```

- [ ] **Step 3: Remove the `NgZone` injection on line 21**

Delete the line:
```typescript
  private zone = inject(NgZone);
```

- [ ] **Step 4: Unwrap the `runOutsideAngular` block at line 93**

Change:
```typescript
    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.boundOnMouseMove!);
      document.addEventListener('mouseup', this.boundOnMouseUp!);
    });
```

To:
```typescript
    document.addEventListener('mousemove', this.boundOnMouseMove!);
    document.addEventListener('mouseup', this.boundOnMouseUp!);
```

- [ ] **Step 5: Unwrap the `zone.run` block at line 118 (onMouseMove body)**

Change:
```typescript
    this.zone.run(() => {
      this.store.userSelectionRect.set(selectionRect);

      const transform = this.store.transform();
      const partially = this.selectionMode() === SelectionMode.Partial;
      const nodesInside = getNodesInside(
        this.store.nodeLookup,
        selectionRect,
        transform,
        partially
      );

      // Always dispatch — passing an empty list through addSelectedNodes is how
      // we deselect nodes that fell outside the shrinking box.
      const nodeIds = nodesInside.map(n => n.id);
      this.store.addSelectedNodes(nodeIds);
    });
```

To (removes the wrapper but keeps the inner body intact):
```typescript
    this.store.userSelectionRect.set(selectionRect);

    const transform = this.store.transform();
    const partially = this.selectionMode() === SelectionMode.Partial;
    const nodesInside = getNodesInside(
      this.store.nodeLookup,
      selectionRect,
      transform,
      partially
    );

    // Always dispatch — passing an empty list through addSelectedNodes is how
    // we deselect nodes that fell outside the shrinking box.
    const nodeIds = nodesInside.map(n => n.id);
    this.store.addSelectedNodes(nodeIds);
```

- [ ] **Step 6: Unwrap the `zone.run` block at line 151 (onMouseUp body)**

Change:
```typescript
    this.zone.run(() => {
      this.store.userSelectionActive.set(false);
      this.store.userSelectionRect.set(null);
      // Mark nodes selection as active if nodes were selected
      if (this.store.selectedNodes().length > 0) {
        this.store.nodesSelectionActive.set(true);
      }
      this.selectionEnd.emit(event);
    });
```

To:
```typescript
    this.store.userSelectionActive.set(false);
    this.store.userSelectionRect.set(null);
    // Mark nodes selection as active if nodes were selected
    if (this.store.selectedNodes().length > 0) {
      this.store.nodesSelectionActive.set(true);
    }
    this.selectionEnd.emit(event);
```

- [ ] **Step 7: Verify the file has no remaining NgZone references**

```bash
grep -n "NgZone\|zone\." packages/angular/src/lib/container/pane/pane.component.ts
```

Expected: no output (exit code 1 from grep is fine here).

- [ ] **Step 8: Run typecheck**

```bash
cd packages/angular
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 9: Run build**

```bash
cd packages/angular
npm run build
```

Expected: succeeds.

- [ ] **Step 10: Run test suite**

```bash
cd packages/angular
npm run test
```

Expected: all specs pass. No pane-specific specs exist today; verification is via the integration-level example smoke test in the validation task.

---

## Task 3: Remove NgZone from `ng-flow.component.ts`

**Goal:** Remove the `NgZone` injection and the single `zone.run` wrapper around the `onPanZoom` callback. Leave the `setTimeout(..., 50)` at line 636 unchanged — it schedules a `doFitView` call whose body writes to signals, which is zoneless-safe by construction.

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`

- [ ] **Step 1: Confirm the starting state**

```bash
grep -n "NgZone\|this\.zone" packages/angular/src/lib/container/ng-flow/ng-flow.component.ts
```

Expected output:
```
16:  NgZone,
191:  private readonly zone = inject(NgZone);
742:        this.zone.run(() => {
```

If the output differs (extra `this.zone` usages), stop and inspect before proceeding. Only the single `zone.run` at line 742 should exist.

- [ ] **Step 2: Remove `NgZone` from the import list**

Edit the multi-line Angular core import at lines 1–20. Find the line that reads:
```typescript
  NgZone,
```

Delete that single line from the `import { ... } from '@angular/core'` block.

- [ ] **Step 3: Remove the `NgZone` injection at line 191**

Delete the line:
```typescript
  private readonly zone = inject(NgZone);
```

- [ ] **Step 4: Unwrap the `zone.run` block at line 742 (onPanZoom callback)**

Change:
```typescript
      onPanZoom: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        this.zone.run(() => {
          const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
          this.store.transform.set(transform);
          this.store.bumpVersion();
          this.move.emit({ event, viewport });
          this.viewportChange.emit(viewport);
        });
      },
```

To:
```typescript
      onPanZoom: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
        this.store.transform.set(transform);
        this.store.bumpVersion();
        this.move.emit({ event, viewport });
        this.viewportChange.emit(viewport);
      },
```

- [ ] **Step 5: Verify no remaining NgZone references**

```bash
grep -n "NgZone\|this\.zone" packages/angular/src/lib/container/ng-flow/ng-flow.component.ts
```

Expected: no output.

- [ ] **Step 6: Run typecheck**

```bash
cd packages/angular
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 7: Run build**

```bash
cd packages/angular
npm run build
```

Expected: succeeds.

- [ ] **Step 8: Run test suite**

```bash
cd packages/angular
npm run test
```

Expected: all specs pass.

---

## Task 4: Add pattern-guide rules to `CLAUDE.md`

**Goal:** Document the three rules governing NgZone / event handler / timer usage so future contributors do not reintroduce Zone.js assumptions.

**Files:**
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 1: Append a new section to `CLAUDE.md`**

Append the following section to the end of the file:

```markdown

## Zoneless-first contributor rules

The Angular package assumes no Zone.js. These rules preserve that invariant:

1. **Never inject `NgZone`.** If you think you need it, you're mixing Zone.js assumptions into zoneless-native code. Drive view updates via signal writes instead.
2. **Event handlers from outside Angular (D3 bindings, native listeners, `requestAnimationFrame` callbacks) must drive view updates via signal writes.** Never rely on Zone to tick change detection. Writing to a signal the template reads is sufficient.
3. **Timers are fine.** `setTimeout` / `setInterval` / `requestAnimationFrame` used to schedule logic are framework-agnostic and work in both zoneless and zonal modes. Only the *purpose* matters — using them to force CD is forbidden (rule 2); using them to delay work is allowed.

Library builds and examples must keep the zonal example suite passing (`examples/angular/`) and meet the zoneless example validation bar documented in `docs/superpowers/specs/2026-04-18-angular-19-zoneless-upgrade-design.md`.
```

- [ ] **Step 2: Verify the file is well-formed**

```bash
wc -l CLAUDE.md
```

Expected: line count is approximately 96 (previous) + ~13 (new section with surrounding blanks) = ~109 lines.

Spot-check the appended section renders correctly by searching for the new heading:

```bash
grep -n "Zoneless-first contributor rules" CLAUDE.md
```

Expected: one match.

- [ ] **Step 3: Commit Tasks 2, 3, and 4 as a single commit**

From repo root:
```bash
git add packages/angular/src/lib/container/pane/pane.component.ts \
        packages/angular/src/lib/container/ng-flow/ng-flow.component.ts \
        CLAUDE.md
git commit -m "refactor(angular): remove NgZone usage from pane and ng-flow components

Drop NgZone injection and runOutsideAngular/zone.run wrappers now that
signal writes drive change detection in both zoneless and zonal modes
(Angular 18+). setTimeout at ng-flow:636 is retained since it merely
schedules a signal-writing callback and is zoneless-safe by construction.
Documents the invariant in CLAUDE.md for future contributors."
```

---

## Task 5: Write the 0.1.0 migration document

**Goal:** Produce `docs/upgrade/0.1.0-migration.md`, the consumer-facing breaking-changes document that ships with the release.

**Files:**
- Create: `docs/upgrade/0.1.0-migration.md`

- [ ] **Step 1: Confirm the target directory exists**

```bash
ls docs/upgrade 2>&1
```

If the directory does not exist yet, create it:
```bash
mkdir -p docs/upgrade
```

- [ ] **Step 2: Write the file**

Create `docs/upgrade/0.1.0-migration.md` with the following content:

```markdown
# Migrating to `@angflow/angular@0.1.0`

**Target release:** `@angflow/angular@0.1.0` (previous: `0.0.13`).
**Estimated migration effort:** 30–60 minutes for a typical consumer.

This release raises the minimum supported Angular version and makes the library
zoneless-native. Public API shape is unchanged.

## 1. Required peer dependency changes

The library now requires Angular 19 or newer. Consumers on Angular 17 or 18
must upgrade before installing `0.1.0`.

| Angular version | `@angflow/angular@0.0.x` | `@angflow/angular@0.1.0` |
|---|---|---|
| 17.x | ✅ | ❌ |
| 18.x | ✅ | ❌ |
| 19.x | ✅ | ✅ |
| 20.x | ✅ | ✅ |
| 21.x | ✅ | ✅ |

If you are already on Angular 19 or newer, no action is required.

## 2. Removed internal `NgZone` usage

Previous versions injected `NgZone` inside `PaneComponent` and `NgFlowComponent`
and wrapped D3 event handlers in `runOutsideAngular(...)` and `zone.run(...)`.
Those wrappers are gone. Signal writes alone now drive change detection, which
works correctly under both zonal and zoneless consumers on Angular 18+.

**Observable effect under zonal consumers:** marginally more change detection
ticks during pan, zoom, and box selection, because D3 event handlers now fire
inside the zone. Performance impact is expected to be negligible for apps whose
components use `OnPush`. Profile before and after if your app has expensive
non-`OnPush` components at the root.

**Action needed:** likely none. If you explicitly depended on `runOutsideAngular`
behavior inside angflow code paths, migrate by adopting zoneless change
detection (see Section 3) or by using `OnPush` consistently.

## 3. Zoneless mode is now first-class supported

Consumers may bootstrap with `provideExperimentalZonelessChangeDetection` (the
v19 import name; v20+ consumers should use the stable `provideZonelessChangeDetection`).
Library code paths no longer depend on Zone.js.

Adopting zoneless is opt-in. Existing zonal apps continue to work.

## 4. No public API shape changes

- `NgFlowComponent` inputs and outputs are unchanged.
- `FlowStore` and `NgFlowService` public members are unchanged.
- `@angflow/system` exports are unchanged.

## 5. Internal contributor rules (not consumer-facing)

`CLAUDE.md` adds a three-rule pattern guide for library contributors (no
`NgZone`, external event handlers must write to signals, timers used for
scheduling are fine). Consumer code is unaffected.

## Rollback

If a regression surfaces under a zonal consumer after upgrading, the `0.0.x`
branch remains available. A patch release on the pre-upgrade branch (e.g.
`0.0.14`) will be published to unblock while the regression is diagnosed.
```

- [ ] **Step 3: Verify the file**

```bash
wc -l docs/upgrade/0.1.0-migration.md
```

Expected: around 60 lines.

- [ ] **Step 4: Commit**

From repo root:
```bash
git add docs/upgrade/0.1.0-migration.md
git commit -m "docs(upgrade): 0.1.0 migration guide

Documents the Angular 19 peer-floor bump and zoneless-first migration
for consumers of @angflow/angular@0.1.0."
```

---

## Task 6: Validation (pre-release)

**Goal:** Run the full validation matrix from the spec before tagging. This is the gate on publishing `0.1.0-rc.0`.

No files change in this task.

- [ ] **Step 1: Final typecheck and build across both packages**

```bash
cd packages/system
npm run build
cd ../angular
npx tsc --noEmit
npm run build
```

Expected: all three commands exit 0.

- [ ] **Step 2: Run the full test suite**

```bash
cd packages/angular
npm run test
```

Expected: every spec passes.

- [ ] **Step 3: Run the zonal example app and smoke-test**

```bash
cd examples/angular
npm run dev
```

Open the browser to the URL the dev server prints. Walk through the smoke matrix:

- Gallery examples: `overview`, `custom-node`, `custom-edge`, `edge-types`, `floating-edges`, `connection-validation`, `drag-from-sidebar`, `sub-flows`, `node-resizer`, `node-toolbar`, `edge-toolbar`, `minimap-custom`, `backgrounds-variants`, `save-restore`, `typed-handles`.
- Kitchen-sink: exercise every toggle, drag nodes, connect edges, resize, delete, fit view, minimap interaction.
- Showcase: open, drag nodes, connect the simulation pipeline.

Feature pass = drag nodes, pan/zoom (scroll + pinch if available), box-select, connect edges, delete, resize, keyboard navigation (Delete, Ctrl+A, Escape), minimap click-pan, background renders correctly.

Any regression stops the release.

- [ ] **Step 4: Confirm the zoneless example exists (cross-track gate)**

The zoneless example is owned by the examples track. Before tagging `0.1.0`, verify:

- An example app exists that bootstraps with `provideExperimentalZonelessChangeDetection` (v19 name) or `provideZonelessChangeDetection` (v20+ name).
- The example exercises: node drag, pan/zoom (scroll + pinch), edge connection drag, multi-select via box-select, minimap interaction, keyboard delete.
- Under a 200-node graph, a 3-second node-drag holds ≥ 55 FPS in Chrome DevTools Performance.

If the zoneless example does not yet exist, publish only `0.1.0-rc.0` (see Task 7) and hold `0.1.0` until the examples track lands the example.

- [ ] **Step 5: Consumer validation (out-of-repo)**

Link the current single consumer app to the local build:

```bash
cd packages/angular
npm run build
npm pack
# produces angflow-angular-0.1.0.tgz (after the version bump in Task 7)
# or install the rc from npm once published
```

The consumer owner (you) installs the `.tgz` or the `0.1.0-rc.0` tag from npm and smoke-tests the consumer's flow-editor surfaces. Consumer sign-off gates the real `0.1.0` publish.

---

## Task 7: Release

**Goal:** Publish the pre-release, get consumer sign-off, publish the real release, tag.

No files change in this task.

- [ ] **Step 1: Publish the release candidate**

```bash
cd packages/angular
# Edit package.json version manually to 0.1.0-rc.0 (npm version does not handle
# pre-release strings cleanly mid-branch). Or use:
npm version 0.1.0-rc.0 --no-git-tag-version
npm run build
npm publish --access public --tag next
```

`--tag next` prevents the rc from becoming the default `latest` on npm.

Note the 2FA prompt — approve in browser per the CLAUDE.md publish flow.

- [ ] **Step 2: Wait for consumer sign-off**

Consumer owner installs `@angflow/angular@0.1.0-rc.0`, runs their app, confirms
no regressions. Block until this happens.

- [ ] **Step 3: Publish `0.1.0`**

```bash
cd packages/angular
npm version 0.1.0 --no-git-tag-version
npm run build
npm publish --access public
```

This publishes to the default `latest` tag.

- [ ] **Step 4: Commit the version bump and tag**

From repo root:
```bash
git add packages/angular/package.json
git commit -m "chore(release): @angflow/angular@0.1.0"
git tag @angflow/angular@0.1.0
git push origin feat/angular-19-zoneless
git push origin @angflow/angular@0.1.0
```

Open a PR from `feat/angular-19-zoneless` to `main` per the CLAUDE.md PR flow.

- [ ] **Step 5: Rollback plan (reference only — do not execute unless needed)**

If a zonal consumer reports a regression after `0.1.0`:

```bash
# Switch to the pre-upgrade main
git checkout main~N  # N = number of commits since the last 0.0.x tag
git checkout -b hotfix/0.0.14
# Apply the fix.
cd packages/angular
npm version 0.0.14 --no-git-tag-version
npm run build
npm publish --access public --tag legacy
# Tag 'legacy' avoids replacing 'latest'.
```

`0.1.x` continues forward on `main`; `0.0.x` becomes a maintenance branch.

---

## Self-Review Notes

Verified against spec `docs/superpowers/specs/2026-04-18-angular-19-zoneless-upgrade-design.md`:

- Goals 1–5 in spec → Tasks 1 (floor), 2+3 (zoneless audit), 4 (pattern guide), 5 (migration doc), 6+7 (validation/release).
- Non-goals respected: no v20/v21 floor raise; no `@angflow/system` changes; no `linkedSignal` refactor; no public API shape changes; no zoneless example implementation (requirements documented as cross-track gate in Task 6 Step 4).
- All file paths are exact. All diffs are shown inline, not as "add appropriate handling".
- Commit structure matches Rollout section of the spec: Commit 1 = Task 1; Commit 2 = Tasks 2 + 3 + 4 (combined); Commit 3 = Task 5. Tasks 6 and 7 do not produce commits (validation and publish).
- TDD posture: these tasks are behavior-preserving refactors. Verification is via `tsc --noEmit`, `npm run build`, the existing Vitest suite, and the integration-level smoke matrix. No new unit tests are required because the Zone-removal is invisible at the component-level signal contract the existing tests verify.
