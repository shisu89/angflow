import { Component, ChangeDetectionStrategy, input, computed, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionLineType,
  Position,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

/**
 * Custom connection-line component rendered by the library via NgComponentOutlet
 * while the user drags a connection from a handle. The library passes these inputs:
 *   fromX, fromY, toX, toY, fromPosition, toPosition, connectionLineType, fromNode, fromHandle.
 *
 * The component renders its own <svg> wrapper because NgComponentOutlet places it
 * outside the default SVG (which only wraps the built-in renderer).
 */
@Component({
  selector: 'app-custom-connection-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents;' },
  template: `
    <svg
      style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;"
    >
      <g>
        <path
          fill="none"
          stroke="#222"
          stroke-width="1.5"
          class="animated"
          [attr.d]="path()"
        />
        <circle
          [attr.cx]="toX()"
          [attr.cy]="toY()"
          fill="#fff"
          r="3"
          stroke="#222"
          stroke-width="1.5"
        />
      </g>
    </svg>
  `,
})
export class CustomConnectionLineComponent {
  // Coordinate inputs — used in template
  readonly fromX = input<number>(0);
  readonly fromY = input<number>(0);
  readonly toX = input<number>(0);
  readonly toY = input<number>(0);

  // Additional inputs passed by the library — declared to avoid Angular unknown-input warnings
  readonly fromPosition = input<Position>(Position.Bottom);
  readonly toPosition = input<Position>(Position.Top);
  readonly connectionLineType = input<ConnectionLineType>(ConnectionLineType.Bezier);
  readonly fromNode = input<unknown>(null);
  readonly fromHandle = input<unknown>(null);

  readonly path = computed(() => {
    const fx = this.fromX(), fy = this.fromY(), tx = this.toX(), ty = this.toY();
    return `M${fx},${fy} C ${fx} ${ty} ${fx} ${ty} ${tx},${ty}`;
  });
}

@Component({
  selector: 'app-custom-connection-line-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom connection line"
      description="Render your own SVG while the user drags a connection. The connection-line component receives live from/to coordinates; here we draw a cubic Bezier with a white dot at the pointer tip."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [connectionLineComponent]="connectionLine"
        [connectionDragThreshold]="25"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="lines" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class CustomConnectionLineExampleComponent {
  readonly connectionLine: Type<unknown> = CustomConnectionLineComponent;

  nodes: Node[] = [
    { id: '1', type: 'default', data: { label: 'Node 1' }, position: { x: 250, y: 5 } },
  ];
  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
