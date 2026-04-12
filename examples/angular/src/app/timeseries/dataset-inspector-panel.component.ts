import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { InMemoryTimeseriesBackend } from './backend/in-memory-timeseries-backend';

/**
 * Collapsible corner panel that shows the current state of
 * InMemoryTimeseriesBackend. Purely a teaching aid — lets users
 * see the "server" state change as they upload.
 */
@Component({
  selector: 'app-ts-dataset-inspector-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inspector" [class.collapsed]="collapsed()">
      <div class="inspector__header" (click)="toggle()">
        <span>Backend: {{ count() }} dataset{{ count() === 1 ? '' : 's' }}</span>
        <span class="inspector__caret">{{ collapsed() ? '▸' : '▾' }}</span>
      </div>
      @if (!collapsed()) {
        <div class="inspector__body">
          @if (count() === 0) {
            <div class="inspector__empty">No datasets uploaded</div>
          } @else {
            <table class="inspector__table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Rows</th>
                  <th>Columns</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                @for (ds of datasets(); track ds.id) {
                  <tr>
                    <td>{{ ds.label }}</td>
                    <td>{{ ds.rowCount }}</td>
                    <td class="inspector__cols">{{ ds.availableColumns.join(', ') }}</td>
                    <td class="inspector__id">{{ shortId(ds.id) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      bottom: 14px;
      right: 14px;
      z-index: 10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .inspector {
      background: rgba(15, 23, 42, 0.94);
      color: #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.4);
      min-width: 280px;
      max-width: 440px;
      overflow: hidden;
      backdrop-filter: blur(4px);
    }
    .inspector__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }
    .inspector__header:hover { background: rgba(51, 65, 85, 0.5); }
    .inspector__caret { font-size: 10px; color: #94a3b8; }
    .inspector__body {
      padding: 4px 14px 12px;
      max-height: 220px;
      overflow-y: auto;
    }
    .inspector__empty {
      font-size: 11px;
      color: #94a3b8;
      padding: 8px 0;
      font-style: italic;
    }
    .inspector__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .inspector__table th {
      text-align: left;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.05em;
      padding: 4px 6px 6px;
      border-bottom: 1px solid #334155;
    }
    .inspector__table td {
      padding: 5px 6px;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    }
    .inspector__cols {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #cbd5e1;
    }
    .inspector__id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #94a3b8;
    }
  `],
})
export class DatasetInspectorPanelComponent {
  private backend = inject(InMemoryTimeseriesBackend);

  readonly collapsed = signal(false);
  readonly datasets = this.backend.datasets;
  readonly count = computed(() => this.datasets().length);

  toggle(): void {
    this.collapsed.update((v) => !v);
  }

  shortId(id: string): string {
    // ds_xxx_yyy → ds_xxx...yyy
    if (id.length <= 14) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }
}
