import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-showcase-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="toolbar__group">
        <button class="toolbar__btn" (click)="add.emit()" title="Add default node at center">
          Add
        </button>
        <button
          class="toolbar__btn"
          [disabled]="!hasSelection()"
          (click)="delete.emit()"
          title="Delete selected elements"
        >
          Delete
        </button>
      </div>

      <div class="toolbar__divider"></div>

      <div class="toolbar__group">
        <button class="toolbar__btn" (click)="layout.emit()" title="Auto-layout nodes">
          Layout
        </button>
        <button class="toolbar__btn" (click)="fit.emit()" title="Fit viewport to all nodes">
          Fit view
        </button>
      </div>

      <div class="toolbar__divider"></div>

      <div class="toolbar__group">
        <button class="toolbar__btn" (click)="save.emit()" title="Save to localStorage">
          Save
        </button>
        <button
          class="toolbar__btn"
          [disabled]="!hasSaved()"
          (click)="restore.emit()"
          title="Restore from localStorage"
        >
          Restore
        </button>
        <button class="toolbar__btn toolbar__btn--danger" (click)="clear.emit()" title="Clear all nodes">
          Clear
        </button>
      </div>

      <div class="toolbar__spacer"></div>

      <div class="toolbar__group">
        <button
          class="toolbar__btn toolbar__btn--run"
          [disabled]="isRunning() || nodeCount() === 0"
          (click)="run.emit()"
          title="Simulate run (visual only)"
        >
          @if (isRunning()) {
            Running…
          } @else {
            ▶ Run
          }
        </button>
      </div>

      <div class="toolbar__stats">
        {{ nodeCount() }} nodes · {{ edgeCount() }} edges
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--sc-chrome-bg, #ffffff);
      border-bottom: 1px solid var(--sc-chrome-border, #e2e8f0);
      flex-shrink: 0;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      min-height: 48px;
    }
    .toolbar__group {
      display: flex;
      gap: 4px;
    }
    .toolbar__divider {
      width: 1px;
      height: 22px;
      background: var(--sc-chrome-border, #e2e8f0);
      margin: 0 2px;
    }
    .toolbar__spacer {
      flex: 1;
    }
    .toolbar__btn {
      padding: 6px 14px;
      border: 1px solid var(--sc-chrome-border, #e2e8f0);
      background: var(--sc-field-bg, #f8fafc);
      color: var(--sc-chrome-text, #0f172a);
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s, border-color 0.12s, transform 0.12s;
    }
    .toolbar__btn:hover:not(:disabled) {
      background: var(--sc-chrome-bg, #ffffff);
      border-color: var(--sc-chrome-muted, #94a3b8);
    }
    .toolbar__btn:active:not(:disabled) {
      transform: translateY(1px);
    }
    .toolbar__btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .toolbar__btn--danger {
      color: #dc2626;
    }
    .toolbar__btn--danger:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fca5a5;
    }
    .toolbar__btn--run {
      background: var(--sc-accent, #6366f1);
      color: #ffffff;
      border-color: var(--sc-accent, #6366f1);
      min-width: 88px;
    }
    .toolbar__btn--run:hover:not(:disabled) {
      background: var(--sc-accent-hover, #4f46e5);
      border-color: var(--sc-accent-hover, #4f46e5);
    }
    .toolbar__stats {
      font-size: 11px;
      color: var(--sc-chrome-muted, #94a3b8);
      font-variant-numeric: tabular-nums;
      padding-left: 10px;
      border-left: 1px solid var(--sc-chrome-border, #e2e8f0);
      margin-left: 4px;
    }
  `],
})
export class ShowcaseToolbarComponent {
  readonly nodeCount = input<number>(0);
  readonly edgeCount = input<number>(0);
  readonly hasSelection = input<boolean>(false);
  readonly hasSaved = input<boolean>(false);
  readonly isRunning = input<boolean>(false);

  readonly add = output<void>();
  readonly delete = output<void>();
  readonly layout = output<void>();
  readonly fit = output<void>();
  readonly save = output<void>();
  readonly restore = output<void>();
  readonly clear = output<void>();
  readonly run = output<void>();
}
