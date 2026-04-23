import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  HandleComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-detached-handle-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="dh-body">Custom node</div>
    <ng-flow-handle type="source" [position]="Position.Right">
      <button class="detached-handle" aria-label="source handle">➡️</button>
    </ng-flow-handle>
  `,
  styles: [`
    .dh-body {
      padding: 10px 18px; background: #fff; border: 1px solid #cbd5e1;
      border-radius: 4px; font-size: 13px; color: #334155;
    }
    .detached-handle {
      position: relative; left: 24px;
      padding: 2px 6px; font-size: 14px;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 4px;
      cursor: pointer;
    }
  `],
})
export class DetachedHandleNodeComponent {
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
  selector: 'app-detached-handle-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Detached handle"
      description="Render a handle in arbitrary DOM — here as a button offset outside the node body. The flow still snaps connections to it via the connectionRadius setting."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [connectionRadius]="10"
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
export class DetachedHandleExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { default: DetachedHandleNodeComponent };

  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2', data: { label: 'Node 2' }, position: { x:  50, y: 100 } },
    { id: '3', data: { label: 'Node 3' }, position: { x: 450, y: 100 } },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
