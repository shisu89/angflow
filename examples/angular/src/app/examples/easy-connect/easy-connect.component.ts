import { Component, ChangeDetectionStrategy, input, computed, inject, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  NgFlowService,
  MarkerType,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, ConnectionInProgress } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-easy-connect-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <div class="ec-body" [class.ec-target]="isTarget()">
      {{ label() }}
      <ng-flow-handle type="source" id="auto" [position]="Position.Right" [floating]="true" />
      <ng-flow-handle type="target" id="auto" [position]="Position.Left"  [floating]="true" />
    </div>
  `,
  styles: [`
    .ec-body {
      padding: 18px 28px;
      border: 2px solid #334155;
      border-radius: 8px;
      background: #ccd9f6;
      font-size: 13px; font-weight: 600; color: #0f172a;
      user-select: none;
    }
    .ec-body.ec-target {
      border-style: dashed;
      background: #ffcce3;
    }
    :host ::ng-deep .xy-flow__handle { opacity: 0; }
  `],
})
export class EasyConnectNodeComponent {
  readonly Position = Position;
  private readonly flow = inject(NgFlowService);

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

  readonly isTarget = computed(() => {
    const c = this.flow.connection();
    return c.inProgress && (c as ConnectionInProgress).fromNode?.id !== this.id();
  });

  readonly label = computed(() => this.isTarget() ? 'Drop here' : 'Drag to connect');
}

@Component({
  selector: 'app-easy-connect-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Easy connect"
      description="Entire node body acts as connection target. While dragging, other nodes highlight to show they'll accept the drop. Uses floating handles for perimeter-slide endpoints."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [defaultEdgeOptions]="defaultEdgeOptions"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class EasyConnectExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { custom: EasyConnectNodeComponent };

  defaultEdgeOptions = {
    style: { strokeWidth: 3, stroke: '#000' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#000' },
  };

  nodes: Node[] = [
    { id: '1', type: 'custom', position: { x:   0, y:   0 }, data: {} },
    { id: '2', type: 'custom', position: { x: 250, y: 320 }, data: {} },
    { id: '3', type: 'custom', position: { x:  40, y: 300 }, data: {} },
    { id: '4', type: 'custom', position: { x: 300, y:   0 }, data: {} },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
