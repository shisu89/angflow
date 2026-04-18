import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Connection, Edge, Node } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { makeSeedGraph } from './seed-graph-200';

const seed = makeSeedGraph(200);

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, MiniMapComponent],
  template: `
    <header class="harness-header">
      <strong>angflow zoneless harness</strong>
      <span class="badge">Zoneless</span>
      <span class="hint">200 nodes — drag, pan/zoom, box-select, connect, delete, minimap</span>
    </header>
    <ng-flow
      class="flow"
      [nodes]="nodes()"
      [edges]="edges()"
      [fitView]="true"
      [nodesConnectable]="true"
      [nodesDraggable]="true"
      [elementsSelectable]="true"
      [selectionOnDrag]="true"
      [deleteKeyCode]="['Delete', 'Backspace']"
      (nodesChange)="onNodesChange($event)"
      (edgesChange)="onEdgesChange($event)"
      (connect)="onConnect($event)">
      <ng-flow-background variant="dots" [gap]="20" [size]="1" />
      <ng-flow-minimap />
      <ng-flow-controls />
    </ng-flow>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; }
    .harness-header {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
      font-family: system-ui, sans-serif;
      font-size: 0.875rem;
    }
    .badge {
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 9999px;
      background: #ede9fe;
      color: #5b21b6;
    }
    .hint { color: #6b7280; font-size: 0.75rem; }
    .flow { flex: 1; min-height: 0; }
  `],
})
export class ZonelessAppComponent {
  protected readonly nodes = signal<Node[]>(seed.nodes);
  protected readonly edges = signal<Edge[]>(seed.edges);

  protected onNodesChange(changes: unknown[]): void {
    this.nodes.update((current) => applyNodeChanges(changes as never, current));
  }

  protected onEdgesChange(changes: unknown[]): void {
    this.edges.update((current) => applyEdgeChanges(changes as never, current));
  }

  protected onConnect(connection: Connection): void {
    this.edges.update((current) => addEdge(connection, current) as Edge[]);
  }
}
