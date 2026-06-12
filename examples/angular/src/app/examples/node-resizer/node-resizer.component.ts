import { Component, ChangeDetectionStrategy, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  NodeResizerComponent,
  BackgroundComponent,
  ControlsComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  injectNgFlowNode,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

interface ResizableData { label: string }

@Component({
  selector: 'app-resizable-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeResizerComponent],
  template: `
    <ng-flow-node-resizer
      [minWidth]="120"
      [minHeight]="60"
      [maxWidth]="520"
      [maxHeight]="320"
      color="#6366f1"
    />
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="resizable">
      <div class="resizable__header">{{ node.data()?.label ?? 'Resize me' }}</div>
      <div class="resizable__hint">Drag the corners</div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .resizable {
      width: 100%;
      height: 100%;
      background: #ffffff;
      border: 2px solid #6366f1;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px;
      font-family: inherit;
    }
    .resizable__header {
      font-size: 13px;
      font-weight: 700;
      color: #4338ca;
    }
    .resizable__hint {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 4px;
    }
  `],
})
export class ResizableNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<ResizableData>();
}

@Component({
  selector: 'app-node-resizer-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Node Resizer"
      description="Wrap any custom node with NodeResizerComponent to give it drag-to-resize handles. Min/max bounds are configurable."
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
export class NodeResizerExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    resizable: ResizableNodeComponent,
  };

  nodes: Node[] = [
    {
      id: '1',
      type: 'resizable',
      position: { x: 120, y: 120 },
      data: { label: 'Resizable box' },
      style: { width: '200px', height: '120px' },
    },
    {
      id: '2',
      type: 'resizable',
      position: { x: 440, y: 220 },
      data: { label: 'Also resizable' },
      style: { width: '220px', height: '150px' },
    },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
  ];

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
