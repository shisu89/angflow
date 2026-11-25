import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { getSmoothStepPath, Position, type StepPathOptions, type HandleBounds } from '@angflow/system';
import type { CSSProperties } from '../../types/general';
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
      [label]="label()"
      [labelX]="edgeLabelX()"
      [labelY]="edgeLabelY()"
      [labelStyle]="labelStyle()"
      [labelShowBg]="labelShowBg()"
      [labelBgStyle]="labelBgStyle()"
      [labelBgPadding]="labelBgPadding()"
      [labelBgBorderRadius]="labelBgBorderRadius()"
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly data = input<any>(); // untyped built-in edge data
  readonly selected = input(false);
  readonly markerStart = input<string>();
  readonly markerEnd = input<string>();
  readonly interactionWidth = input<number>();
  readonly pathOptions = input<StepPathOptions>();
  readonly label = input<string>();
  readonly labelX = input<number>();
  readonly labelY = input<number>();
  readonly labelStyle = input<CSSProperties>();
  readonly labelShowBg = input<boolean | undefined>();
  readonly labelBgStyle = input<CSSProperties>();
  readonly labelBgPadding = input<[number, number] | undefined>();
  readonly labelBgBorderRadius = input<number | undefined>();
  readonly sourceHandle = input<HandleBounds | null>(null);
  readonly targetHandle = input<HandleBounds | null>(null);

  private readonly pathData = computed(() => {
    return getSmoothStepPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
      sourcePosition: this.sourcePosition(),
      targetPosition: this.targetPosition(),
      borderRadius: 0,
      ...this.pathOptions(),
    });
  });

  readonly edgePath = computed(() => this.pathData()[0]);
  // Falls back to the computed on-path anchor, like upstream's built-in edges.
  protected readonly edgeLabelX = computed(() => this.labelX() ?? this.pathData()[1]);
  protected readonly edgeLabelY = computed(() => this.labelY() ?? this.pathData()[2]);
}
