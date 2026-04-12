import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  OnInit,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HandleComponent, NodeResizerComponent, NgFlowService, Position } from '@angflow/angular';
import type { TimeseriesDescriptor } from '../data/descriptors';
import type { DatasetMetadata } from '../backend/timeseries-backend.types';

export interface QueryNodeData {
  label: string;
  source: TimeseriesDescriptor | null;
  availableColumns: string[];
  selectedColumns: string[];
}

export function emptyQueryNodeData(label = 'Query'): QueryNodeData {
  return {
    label,
    source: null,
    availableColumns: [],
    selectedColumns: [],
  };
}

@Component({
  selector: 'app-ts-query-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeResizerComponent],
  styleUrls: ['./nodes.css'],
  styles: [`:host { display: block; width: 100%; height: 100%; } .ts-node { width: 100%; height: 100%; box-sizing: border-box; overflow: auto; }`],
  template: `
    <ng-flow-node-resizer [minWidth]="260" [minHeight]="140" color="#6366f1" />
    <div class="ts-node" [class.selected]="selected()">
      <div class="ts-node__header">
        <span class="ts-node__drag-grip">&#x2630;</span>
        <input
          class="ts-node__header-input nodrag"
          [value]="label()"
          (input)="onLabelInput($event)"
          placeholder="Query"
        />
        <div class="ts-node__status-dot idle"></div>
      </div>
      <div class="ts-node__body nodrag">
        <div class="ts-node__row">
          <select
            class="ts-node__select"
            [value]="selectedId()"
            (change)="onPick($event)"
          >
            <option value="">— pick a dataset —</option>
            @for (ds of datasets(); track ds.id) {
              <option [value]="ds.id" [selected]="ds.id === selectedId()">{{ ds.label }} ({{ ds.rowCount }} rows)</option>
            }
          </select>
          <button class="ts-node__button" (click)="refresh()">
            @if (loading()) { ... } @else { ↻ }
          </button>
        </div>

        @if (availableColumns().length > 0) {
          <div class="ts-node__tagbar">
            @for (col of availableColumns(); track col) {
              <span
                class="ts-node__tag"
                [class.selected]="isSelected(col)"
                (click)="toggleColumn(col)"
              >
                {{ col }}
              </span>
            }
          </div>
        } @else {
          <div class="ts-node__hint">Pick a dataset to see its columns</div>
        }

        @if (error()) {
          <div class="ts-node__error">{{ error() }}</div>
        }
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
})
export class QueryNodeComponent implements OnInit {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<QueryNodeData>(emptyQueryNodeData());
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

  private flow = inject(NgFlowService);
  private http = inject(HttpClient);

  readonly datasets = signal<DatasetMetadata[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly label = computed(() => this.data().label ?? 'Query');
  readonly availableColumns = computed(() => this.data().availableColumns ?? []);
  readonly selectedColumns = computed(() => this.data().selectedColumns ?? []);
  readonly selectedId = computed(() => {
    const s = this.data().source;
    return s && s.kind === 'backend' ? s.datasetId : '';
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<DatasetMetadata[]>('/api/timeseries').subscribe({
      next: (list) => {
        this.datasets.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load datasets');
        this.loading.set(false);
      },
    });
  }

  isSelected(col: string): boolean {
    return this.selectedColumns().includes(col);
  }

  onLabelInput(event: Event): void {
    const newLabel = (event.target as HTMLInputElement).value;
    this.flow.updateNodeData(this.id(), { label: newLabel });
  }

  onPick(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.flow.updateNodeData(this.id(), {
        source: null,
        availableColumns: [],
        selectedColumns: [],
      });
      return;
    }
    const picked = this.datasets().find((d) => d.id === id);
    if (!picked) return;
    this.flow.updateNodeData(this.id(), {
      source: { kind: 'backend', datasetId: id },
      availableColumns: picked.availableColumns,
      selectedColumns: picked.availableColumns,
    });
  }

  toggleColumn(col: string): void {
    const current = this.selectedColumns();
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    this.flow.updateNodeData(this.id(), { selectedColumns: next });
  }
}
