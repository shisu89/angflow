import { Component, ChangeDetectionStrategy, viewChild } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  PanelComponent,
  BackgroundComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, NodeChange, EdgeChange } from '@angflow/angular';
import { layoutNodes } from '@angflow/angular/layout';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const INITIAL_NODES: Node[] = [
  { id: 'root', type: 'input', data: { label: 'goal' }, position: { x: 250, y: 0 } },
  { id: 'a', data: { label: 'idea a' }, position: { x: 60, y: 140 } },
  { id: 'b', data: { label: 'idea b' }, position: { x: 250, y: 140 } },
  { id: 'c', data: { label: 'idea c' }, position: { x: 440, y: 140 } },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e-root-a', source: 'root', target: 'a' },
  { id: 'e-root-b', source: 'root', target: 'b' },
  { id: 'e-root-c', source: 'root', target: 'c' },
];

@Component({
  selector: 'app-floating-tidy-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ControlsComponent, PanelComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Floating mode + tidy"
      description="edgeMode='floating' attaches edges by geometry (no handles), applyLayout(layoutNodes) tidies the graph, and [animate] tweens nodes (with edges tracking) plus fades new nodes in."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        edgeMode="floating"
        [animate]="animate"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="ft-panel">
            <button (click)="addNode()">add node</button>
            <button (click)="tidy('TB')">tidy ↓</button>
            <button (click)="tidy('LR')">tidy →</button>
            <label><input type="checkbox" [checked]="animate" (change)="toggleAnimate()" /> animate</label>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .ft-panel { display: flex; flex-direction: column; gap: 4px; }
    .ft-panel button, .ft-panel label {
      padding: 4px 10px; font-size: 12px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class FloatingTidyExampleComponent {
  private readonly flow = viewChild.required(NgFlowComponent);

  nodes: Node[] = [...INITIAL_NODES];
  edges: Edge[] = [...INITIAL_EDGES];
  animate = true;
  private counter = 0;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }

  addNode(): void {
    const parent = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    const id = `n${++this.counter}`;
    this.nodes = [
      ...this.nodes,
      { id, data: { label: `idea ${id}` }, position: { x: parent.position.x + 40, y: parent.position.y + 90 } },
    ];
    this.edges = [...this.edges, { id: `e-${parent.id}-${id}`, source: parent.id, target: id }];
  }

  tidy(direction: 'TB' | 'LR'): void {
    this.flow().service.applyLayout(layoutNodes, { direction });
  }

  toggleAnimate(): void { this.animate = !this.animate; }
}
