# @angflow/angular

## 0.3.2

### Changed

- Lowered the `@angular/core` / `@angular/common` peer range from `>=21.0.0` back
  to `>=19.0.0`. The published partial-Ivy output only requires linker 17.1+
  (its `minVersion` is set by the features used — signal inputs — not by the
  compiler that built it), so the library is consumable from Angular 19+ even
  though it is built and tested on Angular 21. Verified by building an Angular 19
  app against the packed output.

### Fixed

- `NgFlowService` now imports `DOCUMENT` from `@angular/common` instead of
  `@angular/core`. `@angular/core` only re-exports `DOCUMENT` on Angular 20+, so
  the previous import broke Angular 19 consumers at bundle time
  (`No matching export … for import "DOCUMENT"`). `@angular/common` exports it on
  both 19 and 21.

## 0.3.0

### Added

- `<ng-flow>` `[autoPanOnNodeFocus]` input (default `true`) — pans the viewport
  when a node receives keyboard focus, matching React's `autoPanOnNodeFocus`.
- Selection box is now draggable as a group and keyboard-movable (arrow keys,
  Shift = 4×, Escape clears the selection), matching React's `NodesSelection`.

### Changed

- Minimap wheel-zoom default changed: `zoomStep` now defaults to `1` (was `10`),
  matching React's runtime default. The minimap also gained functional
  `pannable`/`zoomable`/`inversePan` inputs (previously pan/zoom interactions
  were always-on and unclamped — they now respect `translateExtent` and the new
  inputs' React-parity defaults `pannable=false`/`zoomable=false`).
- `setCenter` now honors `options.interpolate` (`'smooth'` | `'linear'`);
  previously the option was accepted but ignored.

### Removed

- `(autoPanStart)` / `(autoPanEnd)` outputs. They were declared "Not yet wired",
  never emitted, and have no React equivalent. Removed as never-functional API.

## 0.2.0

Current release (group auto-size: `getGroupBounds` + `sizeGroupToChildren`).
For detailed history prior to this file's introduction, see
`git log --oneline -- packages/angular`. Future releases append entries here.
