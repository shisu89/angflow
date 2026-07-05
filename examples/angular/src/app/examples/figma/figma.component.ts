import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  SelectionMode,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, Viewport } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const MULTI_SELECT_KEY = ['Meta', 'Shift'];
const PAN_ON_DRAG = [1, 2];

@Component({
  selector: 'app-figma-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Figma"
      description="Figma-style canvas: hold ⌘ or Shift to multi-select, drag with the middle/right mouse button to pan, scroll to pan (not zoom). Watch the console — every pane / selection / move event is instrumented."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [selectionOnDrag]="true"
        [selectionMode]="SelectionMode.Partial"
        [panOnDrag]="panOnDrag"
        [panOnScroll]="true"
        [paneClickDistance]="100"
        [zoomActivationKeyCode]="'Meta'"
        [multiSelectionKeyCode]="multiSelectKey"
        [fitView]="true"
        [selectNodesOnDrag]="false"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (paneContextMenu)="onPaneContextMenu($event)"
        (selectionContextMenu)="onSelectionContextMenu($event)"
        (moveStart)="onMoveStart($event)"
        (move)="onMove($event)"
        (moveEnd)="onMoveEnd($event)"
        (paneClick)="onPaneClick($event)"
        (selectionStart)="onSelectionStart($event)"
        (selectionEnd)="onSelectionEnd($event)"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
        (click)="onClick($event)"
      >
        <ng-flow-background variant="cross" />
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-right">
          <input type="text" placeholder="name" class="figma-input" />
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .figma-input {
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 13px;
      background: #fff;
    }
    .figma-input:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
    }
  `],
})
export class FigmaExampleComponent {
  readonly SelectionMode = SelectionMode;
  readonly multiSelectKey = MULTI_SELECT_KEY;
  readonly panOnDrag = PAN_ON_DRAG;

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 }, className: 'light' },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 }, className: 'light' },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 }, className: 'light' },
    { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 }, className: 'light' },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onPaneContextMenu(event: MouseEvent): void {
    event.preventDefault();
    console.log('context menu');
  }
  onSelectionContextMenu(payload: { event: MouseEvent; nodes: Node[] }): void {
    this.onPaneContextMenu(payload.event);
  }

  onMoveStart(payload: { event: MouseEvent | TouchEvent | null; viewport: Viewport }): void { console.log('move start', payload); }
  onMove(payload: { event: MouseEvent | TouchEvent | null; viewport: Viewport }): void { console.log('move', payload); }
  onMoveEnd(payload: { event: MouseEvent | TouchEvent | null; viewport: Viewport }): void { console.log('move end', payload); }
  onPaneClick(event: MouseEvent): void { console.log('pane click', event); }
  onSelectionStart(event: MouseEvent): void { console.log('on selection start', event); }
  onSelectionEnd(event: MouseEvent): void { console.log('on selection end', event); }
  onPointerDown(event: PointerEvent): void { console.log('pointer down', event); }
  onPointerUp(event: PointerEvent): void { console.log('pointer up', event); }
  onClick(event: MouseEvent): void { console.log('click', event); }
}
