import { Component, ChangeDetectionStrategy, Type, input, computed } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  EdgeToolbarComponent,
  BaseEdgeComponent,
  Position,
  getBezierPath,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

type EdgeData = {
  onDelete?: (id: string) => void;
} & Record<string, unknown>;

// Custom edge: renders the path via BaseEdge, and anchors the toolbar at the
// path's geometric center (labelX/labelY from getBezierPath). Mirrors the React
// EdgeToolbar pattern — the toolbar follows the actual edge midpoint instead of
// guessing from node dimensions.
@Component({
  selector: 'app-toolbar-edge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseEdgeComponent, EdgeToolbarComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-base-edge [path]="pathData().d" [markerEnd]="markerEnd()" />
    <ng-flow-edge-toolbar [edgeId]="id()!" [x]="pathData().labelX" [y]="pathData().labelY">
      <div class="edge-toolbar">
        <button class="edge-toolbar__btn" type="button" title="Info" aria-label="Edge info">i</button>
        <button
          class="edge-toolbar__btn edge-toolbar__btn--danger"
          type="button"
          title="Delete"
          aria-label="Delete edge"
          (click)="data()?.onDelete?.(id()!)"
        >x</button>
      </div>
    </ng-flow-edge-toolbar>
  `,
  styles: [`
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
      font-family: inherit;
    }
    .edge-toolbar__btn:hover { background: #e2e8f0; }
    .edge-toolbar__btn--danger { color: #dc2626; }
    .edge-toolbar__btn--danger:hover { background: #fef2f2; }
  `],
})
export class ToolbarEdgeComponent {
  readonly id = input<string>();
  readonly sourceX = input(0);
  readonly sourceY = input(0);
  readonly targetX = input(0);
  readonly targetY = input(0);
  readonly sourcePosition = input<Position>(Position.Bottom);
  readonly targetPosition = input<Position>(Position.Top);
  readonly markerEnd = input<string>();
  readonly data = input<EdgeData>();

  readonly pathData = computed(() => {
    const [d, labelX, labelY] = getBezierPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
      sourcePosition: this.sourcePosition(),
      targetPosition: this.targetPosition(),
    });
    return { d, labelX, labelY };
  });
}

@Component({
  selector: 'app-edge-toolbar-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Edge Toolbar"
      description="Click an edge to select it and reveal a floating toolbar at the edge midpoint. The toolbar position is computed from the edge path geometry, so it tracks the midpoint correctly regardless of node size."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [edgeTypes]="edgeTypes"
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
export class EdgeToolbarExampleComponent {
  readonly edgeTypes: Record<string, Type<unknown>> = {
    toolbar: ToolbarEdgeComponent,
  };

  private readonly edgeData: EdgeData = {
    onDelete: (id: string) => this.deleteEdge(id),
  };

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 0, y: 60 }, data: { label: 'Start' } },
    { id: '2', position: { x: 300, y: 0 }, data: { label: 'Process' } },
    { id: '3', position: { x: 300, y: 140 }, data: { label: 'Validate' } },
    { id: '4', type: 'output', position: { x: 600, y: 60 }, data: { label: 'End' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'toolbar', data: this.edgeData },
    { id: 'e1-3', source: '1', target: '3', type: 'toolbar', data: this.edgeData },
    { id: 'e2-4', source: '2', target: '4', type: 'toolbar', data: this.edgeData },
    { id: 'e3-4', source: '3', target: '4', type: 'toolbar', data: this.edgeData },
  ];

  deleteEdge(id: string): void {
    this.edges = this.edges.filter(e => e.id !== id);
  }

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge({ ...connection, type: 'toolbar', data: this.edgeData }, this.edges) as Edge[];
  }
}
