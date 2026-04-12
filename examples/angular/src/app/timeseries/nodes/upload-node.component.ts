import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HandleComponent, NgFlowService, Position } from '@angflow/angular';
import type { TimeseriesDescriptor } from '../data/descriptors';
import type {
  DatasetMetadata,
  UploadRequestBody,
  PatchRequestBody,
  BackendErrorBody,
} from '../backend/timeseries-backend.types';

export interface UploadNodeData {
  label: string;
  source: TimeseriesDescriptor | null;
  availableColumns: string[];
  selectedColumns: string[];
  uploadState: 'idle' | 'uploading' | 'error';
  errorMessage?: string;
}

export function emptyUploadNodeData(label = 'Upload'): UploadNodeData {
  return {
    label,
    source: null,
    availableColumns: [],
    selectedColumns: [],
    uploadState: 'idle',
  };
}

@Component({
  selector: 'app-ts-upload-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  styleUrls: ['./nodes.css'],
  template: `
    <div class="ts-node" [class.selected]="selected()">
      <div class="ts-node__header">
        <input
          class="ts-node__header-input nodrag"
          [value]="label()"
          (input)="onLabelInput($event)"
          placeholder="Upload"
        />
        <div class="ts-node__status-dot" [class]="statusClass()"></div>
      </div>
      <div class="ts-node__body nodrag">
        <textarea
          class="ts-node__textarea"
          [value]="pendingCsv()"
          (input)="onTextareaInput($event)"
          placeholder="Paste CSV here (first column time, rest values)"
          spellcheck="false"
        ></textarea>
        <div class="ts-node__row">
          <input
            #fileInput
            type="file"
            accept=".csv,text/csv"
            style="display: none"
            (change)="onFileSelected($event)"
          />
          <button class="ts-node__button" (click)="fileInput.click()">
            Load file...
          </button>
          <button
            class="ts-node__button ts-node__button--primary"
            [disabled]="!canUpload()"
            (click)="doUpload()"
          >
            {{ uploadState() === 'uploading' ? 'Uploading...' : 'Upload' }}
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
        }

        @if (errorMessage()) {
          <div class="ts-node__error">{{ errorMessage() }}</div>
        }
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
})
export class UploadNodeComponent {
  // Required inputs from @angflow/angular custom-node contract.
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<UploadNodeData>(emptyUploadNodeData());
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

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private flow = inject(NgFlowService);
  private http = inject(HttpClient);

  // Local UI state — the textarea holds pending (not-yet-uploaded) content.
  // This is NOT persisted to node.data until a successful upload.
  readonly pendingCsv = signal('');
  private uploadedCsvSnapshot = '';

  readonly label = computed(() => this.data().label ?? 'Upload');
  readonly uploadState = computed(() => this.data().uploadState ?? 'idle');
  readonly errorMessage = computed(() => this.data().errorMessage);
  readonly availableColumns = computed(() => this.data().availableColumns ?? []);
  readonly selectedColumns = computed(() => this.data().selectedColumns ?? []);

  readonly statusClass = computed(() => {
    const s = this.uploadState();
    return s === 'uploading' ? 'loading' : s;
  });

  readonly canUpload = computed(() => {
    if (this.uploadState() === 'uploading') return false;
    const pending = this.pendingCsv().trim();
    return pending.length > 0 && pending !== this.uploadedCsvSnapshot;
  });

  isSelected(col: string): boolean {
    return this.selectedColumns().includes(col);
  }

  onLabelInput(event: Event): void {
    const newLabel = (event.target as HTMLInputElement).value;
    this.flow.updateNodeData(this.id(), { label: newLabel });
    // If we have an uploaded dataset, PATCH the backend to keep labels in sync.
    const src = this.data().source;
    if (src && src.kind === 'backend') {
      this.http
        .patch(`/api/timeseries/${src.datasetId}`, { label: newLabel } satisfies PatchRequestBody)
        .subscribe({ error: () => {/* best-effort */} });
    }
  }

  onTextareaInput(event: Event): void {
    this.pendingCsv.set((event.target as HTMLTextAreaElement).value);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      this.pendingCsv.set(text);
      // File picker uploads immediately — single discrete user action, no cascade risk.
      this.doUpload();
    };
    reader.readAsText(file);
    // Reset input so selecting the same file again fires change.
    input.value = '';
  }

  toggleColumn(col: string): void {
    const current = this.selectedColumns();
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    this.flow.updateNodeData(this.id(), { selectedColumns: next });
  }

  doUpload(): void {
    const csv = this.pendingCsv();
    if (!csv.trim() || this.uploadState() === 'uploading') return;

    const existingSource = this.data().source;

    this.flow.updateNodeData(this.id(), {
      uploadState: 'uploading',
      errorMessage: undefined,
    });

    const doPost = () => {
      const body: UploadRequestBody = { label: this.label(), csv };
      this.http.post<DatasetMetadata>('/api/timeseries', body).subscribe({
        next: (meta) => {
          this.uploadedCsvSnapshot = csv;
          this.flow.updateNodeData(this.id(), {
            source: { kind: 'backend', datasetId: meta.id },
            availableColumns: meta.availableColumns,
            selectedColumns: meta.availableColumns,
            uploadState: 'idle',
            errorMessage: undefined,
          });
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as BackendErrorBody | null;
          this.flow.updateNodeData(this.id(), {
            uploadState: 'error',
            errorMessage: body?.error ?? err.message ?? `HTTP ${err.status}`,
          });
        },
      });
    };

    // If replacing an existing upload, DELETE old first, then POST new.
    if (existingSource && existingSource.kind === 'backend') {
      const oldId = existingSource.datasetId;
      this.http.delete(`/api/timeseries/${oldId}`).subscribe({
        next: () => doPost(),
        error: () => {
          // If DELETE fails, still try to POST new — the old one may already be gone.
          doPost();
        },
      });
    } else {
      doPost();
    }
  }
}
