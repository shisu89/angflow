import { Component, ChangeDetectionStrategy, input, computed, Type } from '@angular/core';
import {
  NgFlowComponent,
  EdgeLabelRendererComponent,
  BackgroundComponent,
  ControlsComponent,
  Position,
  getBezierPath,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

// Custom edge: inline SVG with a gradient stroke + a blurred glow underlay,
// plus a gradient-pill label rendered via EdgeLabelRenderer. We drop
// BaseEdgeComponent here on purpose — it only renders a single <path>, and
// this example's whole point is to show what a "go lower-level" custom edge
// looks like. Everything below (defs, gradient, filter, two stacked paths,
// pill styling) is code you own in your own app.
@Component({
  selector: 'app-labeled-edge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EdgeLabelRendererComponent],
  host: { 'style': 'display: contents;' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;"
    >
      <defs>
        <linearGradient [attr.id]="gradientId()" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="50%" stop-color="#a855f7" />
          <stop offset="100%" stop-color="#ec4899" />
        </linearGradient>
        <filter [attr.id]="glowId()" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <!-- blurred underlay: the "glow" -->
      <path
        [attr.d]="pathData().d"
        [attr.stroke]="'url(#' + gradientId() + ')'"
        [attr.filter]="'url(#' + glowId() + ')'"
        fill="none"
        stroke-width="8"
        stroke-linecap="round"
        opacity="0.45"
      />
      <!-- crisp top path -->
      <path
        [attr.d]="pathData().d"
        [attr.stroke]="'url(#' + gradientId() + ')'"
        [attr.marker-end]="markerEnd()"
        fill="none"
        stroke-width="2.75"
        stroke-linecap="round"
      />
    </svg>
    <ng-flow-edge-label-renderer>
      <div
        class="labeled-edge__label"
        [style.transform]="'translate(-50%, -50%) translate(' + pathData().labelX + 'px, ' + pathData().labelY + 'px)'"
      >
        <span class="labeled-edge__glyph">✦</span>
        {{ data()?.label || 'edge' }}
      </div>
    </ng-flow-edge-label-renderer>
  `,
  styles: [`
    .labeled-edge__label {
      position: absolute;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.01em;
      border-radius: 999px;
      pointer-events: all;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45), 0 1px 2px rgba(168, 85, 247, 0.35);
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
    }
    .labeled-edge__glyph {
      font-size: 13px;
      line-height: 1;
      opacity: 0.95;
    }
  `],
})
export class LabeledEdgeComponent {
  readonly id = input<string>();
  readonly sourceX = input(0);
  readonly sourceY = input(0);
  readonly targetX = input(0);
  readonly targetY = input(0);
  readonly sourcePosition = input<Position>(Position.Bottom);
  readonly targetPosition = input<Position>(Position.Top);
  readonly data = input<{ label?: string }>();
  readonly markerEnd = input<string>();

  readonly pathData = computed(() => {
    const [d, labelX, labelY] = getBezierPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
      sourcePosition: this.sourcePosition(),
      targetPosition: this.targetPosition(),
    });
    return { d, labelX, labelY };
  });

  // Per-edge-instance IDs so multiple custom edges on the same page don't
  // share <defs> nodes and cross-contaminate. Using the edge id keeps them
  // stable across change detection cycles.
  readonly gradientId = computed(() => `labeled-grad-${this.id() ?? 'default'}`);
  readonly glowId = computed(() => `labeled-glow-${this.id() ?? 'default'}`);
}

@Component({
  selector: 'app-custom-edge-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom Edge"
      description="Build an edge with your own SVG path and a floating label rendered via EdgeLabelRenderer. Drag from any handle to node D to create a new one."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [edgeTypes]="edgeTypes"
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
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  `],
})
export class CustomEdgeExampleComponent {
  edgeTypes: Record<string, Type<unknown>> = {
    labeled: LabeledEdgeComponent,
  };

  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 100, y: 80 }, data: { label: 'A' } },
    { id: '2', position: { x: 360, y: 180 }, data: { label: 'B' } },
    { id: '3', type: 'output', position: { x: 600, y: 80 }, data: { label: 'C' } },
    // D is intentionally unconnected on load: any drag involving D produces
    // a new labeled edge, so the "drag to create" affordance is discoverable
    // without needing users to find the one magic A→C pair.
    { id: '4', position: { x: 360, y: 340 }, data: { label: 'D' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'labeled', data: { label: 'parse' } },
    { id: 'e2-3', source: '2', target: '3', type: 'labeled', data: { label: 'publish' } },
  ];

  onNodesChange(changes: NodeChange[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: EdgeChange[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge({ ...connection, type: 'labeled', data: { label: 'new' } }, this.edges) as Edge[];
  }
}
