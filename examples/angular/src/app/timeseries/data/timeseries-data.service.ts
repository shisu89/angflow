import { Injectable, Inject, signal, type Signal } from '@angular/core';
import type { TimeseriesDescriptor, QueryResult } from './descriptors';
import { descriptorKey } from './descriptors';
import {
  TIMESERIES_DATA_PROVIDERS,
  type TimeseriesDataProvider,
} from './timeseries-data-provider';

type CacheEntry = {
  descriptor: TimeseriesDescriptor;
  signal: Signal<QueryResult>;
  refCount: number;
};

/**
 * Dispatches TimeseriesDescriptors to the matching provider and memoizes
 * the resulting Signal, sharing one fetch across multiple consumers.
 *
 * IMPORTANT distinction:
 *   - query() is a PURE LOOKUP — safe to call inside computed() / effect()
 *     without double-counting. Does not touch refcounts.
 *   - acquire() explicitly increments the refcount. Consumers must pair
 *     each acquire() with a matching release() when they're done.
 *
 * This split exists because the chart node reads `query()` every effect
 * tick inside a computed(), but we only want one increment per consumer
 * per descriptor — not one per re-evaluation.
 */
@Injectable({ providedIn: 'root' })
export class TimeseriesDataService {
  private providersByKind = new Map<string, TimeseriesDataProvider>();
  private cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(TIMESERIES_DATA_PROVIDERS) providers: TimeseriesDataProvider[],
  ) {
    for (const p of providers) {
      this.providersByKind.set(p.kind, p);
    }
  }

  /**
   * Pure lookup: returns the memoized Signal for this descriptor, creating
   * the cache entry if it doesn't exist yet. Does NOT increment refcount.
   * Safe to call inside computed() and effect().
   */
  query(descriptor: TimeseriesDescriptor): Signal<QueryResult> {
    const key = descriptorKey(descriptor);
    const existing = this.cache.get(key);
    if (existing) return existing.signal;

    const provider = this.providersByKind.get(descriptor.kind);
    if (!provider) {
      const s = signal<QueryResult>({
        status: 'error',
        message: `No provider registered for kind=${descriptor.kind}`,
      });
      this.cache.set(key, { descriptor, signal: s, refCount: 0 });
      return s;
    }

    const resultSignal = provider.query(descriptor);
    this.cache.set(key, { descriptor, signal: resultSignal, refCount: 0 });
    return resultSignal;
  }

  /**
   * Explicitly mark that a consumer is observing this descriptor.
   * Increments the refcount. Must be paired with release().
   */
  acquire(descriptor: TimeseriesDescriptor): Signal<QueryResult> {
    const s = this.query(descriptor);
    const entry = this.cache.get(descriptorKey(descriptor));
    if (entry) entry.refCount++;
    return s;
  }

  /**
   * Decrement refcount; if it hits zero, drop the cache entry and tell
   * the provider to release any underlying resources.
   */
  release(descriptor: TimeseriesDescriptor): void {
    const key = descriptorKey(descriptor);
    const entry = this.cache.get(key);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      this.cache.delete(key);
      const provider = this.providersByKind.get(descriptor.kind);
      provider?.release(descriptor);
    }
  }
}
