import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-example-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="card__header">
      <h1 class="card__title">{{ title() }}</h1>
      @if (description()) {
        <p class="card__description">{{ description() }}</p>
      }
    </header>
    <div class="card__canvas">
      <ng-content />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: #ffffff;
      border-radius: 10px;
      box-shadow:
        0 1px 3px rgba(15, 23, 42, 0.06),
        0 1px 2px rgba(15, 23, 42, 0.04);
      overflow: hidden;
    }
    .card__header {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .card__title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .card__description {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
    }
    .card__canvas {
      flex: 1;
      min-height: 0;
      position: relative;
    }
  `],
})
export class ExampleCardComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
