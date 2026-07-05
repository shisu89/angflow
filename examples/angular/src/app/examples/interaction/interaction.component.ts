import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  PanOnScrollMode,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, Viewport, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-interaction-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Interaction"
      description="Toggle every user-interaction flag on the flow at runtime: dragging, connecting, selecting, pan/zoom modes, and whether the pane's click/scroll handlers are captured."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodesDraggable]="isDraggable()"
        [nodesConnectable]="isConnectable()"
        [elementsSelectable]="isSelectable()"
        [zoomOnScroll]="zoomOnScroll()"
        [zoomOnPinch]="zoomOnPinch()"
        [panOnScroll]="panOnScroll()"
        [panOnScrollMode]="panOnScrollMode()"
        [zoomOnDoubleClick]="zoomOnDoubleClick()"
        [panOnDrag]="panOnDrag()"
        [nodeDragThreshold]="0"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeDragStart)="log('drag start', $event.node)"
        (nodeDragStop)="log('drag stop', $event.node)"
        (nodeClick)="onNodeClick($event)"
        (edgeClick)="onEdgeClick($event)"
        (paneClick)="onPaneClick($event)"
        (paneScroll)="onPaneScroll($event)"
        (moveEnd)="onMoveEnd($event.viewport)"
      >
        <ng-flow-minimap />
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-left">
          <div class="panel">
            <label for="ix-draggable"><input id="ix-draggable" type="checkbox" [checked]="isDraggable()" (change)="setFlag('isDraggable', $event)" /> nodesDraggable</label>
            <label for="ix-connectable"><input id="ix-connectable" type="checkbox" [checked]="isConnectable()" (change)="setFlag('isConnectable', $event)" /> nodesConnectable</label>
            <label for="ix-selectable"><input id="ix-selectable" type="checkbox" [checked]="isSelectable()" (change)="setFlag('isSelectable', $event)" /> elementsSelectable</label>
            <label for="ix-zoomOnScroll"><input id="ix-zoomOnScroll" type="checkbox" [checked]="zoomOnScroll()" (change)="setFlag('zoomOnScroll', $event)" /> zoomOnScroll</label>
            <label for="ix-zoomOnPinch"><input id="ix-zoomOnPinch" type="checkbox" [checked]="zoomOnPinch()" (change)="setFlag('zoomOnPinch', $event)" /> zoomOnPinch</label>
            <label for="ix-panOnScroll"><input id="ix-panOnScroll" type="checkbox" [checked]="panOnScroll()" (change)="setFlag('panOnScroll', $event)" /> panOnScroll</label>
            <label for="ix-panOnScrollMode">
              panOnScrollMode
              <select id="ix-panOnScrollMode" [value]="panOnScrollMode()" (change)="setScrollMode($event)">
                <option value="free">free</option>
                <option value="horizontal">horizontal</option>
                <option value="vertical">vertical</option>
              </select>
            </label>
            <label for="ix-zoomOnDoubleClick"><input id="ix-zoomOnDoubleClick" type="checkbox" [checked]="zoomOnDoubleClick()" (change)="setFlag('zoomOnDoubleClick', $event)" /> zoomOnDoubleClick</label>
            <label for="ix-panOnDrag"><input id="ix-panOnDrag" type="checkbox" [checked]="panOnDrag()" (change)="setFlag('panOnDrag', $event)" /> panOnDrag</label>
            <label for="ix-captureZoomClick"><input id="ix-captureZoomClick" type="checkbox" [checked]="captureZoomClick()" (change)="setFlag('captureZoomClick', $event)" /> capture onPaneClick</label>
            <label for="ix-capturePaneScroll"><input id="ix-capturePaneScroll" type="checkbox" [checked]="capturePaneScroll()" (change)="setFlag('capturePaneScroll', $event)" /> capture onPaneScroll</label>
            <label for="ix-captureElementClick"><input id="ix-captureElementClick" type="checkbox" [checked]="captureElementClick()" (change)="setFlag('captureElementClick', $event)" /> capture onElementClick</label>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      font-size: 12px;
      color: #334155;
    }
    .panel label { display: flex; align-items: center; gap: 6px; }
    .panel select { margin-left: 6px; font-size: 12px; }
  `],
})
export class InteractionExampleComponent {
  readonly isDraggable = signal(false);
  readonly isConnectable = signal(false);
  readonly isSelectable = signal(false);
  readonly zoomOnScroll = signal(false);
  readonly zoomOnPinch = signal(false);
  readonly panOnScroll = signal(false);
  readonly panOnScrollMode = signal<PanOnScrollMode>(PanOnScrollMode.Free);
  readonly zoomOnDoubleClick = signal(false);
  readonly panOnDrag = signal<boolean | number[]>(true);
  readonly captureZoomClick = signal(false);
  readonly capturePaneScroll = signal(false);
  readonly captureElementClick = signal(false);

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 } },
    { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3' },
  ];

  private readonly flags: Record<string, ReturnType<typeof signal<boolean>>> = {
    isDraggable: this.isDraggable,
    isConnectable: this.isConnectable,
    isSelectable: this.isSelectable,
    zoomOnScroll: this.zoomOnScroll,
    zoomOnPinch: this.zoomOnPinch,
    panOnScroll: this.panOnScroll,
    zoomOnDoubleClick: this.zoomOnDoubleClick,
    captureZoomClick: this.captureZoomClick,
    capturePaneScroll: this.capturePaneScroll,
    captureElementClick: this.captureElementClick,
  } as Record<string, ReturnType<typeof signal<boolean>>>;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setFlag(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    // panOnDrag is boolean | number[] — cannot use the generic boolean flags map.
    if (key === 'panOnDrag') {
      this.panOnDrag.set(checked);
      return;
    }
    const sig = this.flags[key];
    if (sig) sig.set(checked);
  }

  setScrollMode(event: Event): void {
    this.panOnScrollMode.set((event.target as HTMLSelectElement).value as PanOnScrollMode);
  }

  onNodeClick(event: { event: MouseEvent; node: Node }): void {
    if (this.captureElementClick()) this.log('click', event.node);
  }
  onEdgeClick(event: { event: MouseEvent; edge: Edge }): void {
    if (this.captureElementClick()) this.log('click', event.edge);
  }
  onPaneClick(event: MouseEvent): void {
    if (this.captureZoomClick()) this.log('onPaneClick', event);
  }
  onPaneScroll(event: WheelEvent | undefined): void {
    if (this.capturePaneScroll()) this.log('onPaneScroll', event);
  }

  onMoveEnd(viewport: Viewport): void { console.log('onMoveEnd', viewport); }
  log(...args: unknown[]): void { console.log(...args); }
}
