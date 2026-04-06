# NgFlow Gap Analysis — 5 Apr 2026

Gaps and improvement opportunities identified by comparing the Angular port against React Flow.

## P1 — High Priority

- [x] **Add PanZoom options re-sync on input changes** — Added effect that tracks all pan/zoom inputs and calls `updatePanZoomOptions()` on change. (`ng-flow.component.ts`)
- [x] **Fix multi-select click behavior** — Node click handler now checks `multiSelectionActive()`: Ctrl/Cmd+click toggles selection, normal click replaces. (`node-renderer.component.ts`)
- [x] **Fix MiniMap animation race condition** — Stores `animationFrameId` and cancels previous animation before starting a new one. (`minimap.component.ts`)
- [x] **Add edge keyboard navigation** — Added `tabindex`, `(keydown)`, and `(focus)` on edge SVG wrappers. Escape deselects, Enter selects. (`edge-renderer.component.ts`)
- [x] **Add per-node keyboard event handling** — Added `(keydown)` handler on node wrappers. Escape deselects (and blurs), Enter selects. (`node-renderer.component.ts`)
- [x] **Cache node inputs to avoid unnecessary re-renders** — `getNodeInputs()` now caches by node ID + store version. Cache entries cleaned up on node removal. (`node-renderer.component.ts`)
- [x] **Implement MiniMap drag-to-pan and scroll-to-zoom** — `pannable` now supports drag-to-pan (mousedown/mousemove/mouseup). `zoomable` now supports scroll-to-zoom (wheel event). (`minimap.component.ts`)

## P2 — Medium Priority

- [x] **Add batch update support** — Added `batch()` to FlowStore and NgFlowService. Defers version bumps until all updates are applied. (`flow-store.service.ts`, `ng-flow.service.ts`)
- [x] **Expose visible node/edge signals via NgFlowService** — Added `visibleNodes` and `visibleEdgeIds` computed signals to public API. (`ng-flow.service.ts`)
- [x] **Add unit tests for FlowStore and NgFlowService** — 93 tests covering state management, node/edge CRUD, selection, batching, middleware, coordinate conversion, serialization. Vitest + zoneless Angular TestBed. (`flow-store.service.spec.ts`, `ng-flow.service.spec.ts`)
- [~] **Add Playwright e2e tests for Angular** — Angular example app at `examples/angular/` with all test fixture routes. Playwright config at `playwright.angular.config.ts`. **37/43 tests pass** (86%) including: all nodes tests (selection, drag, connect, delete, classes, styles, hidden, selectable=false), all edge tests except 2 (selection, multi-select, delete, classes, styles, aria-label, animated, markers, z-index, sub-flow z-index, selectable=false, hidden), all pane tests except 1 (zoom, minZoom/maxZoom, autoPan, panOnScroll, initialViewport), props (colorMode light+dark). Remaining 6: edge deletable-false/interactionWidth (click coordinate targeting), node-toolbar (2, positioning offset), multi-select-drag (selection key integration), pane-pan (1px rounding).
- [x] **Remove duplicate `nodesData()` method** — Removed `nodesData()` from NgFlowService; `selectNodesData()` is the canonical replacement. (`ng-flow.service.ts`)
- [x] **Use `edgeLookup` Map in `getEdge()`** — Changed from O(n) `edges().find()` to O(1) `edgeLookup.get()`. (`ng-flow.service.ts`)
- [x] **Add `onInit` output event** — Already existed: `init` output emits `NgFlowService` instance in `ngAfterViewInit`. (`ng-flow.component.ts:346,609`)
- [x] **Add accessibility to Controls** — Added `type="button"`, `aria-label` on all buttons, `aria-pressed` on lock toggle, `aria-hidden="true"` on all SVGs. (`controls.component.ts`)
- [x] **Align `selectionMode` default to `Full`** — Changed default from `SelectionMode.Partial` to `SelectionMode.Full`. (`ng-flow.component.ts`)

## P3 — Low Priority

- [ ] **Add custom SVG marker support** — Edge markers are limited to built-in arrow types. Users can't define custom markers (circles, diamonds). React Flow supports `markerStart`/`markerEnd` with custom SVG via `MarkerDefinition`.
- [ ] **Add more examples** — Angular has 5 examples vs React's 65. Key missing patterns: save/restore, auto-layout (dagre), drag from external source, connection validation, subflows, floating edges.
- [ ] **Document template-based node types** — The `*ngFlowNodeType` directive pattern is powerful but not documented as the primary approach for custom nodes.
- [ ] **Add RxJS interop guidance** — Document `toObservable(service.nodes)` from `@angular/core/rxjs-interop` for developers who prefer Observables.
- [ ] **Add touch event support on nodes** — Only mouse events are handled in the node renderer. No `touchstart`/`touchend` for mobile interactions beyond what the drag directive provides.

## Completed

- [x] **Fix node injector cache memory leak** — `nodeInjectorCache` Map grew unbounded as nodes were removed. Fixed: `cleanupRemovedNodes()` deletes stale injectors. (commit a5c34c8)
- [x] **Fix ResizeObserver cleanup for removed nodes** — Removed nodes were never `unobserve()`d. Fixed: same `cleanupRemovedNodes()` method handles cleanup. (commit a5c34c8)
- [x] **GroupNode stub** — Verified correct. React's GroupNode also returns `null`; styling is CSS-only via `.xy-flow__node-group`.
