import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-touch-device-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Touch device"
      description="Enlarged handle hit targets and touch-first event wiring. Try dragging connections on a touchscreen or with browser devtools touch emulation. The clickConnect events let you wire tap-to-connect UX."
    >
      <ng-flow
        class="touch-flow"
        [nodes]="nodes"
        [edges]="edges"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (connectStart)="log('connect start')"
        (connectEnd)="log('connect end')"
        (clickConnectStart)="log('click connect start')"
        (clickConnectEnd)="log('click connect end')"
      />
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    :host ::ng-deep .touch-flow .xy-flow__handle {
      width: 20px;
      height: 20px;
      border-width: 3px;
    }
  `],
})
export class TouchDeviceExampleComponent {
  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 100, y: 100 }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: '2', data: { label: 'Node 2' }, position: { x: 300, y: 100 }, sourcePosition: Position.Right, targetPosition: Position.Left },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  log(msg: string): void { console.log(msg); }
}
