import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, Viewport, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-controlled-viewport-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Controlled viewport"
      description="Two-way viewport binding: the flow reports pan/zoom back via (viewportChange) and accepts a new viewport via [viewport]. Toggle between two stored viewports, nudge one by 10px, or fitView programmatically."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [viewport]="activeViewport()"
        (viewportChange)="onViewportChange($event)"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-left">
          <div class="cv-panel">
            <button (click)="nudge()">update viewport</button>
            <button (click)="fit()">fitView</button>
            <button (click)="toggle()">toggle viewport ({{ currentIndex() === 0 ? 'A' : 'B' }})</button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cv-panel {
      display: inline-flex; gap: 6px;
      padding: 8px 10px; background: #ffffffcc; backdrop-filter: blur(4px);
      border-radius: 6px;
    }
    .cv-panel button {
      font-size: 12px; padding: 4px 8px;
      border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;
    }
  `],
})
export class ControlledViewportExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly viewportA = signal<Viewport>({ x: 0, y: 0, zoom: 1 });
  readonly viewportB = signal<Viewport>({ x: 100, y: 100, zoom: 1.5 });
  readonly currentIndex = signal(0);

  readonly activeViewport = () => this.currentIndex() === 0 ? this.viewportA() : this.viewportB();

  nodes: Node[] = [
    { id: '1a', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 }, className: 'light', ariaLabel: 'Input Node 1' },
    { id: '2a',                data: { label: 'Node 2' }, position: { x: 100, y: 100 }, className: 'light', ariaLabel: 'Default Node 2' },
    { id: '3a',                data: { label: 'Node 3' }, position: { x: 400, y: 100 }, className: 'light' },
    { id: '4a',                data: { label: 'Node 4' }, position: { x: 400, y: 200 }, className: 'light' },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1a', target: '2a' },
    { id: 'e1-3', source: '1a', target: '3a' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onViewportChange(vp: Viewport): void {
    if (this.currentIndex() === 0) this.viewportA.set(vp);
    else this.viewportB.set(vp);
  }

  nudge(): void {
    const target = this.currentIndex() === 0 ? this.viewportA : this.viewportB;
    target.update((v) => ({ ...v, y: v.y + 10 }));
  }

  fit(): void { this.flow.fitView(); }

  toggle(): void { this.currentIndex.set(this.currentIndex() === 0 ? 1 : 0); }
}
