# injectNgFlowNode Migration — Design (Cluster 6 of the 2026-06-11 deferred-work round)

**Goal:** Built-in node components read their data through `injectNgFlowNode()` instead of flat `@Input()`s; the inputs path stays supported for user components; docs present context as the preferred custom-node API.

**Part of:** `2026-06-11-deferred-work-master.md`. Closes the H3-follow-up deferred item. Non-breaking.

## Today

The mechanism already exists and runs for every node:

- `NG_FLOW_NODE_CONTEXT` token (`services/tokens.ts:29`) + `injectNgFlowNode<TData>()` (`utils/inject-ng-flow-node.ts:22`), both public API.
- `NodeRendererComponent.getNodeInjector(nodeId)` (`node-renderer.component.ts:400-419`) builds a per-node child injector providing `NODE_ID` and `NG_FLOW_NODE_CONTEXT`; `buildNodeContext()` (lines 493-523) exposes per-property `computed()` signals: `id`, `data`, `type`, `selected`, `dragging`, `zIndex`, `isConnectable`, `position`, `sourcePosition`, `targetPosition`, `dragHandle`, `collapsed`.
- Delivery today: `*ngComponentOutlet` with `inputs: getNodeInputs(node)` (line 121) filtered by `getDeclaredInputs()` (lines 474-477) — built-ins declare `@Input()`s, so the flat-inputs machinery runs for every built-in node on every cache miss (C2's per-node cache key bounds the cost, but the object rebuild remains).

## Design

### Migrate built-ins

- The built-in node components (default, input, output, group — enumerate from the registered builtin map in node-renderer) drop their `@Input()` declarations and instead `injectNgFlowNode()` once, reading the signals they need in their templates. Visual output must be pixel-identical (templates only change binding sources).
- Where a built-in needs something the context lacks, extend `buildNodeContext()` (additive) rather than keeping a residual input. Audit first; expected gaps: none (the context already covers the C2 cache-key fields).

### Cheapen the inputs path for context-only components

- `getNodeInputs`/`getDeclaredInputs`: when a component's declared-inputs set is empty, short-circuit — return a shared frozen empty object, skip building/filtering entirely, and skip the inputs-identity churn in the C2 cache entry (the cache key fields still apply; only the inputs object construction is skipped). User components with `@Input()`s see zero behavior change.

### Docs and example

- `packages/angular/README.md` (or its custom-nodes doc section): `injectNgFlowNode` documented as the preferred API with a complete snippet; the `@Input()` path documented as supported-but-legacy (no deprecation warning — that was explicitly decided against this round).
- `examples/angular`: one custom node converted to (or added using) `injectNgFlowNode`, exercising `data`, `selected`, and `isConnectable`.

## Testing

- Existing built-in rendering specs keep passing unmodified where possible — they are the pixel-parity net; where they set inputs directly they're updated to drive the store instead.
- New specs: a context-based node renders and updates when `data`/`selected` change (signal propagation through the per-node injector); the empty-declared-inputs short-circuit returns the shared object (identity-stable across recomputes); a legacy `@Input()` user component still receives inputs (the back-compat pin).
- Manual smoke in `examples/angular`: select/drag/connect built-ins; the converted example node updates live.

## Out of scope

Deprecating the inputs path (decided against); edge-side context (`injectNgFlowEdge`) — separate idea, not designed; minimap nodeComponent (Cluster 2).
