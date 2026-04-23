import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  NgFlowComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, OnConnectStartParams } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

let nextId = 1;
const getId = () => `${nextId++}`;

@Component({
  selector: 'app-add-node-on-edge-drop-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Add node on edge drop"
      description="Drag an edge from a node's handle and drop it on the empty pane to create a new connected node at that position. Uses connectStart / connectEnd plus NgFlowService.screenToFlowPosition."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (connectStart)="onConnectStart($event)"
        (connectEnd)="onConnectEnd($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class AddNodeOnEdgeDropExampleComponent {
  private readonly flow = inject(NgFlowService);

  private connectingNodeId: string | null = null;

  nodes: Node[] = [
    { id: '0', type: 'input', data: { label: 'Node' }, position: { x: 0, y: 50 } },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }

  onConnect(connection: Connection): void {
    this.connectingNodeId = null;
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  onConnectStart(event: { event: MouseEvent | TouchEvent; params: OnConnectStartParams }): void {
    this.connectingNodeId = event.params.nodeId ?? null;
  }

  onConnectEnd(event: MouseEvent | TouchEvent): void {
    if (!this.connectingNodeId) return;
    const target = event.target as Element | null;
    if (!target?.classList?.contains('xy-flow__pane')) return;

    if (!('clientX' in event)) return;
    const me = event as MouseEvent;
    const pos = this.flow.screenToFlowPosition({ x: me.clientX, y: me.clientY });

    const id = getId();
    const newNode: Node = {
      id,
      position: pos,
      data: { label: `Node ${id}` },
      origin: [0.5, 0.0] as [number, number],
    };
    const newEdge: Edge = { id, source: this.connectingNodeId, target: id };

    this.nodes = [...this.nodes, newNode];
    this.edges = [...this.edges, newEdge];
    this.connectingNodeId = null;
  }
}
