import { Component, ChangeDetectionStrategy, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-drag-handle-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="dh-body">
      <span>Only draggable here →</span>
      <span class="custom-drag-handle" role="button" aria-label="Drag handle"></span>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
  styles: [`
    .dh-body {
      display: flex; align-items: center; gap: 8px;
      padding: 20px 40px;
      border: 1px solid #ddd; background: #fff;
      font-size: 12px; color: #334155;
    }
    .custom-drag-handle {
      display: inline-block; width: 24px; height: 24px;
      background: teal; border-radius: 50%;
      cursor: grab;
    }
    .custom-drag-handle:active { cursor: grabbing; }
  `],
})
export class DragHandleNodeComponent {
  readonly Position = Position;
}

@Component({
  selector: 'app-drag-handle-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Drag handle"
      description="Restrict where a node's drag starts using the dragHandle CSS selector. Clicking the body won't drag; only pressing the teal circle does."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [nodeDragThreshold]="0"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeClick)="onNodeClick($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class DragHandleExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { dragHandleNode: DragHandleNodeComponent };

  nodes: Node[] = [
    { id: '2', type: 'dragHandleNode', dragHandle: '.custom-drag-handle', position: { x: 200, y: 200 }, data: {} },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  onNodeClick(event: { event: MouseEvent; node: Node }): void { console.log('click', event.node); }
}
