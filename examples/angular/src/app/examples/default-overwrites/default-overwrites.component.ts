import { Component, ChangeDetectionStrategy, input, computed, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  HandleComponent,
  BaseEdgeComponent,
  Position,
  getBezierPath,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-custom-default-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="cdn">Custom default node</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    .cdn {
      padding: 10px 14px; background: #fef3c7; border: 1px solid #f59e0b;
      border-radius: 4px; font-size: 13px; color: #78350f;
    }
  `],
})
export class CustomDefaultNodeComponent {
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

@Component({
  selector: 'app-custom-default-edge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseEdgeComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-base-edge
      [path]="path()"
      [style]="'stroke: red; stroke-width: 3; stroke-dasharray: 5,5'"
    />
  `,
})
export class CustomDefaultEdgeComponent {
  readonly id = input.required<string>();
  readonly sourceX = input.required<number>();
  readonly sourceY = input.required<number>();
  readonly targetX = input.required<number>();
  readonly targetY = input.required<number>();
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly source = input<string>();
  readonly target = input<string>();
  readonly selected = input(false);

  readonly path = computed(() => {
    const [d] = getBezierPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
    });
    return d;
  });
}

@Component({
  selector: 'app-default-overwrites-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Default overwrites"
      description="Register your own component as the default node and default edge. Any node or edge without an explicit type (or with type 'default') uses these custom versions — ship house defaults for every flow in your app."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [edgeTypes]="edgeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="lines" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class DefaultOverwritesExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { default: CustomDefaultNodeComponent };
  edgeTypes: Record<string, Type<unknown>> = { default: CustomDefaultEdgeComponent };

  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2', data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
