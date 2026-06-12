import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

type Category = 'source' | 'process' | 'sink';
type CategoryNode = Node<{ label: string; category: Category }>;

const CATEGORY_COLORS: Record<Category, string> = {
  source: '#10b981',
  process: '#6366f1',
  sink: '#f59e0b',
};

@Component({
  selector: 'app-minimap-custom-example',
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
      title="MiniMap (custom)"
      description="Customize the MiniMap per-node with GetMiniMapNodeAttribute callbacks — here, each node's mini-map color reflects its category. (Note: rendering a fully custom node component inside the minimap is not yet wired in @angflow/angular; the React equivalent supports it.)"
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
        <ng-flow-minimap
          [nodeColor]="nodeColor"
          [nodeStrokeColor]="nodeColor"
          [nodeStrokeWidth]="3"
          [maskColor]="'rgba(15, 23, 42, 0.6)'"
        />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  `],
})
export class MinimapCustomExampleComponent {
  nodes: CategoryNode[] = [
    {
      id: 's1',
      position: { x: 40, y: 40 },
      data: { label: 'Source', category: 'source' },
      style: { background: '#d1fae5', border: '2px solid #10b981' },
    },
    {
      id: 'p1',
      position: { x: 240, y: 140 },
      data: { label: 'Process A', category: 'process' },
      style: { background: '#e0e7ff', border: '2px solid #6366f1' },
    },
    {
      id: 'p2',
      position: { x: 240, y: 280 },
      data: { label: 'Process B', category: 'process' },
      style: { background: '#e0e7ff', border: '2px solid #6366f1' },
    },
    {
      id: 'k1',
      position: { x: 480, y: 200 },
      data: { label: 'Sink', category: 'sink' },
      style: { background: '#fef3c7', border: '2px solid #f59e0b' },
    },
  ];

  edges: Edge[] = [
    { id: 'es-p1', source: 's1', target: 'p1', animated: true },
    { id: 'ep1-p2', source: 'p1', target: 'p2' },
    { id: 'ep2-k', source: 'p2', target: 'k1', animated: true },
  ];

  readonly nodeColor = (node: Node): string => {
    const cat = (node.data as { category?: Category } | undefined)?.category;
    return cat ? CATEGORY_COLORS[cat] : '#cbd5e1';
  };

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes) as CategoryNode[];
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
