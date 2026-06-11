import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  output,
  input,
  signal,
  reflectComponentType,
  Type,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import {
  getMarkerId,
  Position,
  XYHandle,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  getFloatingEndpoint,
  inferSide,
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
    @for (edge of visibleEdges(); track edge.id) {
      @if (!edge.hidden) {
      @let ei = getEdgeInputs(edge);
      <svg
        class="ng-flow__edge xy-flow__edge"
        [class]="getEdgeClasses(edge)"
        [class.selected]="edge.selected"
        [class.animated]="edge.animated"
        [class.selectable]="edge.selectable !== false"
        [class.updating]="hoveredAnchorEdgeId() === edge.id || reconnectingEdgeId() === edge.id"
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
            @if (reconnectingEdgeId() !== edge.id) {
              <path
                class="ng-flow__edge-path xy-flow__edge-path"
                [attr.d]="getEdgePath(ei)"
                [attr.marker-start]="ei['markerStart']"
                [attr.marker-end]="ei['markerEnd']"
                [attr.style]="getEdgePathStyle(edge)"
              />
            }
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
              (mouseenter)="hoveredAnchorEdgeId.set(edge.id)"
              (mouseleave)="onReconnectAnchorLeave(edge.id)"
            />
            <circle
              class="xy-flow__edgeupdater xy-flow__edgeupdater-target"
              [attr.cx]="shiftX(ei['targetX'], reconnectRadius(), ei['targetPosition'])"
              [attr.cy]="shiftY(ei['targetY'], reconnectRadius(), ei['targetPosition'])"
              [attr.r]="reconnectRadius()"
              stroke="transparent"
              fill="transparent"
              (mousedown)="onReconnectTargetMouseDown($event, edge)"
              (mouseenter)="hoveredAnchorEdgeId.set(edge.id)"
              (mouseleave)="onReconnectAnchorLeave(edge.id)"
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
    @for (edge of visibleEdges(); track edge.id) {
      @if (!edge.hidden && isCustomEdge(edge.type) && reconnectingEdgeId() !== edge.id) {
        @let ei = getEdgeInputs(edge);
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
            *ngComponentOutlet="getEdgeComponent(edge.type); inputs: getEdgeComponentInputs(edge, ei)"
          />
        </div>
      }
    }
    <div class="xy-flow__edgelabel-renderer" style="position: absolute; width: 100%; height: 100%; pointer-events: none; top: 0; left: 0;">
      @for (edge of visibleEdges(); track edge.id) {
        @if (edge.label && !edge.hidden) {
          @let ei = getEdgeInputs(edge);
          <div
            class="xy-flow__edge-label"
            [attr.data-id]="edge.id"
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

  /** Edge id whose reconnect anchor is currently hovered. Drives the `updating` style. */
  readonly hoveredAnchorEdgeId = signal<string | null>(null);
  /** Edge id currently being reconnected. The original path is hidden so the in-progress connection line is the only visible cue. */
  readonly reconnectingEdgeId = signal<string | null>(null);

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
    const edges = this.store.displayEdges();
    if (!this.store.onlyRenderVisibleElements()) return edges;
    const visibleNodeIds = new Set(this.store.visibleNodes().map((n) => n.id));
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  });

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

  private declaredInputsCache = new WeakMap<Type<unknown>, Set<string> | null>();

  /**
   * Filters `getEdgeInputs()` down to keys the custom edge component actually
   * declares as inputs. Without this, ngComponentOutlet throws NG0303 once per
   * undeclared key per render — components that only declare a subset (custom
   * edges typically only need geometry, data, markerEnd) would spam errors.
   */
  getEdgeComponentInputs(edge: Edge, all: Record<string, unknown>): Record<string, unknown> {
    const declared = this.getDeclaredInputs(this.getEdgeComponent(edge.type));
    if (!declared) return all;
    return Object.fromEntries(Object.entries(all).filter(([k]) => declared.has(k)));
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

  getEdgeInputs(edge: Edge): Record<string, any> {
    const sourceNode = this.store.nodeLookup.get(edge.source);
    const targetNode = this.store.nodeLookup.get(edge.target);

    const sourceHandle = sourceNode?.internals?.handleBounds?.source?.find(
      (h) => h.id === edge.sourceHandle || (!edge.sourceHandle && h.id === null)
    ) ?? sourceNode?.internals?.handleBounds?.source?.[0];

    const targetHandle = targetNode?.internals?.handleBounds?.target?.find(
      (h) => h.id === edge.targetHandle || (!edge.targetHandle && h.id === null)
    ) ?? targetNode?.internals?.handleBounds?.target?.[0];

    const enrichedSourceHandle = sourceHandle
      ? { ...sourceHandle, data: this.store.getHandleData(edge.source, sourceHandle.id ?? null, 'source') }
      : null;
    const enrichedTargetHandle = targetHandle
      ? { ...targetHandle, data: this.store.getHandleData(edge.target, targetHandle.id ?? null, 'target') }
      : null;

    const sourcePos = sourceNode?.internals?.positionAbsolute ?? sourceNode?.position ?? { x: 0, y: 0 };
    const targetPos = targetNode?.internals?.positionAbsolute ?? targetNode?.position ?? { x: 0, y: 0 };

    const sourceW = sourceNode?.measured?.width ?? sourceNode?.width ?? 150;
    const sourceH = sourceNode?.measured?.height ?? sourceNode?.height ?? 40;
    const targetW = targetNode?.measured?.width ?? targetNode?.width ?? 150;
    const targetH = targetNode?.measured?.height ?? targetNode?.height ?? 40;

    let sourceX: number, sourceY: number, targetX: number, targetY: number;
    let srcPos = sourceHandle?.position ?? (edge as Record<string, unknown>).sourcePosition as Position ?? Position.Bottom;
    let tgtPos = targetHandle?.position ?? (edge as Record<string, unknown>).targetPosition as Position ?? Position.Top;

    // Self-loops ignore floating and fall back to fixed-handle positions (geometric degeneracy).
    const isSelfLoop = edge.source === edge.target;
    // Global floating mode (edgeMode="floating" on <ng-flow>) floats every
    // endpoint regardless of handles; otherwise the per-handle flag decides.
    const floatingMode = this.store.edgeMode() === 'floating';
    const sourceFloating = !isSelfLoop && (floatingMode || sourceHandle?.floating === true);
    const targetFloating = !isSelfLoop && (floatingMode || targetHandle?.floating === true);

    const sourceRect = { x: sourcePos.x, y: sourcePos.y, width: sourceW, height: sourceH };
    const targetRect = { x: targetPos.x, y: targetPos.y, width: targetW, height: targetH };

    // Reference points: see spec section "Reference-point resolution".
    const sourceRef = targetFloating
      ? { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 }
      : targetHandle
        ? { x: targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2, y: targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2 }
        : { x: targetRect.x + targetRect.width / 2, y: targetRect.y };
    const targetRef = sourceFloating
      ? { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height / 2 }
      : sourceHandle
        ? { x: sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2, y: sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2 }
        : { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height };

    if (sourceFloating) {
      const p = getFloatingEndpoint(sourceRect, sourceRef);
      sourceX = p.x;
      sourceY = p.y;
      srcPos = inferSide(p, sourceRect);
    } else if (sourceHandle) {
      sourceX = sourcePos.x + sourceHandle.x + (sourceHandle.width ?? 0) / 2;
      sourceY = sourcePos.y + sourceHandle.y + (sourceHandle.height ?? 0) / 2;
    } else {
      sourceX = sourcePos.x + sourceW / 2;
      sourceY = sourcePos.y + sourceH;
    }

    if (targetFloating) {
      const p = getFloatingEndpoint(targetRect, targetRef);
      targetX = p.x;
      targetY = p.y;
      tgtPos = inferSide(p, targetRect);
    } else if (targetHandle) {
      targetX = targetPos.x + targetHandle.x + (targetHandle.width ?? 0) / 2;
      targetY = targetPos.y + targetHandle.y + (targetHandle.height ?? 0) / 2;
    } else {
      targetX = targetPos.x + targetW / 2;
      targetY = targetPos.y;
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
      markerStart: this.getMarkerUrl(edge.markerStart as EdgeMarker | undefined),
      markerEnd: this.getMarkerUrl(edge.markerEnd as EdgeMarker | undefined),
      interactionWidth: edge.interactionWidth,
      pathOptions: (edge as Record<string, unknown>).pathOptions,
      sourceHandleId: edge.sourceHandle,
      targetHandleId: edge.targetHandle,
      sourceHandle: enrichedSourceHandle,
      targetHandle: enrichedTargetHandle,
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
    return ((ei['sourceX'] as number) + (ei['targetX'] as number)) / 2;
  }

  getEdgeCenterY(ei: Record<string, unknown>): number {
    return ((ei['sourceY'] as number) + (ei['targetY'] as number)) / 2;
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

  onReconnectAnchorLeave(edgeId: string): void {
    if (this.hoveredAnchorEdgeId() === edgeId) this.hoveredAnchorEdgeId.set(null);
  }

  private handleEdgeReconnect(
    event: MouseEvent,
    edge: Edge,
    oppositeHandle: { nodeId: string; id: string | null; type: HandleType }
  ): void {
    const store = this.store;
    const isTarget = oppositeHandle.type === 'target';

    this.reconnectStart.emit({ event, edge, handleType: oppositeHandle.type });
    this.reconnectingEdgeId.set(edge.id);

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
        this.reconnectingEdgeId.set(null);
        this.hoveredAnchorEdgeId.set(null);
        this.reconnectEnd.emit({ event: evt, edge, handleType: oppositeHandle.type, connectionState });
      },
      onConnectionTargetChange: (nodeId: string | null) => {
        store.connectionTargetNodeId.set(nodeId);
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
