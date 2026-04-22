import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-click-distance-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, PanelComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Click distance"
      description="How far the pointer can drift during a pane click before the click is suppressed. Slide to increase the tolerance, then try panning the background — small drifts still count as clicks (watch the console)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [paneClickDistance]="paneClickDistance()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (paneClick)="onPaneClick()"
      >
        <ng-flow-panel position="top-right">
          <label class="cd-label">
            <span>click distance: {{ paneClickDistance() }}px</span>
            <input
              type="range"
              min="0"
              max="100"
              [value]="paneClickDistance()"
              (input)="setDistance($event)"
              aria-label="Pane click distance"
            />
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cd-label {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
    }
    .cd-label input[type="range"] { width: 140px; }
  `],
})
export class ClickDistanceExampleComponent {
  readonly paneClickDistance = signal(0);

  nodes: Node[] = [
    { id: '1a', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2a',                data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
    { id: '3a',                data: { label: 'Node 3' }, position: { x: 400, y: 100 } },
    { id: '4a',                data: { label: 'Node 4' }, position: { x: 400, y: 200 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1a', target: '2a' },
    { id: 'e1-3', source: '1a', target: '3a' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  onPaneClick(): void { console.log('pane click'); }
  setDistance(event: Event): void { this.paneClickDistance.set(Number((event.target as HTMLInputElement).value)); }
}
