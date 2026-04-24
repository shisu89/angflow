import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

import { getNodesAndEdges } from './utils';
import {
  FrameRecorder,
  nextFrame,
  generateMouseEventParamsTargetingNode,
} from './perf-utils';

const INITIAL = getNodesAndEdges(25, 25);

@Component({
  selector: 'app-stress-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Stress"
      description="625-node / 624-edge flow for performance testing. Each button synthesizes pointer events and prints frame durations to the console — paste into observablehq.com/@iamakulov/long-frame-visualizer to inspect."
    >
      @if (mounted()) {
        <ng-flow
          [nodes]="nodes"
          [edges]="edges"
          [minZoom]="0.2"
          [fitView]="true"
          (nodesChange)="onNodesChange($event)"
          (edgesChange)="onEdgesChange($event)"
          (connect)="onConnect($event)"
        >
          <ng-flow-background />
          <ng-flow-controls />
          <ng-flow-panel position="top-right">
            <div class="st-panel">
              <button (click)="selectNode()">select node</button>
              <button (click)="dragInViewport()">drag node within the viewport</button>
              <button (click)="dragOutsideViewport()">drag node outside of the viewport</button>
              <button (click)="remount()">re-mount</button>
              <button (click)="updatePos()">change pos</button>
              <button (click)="updateElements()">update elements</button>
              <button (click)="addElement()">Add element</button>
            </div>
          </ng-flow-panel>
        </ng-flow>
      }
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .st-panel { display: flex; flex-direction: column; gap: 4px; }
    .st-panel button {
      font-size: 12px; padding: 4px 8px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class StressExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly mounted = signal(true);

  nodes: Node[] = INITIAL.nodes;
  edges: Edge[] = INITIAL.edges;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  async selectNode(): Promise<void> {
    const idx = Math.floor(Math.random() * this.nodes.length);
    const el = document.querySelector(`.xy-flow__node[data-id="${this.nodes[idx].id}"]`);
    if (!el) { console.warn('Node not found'); return; }

    const recorder = new FrameRecorder();
    const params = generateMouseEventParamsTargetingNode(el);

    recorder.setStage('mousedown');
    el.dispatchEvent(new MouseEvent('mousedown', params));
    await nextFrame();

    recorder.setStage('click');
    el.dispatchEvent(new MouseEvent('click', params));
    await nextFrame();

    recorder.setStage('mouseup');
    el.dispatchEvent(new MouseEvent('mouseup', params));
    await nextFrame();

    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  /**
   * Hold mousedown on node 18, move 5px left per frame for 20 frames, then mouseup.
   * Node 18 lives in the right portion of the viewport, so dragging left
   * doesn't risk auto-scrolling the viewport.
   */
  async dragInViewport(): Promise<void> {
    const el = document.querySelector(`.xy-flow__node[data-id="18"]`);
    if (!el) { console.warn('Node 18 not found'); return; }

    const recorder = new FrameRecorder();
    const downParams = generateMouseEventParamsTargetingNode(el);

    recorder.setStage('mousedown');
    el.dispatchEvent(new MouseEvent('mousedown', downParams));
    await nextFrame();

    recorder.setStage('mousemove');
    let x = downParams.clientX;
    for (let i = 0; i < 20; i++) {
      const dx = -5;
      x += dx;
      el.dispatchEvent(new MouseEvent('mousemove', { ...downParams, clientX: x, screenX: x, movementX: dx }));
      await nextFrame();
    }

    recorder.setStage('mouseup');
    el.dispatchEvent(new MouseEvent('mouseup', { ...downParams, clientX: x, screenX: x }));
    await nextFrame();

    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  /**
   * Hold mousedown on a random node, wiggle near the top of the viewport so the
   * viewport scrolls. Tests the auto-pan-on-drag-out-of-bounds path.
   */
  async dragOutsideViewport(): Promise<void> {
    const idx = Math.floor(Math.random() * this.nodes.length);
    const el = document.querySelector(`.xy-flow__node[data-id="${this.nodes[idx].id}"]`);
    if (!el) { console.warn('Node not found'); return; }

    const recorder = new FrameRecorder();
    const downParams = generateMouseEventParamsTargetingNode(el);

    recorder.setStage('mousedown');
    el.dispatchEvent(new MouseEvent('mousedown', downParams));
    await nextFrame();

    recorder.setStage('mousemove');
    let y = 50;
    for (let i = 0; i < 20; i++) {
      const dy = Math.random() > 0.5 ? +2 : -2;
      y += dy;
      el.dispatchEvent(new MouseEvent('mousemove', { ...downParams, clientY: y, screenY: y, movementY: dy }));
      await nextFrame();
    }

    recorder.setStage('mouseup');
    el.dispatchEvent(new MouseEvent('mouseup', { ...downParams, clientY: y, screenY: y }));
    await nextFrame();

    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  /**
   * Toggle `mounted` off and on so Angular tears down and re-creates the
   * `<ng-flow>`. This is the Angular equivalent of React's `key`-based remount.
   * Uses a microtask boundary so the destroy and create phases land on
   * separate change-detection cycles.
   */
  async remount(): Promise<void> {
    const recorder = new FrameRecorder();
    this.mounted.set(false);
    await Promise.resolve();
    this.mounted.set(true);
    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  updatePos(): void {
    this.nodes = this.nodes.map((n) => ({
      ...n,
      position: {
        x: Math.random() * window.innerWidth * 4,
        y: Math.random() * window.innerHeight * 4,
      },
    }));
    this.flow.fitView();
  }

  updateElements(): void {
    const grid = Math.ceil(Math.random() * 10);
    const fresh = getNodesAndEdges(grid, grid);
    this.nodes = fresh.nodes;
    this.edges = fresh.edges;
  }

  addElement(): void {
    const id = (this.nodes.length + 1).toString();
    this.nodes = [...this.nodes, { id, position: { x: 0, y: 0 }, data: { label: `Node ${id}` } }];
  }

  private logFrames(recorder: FrameRecorder): void {
    console.log('Frame durations:', recorder.getFrames());
    console.log(
      'Frame durations for Observable (paste into https://observablehq.com/@iamakulov/long-frame-visualizer):',
      recorder.getFramesForObservable(),
    );
  }
}
