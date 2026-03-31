import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  output,
  Type,
  Injector,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID } from '../../services/tokens';
import { DragDirective } from '../../directives/drag.directive';
import { DefaultNodeComponent } from '../../components/nodes/default-node.component';
import { InputNodeComponent } from '../../components/nodes/input-node.component';
import { OutputNodeComponent } from '../../components/nodes/output-node.component';
import { GroupNodeComponent } from '../../components/nodes/group-node.component';
import type { Node, NodeTypes } from '../../types';

const builtInNodeTypes: NodeTypes = {
  default: DefaultNodeComponent,
  input: InputNodeComponent,
  output: OutputNodeComponent,
  group: GroupNodeComponent,
};

@Component({
  selector: 'ng-flow-node-renderer',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, DragDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__nodes xy-flow__nodes',
    'style': 'display: block; pointer-events: none; transform-origin: 0 0; width: 100%; height: 100%;',
  },
  template: `
    @for (node of visibleNodes(); track node.id) {
      <div
        class="ng-flow__node xy-flow__node"
        [class]="'xy-flow__node-' + (node.type || 'default')"
        [class.selected]="node.selected"
        [class.draggable]="node.draggable !== false && store.nodesDraggable()"
        [class.dragging]="node.dragging"
        [class.selectable]="node.selectable !== false"
        [class.connectable]="true"
        [ngFlowDrag]="node.id"
        [ngFlowDragDisabled]="node.draggable === false || !store.nodesDraggable()"
        [ngFlowDragHandleSelector]="node.dragHandle"
        [ngFlowDragNoDragClass]="store.noDragClassName()"
        (dragStart)="nodeDragStart.emit($event)"
        (drag)="nodeDrag.emit($event)"
        (dragStop)="nodeDragStop.emit($event)"
        role="button"
        [attr.aria-label]="getNodeAriaLabel(node)"
        [attr.aria-selected]="node.selected ?? false"
        [attr.data-id]="node.id"
        [attr.tabindex]="store.nodesFocusable() ? 0 : -1"
        [style.z-index]="getNodeZ(node)"
        [style.transform]="getNodeTransform(node)"
        (click)="onNodeEvent($event, node.id, 'click')"
        (dblclick)="onNodeEvent($event, node.id, 'dblclick')"
        (contextmenu)="onNodeEvent($event, node.id, 'contextmenu')"
        (mouseenter)="onNodeEvent($event, node.id, 'mouseenter')"
        (mousemove)="onNodeEvent($event, node.id, 'mousemove')"
        (mouseleave)="onNodeEvent($event, node.id, 'mouseleave')"
        (focus)="onNodeFocus(node)"
      >
        <ng-container
          *ngComponentOutlet="getNodeComponent(node.type); inputs: getNodeInputs(node); injector: getNodeInjector(node.id)"
        />
      </div>
    }
  `,
})
export class NodeRendererComponent implements AfterViewInit, OnDestroy {
  readonly store = inject(FlowStore);
  private parentInjector = inject(Injector);
  private el = inject(ElementRef<HTMLElement>);

  readonly customNodeTypes = input<NodeTypes>({});

  // Node events that bubble up to NgFlowComponent
  readonly nodeClick = output<{ event: MouseEvent; node: any }>();
  readonly nodeDoubleClick = output<{ event: MouseEvent; node: any }>();
  readonly nodeContextMenu = output<{ event: MouseEvent; node: any }>();
  readonly nodeMouseEnter = output<{ event: MouseEvent; node: any }>();
  readonly nodeMouseMove = output<{ event: MouseEvent; node: any }>();
  readonly nodeMouseLeave = output<{ event: MouseEvent; node: any }>();
  readonly nodeDragStart = output<{ event: MouseEvent; node: any; nodes: any[] }>();
  readonly nodeDrag = output<{ event: MouseEvent; node: any; nodes: any[] }>();
  readonly nodeDragStop = output<{ event: MouseEvent; node: any; nodes: any[] }>();

  readonly visibleNodes = computed(() => this.store.visibleNodes());

  private nodeInjectorCache = new Map<string, Injector>();
  private resizeObserver: ResizeObserver | null = null;

  private mutationObserver: MutationObserver | null = null;
  private observedNodeIds = new Set<string>();

  ngAfterViewInit(): void {
    // Set up ResizeObserver — fires when node dimensions change
    this.resizeObserver = new ResizeObserver((entries) => {
      const updates = new Map<string, { id: string; nodeElement: HTMLDivElement; force?: boolean }>();

      for (const entry of entries) {
        const nodeEl = entry.target as HTMLDivElement;
        const nodeId = nodeEl.getAttribute('data-id');
        if (nodeId) {
          updates.set(nodeId, { id: nodeId, nodeElement: nodeEl });
        }
      }

      if (updates.size > 0) {
        this.store.updateNodeInternals(updates);
      }
    });

    // Use MutationObserver to detect when new nodes are added to the DOM
    this.mutationObserver = new MutationObserver(() => {
      this.observeNewNodes();
    });
    this.mutationObserver.observe(this.el.nativeElement, { childList: true, subtree: false });

    // Initial observation after a microtask (nodes may not be in DOM yet)
    Promise.resolve().then(() => this.observeNewNodes());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  private observeNewNodes(): void {
    if (!this.resizeObserver) return;

    const container = this.el.nativeElement;
    const nodeElements = container.querySelectorAll('.xy-flow__node');
    nodeElements.forEach((el: Element) => {
      const id = el.getAttribute('data-id');
      if (id && !this.observedNodeIds.has(id)) {
        this.observedNodeIds.add(id);
        this.resizeObserver!.observe(el);
      }
    });
  }

  onNodeEvent(event: MouseEvent, nodeId: string, eventType: string): void {
    const internalNode = this.store.nodeLookup.get(nodeId);
    const node = internalNode?.internals?.userNode ?? internalNode;
    if (!node) return;

    switch (eventType) {
      case 'click':
        // Select the node on click
        if (this.store.elementsSelectable()) {
          this.store.addSelectedNodes([nodeId]);
        }
        this.nodeClick.emit({ event, node });
        break;
      case 'dblclick':
        this.nodeDoubleClick.emit({ event, node });
        break;
      case 'contextmenu':
        this.nodeContextMenu.emit({ event, node });
        break;
      case 'mouseenter':
        this.nodeMouseEnter.emit({ event, node });
        break;
      case 'mousemove':
        this.nodeMouseMove.emit({ event, node });
        break;
      case 'mouseleave':
        this.nodeMouseLeave.emit({ event, node });
        break;
    }
  }

  onNodeFocus(node: any): void {
    // Select the focused node
    if (this.store.elementsSelectable()) {
      this.store.addSelectedNodes([node.id]);
    }

    if (!this.store.autoPanOnNodeFocus()) return;

    const internalNode = this.store.nodeLookup.get(node.id);
    if (!internalNode) return;

    const x = internalNode.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
    const y = internalNode.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
    const w = internalNode.measured?.width ?? node.width ?? 150;
    const h = internalNode.measured?.height ?? node.height ?? 40;

    // Center the node in the viewport
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const zoom = this.store.transform()[2];
    const viewportCenterX = this.store.width() / 2;
    const viewportCenterY = this.store.height() / 2;

    const targetX = viewportCenterX - centerX * zoom;
    const targetY = viewportCenterY - centerY * zoom;

    const currentX = this.store.transform()[0];
    const currentY = this.store.transform()[1];

    // Only pan if the node is not already reasonably visible
    const nodeScreenX = x * zoom + currentX;
    const nodeScreenY = y * zoom + currentY;
    const nodeScreenRight = nodeScreenX + w * zoom;
    const nodeScreenBottom = nodeScreenY + h * zoom;
    const margin = 50;

    if (
      nodeScreenX > margin &&
      nodeScreenY > margin &&
      nodeScreenRight < this.store.width() - margin &&
      nodeScreenBottom < this.store.height() - margin
    ) {
      return; // Node is already visible, no need to pan
    }

    this.store.panBy({ x: targetX - currentX, y: targetY - currentY });
  }

  getNodeComponent(type?: string): Type<any> {
    const resolvedType = type || 'default';
    return this.customNodeTypes()[resolvedType] ?? builtInNodeTypes[resolvedType] ?? DefaultNodeComponent;
  }

  getNodeInjector(nodeId: string): Injector {
    let injector = this.nodeInjectorCache.get(nodeId);
    if (!injector) {
      injector = Injector.create({
        providers: [{ provide: NODE_ID, useValue: nodeId }],
        parent: this.parentInjector,
      });
      this.nodeInjectorCache.set(nodeId, injector);
    }
    return injector;
  }

  getNodeZ(node: any): number {
    return node.internals?.z ?? 0;
  }

  getNodeTransform(node: any): string {
    const x = node.internals?.positionAbsolute?.x ?? node.position.x;
    const y = node.internals?.positionAbsolute?.y ?? node.position.y;
    return `translate(${x}px, ${y}px)`;
  }

  getNodeAriaLabel(node: any): string {
    if (node.ariaLabel) return node.ariaLabel;
    const label = node.data?.label ?? node.id;
    const type = node.type || 'default';
    return `Node: ${label}, type: ${type}`;
  }

  getNodeInputs(node: any): Record<string, any> {
    return {
      id: node.id,
      data: node.data,
      type: node.type,
      selected: node.selected ?? false,
      dragging: node.dragging ?? false,
      zIndex: node.internals?.z ?? 0,
      isConnectable: true,
      positionAbsoluteX: node.internals?.positionAbsolute?.x ?? node.position.x,
      positionAbsoluteY: node.internals?.positionAbsolute?.y ?? node.position.y,
      sourcePosition: node.sourcePosition,
      targetPosition: node.targetPosition,
      dragHandle: node.dragHandle,
    };
  }
}
