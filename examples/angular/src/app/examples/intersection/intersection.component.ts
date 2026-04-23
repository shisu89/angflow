import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-intersection-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Intersection"
      description="As you drag a node, other nodes it overlaps are highlighted. Also logs whether the node intersects an arbitrary fixed rect (0,0)-(100,100)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        [selectNodesOnDrag]="false"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeDrag)="onNodeDrag($event.node)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    :host ::ng-deep .xy-flow__node.highlight {
      box-shadow: 0 0 0 2px #f59e0b, 0 0 0 6px rgba(245, 158, 11, 0.25);
    }
  `],
})
export class IntersectionExampleComponent {
  private readonly flow = inject(NgFlowService);

  nodes: Node[] = [
    { id: '0', data: { label: 'rectangle' }, position: { x:   0, y:   0 }, width: 100, height: 100, draggable: false, style: { opacity: 0.5 } },
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x:   0, y:   0 }, width: 200, height: 100 },
    { id: '2', data: { label: 'Node 2' }, position: { x:   0, y: 150 } },
    { id: '3', data: { label: 'Node 3' }, position: { x: 250, y:   0 } },
    { id: '4', data: { label: 'Node'   }, position: { x: 350, y: 150 }, style: { width: 50, height: 50 } as any },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onNodeDrag(draggedNode: Node): void {
    const intersectingIds = new Set(this.flow.getIntersectingNodes(draggedNode).map((n) => n.id));
    const isIntersecting = this.flow.isNodeIntersecting(draggedNode, { x: 0, y: 0, width: 100, height: 100 });
    console.log('intersecting fixed rect:', isIntersecting);
    this.nodes = this.nodes.map((n) => ({
      ...n,
      className: intersectingIds.has(n.id) ? 'highlight' : '',
    }));
  }
}
