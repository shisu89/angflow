import { Component, ChangeDetectionStrategy, input, computed, inject, viewChild, effect, OnDestroy, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  NgFlowService,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-moving-handle-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <div class="mh-body">
      <ng-flow-handle
        type="target" id="a" [position]="Position.Left"
        [style.transform]="inProgress() ? 'translate(-20px, -50%)' : 'translate(-50%, -50%)'"
        class="mh-handle mh-handle-top"
      />
      <ng-flow-handle
        type="target" id="b" [position]="Position.Left"
        [style.transform]="inProgress() ? 'translate(-20px, 50%)' : 'translate(-50%, 50%)'"
        class="mh-handle mh-handle-bottom"
      />
      <div class="mh-label">moving handles</div>
      <ng-flow-handle type="source" id="s1" [position]="Position.Right" />
      <ng-flow-handle type="source" id="s2" [position]="Position.Right" />
    </div>
  `,
  styles: [`
    .mh-body { position: relative; background: #f4f4f4; padding: 10px 14px; border-radius: 4px; }
    .mh-label { font-size: 12px; color: #334155; }
    .mh-handle { transition: transform 0.5s; }
    .mh-handle-top    { top: 30%; }
    .mh-handle-bottom { top: 70%; }
  `],
})
export class MovingHandleNodeComponent {
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

  readonly inProgress = computed(() => this.flow.connection().inProgress);
}

@Component({
  selector: 'app-moving-handles-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Moving handles"
      description="Handles animate into a new position when a connection drag starts, giving users a clearer drop target. The node component reads NgFlowService.connection to react to drag state."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [minZoom]="0.2"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-controls [showDelete]="true" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class MovingHandlesExampleComponent implements OnDestroy {
  // Non-required: constructor effects flush before viewChild resolves; guarding
  // with `?.` is simpler than wrapping in afterNextRender.
  private readonly flow = viewChild(NgFlowComponent);

  nodeTypes: Record<string, Type<unknown>> = { movingHandle: MovingHandleNodeComponent };

  nodes: Node[] = [
    { id: 'input', type: 'input', data: { label: 'input' }, position: { x: -300, y: 0 }, sourcePosition: Position.Right },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      type: 'movingHandle',
      position: { x: 0, y: i * 60 },
      data: {},
    })),
  ];

  edges: Edge[] = [];

  private rafHandle: number | null = null;

  constructor() {
    effect(() => {
      const flow = this.flow()?.service;
      if (!flow) return;
      const inProgress = flow.connection().inProgress;
      if (!inProgress) return;
      const nodeIds = this.nodes.filter((n) => n.type === 'movingHandle').map((n) => n.id);
      const startTime = performance.now();
      const tick = () => {
        if (performance.now() - startTime < 500) {
          flow.updateNodeInternals(nodeIds);
          this.rafHandle = requestAnimationFrame(tick);
        } else {
          this.rafHandle = null;
        }
      };
      tick();
    });
  }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void {
    this.edges = addEdge({ ...connection, animated: true }, this.edges) as Edge[];
  }

  ngOnDestroy(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
  }
}
