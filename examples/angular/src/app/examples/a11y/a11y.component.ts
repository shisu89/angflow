import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, AriaLabelConfig, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const ariaLabelConfig: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default': 'Custom Node Desc.',
  'node.a11yDescription.keyboardDisabled': 'Custom Keyboard Desc.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) =>
    `Custom moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
  'edge.a11yDescription.default': 'Custom Edge Desc.',
  'controls.ariaLabel': 'Custom Controls Aria Label',
  'controls.zoomIn.ariaLabel': 'Custom Zoom in',
  'controls.zoomOut.ariaLabel': 'Custom Zoom Out',
  'controls.fitView.ariaLabel': 'Custom Fit View',
  'controls.interactive.ariaLabel': 'Custom Toggle Interactivity',
  'minimap.ariaLabel': 'Custom Aria Label',
};

@Component({
  selector: 'app-a11y-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Accessibility"
      description="Custom aria labels for every interactive element. Tab through the flow to interact with nodes and edges via keyboard — the viewport auto-pans to keep the focused node in view (autoPanOnNodeFocus, keyboard-only)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [ariaLabelConfig]="ariaLabelConfig"
        [selectNodesOnDrag]="false"
        [elevateEdgesOnSelect]="true"
        [elevateNodesOnSelect]="false"
        [nodeDragThreshold]="0"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-minimap />
        <ng-flow-controls [showDelete]="true" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
  `],
})
export class A11yExampleComponent {
  readonly ariaLabelConfig = ariaLabelConfig;

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'A11y Node 1' }, position: { x:  250, y:   5 } },
    { id: '2',                data: { label: 'Node 2'     }, position: { x: 1000, y: 100 } },
    { id: '3',                data: { label: 'Node 3'     }, position: { x:  100, y: 100 } },
    { id: '4',                data: { label: 'Node 4'     }, position: { x:  300, y: 100 } },
    { id: '5',                data: { label: 'Node 5'     }, position: { x:  400, y: 200 } },
    { id: '6',                data: { label: 'Node 6'     }, position: { x: -1000, y: 200 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e1-4', source: '1', target: '4' },
    { id: 'e4-5', source: '4', target: '5' },
    { id: 'e3-6', source: '3', target: '6' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
