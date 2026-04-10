import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-accordion-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <button
        type="button"
        class="section__header"
        [attr.aria-expanded]="open()"
        (click)="toggle.emit()"
      >
        <span class="section__chevron" [class.is-open]="open()">›</span>
        <span class="section__title">{{ title() }}</span>
        @if (nonDefaultCount() > 0) {
          <span class="section__badge">{{ nonDefaultCount() }}</span>
        }
      </button>
      <div class="section__content" [class.is-hidden]="!open()">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .section {
      border-bottom: 1px solid var(--ks-border, #e2e8f0);
    }
    .section__header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      color: var(--ks-text, #0f172a);
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      transition: background 0.1s;
    }
    .section__header:hover {
      background: var(--ks-field-bg, #f8fafc);
    }
    .section__chevron {
      display: inline-block;
      width: 14px;
      font-size: 16px;
      color: var(--ks-muted, #94a3b8);
      transition: transform 0.15s;
    }
    .section__chevron.is-open {
      transform: rotate(90deg);
    }
    .section__title {
      flex: 1;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .section__badge {
      padding: 1px 7px;
      background: var(--ks-accent, #6366f1);
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }
    .section__content {
      padding: 4px 14px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .section__content.is-hidden {
      display: none;
    }
  `],
})
export class AccordionSectionComponent {
  readonly title = input.required<string>();
  readonly open = input(false);
  readonly nonDefaultCount = input(0);
  readonly toggle = output<void>();
}
