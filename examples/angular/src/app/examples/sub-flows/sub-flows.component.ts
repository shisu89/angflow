import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-sub-flows-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Sub-flows"
      description="A container group node with child nodes. Drag a node into the dashed container to make it a child; drag a child out to detach it."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (init)="onInit($event)"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeDragStop)="onNodeDragStop($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls [showDelete]="true" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  `],
})
export class SubFlowsExampleComponent {
  private ngFlow?: NgFlowService;

  nodes: Node[] = [
    {
      id: 'group-a',
      type: 'group',
      position: { x: 40, y: 40 },
      data: {},
      style: {
        width: '320px',
        height: '200px',
        background: 'rgba(99, 102, 241, 0.08)',
        border: '2px dashed #6366f1',
        borderRadius: '12px',
      },
    },
    {
      id: 'a-1',
      position: { x: 30, y: 60 },
      data: { label: 'Child 1' },
      parentId: 'group-a',
    },
    {
      id: 'a-2',
      position: { x: 170, y: 100 },
      data: { label: 'Child 2' },
      parentId: 'group-a',
    },
    {
      id: 'out',
      type: 'output',
      position: { x: 440, y: 120 },
      data: { label: 'Outside' },
    },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: 'a-1', target: 'a-2' },
    { id: 'e2-out', source: 'a-2', target: 'out', animated: true },
  ];

  onInit(api: NgFlowService): void {
    this.ngFlow = api;
  }

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  /**
   * After a drag, reparent the dragged node based on which group it now sits over:
   * - Overlapping a group it isn't already in  → becomes a child of that group.
   * - No longer overlapping its current parent → detached from the parent.
   * Positions are recomputed so the node stays visually in place across the switch.
   */
  onNodeDragStop(ev: { event: MouseEvent; node: Node; nodes: Node[] }): void {
    const api = this.ngFlow;
    if (!api) return;

    // Process every node in the drag set (covers multi-select drags).
    let changed = false;
    const nextNodes = this.nodes.slice();

    for (const dragged of ev.nodes) {
      // Don't reparent the group itself.
      if (dragged.type === 'group') continue;

      const internal = api.getInternalNode(dragged.id);
      const abs = internal?.internals?.positionAbsolute;
      if (!abs) continue;

      // Find the first group node overlapping the dragged node (by absolute rect).
      const overlappingGroup = api
        .getIntersectingNodes(dragged)
        .find((n) => n.type === 'group' && n.id !== dragged.id);

      const newParentId: string | undefined = overlappingGroup?.id;
      const oldParentId = dragged.parentId;
      if (newParentId === oldParentId) continue;

      // Translate the absolute position into the new parent's coordinate space.
      let newPosition = abs;
      if (newParentId) {
        const parentAbs = api.getInternalNode(newParentId)?.internals?.positionAbsolute;
        if (parentAbs) {
          newPosition = { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y };
        }
      }

      const idx = nextNodes.findIndex((n) => n.id === dragged.id);
      if (idx < 0) continue;

      const updated: Node = { ...nextNodes[idx], position: newPosition };
      if (newParentId) {
        updated.parentId = newParentId;
      } else {
        delete (updated as { parentId?: string }).parentId;
      }
      nextNodes[idx] = updated;
      changed = true;
    }

    if (changed) {
      this.nodes = nextNodes;
    }
  }
}
