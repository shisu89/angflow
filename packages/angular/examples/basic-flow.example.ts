/**
 * Basic Angular Flow Example
 *
 * Demonstrates the simplest usage of @angflow/angular:
 * - Default nodes with drag, pan, zoom
 * - Built-in node types (default, input, output)
 * - Bezier edges
 * - Background pattern
 * - Controls overlay
 *
 * Usage:
 *   <app-basic-flow />
 */
import { Component } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  type Node,
  type Edge,
} from '../src/lib/public-api';

@Component({
  selector: 'app-basic-flow',
  standalone: true,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent],
  template: `
    <div style="width: 100vw; height: 100vh;">
      <ng-flow
        [defaultNodes]="nodes"
        [defaultEdges]="edges"
        [fitView]="true"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls />
      </ng-flow>
    </div>
  `,
})
export class BasicFlowExample {
  nodes: Node[] = [
    {
      id: '1',
      type: 'input',
      position: { x: 250, y: 0 },
      data: { label: 'Input Node' },
    },
    {
      id: '2',
      position: { x: 100, y: 100 },
      data: { label: 'Default Node' },
    },
    {
      id: '3',
      position: { x: 400, y: 100 },
      data: { label: 'Another Node' },
    },
    {
      id: '4',
      type: 'output',
      position: { x: 250, y: 200 },
      data: { label: 'Output Node' },
    },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' },
  ];
}
