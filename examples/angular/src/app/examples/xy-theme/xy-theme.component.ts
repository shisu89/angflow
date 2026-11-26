import { Component, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

/**
 * Demo of the optional full theme, `@angflow/angular/xy-theme.css`.
 *
 * The theme is served as a build asset (see `assets` in angular.json) and attached as a
 * `<link>` while this page is alive, so it can't leak into other routes. It sits later in
 * the document than the global `style.css`; both are in `@layer xyflow`, so source order
 * decides and the theme wins.
 */
@Component({
  selector: 'app-xy-theme-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, MiniMapComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="xy-theme"
      description="The optional full xyflow theme (xy-theme.css), loaded only on this page."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class XyThemeExampleComponent {
  constructor() {
    const document = inject(DOCUMENT);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'xy-theme.css';
    link.dataset['xyTheme'] = '';
    document.head.appendChild(link);
    inject(DestroyRef).onDestroy(() => link.remove());
  }

  nodes: Node[] = [
    { id: 'A', type: 'input', position: { x: 0, y: 100 }, data: { label: 'Input' }, sourcePosition: Position.Right },
    { id: 'B', position: { x: 250, y: 0 }, data: { label: 'Default' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'C', position: { x: 250, y: 200 }, data: { label: 'Default' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'G', type: 'group', position: { x: 500, y: 20 }, data: {}, style: { width: '240px', height: '240px' } },
    { id: 'D', type: 'output', position: { x: 30, y: 60 }, data: { label: 'In group' }, parentId: 'G', targetPosition: Position.Left },
  ];

  edges: Edge[] = [
    { id: 'A-B', source: 'A', target: 'B', label: 'edge label' },
    { id: 'A-C', source: 'A', target: 'C' },
    { id: 'B-D', source: 'B', target: 'D', animated: true },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
