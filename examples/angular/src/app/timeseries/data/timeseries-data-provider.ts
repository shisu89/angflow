import { InjectionToken, type Signal } from '@angular/core';
import type { TimeseriesDescriptor, QueryResult } from './descriptors';

/**
 * A TimeseriesDataProvider knows how to fetch a specific kind of descriptor.
 *
 * Implementations register themselves under the TIMESERIES_DATA_PROVIDERS
 * multi-provider token; TimeseriesDataService dispatches to them by `kind`.
 *
 * Adding a new backend = implement one of these + register it with the
 * token. No changes to node or chart components.
 */
export interface TimeseriesDataProvider {
  readonly kind: TimeseriesDescriptor['kind'];

  /**
   * Return a reactive signal of the query result for this descriptor.
   * Called by TimeseriesDataService, which handles memoization and
   * refcounting across consumers.
   */
  query(descriptor: TimeseriesDescriptor): Signal<QueryResult>;

  /**
   * Signal that this descriptor is no longer being observed by any consumer.
   * Implementations should cancel in-flight requests and release resources.
   */
  release(descriptor: TimeseriesDescriptor): void;
}

export const TIMESERIES_DATA_PROVIDERS = new InjectionToken<
  TimeseriesDataProvider[]
>('TIMESERIES_DATA_PROVIDERS');
