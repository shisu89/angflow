import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  Type,
} from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  AfHandleGroupComponent,
  AfHandleRowComponent,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NgFlowService,
  getBezierPath,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
  type SystemHandle,
} from '@angflow/angular';

const COLORS: Record<string, string> = {
  string: '#10b981',
  number: '#3b82f6',
  boolean: '#ef4444',
};

@Component({
  selector: 'th-typed-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, AfHandleGroupComponent, AfHandleRowComponent],
  host: { style: 'display: contents;' },
  template: `
    <div class="node">
      <div class="node-title">{{ data()?.label ?? 'Node' }}</div>
      <af-handle-group [position]="'left'">
        <af-handle-row label="str">
          <ng-flow-handle type="target" id="in-str" [position]="pos.Left" [data]="'string'" />
        </af-handle-row>
        <af-handle-row label="num">
          <ng-flow-handle type="target" id="in-num" [position]="pos.Left" [data]="'number'" />
        </af-handle-row>
      </af-handle-group>
      <af-handle-group [position]="'right'">
        <af-handle-row label="str">
          <ng-flow-handle type="source" id="out-str" [position]="pos.Right" [data]="'string'" />
        </af-handle-row>
        <af-handle-row label="bool">
          <ng-flow-handle type="source" id="out-bool" [position]="pos.Right" [data]="'boolean'" />
        </af-handle-row>
      </af-handle-group>
    </div>
  `,
  styles: `
    .node {
      position: relative;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 8px 40px;
      min-width: 140px;
      min-height: 72px;
      font-size: 12px;
    }
    .node-title { font-weight: 600; text-align: center; }
    :host ::ng-deep .xy-flow__handle {
      position: static;
      transform: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  `,
})
export class ThTypedNodeComponent {
  readonly id = input.required<string>();
  readonly data = input<{ label?: string }>();
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly pos = Position;
}

@Component({
  selector: 'th-typed-line',
  template: `
    <svg style="overflow: visible; position: absolute; width: 100%; height: 100%; pointer-events: none;">
      <path [attr.d]="path()" [attr.stroke]="color()" stroke-width="2" fill="none" />
    </svg>
  `,
})
export class ThTypedLineComponent {
  readonly fromX = input(0);
  readonly fromY = input(0);
  readonly toX = input(0);
  readonly toY = input(0);
  readonly fromPosition = input<Position>(Position.Right);
  readonly toPosition = input<Position>(Position.Left);
  readonly fromHandle = input<SystemHandle | null>(null);

  readonly color = computed(() => {
    const d = this.fromHandle()?.data as string | undefined;
    return d ? COLORS[d] ?? '#888' : '#888';
  });

  readonly path = computed(() => {
    const [p] = getBezierPath({
      sourceX: this.fromX(),
      sourceY: this.fromY(),
      targetX: this.toX(),
      targetY: this.toY(),
      sourcePosition: this.fromPosition(),
      targetPosition: this.toPosition(),
    });
    return p;
  });
}

@Component({
  selector: 'th-typed-edge',
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
      <path class="xy-flow__edge-path" [attr.d]="path()" [attr.stroke]="color()" fill="none" stroke-width="2" />
    </svg>
  `,
})
export class ThTypedEdgeComponent {
  readonly sourceX = input(0);
  readonly sourceY = input(0);
  readonly targetX = input(0);
  readonly targetY = input(0);
  readonly sourcePosition = input<Position>(Position.Right);
  readonly targetPosition = input<Position>(Position.Left);
  readonly sourceHandle = input<SystemHandle | null>(null);
  readonly targetHandle = input<SystemHandle | null>(null);

  readonly color = computed(() => {
    const d = this.sourceHandle()?.data as string | undefined;
    return d ? COLORS[d] ?? '#888' : '#888';
  });

  readonly path = computed(() => {
    const [p] = getBezierPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
      sourcePosition: this.sourcePosition(),
      targetPosition: this.targetPosition(),
    });
    return p;
  });
}

@Component({
  selector: 'app-typed-handles-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent],
  template: `
    <ng-flow
      [nodes]="nodes()"
      [edges]="edges()"
      [nodeTypes]="nodeTypes"
      [edgeTypes]="edgeTypes"
      [connectionLineComponent]="connectionLine"
      [fitView]="true"
      [isValidConnection]="isValidConnection"
      (init)="onFlowInit($event)"
      (nodesChange)="onNodesChange($event)"
      (edgesChange)="onEdgesChange($event)"
      (connect)="onConnect($event)"
    >
      <ng-flow-background />
      <ng-flow-controls />
    </ng-flow>
  `,
  styles: `:host { display: flex; flex: 1; }`,
})
export class TypedHandlesExampleComponent {
  private flow?: NgFlowService;

  readonly connectionLine = ThTypedLineComponent;

  readonly nodes = signal<Node[]>([
    { id: 'a', type: 'th', data: { label: 'A' }, position: { x: 0, y: 0 } },
    { id: 'b', type: 'th', data: { label: 'B' }, position: { x: 260, y: 40 } },
    { id: 'c', type: 'th', data: { label: 'C' }, position: { x: 520, y: 0 } },
  ]);

  readonly edges = signal<Edge[]>([
    { id: 'e1', source: 'a', target: 'b', sourceHandle: 'out-str', targetHandle: 'in-str', type: 'typed' },
    { id: 'e2', source: 'b', target: 'c', sourceHandle: 'out-bool', targetHandle: 'in-num', type: 'typed' },
  ]);

  readonly nodeTypes: Record<string, Type<unknown>> = { th: ThTypedNodeComponent };
  readonly edgeTypes: Record<string, Type<unknown>> = { typed: ThTypedEdgeComponent };

  readonly isValidConnection: IsValidConnection = (conn) => {
    if (!this.flow) return true;
    const src = this.flow.getHandleData(conn.source, conn.sourceHandle ?? null, 'source');
    const tgt = this.flow.getHandleData(conn.target, conn.targetHandle ?? null, 'target');
    return src != null && tgt != null && src === tgt;
  };

  onFlowInit(service: NgFlowService): void {
    this.flow = service;
  }

  onNodesChange(changes: unknown[]): void {
    this.nodes.set(applyNodeChanges(changes as Parameters<typeof applyNodeChanges>[0], this.nodes()));
  }

  onEdgesChange(changes: unknown[]): void {
    this.edges.set(applyEdgeChanges(changes as Parameters<typeof applyEdgeChanges>[0], this.edges()));
  }

  onConnect(connection: Connection): void {
    this.edges.set(addEdge({ ...connection, type: 'typed' }, this.edges()) as Edge[]);
  }
}
