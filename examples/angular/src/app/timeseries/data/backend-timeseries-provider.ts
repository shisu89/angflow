import { Injectable, inject, signal, type Signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import type { TimeseriesDataProvider } from './timeseries-data-provider';
import type {
  TimeseriesDescriptor,
  QueryResult,
  TimeseriesSeries,
} from './descriptors';
import { descriptorKey } from './descriptors';
import type { DatasetPayload, BackendErrorBody } from '../backend/timeseries-backend.types';

type Entry = {
  result: ReturnType<typeof signal<QueryResult>>;
  cancel$: Subject<void>;
};

/**
 * Fetches `{ kind: 'backend', datasetId }` descriptors via HttpClient.
 * Requests go through whichever HttpClient is provided — in the demo this
 * is the one scoped to the timeseries route with the fake interceptor.
 *
 * Manages per-descriptor cancellation: release() cancels any in-flight
 * request for that descriptor.
 */
@Injectable({ providedIn: 'root' })
export class BackendTimeseriesProvider implements TimeseriesDataProvider {
  readonly kind = 'backend' as const;

  private http = inject(HttpClient);
  private entries = new Map<string, Entry>();

  query(descriptor: TimeseriesDescriptor): Signal<QueryResult> {
    if (descriptor.kind !== 'backend') {
      // Shouldn't happen — service dispatches by kind — but be safe.
      const s = signal<QueryResult>({
        status: 'error',
        message: `BackendTimeseriesProvider cannot handle kind=${descriptor.kind}`,
      });
      return s;
    }

    const key = descriptorKey(descriptor);
    const existing = this.entries.get(key);
    if (existing) return existing.result;

    const result = signal<QueryResult>({ status: 'loading' });
    const cancel$ = new Subject<void>();
    this.entries.set(key, { result, cancel$ });

    this.http
      .get<DatasetPayload>(`/api/timeseries/${descriptor.datasetId}`)
      .pipe(takeUntil(cancel$))
      .subscribe({
        next: (payload) => {
          const data: TimeseriesSeries = {
            time: payload.time,
            columns: payload.columns,
          };
          result.set({ status: 'ready', data });
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as BackendErrorBody | null;
          const message = body?.error ?? err.message ?? `HTTP ${err.status}`;
          result.set({ status: 'error', message });
        },
      });

    return result;
  }

  release(descriptor: TimeseriesDescriptor): void {
    if (descriptor.kind !== 'backend') return;
    const key = descriptorKey(descriptor);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.cancel$.next();
    entry.cancel$.complete();
    this.entries.delete(key);
  }
}
