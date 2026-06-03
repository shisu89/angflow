import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

type TeamNode = Node<{ label: string; team: 'red' | 'blue' }>;

@Component({
  selector: 'app-connection-validation-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Connection Validation"
      description="Use isValidConnection to reject invalid connects. Here, nodes are red or blue — connections are only allowed between teams."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [isValidConnection]="isValidConnection"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="legend">
            <div><span class="dot dot--red"></span> Red team</div>
            <div><span class="dot dot--blue"></span> Blue team</div>
            <div class="legend__hint">Red → Blue only</div>
          </div>
        </ng-flow-panel>
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
    .legend {
      background: #ffffff;
      padding: 10px 14px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
      font-size: 12px;
      color: #334155;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }
    .dot--red { background: #ef4444; }
    .dot--blue { background: #3b82f6; }
    .legend__hint {
      margin-top: 4px;
      font-size: 10px;
      color: #94a3b8;
    }
  `],
})
export class ConnectionValidationExampleComponent {
  nodes: TeamNode[] = [
    {
      id: 'r1',
      position: { x: 80, y: 60 },
      data: { label: 'Red 1', team: 'red' },
      style: { background: '#fee2e2', border: '2px solid #ef4444' },
    },
    {
      id: 'r2',
      position: { x: 80, y: 220 },
      data: { label: 'Red 2', team: 'red' },
      style: { background: '#fee2e2', border: '2px solid #ef4444' },
    },
    {
      id: 'b1',
      position: { x: 420, y: 60 },
      data: { label: 'Blue 1', team: 'blue' },
      style: { background: '#dbeafe', border: '2px solid #3b82f6' },
    },
    {
      id: 'b2',
      position: { x: 420, y: 220 },
      data: { label: 'Blue 2', team: 'blue' },
      style: { background: '#dbeafe', border: '2px solid #3b82f6' },
    },
  ];

  edges: Edge[] = [
    { id: 'er1-b1', source: 'r1', target: 'b1' },
  ];

  // Rejects connects between nodes of the same team.
  readonly isValidConnection = (conn: Connection | Edge): boolean => {
    const source = this.nodes.find((n) => n.id === conn.source);
    const target = this.nodes.find((n) => n.id === conn.target);
    if (!source || !target) return false;
    return source.data.team !== target.data.team;
  };

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes) as TeamNode[];
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
