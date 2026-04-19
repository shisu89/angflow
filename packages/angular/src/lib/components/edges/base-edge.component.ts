import { Component, ChangeDetectionStrategy, input, NO_ERRORS_SCHEMA } from '@angular/core';

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
}
