import { Component, ChangeDetectionStrategy, signal, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  NodeToolbarComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  injectNgFlowNode,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

type ToolbarNodeData = {
  label: string;
  onCopy?: () => void;
  onDelete?: () => void;
};

@Component({
  selector: 'app-toolbar-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeToolbarComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-node-toolbar [position]="Position.Top">
      <div class="toolbar">
        <button type="button" class="toolbar__btn" aria-label="Copy node" (click)="node.data()?.onCopy?.()">Copy</button>
        <button type="button" class="toolbar__btn toolbar__btn--danger" aria-label="Delete node" (click)="node.data()?.onDelete?.()">Delete</button>
      </div>
    </ng-flow-node-toolbar>
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="node" [class.node--selected]="node.selected()">
      <div class="node__label">{{ node.data()?.label }}</div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
  styles: [`
    .node {
      min-width: 140px;
      padding: 12px 18px;
      background: #ffffff;
      border: 1px solid #1a192b;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .node:hover {
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.06), 0 4px 10px rgba(15, 23, 42, 0.08);
    }
    .node--selected {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25), 0 4px 12px rgba(99, 102, 241, 0.18);
    }
    .node__label {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      text-align: center;
      letter-spacing: 0.01em;
    }
    .toolbar {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
      white-space: nowrap;
    }
    .toolbar__btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      border: none;
      border-radius: 5px;
      background: transparent;
      color: #475569;
      cursor: pointer;
      font-family: inherit;
    }
    .toolbar__btn:hover { background: #f1f5f9; }
    .toolbar__btn--danger { color: #dc2626; }
    .toolbar__btn--danger:hover { background: #fef2f2; }
  `],
})
export class ToolbarNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<ToolbarNodeData>();
}

@Component({
  selector: 'app-node-toolbar-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Node Toolbar"
      description="Select a node to reveal a floating toolbar. Copy duplicates the node; Delete removes it along with its connected edges."
    >
      <ng-flow
        [nodes]="nodes()"
        [edges]="edges()"
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
export class NodeToolbarExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    toolbar: ToolbarNodeComponent,
  };

  readonly nodes = signal<Node[]>([
    { id: '1', type: 'toolbar', position: { x: 0, y: 60 }, data: this.makeData('Node A', '1') },
    { id: '2', type: 'toolbar', position: { x: 280, y: 0 }, data: this.makeData('Node B', '2') },
    { id: '3', type: 'toolbar', position: { x: 280, y: 120 }, data: this.makeData('Node C', '3') },
    { id: '4', type: 'toolbar', position: { x: 560, y: 60 }, data: this.makeData('Node D', '4') },
  ]);

  readonly edges = signal<Edge[]>([
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' },
  ]);

  onNodesChange(changes: NodeChange[]): void {
    this.nodes.update((ns) => applyNodeChanges(changes, ns));
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges.update((es) => applyEdgeChanges(changes, es));
  }

  onConnect(connection: Connection): void {
    this.edges.update((es) => addEdge(connection, es) as Edge[]);
  }

  private copyNode(id: string): void {
    this.nodes.update((ns) => {
      const original = ns.find((n) => n.id === id);
      if (!original) return ns;
      const newId = `${id}-copy-${Date.now()}`;
      const originalLabel = (original.data as ToolbarNodeData | undefined)?.label ?? 'Node';
      const copy: Node = {
        ...original,
        id: newId,
        selected: false,
        position: { x: original.position.x + 40, y: original.position.y + 40 },
        data: this.makeData(`${originalLabel} (copy)`, newId),
      };
      return [...ns, copy];
    });
  }

  private deleteNode(id: string): void {
    this.nodes.update((ns) => ns.filter((n) => n.id !== id));
    this.edges.update((es) => es.filter((e) => e.source !== id && e.target !== id));
  }

  private makeData(label: string, id: string): ToolbarNodeData {
    return {
      label,
      onCopy: () => this.copyNode(id),
      onDelete: () => this.deleteNode(id),
    };
  }
}
