/**
 * Event Verification Example
 *
 * This example wires up ALL event outputs from NgFlowComponent and logs them
 * to the console, serving as a manual verification harness for event coverage.
 *
 * Events covered:
 * - Node: click, doubleClick, contextMenu, mouseEnter, mouseLeave, dragStart, drag, dragStop
 * - Edge: click, doubleClick, contextMenu, mouseEnter, mouseLeave
 * - Connection: connect, connectStart, connectEnd
 * - Reconnection: reconnect, reconnectStart, reconnectEnd
 * - Pane: click, contextMenu, mouseEnter, mouseMove, mouseLeave
 * - Viewport: moveStart, move, moveEnd, viewportChange
 * - Selection: selectionChange
 * - Delete: nodesDelete, edgesDelete, delete
 * - State: nodesChange, edgesChange
 * - Lifecycle: init
 */
import { Component } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  type Node,
  type Edge,
  type Connection,
  type Viewport,
} from '../src/lib/public-api';

@Component({
  selector: 'app-event-verification',
  standalone: true,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent],
  template: `
    <div style="width: 100vw; height: 100vh;">
      <ng-flow
        [defaultNodes]="nodes"
        [defaultEdges]="edges"
        [fitView]="true"
        [edgesReconnectable]="true"

        (init)="log('init', $event)"

        (nodesChange)="log('nodesChange', $event)"
        (edgesChange)="log('edgesChange', $event)"

        (nodeClick)="log('nodeClick', $event)"
        (nodeDoubleClick)="log('nodeDoubleClick', $event)"
        (nodeContextMenu)="log('nodeContextMenu', $event)"
        (nodeMouseEnter)="log('nodeMouseEnter', $event)"
        (nodeMouseLeave)="log('nodeMouseLeave', $event)"
        (nodeDragStart)="log('nodeDragStart', $event)"
        (nodeDrag)="log('nodeDrag', $event)"
        (nodeDragStop)="log('nodeDragStop', $event)"

        (edgeClick)="log('edgeClick', $event)"
        (edgeDoubleClick)="log('edgeDoubleClick', $event)"
        (edgeContextMenu)="log('edgeContextMenu', $event)"
        (edgeMouseEnter)="log('edgeMouseEnter', $event)"
        (edgeMouseLeave)="log('edgeMouseLeave', $event)"

        (connect)="log('connect', $event)"
        (connectStart)="log('connectStart', $event)"
        (connectEnd)="log('connectEnd', $event)"

        (reconnect)="log('reconnect', $event)"
        (reconnectStart)="log('reconnectStart', $event)"
        (reconnectEnd)="log('reconnectEnd', $event)"

        (paneClick)="log('paneClick', $event)"
        (paneContextMenu)="log('paneContextMenu', $event)"
        (paneMouseEnter)="log('paneMouseEnter', $event)"
        (paneMouseMove)="logThrottled('paneMouseMove', $event)"
        (paneMouseLeave)="log('paneMouseLeave', $event)"

        (moveStart)="log('moveStart', $event)"
        (move)="logThrottled('move', $event)"
        (moveEnd)="log('moveEnd', $event)"
        (viewportChange)="logThrottled('viewportChange', $event)"

        (selectionChange)="log('selectionChange', $event)"

        (nodesDelete)="log('nodesDelete', $event)"
        (edgesDelete)="log('edgesDelete', $event)"
        (delete)="log('delete', $event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls />
      </ng-flow>
    </div>
  `,
})
export class EventVerificationExample {
  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 250, y: 0 }, data: { label: 'Input' } },
    { id: '2', position: { x: 100, y: 150 }, data: { label: 'Node A' } },
    { id: '3', position: { x: 400, y: 150 }, data: { label: 'Node B' } },
    { id: '4', type: 'output', position: { x: 250, y: 300 }, data: { label: 'Output' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' },
  ];

  private throttleTimers = new Map<string, number>();

  log(eventName: string, data: any): void {
    console.log(`[NgFlow Event] ${eventName}:`, data);
  }

  logThrottled(eventName: string, data: any): void {
    const now = Date.now();
    const last = this.throttleTimers.get(eventName) ?? 0;
    if (now - last > 500) {
      this.throttleTimers.set(eventName, now);
      console.log(`[NgFlow Event] ${eventName}:`, data);
    }
  }
}
