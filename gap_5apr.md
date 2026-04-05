# NgFlow Gap Analysis — 5 Apr 2026

Gaps and improvement opportunities identified by comparing the Angular port against React Flow.

## P1 — High Priority

- [ ] **Add PanZoom options re-sync on input changes** — When inputs like `panOnDrag`, `zoomOnScroll`, `panOnScrollMode`, `zoomOnDoubleClick`, `preventScrolling` change after init, the underlying `XYPanZoom` instance isn't updated. React Flow re-syncs these via its store subscription. (`ng-flow.component.ts`)
- [ ] **Fix multi-select click behavior** — Node click handler calls `addSelectedNodes()` without checking whether the multi-selection key (Ctrl/Cmd) is held. This means clicking a node always replaces the selection instead of toggling. (`node-renderer.component.ts:162-166`)
- [ ] **Fix MiniMap animation race condition** — Clicking the minimap while a pan animation is running starts a new `requestAnimationFrame` loop without canceling the previous one. Store a `cancelAnimationFrame` handle. (`minimap.component.ts:243-268`)
- [ ] **Add edge keyboard navigation** — React's EdgeWrapper handles `onKeyDown` (Escape/Enter) for keyboard-based selection/deselection. Angular's edge renderer has no `(keydown)` handler — edges are not keyboard-navigable. (`edge-renderer.component.ts`)
- [ ] **Add per-node keyboard event handling** — React's NodeWrapper handles `onKeyDown` (Escape, Enter, Arrow keys) per-node. Angular relies entirely on the global `KeyHandlerDirective`. (`node-renderer.component.ts`)
- [ ] **Cache node inputs to avoid unnecessary re-renders** — `getNodeInputs()` creates a new object on every call. With `NgComponentOutlet`, Angular compares inputs by reference, so every node re-renders on any change, defeating OnPush. Cache input objects by node ID + version. (`node-renderer.component.ts:288-303`)
- [ ] **Implement MiniMap drag-to-pan and scroll-to-zoom** — `pannable` input only supports click-to-pan, not drag-to-pan on the viewport rectangle. `zoomable` input is declared but never used. (`minimap.component.ts:117-118`)

## P2 — Medium Priority

- [ ] **Add batch update support** — React uses a `BatchProvider` with `useQueue` to coalesce `setNodes`/`setEdges` calls. Angular applies each immediately, causing multiple renders when updating both in sequence.
- [ ] **Expose visible node/edge signals via NgFlowService** — `store.visibleNodes` and `store.visibleEdgeIds` exist but aren't exposed through the public API for users to consume reactively.
- [ ] **Add unit tests for FlowStore and NgFlowService** — Zero `.spec.ts` files exist in the Angular package. The FlowStore alone is 700+ lines with no test coverage.
- [ ] **Add Playwright e2e tests for Angular** — Existing Playwright tests only cover React and Svelte. No Angular test fixtures or CI config.
- [ ] **Remove duplicate `nodesData()` method** — `NgFlowService` has both `nodesData()` (reads from `store.nodes()`) and `selectNodesData()` (reads from `store.nodeLookup`). The latter is more correct; remove the former. (`ng-flow.service.ts:59-67`)
- [ ] **Use `edgeLookup` Map in `getEdge()`** — `getEdge()` does `this.store.edges().find()` (O(n)) when `this.store.edgeLookup` (O(1)) is available. (`ng-flow.service.ts:199-200`)
- [ ] **Add `onInit` output event** — React Flow fires an `onInit` callback when the flow is ready (viewport initialized, nodes measured). No Angular equivalent exists.
- [ ] **Add accessibility to Controls** — Lock button missing `aria-pressed`, buttons missing `type="button"`, SVGs missing `aria-hidden="true"`. (`controls.component.ts`)
- [ ] **Align `selectionMode` default to `Full`** — Angular defaults to `SelectionMode.Partial` while React defaults to `Full`. (`ng-flow.component.ts:271`)

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
