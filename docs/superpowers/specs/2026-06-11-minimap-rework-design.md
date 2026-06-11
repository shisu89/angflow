# Minimap Rework — Design (Cluster 2 of the 2026-06-11 deferred-work round)

**Goal:** Replace the hand-rolled minimap interaction code with the system `XYMinimap` class (extent-respecting pan, `inversePan`, `zoomStep`, `pannable`/`zoomable`), and wire the declared-but-dead `nodeComponent` input.

**Part of:** `2026-06-11-deferred-work-master.md`. Closes deferred items M8 and the minimap part of L6.

## Today

`packages/angular/src/lib/components/minimap/minimap.component.ts` implements everything by hand:
- `onMinimapMouseDown/Move` (lines ~377-417): document-level mouse listeners converting SVG coords and writing `store.transform.set(...)` directly — **no extent clamping** (never calls `setViewportConstrained`), and the declared `inversePan` input (line 129) is ignored.
- `onMinimapClick` (line ~302): rAF ease-out animation, then `panZoom().syncViewport()`.
- `onMinimapWheel` (line ~419): manual zoom-toward-center with min/max clamp.
- `nodeComponent` input (line 148): "Reserved — not yet wired"; template is a flat `@for` of `<rect>`.

The system `XYMinimap` (`packages/system/src/xyminimap/index.ts`) is a factory `XYMinimap({domNode, panZoom, getTransform, getViewScale})` returning `{update, destroy, pointer}`; `update()` installs a d3-zoom handler whose pan path goes through `panZoom.setViewportConstrained(viewport, extent, translateExtent)` — extent enforcement for free. React wires it with a create-effect + an update-effect (reference: `packages/react` `MiniMap.tsx:95-120`).

## Design

### Interaction: adopt XYMinimap

- Create the instance once the SVG element and `store.panZoom()` both exist (`afterNextRender` + an effect guarding on `panZoom() !== null`, mirroring how the main pane defers). `getTransform: () => store.transform()`, `getViewScale` from the existing viewBox computation.
- An `effect` calls `minimap.update({ translateExtent, width, height, inversePan: inversePan(), zoomStep: zoomStep(), pannable: pannable(), zoomable: zoomable() })` keyed on those inputs + the store's translateExtent.
- **New inputs** for React parity: `pannable` (default `false` in React — match React's defaults exactly, verify), `zoomable` (same), `zoomStep` (default 10). Existing `inversePan` becomes functional.
- Click-to-center: replace the bespoke rAF animation with React's approach — `minimap.pointer(event)` for coordinates + the store's existing `setCenter` (which after Cluster 1 honors `interpolate`/`duration`). The bespoke easing code is deleted.
- Delete `onMinimapMouseDown/Move/Up`, the wheel handler, and the rAF loop (~120 lines). The d3 handlers XYMinimap installs write via panZoom → transform signal — zoneless rule 2 satisfied, and the C1 contract (no `bumpVersion` on transform writes) is preserved because the writes flow through the same panZoom path the main pane uses.
- `destroy()` wired via `DestroyRef.onDestroy`.

### nodeComponent wiring

- When `nodeComponent` is set, render each minimap node via `NgComponentOutlet` instead of the default `<rect>`, passing inputs mirroring React's `MiniMapNode` props: `id`, `x`, `y`, `width`, `height`, `selected`, `color`, `strokeColor`, `strokeWidth`, `borderRadius`, `shapeRendering`, `className`. Default path (unset input) keeps the current `<rect>` — zero behavior change for existing users.
- Collapse-hidden nodes stay excluded (the existing `collapsedHiddenIds` read at line ~183 is preserved).

## Error handling

- Minimap created before panZoom exists: the guard effect simply waits; no error.
- `update()` with zero-size minimap (display:none): XYMinimap tolerates it upstream — verify with a test rather than assume.

## Testing

- Spec tests: extent clamping (pan past translateExtent stays clamped — assert via transform), inversePan flips drag direction, pannable/zoomable false disables interaction, zoomStep affects wheel delta, nodeComponent renders the custom component with correct inputs, default path unchanged.
- Manual smoke in `examples/angular`: drag minimap at the extent edge; wheel-zoom; click-to-center.

## Out of scope

Minimap styling/API beyond React parity. The `maskColor`/`nodeColor` style inputs that already work stay as-is.
