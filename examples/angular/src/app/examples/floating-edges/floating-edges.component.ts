import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

// ── Pure floating node: one source + one target, both floating ──────────

@Component({
  selector: 'app-floating-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="source" id="auto" [position]="Position.Right" [floating]="true" />
    <ng-flow-handle type="target" id="auto" [position]="Position.Left"  [floating]="true" />
    <div class="floating-node" [style.background]="data()?.color ?? '#e0e7ff'">
      {{ data()?.label }}
    </div>
  `,
  styles: [`
    .floating-node {
      padding: 14px 22px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      border: 2px solid #c7d2fe;
      min-width: 80px;
      text-align: center;
    }
    :host ::ng-deep .xy-flow__handle { opacity: 0; width: 1px; height: 1px; }
  `],
})
export class FloatingNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

// ── Mixed node: two fixed row-handles + one floating target anchor ──────

@Component({
  selector: 'app-mixed-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <!-- Two fixed source handles, one per row -->
    <ng-flow-handle type="source" id="row-a" [position]="Position.Right" />
    <ng-flow-handle type="source" id="row-b" [position]="Position.Right" />
    <!-- One floating target anchor; any drop inside the node lands here -->
    <ng-flow-handle type="target" id="any" [position]="Position.Left" [floating]="true" />

    <div class="mixed-node">
      <div class="mixed-node__row">Row A →</div>
      <div class="mixed-node__row">Row B →</div>
    </div>
  `,
  styles: [`
    .mixed-node {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 8px;
      min-width: 140px;
      overflow: hidden;
      color: #78350f;
      font-size: 12px;
      font-weight: 600;
    }
    .mixed-node__row {
      padding: 10px 14px;
      position: relative;
    }
    .mixed-node__row + .mixed-node__row {
      border-top: 1px solid #fcd34d;
    }
    :host ::ng-deep .xy-flow__handle { opacity: 0; width: 1px; height: 1px; }
  `],
})
export class MixedNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

// ── Example page ───────────────────────────────────────────────────────

@Component({
  selector: 'app-floating-edges-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Floating Edges"
      description="Edges connect at floating anchors that slide around the node's perimeter as nodes move. Mix fixed row-handles with floating anchors on the same node — edges with a fixed source and floating target render naturally."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class FloatingEdgesExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    floating: FloatingNodeComponent,
    mixed: MixedNodeComponent,
  };

  nodes: Node[] = [
    { id: '1', type: 'floating', position: { x:  0,  y: 100 }, data: { label: 'Origin',    color: '#dbeafe' } },
    { id: '2', type: 'floating', position: { x: 260, y:   0 }, data: { label: 'Service A', color: '#dcfce7' } },
    { id: '3', type: 'floating', position: { x: 260, y: 200 }, data: { label: 'Service B', color: '#fef3c7' } },
    { id: '4', type: 'mixed',    position: { x: 540, y:  40 }, data: { label: 'Router' } },
    { id: '5', type: 'floating', position: { x: 800, y:   0 }, data: { label: 'Database',  color: '#fce7f3' } },
    { id: '6', type: 'floating', position: { x: 800, y: 180 }, data: { label: 'Cache',     color: '#e0e7ff' } },
  ];

  edges: Edge[] = [
    // Pure floating-to-floating
    { id: 'e1-2', source: '1', sourceHandle: 'auto',  target: '2', targetHandle: 'auto' },
    { id: 'e1-3', source: '1', sourceHandle: 'auto',  target: '3', targetHandle: 'auto' },
    { id: 'e2-4', source: '2', sourceHandle: 'auto',  target: '4', targetHandle: 'any' },
    { id: 'e3-4', source: '3', sourceHandle: 'auto',  target: '4', targetHandle: 'any' },
    // Mixed: fixed row-handle source → floating target
    { id: 'e4a-5', source: '4', sourceHandle: 'row-a', target: '5', targetHandle: 'auto' },
    { id: 'e4b-6', source: '4', sourceHandle: 'row-b', target: '6', targetHandle: 'auto' },
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
