import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { getStraightPath, Position, type Handle } from '@angflow/system';
import { BaseEdgeComponent } from './base-edge.component';

@Component({
  selector: 'ng-flow-straight-edge',
  standalone: true,
  imports: [BaseEdgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-base-edge
      [path]="edgePath()"
      [markerStart]="markerStart()"
      [markerEnd]="markerEnd()"
      [interactionWidth]="interactionWidth() ?? 20"
    />
  `,
})
export class StraightEdgeComponent {
  readonly id = input<string>();
  readonly sourceX = input(0);
  readonly sourceY = input(0);
  readonly targetX = input(0);
  readonly targetY = input(0);
  readonly data = input<any>();
  readonly selected = input(false);
  readonly markerStart = input<string>();
  readonly markerEnd = input<string>();
  readonly interactionWidth = input<number>();
  readonly label = input<string>();
  readonly sourceHandle = input<Handle | null>(null);
  readonly targetHandle = input<Handle | null>(null);

  readonly edgePath = computed(() => {
    const [path] = getStraightPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
    });
    return path;
  });
}
