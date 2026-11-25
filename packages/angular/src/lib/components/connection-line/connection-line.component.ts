import { Component, ChangeDetectionStrategy, inject, computed, input, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { getBezierPath, getSmoothStepPath, getStraightPath, getConnectionStatus, ConnectionLineType, Position, type ConnectionInProgress } from '@angflow/system';
import { FlowStore } from '../../services/flow-store.service';

/**
 * Renders the in-progress connection line while the user drags from a handle.
 * Rendered internally by `<ng-flow>`; you don't normally place this yourself —
 * configure via `[connectionLineType]` and `[connectionLineComponent]`.
 */
@Component({
  selector: 'ng-flow-connection-line',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'style': 'display: contents;',
  },
  template: `
    @if (isConnecting()) {
      @if (customComponent()) {
        <!-- Upstream wraps custom lines in the classed connection <g>. A custom line here is
             an Angular component that renders its own <svg>, so the classes go on a
             display: contents wrapper instead (an HTML host can't sit inside an SVG <g>). -->
        <div [attr.class]="connectionClass()" style="display: contents;">
          <ng-container
            *ngComponentOutlet="customComponent(); inputs: connectionProps()"
          />
        </div>
      } @else {
        <svg class="ng-flow__connectionline xy-flow__connectionline"
             style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;">
          <g [attr.class]="connectionClass()">
            <path
              class="ng-flow__connection-path xy-flow__connection-path"
              [attr.d]="connectionPath()"
              fill="none"
            />
          </g>
        </svg>
      }
    }
  `,
})
export class ConnectionLineComponent {
  readonly store = inject(FlowStore);

  /** Optional Angular component used instead of the default SVG path. */
  readonly customComponent = input<Type<unknown> | null>(null);
  /** Path shape when the default renderer is used. */
  readonly connectionLineType = input<ConnectionLineType>(ConnectionLineType.Bezier);

  readonly isConnecting = computed(() => {
    this.store.version();
    const conn = this.store.connection();
    return conn?.inProgress ?? false;
  });

  /** Upstream ConnectionLine `<g>` classes: `xy-flow__connection` plus the `valid`/`invalid` status. */
  readonly connectionClass = computed(() => {
    const conn = this.store.connection();
    const status = conn?.inProgress ? getConnectionStatus(conn.isValid) : null;
    return ['ng-flow__connection', 'xy-flow__connection', status].filter(Boolean).join(' ');
  });

  readonly connectionProps = computed(() => {
    const coords = this.connectionCoords();
    if (!coords) return {};
    return {
      fromX: coords.fromX,
      fromY: coords.fromY,
      toX: coords.toX,
      toY: coords.toY,
      fromPosition: coords.fromPosition,
      toPosition: coords.toPosition,
      connectionLineType: this.connectionLineType(),
      fromNode: coords.fromNode,
      fromHandle: coords.fromHandle,
    };
  });

  private readonly connectionCoords = computed(() => {
    this.store.version();
    const conn = this.store.connection();
    if (!conn?.inProgress) return null;

    const activeConn = conn as ConnectionInProgress;
    const fromX = activeConn.from?.x ?? 0;
    const fromY = activeConn.from?.y ?? 0;
    const fromPosition = activeConn.fromPosition ?? Position.Bottom;

    const toScreenX = activeConn.to?.x ?? 0;
    const toScreenY = activeConn.to?.y ?? 0;
    const transform = this.store.transform();
    const toX = (toScreenX - transform[0]) / transform[2];
    const toY = (toScreenY - transform[1]) / transform[2];

    const toPosition = activeConn.toPosition ?? Position.Top;

    // Enrich fromHandle with data from the registry (if present).
    let fromHandle = activeConn.fromHandle ?? null;
    if (fromHandle) {
      const data = this.store.getHandleData(fromHandle.nodeId, fromHandle.id ?? null, fromHandle.type);
      if (data !== undefined) {
        fromHandle = { ...fromHandle, data };
      }
    }

    return {
      fromX, fromY, fromPosition,
      toX, toY, toPosition,
      fromNode: activeConn.fromNode ?? null,
      fromHandle,
    };
  });

  readonly connectionPath = computed(() => {
    const coords = this.connectionCoords();
    if (!coords) return '';

    const params = {
      sourceX: coords.fromX,
      sourceY: coords.fromY,
      targetX: coords.toX,
      targetY: coords.toY,
      sourcePosition: coords.fromPosition,
      targetPosition: coords.toPosition,
    };

    const lineType = this.connectionLineType();

    switch (lineType) {
      case ConnectionLineType.Straight:
        return getStraightPath(params)[0];
      case ConnectionLineType.Step:
        return getSmoothStepPath({ ...params, borderRadius: 0 })[0];
      case ConnectionLineType.SmoothStep:
        return getSmoothStepPath(params)[0];
      case ConnectionLineType.Bezier:
      default:
        return getBezierPath(params)[0];
    }
  });
}
