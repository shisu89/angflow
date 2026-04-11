import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  output,
  input,
  Type,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import {
  getMarkerId,
  MarkerType,
  Position,
  XYHandle,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeMarker,
  type HandleType,
  type Connection,
  type ConnectionState,
  type FinalConnectionState,
} from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';
import { BezierEdgeComponent } from '../../components/edges/bezier-edge.component';
import { StraightEdgeComponent } from '../../components/edges/straight-edge.component';
import { StepEdgeComponent } from '../../components/edges/step-edge.component';
import { SmoothStepEdgeComponent } from '../../components/edges/smooth-step-edge.component';
import { SimpleBezierEdgeComponent } from '../../components/edges/simple-bezier-edge.component';
import type { Edge, EdgeTypes } from '../../types';

const builtInEdgeTypeNames = new Set(['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier']);

const builtInEdgeTypes: EdgeTypes = {
  default: BezierEdgeComponent,
  bezier: BezierEdgeComponent,
  straight: StraightEdgeComponent,
  step: StepEdgeComponent,
  smoothstep: SmoothStepEdgeComponent,
  simplebezier: SimpleBezierEdgeComponent,
};

@Component({
  selector: 'ng-flow-edge-renderer',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ng-flow__edges xy-flow__edges',
    'style': 'position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;',
  },
  template: `
    <svg style="position: absolute; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
      <defs>
        @for (marker of markers(); track marker.id) {
          <marker
            [id]="marker.id"
            [attr.markerWidth]="marker.width ?? 12.5"
            [attr.markerHeight]="marker.height ?? 12.5"
            viewBox="-10 -10 20 20"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
            refX="0"
            refY="0"
          >
            <polyline
              class="xy-flow__arrowhead"
              [class.arrowclosed]="marker.type === 'arrowclosed'"
              [attr.stroke]="marker.color || 'currentColor'"
              [attr.fill]="marker.type === 'arrowclosed' ? (marker.color || 'currentColor') : 'none'"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1"
              points="-5,-4 0,0 -5,4"
            />
          </marker>
        }
      </defs>
    </svg>
    @for (item of visibleEdgesWithInputs(); track item.edge.id) {
      @let edge = item.edge;
      @let ei = item.ei;
      @if (!edge.hidden) {
      <svg
        class="ng-flow__edge xy-flow__edge"
        [class]="getEdgeClasses(edge)"
        [class.selected]="edge.selected"
        [class.animated]="edge.animated"
        [class.selectable]="edge.selectable !== false"
        [style.z-index]="getEdgeZIndex(edge)"
        [attr.aria-label]="getEdgeAriaLabel(edge)"
        [attr.tabindex]="store.edgesFocusable() ? 0 : -1"
        role="img"
        style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;"
        (keydown)="onEdgeKeyDown($event, edge)"
        (focus)="onEdgeFocus(edge)"
      >
        <g
          [attr.data-id]="edge.id"
          [class]="getEdgeGClasses(edge)"
          [attr.aria-label]="edge.ariaLabel ? edge.ariaLabel : undefined"
          style="pointer-events: visibleStroke;"
          (click)="onEdgeEvent($event, edge, 'click')"
          (dblclick)="onEdgeEvent($event, edge, 'dblclick')"
          (contextmenu)="onEdgeEvent($event, edge, 'contextmenu')"
          (mouseenter)="onEdgeEvent($event, edge, 'mouseenter')"
          (mousemove)="onEdgeEvent($event, edge, 'mousemove')"
          (mouseleave)="onEdgeEvent($event, edge, 'mouseleave')"
        >
          @if (isCustomEdge(edge.type)) {
            <!--
              For custom edges the visual (path + labels) is rendered in the
              HTML overlay layer below, because NgComponentOutlet creates the
              dynamic component's host in the XHTML namespace which breaks SVG
              child rendering. We still emit a transparent interaction path
              here so that pointer events (click/hover/etc.) fire on the
              existing SVG <g> event handlers.
            -->
            <path
              class="xy-flow__edge-interaction"
              [attr.d]="getEdgePath(ei)"
              fill="none"
              stroke="transparent"
              [attr.stroke-width]="edge.interactionWidth ?? 20"
              style="pointer-events: all;"
            />
          } @else {
            <path
              class="xy-flow__edge-interaction"
              [attr.d]="getEdgePath(ei)"
              fill="none"
              stroke="transparent"
              [attr.stroke-width]="edge.interactionWidth ?? 20"
              style="pointer-events: all;"
            />
            <path
              class="ng-flow__edge-path xy-flow__edge-path"
              [attr.d]="getEdgePath(ei)"
              [attr.marker-start]="ei['markerStart']"
              [attr.marker-end]="ei['markerEnd']"
              [attr.style]="getEdgePathStyle(edge)"
            />
          }
          @if (isEdgeReconnectable(edge)) {
            <circle
              class="xy-flow__edgeupdater xy-flow__edgeupdater-source"
              [attr.cx]="shiftX(ei['sourceX'], reconnectRadius(), ei['sourcePosition'])"
              [attr.cy]="shiftY(ei['sourceY'], reconnectRadius(), ei['sourcePosition'])"
              [attr.r]="reconnectRadius()"
              stroke="transparent"
              fill="transparent"
              (mousedown)="onReconnectSourceMouseDown($event, edge)"
            />
            <circle
              class="xy-flow__edgeupdater xy-flow__edgeupdater-target"
              [attr.cx]="shiftX(ei['targetX'], reconnectRadius(), ei['targetPosition'])"
              [attr.cy]="shiftY(ei['targetY'], reconnectRadius(), ei['targetPosition'])"
              [attr.r]="reconnectRadius()"
              stroke="transparent"
              fill="transparent"
              (mousedown)="onReconnectTargetMouseDown($event, edge)"
            />
          }
        </g>
      </svg>
      }
    }
    <!--
      HTML overlay for custom edges. Angular's NgComponentOutlet can only
      create host elements in the XHTML namespace, so rendering a custom
      edge directly inside an <svg> sub-tree breaks its <path> children.
      We render the dynamic component here in an HTML context and let
      BaseEdgeComponent wrap its paths in an inline <svg>. Pointer events
      are still handled on the SVG <g> layer above via a transparent
      interaction path, so this overlay is pointer-events: none.
    -->
    @for (item of visibleEdgesWithInputs(); track item.edge.id) {
      @let edge = item.edge;
      @let ei = item.ei;
      @if (!edge.hidden && isCustomEdge(edge.type)) {
        <div
          class="ng-flow__custom-edge"
          [style.position]="'absolute'"
          [style.top]="'0'"
          [style.left]="'0'"
          [style.width]="'100%'"
          [style.height]="'100%'"
          [style.pointer-events]="'none'"
          [style.z-index]="getEdgeZIndex(edge)"
        >
          <ng-container
            *ngComponentOutlet="getEdgeComponent(edge.type); inputs: ei"
          />
        </div>
      }
    }
    <div class="xy-flow__edgelabel-renderer" style="position: absolute; width: 100%; height: 100%; pointer-events: none; top: 0; left: 0;">
      @for (item of visibleEdgesWithInputs(); track item.edge.id) {
        @let edge = item.edge;
        @let ei = item.ei;
        @if (edge.label && !edge.hidden) {
          <div
            class="xy-flow__edge-label"
            [style.position]="'absolute'"
            [style.transform]="'translate(-50%, -50%) translate(' + getEdgeCenterX(ei) + 'px, ' + getEdgeCenterY(ei) + 'px)'"
            [style.pointer-events]="'all'"
          >
            {{ edge.label }}
          </div>
        }
      }
    </div>
  `,
})
export class EdgeRendererComponent {
  readonly store = inject(FlowStore);

  readonly reconnectRadius = input(10);

  readonly edgeClick = output<{ event: MouseEvent; edge: Edge }>();
  readonly edgeDoubleClick = output<{ event: MouseEvent; edge: Edge }>();
  readonly edgeContextMenu = output<{ event: MouseEvent; edge: Edge }>();
  readonly edgeMouseEnter = output<{ event: MouseEvent; edge: Edge }>();
  readonly edgeMouseMove = output<{ event: MouseEvent; edge: Edge }>();
  readonly edgeMouseLeave = output<{ event: MouseEvent; edge: Edge }>();
  readonly customEdgeTypes = input<EdgeTypes>({});

  readonly reconnect = output<{ edge: Edge; connection: Connection }>();
  readonly reconnectStart = output<{ event: MouseEvent; edge: Edge; handleType: HandleType }>();
  readonly reconnectEnd = output<{ event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType; connectionState: FinalConnectionState }>();

  readonly visibleEdges = computed(() => {
    const visibleIds = this.store.visibleEdgeIds();
    return this.store.edges().filter((e) => visibleIds.has(e.id));
  });

  /**
   * Pre-computes edge inputs once per render cycle so getEdgeInputs() is not
   * called redundantly in the three @for loops in the template.
   */
  readonly visibleEdgesWithInputs = computed(() =>
    this.visibleEdges().map((edge) => ({ edge, ei: this.getEdgeInputs(edge) }))
  );

  readonly markers = computed(() => {
    const edges = this.store.edges();
    const markerMap = new Map<string, Record<string, unknown>>();

    for (const edge of edges) {
      this.addMarker(markerMap, edge.markerStart as EdgeMarker | undefined);
      this.addMarker(markerMap, edge.markerEnd as EdgeMarker | undefined);
    }

    return Array.from(markerMap.values());
  });

  isCustomEdge(type?: string): boolean {
    const resolvedType = type || 'default';
    // It's custom if the user registered a type AND it's not a built-in name,
    // OR the user explicitly overrode a built-in name with their own component
    const customTypes = this.customEdgeTypes();
    return resolvedType in customTypes;
  }

  getEdgeClasses(edge: Edge): string {
    const typeClass = 'xy-flow__edge-' + (edge.type || 'default');
    return edge.className ? typeClass + ' ' + edge.className : typeClass;
  }

  getEdgeGClasses(edge: Edge): string {
    let cls = 'ng-flow__edge-wrapper';
    if (edge.selected) cls += ' selected';
    if (edge.animated) cls += ' animated';
    if (edge.className) cls += ' ' + edge.className;
    return cls;
  }

  getEdgePathStyle(edge: Edge): string | null {
    const style = edge.style as Record<string, string> | undefined;
    if (!style) return null;
    return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ');
  }

  getEdgeZIndex(edge: Edge): number {
    if (edge.zIndex !== undefined) return edge.zIndex;
    const sourceZ = this.store.nodeLookup.get(edge.source)?.internals?.z ?? 0;
    const targetZ = this.store.nodeLookup.get(edge.target)?.internals?.z ?? 0;
    return Math.max(sourceZ, targetZ);
  }

  getEdgePath(ei: Record<string, unknown>): string {
    const type = ei['type'] || 'default';
    const params = {
      sourceX: ei['sourceX'] as number,
      sourceY: ei['sourceY'] as number,
      targetX: ei['targetX'] as number,
      targetY: ei['targetY'] as number,
      sourcePosition: (ei['sourcePosition'] ?? Position.Bottom) as Position,
      targetPosition: (ei['targetPosition'] ?? Position.Top) as Position,
    };

    switch (type) {
      case 'straight':
        return getStraightPath(params)[0];
      case 'step':
        return getSmoothStepPath({ ...params, borderRadius: 0 })[0];
      case 'smoothstep':
        return getSmoothStepPath(params)[0];
      case 'default':
      case 'bezier':
      default:
        return getBezierPath(params)[0];
    }
  }

  getEdgeComponent(type?: string): Type<unknown> {
    const resolvedType = type || 'default';
    return this.customEdgeTypes()[resolvedType] ?? builtInEdgeTypes[resolvedType] ?? BezierEdgeComponent;
  }

  getEdgeInputs(edge: Edge): Record<string, any> {
    const sourceNode = this.store.nodeLookup.get(edge.source);
    const targetNode = this.store.nodeLookup.get(edge.target);

    const sourceHandle = sourceNode?.internals?.handleBounds?.source?.find(
      (h) => h.id === edge.sourceHandle || (!edge.sourceHandle && h.id === null)
    ) ?? sourceNode?.internals?.handleBounds?.source?.[0];

    const targetHandle = targetNode?.internals?.handleBounds?.target?.find(
      (h) => h.id === edge.targetHandle || (!edge.targetHandle && h.id === null)
    ) ?? targetNode?.internals?.handleBounds?.target?.[0];

    const sourcePos = sourceNode?.internals?.positionAbsolute ?? sourceNode?.position ?? { x: 0, y: 0 };
    const targetPos = targetNode?.internals?.positionAbsolute ?? targetNode?.position ?? { x: 0, y: 0 };

    const sourceW = sourceNode?.measured?.width ?? sourceNode?.width ?? 150;
    const sourceH = sourceNode?.measured?.height ?? sourceNode?.height ?? 40;
    const targetW = targetNode?.measured?.width ?? targetNode?.width ?? 150;
    const targetH = targetNode?.measured?.height ?? targetNode?.height ?? 40;

    let sourceX: number, sourceY: number, targetX: number, targetY: number;
    let srcPos = sourceHandle?.position ?? (edge as Record<string, unknown>).sourcePosition as Position ?? Position.Bottom;
    let tgtPos = targetHandle?.position ?? (edge as Record<string, unknown>).targetPosition as Position ?? Position.Top;

    if (sourceHandle) {
      sourceX = sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2;
      sourceY = sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2;
    } else {
      sourceX = sourcePos.x + sourceW / 2;
      sourceY = sourcePos.y + sourceH;
    }

    if (targetHandle) {
      targetX = targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2;
      targetY = targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2;
    } else {
      targetX = targetPos.x + targetW / 2;
      targetY = targetPos.y;
    }

    // Compute the geometrically correct label position using the path functions.
    // All path functions return [path, labelX, labelY, ...] so labelX/Y is the
    // actual midpoint along the curve, not the arithmetic midpoint of endpoints.
    const pathParams = {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: srcPos,
      targetPosition: tgtPos,
    };
    const edgeType = edge.type || 'default';
    let labelX: number;
    let labelY: number;
    switch (edgeType) {
      case 'straight': {
        const [, lx, ly] = getStraightPath(pathParams);
        labelX = lx;
        labelY = ly;
        break;
      }
      case 'step': {
        const [, lx, ly] = getSmoothStepPath({ ...pathParams, borderRadius: 0 });
        labelX = lx;
        labelY = ly;
        break;
      }
      case 'smoothstep': {
        const [, lx, ly] = getSmoothStepPath(pathParams);
        labelX = lx;
        labelY = ly;
        break;
      }
      case 'default':
      case 'bezier':
      default: {
        const [, lx, ly] = getBezierPath(pathParams);
        labelX = lx;
        labelY = ly;
        break;
      }
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
      selected: edge.selected ?? false,
      animated: edge.animated ?? false,
      label: edge.label,
      selectable: edge.selectable,
      deletable: edge.deletable,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: srcPos,
      targetPosition: tgtPos,
      labelX,
      labelY,
      markerStart: this.getMarkerUrl(edge.markerStart as EdgeMarker | undefined),
      markerEnd: this.getMarkerUrl(edge.markerEnd as EdgeMarker | undefined),
      interactionWidth: edge.interactionWidth,
      pathOptions: (edge as Record<string, unknown>).pathOptions,
      sourceHandleId: edge.sourceHandle,
      targetHandleId: edge.targetHandle,
    };
  }

  onEdgeEvent(event: MouseEvent, edge: Edge, eventType: string): void {
    switch (eventType) {
      case 'click':
        if (this.store.elementsSelectable()) {
          this.store.addSelectedEdges([edge.id]);
        }
        this.edgeClick.emit({ event, edge });
        break;
      case 'dblclick':
        this.edgeDoubleClick.emit({ event, edge });
        break;
      case 'contextmenu':
        this.edgeContextMenu.emit({ event, edge });
        break;
      case 'mouseenter':
        this.edgeMouseEnter.emit({ event, edge });
        break;
      case 'mousemove':
        this.edgeMouseMove.emit({ event, edge });
        break;
      case 'mouseleave':
        this.edgeMouseLeave.emit({ event, edge });
        break;
    }
  }

  onEdgeKeyDown(event: KeyboardEvent, edge: Edge): void {
    if (event.key === 'Escape') {
      this.store.unselectNodesAndEdges({ edges: [edge] });
    } else if (event.key === 'Enter') {
      if (this.store.elementsSelectable()) {
        this.store.addSelectedEdges([edge.id]);
      }
    }
  }

  onEdgeFocus(edge: Edge): void {
    if (this.store.elementsSelectable() && !edge.selected) {
      this.store.addSelectedEdges([edge.id]);
    }
  }

  getEdgeCenterX(ei: Record<string, unknown>): number {
    return ei['labelX'] as number;
  }

  getEdgeCenterY(ei: Record<string, unknown>): number {
    return ei['labelY'] as number;
  }

  getEdgeAriaLabel(edge: Edge): string {
    if (edge.ariaLabel) return edge.ariaLabel;
    return `Edge from ${edge.source} to ${edge.target}`;
  }

  isEdgeReconnectable(edge: Edge): boolean {
    if (edge.reconnectable !== undefined) return !!edge.reconnectable;
    return this.store.edgesReconnectable();
  }

  shiftX(x: number, shift: number, position: string): number {
    if (position === Position.Left) return x - shift;
    if (position === Position.Right) return x + shift;
    return x;
  }

  shiftY(y: number, shift: number, position: string): number {
    if (position === Position.Top) return y - shift;
    if (position === Position.Bottom) return y + shift;
    return y;
  }

  onReconnectSourceMouseDown(event: MouseEvent, edge: Edge): void {
    if (event.button !== 0) return;
    this.handleEdgeReconnect(event, edge, {
      nodeId: edge.target,
      id: edge.targetHandle ?? null,
      type: 'target',
    });
  }

  onReconnectTargetMouseDown(event: MouseEvent, edge: Edge): void {
    if (event.button !== 0) return;
    this.handleEdgeReconnect(event, edge, {
      nodeId: edge.source,
      id: edge.sourceHandle ?? null,
      type: 'source',
    });
  }

  private handleEdgeReconnect(
    event: MouseEvent,
    edge: Edge,
    oppositeHandle: { nodeId: string; id: string | null; type: HandleType }
  ): void {
    const store = this.store;
    const isTarget = oppositeHandle.type === 'target';

    this.reconnectStart.emit({ event, edge, handleType: oppositeHandle.type });

    XYHandle.onPointerDown(event, {
      autoPanOnConnect: store.autoPanOnConnect(),
      connectionMode: store.connectionMode(),
      connectionRadius: store.connectionRadius(),
      domNode: store.domNode(),
      handleId: oppositeHandle.id,
      nodeId: oppositeHandle.nodeId,
      nodeLookup: store.nodeLookup,
      isTarget,
      edgeUpdaterType: oppositeHandle.type,
      lib: 'ng',
      flowId: store.rfId(),
      cancelConnection: () => store.cancelConnection(),
      panBy: (delta: { x: number; y: number }) => store.panBy(delta),
      updateConnection: (conn: ConnectionState) => store.updateConnection(conn),
      getTransform: () => store.transform(),
      getFromHandle: () => {
        const conn = store.connection();
        return conn.inProgress ? conn.fromHandle : null;
      },
      autoPanSpeed: store.autoPanSpeed(),
      dragThreshold: store.connectionDragThreshold(),
      handleDomNode: event.currentTarget as Element,
      isValidConnection: store.isValidConnection(),
      onConnect: (connection: Connection) => {
        this.reconnect.emit({ edge, connection });
      },
      onReconnectEnd: (evt: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
        this.reconnectEnd.emit({ event: evt, edge, handleType: oppositeHandle.type, connectionState });
      },
    } as any);
  }

  private addMarker(map: Map<string, Record<string, unknown>>, marker: EdgeMarker | undefined): void {
    if (!marker || typeof marker === 'string') return;
    const id = getMarkerId(marker, this.store.rfId());
    if (!map.has(id)) {
      map.set(id, { ...marker, id });
    }
  }

  private getMarkerUrl(marker: EdgeMarker | string | undefined): string | undefined {
    if (!marker) return undefined;
    if (typeof marker === 'string') return marker;
    return `url('#${getMarkerId(marker, this.store.rfId())}')`;
  }
}
