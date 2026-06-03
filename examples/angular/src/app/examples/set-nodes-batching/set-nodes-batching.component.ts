import { Component, ChangeDetectionStrategy, viewChild } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const A: Node = { id: 'a', data: { label: 'A' }, position: { x: 250, y:   5 } };
const B: Node = { id: 'b', data: { label: 'B' }, position: { x: 100, y: 100 } };
const C: Node = { id: 'c', data: { label: 'C' }, position: { x: 400, y: 100 } };

@Component({
  selector: 'app-set-nodes-batching-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Set nodes batching"
      description="Dispatch many rapid node/edge mutations in a single synchronous burst. The store batches them into one render cycle so the flow stays responsive even under heavy programmatic updates."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="snb-panel">
            <button (click)="queueMultipleSetNodes()">queue multiple setNodes</button>
            <button (click)="queueMultipleUpdateNodes()">queue multiple updateNode</button>
            <button (click)="updateNodeDataBurst()">burst updateNodeData</button>
            <button (click)="updateEdgeBurst()">burst updateEdge</button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .snb-panel { display: flex; flex-direction: column; gap: 4px; }
    .snb-panel button {
      font-size: 12px; padding: 4px 8px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class SetNodesBatchingExampleComponent {
  private readonly flow = viewChild.required(NgFlowComponent);

  nodes: Node[] = [];
  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  queueMultipleSetNodes(): void {
    // Simulate the React example's 4 rapid setNodes by reassigning 4 times in a synchronous burst.
    this.nodes = [A];
    this.nodes = [...this.nodes, B];
    this.nodes = [...this.nodes, C];
    this.nodes = this.nodes.map((n) => n.id === 'a' ? { ...n, position: { x: n.position.x + 20, y: n.position.y + 20 } } : n);
    // Edges recreated (connect to form a path)
    this.edges = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-c', source: 'b', target: 'c' },
    ];
  }

  queueMultipleUpdateNodes(): void {
    this.queueMultipleSetNodes();
    const flow = this.flow().service;
    flow.updateNode('a', (n) => ({ position: { x: n.position.x + 20, y: n.position.y + 20 } }));
    flow.updateNode('b', (n) => ({ position: { x: n.position.x + 20, y: n.position.y + 20 } }));
    flow.updateNode('c', (n) => ({ position: { x: n.position.x + 20, y: n.position.y + 20 } }));
    flow.updateNode('a', (n) => ({ data: { ...n.data, label: `A ${Date.now()}` } }));
    flow.updateNode('b', (n) => ({ data: { ...n.data, label: `B ${Date.now()}` } }));
    flow.updateNode('c', (n) => ({ data: { ...n.data, label: `C ${Date.now()}` } }));
  }

  updateNodeDataBurst(): void {
    const flow = this.flow().service;
    this.nodes.forEach((n) => flow.updateNodeData(n.id, { label: 'node update' }));
  }

  updateEdgeBurst(): void {
    const flow = this.flow().service;
    this.edges.forEach((e) => flow.updateEdge(e.id, { label: 'edge update' }));
  }
}
