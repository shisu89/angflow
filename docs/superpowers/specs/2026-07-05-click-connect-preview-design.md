# Click-to-connect preview line — design

**Date:** 2026-07-05
**Package:** `@angflow/angular`
**Status:** approved

## Problem

In click-to-connect mode (`connectOnClick`, default on), clicking a handle
"arms" a connection (`connectionClickStartHandle` is set) and a second click on
a valid handle completes it. Between the two clicks there is **no visual
feedback** — nothing follows the cursor, so the user can't tell a connection is
pending or where it will go.

Until the phantom-connection fix (`@angflow/system` 0.1.9), a *leaked* drag
session accidentally drew a line that followed the cursor, and users relied on
it. That line was a bug and is now gone. This feature provides the same feedback
**intentionally and correctly**.

Drag-to-connect already shows a preview line; only click-to-connect lacks one.
React Flow has no click-preview, so this is an angflow enhancement.

## Behavior

1. **Arm** — first click on a handle (existing `HandleComponent.onClick`) sets
   `connectionClickStartHandle` and now also starts a preview connection.
2. **Track** — while armed, moving the cursor draws a connection line from the
   armed handle to the cursor, **snapping to the nearest handle within
   `connectionRadius` and coloring valid/invalid** — identical to the drag
   preview.
3. **Complete** — second click on a valid handle runs the existing `onClick`
   completion path (`onConnect`); the preview clears.
4. **Cancel** — all of: click empty pane, `Escape`, re-click the same (armed)
   handle, right-click. Every path clears the preview.

Scope: click-mode only. The drag flow is untouched. Does **not** reintroduce the
phantom — every entry has an explicit, matching teardown.

## Architecture

A dedicated `ClickConnectPreview` service, instantiated by `<ng-flow>`, so
`ng-flow.component` does not grow and the logic is testable in isolation.

- **Trigger:** an `effect` watches `store.connectionClickStartHandle`.
  - null → non-null: seed `store.connection()` with an in-progress state from the
    armed handle, and attach a single document `pointermove` listener.
  - non-null → null: detach the listener and call `store.cancelConnection()`
    (clears the preview line).
- **Tracking:** the `pointermove` handler computes the cursor position in flow
  coordinates and reuses the already-exported `@angflow/system` utilities —
  `getClosestHandle` / `getFloatingDropTarget` for snapping and `XYHandle.isValid`
  for validity — then calls `store.updateConnection()`. This is the same
  computation `XYHandle.onPointerMove` performs for the drag preview, so the
  existing connection-line renderer draws it with no rendering changes.
- **Rendering:** none added. Reuses the existing connection-line renderer, which
  already reads `store.connection()`.

### Why reuse `store.connection()` rather than a separate signal

The connection-line renderer, handle `connectingfrom`/`connectingto`/validity
classes, and hover feedback all key off `store.connection()`. Reusing it gives
full visual parity with the drag preview for free. The phantom bug was not caused
by *using* this state — it was caused by a leaked listener that never cleared it.
Here teardown is explicit on every exit, so reuse is safe.

## Cancellation wiring

All cancel paths converge on setting `connectionClickStartHandle = null`; the
service's `effect` performs the actual teardown. Small additions:

- **Pane click** — `NgFlowComponent.onPaneClick`: if armed, clear and return
  (also resolves the earlier "clicking empty space doesn't cancel" complaint).
- **Escape** — key handler already nulls `connectionClickStartHandle`; ensure the
  connection is cancelled too (covered by the effect).
- **Same-handle re-click** — `HandleComponent.onClick`: if the clicked handle is
  the armed one, disarm instead of attempting a self-connection.
- **Right-click** — pane `contextmenu`: if armed, clear.

## Teardown discipline

The move listener is pointer-family (`pointermove`) and is removed whenever the
signal clears **or** the service is destroyed (`DestroyRef`). No dangling
listeners — the explicit lesson from the phantom bug (`@angflow/system` 0.1.9).

## Testing

- **Unit (`ClickConnectPreview`):** arming seeds `connection().inProgress` from
  the armed handle; a simulated `pointermove` updates the endpoint; each cancel
  path (null the signal / destroy) clears `connection()` and detaches the
  listener.
- **In-app:** on the validation example — line follows after the first click,
  snaps and colors over handles, all four cancel methods clear it, and a second
  click on a valid handle still creates the edge (no node drag, no phantom).

## Out of scope

- No change to drag-to-connect.
- No new public inputs/outputs (behavior is on by default with `connectOnClick`).
  A future opt-out input can be added if requested.
