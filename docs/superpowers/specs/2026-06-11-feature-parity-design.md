# Feature Parity — Design (Cluster 4 of the 2026-06-11 deferred-work round)

**Goal:** Two React-parity gaps: the selection box becomes draggable (and keyboard-movable) as a group, and `autoPanOnNodeFocus` becomes a real input. The dead `autoPanStart`/`autoPanEnd` output stubs are removed.

**Part of:** `2026-06-11-deferred-work-master.md`. Closes the L6 deferred items (minus minimap nodeComponent, which Cluster 2 covers).

## Selection-box dragging

### Today

`selection-box.component.ts` renders the `.xy-flow__nodesselection` box (visible when `store.nodesSelectionActive()`) as a purely visual div — `pointer-events: all` and a `(contextmenu)` output, but no drag wiring and no keyboard support.

### React's mechanism (the port target)

`packages/react/src/components/NodesSelection/index.tsx:56-59`: `useDrag({ nodeRef, disabled })` with **no `nodeId`**. In `XYDrag`, an undefined nodeId routes to the selection-drag path: `getDragItems` collects all selected nodes, and `onSelectionDragStart/Drag/Stop` callbacks fire instead of the node ones (`XYDrag.ts:206-218, 282-292, 370-385`). React's box also has `tabIndex` and an arrow-key `onKeyDown` that moves the selection.

### Design

- The selection-box component creates an `XYDrag` instance bound to the box element with no nodeId, using the same `getStoreItems`/callback wiring the node drag path uses (find Angular's existing XYDrag setup — likely a directive or the node-renderer — and reuse its store-callback plumbing rather than duplicating it; extract a shared helper if needed).
- Position updates flow through the same store path node-dragging uses (drag changes → `triggerNodeChanges`), so undo/x-of-group/extent semantics are identical to dragging one member node.
- Selection-drag events: check what `<ng-flow>` already declares (`selectionDragStart`/`selectionDrag`/`selectionDragStop` or similar — React emits `onSelectionDragStart/Drag/Stop`). Wire the XYDrag selection callbacks to them; add the outputs if missing.
- Keyboard: the box gets `tabindex="-1"` (React parity — verify React's exact value) and the same arrow-key move handler nodes use (respecting snap grid), plus Escape to clear `nodesSelectionActive`, matching React.
- The box is created/destroyed with `nodesSelectionActive` (`@if`) — the XYDrag instance must be torn down via `DestroyRef`/effect cleanup when the box leaves the DOM.
- Zoneless: XYDrag callbacks already write signals (node drag proves the path); no new concerns.

## autoPan parity

- **Add `autoPanOnNodeFocus` input** on `<ng-flow>` (`ng-flow.component.ts`, next to the existing `autoPanOnNodeDrag`/`autoPanOnConnect`/`autoPanSpeed` inputs at lines ~442-448), wired into the existing store signal (`flow-store.service.ts:185`, currently hardcoded-default `true`). React reference: `packages/react` `index.tsx:80` + `StoreUpdater`.
- **Remove the `autoPanStart`/`autoPanEnd` outputs** (`ng-flow.component.ts:675,677`) — declared "Not yet wired", never emitted, and React has no such events. Removal is recorded in `packages/angular/CHANGELOG.md` under the next minor as removal of never-functional API.

## Testing

- Selection-box: spec test that activates `nodesSelectionActive` with two selected nodes, drags the box, and asserts both nodes moved by the delta and `selectionDrag*` outputs fired in order; arrow-key test moves both nodes; teardown test (deactivate selection mid-drag does not leak listeners — assert via document listener count or XYDrag destroy spy).
- autoPan: input round-trips to the store signal; the focus-autopan behavior toggles off when `false`.
- Manual smoke in `examples/angular`: marquee-select two nodes, drag the box, arrow-move, Escape.

## Out of scope

`selectionDragStop`-time history/undo features; touch-specific selection-box gestures beyond what XYDrag already handles; autoPan event outputs (removed, not replaced).
