import { Component, ChangeDetectionStrategy, DestroyRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  Position,
} from '@angflow/angular';
import type { Node, Edge, Connection, ColorMode, NodeChangeset, EdgeChangeset } from '@angflow/angular';
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
      description="Page theme sets data-theme on <html>; force colour mode overrides it on the flow."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [forceColorMode]="forceColorMode()"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-right">
          <label class="cm-label">
            <span>Page theme (html data-theme)</span>
            <select
              class="cm-select"
              data-testid="colormode-select"
              [value]="pageTheme()"
              (change)="onPageThemeChange($event)"
            >
              <option value="system">system</option>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </label>
          <label class="cm-label">
            <span>Force color mode (flow only)</span>
            <select
              class="cm-select"
              data-testid="force-colormode-select"
              (change)="onForceColorModeChange($event)"
            >
              <option value="none">none</option>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cm-label { display: flex; flex-direction: column; align-items: flex-start; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .cm-select {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
    }
  `],
})
export class ColorModeExampleComponent {
  private readonly document = inject(DOCUMENT);

  readonly pageTheme = signal<'system' | ColorMode>('system');
  readonly forceColorMode = signal<ColorMode | undefined>(undefined);

  constructor() {
    // Don't leave the page themed when navigating to other routes.
    inject(DestroyRef).onDestroy(() => this.document.documentElement.removeAttribute('data-theme'));
  }

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

  onNodesChange(changes: NodeChangeset): void { this.nodes = changes.applyTo(this.nodes); }
  onEdgesChange(changes: EdgeChangeset): void { this.edges = changes.applyTo(this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onPageThemeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'system' | ColorMode;
    this.pageTheme.set(value);
    if (value === 'system') {
      this.document.documentElement.removeAttribute('data-theme');
    } else {
      this.document.documentElement.setAttribute('data-theme', value);
    }
  }

  onForceColorModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.forceColorMode.set(value === 'none' ? undefined : (value as ColorMode));
  }
}
