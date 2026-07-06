import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, NodeChange, EdgeChange } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

/**
 * Demonstrates `autoPanOnNodeFocus`: the viewport pans to keep the
 * keyboard-focused node in view. The nodes are spread wider than the viewport,
 * so tabbing between them scrolls the canvas. Autopan is keyboard-only — mouse
 * clicks never pan — and the toggle lets you feel the difference.
 */
@Component({
  selector: 'app-auto-pan-focus-example',
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
      title="Auto-pan on focus"
      description="Press Tab to move keyboard focus between nodes — with auto-pan on, the viewport follows focus to keep the focused node in view. Mouse clicks never pan. Toggle it to compare."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [autoPanOnNodeFocus]="autoPan()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls [showDelete]="true" />
        <ng-flow-panel position="top-left">
          <button
            type="button"
            class="autopan-toggle"
            [attr.aria-pressed]="autoPan()"
            (click)="autoPan.set(!autoPan())"
          >
            Auto-pan on focus: <strong>{{ autoPan() ? 'ON' : 'OFF' }}</strong>
          </button>
          <p class="autopan-hint">Click here, then press <kbd>Tab</kbd> to step through the nodes.</p>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .autopan-toggle {
      font: inherit;
      padding: 6px 10px;
      border: 1px solid var(--xy-controls-button-border-color, #ddd);
      border-radius: 6px;
      background: var(--xy-controls-button-background-color, #fefefe);
      color: inherit;
      cursor: pointer;
    }
    .autopan-toggle:hover { background: var(--xy-controls-button-background-color-hover, #f4f4f4); }
    .autopan-toggle strong { font-variant-numeric: tabular-nums; }
    .autopan-hint { margin: 6px 2px 0; font-size: 12px; opacity: 0.7; max-width: 200px; }
    .autopan-hint kbd {
      font: inherit;
      padding: 1px 4px;
      border: 1px solid currentColor;
      border-radius: 3px;
      opacity: 0.8;
    }
  `],
})
export class AutoPanFocusExampleComponent {
  /** Bound to `[autoPanOnNodeFocus]`; the toggle flips it live. */
  readonly autoPan = signal(true);

  // Spread wider than the viewport so Tab-focusing a node actually pans.
  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Start — press Tab →' }, position: { x: 0, y: 200 } },
    { id: '2', data: { label: 'Node 2' }, position: { x: 520, y: 320 } },
    { id: '3', data: { label: 'Node 3' }, position: { x: 1040, y: 140 } },
    { id: '4', data: { label: 'Node 4' }, position: { x: 1560, y: 340 } },
    { id: '5', data: { label: 'Node 5' }, position: { x: 2080, y: 180 } },
    { id: '6', type: 'output', data: { label: 'End' }, position: { x: 2600, y: 300 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5', source: '4', target: '5' },
    { id: 'e5-6', source: '5', target: '6' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
}
