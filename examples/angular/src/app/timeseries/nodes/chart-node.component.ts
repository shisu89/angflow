import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
  type Type,
} from '@angular/core';
import { HandleComponent, NodeResizerComponent, NgFlowService, Position } from '@angflow/angular';
import { TimeseriesDataService } from '../data/timeseries-data.service';
import type { TimeseriesDescriptor, QueryResult } from '../data/descriptors';
import { descriptorKey } from '../data/descriptors';
import {
  CHART_RENDERER,
  type ChartRenderer,
  type ChartSeriesInput,
} from '../chart/chart-renderer';
import type { UploadNodeData } from './upload-node.component';
import type { QueryNodeData } from './query-node.component';

export interface ChartNodeData {
  title: string;
}

export function emptyChartNodeData(title = 'Chart'): ChartNodeData {
  return { title };
}

interface UpstreamEntry {
  nodeId: string;
  nodeLabel: string;
  descriptor: TimeseriesDescriptor;
  selectedColumns: string[];
  resultSignal: ReturnType<TimeseriesDataService['query']>;
}

@Component({
  selector: 'app-ts-chart-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent, NodeResizerComponent],
  styleUrls: ['./nodes.css'],
  styles: [`:host { display: block; width: 100%; height: 100%; } .ts-node--chart { width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; } .ts-node--chart .ts-node__body { flex: 1; min-height: 0; } .ts-node__chart-host { width: 100%; height: 100%; }`],
  template: `
    <ng-flow-node-resizer [minWidth]="420" [minHeight]="280" color="#6366f1" />
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="ts-node ts-node--chart" [class.selected]="selected()">
      <div class="ts-node__header">
        <span class="ts-node__drag-grip">&#x2630;</span>
        <input
          class="ts-node__header-input nodrag"
          [value]="title()"
          (input)="onTitleInput($event)"
          placeholder="Chart"
        />
      </div>
      <div class="ts-node__body">
        <div #chartHost class="ts-node__chart-host nodrag"></div>
        @if (showEmptyState()) {
          <div class="ts-node__chart-overlay">Connect a data source</div>
        }
        @if (statusChips().length > 0) {
          <div class="ts-node__chart-chips">
            @for (chip of statusChips(); track chip.label) {
              <span class="ts-node__chart-chip" [class.error]="chip.error">
                {{ chip.label }}
              </span>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ChartNodeComponent implements AfterViewInit, OnDestroy {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<ChartNodeData>(emptyChartNodeData());
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

  @ViewChild('chartHost', { static: true }) chartHostRef!: ElementRef<HTMLDivElement>;

  private flow = inject(NgFlowService);
  private dataService = inject(TimeseriesDataService);
  private injector = inject(Injector);
  private rendererCtor = inject(CHART_RENDERER) as Type<ChartRenderer>;

  private renderer: ChartRenderer | null = null;
  private trackedDescriptors = new Map<string, TimeseriesDescriptor>();
  private resizeObserver: ResizeObserver | null = null;

  readonly title = computed(() => this.data().title ?? 'Chart');

  // Reactive list of upstream source entries (driven by selectIncomers).
  private readonly incomers = computed(() => {
    return this.flow.selectIncomers(this.id())();
  });

  private readonly upstreamEntries = computed<UpstreamEntry[]>(() => {
    const incomers = this.incomers();
    const entries: UpstreamEntry[] = [];
    for (const node of incomers) {
      const data = node.data as unknown as UploadNodeData | QueryNodeData;
      if (!data?.source || data.source.kind !== 'backend') continue;
      const resultSignal = this.dataService.query(data.source);
      entries.push({
        nodeId: node.id,
        nodeLabel: data.label ?? node.id,
        descriptor: data.source,
        selectedColumns: data.selectedColumns ?? [],
        resultSignal,
      });
    }
    return entries;
  });

  // Build the merged ChartSeriesInput[] + aggregate state.
  private readonly chartModel = computed(() => {
    const entries = this.upstreamEntries();
    if (entries.length === 0) {
      return {
        series: [] as ChartSeriesInput[],
        state: 'ready' as const,
        chips: [] as { label: string; error: boolean }[],
      };
    }

    let anyLoading = false;
    let anyError = false;
    const chips: { label: string; error: boolean }[] = [];
    const readyEntries: Array<{
      entry: UpstreamEntry;
      result: Extract<QueryResult, { status: 'ready' }>;
    }> = [];

    for (const entry of entries) {
      const r = entry.resultSignal();
      if (r.status === 'loading') {
        anyLoading = true;
        chips.push({ label: `${entry.nodeLabel}: loading`, error: false });
      } else if (r.status === 'error') {
        anyError = true;
        chips.push({ label: `${entry.nodeLabel}: ${r.message}`, error: true });
      } else {
        readyEntries.push({ entry, result: r });
      }
    }

    // Build shared x-axis as the sorted union of all ready source time arrays.
    const xSet = new Set<number>();
    for (const { result } of readyEntries) {
      for (const t of result.data.time) xSet.add(t);
    }
    const sharedX = Array.from(xSet).sort((a, b) => a - b);
    const xIndexByValue = new Map<number, number>();
    sharedX.forEach((v, i) => xIndexByValue.set(v, i));

    const series: ChartSeriesInput[] = [];
    for (const { entry, result } of readyEntries) {
      // Decide whether to suffix column name in legend (only one selected → just label)
      const cols = entry.selectedColumns.filter((c) => c in result.data.columns);
      const suffixColumn = cols.length !== 1;

      for (const col of cols) {
        const values: Array<number | null> = new Array(sharedX.length).fill(null);
        const sourceCol = result.data.columns[col];
        for (let i = 0; i < result.data.time.length; i++) {
          const idx = xIndexByValue.get(result.data.time[i]);
          if (idx !== undefined) values[idx] = sourceCol[i];
        }
        series.push({
          label: suffixColumn ? `${entry.nodeLabel} · ${col}` : entry.nodeLabel,
          time: sharedX,
          values,
        });
      }
    }

    let state: 'loading' | 'ready' | 'partial' = 'ready';
    if (readyEntries.length === 0 && anyLoading) state = 'loading';
    else if (anyLoading || anyError) state = 'partial';

    return { series, state, chips };
  });

  readonly statusChips = computed(() => this.chartModel().chips);
  readonly showEmptyState = computed(() => {
    const m = this.chartModel();
    return m.series.length === 0 && m.state === 'ready';
  });

  ngAfterViewInit(): void {
    // Instantiate the renderer via the injector so it can inject its own deps.
    runInInjectionContext(this.injector, () => {
      this.renderer = new this.rendererCtor();
    });
    this.renderer!.mount(this.chartHostRef.nativeElement);

    // ResizeObserver for dynamic resize (node resizer / window).
    this.resizeObserver = new ResizeObserver(() => this.renderer?.resize());
    this.resizeObserver.observe(this.chartHostRef.nativeElement);

    // Effect: update the chart when the model changes, and manage refcounts
    // for descriptors that drop in/out.
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const model = this.chartModel();
        this.syncTracked(this.upstreamEntries());
        this.renderer?.update(model.series, model.state);
      });
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer?.destroy();
    this.renderer = null;
    // Release every tracked descriptor.
    for (const desc of this.trackedDescriptors.values()) {
      this.dataService.release(desc);
    }
    this.trackedDescriptors.clear();
  }

  onTitleInput(event: Event): void {
    const newTitle = (event.target as HTMLInputElement).value;
    this.flow.updateNodeData(this.id(), { title: newTitle });
  }

  // ── descriptor tracking ─────────────────────────────────────────────

  private syncTracked(entries: UpstreamEntry[]): void {
    const nextKeys = new Set<string>();
    for (const e of entries) {
      const key = descriptorKey(e.descriptor);
      nextKeys.add(key);
      if (!this.trackedDescriptors.has(key)) {
        this.trackedDescriptors.set(key, e.descriptor);
        // acquire() increments the refcount for this new descriptor.
        // query() was already called (refcount-neutral) in upstreamEntries().
        this.dataService.acquire(e.descriptor);
      }
    }
    // Release any descriptor no longer in the set.
    for (const [key, desc] of this.trackedDescriptors) {
      if (!nextKeys.has(key)) {
        this.dataService.release(desc);
        this.trackedDescriptors.delete(key);
      }
    }
  }
}
