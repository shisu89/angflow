# Example Reconsolidation — Design

**Date:** 2026-04-18
**Status:** Approved design; ready for implementation planning
**Scope:** Redistribute and consolidate example applications between `angflow` (open-source) and `angflow-pro` (paid) so that learners have one clear public surface and paid users get one complete repo.

## Problem

Two Angular example apps exist today and overlap unclearly:

- `angflow/examples/angular` — polished gallery with `ShellComponent` + `GalleryShellComponent`, 15 curated examples, plus a `showcase` mini-app and a `kitchen-sink` scratchpad.
- `angflow-pro/src/app/` — categorized gallery with ~30 advanced examples organized under 6 categories (`layout`, `interaction`, `nodes`, `edges`, `subflows`, `node-io`) and 2 templates (`workflow-editor`, `data-pipeline-builder`).

Problems:

- Foundational examples live only in free (`custom-node`, `save-restore`, etc.), so paid users who want a single place for everything end up checking both repos.
- A few names overlap or look related across repos (`connection-validation` ↔ `interaction/validation`; `sub-flows` ↔ `subflows/parent-child`; `typed-handles` ↔ `node-io/typed-ports`) without a clear policy.
- The free example app tries to be a consumer-facing gallery *and* an internal dev surface simultaneously.

## Target architecture

**Repos:**

- **`angflow` (public OSS):** library + `examples/angular` as a **reactflow-style dev harness**. Canonical source for 15 free examples + `kitchen-sink` scratchpad. Not deployed as a public gallery.
- **`angflow-pro` (private, paid repo access):** full Angular application that deploys to the **public showcase website** at `angflow.dev`. Contains ~30 pro examples + pro templates natively, plus the 15 free examples **auto-synced from angflow** via a committed mirror.

**Distribution model:**

- Free example source → public on `angflow` GitHub. Copy/fork freely.
- Pro example source → only in `angflow-pro` private repo, gated by repo access (paid).
- The deployed showcase site at `angflow.dev` runs live demos for **all** examples. Each tile carries a tier badge:
  - Free tiles: "View source →" link to `github.com/<org>/angflow/…`.
  - Pro tiles: "Get Pro repo access" CTA, no source link.
- Repo access is the gate — the site itself doesn't render source code.

**Public gallery IA** (after reconsolidation, served from angflow-pro):

1. **Basics** (new; all `tier: free`) — 5 examples.
2. **Nodes** — 2 existing pro examples + 3 free ports (`custom-node`, `node-resizer`, `node-toolbar`).
3. **Edges** — 3 existing pro + 4 free ports (`custom-edge`, `edge-types`, `edge-toolbar`, `floating-edges`).
4. **Interaction** — 10 existing pro, with `connection-validation` merged into the existing `validation` example.
5. **Layout** — 4 existing pro, unchanged.
6. **Subflows** — 3 existing pro + 1 free port (`sub-flows`).
7. **Node I/O** — 7 existing pro + 1 free port (`typed-handles`).
8. **Templates** — 2 existing pro + 1 free→pro transfer (`showcase`).

Result: 39 examples + 3 templates, 15 of them `tier: free`.

## Item disposition map

| # | angflow OSS (canonical) | angflow-pro (via sync unless noted) | Tier |
|---|---|---|---|
| 1 | `examples/angular/src/app/examples/overview` | `src/app/examples/basics/overview` | free |
| 2 | `…/save-restore` | `basics/save-restore` | free |
| 3 | `…/backgrounds-variants` | `basics/backgrounds-variants` | free |
| 4 | `…/minimap-custom` | `basics/minimap-custom` | free |
| 5 | `…/drag-from-sidebar` | `basics/drag-from-sidebar` | free |
| 6 | `…/custom-node` | `nodes/custom-node` | free |
| 7 | `…/node-resizer` | `nodes/node-resizer` | free |
| 8 | `…/node-toolbar` | `nodes/node-toolbar` | free |
| 9 | `…/custom-edge` | `edges/custom-edge` | free |
| 10 | `…/edge-types` | `edges/edge-types` | free |
| 11 | `…/edge-toolbar` | `edges/edge-toolbar` | free |
| 12 | `…/floating-edges` | `edges/floating-edges` | free |
| 13 | `…/sub-flows` | `subflows/sub-flows` | free |
| 14 | `…/typed-handles` | `node-io/typed-handles` | free |
| 15 | `…/connection-validation` | **merged into** `interaction/validation` | free¹ |
| 16 | *(removed from angflow)* | `templates/showcase` (pro-native) | pro |
| 17 | `…/kitchen-sink` | *(not synced, not on public site)* | — |

¹ `connection-validation` merge policy: compare both implementations. Put the stronger version in angflow as `connection-validation`, then sync to pro's `interaction/validation` (replacing pro's native copy), and re-tag the registry entry as `tier: 'free'`. If pro's existing validation is meaningfully richer than free's (e.g., cycle detection, disconnected-node checks), keep pro's native and leave `connection-validation` as a distinct free entry; decide during PR3 review.

## `angflow/examples/angular` — dev harness specification

The free example app becomes an internal dev/regression harness modeled on `xyflow/xyflow`'s `examples/react`.

**Deletions:**

- `shell/` (including `ShellComponent`, `GalleryShellComponent`, `ComingSoonComponent`).
- `showcase/` (the mini-app and all its sub-components: `node-palette`, `inspector-panel`, `toolbar`, `simulation.service`, etc. — ported to pro in PR4).

**Kept:**

- All 15 example folders under `examples/angular/src/app/examples/*` — these remain the authoritative source and the targets of the pro sync. Folder paths must not change without a corresponding sync-manifest update.
- `kitchen-sink/` — remains as the scratchpad/regression entry. Not shown in the public showcase website; only on the harness.

**New:**

- **Flat `app.routes.ts`**: array of `{ name, path, component }` entries, one per example + `kitchen-sink`. Default route: `/overview`.
- **Minimal `AppComponent`**: header with `<select>` dropdown (or simple list) to switch between routes. No sidebar, no gallery styling. Reactflow-style.
- **Updated `README.md`** in `examples/angular/`: explicitly states this app is for internal library development and regression testing. Directs external users to the deployed showcase website (`angflow.dev`) for the polished gallery.

## `angflow-pro` — data model and UI updates

### Registry schema (`src/app/shared/types/example.ts`)

Add `'basics'` to the `ExampleCategory` union:

```ts
export type ExampleCategory =
  | 'basics'      // NEW
  | 'layout'
  | 'interaction'
  | 'nodes'
  | 'edges'
  | 'subflows'
  | 'node-io'
  | 'templates';
```

Extend `ExampleMeta`:

```ts
export interface ExampleMeta {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  route: string;
  type: 'example' | 'template';
  tier: 'free' | 'pro';           // NEW
  sourceUrl?: string;             // NEW — set only when tier === 'free'
}
```

### Category metadata (`src/app/shared/data/examples.ts`)

Prepend `basics` to `CATEGORIES`:

```ts
{ id: 'basics', title: 'Basics', description: 'Start here — core APIs every flow uses', icon: '✦' },
```

### Routes (`src/app/examples/examples.routes.ts`)

Add a lazy-loaded child route for `basics`:

```ts
{
  path: 'basics',
  loadChildren: () => import('./basics/basics.routes').then((m) => m.BASICS_ROUTES),
}
```

Create `basics/basics.routes.ts` with one route per synced example.

### Examples-grid + example-shell

No structural changes required — they already render from `CATEGORIES` and `EXAMPLES`. Additions:

- **Tile badging**: render a "Free" or "Pro" pill on each tile based on `tier`.
- **Source link / CTA** on each example detail page: "View source on GitHub" (free) or "Get Pro repo access" (pro).
- Category order enforced by `CATEGORIES` array position; `basics` comes first.

## Sync pipeline

**Goal:** angflow authoritative, angflow-pro reproducible.

### Manifest

`angflow-pro/scripts/sync-manifest.ts` exports an array of `{ from, to }` entries mapping angflow paths to angflow-pro paths:

```ts
export const FREE_EXAMPLE_MANIFEST = [
  { from: 'examples/angular/src/app/examples/overview',
    to:   'src/app/examples/basics/overview' },
  { from: 'examples/angular/src/app/examples/save-restore',
    to:   'src/app/examples/basics/save-restore' },
  // … 15 entries total
];
```

### Script

`angflow-pro/scripts/sync-free-examples.ts` is a Node script:

- Reads `ANGFLOW_ROOT` env var (path to a local angflow checkout). Defaults to `../angflow`.
- For each manifest entry: `rm -rf <to>`, then recursive copy.
- No import-path rewriting — both repos depend on published `@angflow/system` and `@angflow/angular` npm packages; imports are identical.
- Does not touch route files or the registry (those are hand-written).

### CI check

GitHub Action in angflow-pro:

- Checks out angflow as sibling workspace.
- Runs `pnpm sync-free-examples`.
- Fails build if `git diff` is non-empty.
- Runs on every PR. Forces drift to surface.

### Developer workflow

1. Edit free example in `angflow/examples/angular/…`. Merge to angflow.
2. In angflow-pro checkout, run `pnpm sync-free-examples`. Commit the mirrored changes. Open PR.
3. CI re-runs the sync in a clean environment and confirms no drift.

### Design choice rationale

Committed mirror + CI check is preferred over git submodules or an npm package because:

- Paid developers who clone angflow-pro get a self-contained repo — no submodule init required.
- No build-system complications from importing out-of-tree sources.
- CI makes drift visible.
- The cost is a small manual sync ritual when free examples change (rare).

## PR breakdown

Each PR is shippable independently; angflow's dev app keeps working until PR5.

| PR | Scope | Repos touched |
|----|---|---|
| **PR1 — Sync infrastructure** | Add manifest + sync script + CI check. Stub registry `tier` / `sourceUrl` fields in pro (no free examples synced yet). Document the sync flow in a `CONTRIBUTING.md`. | angflow-pro only |
| **PR2 — Basics category + first 5 syncs** | Add `'basics'` to `ExampleCategory` and `CATEGORIES`. Sync `overview`, `save-restore`, `backgrounds-variants`, `minimap-custom`, `drag-from-sidebar`. Hand-write `basics/basics.routes.ts` and wire into `examples.routes.ts`. Add 5 registry entries with `tier: 'free'` and `sourceUrl` populated. | angflow-pro only |
| **PR3 — Distribute remaining 10 free examples** | Sync `custom-node`, `node-resizer`, `node-toolbar` → `nodes/`; `custom-edge`, `edge-types`, `edge-toolbar`, `floating-edges` → `edges/`; `sub-flows` → `subflows/`; `typed-handles` → `node-io/`. Resolve `validation` merge (see footnote on disposition map). Add all registry entries. | angflow (if merge edits `connection-validation`) + angflow-pro |
| **PR4 — Move `showcase` to pro templates** | Port `angflow/examples/angular/src/app/showcase/*` → `angflow-pro/src/app/templates/showcase/*` (straight copy; no imports outside the folder). Delete angflow's `showcase/` and its route. Add `TEMPLATES` entry with `tier: 'pro'`. | angflow + angflow-pro |
| **PR5 — Strip angflow example app to harness** | Delete `shell/` and `ComingSoonComponent`. Rewrite `app.routes.ts` as flat list of 15 examples + `kitchen-sink`. New minimal `AppComponent` with `<select>` header. Update README. Re-run sync in angflow-pro to verify no drift (folder paths preserved). | angflow + angflow-pro sync verification |
| **PR6 — Website polish** | Tile badges for `tier`. "View source" links on free tiles (`sourceUrl` → GitHub). "Get Pro repo access" CTA on pro tiles. Confirm category order with `basics` first. | angflow-pro only |

## Non-goals (out of scope for this design)

- Deploying the pro showcase site to production (ops work; assumes `angflow.dev` as provisional domain).
- Paid repo access mechanics — GitHub org invites, Sponsors integration, billing, license keys (business/commercial work).
- Paywall UX beyond tile badges + CTA links.
- URL redirects. `angflow/examples/angular` was never a deployed public gallery, so no incoming-link risk.
- Unifying build tooling across repos — each keeps its own configuration.
- Renaming/rebranding the project (`angflow` stays; see conversation log).

## Risks and mitigations

- **Sync drift.** *Mitigation:* CI check runs the sync in a clean environment on every PR and fails on diff.
- **Free-example visual inconsistency vs pro-native examples** (CSS conventions, layout patterns). *Mitigation:* accept for PR2–PR5; fold a normalization pass into PR6 or a later polish PR.
- **`validation` merge regressions.** *Mitigation:* diff both implementations before merging in PR3; if pro's is richer, keep it pro-native and leave `connection-validation` as a distinct free entry.
- **`showcase` move dependencies.** The mini-app uses its own `simulation.service.ts`, `node-palette`, `inspector-panel`, etc. *Mitigation:* verify no imports cross out of the `showcase/` folder before PR4.
- **Future free-example renames.** *Mitigation:* sync uses `rm -rf` before copy, so old pro folder gets wiped when the manifest `to` path changes. Validate with a test rename during PR1.
- **Source-link 404s.** When a free example is renamed or deleted in angflow but the registry still lists an old `sourceUrl`, the link breaks. *Mitigation:* registry entries are hand-written and reviewed alongside sync changes; CI could optionally HEAD-check `sourceUrl` values in a future enhancement.

## Open questions (informational — not blockers)

- **Sync manifest location** — `scripts/` vs `tools/` is cosmetic; default to `scripts/` unless pro has a convention otherwise.
- **Deployment domain** — `angflow.dev` is purchased and locked in. `sourceUrl` base and "View source" link target reference this as a constant.
- **Pro repo access mechanism** — informs the "Get Pro" CTA target URL. Default CTA placeholder: link to a pricing page stub; update in a later PR.

## Provisional decisions baked into this spec

- **Domain:** `angflow.dev` (purchased).
- **Project name:** `angflow` (retained; `@angflow/*` npm scope already owned).
- **Angular trademark posture:** project README and website footer include an Angular-trademark disclaimer; no Angular logo usage; "Angular" referred to as an adjective in prose.

## What happens next

Hand off to the writing-plans skill to produce a detailed, PR-by-PR implementation plan with file-level changes and acceptance criteria.
