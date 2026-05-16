import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  viewChild,
  contentChildren,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Type,
  inject,
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

/**
 * Root component for an Angular Flow canvas. Renders nodes, edges, handles,
 * and the pan/zoom viewport; dispatches pointer, keyboard, and drag events;
 * and provides {@link FlowStore} and {@link NgFlowService} to descendant
 * plugin components like `<ng-flow-background>`, `<ng-flow-controls>`, and
 * `<ng-flow-minimap>`.
 *
 * `nodes`, `edges`, and `viewport` are controlled inputs — drive them by
 * pushing new arrays back in response to `(nodesChange)` / `(edgesChange)`
 * (paired with `applyNodeChanges` / `applyEdgeChanges`), or hand them off
 * via `defaultNodes` / `defaultEdges` (uncontrolled).
 *
 * @example
 * ```html
 * <ng-flow
 *   [nodes]="nodes"
 *   [edges]="edges"
 *   [fitView]="true"
 *   (nodesChange)="onNodesChange($event)"
 *   (edgesChange)="onEdgesChange($event)"
 *   (connect)="onConnect($event)"
 * >
 *   <ng-flow-background variant="dots" />
 *   <ng-flow-controls />
 *   <ng-flow-minimap />
 * </ng-flow>
 * ```
 */
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
    'style': 'display: block; position: relative; overflow: hidden; width: 100%; height: 100%; isolation: isolate;',
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

  // ── Data (controlled inputs paired with explicit change outputs) ──────

  /** Nodes to render. Pair with `(nodesChange)` and `applyNodeChanges` to keep in sync. */
  readonly nodesModel = input<NodeType[]>([] as unknown as NodeType[], { alias: 'nodes' });

  /** Edges to render. Pair with `(edgesChange)` and `applyEdgeChanges` to keep in sync. */
  readonly edgesModel = input<EdgeType[]>([] as unknown as EdgeType[], { alias: 'edges' });

  /** Current viewport (`{ x, y, zoom }`). Fires `(viewportChange)` on pan/zoom. */
  readonly viewportModel = input<Viewport | undefined>(undefined, { alias: 'viewport' });

  // ── Data (input-only for uncontrolled mode) ───────────────────────────

  /** Initial nodes for uncontrolled mode. Ignored when `[nodes]` is bound. */
  readonly defaultNodes = input<NodeType[]>();

  /** Initial edges for uncontrolled mode. Ignored when `[edges]` is bound. */
  readonly defaultEdges = input<EdgeType[]>();

  /** Initial viewport for uncontrolled mode. Defaults to `{ x: 0, y: 0, zoom: 1 }`. */
  readonly defaultViewport = input<Viewport>({ x: 0, y: 0, zoom: 1 });

  // ── Configuration inputs ──────────────────────────────────────────────

  /** Map of node `type` → Angular component (or `<ng-template ngFlowNodeType>`) used to render custom nodes. */
  readonly nodeTypes = input<NodeTypes>({});

  /** Map of edge `type` → Angular component used to render custom edges. */
  readonly edgeTypes = input<EdgeTypes>({});

  /** Shared defaults merged into every edge (e.g. `type`, `animated`, `markerEnd`). */
  readonly defaultEdgeOptions = input<DefaultEdgeOptions>();

  /**
   * Whether connections require a matching source/target pair.
   * `Strict` (default) enforces source→target; `Loose` allows any direction.
   */
  readonly connectionMode = input<ConnectionMode>(ConnectionMode.Strict);

  /** Path shape drawn while the user is dragging a connection. */
  readonly connectionLineType = input<ConnectionLineType>(ConnectionLineType.Bezier);

  /** Custom Angular component to render the in-progress connection line. */
  readonly connectionLineComponent = input<Type<unknown> | null>(null);

  /** Inline styles applied to the default connection-line SVG path. */
  readonly connectionLineStyle = input<Partial<CSSStyleDeclaration>>();

  /** Inline styles applied to the wrapper element around the connection line. */
  readonly connectionLineContainerStyle = input<Partial<CSSStyleDeclaration>>();

  /** Fixed pixel width for the canvas. If omitted, host stretches to its parent. */
  readonly widthInput = input<number | undefined>(undefined, { alias: 'width' });

  /** Fixed pixel height for the canvas. If omitted, host stretches to its parent. */
  readonly heightInput = input<number | undefined>(undefined, { alias: 'height' });

  // ── Interaction flags ─────────────────────────────────────────────────

  /** Whether nodes can be dragged. */
  readonly nodesDraggable = input(true);

  /** Whether handles accept new connections. */
  readonly nodesConnectable = input(true);

  /** Whether nodes are focusable via keyboard. */
  readonly nodesFocusable = input(true);

  /** Whether edges are focusable via keyboard. */
  readonly edgesFocusable = input(true);

  /** Whether an existing edge's endpoint can be dragged to a different handle. */
  readonly edgesReconnectable = input(true);

  /** Whether nodes and edges can be selected (clicked / box-selected). */
  readonly elementsSelectable = input(true);

  /** Whether clicking a node during drag selects it. */
  readonly selectNodesOnDrag = input(true);

  /** Whether click-to-connect is enabled as an alternative to drag-to-connect. */
  readonly connectOnClick = input(true);

  // ── Pan/Zoom flags ────────────────────────────────────────────────────

  /** Enable panning by dragging the pane. Pass `number[]` to restrict to specific mouse buttons. */
  readonly panOnDrag = input<boolean | number[]>(true);

  /** Pan the viewport with the scroll wheel instead of zooming. */
  readonly panOnScroll = input(false);

  /** Axis constraints for `panOnScroll` (`Free`, `Horizontal`, `Vertical`). */
  readonly panOnScrollMode = input<PanOnScrollMode>(PanOnScrollMode.Free);

  /** Multiplier for scroll-pan speed. */
  readonly panOnScrollSpeed = input(0.5);

  /** Enable zooming with the scroll wheel. */
  readonly zoomOnScroll = input(true);

  /** Enable pinch-to-zoom on touch devices. */
  readonly zoomOnPinch = input(true);

  /** Enable double-click to zoom in. */
  readonly zoomOnDoubleClick = input(true);

  /** Prevent the page from scrolling while the pointer is over the canvas. */
  readonly preventScrolling = input(true);

  // ── Selection ─────────────────────────────────────────────────────────

  /** Start a box-selection on plain drag (without holding the selection key). */
  readonly selectionOnDrag = input(false);

  /** Selection geometry: `Full` only selects fully contained nodes; `Partial` also selects those that overlap. */
  readonly selectionMode = input<SelectionMode>(SelectionMode.Full);

  // ── Viewport constraints ──────────────────────────────────────────────

  /** Minimum allowed zoom level. */
  readonly minZoom = input(0.5);

  /** Maximum allowed zoom level. */
  readonly maxZoom = input(2);

  /** `[[x1, y1], [x2, y2]]` extent the viewport can be panned within. */
  readonly translateExtent = input<CoordinateExtent>(infiniteExtent);

  /** `[[x1, y1], [x2, y2]]` extent node positions are clamped to. */
  readonly nodeExtent = input<CoordinateExtent>(infiniteExtent);

  // ── Grid/Snap ─────────────────────────────────────────────────────────

  /** Snap dragged nodes to `snapGrid`. */
  readonly snapToGrid = input(false);

  /** `[x, y]` grid size used when `snapToGrid` is `true`. */
  readonly snapGrid = input<SnapGrid>([15, 15]);

  // ── Fit view ──────────────────────────────────────────────────────────

  /** Fit all nodes into view on initial render. */
  readonly fitView = input(false);

  /** Options for the initial `fitView` call (padding, specific nodes, min/max zoom). */
  readonly fitViewOptions = input<FitViewOptions<NodeType>>();

  // ── Keyboard keys ─────────────────────────────────────────────────────

  /** Key(s) that delete selected elements. `null` disables the shortcut. */
  readonly deleteKeyCode = input<KeyCode | null>(['Backspace', 'Delete']);

  /** Key held to start a box-selection. `null` disables. */
  readonly selectionKeyCode = input<KeyCode | null>('Shift');

  /** Key held to temporarily enable panning. `null` disables. */
  readonly panActivationKeyCode = input<KeyCode | null>(' ');

  /** Key held to add to an existing selection instead of replacing it. `null` disables. */
  readonly multiSelectionKeyCode = input<KeyCode | null>(['Meta', 'Control']);

  /** Key held to enable zooming when it's otherwise disabled. `null` disables. */
  readonly zoomActivationKeyCode = input<KeyCode | null>('Meta');

  // ── Auto-pan ──────────────────────────────────────────────────────────

  /** Pan the viewport automatically when dragging a node near the edge. */
  readonly autoPanOnNodeDrag = input(true);

  /** Pan the viewport automatically when dragging a connection near the edge. */
  readonly autoPanOnConnect = input(true);

  /** Pixels-per-frame speed for auto-pan. */
  readonly autoPanSpeed = input(15);

  // ── Distances ─────────────────────────────────────────────────────────

  /** Radius (in px) within which a handle is considered a valid connection target. */
  readonly connectionRadius = input(20);

  /** Radius (in px) within which an edge endpoint is considered a valid reconnection target. */
  readonly reconnectRadius = input(10);

  /** Minimum pixels the pointer must travel before a node drag begins. */
  readonly nodeDragThreshold = input(1);

  /** Minimum pixels the pointer must travel before a connection drag begins. */
  readonly connectionDragThreshold = input(1);

  /** Maximum pixels between mousedown and mouseup that still count as a pane click. */
  readonly paneClickDistance = input(0);

  /** Maximum pixels between mousedown and mouseup that still count as a node click. */
  readonly nodeClickDistance = input(0);

  // ── Appearance ────────────────────────────────────────────────────────

  /** `'light'` | `'dark'` | `'system'`. When `'system'`, resolves via `prefers-color-scheme`. */
  readonly colorMode = input<ColorMode>('light');

  /** Raise a node's `z-index` when selected. */
  readonly elevateNodesOnSelect = input(true);

  /** Raise an edge's `z-index` when selected. */
  readonly elevateEdgesOnSelect = input(false);

  /** Skip rendering nodes/edges outside the viewport (expensive graphs benefit). */
  readonly onlyRenderVisibleElements = input(false);

  /** `'basic'` flat layering or `'auto'` based on selection and connection state. */
  readonly zIndexMode = input<ZIndexMode>('basic');

  /** `[x, y]` origin within a node that its `position` refers to (0 = top-left, 0.5 = center). */
  readonly nodeOrigin = input<NodeOrigin>([0, 0]);

  /** Default fill color for SVG edge markers. */
  readonly defaultMarkerColor = input<string | null>('#b1b1b7');

  // ── CSS class names ───────────────────────────────────────────────────

  /** Elements with this class prevent node dragging when interacted with. */
  readonly noDragClassName = input('nodrag');

  /** Elements with this class prevent wheel/pinch zooming when scrolled. */
  readonly noWheelClassName = input('nowheel');

  /** Elements with this class prevent pane panning when dragged. */
  readonly noPanClassName = input('nopan');

  // ── Accessibility ─────────────────────────────────────────────────────

  /** Disable all keyboard interaction (arrow-key move, delete, select-all). */
  readonly disableKeyboardA11y = input(false);

  /** Overrides for ARIA labels and live-region announcements. */
  readonly ariaLabelConfig = input<Partial<AriaLabelConfig>>();

  // ── Validation ────────────────────────────────────────────────────────

  /** Callback that decides whether a proposed `Connection` is allowed. */
  readonly isValidConnection = input<IsValidConnection<EdgeType>>();

  // ── Pro ────────────────────────────────────────────────────────────────

  /** Reserved options object (no-op in the open-source build). */
  readonly proOptions = input<ProOptions>();

  /** Where the library attribution badge is placed. */
  readonly attributionPosition = input<PanelPosition>('bottom-right');

  /** Hide the library attribution badge entirely. */
  readonly hideAttribution = input(false);

  // ── ID ────────────────────────────────────────────────────────────────

  /** Unique id for this flow instance; used to namespace DOM ids when mounting multiple flows. */
  readonly flowId = input<string | undefined>(undefined, { alias: 'id' });

  // ── Debug ─────────────────────────────────────────────────────────────

  /** Log internal state transitions to the console. */
  readonly debug = input(false);

  // ── Event outputs ─────────────────────────────────────────────────────

  /** Fires with an array of `NodeChange` whenever the internal node state is about to change. Apply with `applyNodeChanges`. */
  readonly nodesChange = output<NodeChange[]>({ alias: 'nodesChange' });

  /** Fires with an array of `EdgeChange` whenever the internal edge state is about to change. Apply with `applyEdgeChanges`. */
  readonly edgesChange = output<EdgeChange[]>({ alias: 'edgesChange' });

  /** Fires once after the pan/zoom viewport is initialized. Payload is the `NgFlowService` for imperative calls. */
  readonly init = output<NgFlowService<NodeType, EdgeType>>({ alias: 'init' });

  /** Single-click on a node. */
  readonly nodeClick = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeClick' });
  /** Double-click on a node. */
  readonly nodeDoubleClick = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeDoubleClick' });
  /** Pointer entered a node. */
  readonly nodeMouseEnter = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeMouseEnter' });
  /** Pointer moved over a node. */
  readonly nodeMouseMove = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeMouseMove' });
  /** Pointer left a node. */
  readonly nodeMouseLeave = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeMouseLeave' });
  /** Right-click on a node. */
  readonly nodeContextMenu = output<{ event: MouseEvent; node: Node }>({ alias: 'nodeContextMenu' });
  /** A node drag started. `nodes` contains all nodes being dragged (for multi-select). */
  readonly nodeDragStart = output<{ event: MouseEvent; node: Node; nodes: Node[] }>({ alias: 'nodeDragStart' });
  /** A node drag is in progress (fires per pointer move). */
  readonly nodeDrag = output<{ event: MouseEvent; node: Node; nodes: Node[] }>({ alias: 'nodeDrag' });
  /** A node drag ended. */
  readonly nodeDragStop = output<{ event: MouseEvent; node: Node; nodes: Node[] }>({ alias: 'nodeDragStop' });

  /** Single-click on an edge. */
  readonly edgeClick = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeClick' });
  /** Double-click on an edge. */
  readonly edgeDoubleClick = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeDoubleClick' });
  /** Right-click on an edge. */
  readonly edgeContextMenu = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeContextMenu' });
  /** Pointer entered an edge. */
  readonly edgeMouseEnter = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeMouseEnter' });
  /** Pointer moved over an edge. */
  readonly edgeMouseMove = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeMouseMove' });
  /** Pointer left an edge. */
  readonly edgeMouseLeave = output<{ event: MouseEvent; edge: Edge }>({ alias: 'edgeMouseLeave' });

  /** A new connection was completed. Pair with `addEdge` to append it to `edges`. */
  readonly connect = output<Connection>({ alias: 'connect' });
  /** A drag-to-connect started on a handle. */
  readonly connectStart = output<{ event: MouseEvent | TouchEvent; params: OnConnectStartParams }>({ alias: 'connectStart' });
  /** A drag-to-connect ended (regardless of whether it produced a valid connection). */
  readonly connectEnd = output<MouseEvent | TouchEvent>({ alias: 'connectEnd' });

  /** The first click of a click-to-connect interaction landed on a handle. */
  readonly clickConnectStart = output<{ event: MouseEvent; params: OnConnectStartParams }>({ alias: 'clickConnectStart' });
  /** The second click of a click-to-connect interaction landed (on any handle or elsewhere). */
  readonly clickConnectEnd = output<MouseEvent>({ alias: 'clickConnectEnd' });

  /** An existing edge was dragged to a new endpoint. Pair with `reconnectEdge` to update `edges`. */
  readonly reconnect = output<{ edge: Edge; connection: Connection }>({ alias: 'reconnect' });
  /** A reconnection drag on an edge endpoint started. */
  readonly reconnectStart = output<{ event: MouseEvent; edge: Edge; handleType: HandleType }>({ alias: 'reconnectStart' });
  /** A reconnection drag ended; includes the final `connectionState`. */
  readonly reconnectEnd = output<{ event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType; connectionState: FinalConnectionState }>({ alias: 'reconnectEnd' });

  /** Click on the empty pane (not on a node, edge, or handle). */
  readonly paneClick = output<MouseEvent>({ alias: 'paneClick' });
  /** Right-click on the empty pane. */
  readonly paneContextMenu = output<MouseEvent>({ alias: 'paneContextMenu' });
  /** Pointer entered the pane. */
  readonly paneMouseEnter = output<MouseEvent>({ alias: 'paneMouseEnter' });
  /** Pointer moved over the pane. */
  readonly paneMouseMove = output<MouseEvent>({ alias: 'paneMouseMove' });
  /** Pointer left the pane. */
  readonly paneMouseLeave = output<MouseEvent>({ alias: 'paneMouseLeave' });
  /** Scroll wheel on the pane (only fires when `panOnScroll` is enabled). */
  readonly paneScroll = output<WheelEvent | undefined>({ alias: 'paneScroll' });

  /** A pan/zoom interaction started. */
  readonly moveStart = output<{ event: MouseEvent | TouchEvent | null; viewport: Viewport }>({ alias: 'moveStart' });
  /** A pan/zoom interaction is in progress (fires per frame). */
  readonly move = output<{ event: MouseEvent | TouchEvent | null; viewport: Viewport }>({ alias: 'move' });
  /** A pan/zoom interaction ended. */
  readonly moveEnd = output<{ event: MouseEvent | TouchEvent | null; viewport: Viewport }>({ alias: 'moveEnd' });
  /** Fires with the new `Viewport` after any pan/zoom change. */
  readonly viewportChange = output<Viewport>({ alias: 'viewportChange' });

  /** Fires whenever the set of selected nodes/edges changes. */
  readonly selectionChange = output<{ nodes: Node[]; edges: Edge[] }>({ alias: 'selectionChange' });
  /** A drag of the current multi-selection started. */
  readonly selectionDragStart = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionDragStart' });
  /** A drag of the current multi-selection is in progress. */
  readonly selectionDrag = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionDrag' });
  /** A drag of the current multi-selection ended. */
  readonly selectionDragStop = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionDragStop' });
  /** A box-selection gesture started. */
  readonly selectionStart = output<MouseEvent>({ alias: 'selectionStart' });
  /** A box-selection gesture ended. */
  readonly selectionEnd = output<MouseEvent>({ alias: 'selectionEnd' });
  /** Right-click on the current multi-selection. */
  readonly selectionContextMenu = output<{ event: MouseEvent; nodes: Node[] }>({ alias: 'selectionContextMenu' });

  /** Fires with the set of nodes about to be deleted (after `onBeforeDelete` approved). */
  readonly nodesDelete = output<Node[]>({ alias: 'nodesDelete' });
  /** Fires with the set of edges about to be deleted. */
  readonly edgesDelete = output<Edge[]>({ alias: 'edgesDelete' });
  /** Combined `(delete)` output firing once with both deleted `nodes` and `edges`. */
  readonly deleteEvent = output<{ nodes: Node[]; edges: Edge[] }>({ alias: 'delete' });

  /**
   * Callback invoked before elements are deleted.
   * Return `false` (or a Promise resolving to `false`) to cancel the deletion.
   */
  readonly onBeforeDelete = input<((params: { nodes: NodeType[]; edges: EdgeType[] }) => boolean | Promise<boolean>) | undefined>(undefined);

  /** Fires when the store reports an internal validation or consistency error. */
  readonly error = output<{ id: string; message: string }>({ alias: 'error' });

  // Auto-pan events (declared for API completeness; not yet wired because
  // auto-pan detection happens inside XYDrag's internal requestAnimationFrame
  // loop, which does not currently expose start/end callbacks)
  /** Reserved — fires when auto-pan begins. Not yet wired. */
  readonly autoPanStart = output<void>({ alias: 'autoPanStart' });
  /** Reserved — fires when auto-pan ends. Not yet wired. */
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

    // Re-sync pan/zoom options whenever the relevant inputs change
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

    // Don't deselect right after a selection drag ended (the click fires from mouseup).
    // Clear the flag so the NEXT pane click can deselect normally — otherwise every
    // subsequent click would also be swallowed.
    if (this.store.nodesSelectionActive()) {
      this.store.nodesSelectionActive.set(false);
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
        const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
        this.store.transform.set(transform);
        this.store.bumpVersion();
        this.move.emit({ event, viewport });
        this.viewportChange.emit(viewport);
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
      userSelectionActive: this.store.userSelectionActive(),
      lib: 'ng',
      onTransformChange: (transform: Transform) => {
        this.store.transform.set(transform);
      },
      paneClickDistance: this.paneClickDistance(),
    } as any);
  }
}
