import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { HandleComponent, Position } from '@angflow/angular';

@Component({
  selector: 'app-showcase-result-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="result-node" [class]="runClass()">
      <div class="result-node__label">{{ label() }}</div>
      <div class="result-node__value">
        @if (runClass() === 'has-run') {
          <span class="result-node__ok">OK</span>
        } @else if (runClass() === 'is-running') {
          <span class="result-node__spinner">running…</span>
        } @else {
          <span class="result-node__idle">pending</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .result-node {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 20px;
      background: var(--sc-node-bg, #ffffff);
      border: 2px solid var(--sc-border, #cbd5e1);
      border-radius: 12px;
      min-width: 140px;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      color: var(--sc-node-text, #0f172a);
    }
    .result-node__label {
      font-weight: 700;
      font-size: 12px;
      color: var(--sc-node-muted, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .result-node__value {
      font-weight: 700;
      font-size: 14px;
    }
    .result-node__idle { color: #94a3b8; }
    .result-node__spinner { color: var(--sc-accent, #6366f1); }
    .result-node__ok { color: #10b981; }
    .result-node.is-running {
      border-color: var(--sc-accent, #6366f1);
      animation: sc-result-pulse 1s ease-in-out infinite;
    }
    .result-node.has-run {
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35), 0 4px 14px rgba(16, 185, 129, 0.2);
    }
    @keyframes sc-result-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
  `],
})
export class ShowcaseResultNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();

  readonly label = computed<string>(() => this.data()?.label ?? 'Result');
  readonly runClass = computed<string>(() => {
    const state = this.data()?._runState;
    if (state === 'running') return 'is-running';
    if (state === 'done') return 'has-run';
    return '';
  });
}
