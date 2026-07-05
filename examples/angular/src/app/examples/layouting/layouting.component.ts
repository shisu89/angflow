import { Component, ChangeDetectionStrategy, viewChild } from '@angular/core';
import * as dagre from 'dagre';
import {
  NgFlowComponent,
  ControlsComponent,
  PanelComponent,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, CoordinateExtent, EdgeMarker } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const NODE_EXTENT: CoordinateExtent = [
  [0, 0],
  [1000, 1000],
];

const POSITION = { x: 0, y: 0 };

const INITIAL_NODES: Node[] = [
  { id: '1',  type: 'input',  data: { label: 'input'   }, position: POSITION },
  { id: '2',                  data: { label: 'node 2'  }, position: POSITION },
  { id: '2a',                 data: { label: 'node 2a' }, position: POSITION },
  { id: '2b',                 data: { label: 'node 2b' }, position: POSITION },
  { id: '2c',                 data: { label: 'node 2c' }, position: POSITION },
  { id: '2d',                 data: { label: 'node 2d' }, position: POSITION },
  { id: '3',                  data: { label: 'node 3'  }, position: POSITION },
  { id: '4',                  data: { label: 'node 4'  }, position: POSITION },
  { id: '5',                  data: { label: 'node 5'  }, position: POSITION },
  { id: '6',  type: 'output', data: { label: 'output'  }, position: POSITION },
  { id: '7',  type: 'output', data: { label: 'output'  }, position: { x: 400, y: 450 } },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e12',   source: '1',  target: '2',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e13',   source: '1',  target: '3',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e22a',  source: '2',  target: '2a', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e22b',  source: '2',  target: '2b', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e22c',  source: '2',  target: '2c', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e2c2d', source: '2c', target: '2d', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e45',   source: '4',  target: '5',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e56',   source: '5',  target: '6',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e57',   source: '5',  target: '7',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
];

@Component({
  selector: 'app-layouting-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ControlsComponent, PanelComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Layouting (dagre)"
      description="Auto-layout the graph with dagre. Toggle vertical / horizontal direction, refit the view (whole graph or just the first two nodes), unselect, and swap arrow / arrow-closed markers on every edge."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeExtent]="nodeExtent"
        (init)="onInit()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-right">
          <div class="lo-panel">
            <button (click)="layout('TB')">vertical layout</button>
            <button (click)="layout('LR')">horizontal layout</button>
            <button (click)="unselect()">unselect nodes</button>
            <button (click)="changeMarker()">change marker</button>
            <button (click)="fitAll()">fitView</button>
            <button (click)="fitFirstTwo()">fitView partially</button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .lo-panel {
      display: flex; flex-direction: column; gap: 4px;
    }
    .lo-panel button {
      padding: 4px 10px; font-size: 12px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class LayoutingExampleComponent {
  private readonly flow = viewChild.required(NgFlowComponent);

  readonly nodeExtent = NODE_EXTENT;

  nodes: Node[] = [...INITIAL_NODES];
  edges: Edge[] = [...INITIAL_EDGES];

  onInit(): void { this.layout('TB'); }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  layout(direction: 'TB' | 'LR'): void {
    const isHorizontal = direction === 'LR';
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: direction });

    for (const node of this.nodes) {
      graph.setNode(node.id, { width: 150, height: 50 });
    }
    for (const edge of this.edges) {
      graph.setEdge(edge.source, edge.target);
    }

    dagre.layout(graph);

    this.nodes = this.nodes.map((node) => {
      const positioned = graph.node(node.id);
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left  : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: { x: positioned.x, y: positioned.y },
      };
    });
  }

  unselect(): void {
    this.nodes = this.nodes.map((n) => ({ ...n, selected: false }));
  }

  changeMarker(): void {
    this.edges = this.edges.map((e) => ({
      ...e,
      markerEnd: {
        type: (e.markerEnd as EdgeMarker | undefined)?.type === MarkerType.Arrow
          ? MarkerType.ArrowClosed
          : MarkerType.Arrow,
      },
    }));
  }

  fitAll(): void { this.flow().service.fitView(); }

  fitFirstTwo(): void {
    this.flow().service.fitView({ nodes: this.nodes.slice(0, 2) });
  }
}
