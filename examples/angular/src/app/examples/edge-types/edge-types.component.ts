import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const EDGE_TYPES = ['default', 'straight', 'step', 'smoothstep', 'simplebezier'] as const;

@Component({
  selector: 'app-edge-types-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Edge Types"
      description="All five built-in edge types. Click a button to switch the active type."
    >
      <div class="toolbar">
        @for (t of edgeTypeList; track t) {
          <button
            class="toolbar__btn"
            [class.is-active]="activeType === t"
            (click)="switchType(t)"
          >{{ t }}</button>
        }
      </div>
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .toolbar {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #fafbfc;
    }
    .toolbar__btn {
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
    }
    .toolbar__btn:hover { background: #f1f5f9; }
    .toolbar__btn.is-active {
      background: #6366f1;
      color: #fff;
      border-color: #6366f1;
    }
  `],
})
export class EdgeTypesExampleComponent {
  readonly edgeTypeList = EDGE_TYPES;
  activeType: string = 'default';

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Source' } },
    { id: '2', position: { x: 300, y: 120 }, data: { label: 'Target A' } },
    { id: '3', type: 'output', position: { x: 600, y: 0 }, data: { label: 'Target B' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'default' },
    { id: 'e2-3', source: '2', target: '3', type: 'default' },
  ];

  switchType(type: string): void {
    this.activeType = type;
    this.edges = this.edges.map(e => ({ ...e, type }));
  }

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }
}
