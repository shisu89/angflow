/**
 * Performance Test Example
 *
 * Generates 500+ nodes in a grid layout to verify:
 * - Signal-based reactivity performance
 * - onlyRenderVisibleElements optimization
 * - Smooth pan/zoom with large node counts
 * - Memory usage with many NgComponentOutlet instances
 */
import { Component, signal, computed } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  type Node,
  type Edge,
} from '../src/lib/public-api';

function generateGrid(rows: number, cols: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const spacingX = 200;
  const spacingY = 100;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = `${row}-${col}`;
      nodes.push({
        id,
        position: { x: col * spacingX, y: row * spacingY },
        data: { label: `Node ${id}` },
      });

      // Horizontal edges
      if (col > 0) {
        edges.push({
          id: `e-${row}-${col - 1}-${row}-${col}`,
          source: `${row}-${col - 1}`,
          target: id,
        });
      }

      // Vertical edges
      if (row > 0) {
        edges.push({
          id: `e-${row - 1}-${col}-${row}-${col}`,
          source: `${row - 1}-${col}`,
          target: id,
        });
      }
    }
  }

  return { nodes, edges };
}

@Component({
  selector: 'app-performance-test',
  standalone: true,
  imports: [NgFlowComponent, ControlsComponent, MiniMapComponent, PanelComponent],
  template: `
    <div style="width: 100vw; height: 100vh;">
      <ng-flow
        [defaultNodes]="gridData().nodes"
        [defaultEdges]="gridData().edges"
        [fitView]="true"
        [onlyRenderVisibleElements]="renderVisible()"
        [minZoom]="0.1"
        [maxZoom]="4"
      >
        <ng-flow-controls />
        <ng-flow-minimap />

        <ng-flow-panel position="top-right">
          <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); font-family: monospace; font-size: 12px;">
            <div><strong>Performance Test</strong></div>
            <div>Nodes: {{ gridData().nodes.length }}</div>
            <div>Edges: {{ gridData().edges.length }}</div>
            <div style="margin-top: 8px;">
              <label>
                <input type="checkbox" [checked]="renderVisible()" (change)="renderVisible.set(!renderVisible())" />
                onlyRenderVisibleElements
              </label>
            </div>
            <div style="margin-top: 8px;">
              Grid size:
              <button (click)="setGrid(10, 10)">10x10 (100)</button>
              <button (click)="setGrid(20, 25)">20x25 (500)</button>
              <button (click)="setGrid(30, 35)">30x35 (1050)</button>
            </div>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </div>
  `,
})
export class PerformanceTestExample {
  readonly rows = signal(20);
  readonly cols = signal(25);
  readonly renderVisible = signal(true);

  readonly gridData = computed(() => generateGrid(this.rows(), this.cols()));

  setGrid(rows: number, cols: number): void {
    this.rows.set(rows);
    this.cols.set(cols);
  }
}
