# Angular 19 + Zoneless-First Upgrade — Design

**Date:** 2026-04-18
**Status:** Approved design; ready for implementation planning
**Scope:** Raise `@angflow/angular` peer-dep floor to Angular 19 and make the library zoneless-native (works under zoneless consumers without code paths that assume Zone.js, while remaining functional for zonal consumers). Ships as `@angflow/angular@0.1.0`.

## Context

This is one of three sibling initiatives scoped from a broader "best in class" conversation. The siblings will be brainstormed into separate design docs:

1. **This spec** — v19 floor + zoneless-first migration.
2. **Custom-node API ergonomics** — reduce the ~11-signal-input boilerplate required to register a custom node component. Separate spec.
3. **Out-of-box features** — culling, floating edges, copy/paste, and adjacent candidates. Separate spec.

A fourth initiative surfaced and was carved out of this spec during brainstorming:

4. **FlowStore per-node reactivity redesign** — replace the imperative `nodeLookup` / `edgeLookup` `Map`s + global `version()` counter with per-node `Signal`s. Not coupled to the v19 upgrade (can ship against any floor); deserves dedicated benchmarking and a public-API migration story for `store.nodeLookup`. Deferred to its own spec.

## Goals

- Raise `@angflow/angular` peer-dep floor from `>=17.0.0` to `>=19.0.0`. Drop Angular 17 and 18 compatibility.
- Make the Angular-package codebase zoneless-native: remove every `NgZone` injection and `runOutsideAngular` wrapper. Replace any Zone-driven change-detection assumption with explicit signal writes or `markForCheck`.
- Preserve compatibility for zonal consumers — the library must still function under `provideZoneChangeDetection` (or the default zoned bootstrap) with no behavioral regressions.
- Produce a consumer-facing breaking-changes document, `docs/upgrade/0.1.0-migration.md`, published with the release.
- Establish a zoneless smoke-test harness: `0.1.0` does not tag until a zoneless example exists that exercises the audited code paths and meets a perf bar.

## Non-goals

- Raising the floor to v20 or v21. Library code uses only v19-available APIs.
- Raising `@angflow/system`'s peer floor or API. System is framework-agnostic and its timer usage is already zoneless-safe.
- Any `linkedSignal` refactor of FlowStore lookup maps. The earlier hypothesis that `nodeLookup`/`edgeLookup` were a natural `linkedSignal` fit did not survive close reading — they pair with an in-place-mutation + `version()`-counter pattern that `linkedSignal` does not replace. A proper reactivity redesign is a separate (larger) spec.
- Any public API shape changes to `NgFlowComponent`, `FlowStore`, `NgFlowService`, or `@angflow/system` exports.
- Removing Zone.js from existing consumers. Consumers may continue to run zonal.
- Implementing the zoneless example app itself. The examples track (separate initiative) owns where the example lives; this spec specifies the requirements it must meet.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Peer-dep floor version | v19 (not v20) | Matches the single existing consumer today; avoids forcing a second upgrade on them. Tradeoff accepted: `provideExperimentalZonelessChangeDetection` is still experimentally-named in v19, and `afterRenderEffect` / `linkedSignal` are dev-preview. |
| Zoneless posture | Zoneless-first, zonal still works | Library code assumes no Zone.js. Zonal consumers still function because signal writes drive CD in both modes. Avoids maintaining NgZone scaffolding indefinitely while not breaking zonal consumers. |
| linkedSignal refactor | Dropped from this spec | Does not cleanly apply to the existing version-counter pattern; would be modernization theater. Deferred to the reactivity-redesign spec. |
| Release sequencing | Phased commits, single minor release | Each commit is reviewable/bisectable; consumers see one coherent upgrade event (`0.1.0`); breaking-changes live in one document. |
| Zoneless example placement | Defer to examples track; this spec states requirements only | Example reorganization and angflow / angflow-pro split are tracked separately. This spec declares the validation bar without coupling to where the example is wired in. |
| Release gating | Hold `0.1.0` tag until zoneless example exists | The whole value of the upgrade is the zoneless-first story; shipping without reproducible validation undercuts that. `0.1.0-rc.0` pre-release unblocks the consumer's validation in the meantime. |

## Package metadata changes

`packages/angular/package.json`:

```jsonc
"peerDependencies": {
  "@angular/common": ">=19.0.0",  // was >=17.0.0
  "@angular/core":   ">=19.0.0",  // was >=17.0.0
  "rxjs":            ">=7.0.0"    // unchanged
},
"devDependencies": {
  "@angular/compiler":     ">=19.0.0",  // was >=17.0.0
  "@angular/compiler-cli": ">=19.0.0"   // was >=17.0.0
  // @angular/platform-browser*, typescript, vitest, jsdom unchanged
}
```

TypeScript floor: unchanged (existing 5.9.3 already exceeds Angular 19's 5.5+ requirement).

`tsconfig.lib.json`: verify `target` is ES2022 or newer during implementation; Angular 19 requires it.

`@angflow/system` package: no metadata changes. Framework-agnostic.

## Zoneless migration

### Principle

Under zoneless change detection, Angular updates views in response to signal writes, explicit `markForCheck` calls, and `input`/`output` bindings. Event listeners registered outside Angular (D3 bindings, native DOM listeners, RAF callbacks) do not trigger CD unless they write to a signal the template reads. `NgZone.runOutsideAngular` becomes a no-op under zoneless and unnecessary ceremony under zonal once we've removed the Zone dependence.

### Angular-package audit (the work)

| File | Line(s) | Current state | Action |
|---|---|---|---|
| `container/pane/pane.component.ts` | 21, 93 | Injects `NgZone`; wraps D3 event bindings in `runOutsideAngular(() => { ... })` | Remove injection. Remove wrapper. Verify event handlers write to FlowStore signals (they do today). |
| `container/ng-flow/ng-flow.component.ts` | 191 | Injects `NgZone` | Remove injection after confirming no remaining uses (line 419 is a comment only). |
| `container/ng-flow/ng-flow.component.ts` | 636 | `setTimeout(() => { ... })` | Audit the scheduled work. If it writes to a signal, no change needed. If it relies on zone-tick for CD, route through explicit signal write or `ChangeDetectorRef.markForCheck`. |
| `components/minimap/minimap.component.ts` | 297, 316, 329 | `requestAnimationFrame` for viewport-pan animation | No action. RAF writes to signals in the animation loop; works identically zoneless. |

### System-package audit (no refactor)

All seven call sites in `@angflow/system` (`xypanzoom/eventhandler.ts`, `xydrag/XYDrag.ts`, `xyhandle/XYHandle.ts`, `xypanzoom/XYPanZoom.ts`) use native `setTimeout` / `requestAnimationFrame` for internal timers (scroll debouncing, auto-pan, pan-end detection). They do not touch Angular. They invoke registered callbacks that write to signals in the Angular layer, which drive CD correctly in both modes.

Outcome: zero code changes in `@angflow/system`. The migration doc explicitly documents this.

### Pattern guide (added to `CLAUDE.md`)

Three rules for future contributors:

1. **Never inject `NgZone`.** If you think you need it, you're mixing Zone.js assumptions into zoneless-native code.
2. **Event handlers from outside Angular (D3, native listeners, RAF callbacks) must drive view updates via signal writes.** Never rely on Zone to tick CD.
3. **Timers are fine.** `setTimeout` / `requestAnimationFrame` used for scheduling logic (not for forcing CD) are framework-agnostic and work in both modes.

### Zonal-compatibility reasoning

After the audit, the library still functions under zonal consumers because:

- Signal writes schedule CD in both modes (Angular's signal system is the source of truth post-v18).
- Removing `runOutsideAngular` wrappers means D3 events are now inside the zone for zonal consumers — this produces slightly more CD ticks than strictly necessary, but no incorrectness. The cost is paid only by zonal consumers, who are expected to migrate toward zoneless anyway.

## Rollout

Branch: `feat/angular-19-zoneless`.

**Commit 1 — Peer-dep floor bump.**
- Edit `packages/angular/package.json` per the metadata section above.
- Adjust `tsconfig.lib.json` target if needed.
- No source changes.
- Verify: `npm run typecheck` and `npm run build` pass.

**Commit 2 — Zoneless-first migration.**
- Remove `NgZone` injection and `runOutsideAngular` wrapper from `pane.component.ts`.
- Remove `NgZone` injection from `ng-flow.component.ts` (verify no remaining uses).
- Audit and resolve the `setTimeout` at `ng-flow.component.ts:636`.
- Leave `minimap.component.ts` RAF usage unchanged.
- Leave `@angflow/system` unchanged.
- Add the three pattern-guide rules to `CLAUDE.md`.
- Verify: existing `examples/angular/` app passes the zonal smoke matrix (below).

**Commit 3 — Migration documentation.**
- Write `docs/upgrade/0.1.0-migration.md` per the spec in the next section.
- No code changes.

**Release steps (after PR merges to `main`).**

1. Examples track produces a zoneless example meeting the requirements below (separate initiative).
2. Publish `@angflow/angular@0.1.0-rc.0`. Consumer validates against it using `pnpm link` or a local `.tgz`.
3. Consumer signs off.
4. `npm version minor` in `packages/angular` (0.0.13 → 0.1.0).
5. `npm run build && npm publish --access public` with 2FA.
6. `@angflow/system` not published — no changes.
7. Tag `@angflow/angular@0.1.0` in git.

**Rollback.** If a zonal consumer hits a regression post-publish, publish `0.0.14` as a patch on the pre-upgrade branch. `0.1.x` continues on `main`.

## Zoneless example — requirement (implementation deferred)

The examples track owns where the zoneless example lives in the repo layout (coupled to the ongoing angflow / angflow-pro example split). This spec does **not** prescribe a location, monorepo placement, or scaffolding. It specifies the validation bar that the example must meet before `0.1.0` is tagged.

### Required properties

- Bootstraps Angular with `provideExperimentalZonelessChangeDetection()` (v19 import path). When the consuming example is on v20 or later, the stable name `provideZonelessChangeDetection` may be used instead.
- Exercises every audited code path in this spec:
  - Node drag (hits the D3 event bindings that lost `runOutsideAngular` in `pane.component.ts`).
  - Pan and zoom via scroll and pinch (hits XYPanZoom timers).
  - Edge connection drag (hits XYHandle RAF auto-pan).
  - Multi-select via box-select (hits pane selection events).
  - Minimap interaction (hits the minimap RAF viewport animation).
  - Delete via keyboard shortcut (hits the `ng-flow.component.ts:636` `setTimeout` if it remains on this path).
- Under a 200-node graph, a 3-second node-drag stays at ≥ 55 FPS as measured in Chrome DevTools Performance. If not, fail the release — zoneless must not regress compared to zonal.

### Acceptance is binary

The example exists and passes, or `0.1.0` does not tag. The `0.1.0-rc.0` pre-release lifts the consumer's blocker in the meantime.

## Breaking-changes document (deliverable)

Target path: `docs/upgrade/0.1.0-migration.md`. Ships in commit 3.

### Required sections

**Header.** Target release `@angflow/angular@0.1.0`. Who is affected. Estimated migration effort (~30-60 minutes for the single current consumer).

**Peer dependency changes.** Consumer must be on `@angular/core >= 19.0.0`. The current consumer is already on 19 — no action.

**Removed internal `NgZone` usage.** If the consumer was relying on `NgZone.runOutsideAngular` behavior inside angflow code paths (e.g. suppressing CD during pan/zoom), that behavior is gone. Observable effect under zonal consumers: slightly more CD ticks during pan/zoom. Action: profile before/after if the consumer has expensive non-`OnPush` components at the root; likely no action needed in normal use.

**Zoneless as a first-class supported mode.** Opt-in via `provideExperimentalZonelessChangeDetection()`. Not a breaking change — existing zonal apps continue to work.

**Pattern-guide additions to `CLAUDE.md`.** The three rules on `NgZone` / event handlers / timers govern library contributors, not consumers. Consumer impact: zero.

**No public API shape changes.** `NgFlowComponent`, `FlowStore`, `NgFlowService`, and `@angflow/system` exports are unchanged.

**Compatibility matrix.**

| Angular version | `@angflow/angular@0.0.x` | `@angflow/angular@0.1.0` |
|---|---|---|
| 17.x | ✅ | ❌ |
| 18.x | ✅ | ❌ |
| 19.x | ✅ | ✅ |
| 20.x | ✅ | ✅ |
| 21.x | ✅ | ✅ |

## Validation

**Unit tests.** Existing `packages/angular` Vitest suite (`npm run test`) must pass. Extend `flow-store.service.spec.ts` if needed to cover behavior under signal-write-driven CD (no Zone assumption).

**Typecheck & build gates.** `npm run typecheck` and `npm run build` must pass against:
- Peer floor: an Angular 19 dev environment (pinned in CI).
- Current: Angular 21 (existing `devDependencies` pin).

**Manual smoke matrix.** Required before tagging `0.1.0`.

| Example app | Angular | Mode | Feature pass |
|---|---|---|---|
| `examples/angular/` (existing) | 21 | Zonal | Full — every gallery example + showcase + kitchen-sink |
| Zoneless example (examples track) | 19 or 21 | Zoneless | Required properties above |

Feature pass = drag nodes, pan/zoom, box-select, connect edges, delete, resize, keyboard navigation, minimap interaction, background render.

**Perf spot-check.** 200-node graph; 3-second node-drag in Chrome DevTools Performance. Acceptance: zoneless FPS ≥ zonal FPS. Regression means a broken audit somewhere — do not ship.

**Consumer smoke test.** Link the single existing consumer to `@angflow/angular@0.1.0-rc.0` via `pnpm link` or local `.tgz`. Run the consumer's test suite (if any) plus manual smoke of its flow editor surface. Consumer sign-off gates the real `0.1.0` publish.

## Open questions

None at design approval. Implementation-phase decisions (e.g. the exact replacement for the `setTimeout` at `ng-flow.component.ts:636`) are expected to emerge from the audit and will be resolved in the implementation plan.
