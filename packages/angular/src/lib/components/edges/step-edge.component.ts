import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { getSmoothStepPath, Position, type StepPathOptions, type Handle } from '@angflow/system';
import { BaseEdgeComponent } from './base-edge.component';

/** Edge rendered as orthogonal step segments with sharp corners. */
@Component({
  selector: 'ng-flow-step-edge',
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
export class StepEdgeComponent {
  readonly id = input<string>();
  readonly sourceX = input(0);
  readonly sourceY = input(0);
  readonly targetX = input(0);
  readonly targetY = input(0);
  readonly sourcePosition = input<Position>(Position.Bottom);
  readonly targetPosition = input<Position>(Position.Top);
  readonly data = input<any>();
  readonly selected = input(false);
  readonly markerStart = input<string>();
  readonly markerEnd = input<string>();
  readonly interactionWidth = input<number>();
  readonly pathOptions = input<StepPathOptions>();
  readonly label = input<string>();
  readonly sourceHandle = input<Handle | null>(null);
  readonly targetHandle = input<Handle | null>(null);

  readonly edgePath = computed(() => {
    const [path] = getSmoothStepPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
      sourcePosition: this.sourcePosition(),
      targetPosition: this.targetPosition(),
      borderRadius: 0,
      ...this.pathOptions(),
    });
    return path;
  });
}
