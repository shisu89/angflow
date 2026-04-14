import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Layout container that anchors to the left or right edge of its parent
 * node and evenly distributes child `<af-handle-row>` elements vertically.
 *
 * The parent node element must be `position: relative`. Standard node
 * wrappers already satisfy this.
 *
 * @example
 * ```html
 * <af-handle-group position="left" [gap]="8">
 *   <af-handle-row label="input A">
 *     <ng-flow-handle type="target" id="a" />
 *   </af-handle-row>
 *   <af-handle-row label="input B">
 *     <ng-flow-handle type="target" id="b" />
 *   </af-handle-row>
 * </af-handle-group>
 * ```
 */
@Component({
  selector: 'af-handle-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'af-handle-group',
    '[class.af-handle-group--left]': 'position() === "left"',
    '[class.af-handle-group--right]': 'position() === "right"',
    '[style.gap.px]': 'gap()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: absolute;
      top: 0;
      bottom: 0;
      pointer-events: none;
    }
    :host.af-handle-group--left  { left: 0; align-items: flex-start; }
    :host.af-handle-group--right { right: 0; align-items: flex-end; }
    :host ::ng-deep > * { pointer-events: auto; }
  `,
})
export class AfHandleGroupComponent {
  readonly position = input<'left' | 'right'>('left');
  readonly gap = input<number>(8);
}
