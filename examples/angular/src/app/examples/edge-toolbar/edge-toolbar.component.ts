import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  EdgeToolbarComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '../../shell/example-card.component';

@Component({
  selector: 'app-edge-toolbar-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, EdgeToolbarComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Edge Toolbar"
      description="Click an edge to select it and reveal a floating toolbar at the edge midpoint."
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
        @for (edge of edges; track edge.id) {
          <ng-flow-edge-toolbar
            [edgeId]="edge.id"
            [x]="getEdgeCenterX(edge)"
            [y]="getEdgeCenterY(edge)"
          >
            <div class="edge-toolbar">
              <button class="edge-toolbar__btn" title="Info">i</button>
              <button class="edge-toolbar__btn edge-toolbar__btn--danger" title="Delete" (click)="deleteEdge(edge.id)">x</button>
            </div>
          </ng-flow-edge-toolbar>
        }
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .edge-toolbar {
      display: flex;
      gap: 4px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .edge-toolbar__btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      border: none;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      cursor: pointer;
    }
    .edge-toolbar__btn:hover { background: #e2e8f0; }
    .edge-toolbar__btn--danger { color: #dc2626; }
    .edge-toolbar__btn--danger:hover { background: #fef2f2; }
  `],
})
export class EdgeToolbarExampleComponent {
  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 0, y: 60 }, data: { label: 'Start' } },
    { id: '2', position: { x: 300, y: 0 }, data: { label: 'Process' } },
    { id: '3', position: { x: 300, y: 140 }, data: { label: 'Validate' } },
    { id: '4', type: 'output', position: { x: 600, y: 60 }, data: { label: 'End' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' },
  ];

  getEdgeCenterX(edge: Edge): number {
    const s = this.nodes.find(n => n.id === edge.source);
    const t = this.nodes.find(n => n.id === edge.target);
    if (!s || !t) return 0;
    // Source bottom-center, target top-center (default handle positions)
    const sx = s.position.x + 75; // node width ~150 / 2
    const tx = t.position.x + 75;
    return (sx + tx) / 2;
  }

  getEdgeCenterY(edge: Edge): number {
    const s = this.nodes.find(n => n.id === edge.source);
    const t = this.nodes.find(n => n.id === edge.target);
    if (!s || !t) return 0;
    const sy = s.position.y + 40; // source handle at bottom (node height ~40)
    const ty = t.position.y;       // target handle at top
    return (sy + ty) / 2;
  }

  deleteEdge(id: string): void {
    this.edges = this.edges.filter(e => e.id !== id);
  }

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
