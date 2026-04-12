/**
 * A descriptor is a small, serializable reference to a data source.
 * It lives inside node.data — not the raw rows. The data service
 * dispatches descriptors to providers, which fetch the actual data.
 *
 * Add a new kind here + a matching TimeseriesDataProvider implementation
 * to support a new backend (e.g. Prometheus, S3, etc.).
 */
export type TimeseriesDescriptor =
  | { kind: 'backend'; datasetId: string };

/**
 * Parsed timeseries payload as seen by chart-side consumers.
 * `time` is always unix ms. Column arrays are the same length as `time`.
 * `null` means "no sample at this timestamp for this column".
 */
export type TimeseriesSeries = {
  time: number[];
  columns: Record<string, Array<number | null>>;
};

export type QueryResult =
  | { status: 'loading' }
  | { status: 'ready'; data: TimeseriesSeries }
  | { status: 'error'; message: string };

/**
 * Stable key used by TimeseriesDataService for memoization + refcounting.
 * JSON.stringify gives us deterministic ordering within each kind because
 * descriptor shapes are defined as records with fixed keys.
 */
export function descriptorKey(d: TimeseriesDescriptor): string {
  return JSON.stringify(d);
}
