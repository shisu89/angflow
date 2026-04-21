# Design — Examples parity port (Angular ↔ React)

**Date:** 2026-04-20
**Status:** Spec awaiting implementation-plan phase.

## Context

`examples/angular/` currently contains 17 examples; `examples/react/` contains 63; `examples/svelte/` contains 27. The parity gap is tracked in `docs/examples-parity.md`.

The goal of this effort is to bring `examples/angular/` to **functional parity with React** — every library feature that React demonstrates should have an Angular demo. Framework-specific React examples (Redux, Provider, DevTools, bug repros) are explicitly out of scope.

Alongside parity, ported examples should be **polished, Angular-idiomatic, and judiciously enriched** (dark-mode support, touch-friendliness, in-example descriptions) without silently inflating scope.

## Goals

- Close the Angular ↔ React feature-demo gap.
- Ship in small, shippable tiers rather than a monolithic push.
- Surface library API gaps (hook equivalents) cleanly, as their own future work, rather than blocking example progress.
- Establish a repeatable pattern (shared description panel, standard acceptance criteria) so future examples are faster to add.

## Non-goals

- Changes to `packages/system/`.
- New library APIs on `packages/angular/` — any gaps surfaced by the API audit spawn their own spec.
- Redesigning existing Angular examples.
- Screenshot/GIF artifacts — the dev harness is the source of truth.

## Scope

### In scope — ~36 examples

Every React example that demonstrates a library feature an Angular user would use. Grouped into tiers below.

### Out of scope (explicit skip)

| React example | Reason |
|---|---|
| `Redux` | React-specific state-lib integration |
| `Provider` | React Context pattern; Angular uses DI |
| `DevTools` | React-flow-specific dev tooling |
| `NodeSelectionBug` | Bug repro, not a feature |
| `BrokenNodes` | React error-boundary demo |
| `Basic`, `Empty` | Trivial; `overview` already covers |
| `ControlledUncontrolled` | React hooks pattern |
| `Switch` | React conditional-rendering test |

### Verify-on-port (may join out-of-scope or shift tier)

- `Middlewares` — may be React-internal; confirm on inspection. If kept, joins Tier 2.
- `Edges` (generic) — may overlap with existing `edge-types`. If kept, joins Tier 2.
- `default-overwrites` combined example (Tier 2) — may need to split back into separate `DefaultNodeOverwrite` / `DefaultEdgeOverwrite` examples if combining loses clarity.
- `set-nodes-batching` combined example (Tier 2) — may need to split back into separate `SetNodesBatching` / `MultiSetNodes` examples.

## Tier composition

### Tier 1 — Small, low-effort (9 examples)

Ship fast, build momentum, prove the acceptance bar.

`color-mode`, `interaction`, `a11y`, `cancel-connection`, `click-distance`, `hidden`, `z-index-mode`, `touch-device`, `undirectional`

### Tier 2 — Medium complexity (16 examples, +up to 2 from verify-on-port)

`add-node-on-edge-drop`, `controlled-viewport`, `custom-connection-line`, `detached-handle`, `drag-handle`, `easy-connect`, `edge-routing`, `interactive-minimap`, `intersection`, `moving-handles`, `multi-flows`, `reconnect-edge`, `update-node`, `node-type-change`, `default-overwrites` (combined), `set-nodes-batching` (combined)

### Tier 3 — Showcases (3 examples)

High-polish, visually striking, README-worthy.

`figma`, `layouting` (dagre), `stress`

### API audit gate

Between Tier 3 and Tier 4. Output drives Tier 4 scope.

### Tier 4 — Hook/API demos (up to 8, audit-conditional)

`use-connection`, `use-key-press`, `use-node-connections`, `use-nodes-data`, `use-nodes-init`, `use-on-selection-change`, `use-flow-service` (Angular equivalent of `useReactFlow`), `use-update-node-internals`

Any hook whose API gap is too large to cover in this effort is **deferred**, flagged in the parity doc — not silently dropped.

## Library API audit

A short sweep through `packages/angular/src/lib/` run **before writing the Tier 4 plan**. For each React hook in Tier 4, answer:

- `exists ✅` — Angular equivalent is on `NgFlowService` / `FlowStore` / a directive.
- `partial ⚠️` — exists but missing capability the example needs. List gaps.
- `missing ➖` — no equivalent. Example is deferred.

Output lives inline at the top of the Tier 4 implementation plan. Any `partial` / `missing` findings spawn a separate library spec, not additional scope here.

Expected effort for the audit itself: one afternoon.

## Acceptance criteria (per example)

Every ported example must meet the **standard bar**:

1. Lives at `examples/angular/src/app/examples/<kebab-name>/<kebab-name>.component.ts` as a standalone component.
2. Registered in `HARNESS_ROUTES` in `examples/angular/src/app/app.routes.ts` with a human-readable name.
3. Runs in `npm run dev` with zero console errors or warnings on load and during interaction.
4. `npx tsc --noEmit` in `packages/angular` stays clean; the example app's build stays clean.
5. Zoneless-safe per CLAUDE.md rules: no `NgZone` injection; D3/native event handlers drive signals.
6. Includes a description panel (fixed corner overlay, 1–3 sentences) explaining what the example demos and how to interact. Uses a new shared `ExampleDescriptionComponent` under `examples/angular/src/app/examples/_shared/`.
7. Basic a11y: focusable controls have visible focus rings; buttons have readable labels. Not a full WCAG audit.
8. No dead code, commented-out React snippets, or leftover TODOs.

## Enrichment rules (judicious "better than React")

Enrichment is **declared up-front per example** in each tier's implementation plan, not added silently during port.

Allowed without a separate spec:

- Dark-mode-aware styling (inherited once `color-mode` lands).
- Mobile/touch-friendly handling where the React version isn't.
- Clearer description-panel copy.
- Minor UX upgrades costing <30 min (reset buttons, keyboard shortcut hints, etc.).

Not allowed in this effort:

- New library APIs (go to a separate library spec).
- Features the React example doesn't have (unless the enrichment is spec'd up front per above).
- Layout redesigns of existing Angular examples.

## Delivery shape

One spec (this document). Implementation plans are authored **per tier** via the `writing-plans` skill, each time the previous tier merges.

| Artifact | Trigger |
|---|---|
| T1 plan | This spec approved |
| T2 plan | T1 merged |
| T3 plan | T2 merged |
| API audit (inline) | Before T4 plan |
| Library prereqs spec | If audit surfaces gaps — separate cycle |
| T4 plan | Audit complete, any library prereqs merged |

Per-tier PR cadence: one PR per tier (a tier may be split into 2 PRs if it grows unwieldy during implementation). Within a PR, examples may be committed individually for reviewability.

## Progress tracking

`docs/examples-parity.md` is the scoreboard. Every tier PR flips its examples from ➖ to ✅ in the same commit. Inferred mappings in the parity doc (flagged with `¹`, `²`) get corrected to match reality as they're verified during port.

## Exit criteria

- **Minimum success:** Tiers 1–3 shipped. Angular has feature-demo parity with React for every non-hook library feature.
- **Full success:** Tier 4 shipped to whatever extent the API audit allows. Any deferred hook examples have an entry in the parity doc pointing at the library gap that blocks them.

## Open questions

None at spec time. The API audit is the one known unknown, and its result is allowed to alter Tier 4 scope without re-opening this spec.
