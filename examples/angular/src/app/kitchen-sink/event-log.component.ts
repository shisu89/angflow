import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

export interface EventEntry {
  id: number;
  timestamp: number;
  name: string;
  payload: string;
}

@Component({
  selector: 'app-event-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="log">
      <div class="log__header">
        <span class="log__title">Event log</span>
        <span class="log__count">{{ events().length }}</span>
        <div class="log__spacer"></div>
        <button
          type="button"
          class="log__btn"
          [class.is-active]="paused()"
          (click)="togglePause.emit()"
          title="Pause/resume event capture"
        >
          {{ paused() ? 'Resume' : 'Pause' }}
        </button>
        <button type="button" class="log__btn" (click)="clear.emit()">
          Clear
        </button>
        <button type="button" class="log__btn" (click)="toggleExpanded.emit()">
          {{ expanded() ? 'Collapse' : 'Expand' }}
        </button>
      </div>
      @if (expanded()) {
        <div class="log__body">
          @if (events().length === 0) {
            <div class="log__empty">No events yet. Interact with the canvas.</div>
          } @else {
            @for (entry of events(); track entry.id) {
              <div class="log__entry">
                <span class="log__time">{{ formatTime(entry.timestamp) }}</span>
                <span class="log__name">{{ entry.name }}</span>
                <span class="log__payload">{{ entry.payload }}</span>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      pointer-events: all;
    }
    .log {
      background: var(--ks-chrome-bg, #ffffff);
      border: 1px solid var(--ks-border, #e2e8f0);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      width: 560px;
      max-width: 80vw;
      overflow: hidden;
      font-family: inherit;
    }
    .log__header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--ks-field-bg, #f8fafc);
      border-bottom: 1px solid var(--ks-border, #e2e8f0);
    }
    .log__title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ks-muted, #94a3b8);
    }
    .log__count {
      padding: 1px 7px;
      background: var(--ks-accent, #6366f1);
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      border-radius: 10px;
    }
    .log__spacer {
      flex: 1;
    }
    .log__btn {
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--ks-border, #e2e8f0);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      color: var(--ks-text, #0f172a);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.1s;
    }
    .log__btn:hover {
      background: var(--ks-chrome-bg, #ffffff);
    }
    .log__btn.is-active {
      background: var(--ks-accent, #6366f1);
      color: #ffffff;
      border-color: var(--ks-accent, #6366f1);
    }
    .log__body {
      max-height: 180px;
      overflow-y: auto;
      padding: 4px 0;
      background: var(--ks-chrome-bg, #ffffff);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .log__empty {
      padding: 16px;
      text-align: center;
      color: var(--ks-muted, #94a3b8);
      font-size: 11px;
    }
    .log__entry {
      display: flex;
      gap: 10px;
      padding: 2px 12px;
      font-size: 10.5px;
      line-height: 1.5;
      border-bottom: 1px solid var(--ks-border-subtle, #f1f5f9);
    }
    .log__time {
      color: var(--ks-muted, #94a3b8);
      width: 72px;
      flex-shrink: 0;
    }
    .log__name {
      color: var(--ks-accent, #6366f1);
      font-weight: 600;
      width: 160px;
      flex-shrink: 0;
    }
    .log__payload {
      color: var(--ks-text, #0f172a);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
})
export class EventLogComponent {
  readonly events = input.required<EventEntry[]>();
  readonly paused = input(false);
  readonly expanded = input(true);

  readonly clear = output<void>();
  readonly togglePause = output<void>();
  readonly toggleExpanded = output<void>();

  formatTime(ts: number): string {
    const d = new Date(ts);
    return (
      d.getHours().toString().padStart(2, '0') + ':' +
      d.getMinutes().toString().padStart(2, '0') + ':' +
      d.getSeconds().toString().padStart(2, '0') + '.' +
      d.getMilliseconds().toString().padStart(3, '0')
    );
  }
}
