import {
  Directive,
  ElementRef,
  inject,
  input,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { XYDrag, type XYDragInstance } from '@angflow/system';
import { FlowStore } from '../services/flow-store.service';

/**
 * Attach to a custom element to make it drag-draggable inside the flow.
 * Internally wraps the `@angflow/system` `XYDrag` helper and updates the
 * store with position changes. Used by the node renderer; expose for custom
 * node wrappers that need to opt into dragging manually.
 *
 * @example
 * ```html
 * <div [ngFlowDrag]="node.id" [ngFlowDragSelectable]="true">…</div>
 * ```
 */
@Directive({
  selector: '[ngFlowDrag]',
  standalone: true,
})
export class DragDirective implements OnInit, OnChanges, OnDestroy {
  private store = inject(FlowStore);
  private el = inject(ElementRef<HTMLDivElement>);

  /** Id of the node being dragged. Required; used as the directive's primary input. */
  readonly nodeId = input.required<string>({ alias: 'ngFlowDrag' });
  /** Disable the drag behavior without detaching the directive. */
  readonly disabled = input(false, { alias: 'ngFlowDragDisabled' });
  /** CSS class that, when present on a descendant, prevents that descendant from starting a drag. */
  readonly noDragClassName = input<string>('nodrag', { alias: 'ngFlowDragNoDragClass' });
  /** Optional CSS selector — only descendants matching it will start a drag. */
  readonly handleSelector = input<string | undefined>(undefined, { alias: 'ngFlowDragHandleSelector' });
  /** Whether mousedown on the element should also select the node. */
  readonly isSelectable = input(true, { alias: 'ngFlowDragSelectable' });
  /** Pixel threshold below which the gesture is treated as a click, not a drag. */
  readonly nodeClickDistance = input(0, { alias: 'ngFlowDragClickDistance' });

  private dragInstance: XYDragInstance | null = null;

  ngOnInit(): void {
    this.dragInstance = XYDrag({
      getStoreItems: () => this.store.getStoreItems(),
      onNodeMouseDown: (id: string) => {
        this.handleNodeClick(id);
      },
    });

    this.updateDrag();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.dragInstance) {
      this.updateDrag();
    }
  }

  ngOnDestroy(): void {
    this.dragInstance?.destroy();
  }

  private updateDrag(): void {
    if (!this.el.nativeElement || !this.dragInstance) {
      return;
    }

    // Mirrors React's useDrag effect: destroy the d3-drag binding when
    // disabled, re-bind on every input change otherwise. Without this, flags
    // like `isSelectable` get stuck on the value they had when `disabled`
    // first flipped true, because we'd silently skip update().
    if (this.disabled()) {
      this.dragInstance.destroy();
      return;
    }

    this.dragInstance.update({
      noDragClassName: this.noDragClassName(),
      handleSelector: this.handleSelector(),
      domNode: this.el.nativeElement,
      isSelectable: this.isSelectable(),
      nodeId: this.nodeId(),
      nodeClickDistance: this.nodeClickDistance(),
    });
  }

  private handleNodeClick(id: string): void {
    const store = this.store;
    const node = store.nodeLookup.get(id);
    if (!node) return;

    if (store.selectNodesOnDrag() && node.selectable !== false) {
      // If the node is already selected, don't re-select (which would deselect others)
      if (!node.selected) {
        store.addSelectedNodes([id]);
      }
    }
  }
}
