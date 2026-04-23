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
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const INITIAL_NODES: Node[] = [
  { id: '1',  data: { label: 'Node 1'  }, position: { x:    0, y:    0 } },
  { id: '2',  data: { label: 'Node 2'  }, position: { x:    0, y:  200 } },
  { id: '3',  data: { label: 'Node 3'  }, position: { x:  200, y:    0 } },
  { id: '4',  data: { label: 'Node 4'  }, position: { x: 1000, y:    0 } },
  { id: '5',  data: { label: 'Node 5'  }, position: { x: 1000, y:  200 } },
  { id: '6',  data: { label: 'Node 6'  }, position: { x:  800, y:    0 } },
  { id: '7',  data: { label: 'Node 7'  }, position: { x:    0, y: 1000 } },
  { id: '8',  data: { label: 'Node 8'  }, position: { x:    0, y:  800 } },
  { id: '9',  data: { label: 'Node 9'  }, position: { x:  200, y: 1000 } },
  { id: '10', data: { label: 'Node 10' }, position: { x: 1000, y: 1000 } },
  { id: '11', data: { label: 'Node 11' }, position: { x:  800, y: 1000 } },
  { id: '12', data: { label: 'Node 12' }, position: { x: 1000, y:  800 } },
];

@Component({
  selector: 'app-interactive-minimap-example',
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
      title="Interactive minimap"
      description="Pan and zoom via the minimap, invert pan direction, and programmatically reset the viewport or toggle node classnames."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        [selectNodesOnDrag]="false"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-minimap
          [pannable]="true"
          [zoomable]="true"
          [inversePan]="invertPan()"
        />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="im-panel">
            <button (click)="resetViewport()">reset transform</button>
            <button (click)="scatter()">scatter positions</button>
            <button (click)="toggleTheme()">toggle classnames</button>
            <button (click)="logToObject()">toObject</button>
            <button (click)="toggleInvert()">
              {{ invertPan() ? 'un-invert pan' : 'invert pan' }}
            </button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .im-panel { display: flex; flex-direction: column; gap: 4px; }
    .im-panel button {
      font-size: 12px; padding: 4px 8px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class InteractiveMinimapExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly invertPan = signal(false);

  nodes: Node[] = [...INITIAL_NODES];
  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  resetViewport(): void { this.flow.setViewport({ x: 0, y: 0, zoom: 1 }); }

  scatter(): void {
    this.nodes = this.nodes.map((n) => ({
      ...n,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    }));
  }

  toggleTheme(): void {
    this.nodes = this.nodes.map((n) => ({
      ...n,
      className: n.className === 'light' ? 'dark' : 'light',
    }));
  }

  toggleInvert(): void { this.invertPan.set(!this.invertPan()); }

  logToObject(): void { console.log(this.flow.toObject()); }
}
