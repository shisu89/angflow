import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  NodeToolbarComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '../../shell/example-card.component';

@Component({
  selector: 'app-toolbar-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeToolbarComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-node-toolbar [position]="Position.Top">
      <div class="toolbar">
        <button class="toolbar__btn">Copy</button>
        <button class="toolbar__btn toolbar__btn--danger">Delete</button>
      </div>
    </ng-flow-node-toolbar>
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="node__body">{{ data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
  styles: [`
    .node__body {
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .toolbar {
      display: flex;
      gap: 4px;
      white-space: nowrap;
    }
    .toolbar__btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      background: #fff;
      color: #475569;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .toolbar__btn:hover { background: #f1f5f9; }
    .toolbar__btn--danger { color: #dc2626; }
    .toolbar__btn--danger:hover { background: #fef2f2; }
  `],
})
export class ToolbarNodeComponent {
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

@Component({
  selector: 'app-node-toolbar-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Node Toolbar"
      description="Select a node to reveal a floating toolbar positioned above it."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class NodeToolbarExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    toolbar: ToolbarNodeComponent,
  };

  nodes: Node[] = [
    { id: '1', type: 'toolbar', position: { x: 0, y: 60 }, data: { label: 'Node A' } },
    { id: '2', type: 'toolbar', position: { x: 280, y: 0 }, data: { label: 'Node B' } },
    { id: '3', type: 'toolbar', position: { x: 280, y: 120 }, data: { label: 'Node C' } },
    { id: '4', type: 'toolbar', position: { x: 560, y: 60 }, data: { label: 'Node D' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' },
  ];

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
