# Timeseries Chart Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable example in `examples/angular` where CSV-uploaded timeseries data is POSTed to an in-memory "backend" and a chart node fetches + renders it by reference, with multiple data nodes able to feed a single chart.

**Architecture:** Data nodes hold descriptors (not raw rows) in `node.data`. A functional HTTP interceptor intercepts `/api/timeseries/**` calls and delegates to an `InMemoryTimeseriesBackend` service — so the nodes, providers, and chart use `HttpClient` exactly as they would against a real backend. A `TimeseriesDataService` dispatches descriptors to `TimeseriesDataProvider` implementations (first impl: `BackendTimeseriesProvider`). Chart rendering is a parallel DI axis via a `ChartRenderer` interface (first impl: `UplotChartRenderer`).

**Tech Stack:** Angular 21 (standalone components + signals), `@angflow/angular`, `uplot` (chart library, new dep), functional HTTP interceptors.

**No automated tests.** Per the design spec, this example uses manual verification only. Each task ends with a type-check (`npx tsc --noEmit`) and a commit; Task 18 walks the 11-point verification checklist by running the dev server.

**Reference spec:** `docs/superpowers/specs/2026-04-11-timeseries-chart-example-design.md`

---

## Pre-task: Establish baseline

- [ ] **Step 1: Verify baseline type-check passes**

Run from repo root:
```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0 (no errors). If this baseline fails, fix before starting any task below — you need a green baseline to attribute errors to new code.

---

## Task 1: Install uplot and scaffold the timeseries directory

**Files:**
- Modify: `examples/angular/package.json`
- Create: `examples/angular/src/app/timeseries/.keep` (placeholder to commit empty directory; removed in later tasks)

- [ ] **Step 1: Add uplot to dependencies**

Edit `examples/angular/package.json`, add `"uplot": "^1.6.31"` to the `dependencies` block, alphabetized. After the edit, the dependencies block should contain (relevant lines shown in context):

```json
    "rxjs": ">=7.0.0",
    "tslib": "^2.3.0",
    "uplot": "^1.6.31"
```

- [ ] **Step 2: Install dependencies**

Run from repo root:
```bash
pnpm install
```

Expected: installs `uplot` and `@types/...` (uplot ships its own types, no separate @types package needed). If pnpm is not available, use `npm install` from `examples/angular`.

- [ ] **Step 3: Scaffold the timeseries directory with placeholders**

Create empty directories by adding `.keep` files. From repo root:

```bash
mkdir -p examples/angular/src/app/timeseries/nodes
mkdir -p examples/angular/src/app/timeseries/backend
mkdir -p examples/angular/src/app/timeseries/data
mkdir -p examples/angular/src/app/timeseries/chart
```

No file creation needed yet — subsequent tasks will populate these directories directly.

- [ ] **Step 4: Verify type-check still passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add examples/angular/package.json pnpm-lock.yaml
git commit -m "chore(examples/angular): add uplot dependency for timeseries example"
```

If `pnpm-lock.yaml` is at the repo root, adjust the path accordingly. If it doesn't exist (e.g. npm is used instead), add `examples/angular/package-lock.json`.

---

## Task 2: Core type contracts

**Files:**
- Create: `examples/angular/src/app/timeseries/data/descriptors.ts`
- Create: `examples/angular/src/app/timeseries/backend/timeseries-backend.types.ts`

- [ ] **Step 1: Create `descriptors.ts`**

Write `examples/angular/src/app/timeseries/data/descriptors.ts`:

```ts
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
```

- [ ] **Step 2: Create `timeseries-backend.types.ts`**

Write `examples/angular/src/app/timeseries/backend/timeseries-backend.types.ts`:

```ts
/**
 * DTOs shared by the interceptor, the in-memory backend, and the
 * frontend provider/nodes. These describe the wire format of the
 * /api/timeseries/** HTTP API.
 */

export interface DatasetMetadata {
  id: string;
  label: string;
  availableColumns: string[];
  rowCount: number;
  uploadedAt: string; // ISO 8601
}

export interface DatasetPayload extends DatasetMetadata {
  /** Unix ms, sorted ascending. */
  time: number[];
  /** Column name -> parallel array of same length as `time`; null = gap. */
  columns: Record<string, Array<number | null>>;
}

export interface UploadRequestBody {
  label: string;
  csv: string;
}

export interface PatchRequestBody {
  label?: string;
}

export interface BackendErrorBody {
  error: string;
  row?: number;    // 1-indexed, if applicable
  column?: string; // if applicable
}
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0. These files are pure type declarations; any error means a syntax issue.

- [ ] **Step 4: Commit**

```bash
git add examples/angular/src/app/timeseries/data/descriptors.ts examples/angular/src/app/timeseries/backend/timeseries-backend.types.ts
git commit -m "feat(timeseries): add descriptor + backend DTO type contracts"
```

---

## Task 3: CSV parser (pure function, server-side)

**Files:**
- Create: `examples/angular/src/app/timeseries/backend/csv-parse.ts`

- [ ] **Step 1: Create the parser**

Write `examples/angular/src/app/timeseries/backend/csv-parse.ts`:

```ts
/**
 * Pragmatic CSV parser for the demo backend.
 *
 * Rules (per spec):
 * - First non-empty line is the header row.
 * - First column = time/x; all other columns = value columns.
 * - Quoted fields ("foo,bar") supported; escape via doubled quote ("").
 * - Empty cells in value columns parse to null.
 * - Value cells must be numeric or empty; otherwise error.
 * - Time parsing: Number(v) → if >= 1e12 treat as ms; if >= 1e9 treat as
 *   seconds (→ *1000); else treat as plain numeric x (pass through as ms-like).
 *   If Number(v) is NaN, try Date.parse(v); if NaN, error.
 * - A single bad row fails the whole parse with the row number + column name.
 *
 * This is deliberately NOT a production-grade RFC 4180 implementation.
 * Good enough for the demo; swap for papaparse if you need more.
 */

export interface ParsedCsv {
  /** Column names in source order, including the time column first. */
  headerColumns: string[];
  /** Value column names (everything except the first/time column). */
  availableColumns: string[];
  /** Unix ms, sorted ascending by parse order (not re-sorted). */
  time: number[];
  /** Column name -> parallel array of same length as `time`. */
  columns: Record<string, Array<number | null>>;
}

export class CsvParseError extends Error {
  constructor(message: string, public row?: number, public column?: string) {
    super(message);
  }
}

/**
 * Tokenize a single CSV line into fields, honoring quoted fields and
 * doubled-quote escapes.
 */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    let field = '';
    if (i < n && line[i] === '"') {
      // quoted field
      i++;
      while (i < n) {
        if (line[i] === '"') {
          if (i + 1 < n && line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
    } else {
      while (i < n && line[i] !== ',') {
        field += line[i];
        i++;
      }
    }
    fields.push(field);
    if (i < n && line[i] === ',') {
      i++;
      if (i === n) {
        // trailing comma → empty final field
        fields.push('');
        break;
      }
    } else {
      break;
    }
  }
  return fields;
}

/**
 * Split on LF/CRLF and drop lines that are entirely blank (after trim).
 */
function splitLines(raw: string): string[] {
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function parseTimeCell(raw: string, row: number): number {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new CsvParseError(`Empty time value`, row, 'time');
  }
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) {
    if (asNum >= 1e12) return asNum;              // already ms
    if (asNum >= 1e9) return asNum * 1000;        // seconds → ms
    return asNum;                                 // plain numeric x
  }
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) return asDate;
  throw new CsvParseError(`Unparseable time: "${trimmed}"`, row, 'time');
}

function parseValueCell(raw: string, row: number, column: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const asNum = Number(trimmed);
  if (Number.isNaN(asNum)) {
    throw new CsvParseError(`Non-numeric value "${trimmed}"`, row, column);
  }
  return asNum;
}

export function parseCsv(raw: string): ParsedCsv {
  const lines = splitLines(raw);
  if (lines.length < 2) {
    throw new CsvParseError('CSV must have a header row and at least one data row');
  }

  const headerColumns = parseLine(lines[0]).map((h) => h.trim());
  if (headerColumns.length < 2) {
    throw new CsvParseError('CSV must have at least 2 columns (time + 1 value)');
  }
  const availableColumns = headerColumns.slice(1);

  const time: number[] = [];
  const columns: Record<string, Array<number | null>> = {};
  for (const col of availableColumns) columns[col] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    const rowNumber = i + 1; // 1-indexed for humans
    if (fields.length !== headerColumns.length) {
      throw new CsvParseError(
        `Expected ${headerColumns.length} fields, got ${fields.length}`,
        rowNumber,
      );
    }
    time.push(parseTimeCell(fields[0], rowNumber));
    for (let c = 1; c < headerColumns.length; c++) {
      const col = headerColumns[c];
      columns[col].push(parseValueCell(fields[c], rowNumber, col));
    }
  }

  return { headerColumns, availableColumns, time, columns };
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/backend/csv-parse.ts
git commit -m "feat(timeseries): add pragmatic CSV parser with time auto-detect"
```

---

## Task 4: In-memory timeseries backend store

**Files:**
- Create: `examples/angular/src/app/timeseries/backend/in-memory-timeseries-backend.ts`

- [ ] **Step 1: Create the backend service**

Write `examples/angular/src/app/timeseries/backend/in-memory-timeseries-backend.ts`:

```ts
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
```

Note: the `datasets` signal is defined using a computed-like IIFE pattern to keep parity with `this.version()`. If this proves awkward, swap to a plain `computed()`:

```ts
import { Injectable, computed, signal, type Signal } from '@angular/core';
// ...
readonly datasets: Signal<DatasetMetadata[]> = computed(() => {
  this.version();
  return Array.from(this.store.values()).map(({ time, columns, ...meta }) => meta);
});
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/backend/in-memory-timeseries-backend.ts
git commit -m "feat(timeseries): add in-memory backend store with reactive datasets signal"
```

---

## Task 5: Functional HTTP interceptor for `/api/timeseries/**`

**Files:**
- Create: `examples/angular/src/app/timeseries/backend/timeseries-http.interceptor.ts`

- [ ] **Step 1: Create the interceptor**

Write `examples/angular/src/app/timeseries/backend/timeseries-http.interceptor.ts`:

```ts
import { inject } from '@angular/core';
import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { concatMap, delay, of, throwError } from 'rxjs';
import { InMemoryTimeseriesBackend, CsvParseError } from './in-memory-timeseries-backend';
import type {
  UploadRequestBody,
  PatchRequestBody,
  BackendErrorBody,
} from './timeseries-backend.types';

/**
 * Catches /api/timeseries/** requests and serves them from an in-memory store.
 * Simulates 200–400ms latency so loading states are observable.
 *
 * Swap this out for real HTTP by deleting the interceptor registration from
 * the timeseries route providers — the node/provider layer uses HttpClient
 * exactly as it would against a real backend.
 */
export const timeseriesHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/timeseries')) {
    return next(req);
  }

  const backend = inject(InMemoryTimeseriesBackend);
  const latency = 200 + Math.random() * 200;

  // Routing: split on /, find the id segment if any.
  //   POST   /api/timeseries
  //   GET    /api/timeseries
  //   GET    /api/timeseries/:id
  //   PATCH  /api/timeseries/:id
  //   DELETE /api/timeseries/:id
  const url = req.url.split('?')[0];
  const parts = url.split('/').filter(Boolean);
  // parts === ['api', 'timeseries']         → collection
  //        === ['api', 'timeseries', 'abc'] → item
  const id = parts.length >= 3 ? parts[2] : undefined;

  try {
    if (!id && req.method === 'POST') {
      const body = req.body as UploadRequestBody;
      if (!body || typeof body.csv !== 'string' || typeof body.label !== 'string') {
        return errorResponse(400, { error: 'label and csv are required' }, latency);
      }
      const meta = backend.upload(body);
      return okResponse(meta, latency);
    }

    if (!id && req.method === 'GET') {
      return okResponse(backend.list(), latency);
    }

    if (id && req.method === 'GET') {
      const payload = backend.get(id);
      if (!payload) return errorResponse(404, { error: `Dataset ${id} not found` }, latency);
      return okResponse(payload, latency);
    }

    if (id && req.method === 'PATCH') {
      const body = req.body as PatchRequestBody;
      const updated = backend.patch(id, body ?? {});
      if (!updated) return errorResponse(404, { error: `Dataset ${id} not found` }, latency);
      return okResponse(updated, latency);
    }

    if (id && req.method === 'DELETE') {
      const existed = backend.delete(id);
      if (!existed) return errorResponse(404, { error: `Dataset ${id} not found` }, latency);
      return of(new HttpResponse({ status: 204, url: req.url })).pipe(delay(latency));
    }

    return errorResponse(
      405,
      { error: `Method ${req.method} not allowed on ${url}` },
      latency,
    );
  } catch (e) {
    if (e instanceof CsvParseError) {
      return errorResponse(
        400,
        { error: e.message, row: e.row, column: e.column },
        latency,
      );
    }
    return errorResponse(500, { error: (e as Error).message }, latency);
  }
};

function okResponse<T>(body: T, latency: number) {
  return of(new HttpResponse({ status: 200, body, url: '' })).pipe(delay(latency));
}

function errorResponse(status: number, body: BackendErrorBody, latency: number) {
  // Delay the error the same way a real server would take to respond.
  return of(null).pipe(
    delay(latency),
    concatMap(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status,
            statusText: statusText(status),
            error: body,
            url: '',
          }),
      ),
    ),
  );
}

function statusText(status: number): string {
  switch (status) {
    case 200: return 'OK';
    case 204: return 'No Content';
    case 400: return 'Bad Request';
    case 404: return 'Not Found';
    case 405: return 'Method Not Allowed';
    case 500: return 'Internal Server Error';
    default: return '';
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/backend/timeseries-http.interceptor.ts
git commit -m "feat(timeseries): add functional HTTP interceptor delegating to in-memory backend"
```

---

## Task 6: Data provider interface + DI token

**Files:**
- Create: `examples/angular/src/app/timeseries/data/timeseries-data-provider.ts`

- [ ] **Step 1: Create the provider interface and token**

Write `examples/angular/src/app/timeseries/data/timeseries-data-provider.ts`:

```ts
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
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/data/timeseries-data-provider.ts
git commit -m "feat(timeseries): add TimeseriesDataProvider interface + DI token"
```

---

## Task 7: Backend data provider (HttpClient-based)

**Files:**
- Create: `examples/angular/src/app/timeseries/data/backend-timeseries-provider.ts`

- [ ] **Step 1: Create the backend provider**

Write `examples/angular/src/app/timeseries/data/backend-timeseries-provider.ts`:

```ts
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
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/data/backend-timeseries-provider.ts
git commit -m "feat(timeseries): add BackendTimeseriesProvider with per-descriptor cancel"
```

---

## Task 8: TimeseriesDataService (dispatcher + refcount)

**Files:**
- Create: `examples/angular/src/app/timeseries/data/timeseries-data.service.ts`

- [ ] **Step 1: Create the dispatcher service**

Write `examples/angular/src/app/timeseries/data/timeseries-data.service.ts`:

```ts
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
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/data/timeseries-data.service.ts
git commit -m "feat(timeseries): add TimeseriesDataService with refcount-based dispatch"
```

---

## Task 9: ChartRenderer interface + DI token

**Files:**
- Create: `examples/angular/src/app/timeseries/chart/chart-renderer.ts`

- [ ] **Step 1: Create the renderer interface**

Write `examples/angular/src/app/timeseries/chart/chart-renderer.ts`:

```ts
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
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/chart/chart-renderer.ts
git commit -m "feat(timeseries): add ChartRenderer interface + CHART_RENDERER token"
```

---

## Task 10: uPlot chart renderer implementation

**Files:**
- Create: `examples/angular/src/app/timeseries/chart/uplot-chart-renderer.ts`
- Modify: `examples/angular/src/styles.css`

- [ ] **Step 1: Add uPlot's CSS globally**

Open `examples/angular/src/styles.css`. You'll see an existing `@import '@angflow/angular/dist/style.css';` near the top. Add the uPlot CSS import right after it:

```css
@import '@angflow/angular/dist/style.css';
@import 'uplot/dist/uPlot.min.css';
```

Why global: uplot attaches its DOM to the chart host but its CSS targets global classes (`.uplot`, `.u-wrap`, etc.). Scoping via `:host` won't reach them.

- [ ] **Step 2: Create the uPlot renderer**

Write `examples/angular/src/app/timeseries/chart/uplot-chart-renderer.ts`:

```ts
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
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0. If uplot's types complain, double-check the `import uPlot, { type AlignedData, type Options as UPlotOptions } from 'uplot';` syntax — some versions expose these differently. Adjust to `import uPlot from 'uplot';` and use `uPlot.AlignedData`, `uPlot.Options` instead if needed.

- [ ] **Step 4: Commit**

```bash
git add examples/angular/src/styles.css examples/angular/src/app/timeseries/chart/uplot-chart-renderer.ts
git commit -m "feat(timeseries): add uPlot chart renderer implementation"
```

---

## Task 11: Shared node CSS

**Files:**
- Create: `examples/angular/src/app/timeseries/nodes/nodes.css`

- [ ] **Step 1: Create the shared node stylesheet**

Write `examples/angular/src/app/timeseries/nodes/nodes.css`:

```css
/*
 * Shared styles for timeseries demo nodes.
 * Each node type imports this (or redeclares via styles array).
 */

.ts-node {
  background: #ffffff;
  border: 2px solid #6366f1;
  border-radius: 10px;
  min-width: 260px;
  max-width: 360px;
  font-size: 12px;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.14);
}

.ts-node.selected {
  box-shadow: 0 6px 22px rgba(99, 102, 241, 0.32);
}

.ts-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #6366f1;
  color: #ffffff;
  border-radius: 8px 8px 0 0;
}

.ts-node__header-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ffffff;
  font-weight: 700;
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.ts-node__header-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.ts-node__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ts-node__status-dot.idle    { background: #10b981; }
.ts-node__status-dot.loading { background: #f59e0b; animation: ts-pulse 1s ease-in-out infinite; }
.ts-node__status-dot.error   { background: #ef4444; }

@keyframes ts-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}

.ts-node__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ts-node__textarea {
  width: 100%;
  min-height: 70px;
  max-height: 140px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  background: #f8fafc;
  color: #0f172a;
  outline: none;
  resize: vertical;
}

.ts-node__textarea:focus {
  border-color: #6366f1;
  background: #ffffff;
}

.ts-node__row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ts-node__button {
  padding: 5px 10px;
  border: 1px solid #6366f1;
  background: #ffffff;
  color: #6366f1;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.ts-node__button:hover:not(:disabled) {
  background: #eef2ff;
}

.ts-node__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ts-node__button--primary {
  background: #6366f1;
  color: #ffffff;
}

.ts-node__button--primary:hover:not(:disabled) {
  background: #4f46e5;
}

.ts-node__select {
  padding: 5px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 12px;
  background: #f8fafc;
  color: #0f172a;
  width: 100%;
  outline: none;
}

.ts-node__tagbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ts-node__tag {
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.ts-node__tag.selected {
  background: #6366f1;
  color: #ffffff;
  border-color: #6366f1;
}

.ts-node__error {
  font-size: 11px;
  color: #dc2626;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 5px;
  padding: 6px 8px;
}

.ts-node__hint {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  padding: 4px;
}

/* Chart node specifics */
.ts-node--chart {
  min-width: 460px;
  min-height: 300px;
}

.ts-node--chart .ts-node__body {
  padding: 0;
  position: relative;
}

.ts-node__chart-host {
  width: 100%;
  height: 280px;
  position: relative;
}

.ts-node__chart-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
}

.ts-node__chart-chips {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.ts-node__chart-chip {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  color: #ffffff;
}

.ts-node__chart-chip.error {
  background: rgba(220, 38, 38, 0.9);
}
```

- [ ] **Step 2: Verify type-check passes (CSS doesn't break type-check but sanity-check)**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/nodes/nodes.css
git commit -m "feat(timeseries): add shared node stylesheet"
```

---

## Task 12: UploadNodeComponent

**Files:**
- Create: `examples/angular/src/app/timeseries/nodes/upload-node.component.ts`

- [ ] **Step 1: Create the upload node**

Write `examples/angular/src/app/timeseries/nodes/upload-node.component.ts`:

```ts
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
    return `${s}`;
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
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/nodes/upload-node.component.ts
git commit -m "feat(timeseries): add UploadNodeComponent with serialized backend writes"
```

---

## Task 13: QueryNodeComponent

**Files:**
- Create: `examples/angular/src/app/timeseries/nodes/query-node.component.ts`

- [ ] **Step 1: Create the query node**

Write `examples/angular/src/app/timeseries/nodes/query-node.component.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  OnInit,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HandleComponent, NgFlowService, Position } from '@angflow/angular';
import type { TimeseriesDescriptor } from '../data/descriptors';
import type { DatasetMetadata } from '../backend/timeseries-backend.types';

export interface QueryNodeData {
  label: string;
  source: TimeseriesDescriptor | null;
  availableColumns: string[];
  selectedColumns: string[];
}

export function emptyQueryNodeData(label = 'Query'): QueryNodeData {
  return {
    label,
    source: null,
    availableColumns: [],
    selectedColumns: [],
  };
}

@Component({
  selector: 'app-ts-query-node',
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
          placeholder="Query"
        />
        <div class="ts-node__status-dot idle"></div>
      </div>
      <div class="ts-node__body nodrag">
        <div class="ts-node__row">
          <select
            class="ts-node__select"
            [value]="selectedId()"
            (change)="onPick($event)"
          >
            <option value="">— pick a dataset —</option>
            @for (ds of datasets(); track ds.id) {
              <option [value]="ds.id">{{ ds.label }} ({{ ds.rowCount }} rows)</option>
            }
          </select>
          <button class="ts-node__button" (click)="refresh()">
            @if (loading()) { ... } @else { ↻ }
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
        } @else {
          <div class="ts-node__hint">Pick a dataset to see its columns</div>
        }

        @if (error()) {
          <div class="ts-node__error">{{ error() }}</div>
        }
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
})
export class QueryNodeComponent implements OnInit {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<QueryNodeData>(emptyQueryNodeData());
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

  private flow = inject(NgFlowService);
  private http = inject(HttpClient);

  readonly datasets = signal<DatasetMetadata[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly label = computed(() => this.data().label ?? 'Query');
  readonly availableColumns = computed(() => this.data().availableColumns ?? []);
  readonly selectedColumns = computed(() => this.data().selectedColumns ?? []);
  readonly selectedId = computed(() => {
    const s = this.data().source;
    return s && s.kind === 'backend' ? s.datasetId : '';
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<DatasetMetadata[]>('/api/timeseries').subscribe({
      next: (list) => {
        this.datasets.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load datasets');
        this.loading.set(false);
      },
    });
  }

  isSelected(col: string): boolean {
    return this.selectedColumns().includes(col);
  }

  onLabelInput(event: Event): void {
    const newLabel = (event.target as HTMLInputElement).value;
    this.flow.updateNodeData(this.id(), { label: newLabel });
  }

  onPick(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.flow.updateNodeData(this.id(), {
        source: null,
        availableColumns: [],
        selectedColumns: [],
      });
      return;
    }
    const picked = this.datasets().find((d) => d.id === id);
    if (!picked) return;
    this.flow.updateNodeData(this.id(), {
      source: { kind: 'backend', datasetId: id },
      availableColumns: picked.availableColumns,
      selectedColumns: picked.availableColumns,
    });
  }

  toggleColumn(col: string): void {
    const current = this.selectedColumns();
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    this.flow.updateNodeData(this.id(), { selectedColumns: next });
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/nodes/query-node.component.ts
git commit -m "feat(timeseries): add QueryNodeComponent with dataset picker"
```

---

## Task 14: ChartNodeComponent (with x-axis union merging)

**Files:**
- Create: `examples/angular/src/app/timeseries/nodes/chart-node.component.ts`

- [ ] **Step 1: Create the chart node**

Write `examples/angular/src/app/timeseries/nodes/chart-node.component.ts`:

```ts
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
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
import { HandleComponent, NgFlowService, Position } from '@angflow/angular';
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
  imports: [HandleComponent],
  styleUrls: ['./nodes.css'],
  template: `
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="ts-node ts-node--chart" [class.selected]="selected()">
      <div class="ts-node__header">
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
        // Note: dataService.query was already called in upstreamEntries()
        // with its refcount-increment side effect — that's how we "acquire".
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
```

**Why the `acquire` / `query` split matters here:** `upstreamEntries()` calls `dataService.query(source)` inside a `computed()`, which re-runs on every upstream change. `query()` is the refcount-neutral pure lookup (see Task 8), so re-evaluating the computed does not create a refcount leak. The effect then calls `syncTracked()` which uses `acquire()` once per new descriptor and `release()` once per descriptor that drops out.

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/nodes/chart-node.component.ts
git commit -m "feat(timeseries): add ChartNodeComponent with x-axis union merging"
```

---

## Task 15: DatasetInspectorPanel

**Files:**
- Create: `examples/angular/src/app/timeseries/dataset-inspector-panel.component.ts`

- [ ] **Step 1: Create the inspector panel**

Write `examples/angular/src/app/timeseries/dataset-inspector-panel.component.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { InMemoryTimeseriesBackend } from './backend/in-memory-timeseries-backend';

/**
 * Collapsible corner panel that shows the current state of
 * InMemoryTimeseriesBackend. Purely a teaching aid — lets users
 * see the "server" state change as they upload.
 */
@Component({
  selector: 'app-ts-dataset-inspector-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inspector" [class.collapsed]="collapsed()">
      <div class="inspector__header" (click)="toggle()">
        <span>Backend: {{ count() }} dataset{{ count() === 1 ? '' : 's' }}</span>
        <span class="inspector__caret">{{ collapsed() ? '▸' : '▾' }}</span>
      </div>
      @if (!collapsed()) {
        <div class="inspector__body">
          @if (count() === 0) {
            <div class="inspector__empty">No datasets uploaded</div>
          } @else {
            <table class="inspector__table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Rows</th>
                  <th>Columns</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                @for (ds of datasets(); track ds.id) {
                  <tr>
                    <td>{{ ds.label }}</td>
                    <td>{{ ds.rowCount }}</td>
                    <td class="inspector__cols">{{ ds.availableColumns.join(', ') }}</td>
                    <td class="inspector__id">{{ shortId(ds.id) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      bottom: 14px;
      right: 14px;
      z-index: 10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .inspector {
      background: rgba(15, 23, 42, 0.94);
      color: #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.4);
      min-width: 280px;
      max-width: 440px;
      overflow: hidden;
      backdrop-filter: blur(4px);
    }
    .inspector__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }
    .inspector__header:hover { background: rgba(51, 65, 85, 0.5); }
    .inspector__caret { font-size: 10px; color: #94a3b8; }
    .inspector__body {
      padding: 4px 14px 12px;
      max-height: 220px;
      overflow-y: auto;
    }
    .inspector__empty {
      font-size: 11px;
      color: #94a3b8;
      padding: 8px 0;
      font-style: italic;
    }
    .inspector__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .inspector__table th {
      text-align: left;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.05em;
      padding: 4px 6px 6px;
      border-bottom: 1px solid #334155;
    }
    .inspector__table td {
      padding: 5px 6px;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    }
    .inspector__cols {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #cbd5e1;
    }
    .inspector__id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #94a3b8;
    }
  `],
})
export class DatasetInspectorPanelComponent {
  private backend = inject(InMemoryTimeseriesBackend);

  readonly collapsed = signal(false);
  readonly datasets = this.backend.datasets;
  readonly count = computed(() => this.datasets().length);

  toggle(): void {
    this.collapsed.update((v) => !v);
  }

  shortId(id: string): string {
    // ds_xxx_yyy → ds_xxx...yyy
    if (id.length <= 14) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/dataset-inspector-panel.component.ts
git commit -m "feat(timeseries): add DatasetInspectorPanel for visible backend state"
```

---

## Task 16: TimeseriesPageComponent

**Files:**
- Create: `examples/angular/src/app/timeseries/timeseries-page.component.ts`

- [ ] **Step 1: Create the page component**

Write `examples/angular/src/app/timeseries/timeseries-page.component.ts`:

```ts
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
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add examples/angular/src/app/timeseries/timeseries-page.component.ts
git commit -m "feat(timeseries): add TimeseriesPageComponent wiring nodes + toolbar"
```

---

## Task 17: Register route, providers, and nav entry

**Files:**
- Modify: `examples/angular/src/app/app.routes.ts`
- Modify: `examples/angular/src/app/shell/shell.component.ts`

- [ ] **Step 1: Register the timeseries route with scoped providers**

Edit `examples/angular/src/app/app.routes.ts`. Add the new imports at the top, register the route under the shell's children (alongside `showcase` and `kitchen-sink`), and wire up `provideHttpClient(withInterceptors([timeseriesHttpInterceptor]))` + DI providers at the route level.

At the top of the file, add these imports:

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TimeseriesPageComponent } from './timeseries/timeseries-page.component';
import { timeseriesHttpInterceptor } from './timeseries/backend/timeseries-http.interceptor';
import { TimeseriesDataService } from './timeseries/data/timeseries-data.service';
import { TIMESERIES_DATA_PROVIDERS } from './timeseries/data/timeseries-data-provider';
import { BackendTimeseriesProvider } from './timeseries/data/backend-timeseries-provider';
import { CHART_RENDERER } from './timeseries/chart/chart-renderer';
import { UplotChartRenderer } from './timeseries/chart/uplot-chart-renderer';
```

Then add the route entry inside the shell's `children` array, right after `{ path: 'kitchen-sink', component: KitchenSinkComponent }` and before the wildcard `'**'` entry:

```ts
      {
        path: 'timeseries',
        component: TimeseriesPageComponent,
        providers: [
          provideHttpClient(withInterceptors([timeseriesHttpInterceptor])),
          BackendTimeseriesProvider,
          {
            provide: TIMESERIES_DATA_PROVIDERS,
            useExisting: BackendTimeseriesProvider,
            multi: true,
          },
          TimeseriesDataService,
          { provide: CHART_RENDERER, useValue: UplotChartRenderer },
        ],
      },
```

Note: `{ provide: CHART_RENDERER, useValue: UplotChartRenderer }` provides the **class**, not an instance. The chart node component reads the token and calls `new rendererCtor()` to create per-node instances.

- [ ] **Step 2: Add the nav link**

Edit `examples/angular/src/app/shell/shell.component.ts`, line 12–16. Add a "Timeseries" link alongside Gallery, Showcase, Kitchen Sink:

```html
      <nav class="shell__nav">
        <a routerLink="/gallery" routerLinkActive="is-active">Gallery</a>
        <a routerLink="/showcase" routerLinkActive="is-active">Showcase</a>
        <a routerLink="/kitchen-sink" routerLinkActive="is-active">Kitchen Sink</a>
        <a routerLink="/timeseries" routerLinkActive="is-active">Timeseries</a>
      </nav>
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd examples/angular && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Verify the app builds end-to-end**

```bash
cd examples/angular && npm run build
```
Expected: Angular build succeeds with no errors. Warnings about bundle size are OK; errors are not.

- [ ] **Step 5: Commit**

```bash
git add examples/angular/src/app/app.routes.ts examples/angular/src/app/shell/shell.component.ts
git commit -m "feat(examples/angular): register /timeseries route and nav entry"
```

---

## Task 18: Manual verification

**Files:** None (this task runs the dev server and walks the 11-point checklist).

- [ ] **Step 1: Start the dev server**

```bash
cd examples/angular && npm run dev
```

Wait for the "compiled successfully" message. Default URL: `http://localhost:4200`.

- [ ] **Step 2: Run through the 11-point verification checklist**

Open the app in a browser and verify each item. If any step fails, stop, fix the underlying issue, rebuild, and re-run that step.

**Test data to paste** (copy this into the textarea when needed):

```csv
time,temperature,humidity
2026-01-01T00:00:00Z,18.2,45
2026-01-01T01:00:00Z,17.8,47
2026-01-01T02:00:00Z,17.3,49
2026-01-01T03:00:00Z,16.9,51
2026-01-01T04:00:00Z,16.5,53
2026-01-01T05:00:00Z,16.4,55
```

A second test dataset with different time range:

```csv
time,pressure
2026-01-01T02:30:00Z,1013
2026-01-01T03:30:00Z,1012
2026-01-01T04:30:00Z,1011
2026-01-01T05:30:00Z,1010
2026-01-01T06:30:00Z,1009
```

Checklist:

  1. [ ] Navigate to `/timeseries` (click "Timeseries" in nav). Seed graph renders: Upload + Query + Chart, unconnected. Chart shows "Connect a data source". Dataset inspector panel in bottom-right says "Backend: 0 datasets".
  2. [ ] Paste the first CSV into the Upload node's textarea. Click "Upload". Status dot flashes amber (loading) for ~200–400ms, then green (idle). Tag bar appears with `temperature` and `humidity`, both highlighted. Dataset inspector panel shows "Backend: 1 dataset".
  3. [ ] Drag a connection from the Upload node's right handle to the Chart node's left handle. Chart shows two lines labeled `Data A · temperature` and `Data A · humidity`.
  4. [ ] Click "+ Upload" in toolbar. New upload node appears. Rename its label to "Data B". Paste the second CSV. Click "Upload". Connect it to the same Chart node. Chart now shows three lines (temperature, humidity, pressure). Time axis spans the union; lines have gaps where the other source has no data.
  5. [ ] Create another Upload node, use the file picker: save either CSV to disk, load it via "Load file...". Uploads immediately (no button click). Dataset inspector panel shows 3 datasets.
  6. [ ] Create a Query node ("+ Query" in toolbar). Click the refresh button. Dropdown populates with uploaded datasets. Pick one. Tag bar appears with its columns. Connect to a new Chart node (create one first). Chart renders the picked dataset.
  7. [ ] Edit the first Upload node's label ("Data A" → "Weather"). Chart legend updates without a re-fetch (no loading flash). Query node's dropdown shows the new label on next refresh click.
  8. [ ] In Data A upload node, click the `humidity` tag to deselect. Chart drops the humidity line; temperature remains. No loading flash (data already cached).
  9. [ ] Click the first Upload node, press Delete. Node disappears. Chart drops its lines. Dataset inspector panel shows one fewer dataset. Query node dropdown still shows the old dataset until you click refresh (stale picker), at which point it's gone.
  10. [ ] Observe the chart with two sources of different time ranges (e.g. re-create a second Data B). Axis spans union; gaps render correctly as breaks in the line (because `spanGaps: false`).
  11. [ ] Click "Clear backend" in the toolbar. All upload/query nodes lose their source refs. Chart shows error chips for previously-connected datasets on next effect tick, then clears to empty state. Dataset inspector panel shows 0 datasets.

- [ ] **Step 3: Fix any issues found during verification**

If any step failed, diagnose the root cause, edit the relevant file, and re-run from Step 1 of this task. Common issues:

- **Chart doesn't render:** check browser console for uplot errors. uplot CSS may not be loading — verify Step 1 of Task 10 (styles.css import) took effect.
- **HTTP calls return 404 unexpectedly:** the interceptor registration is scoped to the `/timeseries` route. If you see real HTTP calls going to `localhost:4200/api/timeseries/*` in the network tab, the interceptor isn't running — recheck Task 17 Step 1 (the `providers` block on the route).
- **`No provider for HttpClient`:** same root cause — route-scoped `provideHttpClient` is missing.
- **Effects fire in infinite loops:** re-read the `acquire()` / `release()` split in the Task 14 patch to Task 8. `query()` inside a `computed()` must be refcount-neutral.
- **Legend labels show column name twice:** the one-column-suffix rule in `chartModel` uses `cols.length !== 1` — if a node contributes two columns called the same thing in different sources, disambiguation still needs the suffix.

- [ ] **Step 4: Commit any verification fixes**

If Step 3 produced changes, commit them:

```bash
git add -u
git commit -m "fix(timeseries): verification fixes

- <describe each fix>"
```

If no fixes were needed, skip this commit step.

- [ ] **Step 5: Stop the dev server**

Ctrl+C in the terminal running `npm run dev`.

---

## Plan self-review checklist

(Author's note — this section was filled out during plan authoring; engineer executing the plan can skip.)

**Spec coverage:** Each section of the design spec maps to at least one task:

- HTTP API → Task 5 (interceptor implements all endpoints), Task 4 (backend store exposes methods), Task 2 (DTOs).
- Source descriptors → Task 2, Task 12/13 (Upload/Query node data shapes).
- Provider + data service contracts → Task 6, 7, 8.
- Chart renderer contract → Task 9, 10.
- UploadNodeComponent / QueryNodeComponent / ChartNodeComponent → Task 12, 13, 14.
- TimeseriesPageComponent (seed graph, providers, deletion effect, toolbar) → Task 16, 17.
- DatasetInspectorPanel → Task 15.
- Edge cases table → covered by Task 18 verification steps 2, 4, 8, 9, 11 + code paths in Tasks 12, 14, 16.
- File layout → Task 1 scaffolds, subsequent tasks populate.
- Verification (manual, 11-step) → Task 18.

**Placeholder scan:** No TBD/TODO/"implement later"/"fill in" phrases. Each code block is complete. No "similar to Task N" references.

**Type consistency:**
- `TimeseriesDescriptor`, `QueryResult`, `TimeseriesSeries` defined once in Task 2, used consistently in Tasks 6–14.
- `UploadNodeData`, `QueryNodeData`, `ChartNodeData` defined in Tasks 12–14 with matching `emptyX()` helpers, consumed in Task 16.
- `DatasetMetadata`, `DatasetPayload`, `UploadRequestBody`, `PatchRequestBody`, `BackendErrorBody` defined in Task 2, used in Tasks 4, 5, 7, 12, 13.
- `TimeseriesDataService.query()` vs `.acquire()` / `.release()` — the split is motivated and applied in Task 14's patch to Task 8. After the patch, `query()` is refcount-neutral and `acquire()` increments; Task 14 uses both correctly.
- `ChartRenderer.mount/update/resize/destroy` signatures consistent across Task 9 (interface) and Task 10 (impl).
- `CHART_RENDERER` token is `InjectionToken<Type<ChartRenderer>>` — provided via `useValue` with the class reference in Task 17, consumed via `inject(CHART_RENDERER)` + `new rendererCtor()` in Task 14.

No inconsistencies found.
