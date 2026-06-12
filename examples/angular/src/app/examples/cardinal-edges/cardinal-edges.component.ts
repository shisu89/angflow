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
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

// ── Cardinal helper ────────────────────────────────────────────────────────
// Picks which side of the source node faces the target (and vice versa), so
// the edge snaps to one of four cardinal midpoints on each node.

const NODE_W = 120;
const NODE_H = 48;

function pickCardinalHandles(
  sourceNode: Node,
  targetNode: Node,
): { sourceHandle: string; targetHandle: string } {
  const sx = sourceNode.position.x + NODE_W / 2;
  const sy = sourceNode.position.y + NODE_H / 2;
  const tx = targetNode.position.x + NODE_W / 2;
  const ty = targetNode.position.y + NODE_H / 2;
  const dx = tx - sx;
  const dy = ty - sy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left',  targetHandle: 'right' };
  }
  return dy > 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top',    targetHandle: 'bottom' };
}

// ── Node with 4 cardinal handles ────────────────────────────────────────────

@Component({
  selector: 'app-cardinal-node',
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
    <div class="cardinal-node" [style.background]="data()?.color ?? '#e0e7ff'">
      {{ data()?.label }}
    </div>
  `,
  styles: [`
    .cardinal-node {
      padding: 14px 22px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      border: 2px solid #c7d2fe;
      min-width: 80px;
      text-align: center;
    }
    /* Fixed cardinal handles: solid indigo dots at all four midpoints. */
    :host ::ng-deep .xy-flow__handle {
      width: 10px;
      height: 10px;
      background: #6366f1;
      border: 2px solid #312e81;
      opacity: 1;
    }
  `],
})
export class CardinalNodeComponent {
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

// ── Example page ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-cardinal-edges-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Cardinal edges"
      description="Edges snap to one of four cardinal handles (top/right/bottom/left) based on the relative position of source and target. Use when you want predictable, orthogonal-friendly endpoint positions — the alternative to the smooth perimeter-slide of the Floating Edges example."
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
export class CardinalEdgesExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { cardinal: CardinalNodeComponent };

  nodes: Node[] = [
    { id: '1', type: 'cardinal', position: { x:   0, y: 100 }, data: { label: 'A', color: '#dbeafe' } },
    { id: '2', type: 'cardinal', position: { x: 260, y:   0 }, data: { label: 'B', color: '#dcfce7' } },
    { id: '3', type: 'cardinal', position: { x: 260, y: 200 }, data: { label: 'C', color: '#fef3c7' } },
    { id: '4', type: 'cardinal', position: { x: 540, y: 100 }, data: { label: 'D', color: '#fce7f3' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e1-3', source: '1', target: '3', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e2-4', source: '2', target: '4', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e3-4', source: '3', target: '4', sourceHandle: 'right', targetHandle: 'left' },
  ];

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
    this.recomputeEdgeHandles();
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
    this.recomputeEdgeHandles();
  }

  /**
   * After every node move, pick the pair of cardinal handles that face each other
   * and rewrite the edge's sourceHandle / targetHandle. Endpoints will snap to
   * one of four midpoints on each node rather than sliding smoothly.
   */
  private recomputeEdgeHandles(): void {
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    let changed = false;
    const updated = this.edges.map((edge) => {
      const s = byId.get(edge.source);
      const t = byId.get(edge.target);
      if (!s || !t) return edge;
      const { sourceHandle, targetHandle } = pickCardinalHandles(s, t);
      if (edge.sourceHandle !== sourceHandle || edge.targetHandle !== targetHandle) {
        changed = true;
        return { ...edge, sourceHandle, targetHandle };
      }
      return edge;
    });
    if (changed) this.edges = updated;
  }
}
