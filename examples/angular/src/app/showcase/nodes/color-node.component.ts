import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { HandleComponent, Position } from '@angflow/angular';

@Component({
  selector: 'app-showcase-color-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="color-node" [class]="runClass()" [style.border-color]="color()">
      <div class="color-node__header" [style.background]="color()">
        {{ label() }}
      </div>
      @if (description()) {
        <div class="color-node__body">{{ description() }}</div>
      }
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    :host { display: block; }
    .color-node {
      background: var(--sc-node-bg, #ffffff);
      border: 2px solid #555;
      border-radius: 10px;
      min-width: 140px;
      font-size: 12px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      color: var(--sc-node-text, #0f172a);
    }
    .color-node__header {
      padding: 8px 14px;
      font-weight: 700;
      border-radius: 8px 8px 0 0;
      color: #0f172a;
      letter-spacing: 0.02em;
    }
    .color-node__body {
      padding: 8px 14px;
      color: var(--sc-node-muted, #64748b);
    }
    .color-node.is-running {
      animation: sc-pulse 1s ease-in-out infinite;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.25), 0 6px 18px rgba(99, 102, 241, 0.35);
    }
    .color-node.has-run {
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.45), 0 4px 14px rgba(16, 185, 129, 0.25);
    }
    @keyframes sc-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }
  `],
})
export class ShowcaseColorNodeComponent {
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

  readonly label = computed<string>(() => this.data()?.label ?? 'Node');
  readonly description = computed<string>(() => this.data()?.description ?? '');
  readonly color = computed<string>(() => this.data()?.color ?? '#e2e8f0');
  readonly runClass = computed<string>(() => {
    const state = this.data()?._runState;
    if (state === 'running') return 'is-running';
    if (state === 'done') return 'has-run';
    return '';
  });
}
