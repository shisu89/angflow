import {
  ChangeDetectionStrategy,
  Component,
  Type,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import { addEdge } from '@angflow/system';
import type { Node, Edge, Connection } from '@angflow/angular';
import {
  UploadNodeComponent,
  emptyUploadNodeData,
  type UploadNodeData,
} from './nodes/upload-node.component';
import {
  QueryNodeComponent,
  emptyQueryNodeData,
} from './nodes/query-node.component';
import {
  ChartNodeComponent,
  emptyChartNodeData,
} from './nodes/chart-node.component';
import { DatasetInspectorPanelComponent } from './dataset-inspector-panel.component';
import { InMemoryTimeseriesBackend } from './backend/in-memory-timeseries-backend';

@Component({
  selector: 'app-timeseries-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    DatasetInspectorPanelComponent,
  ],
  template: `
    <div class="page">
      <div class="page__toolbar">
        <div class="page__brand">Timeseries Charts</div>
        <div class="page__actions">
          <button class="page__btn" (click)="addUpload()">+ Upload</button>
          <button class="page__btn" (click)="addQuery()">+ Query</button>
          <button class="page__btn" (click)="addChart()">+ Chart</button>
          <button class="page__btn page__btn--danger" (click)="clearBackend()">
            Clear backend
          </button>
        </div>
      </div>
      <div class="page__canvas">
        <ng-flow
          [nodes]="nodes()"
          [edges]="edges()"
          [nodeTypes]="nodeTypes"
          [fitView]="true"
          [deleteKeyCode]="['Backspace', 'Delete']"
          (init)="onInit($event)"
          (nodesChange)="onNodesChange($event)"
          (edgesChange)="onEdgesChange($event)"
          (connect)="onConnect($event)"
          (nodesDelete)="onNodesDelete($event)"
        >
          <ng-flow-background variant="dots" [gap]="22" [size]="1" />
          <ng-flow-controls />
        </ng-flow>
        <app-ts-dataset-inspector-panel />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      flex-direction: column;
    }
    .page {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .page__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .page__brand {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.02em;
    }
    .page__actions {
      display: flex;
      gap: 8px;
    }
    .page__btn {
      padding: 6px 12px;
      background: #6366f1;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .page__btn:hover {
      background: #4f46e5;
    }
    .page__btn--danger {
      background: #ef4444;
    }
    .page__btn--danger:hover {
      background: #dc2626;
    }
    .page__canvas {
      position: relative;
      flex: 1;
      min-width: 0;
      min-height: 0;
      background: #f1f5f9;
    }
  `],
})
export class TimeseriesPageComponent {
  private http = inject(HttpClient);
  private backend = inject(InMemoryTimeseriesBackend);

  readonly nodeTypes: Record<string, Type<unknown>> = {
    tsUpload: UploadNodeComponent,
    tsQuery: QueryNodeComponent,
    tsChart: ChartNodeComponent,
  };

  private idCounter = 0;
  readonly nodes = signal<Node[]>(this.seedNodes());
  readonly edges = signal<Edge[]>([]);

  private flow?: NgFlowService<Node, Edge>;

  onInit(service: NgFlowService<Node, Edge>): void {
    this.flow = service;
  }

  onNodesChange(changes: any[]): void {
    this.nodes.set(applyNodeChanges(changes, this.nodes()));
  }

  onEdgesChange(changes: any[]): void {
    this.edges.set(applyEdgeChanges(changes, this.edges()));
  }

  onConnect(connection: Connection): void {
    this.edges.set(addEdge(connection, this.edges()) as Edge[]);
  }

  onNodesDelete(deletedNodes: Node[]): void {
    // For each deleted upload node with a non-null source, DELETE the backend
    // dataset. This uses HttpClient so the interceptor handles it in-process.
    for (const node of deletedNodes) {
      if (node.type !== 'tsUpload') continue;
      const data = node.data as unknown as UploadNodeData;
      const src = data?.source;
      if (src && src.kind === 'backend') {
        this.http.delete(`/api/timeseries/${src.datasetId}`).subscribe({
          error: () => {/* best-effort cleanup */},
        });
      }
    }
  }

  addUpload(): void {
    this.nodes.set([
      ...this.nodes(),
      {
        id: this.nextId('upload'),
        type: 'tsUpload',
        position: { x: 60 + Math.random() * 80, y: 60 + Math.random() * 80 },
        data: emptyUploadNodeData(),
      },
    ]);
  }

  addQuery(): void {
    this.nodes.set([
      ...this.nodes(),
      {
        id: this.nextId('query'),
        type: 'tsQuery',
        position: { x: 60 + Math.random() * 80, y: 260 + Math.random() * 80 },
        data: emptyQueryNodeData(),
      },
    ]);
  }

  addChart(): void {
    this.nodes.set([
      ...this.nodes(),
      {
        id: this.nextId('chart'),
        type: 'tsChart',
        position: { x: 420 + Math.random() * 80, y: 120 + Math.random() * 80 },
        data: emptyChartNodeData(),
      },
    ]);
  }

  clearBackend(): void {
    // Clear the in-memory store. Also null out any `source` references in
    // upload/query nodes so the UI isn't holding stale ids.
    this.backend.clear();
    this.nodes.set(
      this.nodes().map((n) => {
        if (n.type === 'tsUpload' || n.type === 'tsQuery') {
          return {
            ...n,
            data: {
              ...(n.data as any),
              source: null,
              availableColumns: [],
              selectedColumns: [],
            },
          };
        }
        return n;
      }),
    );
  }

  private nextId(prefix: string): string {
    this.idCounter++;
    return `${prefix}_${this.idCounter}`;
  }

  private seedNodes(): Node[] {
    return [
      {
        id: this.nextId('upload'),
        type: 'tsUpload',
        position: { x: 60, y: 60 },
        data: emptyUploadNodeData('Data A'),
      },
      {
        id: this.nextId('query'),
        type: 'tsQuery',
        position: { x: 60, y: 320 },
        data: emptyQueryNodeData('Query'),
      },
      {
        id: this.nextId('chart'),
        type: 'tsChart',
        position: { x: 460, y: 120 },
        data: emptyChartNodeData('Chart'),
      },
    ];
  }
}
