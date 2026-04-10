import { Component, ChangeDetectionStrategy, input, NO_ERRORS_SCHEMA } from '@angular/core';

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
  readonly path = input.required<string>();
  readonly markerStart = input<string>();
  readonly markerEnd = input<string>();
  readonly style = input<string>();
  readonly interactionWidth = input<number>(20);
}
