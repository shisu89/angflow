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
import { ExampleCardComponent } from '../_shared/example-card.component';

// ── Helper: pick the best handle pair for a given source→target ────

function getClosestSide(
  sourceNode: Node,
  targetNode: Node,
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number
): { sourceHandle: string; targetHandle: string } {
  const sx = sourceNode.position.x + sourceW / 2;
  const sy = sourceNode.position.y + sourceH / 2;
  const tx = targetNode.position.x + targetW / 2;
  const ty = targetNode.position.y + targetH / 2;

  const dx = tx - sx;
  const dy = ty - sy;

  let sourceHandle: string;
  let targetHandle: string;

  // Source: which side faces the target?
  if (Math.abs(dx) > Math.abs(dy)) {
    sourceHandle = dx > 0 ? 'right' : 'left';
    targetHandle = dx > 0 ? 'left' : 'right';
  } else {
    sourceHandle = dy > 0 ? 'bottom' : 'top';
    targetHandle = dy > 0 ? 'top' : 'bottom';
  }

  return { sourceHandle, targetHandle };
}

// ── Custom node with 4 handles (one per side) ─────────────────────

@Component({
  selector: 'app-floating-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="source" id="top"    [position]="Position.Top" />
    <ng-flow-handle type="source" id="right"  [position]="Position.Right" />
    <ng-flow-handle type="source" id="bottom" [position]="Position.Bottom" />
    <ng-flow-handle type="source" id="left"   [position]="Position.Left" />
    <ng-flow-handle type="target" id="top"    [position]="Position.Top" />
    <ng-flow-handle type="target" id="right"  [position]="Position.Right" />
    <ng-flow-handle type="target" id="bottom" [position]="Position.Bottom" />
    <ng-flow-handle type="target" id="left"   [position]="Position.Left" />
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
    :host ::ng-deep .xy-flow__handle {
      opacity: 0;
      width: 1px;
      height: 1px;
    }
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

// ── Example page ───────────────────────────────────────────────────

const NODE_W = 120; // approximate node widths
const NODE_H = 48;

@Component({
  selector: 'app-floating-edges-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Floating Edges"
      description="Edges connect at the nearest point on the node border instead of fixed handle positions. Drag nodes around to see the edges follow."
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
  };

  nodes: Node[] = [
    { id: '1', type: 'floating', position: { x: 0, y: 100 }, data: { label: 'Origin', color: '#dbeafe' } },
    { id: '2', type: 'floating', position: { x: 280, y: 0 }, data: { label: 'Service A', color: '#dcfce7' } },
    { id: '3', type: 'floating', position: { x: 280, y: 200 }, data: { label: 'Service B', color: '#fef3c7' } },
    { id: '4', type: 'floating', position: { x: 560, y: 40 }, data: { label: 'Database', color: '#fce7f3' } },
    { id: '5', type: 'floating', position: { x: 560, y: 180 }, data: { label: 'Cache', color: '#e0e7ff' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e1-3', source: '1', target: '3', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e2-4', source: '2', target: '4', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e3-5', source: '3', target: '5', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e2-5', source: '2', target: '5', sourceHandle: 'bottom', targetHandle: 'top' },
  ];

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
    this.updateEdgeHandles();
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
    this.updateEdgeHandles();
  }

  private updateEdgeHandles(): void {
    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));
    let changed = false;

    const updated = this.edges.map(edge => {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) return edge;

      const { sourceHandle, targetHandle } = getClosestSide(s, t, NODE_W, NODE_H, NODE_W, NODE_H);
      if (edge.sourceHandle !== sourceHandle || edge.targetHandle !== targetHandle) {
        changed = true;
        return { ...edge, sourceHandle, targetHandle };
      }
      return edge;
    });

    if (changed) {
      this.edges = updated;
    }
  }
}
