import { Component, ChangeDetectionStrategy, input, output, inject, OnDestroy, ElementRef } from '@angular/core';
import {
  calcAutoPan,
  getNodesInside,
  pointToRendererPoint,
  rendererPointToPoint,
  SelectionMode,
  type KeyCode,
  type XYPosition,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';

@Component({
  selector: 'ng-flow-pane',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__pane xy-flow__pane xy-flow__container',
    'style': 'display: block; position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 1;',
    '[class.draggable]': 'panOnDrag()',
    '[class.dragging]': 'store.paneDragging()',
    '[class.selection]': 'store.userSelectionActive()',
    '(wheel)': 'onWheel($event)',
  },
  template: `<ng-content />`,
})
export class PaneComponent implements OnDestroy {
  readonly store = inject(FlowStore);
  private el = inject(ElementRef<HTMLElement>);

  readonly panOnDrag = input<boolean | number[]>(true);
  readonly selectionOnDrag = input(false);
  readonly selectionKeyCode = input<KeyCode | null>(null);
  readonly selectionMode = input<SelectionMode>(SelectionMode.Full);
  readonly autoPanOnSelection = input(true);
  readonly autoPanSpeed = input(15);

  readonly selectionStart = output<MouseEvent>();
  readonly selectionEnd = output<MouseEvent>();
  readonly paneScroll = output<WheelEvent>();

  private isSelecting = false;
  private moved = false;
  private activePointerId: number | null = null;
  private selectionOrigin: XYPosition | null = null;
  private pointerPosition: XYPosition | null = null;
  private selectionGeneration = 0;
  private autoPanFrameId: number | null = null;
  private boundOnPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundOnPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundOnPointerCancel: ((e: PointerEvent) => void) | null = null;
  private nativePointerDownHandler: ((e: Event) => void) | null = null;
  private nativeTouchStartHandler: ((e: Event) => void) | null = null;

  onWheel(event: WheelEvent): void {
    this.paneScroll.emit(event);
  }

  /**
   * Call this after d3-zoom is initialized to attach a capture-phase
   * pointerdown listener that fires BEFORE d3-zoom's listener. Pointer events
   * (not mouse) so marquee/box selection works by touch and pen too — the
   * previous mousedown listener never fired during a touch drag.
   */
  initSelectionListener(): void {
    this.nativePointerDownHandler = (e: Event) => this.onPointerDown(e as PointerEvent);
    // Capture phase fires before d3-zoom's bubble-phase listener
    this.el.nativeElement.addEventListener('pointerdown', this.nativePointerDownHandler, true);

    // preventDefault(pointerdown) suppresses the compat mouse events (so d3-zoom's
    // mousedown.zoom never fires alongside a marquee), but it does NOT suppress
    // touchstart — so d3-zoom's touchstart.zoom would still pan while a touch
    // marquee runs. This capture-phase touchstart handler kills d3's same-element
    // touchstart.zoom synchronously (mirroring the old mousedown approach). It
    // decides independently of pointerdown (via shouldStartSelectionFor) because
    // the pointerdown/touchstart firing order is not guaranteed across browsers,
    // and the d3 filter's userSelectionActive is a stale snapshot on the
    // initiating event so it can't be relied on here. Single-finger only — a
    // two-finger gesture is a pinch, left to d3.
    this.nativeTouchStartHandler = (e: Event) => {
      const touchEv = e as TouchEvent;
      if (touchEv.touches && touchEv.touches.length > 1) return;
      if (this.shouldStartSelectionFor(e.target)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    this.el.nativeElement.addEventListener('touchstart', this.nativeTouchStartHandler, {
      capture: true,
      passive: false,
    });
  }

  /**
   * Whether a press on `target` should begin a marquee. Shared by onPointerDown
   * (which starts the marquee) and the touchstart suppressor (which kills
   * d3-zoom's pan) so the two agree regardless of pointerdown/touchstart order.
   *
   * React parity (Pane/index.tsx `onPointerDownCapture`): when selectionOnDrag is
   * the trigger the target MUST be the pane itself (children like nodes/edges/
   * the selection box are not hijacked); key-based selection bypasses that.
   */
  private shouldStartSelectionFor(target: EventTarget | null): boolean {
    if (!(this.selectionOnDrag() || this.store.selectionKeyActive())) return false;
    const eventTargetIsPane = target === this.el.nativeElement;
    if (this.selectionOnDrag() && !eventTargetIsPane && !this.store.selectionKeyActive()) {
      return false;
    }
    const el = target as HTMLElement | null;
    if (
      el &&
      (el.closest('.xy-flow__node') ||
        el.closest('.xy-flow__handle') ||
        el.closest('.xy-flow__edge') ||
        el.closest('.xy-flow__controls') ||
        el.closest('.xy-flow__panel'))
    ) {
      return false;
    }
    return true;
  }

  private onPointerDown(event: PointerEvent): void {
    // Only the primary, left button. `isPrimary === false` filters secondary
    // touch points; `=== false` (not `!isPrimary`) so synthetic events without
    // the property still work.
    if (event.button !== 0 || event.isPrimary === false) return;
    if (!this.shouldStartSelectionFor(event.target)) return;

    // Prevent d3-zoom from seeing this event
    event.stopImmediatePropagation();
    event.preventDefault();

    const containerEl = this.store.domNode();
    if (!containerEl) return;

    const bounds = containerEl.getBoundingClientRect();
    this.pointerPosition = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    this.selectionOrigin = pointToRendererPoint(this.pointerPosition, this.store.transform());
    this.selectionGeneration += 1;
    this.isSelecting = true;
    this.moved = false;
    this.activePointerId = event.pointerId;
    // Capture the pointer so moves keep tracking even if it leaves the pane.
    try {
      this.el.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is already gone; ignore.
    }

    this.store.userSelectionActive.set(true);
    this.store.userSelectionRect.set({
      x: this.pointerPosition.x,
      y: this.pointerPosition.y,
      width: 0,
      height: 0,
      startX: this.pointerPosition.x,
      startY: this.pointerPosition.y,
    });

    this.selectionStart.emit(event);

    this.boundOnPointerMove = (e: PointerEvent) => this.onPointerMove(e);
    this.boundOnPointerUp = (e: PointerEvent) => this.onPointerUp(e);
    this.boundOnPointerCancel = (e: PointerEvent) => this.onPointerEnd(e);

    document.addEventListener('pointermove', this.boundOnPointerMove);
    document.addEventListener('pointerup', this.boundOnPointerUp);
    document.addEventListener('pointercancel', this.boundOnPointerCancel);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isSelecting) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;

    // First actual movement marks the selection in progress. Doing this on move
    // (not unconditionally on pointerup) means a zero-movement click is NOT
    // treated as a marquee, so click-to-deselect and (paneClick) fire on the
    // first click with selectionOnDrag. React parity (set in onPointerMove).
    if (!this.moved) {
      this.moved = true;
      this.store.selectionInProgress.set(true);
    }

    const containerEl = this.store.domNode();
    if (!containerEl) return;

    const bounds = containerEl.getBoundingClientRect();
    this.pointerPosition = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    this.updateSelectionFromPointer();
    this.scheduleAutoPan();
  }

  private updateSelectionFromPointer(): void {
    if (!this.selectionOrigin || !this.pointerPosition) return;
    const start = rendererPointToPoint(this.selectionOrigin, this.store.transform());
    const current = this.pointerPosition;
    const selectionRect = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
      startX: start.x,
      startY: start.y,
    };
    this.store.userSelectionRect.set(selectionRect);
    const nodesInside = getNodesInside(
      this.store.nodeLookup,
      selectionRect,
      this.store.transform(),
      this.selectionMode() === SelectionMode.Partial,
      true
    );
    this.store.addSelectedNodes(nodesInside.map(({ id }) => id));
  }

  private scheduleAutoPan(): void {
    if (
      this.autoPanFrameId !== null ||
      !this.isSelecting ||
      !this.moved ||
      !this.autoPanOnSelection()
    ) {
      return;
    }
    const generation = this.selectionGeneration;
    let frameId = 0;
    frameId = requestAnimationFrame(() => {
      void this.runAutoPanFrame(generation, frameId);
    });
    this.autoPanFrameId = frameId;
  }

  private async runAutoPanFrame(generation: number, frameId: number): Promise<void> {
    if (
      generation !== this.selectionGeneration ||
      !this.isSelecting ||
      !this.pointerPosition ||
      !this.autoPanOnSelection()
    ) {
      if (generation === this.selectionGeneration && this.autoPanFrameId === frameId) {
        this.autoPanFrameId = null;
      }
      return;
    }
    // Container size comes from the store's ResizeObserver-backed signals rather
    // than getBoundingClientRect(): calcAutoPan only needs width/height, and a
    // layout read on every animation frame of every box selection is a cost this
    // loop should not be paying.
    const [x, y] = calcAutoPan(
      this.pointerPosition,
      { width: this.store.width(), height: this.store.height() },
      this.autoPanSpeed()
    );
    if (x === 0 && y === 0) {
      // Pointer is clear of every edge, so there is nothing to pan. Stop the loop
      // instead of re-arming it: with no pan there is no viewport movement, so
      // the only thing that can bring the pointer back into an auto-pan band is
      // another pointermove — and that re-arms via scheduleAutoPan(). Re-arming
      // here would spin a frame callback for the whole gesture to do nothing.
      if (this.autoPanFrameId === frameId) this.autoPanFrameId = null;
      return;
    }
    const moved = await this.store.panBy({ x, y });
    if (generation !== this.selectionGeneration || !this.isSelecting) return;
    if (moved) this.updateSelectionFromPointer();
    if (this.autoPanFrameId !== frameId) return;
    this.autoPanFrameId = null;
    this.scheduleAutoPan();
  }

  private onPointerEnd(event: PointerEvent): void {
    if (!this.isSelecting) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    this.finishSelection(event, true);
  }

  private onPointerUp(event: PointerEvent): void {
    this.onPointerEnd(event);
  }

  private finishSelection(event: PointerEvent | null, emitEnd: boolean): void {
    if (!this.isSelecting && this.activePointerId === null) return;
    const moved = this.moved;
    this.isSelecting = false;
    this.moved = false;
    if (this.autoPanFrameId !== null) {
      cancelAnimationFrame(this.autoPanFrameId);
      this.autoPanFrameId = null;
    }
    if (this.activePointerId !== null) {
      try {
        this.el.nativeElement.releasePointerCapture(this.activePointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }

    if (this.boundOnPointerMove) {
      document.removeEventListener('pointermove', this.boundOnPointerMove);
      this.boundOnPointerMove = null;
    }
    if (this.boundOnPointerUp) {
      document.removeEventListener('pointerup', this.boundOnPointerUp);
      this.boundOnPointerUp = null;
    }
    if (this.boundOnPointerCancel) {
      document.removeEventListener('pointercancel', this.boundOnPointerCancel);
      this.boundOnPointerCancel = null;
    }

    this.activePointerId = null;
    this.selectionOrigin = null;
    this.pointerPosition = null;
    this.store.userSelectionActive.set(false);
    this.store.userSelectionRect.set(null);
    // selectionInProgress (set in onPointerMove on the first real movement)
    // exists to make the marquee absorb the synthesised `click` that a mouse
    // gesture fires afterwards. A moved TOUCH/pen gesture fires NO click, so the
    // flag would otherwise stay stuck and swallow the next genuine pane tap —
    // clear it here for those pointer types. For mouse, leave it for onPaneClick
    // to consume. (A zero-movement gesture never set the flag.)
    if (moved && (!event || event.type === 'pointercancel' || event.pointerType !== 'mouse')) {
      this.store.selectionInProgress.set(false);
    }
    // Mark nodes selection active only if nodes were selected.
    if (this.store.selectedNodes().length > 0) {
      this.store.nodesSelectionActive.set(true);
    }
    if (event && emitEnd) this.selectionEnd.emit(event);
  }

  ngOnDestroy(): void {
    this.finishSelection(null, false);
    if (this.nativePointerDownHandler) {
      this.el.nativeElement.removeEventListener('pointerdown', this.nativePointerDownHandler, true);
    }
    if (this.nativeTouchStartHandler) {
      this.el.nativeElement.removeEventListener('touchstart', this.nativeTouchStartHandler, true);
    }
  }
}
