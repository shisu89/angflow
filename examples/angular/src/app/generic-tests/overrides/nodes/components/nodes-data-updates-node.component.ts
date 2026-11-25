import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgFlowService } from '@angflow/angular';

@Component({
  selector: 'nodes-data-updates-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nodrag nopan">
      <output data-testid="data-renders">{{ renders() }}</output>
      <output data-testid="node-data">{{ nodeValue() }}</output>
      <output data-testid="nodes-data">{{ nodesText() }}</output>
      <button (click)="move()">Move observed node</button>
      <button (click)="select()">Select observed node</button>
      <button (click)="update()">Update observed data</button>
    </div>
  `,
})
export class NodesDataUpdatesNodeComponent {
  private readonly flow = inject(NgFlowService);
  private readonly node = this.flow.selectNodesData('a');
  private readonly nodes = this.flow.selectNodesData(['a', 'b']);

  protected readonly nodeValue = computed(() => String((this.node()[0]?.data as any)?.['value'] ?? 'missing'));
  protected readonly nodesText = computed(() =>
    this.nodes()
      .map(({ id, data }) => `${id}:${String((data as any)['value'] ?? '')}`)
      .join(','),
  );

  // React counts component renders. The Angular analogue is the number of distinct
  // rendered outputs: it must not grow on position/selection-only changes.
  protected readonly renders = signal(1);
  private last: string | undefined;

  constructor() {
    effect(() => {
      const key = this.nodeValue() + '|' + this.nodesText();
      untracked(() => {
        if (this.last !== undefined && this.last !== key) this.renders.update((n) => n + 1);
        this.last = key;
      });
    });
  }

  protected move(): void {
    this.flow.setNodes(
      this.flow
        .getNodes()
        .map((n) => (n.id === 'a' ? { ...n, position: { x: n.position.x + 10, y: n.position.y } } : n)),
    );
  }
  protected select(): void {
    this.flow.setNodes(this.flow.getNodes().map((n) => (n.id === 'a' ? { ...n, selected: !n.selected } : n)));
  }
  protected update(): void {
    this.flow.updateNodeData('a', { value: 'updated' });
  }
}
