import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, BuiltInEdge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const NODE_BG = { background: 'rgba(255,255,255,0.5)' };

const NODES: Node[] = [
  { id:  '1', position: { x:  50, y: -100 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '2', position: { x: -100, y:   0 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id:  '3', position: { x: -100, y: 250 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '4', position: { x:  50, y: 150 }, data: { label: 'Target' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '5', position: { x: -100, y: 450 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '6', position: { x: 100, y: 400 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
  { id:  '7', position: { x: 100, y: 700 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '8', position: { x: -100, y: 600 }, data: { label: 'Target' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id:  '9', position: { x: 300, y:   0 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id: '10', position: { x: 600, y: 150 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id: '11', position: { x: 300, y: 300 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id: '12', position: { x: 600, y: 450 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id: '13', position: { x: 300, y: 600 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id: '14', position: { x: 600, y: 750 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id: '15', position: { x: 800, y:   0 }, data: { label: 'Source' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id: '16', position: { x: 950, y: 150 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
  { id: '17', position: { x: 800, y: 300 }, data: { label: 'Source' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id: '18', position: { x: 950, y: 450 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
  { id: '19', position: { x: 800, y: 600 }, data: { label: 'Source' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id: '20', position: { x: 950, y: 750 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
];

const EDGES: BuiltInEdge[] = [
  { id:  'e1-2', type: 'smoothstep', source:  '1', target:  '2', pathOptions: { offset: 30 }, interactionWidth: 0 },
  { id:  'e3-4', type: 'smoothstep', source:  '3', target:  '4', pathOptions: { borderRadius: 2 }, interactionWidth: 0 },
  { id:  'e4-5', type: 'smoothstep', source:  '5', target:  '6' },
  { id:  'e7-8', type: 'smoothstep', source:  '7', target:  '8' },
  { id: 'e9-10', type: 'smoothstep', source:  '9', target: '10', label: 'stepPosition: 0.2', pathOptions: { stepPosition: 0.2 }, interactionWidth: 0 },
  { id: 'e11-12', type: 'smoothstep', source: '11', target: '12', label: 'stepPosition: 0.5 (default)', pathOptions: { stepPosition: 0.5 }, interactionWidth: 0 },
  { id: 'e13-14', type: 'smoothstep', source: '13', target: '14', label: 'stepPosition: 0.8', pathOptions: { stepPosition: 0.8 }, interactionWidth: 0 },
  { id: 'e15-16', type: 'smoothstep', source: '15', target: '16', label: 'stepPosition: 0.2', pathOptions: { stepPosition: 0.2 }, interactionWidth: 0 },
  { id: 'e17-18', type: 'smoothstep', source: '17', target: '18', label: 'stepPosition: 0.5', pathOptions: { stepPosition: 0.5 }, interactionWidth: 0 },
  { id: 'e19-20', type: 'smoothstep', source: '19', target: '20', label: 'stepPosition: 0.8', pathOptions: { stepPosition: 0.8 }, interactionWidth: 0 },
];

const DEFAULT_EDGE_OPTIONS = {
  label: 'Edge Label',
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 1 },
};

@Component({
  selector: 'app-edge-routing-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Edge routing"
      description="Fine-grained control over smoothstep edge routing: offset, borderRadius, and stepPosition (where the bend falls along the edge)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [defaultEdgeOptions]="defaultEdgeOptions"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class EdgeRoutingExampleComponent {
  defaultEdgeOptions = DEFAULT_EDGE_OPTIONS;
  nodes: Node[] = NODES;
  edges: Edge[] = EDGES;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
