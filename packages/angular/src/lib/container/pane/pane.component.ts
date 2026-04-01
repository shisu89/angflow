import { Component, ChangeDetectionStrategy, input, output, inject, NgZone, OnDestroy, ElementRef } from '@angular/core';
import { getNodesInside, SelectionMode } from '@ngflow/system';
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
  private zone = inject(NgZone);
  private el = inject(ElementRef<HTMLElement>);

  readonly panOnDrag = input<boolean | number[]>(true);
  readonly selectionOnDrag = input(false);
  readonly selectionKeyCode = input<any>(null);
  readonly selectionMode = input<SelectionMode>(SelectionMode.Full);

  readonly selectionStart = output<MouseEvent>();
  readonly selectionEnd = output<MouseEvent>();
  readonly paneScroll = output<WheelEvent>();

  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private boundOnMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundOnMouseUp: ((e: MouseEvent) => void) | null = null;
  private nativeMouseDownHandler: ((e: Event) => void) | null = null;

  onWheel(event: WheelEvent): void {
    this.paneScroll.emit(event);
  }

  /**
   * Call this after d3-zoom is initialized to attach a capture-phase
   * mousedown listener that fires BEFORE d3-zoom's listener.
   */
  initSelectionListener(): void {
    this.nativeMouseDownHandler = (e: Event) => this.onMouseDown(e as MouseEvent);
    // Capture phase fires before d3-zoom's bubble-phase listener
    this.el.nativeElement.addEventListener('mousedown', this.nativeMouseDownHandler, true);
  }

  private onMouseDown(event: MouseEvent): void {
    const shouldSelect = this.selectionOnDrag() || this.store.selectionKeyActive();
    if (!shouldSelect) return;
    if (event.button !== 0) return;

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

    this.boundOnMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundOnMouseUp = (e: MouseEvent) => this.onMouseUp(e);

    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.boundOnMouseMove!);
      document.addEventListener('mouseup', this.boundOnMouseUp!);
    });
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isSelecting) return;

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

    this.zone.run(() => {
      this.store.userSelectionRect.set(selectionRect);

      const transform = this.store.transform();
      const partially = this.selectionMode() === SelectionMode.Partial;
      const nodesInside = getNodesInside(
        this.store.nodeLookup,
        selectionRect,
        transform,
        partially
      );

      const nodeIds = nodesInside.map(n => n.id);
      if (nodeIds.length > 0) {
        this.store.addSelectedNodes(nodeIds);
      }
    });
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.isSelecting) return;

    this.isSelecting = false;

    if (this.boundOnMouseMove) {
      document.removeEventListener('mousemove', this.boundOnMouseMove);
      this.boundOnMouseMove = null;
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener('mouseup', this.boundOnMouseUp);
      this.boundOnMouseUp = null;
    }

    this.zone.run(() => {
      this.store.userSelectionActive.set(false);
      this.store.userSelectionRect.set(null);
      this.selectionEnd.emit(event);
    });
  }

  ngOnDestroy(): void {
    if (this.nativeMouseDownHandler) {
      this.el.nativeElement.removeEventListener('mousedown', this.nativeMouseDownHandler, true);
    }
    if (this.boundOnMouseMove) {
      document.removeEventListener('mousemove', this.boundOnMouseMove);
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener('mouseup', this.boundOnMouseUp);
    }
  }
}
