import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-hidden-example',
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
      title="Hidden nodes & edges"
      description="The hidden prop hides a node or edge without removing it from the graph. Toggle to reveal them — positions, handles, and edge connectivity are preserved."
    >
      <ng-flow
        [nodes]="visibleNodes()"
        [edges]="visibleEdges()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-minimap />
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-left">
          <label class="hidden-label">
            <input
              type="checkbox"
              [checked]="isHidden()"
              (change)="setHidden($event)"
            />
            isHidden
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .hidden-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
    }
  `],
})
export class HiddenExampleComponent {
  readonly isHidden = signal(true);

  private readonly nodesState = signal<Node[]>([
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 } },
    { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 } },
  ]);

  private readonly edgesState = signal<Edge[]>([
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
  ]);

  readonly visibleNodes = computed(() =>
    this.nodesState().map((n) => ({ ...n, hidden: this.isHidden() }))
  );
  readonly visibleEdges = computed(() =>
    this.edgesState().map((e) => ({ ...e, hidden: this.isHidden() }))
  );

  onNodesChange(changes: NodeChange[]): void {
    this.nodesState.set(applyNodeChanges(changes, this.nodesState()));
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edgesState.set(applyEdgeChanges(changes, this.edgesState()));
  }

  onConnect(connection: Connection): void {
    this.edgesState.set(addEdge(connection, this.edgesState()) as Edge[]);
  }

  setHidden(event: Event): void {
    this.isHidden.set((event.target as HTMLInputElement).checked);
  }
}
