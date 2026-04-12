import { Injectable } from '@angular/core';
import uPlot, { type AlignedData, type Options as UPlotOptions } from 'uplot';
import type { ChartRenderer, ChartSeriesInput } from './chart-renderer';

const SERIES_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#0ea5e9', // sky
  '#a855f7', // purple
  '#f43f5e', // rose
  '#14b8a6', // teal
];

/**
 * Chart renderer backed by uPlot. One instance per ChartNodeComponent.
 *
 * uPlot requires a single shared x-axis and re-builds the DOM on
 * setSize/setData, which fits our update protocol (the chart node
 * pre-aligns data before calling update()).
 */
@Injectable()
export class UplotChartRenderer implements ChartRenderer {
  private host: HTMLElement | null = null;
  private chart: uPlot | null = null;
  private lastSeries: ChartSeriesInput[] = [];

  mount(host: HTMLElement): void {
    this.host = host;
    // Build an empty chart so the DOM exists; update() will populate it.
    this.rebuild([]);
  }

  update(series: ChartSeriesInput[], _state: 'loading' | 'ready' | 'partial'): void {
    this.lastSeries = series;
    // uPlot's series set is defined at construction time, so rebuild
    // whenever the set of series changes. Cheap for demo-sized data.
    this.rebuild(series);
  }

  resize(): void {
    if (!this.host || !this.chart) return;
    const { width, height } = this.host.getBoundingClientRect();
    if (width > 0 && height > 0) {
      this.chart.setSize({ width, height });
    }
  }

  destroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.host = null;
    this.lastSeries = [];
  }

  // ── internals ─────────────────────────────────────────────────────────

  private rebuild(series: ChartSeriesInput[]): void {
    if (!this.host) return;
    this.chart?.destroy();
    this.chart = null;

    const { width, height } = this.host.getBoundingClientRect();
    const w = Math.max(200, Math.floor(width));
    const h = Math.max(120, Math.floor(height));

    if (series.length === 0) {
      // Empty chart: render with a single "no data" placeholder series.
      const data: AlignedData = [[], []] as unknown as AlignedData;
      const opts: UPlotOptions = {
        width: w,
        height: h,
        scales: { x: { time: true } },
        series: [
          {},
          { label: '(no data)', stroke: '#cbd5e1' },
        ],
        axes: [{ stroke: '#64748b' }, { stroke: '#64748b' }],
        legend: { show: true },
      };
      this.chart = new uPlot(opts, data, this.host);
      return;
    }

    // Convert unix-ms times to unix-seconds (uPlot's time axis expects seconds).
    const xs = series[0].time.map((t) => t / 1000);
    const data: AlignedData = [
      xs,
      ...series.map((s) => s.values as unknown as number[]),
    ] as unknown as AlignedData;

    const opts: UPlotOptions = {
      width: w,
      height: h,
      scales: { x: { time: true } },
      series: [
        {},
        ...series.map((s, i) => ({
          label: s.label,
          stroke: SERIES_COLORS[i % SERIES_COLORS.length],
          width: 2,
          spanGaps: false,
        })),
      ],
      axes: [
        { stroke: '#64748b' },
        { stroke: '#64748b' },
      ],
      legend: { show: true },
    };
    this.chart = new uPlot(opts, data, this.host);
  }
}
