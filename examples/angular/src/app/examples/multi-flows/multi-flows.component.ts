import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  MiniMapComponent,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const INITIAL_NODES = (): Node[] => [
  { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 }, className: 'light' },
  { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 }, className: 'light' },
  { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 }, className: 'light' },
  { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 }, className: 'light' },
];

const INITIAL_EDGES = (): Edge[] => [
  { id: 'e1-2', source: '1', target: '2', animated: true, markerEnd: { type: MarkerType.Arrow } },
  { id: 'e1-3', source: '1', target: '3' },
];

@Component({
  selector: 'app-single-mini-flow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, MiniMapComponent],
  template: `
    <ng-flow
      [nodes]="nodes"
      [edges]="edges"
      (nodesChange)="onNodesChange($event)"
      (edgesChange)="onEdgesChange($event)"
      (connect)="onConnect($event)"
    >
      <ng-flow-background />
      <ng-flow-minimap />
    </ng-flow>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class SingleMiniFlowComponent {
  nodes: Node[] = INITIAL_NODES();
  edges: Edge[] = INITIAL_EDGES();
  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}

@Component({
  selector: 'app-multi-flows-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SingleMiniFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Multi flows"
      description="Two independent ng-flow instances on the same page. Each has its own FlowStore (provided by the component's injector), so dragging nodes in one flow does not affect the other."
    >
      <div class="mf-grid">
        <app-single-mini-flow />
        <app-single-mini-flow />
      </div>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .mf-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      height: 100%; padding: 8px;
    }
    .mf-grid > * {
      border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;
    }
  `],
})
export class MultiFlowsExampleComponent {}
