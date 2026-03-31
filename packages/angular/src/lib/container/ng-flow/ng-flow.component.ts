import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  model,
  effect,
  viewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Type,
  inject,
  NgZone,
  signal,
  computed,
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
} from '@xyflow/system';

import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { NodeRendererComponent } from '../node-renderer/node-renderer.component';
import { EdgeRendererComponent } from '../edge-renderer/edge-renderer.component';
import { ViewportComponent } from '../viewport/viewport.component';
import { PaneComponent } from '../pane/pane.component';
import { ConnectionLineComponent } from '../../components/connection-line/connection-line.component';
import { SelectionBoxComponent } from '../../components/selection-box/selection-box.component';
import { KeyHandlerDirective } from '../../directives/key-handler.directive';
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
        (click)="paneClick.emit($event)"
        (contextmenu)="onPaneContextMenu($event)"
        (mouseenter)="paneMouseEnter.emit($event)"
        (mousemove)="paneMouseMove.emit($event)"
        (mouseleave)="paneMouseLeave.emit($event)"
        (selectionStart)="selectionStart.emit($event)"
        (selectionEnd)="selectionEnd.emit($event)"
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
            (nodeClick)="nodeClick.emit($event)"
            (nodeDoubleClick)="nodeDoubleClick.emit($event)"
            (nodeContextMenu)="nodeContextMenu.emit($event)"
            (nodeMouseEnter)="nodeMouseEnter.emit($event)"
            (nodeMouseMove)="nodeMouseMove.emit($event)"
            (nodeMouseLeave)="nodeMouseLeave.emit($event)"
            (nodeDragStart)="nodeDragStart.emit($event)"
            (nodeDrag)="nodeDrag.emit($event)"
            (nodeDragStop)="nodeDragStop.emit($event)"
          />
        </ng-flow-viewport>
        <ng-flow-selection-box />
      </ng-flow-pane>
      <ng-content />
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
  readonly nodesModel = model<NodeType[]>([] as unknown as NodeType[], { alias: 'nodes' });
  readonly edgesModel = model<EdgeType[]>([] as unknown as EdgeType[], { alias: 'edges' });
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
  readonly connectionLineComponent = input<Type<any> | null>(null);
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
  readonly selectionMode = input<SelectionMode>(SelectionMode.Partial);

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

  // ── ID ────────────────────────────────────────────────────────────────
  readonly flowId = input<string | undefined>(undefined, { alias: 'id' });

  // ── Debug ─────────────────────────────────────────────────────────────
  readonly debug = input(false);

  // ── Event outputs ─────────────────────────────────────────────────────

  // State change events
  readonly nodesChange = output<any[]>({ alias: 'nodesChange' });
  readonly edgesChange = output<any[]>({ alias: 'edgesChange' });

  // Init
  readonly init = output<NgFlowService<NodeType, EdgeType>>({ alias: 'init' });

  // Node events
  readonly nodeClick = output<{ event: MouseEvent; node: NodeType }>({ alias: 'nodeClick' });
  readonly nodeDoubleClick = output<{ event: MouseEvent; node: NodeType }>({ alias: 'nodeDoubleClick' });
  readonly nodeMouseEnter = output<{ event: MouseEvent; node: NodeType }>({ alias: 'nodeMouseEnter' });
  readonly nodeMouseMove = output<{ event: MouseEvent; node: NodeType }>({ alias: 'nodeMouseMove' });
  readonly nodeMouseLeave = output<{ event: MouseEvent; node: NodeType }>({ alias: 'nodeMouseLeave' });
  readonly nodeContextMenu = output<{ event: MouseEvent; node: NodeType }>({ alias: 'nodeContextMenu' });
  readonly nodeDragStart = output<{ event: MouseEvent; node: NodeType; nodes: NodeType[] }>({ alias: 'nodeDragStart' });
  readonly nodeDrag = output<{ event: MouseEvent; node: NodeType; nodes: NodeType[] }>({ alias: 'nodeDrag' });
  readonly nodeDragStop = output<{ event: MouseEvent; node: NodeType; nodes: NodeType[] }>({ alias: 'nodeDragStop' });

  // Edge events
  readonly edgeClick = output<{ event: MouseEvent; edge: EdgeType }>({ alias: 'edgeClick' });
  readonly edgeDoubleClick = output<{ event: MouseEvent; edge: EdgeType }>({ alias: 'edgeDoubleClick' });
  readonly edgeContextMenu = output<{ event: MouseEvent; edge: EdgeType }>({ alias: 'edgeContextMenu' });
  readonly edgeMouseEnter = output<{ event: MouseEvent; edge: EdgeType }>({ alias: 'edgeMouseEnter' });
  readonly edgeMouseMove = output<{ event: MouseEvent; edge: EdgeType }>({ alias: 'edgeMouseMove' });
  readonly edgeMouseLeave = output<{ event: MouseEvent; edge: EdgeType }>({ alias: 'edgeMouseLeave' });

  // Connection events
  readonly connect = output<Connection>({ alias: 'connect' });
  readonly connectStart = output<any>({ alias: 'connectStart' });
  readonly connectEnd = output<any>({ alias: 'connectEnd' });

  // Click-connect events
  readonly clickConnectStart = output<any>({ alias: 'clickConnectStart' });
  readonly clickConnectEnd = output<any>({ alias: 'clickConnectEnd' });

  // Reconnection events
  readonly reconnect = output<{ edge: EdgeType; connection: Connection }>({ alias: 'reconnect' });
  readonly reconnectStart = output<{ event: MouseEvent; edge: EdgeType; handleType: HandleType }>({ alias: 'reconnectStart' });
  readonly reconnectEnd = output<{ event: MouseEvent | TouchEvent; edge: EdgeType; handleType: HandleType; connectionState: FinalConnectionState }>({ alias: 'reconnectEnd' });

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
  readonly selectionChange = output<{ nodes: NodeType[]; edges: EdgeType[] }>({ alias: 'selectionChange' });
  readonly selectionDragStart = output<{ event: MouseEvent; nodes: NodeType[] }>({ alias: 'selectionDragStart' });
  readonly selectionDrag = output<{ event: MouseEvent; nodes: NodeType[] }>({ alias: 'selectionDrag' });
  readonly selectionDragStop = output<{ event: MouseEvent; nodes: NodeType[] }>({ alias: 'selectionDragStop' });
  readonly selectionStart = output<MouseEvent>({ alias: 'selectionStart' });
  readonly selectionEnd = output<MouseEvent>({ alias: 'selectionEnd' });
  readonly selectionContextMenu = output<{ event: MouseEvent; nodes: NodeType[] }>({ alias: 'selectionContextMenu' });

  // Delete events
  readonly nodesDelete = output<NodeType[]>({ alias: 'nodesDelete' });
  readonly edgesDelete = output<EdgeType[]>({ alias: 'edgesDelete' });
  readonly deleteEvent = output<{ nodes: NodeType[]; edges: EdgeType[] }>({ alias: 'delete' });

  /**
   * Callback invoked before elements are deleted.
   * Return `false` (or a Promise resolving to `false`) to cancel the deletion.
   */
  readonly onBeforeDelete = input<((params: { nodes: NodeType[]; edges: EdgeType[] }) => boolean | Promise<boolean>) | undefined>(undefined);

  // Error
  readonly error = output<{ id: string; message: string }>({ alias: 'error' });

  constructor() {
    // Sync inputs → store via effects
    effect(() => {
      const nodes = this.nodesModel();
      if (nodes !== undefined) {
        this.store.setNodes(nodes);
      }
    });

    effect(() => {
      const edges = this.edgesModel();
      if (edges !== undefined) {
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
      this.store.isValidConnection.set(isValid as any);
    });

    effect(() => {
      this.store.onBeforeDelete = this.onBeforeDelete() as any ?? null;
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

    // Wire store change callbacks to outputs
    this.store.onNodesChange = (changes: any[]) => {
      this.nodesChange.emit(changes);
    };

    this.store.onEdgesChange = (changes: any[]) => {
      this.edgesChange.emit(changes);
    };

    // Wire connection callbacks
    this.store.onConnect = (connection: any) => {
      this.connect.emit(connection);
    };
    this.store.onConnectStart = (event: any, params: any) => {
      this.connectStart.emit({ event, ...params });
    };
    this.store.onConnectEnd = (event: any) => {
      this.connectEnd.emit(event);
    };
    this.store.onClickConnectStart = (event: any, params: any) => {
      this.clickConnectStart.emit({ event, ...params });
    };
    this.store.onClickConnectEnd = (event: any) => {
      this.clickConnectEnd.emit(event);
    };
  }

  ngOnInit(): void {
    // Handle uncontrolled mode
    const defaultN = this.defaultNodes();
    const defaultE = this.defaultEdges();
    if (defaultN || defaultE) {
      this.store.setDefaultNodesAndEdges(defaultN, defaultE);
    }

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
      const w = (node as any).width ?? 150;
      const h = (node as any).height ?? 40;
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
      onPanZoomStart: (event: any, viewport: Viewport) => {
        this.moveStart.emit({ event, viewport });
      },
      onPanZoom: (event: any, viewport: Viewport) => {
        this.zone.run(() => {
          const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
          this.store.transform.set(transform);
          this.store.bumpVersion();
          this.move.emit({ event, viewport });
          this.viewportChange.emit(viewport);
        });
      },
      onPanZoomEnd: (event: any, viewport: Viewport) => {
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
      userSelectionActive: this.store.userSelectionActive(),
      lib: 'ng',
      onTransformChange: (transform: Transform) => {
        this.store.transform.set(transform);
      },
      paneClickDistance: this.paneClickDistance(),
    } as any);
  }
}
