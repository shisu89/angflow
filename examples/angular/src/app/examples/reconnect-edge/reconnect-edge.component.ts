import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, HandleType, FinalConnectionState } from '@angflow/angular';
import { addEdge, reconnectEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-reconnect-edge-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Reconnect edge"
      description="Drag an existing edge endpoint onto a different handle to rewire it. Per-edge reconnectable lets you limit which side is rewireable (source, target, or both)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [snapToGrid]="true"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (reconnect)="onReconnect($event)"
        (reconnectStart)="onReconnectStart($event)"
        (reconnectEnd)="onReconnectEnd($event)"
      >
        <ng-flow-controls [showDelete]="true" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class ReconnectEdgeExampleComponent {
  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node A' }, position: { x: 250, y:   0 } },
    { id: '2',                data: { label: 'Node B' }, position: { x:  75, y:   0 } },
    { id: '3',                data: { label: 'Node C' }, position: { x: 400, y: 100 }, style: { background: '#D6D5E6', color: '#333', border: '1px solid #222138', width: 180 } as any },
    { id: '4',                data: { label: 'Node D' }, position: { x: -75, y: 100 } },
    { id: '5',                data: { label: 'Node E' }, position: { x: 150, y: 100 } },
    { id: '6',                data: { label: 'Node F' }, position: { x: 150, y: 250 } },
  ];

  edges: Edge[] = [
    { id: 'e1-3', source: '1', target: '3', label: 'This edge can only be updated from source', reconnectable: 'source' },
    { id: 'e2-4', source: '2', target: '4', label: 'This edge can only be updated from target', reconnectable: 'target' },
    { id: 'e5-6', source: '5', target: '6', label: 'This edge can be updated from both sides' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onReconnect(event: { edge: Edge; connection: Connection }): void {
    this.edges = reconnectEdge(event.edge, event.connection, this.edges) as Edge[];
  }

  onReconnectStart(event: { event: MouseEvent; edge: Edge; handleType: HandleType }): void {
    console.log(`start update ${event.handleType} handle`, event.edge);
  }

  onReconnectEnd(event: { event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType; connectionState: FinalConnectionState }): void {
    console.log(`end update ${event.handleType} handle`, event.edge);
  }
}
