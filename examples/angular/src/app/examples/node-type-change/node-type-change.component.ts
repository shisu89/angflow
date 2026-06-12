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
  selector: 'app-node-type-change-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Node type change"
      description="Programmatically swap a node's type at runtime. Click 'change type' to toggle the non-input node between 'default' and 'output'."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <button class="ntc-button" (click)="changeType()">change type</button>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .ntc-button {
      position: absolute; right: 10px; top: 10px; z-index: 4;
      padding: 6px 12px; font-size: 12px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class NodeTypeChangeExampleComponent {
  nodes: Node[] = [
    { id: '1', type: 'input',  sourcePosition: Position.Right, data: { label: 'Input' }, position: { x:   0, y:  80 } },
    { id: '2', type: 'output', sourcePosition: Position.Right, targetPosition: Position.Left, data: { label: 'A Node' }, position: { x: 250, y:   0 } },
  ];

  edges: Edge[] = [{ id: 'e1-2', source: '1', type: 'smoothstep', target: '2', animated: true }];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  changeType(): void {
    this.nodes = this.nodes.map((n) => {
      if (n.type === 'input') return n;
      return { ...n, type: n.type === 'default' ? 'output' : 'default' };
    });
  }
}
