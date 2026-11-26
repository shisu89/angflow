import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { NgFlowComponent, PanelComponent, BackgroundComponent, applyNodeChanges } from '@angflow/angular';
import type { Node, NodeChange } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const PAN_ON_DRAG: Record<string, boolean | number[]> = {
  true: true, false: false, '[1, 2]': [1, 2], '[0, 1, 2]': [0, 1, 2], '[2]': [2],
};

@Component({
  selector: 'app-drag-threshold-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, PanelComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Drag threshold"
      description="nodeDragThreshold and paneDragThreshold decide when a press becomes a drag; below them it is a click. The log lists clicks, moves and selections (port of upstream DragThreshold)."
    >
      <ng-flow
        [nodes]="nodes"
        [nodeDragThreshold]="dragThreshold()"
        [paneDragThreshold]="paneDragThreshold()"
        [snapToGrid]="snapGridSize() > 0"
        [snapGrid]="snapGrid()"
        [selectionOnDrag]="selectionOnDrag()"
        [panOnDrag]="panOnDragValue()"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (nodeClick)="log('node click: node ' + $event.node.id)"
        (paneClick)="log('pane click')"
        (paneContextMenu)="onPaneContextMenu($event)"
        (moveStart)="log('move start')"
        (moveEnd)="log('move end')"
        (selectionStart)="log('selection start')"
        (selectionEnd)="log('selection end')"
      >
        <ng-flow-background [gap]="snapGridSize() || 20" />
        <ng-flow-panel position="top-left">
          <div class="dt-panel">
            <label>nodeDragThreshold
              <input type="number" min="0" [value]="dragThreshold()" (input)="dragThreshold.set(+$any($event.target).value)" />
            </label>
            <label>paneDragThreshold
              <input type="number" min="0" [value]="paneDragThreshold()" (input)="paneDragThreshold.set(+$any($event.target).value)" />
            </label>
            <label>panOnDrag
              <select [value]="panOnDrag()" (change)="panOnDrag.set($any($event.target).value)">
                @for (option of panOnDragOptions; track option) { <option [value]="option">{{ option }}</option> }
              </select>
            </label>
            <label>selectionOnDrag
              <input type="checkbox" [checked]="selectionOnDrag()" (change)="selectionOnDrag.set($any($event.target).checked)" />
            </label>
            <label>snapGrid size (0 = off)
              <input type="number" min="0" [value]="snapGridSize()" (input)="snapGridSize.set(+$any($event.target).value)" />
            </label>
            <button type="button" (click)="messages.set([])">clear</button>
            <ul>
              @for (message of messages(); track message) { <li>{{ message }}</li> }
            </ul>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .dt-panel { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 5px;
      background: var(--xy-node-background-color-default, #fff); color: var(--xy-node-color-default, #222);
      border: var(--xy-node-border-default, 1px solid #1a192b); font-size: 12px; }
    .dt-panel ul { margin: 0; padding-left: 20px; }
    .dt-panel button { align-self: flex-start; }
  `],
})
export class DragThresholdExampleComponent {
  readonly panOnDragOptions = Object.keys(PAN_ON_DRAG);
  readonly dragThreshold = signal(1);
  readonly paneDragThreshold = signal(1);
  readonly selectionOnDrag = signal(true);
  readonly panOnDrag = signal('[1, 2]');
  readonly snapGridSize = signal(0);
  readonly messages = signal<string[]>([]);
  readonly panOnDragValue = computed(() => PAN_ON_DRAG[this.panOnDrag()]);
  readonly snapGrid = computed<[number, number]>(() => {
    const size = this.snapGridSize() || 15;
    return [size, size];
  });
  private count = 0;

  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
    { id: '2', data: { label: 'Node 2' }, position: { x: 200, y: 100 } },
    { id: '3', data: { label: 'Node 3' }, position: { x: 0, y: 200 } },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onPaneContextMenu(event: MouseEvent): void { event.preventDefault(); this.log('pane context menu'); }
  log(message: string): void {
    this.count += 1;
    this.messages.update((list) => [`#${this.count} ${message}`, ...list].slice(0, 10));
  }
}
