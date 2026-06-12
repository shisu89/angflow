import { Component, ChangeDetectionStrategy, input, viewChild, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  ConnectionMode,
  ConnectionLineType,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge, reconnectEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-undirectional-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="source" id="top"    [position]="Position.Top" />
    <ng-flow-handle type="source" id="right"  [position]="Position.Right" />
    <ng-flow-handle type="source" id="bottom" [position]="Position.Bottom" />
    <ng-flow-handle type="source" id="left"   [position]="Position.Left" />
    <div class="und-node">{{ id() }}</div>
  `,
  styles: [`
    .und-node {
      padding: 10px 16px;
      background: #f0f9ff;
      border: 2px solid #38bdf8;
      border-radius: 6px;
      font-weight: 600;
      color: #0c4a6e;
      min-width: 32px;
      text-align: center;
    }
    :host ::ng-deep .xy-flow__handle { width: 8px; height: 8px; background: #0ea5e9; border: 2px solid #0369a1; opacity: 1; }
  `],
})
export class UndirectionalNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

let nextId = 4;
const genId = () => `${nextId++}`;

@Component({
  selector: 'app-undirectional-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Undirected connections"
      description="ConnectionMode.Loose lets any handle be a source or target. Click the background to drop a new node at that point; drag an edge endpoint onto another handle to reconnect it."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [connectionMode]="ConnectionMode.Loose"
        [connectionLineType]="ConnectionLineType.Bezier"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (reconnect)="onReconnect($event)"
        (paneClick)="onPaneClick($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class UndirectionalExampleComponent {
  readonly ConnectionMode = ConnectionMode;
  readonly ConnectionLineType = ConnectionLineType;

  private readonly flow = viewChild.required(NgFlowComponent);

  nodeTypes: Record<string, Type<unknown>> = { custom: UndirectionalNodeComponent };

  nodes: Node[] = [
    { id: '00', type: 'custom', position: { x: 300, y: 250 }, data: {} },
    { id: '01', type: 'custom', position: { x: 100, y:  50 }, data: {} },
    { id: '02', type: 'custom', position: { x: 500, y:  50 }, data: {} },
    { id: '03', type: 'custom', position: { x: 500, y: 500 }, data: {} },
    { id: '04', type: 'custom', position: { x: 100, y: 500 }, data: {} },
    { id: '10', type: 'custom', position: { x: 300, y:   5 }, data: {} },
    { id: '20', type: 'custom', position: { x: 600, y: 250 }, data: {} },
    { id: '30', type: 'custom', position: { x: 300, y: 600 }, data: {} },
    { id: '40', type: 'custom', position: { x:   5, y: 250 }, data: {} },
  ];

  edges: Edge[] = [
    { id: 'e0-1a', source: '00', target: '01', sourceHandle: 'left',   targetHandle: 'bottom', type: 'smoothstep' },
    { id: 'e0-1b', source: '00', target: '01', sourceHandle: 'top',    targetHandle: 'right',  type: 'smoothstep' },
    { id: 'e0-2a', source: '00', target: '02', sourceHandle: 'top',    targetHandle: 'left',   type: 'smoothstep' },
    { id: 'e0-2b', source: '00', target: '02', sourceHandle: 'right',  targetHandle: 'bottom', type: 'smoothstep' },
    { id: 'e0-3a', source: '00', target: '03', sourceHandle: 'right',  targetHandle: 'top',    type: 'smoothstep' },
    { id: 'e0-3b', source: '00', target: '03', sourceHandle: 'bottom', targetHandle: 'left',   type: 'smoothstep' },
    { id: 'e0-4a', source: '00', target: '04', sourceHandle: 'bottom', targetHandle: 'right',  type: 'smoothstep' },
    { id: 'e0-4b', source: '00', target: '04', sourceHandle: 'left',   targetHandle: 'top',    type: 'smoothstep' },
    { id: 'e0-10', source: '00', target: '10', sourceHandle: 'top',    targetHandle: 'bottom', type: 'smoothstep' },
    { id: 'e0-20', source: '00', target: '20', sourceHandle: 'right',  targetHandle: 'left',   type: 'smoothstep' },
    { id: 'e0-30', source: '00', target: '30', sourceHandle: 'bottom', targetHandle: 'top',    type: 'smoothstep' },
    { id: 'e0-40', source: '00', target: '40', sourceHandle: 'left',   targetHandle: 'right',  type: 'smoothstep' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onReconnect(event: { edge: Edge; connection: Connection }): void {
    this.edges = reconnectEdge(event.edge, event.connection, this.edges) as Edge[];
  }

  onPaneClick(event: MouseEvent): void {
    const flowPos = this.flow().service.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    this.nodes = [
      ...this.nodes,
      { id: genId(), type: 'custom', position: flowPos, origin: [0.5, 0.5], data: {} },
    ];
  }
}
