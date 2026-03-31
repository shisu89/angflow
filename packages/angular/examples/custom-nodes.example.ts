/**
 * Custom Nodes Example
 *
 * Demonstrates custom node components:
 * - Defining a custom node component with signal inputs
 * - Using Handle component for connections
 * - Passing nodeTypes to NgFlowComponent
 * - Styled custom content
 */
import { Component, input } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  BackgroundComponent,
  MiniMapComponent,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from '../src/lib/public-api';

// Custom node component
@Component({
  selector: 'app-color-node',
  standalone: true,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div [style.background]="data()?.color || '#eee'" style="padding: 10px; border-radius: 5px; min-width: 100px;">
      <strong>{{ data()?.label }}</strong>
      <div style="font-size: 10px; color: #666;">{{ data()?.description }}</div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
})
export class ColorNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly isConnectable = input(true);
}

// Main example component
@Component({
  selector: 'app-custom-nodes-flow',
  standalone: true,
  imports: [NgFlowComponent, BackgroundComponent, MiniMapComponent],
  template: `
    <div style="width: 100vw; height: 100vh;">
      <ng-flow
        [defaultNodes]="nodes"
        [defaultEdges]="edges"
        [nodeTypes]="nodeTypes"
        [fitView]="true"
      >
        <ng-flow-background variant="lines" />
        <ng-flow-minimap />
      </ng-flow>
    </div>
  `,
})
export class CustomNodesExample {
  nodeTypes: NodeTypes = {
    colorNode: ColorNodeComponent,
  };

  nodes: Node[] = [
    {
      id: '1',
      type: 'colorNode',
      position: { x: 100, y: 0 },
      data: { label: 'Start', description: 'Entry point', color: '#d4edda' },
    },
    {
      id: '2',
      type: 'colorNode',
      position: { x: 0, y: 150 },
      data: { label: 'Process A', description: 'Data validation', color: '#cce5ff' },
    },
    {
      id: '3',
      type: 'colorNode',
      position: { x: 250, y: 150 },
      data: { label: 'Process B', description: 'Transformation', color: '#fff3cd' },
    },
    {
      id: '4',
      type: 'colorNode',
      position: { x: 100, y: 300 },
      data: { label: 'End', description: 'Output result', color: '#f8d7da' },
    },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' },
  ];
}
