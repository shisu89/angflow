# Timeseries Chart Example — Design

- **Date:** 2026-04-11
- **Status:** Approved for implementation planning
- **Location in repo:** `examples/angular/src/app/timeseries/` (new top-level section alongside `showcase` and `kitchen-sink`)

## Goal

Add a runnable example to `examples/angular` that demonstrates building a small data-flow application on top of `@angflow/angular`: the user uploads CSV timeseries data into a node, that node publishes the data to a backend, and a chart node fetches and renders the data by reference. Multiple data nodes feeding one chart node produce a multi-series chart.

The example must be shaped so that swapping the demo backend for a real backend, or swapping the chart library for a different one, each reduces to a single-file change at a well-defined DI boundary.

## Non-goals

- Changes to `packages/angular` or `packages/system`. This is a pure consumer example.
- Automated unit/e2e tests. Verification is manual via `npm run dev` (see Verification).
- Save/restore of flows to localStorage. The example resets on reload.
- Real streaming / live updates. Datasets are static once uploaded.
- Production-grade CSV parsing (quoted-comma-inside-quoted-quote edge cases etc.). The parser is pragmatic — it handles headers, quoted fields, and common time formats, and that's it.

## Key decisions (summary of brainstorming)

| Decision | Choice | Notes |
|---|---|---|
| Chart library | `uplot` | With a `ChartRenderer` abstraction for provider swap |
| Data source | CSV upload + dataset reference | Not procedural, not streaming |
| Upload UX | Textarea paste **and** file picker | Both, on the Upload node |
| CSV format | Multi-series, wide format | First column time, rest named value columns |
| Time format | Auto-detect ISO / unix s / unix ms / numeric | Normalized to unix ms on the wire |
| Series selection | Tag bar on data node | All selected by default |
| Section placement | Own top-level section | `examples/angular/src/app/timeseries/` |
| Legend labels | `${nodeLabel} · ${columnName}` | Or just `${nodeLabel}` for single-column nodes |
| Data in `node.data` | **Descriptors only**, not raw data | Raw data lives in the backend |
| Backend for demo | Angular `HttpInterceptor` + in-memory store | Zero extra deps, production-shaped HttpClient code |
| Node types | `Upload`, `Query`, `Chart` | Upload writes, Query references, Chart reads |
| Testing | Manual verification | No automated tests for this example |

## Architecture

Layered, top to bottom:

```
TimeseriesPageComponent
 └── <ng-flow> with 3 custom node types
       • UploadNodeComponent    (CSV → POST /api/timeseries)
       • QueryNodeComponent     (pick existing dataset)
       • ChartNodeComponent     (reads upstream via edges, fetches & renders)
 └── DatasetInspectorPanel      (collapsible, shows backend state)

TimeseriesDataService (DI-scoped to the timeseries section)
 └── dispatches TimeseriesDescriptor → TimeseriesDataProvider
 └── memoizes results per descriptor key
 └── refcounts; releases cache entries when last consumer drops

BackendTimeseriesProvider
 └── uses Angular HttpClient.get('/api/timeseries/:id')
 └── returns Signal<QueryResult>

TimeseriesBackendInterceptor  (demo only — swapped out in real use)
 └── intercepts /api/timeseries/** calls
 └── simulates 200–400ms latency
 └── delegates to InMemoryTimeseriesBackend

InMemoryTimeseriesBackend  (plain service, not HTTP)
 └── parses CSVs on upload, stores by id
 └── upload / list / get / patch / delete

Chart rendering (separate DI axis):
ChartNodeComponent → ChartRenderer (DI token) → UplotChartRenderer (first impl)
```

**Why descriptors, not data, live in `node.data`:** the goal is to make the example shaped like real backend-connected apps from the start. A node represents a handle on a dataset, not the dataset itself. This keeps FlowStore small and means that swapping the in-memory backend for a real one changes nothing in the node layer.

**Why the chart renderer is a separate DI axis:** the chart abstraction is orthogonal to the data abstraction. A different chart library (roll-your-own SVG, echarts, plotly) must be drop-in replaceable without touching the data flow.

## HTTP API

All endpoints under `/api/timeseries`. JSON request/response bodies. The interceptor applies 200–400ms latency uniformly.

```
POST   /api/timeseries
  body: { label: string, csv: string }
  →     { id, label, availableColumns, rowCount, uploadedAt }

GET    /api/timeseries
  →     Array<{ id, label, availableColumns, rowCount, uploadedAt }>

GET    /api/timeseries/:id
  →     { id, label, availableColumns, rowCount, uploadedAt,
          time: number[], columns: Record<string, Array<number | null>> }

PATCH  /api/timeseries/:id
  body: { label?: string }
  →     { id, label, availableColumns, rowCount, uploadedAt }

DELETE /api/timeseries/:id
  → 204
```

- The backend owns CSV parsing. The Upload node POSTs raw text; the backend parses once and stores parsed columns. In real use you would swap this for a real server that does the same.
- `time` on the wire is always unix ms. The parser auto-detects ISO strings, unix seconds, unix ms, and plain numeric x values, normalizing to ms.
- The list endpoint returns metadata only. The full series endpoint returns every column; clients pick the columns they care about using `selectedColumns` from the node.

### CSV parsing rules (server side)

- First non-empty line is the header row. Column names are trimmed.
- First column = time/x. All remaining columns are value columns.
- Quoted fields (`"foo,bar"`) are supported. Embedded quote escape via doubled quote (`""`).
- Empty cells parse to `null`. Non-numeric non-null cells in value columns are a parse error.
- Time column parse order: try `Number(v)` first; if >= 1e12 treat as ms, else if >= 1e9 treat as seconds (→ *1000), else treat as plain numeric x (pass through). If `Number(v)` is NaN, try `Date.parse(v)`; if NaN, parse error.
- A parse error on any row fails the whole POST with HTTP 400 and a message identifying the row number and column.

## Source descriptors

```ts
// descriptors.ts
export type TimeseriesDescriptor =
  | { kind: 'backend'; datasetId: string };
// Future: | { kind: 'prometheus'; query: string } | { kind: 's3'; url: string } | ...

export type TimeseriesSeries = {
  time: number[];                                  // unix ms
  columns: Record<string, Array<number | null>>;   // parallel arrays, same length as time; null = gap
};

export type QueryResult =
  | { status: 'loading' }
  | { status: 'ready'; data: TimeseriesSeries }
  | { status: 'error'; message: string };
```

## Node data shapes

```ts
type UploadNodeData = {
  label: string;
  source: TimeseriesDescriptor | null; // null until first successful upload
  availableColumns: string[];
  selectedColumns: string[];
  uploadState: 'idle' | 'uploading' | 'error';
  errorMessage?: string;
};

type QueryNodeData = {
  label: string;
  source: TimeseriesDescriptor | null; // null until user picks a dataset
  availableColumns: string[];
  selectedColumns: string[];
};

type ChartNodeData = {
  title: string;
};
```

Upload and Query nodes emit the **same** `TimeseriesDescriptor` shape. The Chart node does not know or care which node type produced it.

## Provider + data service contracts

```ts
// timeseries-data-provider.ts
export interface TimeseriesDataProvider {
  readonly kind: TimeseriesDescriptor['kind'];
  query(descriptor: TimeseriesDescriptor): Signal<QueryResult>;
}

export const TIMESERIES_DATA_PROVIDERS =
  new InjectionToken<TimeseriesDataProvider[]>('TIMESERIES_DATA_PROVIDERS');

// timeseries-data.service.ts
@Injectable()
export class TimeseriesDataService {
  constructor(@Inject(TIMESERIES_DATA_PROVIDERS) providers: TimeseriesDataProvider[]) { ... }

  // Memoized by stable descriptor key (JSON.stringify). Same descriptor returns the same Signal.
  query(descriptor: TimeseriesDescriptor): Signal<QueryResult>;

  // Refcount decrement; on zero, drop the cached signal and cancel any in-flight request.
  release(descriptor: TimeseriesDescriptor): void;
}
```

- `query()` dispatches by `descriptor.kind` to the matching provider. Unknown kinds return a `status: 'error'` signal immediately.
- Multiple chart nodes subscribing to the same dataset share one underlying fetch via memoization.
- In-flight fetches are cancelled via `takeUntil` when their refcount hits zero (e.g., the consuming chart node is deleted or the source is disconnected).

## Chart renderer contract

```ts
// chart-renderer.ts
export interface ChartSeriesInput {
  label: string;                // pre-disambiguated: `${nodeLabel} · ${colName}`
  time: number[];               // unix ms, shared x-axis across all series
  values: Array<number | null>; // same length as time; null for gaps
}

export interface ChartRenderer {
  mount(host: HTMLElement): void;
  update(series: ChartSeriesInput[], state: 'loading' | 'ready' | 'partial'): void;
  resize(): void;
  destroy(): void;
}

export const CHART_RENDERER = new InjectionToken<Type<ChartRenderer>>('CHART_RENDERER');
```

**X-axis union merging is done by `ChartNodeComponent`, not by the renderer.** When two upstream sources have different time arrays, the chart node merges them into a sorted union and inserts `null` in each series where that source has no sample. The renderer always receives a single shared x-axis. This keeps the renderer interface minimal and keeps uPlot's single-x-array constraint from leaking into the abstraction.

## Node components

### UploadNodeComponent

**Layout (top to bottom):**
- Header row: editable `<input>` bound to `label`, plus a small status indicator (`idle`/`uploading`/`error`).
- Body: `<textarea>` for CSV paste, a "Load file..." button that opens a native `<input type="file">`, and an "Upload" button. Textarea holds pending (not-yet-uploaded) text; the Upload button is enabled whenever the textarea content is non-empty and differs from the currently uploaded content.
- Tag bar: one toggle chip per `availableColumns`, all selected by default.
- One source handle on `Position.Right`.

**Upload trigger rules (deliberate, not debounced — to avoid DELETE→POST cascades on rapid edits):**
- **Textarea path:** explicit "Upload" button click.
- **File picker path:** uploads immediately on file selection (single discrete action, no cascade risk).

**Behaviors:**
- On upload trigger, POST `/api/timeseries` with `{ label, csv }`. Uploads are serialized per node: if an upload is already in flight, the new trigger waits for it to settle (no parallel uploads from one node).
- **Success:** `flow.updateNodeData(id, { source: { kind: 'backend', datasetId: res.id }, availableColumns: res.availableColumns, selectedColumns: res.availableColumns, uploadState: 'idle' })`.
- **Failure:** `updateNodeData(id, { uploadState: 'error', errorMessage })`. Existing `source` is preserved so a transient failure doesn't orphan a working connection.
- On `label` edit **with an existing source**, `PATCH /api/timeseries/:id` with `{ label }`.
- On upload trigger **with an existing source** (CSV replacement): `DELETE` old id, then POST new. If the DELETE succeeds but the POST fails, the node enters the error state with `source: null`. Because uploads are user-triggered and serialized, this sequence is never interrupted by another upload.
- On **node deletion**, `DELETE /api/timeseries/:id` fires from a page-level effect (see `TimeseriesPageComponent` — the component's own `ngOnDestroy` is too late because `node.data` is already gone).

### QueryNodeComponent

**Layout:**
- Header: editable label + small refresh button.
- Body: `<select>` showing datasets from `GET /api/timeseries`, displayed as `"${label} (${rowCount} rows)"`.
- Tag bar identical to Upload.
- One source handle on `Position.Right`.

**Behaviors:**
- On mount, fetch the dataset list and populate the picker. Skeleton state while in flight.
- On selection, `updateNodeData(id, { source: { kind: 'backend', datasetId }, availableColumns, selectedColumns: availableColumns })`.
- Refresh button re-runs the list call so newly uploaded datasets appear without remounting.
- A Query node **does not** delete on its own deletion — it is a read-only reference. Upload nodes own their uploads; Query nodes consume them.
- If the referenced dataset has been deleted, the chart (not the Query node) surfaces the error, because the chart is the thing fetching.

### ChartNodeComponent

**Layout:**
- Header: editable `<input>` bound to `title`.
- Body: absolutely-positioned host `<div>` that the renderer mounts into. Min size ~420×260, resizable via `xy-flow__node-resizer`.
- Per-source loading/error chips in the top-right corner of the body when any source is not `ready`.
- One target handle on `Position.Left`.

**Behaviors:**
- On mount, instantiate the renderer (injected via `CHART_RENDERER`, default `UplotChartRenderer`) and call `renderer.mount(host)`.
- An `effect()`:
  1. Reads `flow.selectIncomers(this.id())()` → list of upstream nodes.
  2. For each upstream node with a non-null `source`, calls `dataService.query(source)` → gets `Signal<QueryResult>`.
  3. Tracks the set of descriptors currently referenced. On each change, calls `dataService.release(...)` on descriptors that dropped out.
- A `computed()` builds `ChartSeriesInput[]`:
  1. Filter `ready` results.
  2. For each ready source, pick only `selectedColumns` from the upstream node's data.
  3. Union all time arrays into a shared sorted x-axis.
  4. For each `(source, column)` pair, produce a `values` array aligned to the shared x-axis with `null` in gaps.
  5. Label as `${nodeLabel} · ${columnName}`, or just `${nodeLabel}` if the node contributes exactly one selected column.
  6. Compute aggregate state: all `ready` → `'ready'`, any `loading` → `'partial'` (show what we have), all `loading` → `'loading'`.
- Call `renderer.update(series, state)` whenever the computed changes.
- `ResizeObserver` on the host → `renderer.resize()`.
- `ngOnDestroy` → `renderer.destroy()` and release all tracked descriptors.

**Empty state:** when there are no connections, the renderer receives an empty series array with `state: 'ready'`; the chart node overlays a centered "Connect a data source" message.

## TimeseriesPageComponent

- Hosts the `<ng-flow>` with a seed graph: one Upload node, one Query node, one Chart node, no edges — so users see something immediately and can connect things in one click.
- Registers `nodeTypes: { upload: UploadNodeComponent, query: QueryNodeComponent, chart: ChartNodeComponent }`.
- Provides (scoped to the section, **not** `providedIn: 'root'`):
  - `TimeseriesDataService`
  - `{ provide: TIMESERIES_DATA_PROVIDERS, useClass: BackendTimeseriesProvider, multi: true }`
  - `{ provide: CHART_RENDERER, useValue: UplotChartRenderer }`
  - `{ provide: HTTP_INTERCEPTORS, useClass: TimeseriesBackendInterceptor, multi: true }`
  - `InMemoryTimeseriesBackend`
- Owns the "node deletion → backend DELETE" effect: watches the nodes signal for removals, and for each removed Upload node with a non-null source, calls the backend DELETE. Must run before the node's data is fully gone — captured via a shallow copy taken on each change.
- Small toolbar with: "Add Upload node", "Add Query node", "Add Chart node", "Clear backend".

## DatasetInspectorPanel

- Collapsible corner panel that lists the current state of `InMemoryTimeseriesBackend`. Purely a teaching aid — makes the system's state visible as the user uploads.
- Columns: `label`, `rowCount`, `uploadedAt`, `id` (truncated).
- Refreshes automatically by reading a `datasets` signal on `InMemoryTimeseriesBackend` (the in-memory store exposes a signal of its contents).
- Approximately 40 LOC.

## Edge cases

| Scenario | Handling |
|---|---|
| CSV parse fails on backend | POST returns 400; Upload node shows red status indicator + error message |
| Query node references deleted dataset | Chart shows error chip for that source; other sources render normally |
| Upload node deleted mid-fetch | `release()` called; in-flight HTTP request cancelled via `takeUntil` |
| Chart with zero connected sources | Renders "Connect a data source" placeholder |
| Multi-source, mismatched time ranges | Chart merges to union x-axis, renders gaps as nulls |
| Same dataset connected twice | Descriptor memoization → single fetch, rendered once (dedup by descriptor key) |
| User clears `selectedColumns` | That source contributes nothing; other sources render; no re-fetch |
| Label edit after connection | Chart legend updates reactively via `computed` |
| Large CSV (50k+ rows) | Acceptable for demo; uPlot handles it fine; parser is O(n) |
| "Clear backend" while connected | All chart sources go to `error: dataset not found` simultaneously; chart node surfaces the error chips |
| Upload node CSV replaced | Old dataset DELETEd before new POST, to keep the backend clean |

## File layout

```
examples/angular/src/app/timeseries/
  timeseries.routes.ts
  timeseries-page.component.ts
  timeseries-page.component.css
  dataset-inspector-panel.component.ts
  nodes/
    upload-node.component.ts
    query-node.component.ts
    chart-node.component.ts
    nodes.css
  backend/
    timeseries-backend.types.ts           # DTOs shared between interceptor and callers
    in-memory-timeseries-backend.ts       # parses + stores + exposes datasets signal
    timeseries-http.interceptor.ts        # HttpClient <-> in-memory backend
    csv-parse.ts                          # ~60-line pragmatic parser, server-side
  data/
    descriptors.ts
    timeseries-data.service.ts
    timeseries-data-provider.ts           # interface + DI token
    backend-timeseries-provider.ts
  chart/
    chart-renderer.ts                     # interface + DI token + types
    uplot-chart-renderer.ts               # first implementation
```

Plus one edit to the example app shell to add a route and nav entry for `/timeseries`.

Rough LOC estimate (sanity check, not a commitment): backend + interceptor + parser ~250, data service + providers ~150, chart renderer ~200, three node components ~150 each, page component + inspector panel ~160, types and glue ~100. Total roughly ~1200 LOC.

## Verification (manual)

Launch `npm run dev` in `examples/angular` and confirm:

1. Navigate to `/timeseries`. Seed graph renders: Upload + Query + Chart, unconnected. Chart shows "Connect a data source".
2. Paste a simple 2-column CSV into the Upload node. Status flips to `uploading` briefly, then `idle`. Tag bar shows the value column. Dataset appears in the inspector panel.
3. Connect Upload → Chart. Chart shows one line with the expected label `${uploadLabel} · ${col}`.
4. Paste a second CSV into a second Upload node (add one via the toolbar). Connect it to the same chart. Chart shows two lines.
5. Use the file picker on a third Upload node. Load a CSV file from disk. Same flow works.
6. Create a Query node, hit refresh, pick an existing dataset, connect to a new Chart. Chart renders.
7. Edit a data node's label. Chart legend updates without re-fetching.
8. Toggle off a column in a data node's tag bar. That series disappears from the chart; others remain.
9. Delete an Upload node. Its dataset disappears from the inspector panel and from any connected chart. Query nodes referencing it show an error for that source next refresh.
10. Upload two CSVs with different time ranges. Chart x-axis spans the union; gaps render correctly.
11. Hit "Clear backend". All chart sources go to error simultaneously.

## Out of scope / future work

- Streaming / live updates (would add a websocket-style provider and a timer-driven source).
- Save/restore the flow to localStorage or the backend.
- A real HTTP backend (a Node sidecar or deployed service). Replacing `TimeseriesBackendInterceptor` + `InMemoryTimeseriesBackend` with a real URL is a one-file change.
- A second `ChartRenderer` implementation (e.g., roll-your-own SVG) to prove the abstraction. Only worth adding when someone actually wants it.
- Authentication / per-user datasets.
- Column-level type annotations (integer vs float vs ordinal).
- Dataset editing (the backend is append-only in the demo).
