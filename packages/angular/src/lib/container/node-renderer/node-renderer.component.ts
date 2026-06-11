import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  output,
  reflectComponentType,
  Type,
  Injector,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  TemplateRef,
  signal,
  effect,
} from '@angular/core';
import { CommonModule, NgComponentOutlet, NgTemplateOutlet, NgStyle } from '@angular/common';
import { FlowStore } from '../../services/flow-store.service';
import { NODE_ID, NG_FLOW_NODE_CONTEXT } from '../../services/tokens';
import { DragDirective } from '../../directives/drag.directive';
import { DefaultNodeComponent } from '../../components/nodes/default-node.component';
import { InputNodeComponent } from '../../components/nodes/input-node.component';
import { OutputNodeComponent } from '../../components/nodes/output-node.component';
import { GroupNodeComponent } from '../../components/nodes/group-node.component';
import { TemplateNodeComponent } from '../../components/nodes/template-node.component';
import type { Node, InternalNode, NodeTypes, NgFlowNodeContext } from '../../types';

/**
 * Cache key for a node's NgComponentOutlet inputs object. Enumerates every
 * field `getNodeInputs` feeds into the inputs object (data is compared by
 * reference in the cache entry instead — object identity can't live in a
 * string key). Exported for tests.
 */
export function computeNodeInputsKey(
  node: InternalNode,
  nodesConnectable: boolean,
  isTemplate: boolean,
): string {
  const x = node.internals?.positionAbsolute?.x ?? node.position.x;
  const y = node.internals?.positionAbsolute?.y ?? node.position.y;
  return [
    node.type ?? 'default',
    isTemplate ? 1 : 0,
    node.selected ? 1 : 0,
    node.dragging ? 1 : 0,
    node.internals?.z ?? 0,
    (node.connectable ?? nodesConnectable) ? 1 : 0,
    x,
    y,
    node.sourcePosition ?? '',
    node.targetPosition ?? '',
    node.dragHandle ?? '',
  ].join(':');
}

// Keep the key set in sync with BUILT_IN_NODE_TYPE_NAMES in services/ng-flow.service.ts.
const builtInNodeTypes: NodeTypes = {
  default: DefaultNodeComponent,
  input: InputNodeComponent,
  output: OutputNodeComponent,
  group: GroupNodeComponent,
};

@Component({
  selector: 'ng-flow-node-renderer',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, NgTemplateOutlet, NgStyle, DragDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__nodes xy-flow__nodes',
    'style': 'display: block; pointer-events: none; transform-origin: 0 0; width: 100%; height: 100%;',
  },
  template: `
    @for (node of visibleNodes(); track node.id) {
      @if (!node.hidden) {
      <div
        class="ng-flow__node xy-flow__node"
        [class]="getNodeClasses(node)"
        [class.selected]="node.selected"
        [class.draggable]="node.draggable !== false && store.nodesDraggable()"
        [class.dragging]="node.dragging"
        [class.selectable]="node.selectable !== false && store.elementsSelectable()"
        [class.connectable]="(node.connectable ?? store.nodesConnectable())"
        [class.connection-target]="store.connectionTargetNodeId() === node.id"
        [class.collapsed]="node.collapsed"
        [ngFlowDrag]="node.id"
        [ngFlowDragDisabled]="node.draggable === false || !store.nodesDraggable()"
        [ngFlowDragSelectable]="node.selectable !== false && store.elementsSelectable()"
        [ngFlowDragHandleSelector]="node.dragHandle"
        [ngFlowDragNoDragClass]="store.noDragClassName()"
        role="button"
        [attr.aria-label]="getNodeAriaLabel(node)"
        [attr.aria-describedby]="store.rfId() + '-node-desc'"
        [attr.aria-selected]="node.selected ?? false"
        [attr.data-id]="node.id"
        [attr.tabindex]="store.nodesFocusable() ? 0 : -1"
        [style.z-index]="getNodeZ(node)"
        [style.transform]="getNodeTransform(node)"
        [class.xy-flow__node-enter]="enteringNodeIds().has(node.id)"
        [style.animation-duration]="enteringNodeIds().has(node.id) ? store.animationDuration() + 'ms' : null"
        (animationend)="onNodeAnimationEnd($event, node.id)"
        [style.width.px]="node.width ?? null"
        [style.height.px]="node.height ?? null"
        [ngStyle]="node.style"
        (click)="onNodeEvent($event, node.id, 'click')"
        (dblclick)="onNodeEvent($event, node.id, 'dblclick')"
        (contextmenu)="onNodeEvent($event, node.id, 'contextmenu')"
        (mouseenter)="onNodeEvent($event, node.id, 'mouseenter')"
        (mousemove)="onNodeEvent($event, node.id, 'mousemove')"
        (mouseleave)="onNodeEvent($event, node.id, 'mouseleave')"
        (keydown)="onNodeKeyDown($event, node)"
        (focus)="onNodeFocus(node, $event)"
      >
        @if (getNodeTemplate(node.type); as tmpl) {
          <ng-container
            *ngTemplateOutlet="tmpl; context: getNodeTemplateContext(node); injector: getNodeInjector(node.id)"
          />
        } @else {
          <ng-container
            *ngComponentOutlet="getNodeComponent(node.type); inputs: getNodeInputs(node); injector: getNodeInjector(node.id)"
          />
        }
      </div>
      }
    }
  `,
})
export class NodeRendererComponent implements AfterViewInit, OnDestroy {
  readonly store = inject(FlowStore);
  private parentInjector = inject(Injector);
  private el = inject(ElementRef<HTMLElement>);

  readonly customNodeTypes = input<NodeTypes>({});
  readonly nodeTemplateMap = input<Map<string, TemplateRef<any>>>(new Map());

  // Node events that bubble up to NgFlowComponent
  readonly nodeClick = output<{ event: MouseEvent; node: Node }>();
  readonly nodeDoubleClick = output<{ event: MouseEvent; node: Node }>();
  readonly nodeContextMenu = output<{ event: MouseEvent; node: Node }>();
  readonly nodeMouseEnter = output<{ event: MouseEvent; node: Node }>();
  readonly nodeMouseMove = output<{ event: MouseEvent; node: Node }>();
  readonly nodeMouseLeave = output<{ event: MouseEvent; node: Node }>();

  readonly visibleNodes = computed(() => this.store.visibleNodes());

  /** Ids of nodes currently playing their entry animation. */
  readonly enteringNodeIds = signal<ReadonlySet<string>>(new Set());
  private previousNodeIds: Set<string> | null = null;

  constructor() {
    // Entry-animation bookkeeping: diff node ids per render. The first
    // emission is the initial mount — never animated (no full-graph flash).
    effect(() => {
      // Cost note: this rebuilds the id set on every nodes() emission — including
      // every frame of a position tween (the store re-emits per rAF frame). The
      // early returns below keep re-runs write-free, so the per-frame cost is one
      // O(N) Set build; revisit with a dedicated add/remove-only signal if large
      // graphs make this measurable.
      const ids = new Set(this.store.nodes().map((n) => n.id));
      const prev = this.previousNodeIds;
      this.previousNodeIds = ids;
      if (prev === null || !this.store.animationEnabled()) {
        if (this.enteringNodeIds().size > 0) this.enteringNodeIds.set(new Set());
        return;
      }
      const fresh: string[] = [];
      for (const id of ids) {
        if (!prev.has(id)) fresh.push(id);
      }
      // Prune entries for removed nodes; add the newcomers.
      const current = this.enteringNodeIds();
      const stale = [...current].filter((id) => !ids.has(id));
      if (fresh.length === 0 && stale.length === 0) return;
      const next = new Set([...current].filter((id) => ids.has(id)));
      for (const id of fresh) next.add(id);
      this.enteringNodeIds.set(next);
    });
  }

  onNodeAnimationEnd(event: AnimationEvent, id: string): void {
    // Only the library's enter keyframe — user animations on node content
    // bubble the same event.
    if (event.animationName !== 'xy-flow-node-enter') return;
    if (!this.enteringNodeIds().has(id)) return;
    this.enteringNodeIds.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  private nodeInjectorCache = new Map<string, Injector>();
  private nodeContextCache = new Map<string, NgFlowNodeContext<unknown>>();
  private nodeInputsCache = new Map<string, { key: string; data: unknown; inputs: Record<string, unknown> }>();
  private declaredInputsCache = new WeakMap<Type<unknown>, Set<string> | null>();
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

    // Use MutationObserver to detect when nodes are added/removed from the DOM
    this.mutationObserver = new MutationObserver((mutations) => {
      this.observeNewNodes();
      this.cleanupRemovedNodes(mutations);
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

  private cleanupRemovedNodes(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      for (const removedNode of Array.from(mutation.removedNodes)) {
        if (!(removedNode instanceof HTMLElement)) continue;
        const id = removedNode.getAttribute('data-id');
        if (id && this.observedNodeIds.has(id)) {
          this.observedNodeIds.delete(id);
          this.resizeObserver?.unobserve(removedNode);
          this.nodeInjectorCache.delete(id);
          this.nodeContextCache.delete(id);
          this.nodeInputsCache.delete(id);
        }
      }
    }
  }

  onNodeEvent(event: MouseEvent, nodeId: string, eventType: string): void {
    const internalNode = this.store.nodeLookup.get(nodeId);
    const node = internalNode?.internals?.userNode ?? internalNode;
    if (!node) return;

    switch (eventType) {
      case 'click':
        if (this.store.elementsSelectable() && internalNode?.selectable !== false) {
          if (this.store.multiSelectionActive()) {
            // Multi-selection key held: toggle this node
            if (internalNode?.selected) {
              this.store.unselectNodesAndEdges({ nodes: [node] });
            } else {
              this.store.addSelectedNodes([nodeId]);
            }
          } else if (!internalNode?.selected) {
            // Normal click on unselected node: replace selection
            this.store.addSelectedNodes([nodeId]);
          }
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

  onNodeKeyDown(event: KeyboardEvent, node: Node): void {
    if (event.key === 'Escape') {
      this.store.unselectNodesAndEdges({ nodes: [node] });
      // Move focus to the container to avoid the node staying focused
      (event.currentTarget as HTMLElement)?.blur();
    } else if (event.key === 'Enter') {
      if (this.store.elementsSelectable() && !node.selected) {
        this.store.addSelectedNodes([node.id]);
      }
    }
  }

  onNodeFocus(node: Node, event?: FocusEvent): void {
    // Only select on keyboard-driven focus (:focus-visible). Mouse-driven
    // focus fires before the native click, so selecting here would race the
    // click handler — on Ctrl+Click it adds the node, then click sees it as
    // selected and toggles it back off.
    const el = event?.currentTarget as HTMLElement | null;
    const focusVisible = el?.matches?.(':focus-visible') ?? false;
    if (focusVisible && this.store.elementsSelectable() && node.selectable !== false && !node.selected) {
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

  getNodeTemplate(type?: string): TemplateRef<any> | null {
    const resolvedType = type || 'default';
    return this.nodeTemplateMap().get(resolvedType) ?? null;
  }

  getNodeTemplateContext(node: InternalNode): Record<string, unknown> {
    const userNode = node.internals?.userNode ?? node;
    return {
      $implicit: userNode,
      node: userNode,
      data: userNode.data,
      selected: node.selected ?? false,
      id: node.id,
      type: node.type,
      dragging: node.dragging ?? false,
    };
  }

  getNodeComponent(type?: string): Type<unknown> {
    const resolvedType = type || 'default';
    const hostOrBuiltIn = this.customNodeTypes()[resolvedType] ?? builtInNodeTypes[resolvedType];
    if (hostOrBuiltIn) return hostOrBuiltIn;
    // Agent-registered data-driven templates: reading the registry signal here
    // makes the template binding reactive — registering/unregistering a
    // template re-renders affected nodes with no host involvement.
    if (this.store.nodeTemplates().has(resolvedType)) return TemplateNodeComponent;
    return DefaultNodeComponent;
  }

  getNodeInjector(nodeId: string): Injector {
    let injector = this.nodeInjectorCache.get(nodeId);
    if (!injector) {
      let context = this.nodeContextCache.get(nodeId);
      if (!context) {
        context = this.buildNodeContext(nodeId);
        this.nodeContextCache.set(nodeId, context);
      }

      injector = Injector.create({
        providers: [
          { provide: NODE_ID, useValue: nodeId },
          { provide: NG_FLOW_NODE_CONTEXT, useValue: context },
        ],
        parent: this.parentInjector,
      });
      this.nodeInjectorCache.set(nodeId, injector);
    }
    return injector;
  }

  getNodeClasses(node: InternalNode): string {
    const typeClass = 'xy-flow__node-' + (node.type || 'default');
    return node.className ? typeClass + ' ' + node.className : typeClass;
  }

  getNodeZ(node: InternalNode): number {
    return node.internals?.z ?? 0;
  }

  getNodeTransform(node: InternalNode): string {
    const x = node.internals?.positionAbsolute?.x ?? node.position.x;
    const y = node.internals?.positionAbsolute?.y ?? node.position.y;
    return `translate(${x}px, ${y}px)`;
  }

  getNodeAriaLabel(node: InternalNode): string {
    if (node.ariaLabel) return node.ariaLabel;
    const label = node.data?.label ?? node.id;
    const type = node.type || 'default';
    return `Node: ${label}, type: ${type}`;
  }

  getNodeInputs(node: InternalNode): Record<string, unknown> {
    const nodesConnectable = this.store.nodesConnectable();
    const isTemplate = this.store.nodeTemplates().has(node.type ?? 'default');
    // Per-node key: a global version bump (every drag frame) must not
    // invalidate all N nodes' inputs — only fields this node's inputs
    // actually read. The template stays version-reactive via visibleNodes().
    const key = computeNodeInputsKey(node, nodesConnectable, isTemplate);
    const cached = this.nodeInputsCache.get(node.id);
    if (cached && cached.key === key && cached.data === node.data) {
      return cached.inputs;
    }

    const allInputs: Record<string, unknown> = {
      id: node.id,
      data: node.data,
      type: node.type,
      selected: node.selected ?? false,
      dragging: node.dragging ?? false,
      zIndex: node.internals?.z ?? 0,
      isConnectable: node.connectable ?? nodesConnectable,
      positionAbsoluteX: node.internals?.positionAbsolute?.x ?? node.position.x,
      positionAbsoluteY: node.internals?.positionAbsolute?.y ?? node.position.y,
      sourcePosition: node.sourcePosition,
      targetPosition: node.targetPosition,
      dragHandle: node.dragHandle,
    };

    // Only push keys the target component actually declares as inputs.
    // Components that use injectNgFlowNode() (the DI-based API) omit input()
    // declarations entirely; pushing unknown keys via ngComponentOutlet would
    // throw NG0303 on every render.
    const declared = this.getDeclaredInputs(this.getNodeComponent(node.type));
    const inputs: Record<string, unknown> = declared
      ? Object.fromEntries(Object.entries(allInputs).filter(([k]) => declared.has(k)))
      : allInputs;

    this.nodeInputsCache.set(node.id, { key, data: node.data, inputs });
    return inputs;
  }

  private getDeclaredInputs(Component: Type<unknown>): Set<string> | null {
    if (this.declaredInputsCache.has(Component)) {
      return this.declaredInputsCache.get(Component) ?? null;
    }
    const mirror = reflectComponentType(Component);
    const set = mirror ? new Set(mirror.inputs.map((i) => i.templateName)) : null;
    this.declaredInputsCache.set(Component, set);
    return set;
  }

  private buildNodeContext(nodeId: string): NgFlowNodeContext<unknown> {
    const store = this.store;
    const getNode = () => {
      store.version();
      return store.nodeLookup.get(nodeId);
    };

    return {
      id: computed(() => nodeId),
      data: computed(() => getNode()?.data),
      type: computed(() => getNode()?.type),
      selected: computed(() => getNode()?.selected ?? false),
      dragging: computed(() => getNode()?.dragging ?? false),
      zIndex: computed(() => getNode()?.internals?.z ?? 0),
      isConnectable: computed(() => {
        const n = getNode();
        return n?.connectable ?? store.nodesConnectable();
      }),
      position: computed(() => {
        const n = getNode();
        return {
          x: n?.internals?.positionAbsolute?.x ?? n?.position.x ?? 0,
          y: n?.internals?.positionAbsolute?.y ?? n?.position.y ?? 0,
        };
      }),
      sourcePosition: computed(() => getNode()?.sourcePosition),
      targetPosition: computed(() => getNode()?.targetPosition),
      dragHandle: computed(() => getNode()?.dragHandle),
      collapsed: computed(() => getNode()?.collapsed ?? false),
    };
  }
}
