import { Component, ChangeDetectionStrategy, input, computed, Type } from '@angular/core';
import {
  NgFlowComponent,
  BaseEdgeComponent,
  EdgeLabelRendererComponent,
  BackgroundComponent,
  ControlsComponent,
  Position,
  getBezierPath,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '../../shell/example-card.component';

// Custom edge: bezier path + a centered label rendered via EdgeLabelRenderer
@Component({
  selector: 'app-labeled-edge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseEdgeComponent, EdgeLabelRendererComponent],
  host: { 'style': 'display: contents;' },
  template: `
    <ng-flow-base-edge [path]="pathData().d" [markerEnd]="markerEnd()" />
    <ng-flow-edge-label-renderer>
      <div
        class="labeled-edge__label"
        [style.transform]="'translate(-50%, -50%) translate(' + pathData().labelX + 'px, ' + pathData().labelY + 'px)'"
      >
        {{ data()?.label || 'edge' }}
      </div>
    </ng-flow-edge-label-renderer>
  `,
  styles: [`
    .labeled-edge__label {
      position: absolute;
      padding: 3px 8px;
      background: #6366f1;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      border-radius: 10px;
      pointer-events: all;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35);
    }
  `],
})
export class LabeledEdgeComponent {
  readonly id = input<string>();
  readonly source = input<string>();
  readonly target = input<string>();
  readonly sourceX = input(0);
  readonly sourceY = input(0);
  readonly targetX = input(0);
  readonly targetY = input(0);
  readonly sourcePosition = input<Position>(Position.Bottom);
  readonly targetPosition = input<Position>(Position.Top);
  readonly data = input<any>();
  readonly markerEnd = input<string>();
  readonly markerStart = input<string>();
  readonly selected = input(false);
  readonly animated = input(false);
  readonly label = input<string>();
  readonly interactionWidth = input<number>();
  readonly sourceHandleId = input<string | null>();
  readonly targetHandleId = input<string | null>();
  readonly selectable = input<boolean>();
  readonly deletable = input<boolean>();
  readonly type = input<string>();
  readonly pathOptions = input<unknown>();

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
}

@Component({
  selector: 'app-custom-edge-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom Edge"
      description="Build an edge with your own SVG path and a floating label rendered via EdgeLabelRenderer."
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
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'labeled', data: { label: 'parse' } },
    { id: 'e2-3', source: '2', target: '3', type: 'labeled', data: { label: 'publish' } },
  ];

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge({ ...connection, type: 'labeled', data: { label: 'new' } }, this.edges) as Edge[];
  }
}
