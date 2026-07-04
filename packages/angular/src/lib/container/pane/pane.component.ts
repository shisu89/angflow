import { Component, ChangeDetectionStrategy, input, output, inject, OnDestroy, ElementRef } from '@angular/core';
import { getNodesInside, SelectionMode, type KeyCode } from '@angflow/system';
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

  readonly selectionStart = output<MouseEvent>();
  readonly selectionEnd = output<MouseEvent>();
  readonly paneScroll = output<WheelEvent>();

  private isSelecting = false;
  private moved = false;
  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private boundOnPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundOnPointerUp: ((e: PointerEvent) => void) | null = null;
  private nativePointerDownHandler: ((e: Event) => void) | null = null;

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
  }

  private onPointerDown(event: PointerEvent): void {
    const shouldSelect = this.selectionOnDrag() || this.store.selectionKeyActive();
    if (!shouldSelect) return;
    // Only the primary, left button. `isPrimary === false` filters secondary
    // touch points; `=== false` (not `!isPrimary`) so synthetic events without
    // the property still work.
    if (event.button !== 0 || event.isPrimary === false) return;

    // React parity (Pane/index.tsx `onPointerDownCapture`):
    //   const eventTargetIsContainer = event.target === container.current;
    //   const isSelectionActive = (selectionOnDrag && eventTargetIsContainer) || selectionKeyPressed;
    //   if (!isSelectionActive ...) return;
    //
    // When selectionOnDrag is the trigger, the event target MUST be the pane
    // element itself — clicks on children (nodes-selection box, nodes, edges)
    // must not be hijacked. Key-based selection bypasses this requirement.
    const eventTargetIsPane = event.target === this.el.nativeElement;
    if (this.selectionOnDrag() && !eventTargetIsPane && !this.store.selectionKeyActive()) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.xy-flow__node') || target.closest('.xy-flow__handle') ||
        target.closest('.xy-flow__edge') || target.closest('.xy-flow__controls') ||
        target.closest('.xy-flow__panel')) {
      return;
    }

    // Prevent d3-zoom from seeing this event
    event.stopImmediatePropagation();
    event.preventDefault();

    const containerEl = this.store.domNode();
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
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
      x: this.startX,
      y: this.startY,
      width: 0,
      height: 0,
      startX: this.startX,
      startY: this.startY,
    });

    this.selectionStart.emit(event);

    this.boundOnPointerMove = (e: PointerEvent) => this.onPointerMove(e);
    this.boundOnPointerUp = (e: PointerEvent) => this.onPointerUp(e);

    document.addEventListener('pointermove', this.boundOnPointerMove!);
    document.addEventListener('pointerup', this.boundOnPointerUp!);
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

    const rect = containerEl.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const selectionRect = {
      x: Math.min(this.startX, currentX),
      y: Math.min(this.startY, currentY),
      width: Math.abs(currentX - this.startX),
      height: Math.abs(currentY - this.startY),
      startX: this.startX,
      startY: this.startY,
    };

    this.store.userSelectionRect.set(selectionRect);

    const transform = this.store.transform();
    const partially = this.selectionMode() === SelectionMode.Partial;
    const nodesInside = getNodesInside(
      this.store.nodeLookup,
      selectionRect,
      transform,
      partially,
      true  // excludeNonSelectableNodes: honour node.selectable === false
    );

    // Always dispatch — passing an empty list through addSelectedNodes is how
    // we deselect nodes that fell outside the shrinking box.
    const nodeIds = nodesInside.map(n => n.id);
    this.store.addSelectedNodes(nodeIds);
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.isSelecting) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;

    this.isSelecting = false;
    if (this.activePointerId !== null) {
      try {
        this.el.nativeElement.releasePointerCapture(this.activePointerId);
      } catch {
        // already released
      }
      this.activePointerId = null;
    }

    if (this.boundOnPointerMove) {
      document.removeEventListener('pointermove', this.boundOnPointerMove);
      this.boundOnPointerMove = null;
    }
    if (this.boundOnPointerUp) {
      document.removeEventListener('pointerup', this.boundOnPointerUp);
      this.boundOnPointerUp = null;
    }

    this.store.userSelectionActive.set(false);
    this.store.userSelectionRect.set(null);
    // selectionInProgress was set in onPointerMove on the first real movement,
    // so a genuine marquee absorbs its synthesised click via onPaneClick while a
    // zero-movement click leaves the flag false and reaches onPaneClick normally.
    // Mark nodes selection active only if nodes were selected.
    if (this.store.selectedNodes().length > 0) {
      this.store.nodesSelectionActive.set(true);
    }
    this.selectionEnd.emit(event);
  }

  ngOnDestroy(): void {
    if (this.nativePointerDownHandler) {
      this.el.nativeElement.removeEventListener('pointerdown', this.nativePointerDownHandler, true);
    }
    if (this.boundOnPointerMove) {
      document.removeEventListener('pointermove', this.boundOnPointerMove);
    }
    if (this.boundOnPointerUp) {
      document.removeEventListener('pointerup', this.boundOnPointerUp);
    }
  }
}
