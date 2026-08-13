# System diagnostics sink and initial-dimensions flag — design

**Date:** 2026-08-14
**Status:** approved, ready for planning
**Follows:** `docs/superpowers/specs/2026-08-13-mural-copy-feedback-remediation-design.md`

## Context

The 2026-08-13 remediation closed four of mural-copy's seven open findings and
recorded three as verified-but-deferred. This design takes up the two that were
deferred for reasons that no longer hold, or that rested on a mistake.

### Correction to the previous spec

**The redundant initial `dimensions` change is not "a pure echo".** The previous
spec proposed suppressing it — "don't fire the initial post-render `dimensions`
change at all when the measured size matches whatever size the node was
created with". That fix would have been a silent breakage.

That change is the *only* mechanism that populates `node.measured` on the
consumer's node array. `applyNodeChanges` writes `element.measured` from it
(`packages/angular/src/lib/utils/changes.ts:91`) and `applyDimensionChanges`
does the same (`:185`). `measured` is a distinct field from `width`/`height`.
Suppressing the change would leave `measured` permanently `undefined` for every
node whose declared size happens to match its measurement — the exact nodes the
"optimisation" targets. mural-copy's app-side fix is safe only because that app
reads `w`/`h` and never `measured`.

So the change must keep firing. What it lacks is not suppression but
**identification**: no way for a consumer to distinguish "first measurement
after mount" from "the user resized this node". That is what this design adds.

**"Do not modify `packages/system`" was overstated.** The previous spec treated
divergence from xyflow as near-prohibitive and routed around it. The repo's
actual practice is the opposite: `packages/system/src` already diverges from
`upstream/main` across 28 files (+1666/−96), there are several `fix(system):`
commits, and there is an established convention for marking intentional
divergence — `DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this`
(`packages/system/src/xypanzoom/XYPanZoom.ts:112`). Divergence is normal here
and simply needs marking. Both changes below land in `packages/system`.

### The dev-warning gap

`addEdge` and `reconnectEdge` call `devWarn` directly for `error006` (edge
needs a source and a target) and `error007` (old edge does not exist) —
`packages/system/src/utils/edges/general.ts:140,209,217`. `devWarn` gates on
`isDevEnv()`, which tests `process.env.NODE_ENV === 'development'`. Angular's
`@angular/build:application` (esbuild) never defines that for browser bundles,
so those warnings have never reached an Angular consumer.

The previous spec's suggested remedy — "thread the store through those utils" —
was never available. `addEdge` and `reconnectEdge` are re-exported from
`@angflow/angular`'s public API (`public-api.ts:135-136`) as pure helpers the
consumer calls directly:

```ts
onConnect(conn: Connection) { this.edges.set(addEdge(conn, this.edges())); }
```

The library never calls them internally. There is no store at the call site by
design, and adding one would change a documented public signature.

## Section 1 — Dev-warning sink

### Design

`packages/system/src/utils/general.ts` gains an installable sink. The default
is byte-identical to today's behaviour, so the react and svelte reference ports
are unaffected:

```ts
const defaultDevWarn: OnError = (id, message) => {
  if (isDevEnv()) {
    console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
  }
};

let sink: OnError = defaultDevWarn;

/**
 * DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this.
 *
 * Framework wrappers install their own dev-warning channel here. `isDevEnv()`
 * gates on `process.env.NODE_ENV`, which Angular's esbuild-based builder never
 * defines for browser bundles, so the default sink is permanently silent for
 * every Angular consumer. Passing `null` restores the default.
 */
export const setDevWarnSink = (fn: OnError | null): void => {
  sink = fn ?? defaultDevWarn;
};

export const devWarn: OnError = (id, message) => sink(id, message);
```

Every existing `devWarn` call site is unchanged. The indirection fixes `006`
and `007` and any future system-internal warning at once.

### Where Angular installs it

**From `FlowStore`'s constructor**, not as a module-level side effect.

`packages/angular/package.json` declares `"sideEffects": ["*.css"]` — all JS is
advertised as side-effect-free. A top-level `setDevWarnSink(ngDevWarn)` in
`dev-warn.ts` would most likely survive, because `FlowStore` imports
`ngDevWarn` from that module and ES modules evaluate fully when imported. But
under that flag a bundler is *permitted* to drop a top-level call it cannot
prove is needed, and a diagnostic channel that silently disappears under
production bundling is precisely the failure mode this whole line of work
exists to remove.

The constructor call is idempotent, guaranteed to run whenever a flow exists,
and sits next to the existing `onError` default.

**Accepted consequence:** `addEdge` called before any `FlowStore` is
constructed stays on the silent default. A consumer calling `addEdge` in
practice has an `<ng-flow>` mounted.

**No double-warning.** system's `devWarn` sites (`006`, `007`) are pure utils
that never touch the store; the store's `onError` sites are separate. Even if
they overlapped, both resolve to `ngDevWarn`, whose dedupe cache is
module-scoped and shared.

**Global, not per-flow.** The sink is module state, so the last `FlowStore`
constructed wins. Since every `FlowStore` installs the same `ngDevWarn`, this
is inert in practice. Tests that install a different sink must restore it.

## Section 2 — `initial` flag on dimensions changes

### Design

`NodeDimensionChange` (`packages/system/src/types/changes.ts:3`) gains one
optional field:

```ts
  /**
   * True on the first dimensions change after a node mounts — the measurement
   * that populates `measured` for the first time, rather than a real size
   * change. Consumers mirroring changes into external state (Yjs, an undo
   * stack, a server) can skip or coalesce it; it carries no user-visible
   * resize. The change still fires: it is what populates `measured`, so
   * suppressing it would leave that field unset.
   */
  initial?: boolean;
```

`updateNodeInternals` (`packages/system/src/utils/store.ts`) sets it when
pushing the change, reading the node's prior measurement **before** the node is
replaced in the lookup:

```ts
initial: node.measured.width === undefined || node.measured.height === undefined,
```

`node.measured` is safe to dereference without optional chaining here:
`InternalNodeBase.measured` is a required object (`types/nodes.ts:91`), and the
adjacent `dimensionChanged` line already reads `node.measured.width` unguarded
(`store.ts:446`). Do not "harden" it with `?.` — that would make the predicate
`undefined` rather than `true` for a genuinely unmeasured node and silently drop
the flag.

### Why this is the right predicate

- A node created with `width`/`height` still has `measured = {undefined,
  undefined}` until the `ResizeObserver` fires, because `adoptUserNodes` seeds
  `measured` only from `userNode.measured` (`store.ts:164-167`). So the first
  measurement is always flagged, which is exactly the event mural-copy wanted
  to identify.
- A genuine resize has a prior `measured`, so it is not flagged.
- The resizer's own `dimensions` changes are pushed through
  `triggerNodeChanges` from `node-resizer.component.ts`, never through
  `updateNodeInternals`, so a drag-resize can never carry the flag.
- Our existing divergence preserving `measured` across re-adoption
  (`store.ts:165-166`) means a remount does not spuriously re-flag.

### Compatibility

Purely additive. `applyNodeChanges` and `applyDimensionChanges` ignore fields
they do not read, so no existing consumer changes behaviour. Angular re-exports
the type from `@angflow/system`, so consumers get the field on the updated
`.d.ts` with no Angular-side code change.

## Testing

**`packages/system`:**
- `updateNodeInternals` emits `initial: true` on a node's first measurement.
- A subsequent genuine size change on the same node is emitted without
  `initial: true`.
- `setDevWarnSink` redirects `devWarn`; `setDevWarnSink(null)` restores the
  default.
- `addEdge` with a missing `source` routes `error006` through the installed
  sink; `reconnectEdge` with an unknown edge id routes `error007`.

**`packages/angular`:**
- Constructing a `FlowStore` installs `ngDevWarn` as the system sink.
- `addEdge({} as Connection, [])` after a `FlowStore` exists produces an
  `[angflow]:`-prefixed console warning in dev mode.
- The `initial` flag survives to a bound `(nodesChange)` on first measurement.

Tests that install a sink must restore it (`setDevWarnSink(null)`) and call
`resetDevWarnDedupe()`, since both are module-scoped and outlive a TestBed.

Full gates: builds, `pnpm typecheck`, `pnpm lint`, vitest in all three
packages, and the example build.

## Release

`@angflow/system` patch → `0.1.13`, published **first** (angular resolves it
through `dist/`).

`@angflow/angular` patch → `0.3.21`.

Angular's published dependency range is `^0.1.12`, which already admits
`0.1.13`, so existing consumers pick up the system half on their next install.
The Angular republish is required for the sink installation and the updated
type declaration.

No agent-tool changes, so `AGENT_BRIDGE.md` and the `@angflow/mcp` schema
snapshot are both unaffected.

Publish with the repaired scripts (`publish-system.bat`, then
`publish-angular.bat`) — angular must go out via `pnpm publish`, which those
scripts now do.
