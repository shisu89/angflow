import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  model,
  effect,
  viewChild,
  contentChildren,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Type,
  inject,
  NgZone,
  signal,
  computed,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ConnectionMode,
  ConnectionLineType,
  PanOnScrollMode,
  SelectionMode,
  infiniteExtent,
  XYPanZoom,
  getViewportForBounds,
  type Viewport,
  type CoordinateExtent,
  type NodeOrigin,
  type SnapGrid,
  type PanZoomInstance,
  type Transform,
  type OnConnect,
  type OnConnectStart,
  type OnConnectEnd,
  type OnMove,
  type OnMoveStart,
  type OnMoveEnd,
  type OnError,
  type KeyCode,
  type PanelPosition,
  type ProOptions,
  type ColorMode,
  type ZIndexMode,
  type AriaLabelConfig,
  type ConnectionState,
  type FinalConnectionState,
  type HandleType,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type OnConnectStartParams,
} from '@angflow/system';

import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { NodeRendererComponent } from '../node-renderer/node-renderer.component';
import { EdgeRendererComponent } from '../edge-renderer/edge-renderer.component';
import { ViewportComponent } from '../viewport/viewport.component';
import { PaneComponent } from '../pane/pane.component';
import { ConnectionLineComponent } from '../../components/connection-line/connection-line.component';
import { SelectionBoxComponent } from '../../components/selection-box/selection-box.component';
import { A11yDescriptionsComponent } from '../../components/a11y-descriptions/a11y-descriptions.component';
import { AttributionComponent } from '../../components/attribution/attribution.component';
import { KeyHandlerDirective } from '../../directives/key-handler.directive';
import { NgFlowNodeTypeDirective } from '../../directives/node-type.directive';
import type {
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  DefaultEdgeOptions,
  OnNodesChange,
  OnEdgesChange,
  OnNodesDelete,
  OnEdgesDelete,
  OnDelete,
  OnBeforeDelete,
  NodeMouseHandler,
  OnNodeDrag,
  SelectionDragHandler,
  EdgeMouseHandler,
  OnSelectionChangeFunc,
  FitViewOptions,
  OnInit as OnFlowInit,
  IsValidConnection,
  ConnectionLineComponentProps,
} from '../../types';

@Component({
  selector: 'ng-flow',
  standalone: true,
  imports: [
    CommonModule,
    NodeRendererComponent,
    EdgeRendererComponent,
    ViewportComponent,
    PaneComponent,
    ConnectionLineComponent,
    SelectionBoxComponent,
    KeyHandlerDirective,
    A11yDescriptionsComponent,
    AttributionComponent,
  ],
  providers: [FlowStore, NgFlowService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow xy-flow',
    'role': 'application',
    '[class.dark]': 'resolvedColorMode() === "dark"',
    '[class.light]': 'resolvedColorMode() === "light"',
    '[style.width.px]': 'widthInput()',
    '[style.height.px]': 'heightInput()',
    'style': 'display: block; position: relative; overflow: hidden; width: 100%; height: 100%;',
  },
  template: `
    <div
      class="ng-flow__container xy-flow__container"
      #container
      ngFlowKeyHandler
      [deleteKeyCode]="deleteKeyCode()"
      [selectionKeyCode]="selectionKeyCode()"
      [multiSelectionKeyCode]="multiSelectionKeyCode()"
      [disableKeyboardA11y]="disableKeyboardA11y()"
      (nodesDelete)="nodesDelete.emit($event)"
      (edgesDelete)="edgesDelete.emit($event)"
      (deleteElements)="deleteEvent.emit($event)"
    >
      <ng-flow-pane
        [panOnDrag]="panOnDrag()"
        [selectionOnDrag]="selectionOnDrag()"
        [selectionKeyCode]="selectionKeyCode()"
        [selectionMode]="selectionMode()"
        (pointerdown)="onPanePointerDown($event)"
        (click)="onPaneClick($event)"
        (contextmenu)="onPaneContextMenu($event)"
        (mouseenter)="paneMouseEnter.emit($event)"
        (mousemove)="paneMouseMove.emit($event)"
        (mouseleave)="paneMouseLeave.emit($event)"
        (selectionStart)="selectionStart.emit($event)"
        (selectionEnd)="selectionEnd.emit($event)"
        (paneScroll)="paneScroll.emit($event)"
      >
        <ng-flow-viewport [transform]="store.transform()">
          <ng-flow-edge-renderer
            [customEdgeTypes]="edgeTypes()"
            (edgeClick)="edgeClick.emit($event)"
            (edgeDoubleClick)="edgeDoubleClick.emit($event)"
            (edgeContextMenu)="edgeContextMenu.emit($event)"
            (edgeMouseEnter)="edgeMouseEnter.emit($event)"
            (edgeMouseMove)="edgeMouseMove.emit($event)"
            (edgeMouseLeave)="edgeMouseLeave.emit($event)"
            (reconnect)="reconnect.emit($event)"
            (reconnectStart)="reconnectStart.emit($event)"
            (reconnectEnd)="reconnectEnd.emit($event)"
          />
          <ng-flow-connection-line [customComponent]="connectionLineComponent()" [connectionLineType]="connectionLineType()" />
          <ng-flow-node-renderer
            [customNodeTypes]="nodeTypes()"
            [nodeTemplateMap]="nodeTemplateMap()"
            (nodeClick)="nodeClick.emit($event)"
            (nodeDoubleClick)="nodeDoubleClick.emit($event)"
            (nodeContextMenu)="nodeContextMenu.emit($event)"
            (nodeMouseEnter)="nodeMouseEnter.emit($event)"
            (nodeMouseMove)="nodeMouseMove.emit($event)"
            (nodeMouseLeave)="nodeMouseLeave.emit($event)"
          />
        </ng-flow-viewport>
        <ng-flow-selection-box (contextMenu)="selectionContextMenu.emit({ event: $event, nodes: store.selectedNodes() })" />
      </ng-flow-pane>
      <ng-content />
      <ng-flow-a11y-descriptions />
      @if (!hideAttribution()) {
        <ng-flow-attribution />
      }
      <div class="xy-flow__a11y-descriptions" aria-live="assertive" aria-atomic="true"
           style="position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); border: 0;">
        {{ store.ariaLiveMessage() }}
      </div>
    </div>
  `,
})
export class NgFlowComponent<NodeType extends Node = Node, EdgeType extends Edge = Edge>
  implements OnInit, AfterViewInit, OnDestroy
{
  readonly store = inject(FlowStore) as unknown as FlowStore<NodeType, EdgeType>;
  private readonly ngFlowService = inject(NgFlowService) as unknown as NgFlowService<NodeType, EdgeType>;
  private readonly zone = inject(NgZone);
  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  private readonly paneRef = viewChild(PaneComponent);

  /** Content-projected node type templates */
  private readonly nodeTypeDirectives = contentChildren(NgFlowNodeTypeDirective);

  /** Map of type name → TemplateRef built from content-projected templates */
  readonly nodeTemplateMap = computed(() => {
    const map = new Map<string, TemplateRef<any>>();
    for (const dir of this.nodeTypeDirectives()) {
      map.set(dir.type, dir.template);
    }
    return map;
  });

  private resizeObserver: ResizeObserver | null = null;
  private panZoomInstance: PanZoomInstance | null = null;
  private colorSchemeQuery: MediaQueryList | null = null;
  private colorSchemeHandler: ((e: MediaQueryListEvent) => void) | null = null;

  /** Resolves 'system' color mode to 'light' or 'dark' based on prefers-color-scheme. */
  private readonly systemPrefersDark = signal(
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  );

  readonly resolvedColorMode = computed(() => {
    const mode = this.colorMode();
    if (mode === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return mode;
  });

  // ── Data (model = two-way binding) ────────────────────────────────────
  readonly nodesModel = model<NodeType[]>([], { alias: 'nodes' });
  readonly edgesModel = model<EdgeType[]>([], { alias: 'edges' });
  readonly viewportModel = model<Viewport | undefined>(undefined, { alias: 'viewport' });

  // ── Data (input-only for uncontrolled mode) ───────────────────────────
  readonly defaultNodes = input<NodeType[]>();
  readonly defaultEdges = input<EdgeType[]>();
  readonly defaultViewport = input<Viewport>({ x: 0, y: 0, zoom: 1 });

  // ── Configuration inputs ──────────────────────────────────────────────
  readonly nodeTypes = input<NodeTypes>({});
  readonly edgeTypes = input<EdgeTypes>({});
  readonly defaultEdgeOptions = input<DefaultEdgeOptions>();

  readonly connectionMode = input<ConnectionMode>(ConnectionMode.Strict);
  readonly connectionLineType = input<ConnectionLineType>(ConnectionLineType.Bezier);
  readonly connectionLineComponent = input<Type<unknown> | null>(null);
  readonly connectionLineStyle = input<Partial<CSSStyleDeclaration>>();
  readonly connectionLineContainerStyle = input<Partial<CSSStyleDeclaration>>();

  readonly widthInput = input<number | undefined>(undefined, { alias: 'width' });
  readonly heightInput = input<number | undefined>(undefined, { alias: 'height' });

  // ── Interaction flags ─────────────────────────────────────────────────
  readonly nodesDraggable = input(true);
  readonly nodesConnectable = input(true);
  readonly nodesFocusable = input(true);
  readonly edgesFocusable = input(true);
  readonly edgesReconnectable = input(true);
  readonly elementsSelectable = input(true);
  readonly selectNodesOnDrag = input(true);
  readonly connectOnClick = input(true);

  // ── Pan/Zoom flags ────────────────────────────────────────────────────
  readonly panOnDrag = input<boolean | number[]>(true);
  readonly panOnScroll = input(false);
  readonly panOnScrollMode = input<PanOnScrollMode>(PanOnScrollMode.Free);
  readonly panOnScrollSpeed = input(0.5);
  readonly zoomOnScroll = input(true);
  readonly zoomOnPinch = input(true);
  readonly zoomOnDoubleClick = input(true);
  readonly preventScrolling = input(true);

  // ── Selection ─────────────────────────────────────────────────────────
  readonly selectionOnDrag = input(false);
  readonly selectionMode = input<SelectionMode>(SelectionMode.Full);

  // ── Viewport constraints ──────────────────────────────────────────────
  readonly minZoom = input(0.5);
  readonly maxZoom = input(2);
  readonly translateExtent = input<CoordinateExtent>(infiniteExtent);
  readonly nodeExtent = input<CoordinateExtent>(infiniteExtent);

  // ── Grid/Snap ─────────────────────────────────────────────────────────
  readonly snapToGrid = input(false);
  readonly snapGrid = input<SnapGrid>([15, 15]);

  // ── Fit view ──────────────────────────────────────────────────────────
  readonly fitView = input(false);
  readonly fitViewOptions = input<FitViewOptions<NodeType>>();

  // ── Keyboard keys ─────────────────────────────────────────────────────
  readonly deleteKeyCode = input<KeyCode | null>(['Backspace', 'Delete']);
  readonly selectionKeyCode = input<KeyCode | null>('Shift');
  readonly panActivationKeyCode = input<KeyCode | null>(' ');
  readonly multiSelectionKeyCode = input<KeyCode | null>(['Meta', 'Control']);
  readonly zoomActivationKeyCode = input<KeyCode | null>('Meta');

  // ── Auto-pan ──────────────────────────────────────────────────────────
  readonly autoPanOnNodeDrag = input(true);
  readonly autoPanOnConnect = input(true);
  readonly autoPanSpeed = input(15);

  // ── Distances ─────────────────────────────────────────────────────────
  readonly connectionRadius = input(20);
  readonly reconnectRadius = input(10);
  readonly nodeDragThreshold = input(1);
  readonly connectionDragThreshold = input(1);
  readonly paneClickDistance = input(0);
  readonly nodeClickDistance = input(0);

  // ── Appearance ────────────────────────────────────────────────────────
  readonly colorMode = input<ColorMode>('light');
  readonly elevateNodesOnSelect = input(true);
  readonly elevateEdgesOnSelect = input(false);
  readonly onlyRenderVisibleElements = input(false);
  readonly zIndexMode = input<ZIndexMode>('basic');
  readonly nodeOrigin = input<NodeOrigin>([0, 0]);
  readonly defaultMarkerColor = input<string | null>('#b1b1b7');

  // ── CSS class names ───────────────────────────────────────────────────
  readonly noDragClassName = input('nodrag');
  readonly noWheelClassName = input('nowheel');
  readonly noPanClassName = input('nopan');

  // ── Accessibility ─────────────────────────────────────────────────────
  readonly disableKeyboardA11y = input(false);
  readonly ariaLabelConfig = input<Partial<AriaLabelConfig>>();

  // ── Validation ────────────────────────────────────────────────────────
  readonly isValidConnection = input<IsValidConnection<EdgeType>>();

  // ── Pro ────────────────────────────────────────────────────────────────
  readonly proOptions = input<ProOptions>();
  readonly attributionPosition = input<PanelPosition>('bottom-right');
  readonly hideAttribution = input(false);

  // ── ID ────────────────────────────────────────────────────────────────
  readonly flowId = input<string | undefined>(undefined, { alias: 'id' });

  // ── Debug ─────────────────────────────────────────────────────────────
  readonly debug = input(false);

  // ── Event outputs ─────────────────────────────────────────────────────

  // State change events
  readonly nodesChange = output<NodeChange[]>({ alias: 'nodesChange' });
  readonly edgesChange = output<EdgeChange[]>({ alias: 'edgesChange' });

  // Init
  readonly init = output<NgFlowService<NodeType, EdgeType>>({ alias: 'init' });

  // Node events
  readonly nodeClick = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeClick' });
  readonly nodeDoubleClick = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeDoubleClick' });
  readonly nodeMouseEnter = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeMouseEnter' });
  readonly nodeMouseMove = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeMouseMove' });
  readonly nodeMouseLeave = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeMouseLeave' });
  readonly nodeContextMenu = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeContextMenu' });
  readonly nodeDragStart = output<{ event: MouseEvent; node: Node; nodes: Node[] }>({ alias: 'nodeDragStart' });
  readonly nodeDrag = output<{ event: MouseEvent; node: Node; nodes: Node[] }>({ alias: 'nodeDrag' });
  readonly nodeDragStop = output<{ event: MouseEvent; node: Node; nodes: Node[] }>({ alias: 'nodeDragStop' });

  // Edge events
  readonly edgeClick = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeClick' });
  readonly edgeDoubleClick = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeDoubleClick' });
  readonly edgeContextMenu = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeContextMenu' });
  readonly edgeMouseEnter = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeMouseEnter' });
  readonly edgeMouseMove = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeMouseMove' });
  readonly edgeMouseLeave = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeMouseLeave' });

  // Connection events
  readonly connect = output<Connection>({ alias: 'connect' });
  readonly connectStart = output<{ event: MouseEvent | TouchEvent; params: OnConnectStartParams }>({ alias: 'connectStart' });
  readonly connectEnd = output<MouseEvent | TouchEvent>({ alias: 'connectEnd' });

  // Click-connect events
  readonly clickConnectStart = output<{ event: MouseEvent; params: OnConnectStartParams }>({ alias: 'clickConnectStart' });
  readonly clickConnectEnd = output<MouseEvent>({ alias: 'clickConnectEnd' });

  // Reconnection events
  readonly reconnect = output<{ edge: Edge; connection: Connection }>({ alias: 'reconnect' });
  readonly reconnectStart = output<{ event: MouseEvent; edge: Edge; handleType: HandleType }>({ alias: 'reconnectStart' });
  readonly reconnectEnd = output<{ event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType; connectionState: FinalConnectionState }>({ alias: 'reconnectEnd' });

  // Pane events
  readonly paneClick = output<MouseEvent>({ alias: 'paneClick' });
  readonly paneContextMenu = output<MouseEvent>({ alias: 'paneContextMenu' });
  readonly paneMouseEnter = output<MouseEvent>({ alias: 'paneMouseEnter' });
  readonly paneMouseMove = output<MouseEvent>({ alias: 'paneMouseMove' });
  readonly paneMouseLeave = output<MouseEvent>({ alias: 'paneMouseLeave' });
  readonly paneScroll = output<WheelEvent | undefined>({ alias: 'paneScroll' });

  // Viewport events
  readonly moveStart = output<{ event: MouseEvent | TouchEvent | null; viewport: Viewport }>({ alias: 'moveStart' });
  readonly move = output<{ event: MouseEvent | TouchEvent | null; viewport: Viewport }>({ alias: 'move' });
  readonly moveEnd = output<{ event: MouseEvent | TouchEvent | null; viewport: Viewport }>({ alias: 'moveEnd' });
  readonly viewportChange = output<Viewport>({ alias: 'viewportChange' });

  // Selection events
  readonly selectionChange = output<{ nodes: Node[]; edges: Edge[] }>({ alias: 'selectionChange' });
  readonly selectionDragStart = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionDragStart' });
  readonly selectionDrag = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionDrag' });
  readonly selectionDragStop = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionDragStop' });
  readonly selectionStart = output<MouseEvent>({ alias: 'selectionStart' });
  readonly selectionEnd = output<MouseEvent>({ alias: 'selectionEnd' });
  readonly selectionContextMenu = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionContextMenu' });

  // Delete events
  readonly nodesDelete = output<Node[]>({ alias: 'nodesDelete' });
  readonly edgesDelete = output<Edge[]>({ alias: 'edgesDelete' });
  readonly deleteEvent = output<{ nodes: Node[]; edges: Edge[] }>({ alias: 'delete' });

  /**
   * Callback invoked before elements are deleted.
   * Return `false` (or a Promise resolving to `false`) to cancel the deletion.
   */
  readonly onBeforeDelete = input<((params: { nodes: NodeType[]; edges: EdgeType[] }) => boolean | Promise<boolean>) | undefined>(undefined);

  // Error
  readonly error = output<{ id: string; message: string }>({ alias: 'error' });

  // Auto-pan events (declared for API completeness; not yet wired because
  // auto-pan detection happens inside XYDrag's internal requestAnimationFrame
  // loop, which does not currently expose start/end callbacks)
  readonly autoPanStart = output<void>({ alias: 'autoPanStart' });
  readonly autoPanEnd = output<void>({ alias: 'autoPanEnd' });

  private lastNodesRef: NodeType[] | null = null;
  private lastEdgesRef: EdgeType[] | null = null;

  constructor() {
    // Sync inputs → store via effects.
    // Track last reference to avoid re-setting when the store already has the data
    // (e.g. after triggerNodeChanges internally calls setNodes, then the parent
    //  re-applies the same changes via onNodesChange → [nodes] → this effect).
    effect(() => {
      const nodes = this.nodesModel();
      if (nodes !== undefined && nodes !== this.lastNodesRef) {
        this.lastNodesRef = nodes;
        this.store.setNodes(nodes);
      }
    });

    effect(() => {
      const edges = this.edgesModel();
      if (edges !== undefined && edges !== this.lastEdgesRef) {
        this.lastEdgesRef = edges;
        this.store.setEdges(edges);
      }
    });

    // Sync configuration inputs → store
    effect(() => {
      this.store.nodesDraggable.set(this.nodesDraggable());
      this.store.nodesConnectable.set(this.nodesConnectable());
      this.store.nodesFocusable.set(this.nodesFocusable());
      this.store.edgesFocusable.set(this.edgesFocusable());
      this.store.edgesReconnectable.set(this.edgesReconnectable());
      this.store.elementsSelectable.set(this.elementsSelectable());
      this.store.selectNodesOnDrag.set(this.selectNodesOnDrag());
      this.store.connectOnClick.set(this.connectOnClick());
      this.store.connectionMode.set(this.connectionMode());
      this.store.snapToGrid.set(this.snapToGrid());
      this.store.snapGrid.set(this.snapGrid());
      this.store.nodeOrigin.set(this.nodeOrigin());
      this.store.nodeExtent.set(this.nodeExtent());
      this.store.elevateNodesOnSelect.set(this.elevateNodesOnSelect());
      this.store.elevateEdgesOnSelect.set(this.elevateEdgesOnSelect());
      this.store.connectionRadius.set(this.connectionRadius());
      this.store.connectionDragThreshold.set(this.connectionDragThreshold());
      this.store.nodeDragThreshold.set(this.nodeDragThreshold());
      this.store.paneClickDistance.set(this.paneClickDistance());
      this.store.nodeClickDistance.set(this.nodeClickDistance());
      this.store.autoPanOnConnect.set(this.autoPanOnConnect());
      this.store.autoPanOnNodeDrag.set(this.autoPanOnNodeDrag());
      this.store.autoPanSpeed.set(this.autoPanSpeed());
      this.store.noDragClassName.set(this.noDragClassName());
      this.store.noWheelClassName.set(this.noWheelClassName());
      this.store.noPanClassName.set(this.noPanClassName());
      this.store.debug.set(this.debug());
      this.store.zIndexMode.set(this.zIndexMode());
      this.store.onlyRenderVisibleElements.set(this.onlyRenderVisibleElements());
    });

    effect(() => {
      const id = this.flowId();
      if (id !== undefined) {
        this.store.rfId.set(id);
      }
    });

    effect(() => {
      const opts = this.defaultEdgeOptions();
      if (opts !== undefined) {
        this.store.defaultEdgeOptions.set(opts);
      }
    });

    effect(() => {
      const isValid = this.isValidConnection();
      this.store.isValidConnection.set(isValid);
    });

    effect(() => {
      this.store.onBeforeDelete = this.onBeforeDelete() ?? null;
    });

    effect(() => {
      this.store.setMinZoom(this.minZoom());
    });

    effect(() => {
      this.store.setMaxZoom(this.maxZoom());
    });

    effect(() => {
      this.store.setTranslateExtent(this.translateExtent());
    });

    // Re-sync pan/zoom options whenever the relevant inputs change.
    // NOTE: Do NOT read store.userSelectionActive() here — it changes on every
    // selection mousemove and would cause panZoomInstance.update() to be called
    // at high frequency. That property is synced in a separate effect below.
    effect(() => {
      // Read all pan/zoom inputs to establish signal dependencies
      this.panOnDrag();
      this.panOnScroll();
      this.panOnScrollMode();
      this.panOnScrollSpeed();
      this.zoomOnScroll();
      this.zoomOnPinch();
      this.zoomOnDoubleClick();
      this.preventScrolling();
      this.noPanClassName();
      this.noWheelClassName();
      this.paneClickDistance();
      this.updatePanZoomOptions();
    });

    // Sync userSelectionActive separately to avoid coupling it with the
    // high-cost pan-zoom options update above.
    effect(() => {
      const active = this.store.userSelectionActive();
      // PanZoomUpdateOptions requires all fields, but XYPanZoom.update()
      // only uses the provided fields at runtime. A partial update is safe
      // here because we only need to toggle d3-zoom's filter function.
      this.panZoomInstance?.update({ userSelectionActive: active } as any);
    });

    // Wire store change callbacks to outputs
    this.store.onNodesChange = (changes: NodeChange<NodeType>[]) => {
      this.nodesChange.emit(changes);
    };

    this.store.onEdgesChange = (changes: EdgeChange<EdgeType>[]) => {
      this.edgesChange.emit(changes);
    };

    // Wire connection callbacks
    this.store.onConnect = (connection: Connection) => {
      this.connect.emit(connection);
    };
    this.store.onConnectStart = (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      this.connectStart.emit({ event, params });
    };
    this.store.onConnectEnd = (event: MouseEvent | TouchEvent) => {
      this.connectEnd.emit(event);
    };
    this.store.onClickConnectStart = (event: MouseEvent, params: OnConnectStartParams) => {
      this.clickConnectStart.emit({ event, params });
    };
    this.store.onClickConnectEnd = (event: MouseEvent) => {
      this.clickConnectEnd.emit(event);
    };

    // Wire node drag callbacks so XYDrag can fire them for multi-node dragging
    this.store.onNodeDragStart = (event: MouseEvent, node: any, nodes: any[]) => {
      this.nodeDragStart.emit({ event, node, nodes });
    };
    this.store.onNodeDrag = (event: MouseEvent, node: any, nodes: any[]) => {
      this.nodeDrag.emit({ event, node, nodes });
    };
    this.store.onNodeDragStop = (event: MouseEvent, node: any, nodes: any[]) => {
      this.nodeDragStop.emit({ event, node, nodes });
    };
    this.store.onSelectionDragStart = (event: MouseEvent, nodes: any[]) => {
      this.selectionDragStart.emit({ event, nodes });
    };
    this.store.onSelectionDrag = (event: MouseEvent, nodes: any[]) => {
      this.selectionDrag.emit({ event, nodes });
    };
    this.store.onSelectionDragStop = (event: MouseEvent, nodes: any[]) => {
      this.selectionDragStop.emit({ event, nodes });
    };
  }

  ngOnInit(): void {
    // Handle uncontrolled mode
    const defaultN = this.defaultNodes();
    const defaultE = this.defaultEdges();
    if (defaultN || defaultE) {
      this.store.setDefaultNodesAndEdges(defaultN, defaultE);
    }

    // Bridge store errors to the (error) output. Preserve the default handler
    // (devWarn) so unbound consumers still see console warnings.
    const previousOnError = this.store.onError();
    this.store.onError.set((id, message) => {
      previousOnError?.(id, message);
      this.error.emit({ id, message });
    });

    // Queue fit view if requested
    if (this.fitView()) {
      this.store.fitViewQueued.set(true);
      this.store.fitViewOptions.set(this.fitViewOptions());
    }

    // Set up system color mode listener
    if (typeof window !== 'undefined') {
      this.colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.colorSchemeHandler = (e: MediaQueryListEvent) => {
        this.systemPrefersDark.set(e.matches);
      };
      this.colorSchemeQuery.addEventListener('change', this.colorSchemeHandler);
    }
  }

  ngAfterViewInit(): void {
    const containerEl = this.containerRef()?.nativeElement;
    if (!containerEl) return;

    this.store.domNode.set(containerEl);

    // Set up ResizeObserver for container dimensions
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.store.width.set(width);
        this.store.height.set(height);
      }
    });
    this.resizeObserver.observe(containerEl);

    // Initialize XYPanZoom
    this.initPanZoom(containerEl);

    // Initialize box selection listener (must be after panZoom so capture fires first)
    this.paneRef()?.initSelectionListener();

    // Perform fitView after a short delay to allow dimensions to settle
    if (this.fitView()) {
      setTimeout(() => {
        this.doFitView();
      }, 50);
    }

    // Emit init event
    this.init.emit(this.ngFlowService);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.panZoomInstance?.destroy();
    if (this.colorSchemeQuery && this.colorSchemeHandler) {
      this.colorSchemeQuery.removeEventListener('change', this.colorSchemeHandler);
    }
    this.store.reset();
  }

  private doFitView(): void {
    const nodes = this.store.nodes();
    if (nodes.length === 0) return;

    // Compute bounds from node positions (since nodes may not be measured yet)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const x = node.position.x;
      const y = node.position.y;
      const w = node.width ?? 150;
      const h = node.height ?? 40;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    const padding = this.fitViewOptions()?.padding ?? 0.1;
    const vp = getViewportForBounds(
      bounds,
      this.store.width(),
      this.store.height(),
      this.minZoom(),
      this.maxZoom(),
      padding
    );

    this.panZoomInstance?.setViewport(vp, { duration: 0 });
    this.store.transform.set([vp.x, vp.y, vp.zoom]);
  }

  private panePointerDownPos: { x: number; y: number } | null = null;

  onPanePointerDown(event: PointerEvent): void {
    this.panePointerDownPos = { x: event.clientX, y: event.clientY };
  }

  onPaneClick(event: MouseEvent): void {
    const threshold = this.paneClickDistance();
    if (threshold > 0 && this.panePointerDownPos) {
      const dx = event.clientX - this.panePointerDownPos.x;
      const dy = event.clientY - this.panePointerDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > threshold) return;
    }
    this.panePointerDownPos = null;

    // Don't deselect when clicking on nodes, edges, handles, or selection box (event bubbles up)
    const target = event.target as HTMLElement;
    if (target.closest('.xy-flow__node') || target.closest('.xy-flow__edge') ||
        target.closest('.xy-flow__handle') || target.closest('.xy-flow__selection')) {
      return;
    }

    // Don't deselect right after a selection drag ended (the click fires from mouseup)
    if (this.store.nodesSelectionActive()) {
      return;
    }

    this.store.resetSelectedElements();
    this.paneClick.emit(event);
  }

  onPaneContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.paneContextMenu.emit(event);
  }

  private initPanZoom(domNode: HTMLDivElement): void {
    const paneElement = domNode.querySelector('.xy-flow__pane') as Element;
    if (!paneElement) return;

    const panZoom = XYPanZoom({
      domNode: paneElement,
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      viewport: this.defaultViewport(),
      translateExtent: this.translateExtent(),
      onDraggingChange: (dragging: boolean) => {
        this.store.paneDragging.set(dragging);
      },
      onPanZoomStart: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        this.moveStart.emit({ event, viewport });
      },
      onPanZoom: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        this.zone.run(() => {
          const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
          this.store.transform.set(transform);
          this.store.bumpVersion();
          this.move.emit({ event, viewport });
          this.viewportChange.emit(viewport);
        });
      },
      onPanZoomEnd: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        this.moveEnd.emit({ event, viewport });
      },
    });

    this.panZoomInstance = panZoom;
    this.store.panZoom.set(panZoom);

    // Set initial transform from default viewport
    const dv = this.defaultViewport();
    this.store.transform.set([dv.x, dv.y, dv.zoom]);

    // Apply initial pan/zoom options
    this.updatePanZoomOptions();
  }

  private updatePanZoomOptions(): void {
    this.panZoomInstance?.update({
      panOnDrag: this.panOnDrag(),
      panOnScroll: this.panOnScroll(),
      panOnScrollMode: this.panOnScrollMode(),
      panOnScrollSpeed: this.panOnScrollSpeed(),
      zoomOnScroll: this.zoomOnScroll(),
      zoomOnPinch: this.zoomOnPinch(),
      zoomOnDoubleClick: this.zoomOnDoubleClick(),
      preventScrolling: this.preventScrolling(),
      noPanClassName: this.noPanClassName(),
      noWheelClassName: this.noWheelClassName(),
      lib: 'ng',
      onTransformChange: (transform: Transform) => {
        this.store.transform.set(transform);
      },
      paneClickDistance: this.paneClickDistance(),
    } as any);
  }
}
