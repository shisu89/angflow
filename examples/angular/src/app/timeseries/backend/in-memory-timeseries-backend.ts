import { Injectable, computed, signal, type Signal } from '@angular/core';
import { parseCsv, CsvParseError } from './csv-parse';
import type {
  DatasetMetadata,
  DatasetPayload,
  UploadRequestBody,
  PatchRequestBody,
} from './timeseries-backend.types';

/**
 * In-memory "server" that the demo HTTP interceptor delegates to.
 * Stores parsed timeseries datasets keyed by a generated id.
 *
 * Swapping this for a real backend = replace with a service that makes
 * real HTTP calls, and remove the interceptor that routes /api/timeseries/**
 * to this in-memory store.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryTimeseriesBackend {
  private store = new Map<string, DatasetPayload>();
  private readonly version = signal(0);

  /**
   * Reactive signal of current dataset metadata list. Consumers (e.g.
   * DatasetInspectorPanel) read this to render a live view of backend state.
   */
  readonly datasets: Signal<DatasetMetadata[]> = computed(() => {
    this.version(); // track
    return Array.from(this.store.values()).map(({ time, columns, ...meta }) => meta);
  });

  /**
   * Parse CSV, store, return metadata (no body data).
   * Throws CsvParseError on bad input — the interceptor turns that into a 400.
   */
  upload(body: UploadRequestBody): DatasetMetadata {
    const parsed = parseCsv(body.csv);
    const id = this.generateId();
    const payload: DatasetPayload = {
      id,
      label: body.label,
      availableColumns: parsed.availableColumns,
      rowCount: parsed.time.length,
      uploadedAt: new Date().toISOString(),
      time: parsed.time,
      columns: parsed.columns,
    };
    this.store.set(id, payload);
    this.version.update((v) => v + 1);
    return this.metadataOf(payload);
  }

  list(): DatasetMetadata[] {
    return Array.from(this.store.values()).map((p) => this.metadataOf(p));
  }

  get(id: string): DatasetPayload | undefined {
    return this.store.get(id);
  }

  patch(id: string, body: PatchRequestBody): DatasetMetadata | undefined {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    const updated: DatasetPayload = {
      ...existing,
      label: body.label ?? existing.label,
    };
    this.store.set(id, updated);
    this.version.update((v) => v + 1);
    return this.metadataOf(updated);
  }

  delete(id: string): boolean {
    const existed = this.store.delete(id);
    if (existed) this.version.update((v) => v + 1);
    return existed;
  }

  /** Clear every dataset (used by the "Clear backend" toolbar button). */
  clear(): void {
    if (this.store.size === 0) return;
    this.store.clear();
    this.version.update((v) => v + 1);
  }

  // ── internals ─────────────────────────────────────────────────────────

  private metadataOf(p: DatasetPayload): DatasetMetadata {
    return {
      id: p.id,
      label: p.label,
      availableColumns: p.availableColumns,
      rowCount: p.rowCount,
      uploadedAt: p.uploadedAt,
    };
  }

  private generateId(): string {
    // Short, unique enough for a demo. Not cryptographically secure.
    return `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export { CsvParseError };
