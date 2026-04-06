import { Component, signal } from '@angular/core';
import {
  NgFlowComponent,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type ColorMode,
} from '@angflow/angular';

@Component({
  standalone: true,
  imports: [NgFlowComponent],
  template: `
    <ng-flow
      [nodes]="nodes"
      [edges]="edges"
      [fitView]="true"
      [colorMode]="colorMode()"
      (nodesChange)="onNodesChange($event)"
      (edgesChange)="onEdgesChange($event)"
      (connect)="onConnect($event)"
    />
    <select data-testid="colormode-select" (change)="onColorModeChange($event)">
      <option value="light">light</option>
      <option value="dark">dark</option>
      <option value="system">system</option>
    </select>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; position: relative; }
    select { position: absolute; top: 10px; left: 10px; z-index: 10; }
  `],
})
export class ColorModeComponent {
  colorMode = signal<ColorMode>('light');

  nodes: Node[] = [
    { id: '1', data: { label: '1' }, position: { x: 0, y: 0 } },
    { id: '2', data: { label: '2' }, position: { x: 200, y: 100 } },
  ];
  edges: Edge[] = [
    { id: 'e1', source: '1', target: '2' },
  ];

  onColorModeChange(event: Event) {
    this.colorMode.set((event.target as HTMLSelectElement).value as ColorMode);
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
