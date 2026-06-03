import { Component, ChangeDetectionStrategy, signal, viewChild, effect } from '@angular/core';
import {
  NgFlowComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-update-node-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Update node"
      description="Edit a node's label, background, and hidden state through form controls. Demonstrates NgFlowService.updateNode() — mutations run through the store and keep reactivity intact."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <div class="un-panel">
          <label class="row"><span>label</span>
            <input [value]="nodeName()" (input)="setLabel($event)" />
          </label>
          <label class="row"><span>background</span>
            <input [value]="nodeBg()" (input)="setBg($event)" />
          </label>
          <label class="row"><span>hidden</span>
            <input type="checkbox" [checked]="nodeHidden()" (change)="setHidden($event)" />
          </label>
          <button (click)="bumpPosition()">update position</button>
        </div>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .un-panel {
      position: absolute; top: 10px; left: 10px; z-index: 4;
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 12px; background: #ffffffcc; backdrop-filter: blur(4px);
      border-radius: 6px; font-size: 12px; color: #334155;
    }
    .un-panel .row { display: flex; align-items: center; gap: 8px; }
    .un-panel .row span { min-width: 80px; }
    .un-panel input[type="text"],
    .un-panel input:not([type]) { padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; }
    .un-panel button { padding: 4px 8px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer; }
  `],
})
export class UpdateNodeExampleComponent {
  // Non-required: viewChild signals resolve after the view is created, but
  // constructor effects flush their first tick before that. Guarding with `?.`
  // and bailing on the first tick is simpler than wrapping every effect in
  // afterNextRender.
  private readonly flow = viewChild(NgFlowComponent);

  readonly nodeName = signal('Node 1');
  readonly nodeBg = signal('#eee');
  readonly nodeHidden = signal(false);

  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, style: { backgroundColor: '#eee' }, position: { x: 100, y: 100 } },
    { id: '2', data: { label: 'Node 2' }, position: { x: 100, y: 200 } },
  ];

  edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

  constructor() {
    effect(() => {
      const label = this.nodeName();
      const service = this.flow()?.service;
      if (!service) return;
      service.updateNode('1', (n) => ({ data: { ...n.data, label } }));
    });
    effect(() => {
      const bg = this.nodeBg();
      const service = this.flow()?.service;
      if (!service) return;
      service.updateNode('1', (n) => ({ style: { ...n.style, backgroundColor: bg } }));
    });
    effect(() => {
      const hidden = this.nodeHidden();
      const service = this.flow()?.service;
      if (!service) return;
      service.updateNode('1', () => ({ hidden }));
    });
  }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setLabel(event: Event): void { this.nodeName.set((event.target as HTMLInputElement).value); }
  setBg(event: Event): void { this.nodeBg.set((event.target as HTMLInputElement).value); }
  setHidden(event: Event): void { this.nodeHidden.set((event.target as HTMLInputElement).checked); }

  bumpPosition(): void {
    this.flow()?.service.updateNode('1', (n) => ({ position: { x: n.position.x + 10, y: n.position.y } }));
  }
}
