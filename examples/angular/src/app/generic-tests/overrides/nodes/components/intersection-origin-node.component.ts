import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgFlowService } from '@angflow/angular';

@Component({
  selector: 'intersection-origin-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <button class="nodrag" data-testid="check-intersections" (click)="check()">Check intersections</button>
      <output data-testid="intersection-result">{{ result() }}</output>
    </div>
  `,
})
export class IntersectionOriginNodeComponent {
  private readonly flow = inject(NgFlowService);
  protected readonly result = signal('');

  protected check(): void {
    const f = this.flow;
    const root = f.getNode('root')!;
    const area = { x: 55, y: 55, width: 5, height: 5 };
    // angflow's getIntersectingNodes takes a node, not a rect/candidate list (API gap):
    // approximate upstream's (area, partially, candidates) with isNodeIntersecting.
    const intersecting = (candidates: { id: string }[]) =>
      candidates.filter((n) => f.isNodeIntersecting(n as any, area)).map((n) => n.id);

    this.result.set(
      JSON.stringify({
        rootObject: f.isNodeIntersecting(root, area),
        rootId: f.isNodeIntersecting({ id: root.id } as any, area),
        explicitTargets: intersecting([root]),
        implicitTargets: intersecting(f.getNodes()),
        ownOrigin: f.isNodeIntersecting(f.getNode('own-origin')!, { x: 295, y: 295, width: 2, height: 2 }),
        child: f.isNodeIntersecting(f.getNode('child')!, { x: 426, y: 426, width: 5, height: 5 }),
      }),
    );
  }
}
