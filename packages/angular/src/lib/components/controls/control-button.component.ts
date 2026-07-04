import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * A styled control button matching the `<ng-flow-controls>` toolbar buttons.
 * Applied to a real `<button>` so it keeps native button semantics and
 * keyboard support. Project it into `<ng-flow-controls>` to add custom
 * controls that share the built-in styling.
 *
 * @example
 * ```html
 * <ng-flow-controls>
 *   <button ngFlowControlButton (click)="reset()" title="Reset">
 *     <svg ...></svg>
 *   </button>
 * </ng-flow-controls>
 * ```
 */
@Component({
  selector: 'button[ngFlowControlButton]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'type': 'button',
    'class': 'ng-flow__controls-button xy-flow__controls-button',
  },
  template: `<ng-content />`,
})
export class ControlButtonComponent {}
