import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NgFlowComponent, BackgroundComponent, applyNodeChanges } from '@angflow/angular';
import type { Node, BackgroundVariant } from '@angflow/angular';

interface BgProps {
  variant: BackgroundVariant;
  gap?: number | [number, number];
  offset?: number;
  color?: string;
}

interface FlowDef {
  id: string;
  bgProps: BgProps[];
}

/**
 * Faithful port of examples/react/src/examples/Backgrounds: four side-by-side
 * flows (flow-a .. flow-d), each with one or more indexed backgrounds. Upstream's
 * background.spec.ts targets `#pattern-flow-a0` / `#pattern-flow-d1`.
 */
@Component({
  selector: 'app-backgrounds-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent],
  template: `
    <div class="bg-wrapper">
      @for (flow of flows; track flow.id) {
        <ng-flow
          [id]="flow.id"
          [nodes]="nodes"
          (nodesChange)="onNodesChange($event)"
        >
          @for (bg of flow.bgProps; track $index) {
            <ng-flow-background
              [id]="'' + $index"
              [variant]="bg.variant"
              [gap]="bg.gap ?? 20"
              [offset]="bg.offset ?? 0"
              [color]="bg.color"
            />
          }
        </ng-flow>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .bg-wrapper { display: flex; height: 100%; width: 100%; }
    .bg-wrapper ng-flow { width: 100%; height: 100%; border-right: 1px solid #ddd; }
  `],
})
export class BackgroundsExampleComponent {
  nodes: Node[] = [{ id: '1', data: { label: 'Node 1' }, position: { x: 50, y: 50 } }];

  readonly flows: FlowDef[] = [
    { id: 'flow-a', bgProps: [{ variant: 'dots' as BackgroundVariant }] },
    { id: 'flow-b', bgProps: [{ variant: 'lines' as BackgroundVariant, gap: [50, 50] }] },
    { id: 'flow-c', bgProps: [{ variant: 'cross' as BackgroundVariant, gap: [100, 50] }] },
    {
      id: 'flow-d',
      bgProps: [
        { variant: 'lines' as BackgroundVariant, gap: 10 },
        { variant: 'lines' as BackgroundVariant, gap: 100, offset: 2, color: '#ccc' },
      ],
    },
  ];

  onNodesChange(changes: Parameters<typeof applyNodeChanges>[0]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }
}
