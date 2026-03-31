import { Component, ChangeDetectionStrategy, input, NO_ERRORS_SCHEMA } from '@angular/core';

@Component({
  selector: 'ng-flow-base-edge',
  standalone: true,
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'style': 'display: contents;' },
  template: `
    @if (interactionWidth()) {
      <path
        class="xy-flow__edge-interaction"
        [attr.d]="path()"
        fill="none"
        stroke="transparent"
        [attr.stroke-width]="interactionWidth()"
      />
    }
    <path
      class="xy-flow__edge-path"
      [attr.d]="path()"
      [attr.marker-start]="markerStart()"
      [attr.marker-end]="markerEnd()"
      [attr.style]="style()"
    />
  `,
})
export class BaseEdgeComponent {
  readonly path = input.required<string>();
  readonly markerStart = input<string>();
  readonly markerEnd = input<string>();
  readonly style = input<string>();
  readonly interactionWidth = input<number>(20);
}
