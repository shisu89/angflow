import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
  type BackgroundVariant,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '../../shell/example-card.component';

@Component({
  selector: 'app-backgrounds-variants-example',
  standalone: true,
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
      title="Background Variants"
      description="Switch between the three built-in background patterns — dots, lines, and cross — live."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background [variant]="variant()" [gap]="24" [size]="variant() === 'dots' ? 1 : 1.2" />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="bg-picker">
            @for (v of variants; track v) {
              <button
                class="bg-picker__btn"
                [class.is-active]="variant() === v"
                (click)="variant.set(v)"
              >
                {{ v }}
              </button>
            }
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .bg-picker {
      display: flex;
      gap: 4px;
      background: #ffffff;
      padding: 4px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
    }
    .bg-picker__btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      text-transform: capitalize;
      transition: background 0.15s, color 0.15s;
      font-family: inherit;
    }
    .bg-picker__btn:hover {
      background: #f1f5f9;
    }
    .bg-picker__btn.is-active {
      background: #6366f1;
      color: #ffffff;
    }
  `],
})
export class BackgroundsVariantsExampleComponent {
  readonly variants: BackgroundVariant[] = ['dots', 'lines', 'cross'];
  readonly variant = signal<BackgroundVariant>('dots');

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 100, y: 100 }, data: { label: 'Start' } },
    { id: '2', position: { x: 340, y: 200 }, data: { label: 'Middle' } },
    { id: '3', type: 'output', position: { x: 560, y: 100 }, data: { label: 'End' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3' },
  ];

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
