import { Component, ChangeDetectionStrategy, signal, viewChild, OnDestroy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const CANCEL_AFTER = 5; // seconds

@Component({
  selector: 'app-cancel-connection-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    MiniMapComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Cancel connection"
      description="Starts a 5-second countdown when you begin dragging a connection. If the connection doesn't resolve by then, it's cancelled programmatically via FlowStore.cancelConnection()."
    >
      @if (counting()) {
        <div class="timer" role="timer" aria-live="polite">
          Connection will cancel in {{ remaining().toFixed(1) }}s
        </div>
      }
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        [maxZoom]="2"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (connectStart)="startCountdown()"
        (connectEnd)="stopCountdown()"
      >
        <ng-flow-background />
        <ng-flow-minimap />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; position: relative; }
    .timer {
      position: absolute;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      padding: 8px 14px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  `],
})
export class CancelConnectionExampleComponent implements OnDestroy {
  private readonly flow = viewChild.required(NgFlowComponent);

  readonly counting = signal(false);
  readonly remaining = signal(CANCEL_AFTER);

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 120 } },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 120 } },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }

  onConnect(connection: Connection): void {
    this.stopCountdown();
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  startCountdown(): void {
    this.stopCountdown();
    this.counting.set(true);
    this.remaining.set(CANCEL_AFTER);
    const start = performance.now();
    this.timerHandle = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      this.remaining.set(Math.max(0, CANCEL_AFTER - elapsed));
    }, 100);
    this.timeoutHandle = setTimeout(() => {
      this.flow().store.cancelConnection();
      this.stopCountdown();
    }, CANCEL_AFTER * 1000);
  }

  stopCountdown(): void {
    this.counting.set(false);
    if (this.timerHandle !== null) { clearInterval(this.timerHandle); this.timerHandle = null; }
    if (this.timeoutHandle !== null) { clearTimeout(this.timeoutHandle); this.timeoutHandle = null; }
  }

  ngOnDestroy(): void { this.stopCountdown(); }
}
