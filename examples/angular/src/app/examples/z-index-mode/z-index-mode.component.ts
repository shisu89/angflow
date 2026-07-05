import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, ZIndexMode, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const NODE_DEFAULTS = { sourcePosition: Position.Right, targetPosition: Position.Left };

@Component({
  selector: 'app-z-index-mode-example',
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
      title="Z-index mode"
      description="Controls how stacking order is computed for parent/child nodes. Auto picks an order based on hierarchy; basic lets you set z via node data; manual disables automatic ordering entirely."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [zIndexMode]="zIndexMode()"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-right">
          <label class="zi-label">
            <span>zIndexMode</span>
            <select [value]="zIndexMode()" (change)="setMode($event)">
              <option value="manual">manual</option>
              <option value="basic">basic</option>
              <option value="auto">auto</option>
            </select>
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .zi-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .zi-label select { font-size: 12px; padding: 4px 8px; border-radius: 4px; }
  `],
})
export class ZIndexModeExampleComponent {
  readonly zIndexMode = signal<ZIndexMode>('auto');

  nodes: Node[] = [
    { id: 'A', type: 'input', position: { x:   0, y: 150 }, data: { label: 'A' }, ...NODE_DEFAULTS },
    { id: 'B',                position: { x: 250, y:   0 }, data: { label: 'B' }, ...NODE_DEFAULTS },
    { id: 'C',                position: { x: 250, y: 150 }, data: { label: 'C' }, ...NODE_DEFAULTS },
    { id: 'D',                position: { x:   0, y: 300 }, width: 200, height: 200, data: { label: 'D' }, ...NODE_DEFAULTS },
    { id: 'E', parentId: 'D', position: { x:  10, y:  10 }, data: { label: 'E' }, ...NODE_DEFAULTS },
    { id: 'F',                position: { x: 250, y: 300 }, width: 200, height: 200, data: { label: 'F' }, ...NODE_DEFAULTS },
    { id: 'G', parentId: 'F', position: { x:  10, y:  10 }, data: { label: 'G' }, ...NODE_DEFAULTS },
    { id: 'H',                position: { x: 500, y: 300 }, width: 200, height: 200, data: { label: 'H' }, ...NODE_DEFAULTS },
    { id: 'I', parentId: 'H', position: { x:  10, y:  10 }, data: { label: 'I' }, ...NODE_DEFAULTS },
  ];

  edges: Edge[] = [
    { id: 'A-B', source: 'A', target: 'B' },
    { id: 'A-C', source: 'A', target: 'C' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  setMode(event: Event): void { this.zIndexMode.set((event.target as HTMLSelectElement).value as ZIndexMode); }
}
