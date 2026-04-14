import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A labeled row that pairs a single `<ng-flow-handle>` (projected) with
 * optional text. Intended to be placed inside `<af-handle-group>`.
 *
 * Is its own positioning context so the nested handle's
 * `xy-flow__handle-left` / `-right` CSS anchors to the row edge, not to
 * the whole node. This prevents multiple stacked handles from overlapping
 * at the same y coordinate.
 */
@Component({
  selector: 'af-handle-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'af-handle-row' },
  template: `
    <ng-content select="ng-flow-handle" />
    @if (label()) {
      <span class="af-handle-row__label">{{ label() }}</span>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      position: relative;
      min-height: 16px;
    }
    .af-handle-row__label {
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }
  `,
})
export class AfHandleRowComponent {
  readonly label = input<string>('');
}
