import {
  Directive,
  ElementRef,
  inject,
  input,
  output,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { XYDrag, type XYDragInstance } from '@xyflow/system';
import { FlowStore } from '../services/flow-store.service';

@Directive({
  selector: '[ngFlowDrag]',
  standalone: true,
})
export class DragDirective implements OnInit, OnChanges, OnDestroy {
  private store = inject(FlowStore);
  private el = inject(ElementRef<HTMLDivElement>);

  readonly nodeId = input.required<string>({ alias: 'ngFlowDrag' });
  readonly disabled = input(false, { alias: 'ngFlowDragDisabled' });
  readonly noDragClassName = input<string>('nodrag', { alias: 'ngFlowDragNoDragClass' });
  readonly handleSelector = input<string | undefined>(undefined, { alias: 'ngFlowDragHandleSelector' });
  readonly isSelectable = input(true, { alias: 'ngFlowDragSelectable' });
  readonly nodeClickDistance = input(0, { alias: 'ngFlowDragClickDistance' });

  readonly dragStart = output<{ event: MouseEvent; node: any; nodes: any[] }>();
  readonly drag = output<{ event: MouseEvent; node: any; nodes: any[] }>();
  readonly dragStop = output<{ event: MouseEvent; node: any; nodes: any[] }>();

  private dragInstance: XYDragInstance | null = null;

  ngOnInit(): void {
    this.dragInstance = XYDrag({
      getStoreItems: () => this.store.getStoreItems(),
      onNodeMouseDown: (id: string) => {
        this.handleNodeClick(id);
      },
      onDragStart: (event: any, _dragItems: any, node: any) => {
        const selectedNodes = this.store.selectedNodes();
        this.dragStart.emit({ event, node: node?.internals?.userNode ?? node, nodes: selectedNodes });
      },
      onDrag: (event: any, _dragItems: any, node: any) => {
        const selectedNodes = this.store.selectedNodes();
        this.drag.emit({ event, node: node?.internals?.userNode ?? node, nodes: selectedNodes });
      },
      onDragStop: (event: any, _dragItems: any, node: any) => {
        const selectedNodes = this.store.selectedNodes();
        this.dragStop.emit({ event, node: node?.internals?.userNode ?? node, nodes: selectedNodes });
      },
    });

    this.updateDrag();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.dragInstance) {
      this.updateDrag();
    }
  }

  ngOnDestroy(): void {
    this.dragInstance?.destroy();
  }

  private updateDrag(): void {
    if (this.disabled() || !this.el.nativeElement || !this.dragInstance) {
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

    if (store.selectNodesOnDrag()) {
      // If the node is already selected, don't re-select (which would deselect others)
      if (!node.selected) {
        store.addSelectedNodes([id]);
      }
    }
  }
}
