import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * Helper that renders a text label centered at `(x, y)` in flow coordinates,
 * with a small background for readability. Place inside an SVG edge template.
 */
@Component({
  selector: 'ng-flow-edge-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <foreignObject
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.x]="x() - width() / 2"
      [attr.y]="y() - height() / 2"
      class="xy-flow__edge-textwrapper"
      requiredExtensions="http://www.w3.org/1999/xhtml"
    >
      <div class="xy-flow__edge-textbg" xmlns="http://www.w3.org/1999/xhtml">
        <span class="xy-flow__edge-text">{{ label() }}</span>
      </div>
    </foreignObject>
  `,
})
export class EdgeTextComponent {
  readonly x = input(0);
  readonly y = input(0);
  readonly label = input<string>();
  readonly width = input(40);
  readonly height = input(20);
}
