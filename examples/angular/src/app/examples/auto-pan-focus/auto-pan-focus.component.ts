import { Component, ChangeDetectionStrategy, signal, viewChild } from '@angular/core';
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
 * Demonstrates keeping the "active" node in view. The nodes are spread wider
 * than the viewport, so moving between them scrolls the canvas.
 *
 * - **Keyboard:** `autoPanOnNodeFocus` pans to the Tab-focused node
 *   (`:focus-visible` only — mouse clicks never pan). Toggle it to compare.
 * - **Touch:** the Prev / Next buttons step an active node and recenter on it,
 *   so the same follow-the-node effect works without a keyboard.
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
      description="Keep the active node in view. On a keyboard, autoPanOnNodeFocus pans to the Tab-focused node (mouse clicks never pan). On touch, tap Prev / Next to step through — the viewport recenters on each."
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
          <div class="autopan-panel">
            <button
              type="button"
              class="autopan-btn"
              [attr.aria-pressed]="autoPan()"
              (click)="autoPan.set(!autoPan())"
            >
              Auto-pan on focus: <strong>{{ autoPan() ? 'ON' : 'OFF' }}</strong>
            </button>
            <div class="autopan-nav">
              <button type="button" class="autopan-btn" aria-label="Focus previous node" (click)="step(-1)">◀ Prev</button>
              <button type="button" class="autopan-btn" aria-label="Focus next node" (click)="step(1)">Next ▶</button>
            </div>
            <p class="autopan-hint">
              Keyboard: press <kbd>Tab</kbd>. Touch: use <strong>Prev</strong> / <strong>Next</strong>.
            </p>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .autopan-panel { display: flex; flex-direction: column; gap: 6px; max-width: 220px; }
    .autopan-nav { display: flex; gap: 6px; }
    .autopan-nav .autopan-btn { flex: 1; }
    .autopan-btn {
      font: inherit;
      padding: 6px 10px;
      border: 1px solid var(--xy-controls-button-border-color, #ddd);
      border-radius: 6px;
      background: var(--xy-controls-button-background-color, #fefefe);
      color: inherit;
      cursor: pointer;
    }
    .autopan-btn:hover { background: var(--xy-controls-button-background-color-hover, #f4f4f4); }
    .autopan-btn strong { font-variant-numeric: tabular-nums; }
    .autopan-hint { margin: 2px 0 0; font-size: 12px; opacity: 0.7; }
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
  private readonly flow = viewChild.required(NgFlowComponent);

  /** Bound to `[autoPanOnNodeFocus]`; the toggle flips it live (keyboard path). */
  readonly autoPan = signal(true);
  /** Index of the node the Prev/Next buttons last revealed. */
  private readonly activeIndex = signal(-1);

  // Spread wider than the viewport so revealing a node actually pans.
  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Start' }, position: { x: 0, y: 200 } },
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

  /**
   * Touch-friendly "focus next/previous node": recenter the viewport on the node
   * (the pan `autoPanOnNodeFocus` gives keyboard users) and focus it for a11y.
   * A button tap isn't `:focus-visible`, so we pan explicitly rather than relying
   * on the keyboard-only autopan.
   */
  step(delta: number): void {
    const n = this.nodes.length;
    const i = (this.activeIndex() + delta + n) % n;
    this.activeIndex.set(i);

    const node = this.nodes[i];
    const flow = this.flow();
    const internal = flow.store.nodeLookup.get(node.id);
    const w = internal?.measured?.width ?? 150;
    const h = internal?.measured?.height ?? 40;
    const cx = (internal?.internals?.positionAbsolute?.x ?? node.position.x) + w / 2;
    const cy = (internal?.internals?.positionAbsolute?.y ?? node.position.y) + h / 2;

    flow.service.setCenter(cx, cy, { zoom: flow.store.transform()[2], duration: 350 });
    (flow.store.domNode()?.querySelector(`.xy-flow__node[data-id="${node.id}"]`) as HTMLElement | null)?.focus();
  }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
}
