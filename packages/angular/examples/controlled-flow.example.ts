/**
 * Controlled Flow Example
 *
 * Demonstrates controlled mode:
 * - Two-way binding with [(nodes)] and [(edges)]
 * - Handling onNodesChange and onEdgesChange
 * - Programmatic add/remove of nodes
 * - Using NgFlowService for viewport control
 * - Edge creation via onConnect
 */
import { Component, inject, signal } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  BackgroundComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '../src/lib/public-api';

@Component({
  selector: 'app-controlled-flow',
  standalone: true,
  imports: [NgFlowComponent, ControlsComponent, BackgroundComponent, PanelComponent],
  template: `
    <div style="width: 100vw; height: 100vh;">
      <ng-flow
        [(nodes)]="nodes"
        [(edges)]="edges"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeClick)="onNodeClick($event)"
        [fitView]="true"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls />

        <ng-flow-panel position="top-right">
          <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">
            <button (click)="addNode()">Add Node</button>
            <button (click)="removeSelected()">Remove Selected</button>
            <button (click)="fitView()">Fit View</button>
            <div style="margin-top: 5px; font-size: 12px; color: #666;">
              Nodes: {{ nodes.length }} | Edges: {{ edges.length }}
            </div>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </div>
  `,
})
export class ControlledFlowExample {
  private flowService = inject(NgFlowService);
  private nodeIdCounter = 4;

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 250, y: 0 }, data: { label: 'Start' } },
    { id: '2', position: { x: 100, y: 100 }, data: { label: 'Node 2' } },
    { id: '3', position: { x: 400, y: 100 }, data: { label: 'Node 3' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
  ];

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  onNodeClick(event: { event: MouseEvent; node: Node }): void {
    console.log('Node clicked:', event.node.id);
  }

  addNode(): void {
    const id = `${++this.nodeIdCounter}`;
    const newNode: Node = {
      id,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `Node ${id}` },
    };
    this.nodes = [...this.nodes, newNode];
  }

  removeSelected(): void {
    const selectedNodeIds = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id));
    this.edges = this.edges.filter((e) => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target));
    this.nodes = this.nodes.filter((n) => !n.selected);
  }

  fitView(): void {
    this.flowService.fitView({ padding: 0.2 });
  }
}
