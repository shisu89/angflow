import { Component, ChangeDetectionStrategy, computed, input, NO_ERRORS_SCHEMA } from '@angular/core';
import type { CSSProperties } from '../../types/general';
import { EdgeTextComponent } from './edge-text.component';

/**
 * Low-level edge renderer. Draws the SVG path and an invisible wider
 * "interaction" path (for easier pointer targeting). Use this as the building
 * block for custom edge components — feed it a precomputed `path` string.
 *
 * @example
 * ```typescript
 * @Component({
 *   selector: 'my-edge',
 *   imports: [BaseEdgeComponent],
 *   template: `<ng-flow-base-edge [path]="path()" [markerEnd]="markerEnd()" />`,
 * })
 * export class MyEdge {
 *   readonly sourceX = input(0); // ...etc
 *   readonly path = computed(() => getBezierPath({ ... })[0]);
 * }
 * ```
 */
@Component({
  selector: 'ng-flow-base-edge',
  standalone: true,
  imports: [EdgeTextComponent],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'style': 'display: contents;' },
  // The inline <svg> wrapper forces the <path> elements into the SVG namespace,
  // which is required when this component is projected through NgComponentOutlet
  // (Angular creates the dynamic component's host in the XHTML namespace even
  // when it sits inside an <svg>, so raw <path> children would render as unknown
  // HTML elements without this wrapper).
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
      @if (interactionWidth()) {
        <path
          class="xy-flow__edge-interaction"
          [attr.d]="path()"
          fill="none"
          stroke="transparent"
          [attr.stroke-width]="interactionWidth()"
          style="pointer-events: stroke;"
        />
      }
      <path
        class="xy-flow__edge-path"
        [attr.d]="path()"
        [attr.marker-start]="markerStart()"
        [attr.marker-end]="markerEnd()"
        [attr.style]="style()"
      />
      @if (showLabel()) {
        <g
          ngFlowEdgeText
          [x]="labelX()!"
          [y]="labelY()!"
          [label]="label()"
          [labelStyle]="labelStyle()"
          [labelShowBg]="labelShowBg()"
          [labelBgStyle]="labelBgStyle()"
          [labelBgPadding]="labelBgPadding()"
          [labelBgBorderRadius]="labelBgBorderRadius()"
        />
      }
    </svg>
  `,
})
export class BaseEdgeComponent {
  /** SVG path data (`d` attribute) to render. */
  readonly path = input.required<string>();
  /** SVG `url(#…)` reference for a marker drawn at the path start. */
  readonly markerStart = input<string>();
  /** SVG `url(#…)` reference for a marker drawn at the path end. */
  readonly markerEnd = input<string>();
  /** Inline CSS applied to the visible path (stroke, color, dash, etc.). */
  readonly style = input<string>();
  /** Width of the invisible interaction path used for pointer targeting. Set to `0` to disable. */
  readonly interactionWidth = input<number>(20);
  /** Label text, drawn at `(labelX, labelY)` like upstream `BaseEdge`. Needs both coordinates. */
  readonly label = input<string>();
  /** Flow x of the label centre. */
  readonly labelX = input<number>();
  /** Flow y of the label centre. */
  readonly labelY = input<number>();
  readonly labelStyle = input<CSSProperties>();
  /** Defaults to `true`. */
  readonly labelShowBg = input<boolean | undefined>();
  readonly labelBgStyle = input<CSSProperties>();
  /** `[horizontal, vertical]` padding of the label background. Defaults to `[2, 4]`. */
  readonly labelBgPadding = input<[number, number] | undefined>();
  /** Defaults to `2`. */
  readonly labelBgBorderRadius = input<number | undefined>();

  protected readonly showLabel = computed(
    () => !!this.label() && typeof this.labelX() === 'number' && typeof this.labelY() === 'number',
  );
}
