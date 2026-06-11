import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  untracked,
  viewChild,
  contentChildren,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Type,
  inject,
  DestroyRef,
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
  type Viewport,
  type CoordinateExtent,
  type NodeOrigin,
  type SnapGrid,
  type PanZoomInstance,
  type Transform,
  type KeyCode,
  type PanelPosition,
  type ProOptions,
  type ColorMode,
  type ZIndexMode,
  type AriaLabelConfig,
  type FinalConnectionState,
  type HandleType,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type OnConnectStartParams,
} from '@angflow/system';

import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { injectFlowStore, injectNgFlowService } from '../../utils/inject-flow-store';
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
  FitViewOptions,
  IsValidConnection,
} from '../../types';

const VIEWPORT_EPSILON = 1e-4;

function viewportsEqual(a: Viewport, b: Viewport): boolean {
  return (
    Math.abs(a.x - b.x) < VIEWPORT_EPSILON &&
    Math.abs(a.y - b.y) < VIEWPORT_EPSILON &&
    Math.abs(a.zoom - b.zoom) < VIEWPORT_EPSILON
  );
}

/**
 * Root component for an Angular Flow canvas. Renders nodes, edges, handles,
 * and the pan/zoom viewport; dispatches pointer, keyboard, and drag events;
 * and provides {@link FlowStore} and {@link NgFlowService} to descendant
 * plugin components like `<ng-flow-background>`, `<ng-flow-controls>`, and
 * `<ng-flow-minimap>`.
 *
 * `nodes`, `edges`, and `viewport` are input-bound — for controlled mode, bind
 * `[nodes]` / `[edges]` and re-assign them from `(nodesChange)` / `(edgesChange)`
 * after running the deltas through `applyNodeChanges` / `applyEdgeChanges`. For
 * uncontrolled mode hand off initial state via `defaultNodes` / `defaultEdges`.
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
  providers: [
    // Reuse a FlowStore/NgFlowService provided by an enclosing provider;
    // otherwise create our own. Reuse triggers for ANY ancestor that provides
    // FlowStore: <ng-flow-provider> is the supported pattern, but a root-level
    // FlowStore or a <ng-flow> rendered inside another flow's subtree would also
    // be reused. Factories run in an injection context, so `new NgFlowService()`
    // resolves its inject(FlowStore) against THIS injector — i.e. the
    // shared-or-fresh store below.
    {
      provide: FlowStore,
      useFactory: () => {
        const parentStore = inject(FlowStore, { optional: true, skipSelf: true });
        if (parentStore) return parentStore;
        const store = new FlowStore();
        // Node-injector useFactory providers don't get ngOnDestroy called
        // automatically — wire the tween/rAF cleanup and graph-state reset
        // explicitly. Only registered for the fresh branch: unmounting an inner
        // <ng-flow> in a provider context must NOT reset the shared store.
        inject(DestroyRef).onDestroy(() => {
          store.reset();
          store.ngOnDestroy();
        });
        return store;
      },
    },
    {
      // NgFlowService has no ngOnDestroy; its only cleanup self-registers via
      // the injected DestroyRef (keyPressed listeners). In the fresh branch that
      // DestroyRef belongs to this component's injector; in the reuse branch it
      // belongs to the provider's injector (which outlives this component).
      // Either way the cleanup fires at the right time — no extra wiring needed.
      provide: NgFlowService,
      useFactory: () =>
        inject(NgFlowService, { optional: true, skipSelf: true }) ?? new NgFlowService(),
    },
  ],
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
  readonly store = injectFlowStore<NodeType, EdgeType>();
  readonly service = injectNgFlowService<NodeType, EdgeType>();
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

  // ── Data (controlled-mode inputs; pair with the *Change outputs) ──────

  /** Nodes to render. Re-bind from `(nodesChange)` after running deltas through `applyNodeChanges` to stay in sync. */
  readonly nodesModel = input<NodeType[]>([] as unknown as NodeType[], { alias: 'nodes' });

  /** Edges to render. Re-bind from `(edgesChange)` after running deltas through `applyEdgeChanges` to stay in sync. */
  readonly edgesModel = input<EdgeType[]>([] as unknown as EdgeType[], { alias: 'edges' });

  /** Controlled viewport ({ x, y, zoom }). Re-bind from (viewportChange) to keep it in sync; equal values are not re-applied. */
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

  /** Pan the viewport automatically when a node receives keyboard focus. */
  readonly autoPanOnNodeFocus = input(true);

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

  /**
   * 'handles' (default): edges attach at declared handles. 'floating': edges
   * ignore handles and attach where the line to the peer node's center crosses
   * the node border — no handle boilerplate needed. Nodes without handles
   * cannot originate interactive drag-connections; declared handles still work
   * for starting connections in floating mode.
   */
  readonly edgeMode = input<'handles' | 'floating'>('handles');

  /**
   * Enable node animations: entry fade/scale for newly added nodes and smooth
   * position tweening for programmatic moves (`setNodePositions`,
   * `applyLayout`, the agent bridge's `layout_nodes`). Pass `{ duration }` to
   * change the default 300ms. Disabled automatically under
   * `prefers-reduced-motion`. Dragging is never animated.
   */
  readonly animate = input<boolean | { duration?: number }>(false);

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

    // Controlled viewport: apply [viewport] input changes to the store.
    // `untracked` keys this effect to the input only — tracking the store read
    // would re-run it on every user pan and fight the pointer. syncViewport
    // updates d3's internal transform without dispatching a zoom event, so
    // applying the input never re-emits (viewportChange); together with the
    // epsilon guard this prevents controlled-mode feedback loops.
    // NOTE: transform-only write — deliberately NO bumpVersion() (transform
    // consumers read transform() directly; see the version signal's contract).
    effect(() => {
      const vp = this.viewportModel();
      if (!vp) return;
      untracked(() => {
        if (viewportsEqual(vp, this.store.viewport())) return;
        this.store.transform.set([vp.x, vp.y, vp.zoom]);
        this.store.panZoom()?.syncViewport(vp);
      });
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
      this.store.autoPanOnNodeFocus.set(this.autoPanOnNodeFocus());
      this.store.noDragClassName.set(this.noDragClassName());
      this.store.noWheelClassName.set(this.noWheelClassName());
      this.store.noPanClassName.set(this.noPanClassName());
      this.store.debug.set(this.debug());
      this.store.zIndexMode.set(this.zIndexMode());
      this.store.onlyRenderVisibleElements.set(this.onlyRenderVisibleElements());
      this.store.edgeMode.set(this.edgeMode());
      this.store.animate.set(this.animate());
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

    // Sync registered type names → store for agent-bridge discovery.
    effect(() => {
      this.store.hostNodeTypeNames.set(Object.keys(this.nodeTypes()));
      this.store.hostEdgeTypeNames.set(Object.keys(this.edgeTypes()));
      this.store.contentNodeTemplateNames.set(Array.from(this.nodeTemplateMap().keys()));
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
      // userSelectionActive is consumed inside updatePanZoomOptions(); read it
      // here explicitly — the method body short-circuits while panZoomInstance
      // is null on first run, so the inner read never registers a dependency.
      this.store.userSelectionActive();
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

    // Queue fit view if requested. The store consumes the flag once nodes are
    // measured (setNodes / updateNodeInternals). With zero nodes it stays
    // queued: the default viewport is kept, and the first non-empty measured
    // setNodes still gets the initial fit.
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

    // Emit init event
    this.init.emit(this.service);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.panZoomInstance?.destroy();
    // panZoom is cleared for both branches (fresh-store and provider-reuse):
    // the XYPanZoom instance is owned by this component and is destroyed above,
    // so whatever store is in use must no longer reference it.
    // Graph state (nodes/edges/etc.) is reset only when this component owns the
    // store (fresh branch) — that is handled via the factory's DestroyRef
    // callback above. An enclosing provider's store keeps its graph state across
    // inner <ng-flow> unmounts, matching ReactFlow's provider semantics.
    this.store.panZoom.set(null);
    if (this.colorSchemeQuery && this.colorSchemeHandler) {
      this.colorSchemeQuery.removeEventListener('change', this.colorSchemeHandler);
    }
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
    // Consume the selectionInProgress flag so only THIS synthesised click is swallowed;
    // the next genuine pane click will proceed normally.
    // Ported from React's selectionInProgress ref (Pane/index.tsx).
    if (this.store.selectionInProgress()) {
      this.store.selectionInProgress.set(false);
      return;
    }

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

    const initialViewport = this.viewportModel() ?? this.defaultViewport();

    const panZoom = XYPanZoom({
      domNode: paneElement,
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      viewport: initialViewport,
      translateExtent: this.translateExtent(),
      onDraggingChange: (dragging: boolean) => {
        this.store.paneDragging.set(dragging);
      },
      onPanZoomStart: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        this.moveStart.emit({ event, viewport });
      },
      onPanZoom: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        const transform: Transform = [viewport.x, viewport.y, viewport.zoom];
        // Transform-only write: every transform consumer (viewport CSS
        // transform, minimap mask, culling, connection line) reads
        // this.transform() directly — bumping version here would dirty all
        // node/edge templates O(N+E) per pan frame for nothing.
        this.store.transform.set(transform);
        this.move.emit({ event, viewport });
        this.viewportChange.emit(viewport);
      },
      onPanZoomEnd: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
        this.moveEnd.emit({ event, viewport });
      },
    });

    this.panZoomInstance = panZoom;
    this.store.setPanZoom(panZoom);

    // Set initial transform from the resolved initial viewport
    this.store.transform.set([initialViewport.x, initialViewport.y, initialViewport.zoom]);

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
    });
  }
}
