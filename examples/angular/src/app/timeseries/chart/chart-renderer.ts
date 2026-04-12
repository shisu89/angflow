import { InjectionToken, type Type } from '@angular/core';

/**
 * One series on the chart. The chart node pre-disambiguates labels
 * (e.g. "Data 1 · temp") and pre-aligns all series to a shared x-axis,
 * so renderers receive a single shared `time` array and can assume
 * parallel-array semantics for `values`.
 */
export interface ChartSeriesInput {
  label: string;
  time: number[];                   // unix ms, shared across all series
  values: Array<number | null>;     // same length as time; null = gap
}

/**
 * A ChartRenderer mounts a chart into a host element and receives series
 * updates. Swap implementations by replacing the CHART_RENDERER provider.
 */
export interface ChartRenderer {
  mount(host: HTMLElement): void;
  update(series: ChartSeriesInput[], state: 'loading' | 'ready' | 'partial'): void;
  resize(): void;
  destroy(): void;
}

/** DI token for the concrete renderer class. The chart node instantiates it. */
export const CHART_RENDERER = new InjectionToken<Type<ChartRenderer>>('CHART_RENDERER');
