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
import { XYDrag, type XYDragInstance, type NodeBase, type NodeDragItem } from '@ngflow/system';
import { FlowStore } from '../services/flow-store.service';
import type { Node } from '../types';

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

  readonly dragStart = output<{ event: MouseEvent; node: Node; nodes: Node[] }>();
  readonly drag = output<{ event: MouseEvent; node: Node; nodes: Node[] }>();
  readonly dragStop = output<{ event: MouseEvent; node: Node; nodes: Node[] }>();

  private dragInstance: XYDragInstance | null = null;

  ngOnInit(): void {
    this.dragInstance = XYDrag({
      getStoreItems: () => this.store.getStoreItems(),
      onNodeMouseDown: (id: string) => {
        this.handleNodeClick(id);
      },
      onDragStart: (event: MouseEvent, _dragItems: Map<string, NodeDragItem>, node: NodeBase) => {
        const selectedNodes = this.store.selectedNodes();
        const userNode = (node as unknown as { internals?: { userNode?: Node } })?.internals?.userNode ?? node as unknown as Node;
        this.dragStart.emit({ event, node: userNode, nodes: selectedNodes });
      },
      onDrag: (event: MouseEvent, _dragItems: Map<string, NodeDragItem>, node: NodeBase) => {
        const selectedNodes = this.store.selectedNodes();
        const userNode = (node as unknown as { internals?: { userNode?: Node } })?.internals?.userNode ?? node as unknown as Node;
        this.drag.emit({ event, node: userNode, nodes: selectedNodes });
      },
      onDragStop: (event: MouseEvent, _dragItems: Map<string, NodeDragItem>, node: NodeBase) => {
        const selectedNodes = this.store.selectedNodes();
        const userNode = (node as unknown as { internals?: { userNode?: Node } })?.internals?.userNode ?? node as unknown as Node;
        this.dragStop.emit({ event, node: userNode, nodes: selectedNodes });
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
