import { Component, ChangeDetectionStrategy, inject, computed, input, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { getBezierPath, getSmoothStepPath, getStraightPath, ConnectionLineType, Position } from '@xyflow/system';
import { FlowStore } from '../../services/flow-store.service';

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
        <ng-container
          *ngComponentOutlet="customComponent(); inputs: connectionProps()"
        />
      } @else {
        <svg class="ng-flow__connectionline xy-flow__connectionline"
             style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;">
          <g>
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

  readonly customComponent = input<Type<any> | null>(null);
  readonly connectionLineType = input<ConnectionLineType>(ConnectionLineType.Bezier);

  readonly isConnecting = computed(() => {
    this.store.version();
    const conn = this.store.connection();
    return conn?.inProgress ?? false;
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

    const fromX = (conn as any).from?.x ?? 0;
    const fromY = (conn as any).from?.y ?? 0;
    const fromPosition = (conn as any).fromPosition ?? Position.Bottom;

    const toScreenX = (conn as any).to?.x ?? 0;
    const toScreenY = (conn as any).to?.y ?? 0;
    const transform = this.store.transform();
    const toX = (toScreenX - transform[0]) / transform[2];
    const toY = (toScreenY - transform[1]) / transform[2];

    const toPosition = (conn as any).toPosition ?? Position.Top;

    return {
      fromX, fromY, fromPosition,
      toX, toY, toPosition,
      fromNode: (conn as any).fromNode ?? null,
      fromHandle: (conn as any).fromHandle ?? null,
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
