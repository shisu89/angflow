# Bridge fit/layout clamp signal (feedback #18)

**Date:** 2026-06-13
**Roadmap:** unit 1 of [agent-bridge parity roadmap](./2026-06-13-agent-bridge-parity-roadmap.md).
**Feedback:** `brainstorm_agentic_app/docs/angflow-feedback.md` #18 — `fit_view` / `layout_nodes`
silently clamp at `minZoom`; an agent that calls them *believes* it framed everything while the human
sees a center crop, with no signal back.

## Problem

`fit_view` and `layout_nodes({ fitView: true })` compute a target viewport via the system util
`getViewportForBounds`, which sets `zoom = min(xZoom, yZoom)` (the ideal zoom that would show every
node) and then `clampedZoom = clamp(zoom, minZoom, maxZoom)`. When the board is larger than what fits
at `minZoom`, the ideal zoom is clamped *up* to the floor — the viewport frames only a center crop.
Today this is invisible to the caller:

- `@angflow/system` `fitViewport(...)` returns `Promise<boolean>` (throws the computed zoom away).
- `NgFlowService.fitView` / `fitBounds` return `Promise<boolean>`.
- The bridge `fit_view` handler returns that boolean; `layout_nodes` returns only `{ positions }`.
- There is no per-call `minZoom` override, so an agent can't ask for a looser fit either — only the
  host can set `[minZoom]` on `<ng-flow>`, which an agent driving the canvas cannot reach.

## Goal

1. Surface the achieved zoom and whether the fit was clamped at the minimum floor, from
   `fit_view`, `fit_bounds`, and `layout_nodes`.
2. Let those tools take a per-call `minZoom` override for the fit, so an agent can loosen the floor
   for one call without changing host config.

`clamped` means specifically **the fit hit the minimum-zoom floor** — the board is too big to frame
at the effective `minZoom`, so the agent should split into regions or use `set_center`. Clamping at
`maxZoom` (board smaller than the viewport, over-zoom) is **not** flagged: everything is still framed,
so no agent action is needed.

## Design

### New result type

Exported from `@angflow/angular` (public API):

```ts
export interface FitViewResult {
  /** Achieved zoom after the fit. NaN when there was nothing to fit (no nodes) or no panZoom yet. */
  zoom: number;
  /** True when the fit hit the minimum-zoom floor — i.e. the board could not be fully framed. */
  clamped: boolean;
}
```

`zoom: NaN` serializes to JSON `null`, which is the value an agent sees for an empty / no-op fit.

### `@angflow/system` — `fitViewport`

Signature changes from `Promise<boolean>` to `Promise<FitViewResult>` (the type is structural — system
defines its own `{ zoom; clamped }` shape; `@angflow/angular` re-exports it as `FitViewResult`).

```ts
export async function fitViewport(...): Promise<{ zoom: number; clamped: boolean }> {
  if (nodes.size === 0) return { zoom: NaN, clamped: false };
  const nodesToFit = getFitViewNodes(nodes, options);
  const bounds = getInternalNodesBounds(nodesToFit);
  const effMin = options?.minZoom ?? minZoom;
  const effMax = options?.maxZoom ?? maxZoom;
  const viewport = getViewportForBounds(bounds, width, height, effMin, effMax, options?.padding ?? 0.1);
  await panZoom.setViewport(viewport, { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate });
  return { zoom: viewport.zoom, clamped: viewport.zoom <= effMin + ZOOM_CLAMP_EPSILON };
}
```

- `ZOOM_CLAMP_EPSILON` (a small constant, e.g. `1e-6`) absorbs float noise. Because
  `getViewportForBounds` clamps to `≥ effMin`, `viewport.zoom <= effMin + EPS` is true exactly when
  the ideal zoom was `≤ effMin`. The only false positive is the degenerate case where the board fits
  *precisely* at the floor (ideal == min); reporting `clamped: true` there is harmless (the agent just
  re-checks).
- **Single internal consumer:** only `packages/angular/src/lib/services/flow-store.service.ts` imports
  `fitViewport` from `@angflow/system`. The `react` / `svelte` reference packages consume upstream
  `@xyflow/*`, not `@angflow/system`, so this change is contained.

### `@angflow/angular` — `NgFlowService` / `FlowStore`

- `FlowStore.fitView(options)`: return the `fitViewport` result; when `panZoom()` is null, return
  `{ zoom: NaN, clamped: false }` (was `false`).
- `NgFlowService.fitView(options)`: return type becomes `Promise<FitViewResult>`. Existing callers
  (`controls.component.ts`, the `<ng-flow>` initial-fit path) ignore the return value, so the change
  is non-breaking in practice; the typed return is simply richer.
- `NgFlowService.fitBounds(bounds, options)`: `options` gains optional `minZoom?` / `maxZoom?`.
  It computes the target via `getViewportForBoundsInternal` (already calls `getViewportForBounds`),
  applies it, and returns `{ zoom: viewport.zoom, clamped: viewport.zoom <= effMin + EPS }`, where
  `effMin = options?.minZoom ?? store.minZoom()`. `getViewportForBoundsInternal` is extended to accept
  the effective min/max.
- `FitViewResult` re-exported from the package's public API (`public-api.ts`).
- The per-call `minZoom` for `fitView` needs no new plumbing: `FitViewOptionsBase` already carries
  `minZoom`/`maxZoom` and `fitViewport` honors `options.minZoom`; the bridge handler just has to pass it.

### Bridge handlers (`agent-bridge.service.ts`)

All three are read/viewport-only — **not** added to `MUTATING_TOOLS`, no history capture.

- `fit_view`: parse optional `minZoom` via a new `optionalPositiveNumber(params, 'minZoom')` helper
  (must be a finite number `> 0`, else `-32602`). Pass `minZoom` into the `fitView` options alongside
  the existing `padding` / `duration` / `nodes`. Return the `FitViewResult`.
- `fit_bounds`: parse optional `minZoom` the same way; pass to `flow.fitBounds`. Return the
  `FitViewResult`.
- `layout_nodes`: parse optional `minZoom`; thread it into the internal `flow.fitView({ ... })` call.
  Return shape becomes `{ positions, fit: FitViewResult | null }` — `fit` is `null` when
  `fitView` is `false` or no positions were applied (so no fit ran). The existing `positions` key is
  unchanged (backward compatible).

### Validation

`minZoom`: optional; when present must be a finite `number > 0` (`-32602` otherwise). No upper bound
check and no `minZoom <= maxZoom` ordering check — `clamp()` tolerates inverted bounds and this is an
agent convenience, not a safety boundary.

## Tool schema changes (`tool-schemas.ts`)

- `fit_view`: add `minZoom?: number` to inputSchema; document the `{ zoom, clamped }` return.
- `fit_bounds`: add `minZoom?: number`; document the return.
- `layout_nodes`: add `minZoom?: number`; document the new `fit` field in the return.

## Out of scope

- `set_viewport`, `zoom_to`, `zoom_in/out`, `set_center` — these take explicit/relative zoom, not a
  fit-to-content, so a "couldn't frame everything" signal doesn't apply.
- `maxZoom` clamp reporting (over-zoom needs no agent action).
- A `maxZoom` per-call override on the bridge tools — not requested; `FitViewResult` + `minZoom`
  cover the feedback. (`fitBounds`'s service opts accept `maxZoom` for internal symmetry, but no
  bridge tool exposes it.)

## Testing (TDD)

**`@angflow/system` (vitest):**
- `fitViewport` returns `clamped: true` when bounds far exceed what fits at `minZoom` (ideal < min).
- `clamped: false` when the graph fits within `[min, max]`.
- `clamped: false` (not true) when clamped at `maxZoom` (tiny board).
- `options.minZoom` override changes whether `clamped` is reported.
- empty `nodes` → `{ zoom: NaN, clamped: false }`.

**`@angflow/angular` (bridge spec):**
- `fit_view` returns `{ zoom, clamped }`; `minZoom` override loosens the floor and flips `clamped`.
- `fit_view` rejects a non-positive / non-finite `minZoom` with `-32602`.
- `fit_bounds` returns `{ zoom, clamped }` and honors `minZoom`.
- `layout_nodes` returns `{ positions, fit }` with `fit` populated when `fitView` is on and `null`
  when `fitView: false`.
- none of the three capture a history entry.

## Closeout

- Update `packages/angular/AGENT_BRIDGE.md`: the `fit_view` / `fit_bounds` / `layout_nodes` rows
  (params + returns) and a short note defining `FitViewResult`.
- Regenerate the `@angflow/mcp` schema snapshot (`pnpm -F @angflow/mcp run generate:schemas`); the
  drift test gates CI.
- Publish: `@angflow/system` patch → `@angflow/angular` patch → `@angflow/mcp` patch.
- Mark feedback #18 ✅ with the commit/PR reference.
