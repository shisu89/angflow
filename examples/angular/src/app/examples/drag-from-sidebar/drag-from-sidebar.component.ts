import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  NgFlowDropZoneDirective,
  BackgroundComponent,
  ControlsComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, XYPosition } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '../_shared/example-card.component';

interface PaletteItem {
  kind: 'input' | 'default' | 'output';
  label: string;
}

const PALETTE: PaletteItem[] = [
  { kind: 'input', label: 'Input' },
  { kind: 'default', label: 'Default' },
  { kind: 'output', label: 'Output' },
];

@Component({
  selector: 'app-drag-from-sidebar-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    NgFlowDropZoneDirective,
    BackgroundComponent,
    ControlsComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Drag from Sidebar"
      description="Drag any item from the palette onto the canvas. The drop zone directive converts screen coordinates to flow space automatically."
    >
      <div class="drag-example">
        <aside class="drag-example__palette">
          <div class="drag-example__palette-label">Palette</div>
          @for (item of palette; track item.kind) {
            <div
              class="palette-item"
              [class]="'palette-item--' + item.kind"
              draggable="true"
              (dragstart)="onPaletteDragStart($event, item)"
            >
              {{ item.label }}
            </div>
          }
        </aside>
        <div class="drag-example__canvas">
          <ng-flow
            ngFlowDropZone
            [nodes]="nodes"
            [edges]="edges"
            [fitView]="true"
            (nodesChange)="onNodesChange($event)"
            (edgesChange)="onEdgesChange($event)"
            (connect)="onConnect($event)"
            (nodeDrop)="onNodeDrop($event)"
          >
            <ng-flow-background variant="dots" [gap]="20" [size]="1" />
            <ng-flow-controls />
          </ng-flow>
        </div>
      </div>
    </app-example-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .drag-example {
      display: flex;
      height: 100%;
    }
    .drag-example__palette {
      width: 160px;
      flex-shrink: 0;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .drag-example__palette-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .palette-item {
      padding: 10px 14px;
      background: #ffffff;
      border: 2px solid #cbd5e1;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      cursor: grab;
      text-align: center;
      transition: border-color 0.15s, transform 0.15s;
    }
    .palette-item:hover {
      border-color: #6366f1;
      transform: translateY(-1px);
    }
    .palette-item:active {
      cursor: grabbing;
    }
    .palette-item--input { border-color: #10b981; }
    .palette-item--output { border-color: #f59e0b; }
    .drag-example__canvas {
      flex: 1;
      min-width: 0;
      position: relative;
    }
  `],
})
export class DragFromSidebarExampleComponent {
  readonly palette = PALETTE;
  private idCounter = 1;

  nodes: Node[] = [
    { id: 'seed', type: 'input', position: { x: 80, y: 140 }, data: { label: 'Drop something →' } },
  ];

  edges: Edge[] = [];

  onPaletteDragStart(event: DragEvent, item: PaletteItem): void {
    event.dataTransfer?.setData('application/json', JSON.stringify(item));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onNodeDrop(payload: { event: DragEvent; flowPosition: XYPosition; data: string | null }): void {
    if (!payload.data) return;
    let item: PaletteItem;
    try {
      item = JSON.parse(payload.data) as PaletteItem;
    } catch {
      return;
    }
    const id = `dropped-${++this.idCounter}`;
    const type = item.kind === 'default' ? undefined : item.kind;
    this.nodes = [
      ...this.nodes,
      {
        id,
        type,
        position: payload.flowPosition,
        data: { label: item.label },
      },
    ];
  }

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
