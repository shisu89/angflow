import { Component, input } from '@angular/core';
import {
  NgFlowComponent,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  type Viewport,
} from '@angflow/angular';

export interface FlowConfig {
  nodes: Node[];
  edges: Edge[];
  nodeTypes?: NodeTypes;
  fitView?: boolean;
  deleteKeyCode?: string | string[] | null;
  multiSelectionKeyCode?: string | string[] | null;
  nodeDragThreshold?: number;
  minZoom?: number;
  maxZoom?: number;
  panOnScroll?: boolean;
  defaultViewport?: Viewport;
  autoPanOnConnect?: boolean;
  autoPanOnNodeDrag?: boolean;
}

@Component({
  selector: 'test-flow',
  standalone: true,
  imports: [NgFlowComponent],
  template: `
    <ng-flow
      [nodes]="nodes"
      [edges]="edges"
      [nodeTypes]="config().nodeTypes ?? {}"
      [fitView]="config().fitView ?? false"
      [deleteKeyCode]="config().deleteKeyCode ?? ['Backspace', 'Delete']"
      [multiSelectionKeyCode]="config().multiSelectionKeyCode ?? ['Meta', 'Control']"
      [nodeDragThreshold]="config().nodeDragThreshold ?? 1"
      [minZoom]="config().minZoom ?? 0.5"
      [maxZoom]="config().maxZoom ?? 2"
      [panOnScroll]="config().panOnScroll ?? false"
      [defaultViewport]="config().defaultViewport ?? { x: 0, y: 0, zoom: 1 }"
      [autoPanOnConnect]="config().autoPanOnConnect ?? true"
      [autoPanOnNodeDrag]="config().autoPanOnNodeDrag ?? true"
      (nodesChange)="onNodesChange($event)"
      (edgesChange)="onEdgesChange($event)"
      (connect)="onConnect($event)"
    />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class FlowComponent {
  readonly config = input.required<FlowConfig>();

  nodes: Node[] = [];
  edges: Edge[] = [];

  ngOnInit() {
    this.nodes = [...this.config().nodes];
    this.edges = [...this.config().edges];
  }

  onNodesChange(changes: any[]) {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]) {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection) {
    this.edges = addEdge(connection, this.edges);
  }
}
