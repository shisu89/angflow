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
import type { Node, Edge, Connection, ColorMode, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-color-mode-example',
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
      title="Color mode"
      description="Toggle light / dark / system color themes. The flow reads the OS preference in system mode and updates live when the OS theme changes."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [colorMode]="colorMode()"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <label class="cm-label">
            <span>color mode</span>
            <select
              class="cm-select"
              [value]="colorMode()"
              (change)="setMode($event)"
              aria-label="Color mode"
            >
              <option value="light">light</option>
              <option value="dark">dark</option>
              <option value="system">system</option>
            </select>
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cm-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .cm-select {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
    }
  `],
})
export class ColorModeExampleComponent {
  readonly colorMode = signal<ColorMode>('light');

  nodes: Node[] = [
    { id: 'A', type: 'input', position: { x:   0, y: 150 }, data: { label: 'A' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'B',                position: { x: 250, y:   0 }, data: { label: 'B' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'C',                position: { x: 250, y: 150 }, data: { label: 'C' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'D',                position: { x: 250, y: 300 }, data: { label: 'D' }, sourcePosition: Position.Right, targetPosition: Position.Left },
  ];

  edges: Edge[] = [
    { id: 'A-B', source: 'A', target: 'B' },
    { id: 'A-C', source: 'A', target: 'C' },
    { id: 'A-D', source: 'A', target: 'D' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setMode(event: Event): void {
    this.colorMode.set((event.target as HTMLSelectElement).value as ColorMode);
  }
}
