# Box-selection auto-pan and activation keys - design

**Date:** 2026-08-09
**Packages:** `@angflow/system`, `@angflow/angular`
**Status:** approved

## Problem

Three interaction defects meet in the canvas gesture path:

1. `panActivationKeyCode` and `zoomActivationKeyCode` are public `<ng-flow>`
   inputs, but Angular never tracks either key or forwards its held state. Both
   inputs are inert.
2. Starting a box selection sets `userSelectionActive`, which makes
   `XYPanZoom.update()` call `destroy()`. That removes every D3 `.zoom` DOM
   listener and the internal transform callback. The DOM listeners are never
   fully restored, so mouse and touch drag-panning stop after the first box
   selection.
3. Box selection does not pan when the pointer reaches a canvas edge. Nodes
   outside the current viewport cannot be included in one continuous selection
   gesture.

The fixes must work together. Auto-pan is programmatic viewport movement during
box selection, so `XYPanZoom` cannot remove its transform callback while that
selection is active.

## Behavior

### Activation keys

- Holding `panActivationKeyCode` temporarily enables drag-pan and scroll-pan.
- While the pan key is held, a new primary-button gesture pans instead of
  starting box selection.
- Holding `zoomActivationKeyCode` temporarily enables wheel zoom when it would
  otherwise be disabled, including changing scroll-pan into wheel zoom.
- A key pressed while an existing pointer gesture is underway does not change
  ownership of that gesture. It affects the next gesture.
- Key state resets on keyup and window blur. Keyboard events originating from
  editable controls do not activate canvas shortcuts.
- Matching accepts either `KeyboardEvent.key` or `KeyboardEvent.code`, so both
  the current literal-space default (`" "`) and the documented `"Space"`
  configuration work. A matched activation-key keydown prevents the browser's
  default action, including page scrolling for Space.
- `null` continues to disable each activation shortcut.

This matches the React Flow interaction model: the pan key derives effective
`panOnDrag` and `panOnScroll` values before those values reach the pane and
pan/zoom system. No new system-level `panActivationKeyPressed` option is needed.
The existing system-level `zoomActivationKeyPressed` option is used for zoom.

### Box-selection auto-pan

- `autoPanOnSelection` is a new `<ng-flow>` boolean input, defaulting to `true`.
- While a box-selection gesture is active, moving the pointer into the existing
  40-pixel edge zone pans the viewport continuously at the configured
  `autoPanSpeed`.
- The viewport keeps moving while the pointer remains stationary in an edge
  zone. Movement stops immediately when the pointer leaves the zone or the
  gesture ends.
- The selection origin stays fixed to its original flow-space point. As the
  viewport moves, the on-screen rectangle is recalculated and newly revealed
  nodes can enter or leave the selection.
- Existing `selectionMode` (`Full` or `Partial`), non-selectable-node filtering,
  `translateExtent`, zoom scaling, and selection events continue to apply.
- Auto-pan works for mouse, touch, and pen pointer selection.

## Architecture

### 1. Keep XYPanZoom attached during selection

Remove the `userSelectionActive` branch that calls `destroy()` from
`XYPanZoom.update()`. `destroy()` remains the real lifecycle teardown used when
the pan/zoom instance is discarded.

Competing user pan/zoom input remains blocked by mechanisms already in place:

- the D3 filter returns `false` while `userSelectionActive` is true;
- the pane's capture-phase pointer handler owns the selection-start event; and
- its touch-start guard prevents D3 from starting a simultaneous touch pan.

Keeping the D3 behavior attached preserves programmatic transforms and their
`onTransformChange` callback. It also eliminates the permanent listener-loss
bug without a teardown/re-attach transition or duplicate D3 registration.

### 2. Track held activation keys in the Angular key handler

Extend `KeyHandlerDirective` with `panActivationKeyCode` and
`zoomActivationKeyCode` inputs. Track their held state alongside selection and
multi-selection keys in `FlowStore` signals:

- `panActivationKeyActive`
- `zoomActivationKeyActive`

The directive extends its matching helper to compare each configured value with
both `KeyboardEvent.key` and `KeyboardEvent.code`. It retains the editable-target
guard, keyup handling, and window-blur cleanup, prevents default browser behavior
for matched activation-key presses, and clears held activation state on a
`contextmenu` event as an additional safeguard against missed keyup events.
`<ng-flow>` passes both configured key inputs to the directive. Arrays retain
their current Angular meaning of alternative keys; key combinations are not
introduced by this change.

`NgFlowComponent` derives:

- effective pan-on-drag: `panActivationKeyActive || panOnDrag`;
- effective pan-on-scroll: `panActivationKeyActive || panOnScroll`; and
- effective selection-on-drag: disabled while activation makes pan-on-drag
  unconditionally `true`.

The pane and `XYPanZoom.update()` receive these effective values.
`XYPanZoom.update()` also receives `zoomActivationKeyPressed` from the store and
the effective `selectionOnDrag` value already supported by its options type.

### 3. Anchor box selection in flow coordinates

`PaneComponent` retains its latest pointer position in container-relative screen
coordinates and records the selection origin in flow coordinates at pointer
down. On every selection update:

1. Convert the fixed flow-space origin through the current viewport transform
   to its current screen position.
2. Build a screen-space rectangle between that point and the latest pointer.
3. Write the rectangle to `store.userSelectionRect` for rendering.
4. Pass that rectangle and the current transform to `getNodesInside()`.
5. Apply the resulting selected node IDs through the existing store action.

This keeps rendering compatible with `SelectionBoxComponent`, whose rectangle
is screen-space, while keeping the selected flow region stable when the
viewport moves.

### 4. Own the auto-pan loop in PaneComponent

After selection has moved, `PaneComponent` starts one animation-frame loop when
`autoPanOnSelection` is enabled. Each frame:

1. Read the current container bounds, latest pointer, `autoPanSpeed`, and
   viewport state.
2. Use the existing system `calcAutoPan()` helper to obtain the pan delta.
3. Await `store.panBy(delta)` so constrained or rejected movement is respected.
4. If the viewport moved, recompute the selection rectangle and selected nodes
   without waiting for another pointer event.
5. Schedule the next frame while the gesture is active.

Only one frame may be in flight. Pointer movement updates the stored pointer but
does not start additional loops.

## Public API and state changes

- Add `<ng-flow [autoPanOnSelection]="...">`, default `true`.
- Reuse the existing `autoPanSpeed`; no separate selection speed is added.
- Add `autoPanOnSelection` and the two held-key booleans to `FlowStore` and its
  store-interface snapshot.
- No new outputs or `@angflow/system` public types are required.
- Existing activation-key input names and defaults remain unchanged.

## Cleanup and failure handling

All selection exits converge on one cleanup path:

- pointerup;
- pointercancel;
- component destruction; and
- any internal selection cancellation.

Cleanup cancels the animation frame, releases pointer capture when possible,
removes document listeners, clears private gesture coordinates, and resets the
store's user-selection state. Cleanup is idempotent so a late pointer event or
destroy cannot leave an auto-pan loop running.

`store.panBy()` returning `false` is not an error: it means the viewport is at a
configured extent or the requested delta produced no movement. The selection
gesture remains active and the next frame can respond if the pointer moves to a
different edge.

## Testing

### System tests

- `XYPanZoom.update({ userSelectionActive: true })` keeps mouse, touch, wheel,
  and double-click DOM listeners attached.
- Programmatic viewport updates still invoke `onTransformChange` during
  selection.
- Real `destroy()` still removes all namespaced D3 listeners.

### Angular key-handler and flow tests

- Pan and zoom activation keys set and clear their store signals.
- Matching works for both the default literal-space `event.key` and configured
  values such as `"Space"` supplied through `event.code`; matched keydown events
  prevent their browser default.
- Editable targets are ignored and window blur clears held state.
- Context-menu activation also clears held activation state.
- Pan activation derives drag-pan and scroll-pan and disables new box selection.
- Zoom activation is forwarded to `XYPanZoom.update()`.
- `null` activation inputs never set held state.

### Pane selection tests

- Pointer movement in each edge zone produces the expected pan direction.
- A stationary pointer continues panning across animation frames.
- Nodes revealed by auto-pan become selected without another pointermove.
- The fixed flow-space origin produces correct rectangles in every pan
  direction and at non-unit zoom.
- `SelectionMode.Full` and `SelectionMode.Partial` retain their semantics.
- `autoPanOnSelection=false` performs no pan.
- `translateExtent` prevents movement without ending selection.
- Pointerup, pointercancel, and destroy cancel frames and listeners.
- Mouse, touch, and pen follow the same selection and cleanup path.
- Drag-panning still works after completing a box selection.

## Out of scope

- Switching an already-running gesture from selection to pan when an activation
  key is pressed mid-gesture.
- Wheel zooming during an active box-selection gesture.
- A configurable edge-zone width or separate selection auto-pan speed.
- Unknown node/edge type diagnostics; those remain a separate change.
