# System Diagnostics Sink and Initial-Dimensions Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@angflow/system`'s own dev warnings reachable in Angular builds, and let consumers tell a node's first measurement apart from a real resize.

**Architecture:** Two independent, additive changes in `packages/system`, each with a small `packages/angular` counterpart. `devWarn` gains an installable sink whose default is byte-identical to today; `FlowStore`'s constructor fills it with the Angular-native `ngDevWarn`. Separately, `NodeDimensionChange` gains an optional `initial` flag that `updateNodeInternals` sets on a node's first measurement.

**Tech Stack:** TypeScript, vitest (jsdom in both packages), Angular 21 (zoneless), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-08-14-system-diagnostics-and-initial-dimensions-design.md`

## Global Constraints

- **`packages/system` changes are permitted here**, unlike most work in this repo — but every intentional deviation from xyflow gets the established marker comment: `DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this` (see `packages/system/src/xypanzoom/XYPanZoom.ts:112`).
- **Default behavior in `packages/system` must stay byte-identical** for the react/svelte reference ports. The sink default and the absent `initial` flag both preserve today's behavior exactly.
- **`packages/angular` is zoneless-first: never inject `NgZone`.**
- **Rebuild `@angflow/system` before any `packages/angular` task that consumes a new system export or type** — angular resolves `@angflow/system` through its `dist/`, not its source. Tasks 1 and 3 each end with a system build for exactly this reason.
- **Do NOT bump any version in this plan.** The publish scripts run `npm version <bump>` themselves; bumping here would double-bump. (A manual bump plus a script bump is what produced the phantom `0.3.21` on 2026-08-13.)
- Test commands: `pnpm -F @angflow/system test` and `pnpm -F @angflow/angular test` (both `vitest run`). For a targeted run use `npx vitest run <path>` from the package directory — `pnpm -F <pkg> test -- <pattern>` does NOT filter, it runs the whole suite.
- Warning prefix from the Angular channel is exactly `[angflow]: `.

---

### Task 1: `setDevWarnSink` in `@angflow/system`

**Files:**
- Modify: `packages/system/src/utils/general.ts` (the `devWarn` declaration)
- Create: `packages/system/src/utils/general.spec.ts`

**Interfaces:**
- Consumes: `OnError` from `../types` — `(id: string, message: string) => void`. `utils/general.ts` already imports types from `'../types'`; add `OnError` to that existing import list.
- Produces: `setDevWarnSink(fn: OnError | null): void` and an unchanged `devWarn: OnError`, both exported from `packages/system/src/utils/general.ts` and reachable as `@angflow/system` package exports. Task 2 consumes `setDevWarnSink`.

- [ ] **Step 1: Write the failing test**

Create `packages/system/src/utils/general.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { devWarn, setDevWarnSink } from './general';
import { addEdge, reconnectEdge } from './edges/general';

describe('setDevWarnSink', () => {
  // The sink is module state and outlives a single test.
  afterEach(() => setDevWarnSink(null));

  it('routes devWarn through an installed sink', () => {
    const sink = vi.fn();
    setDevWarnSink(sink);

    devWarn('006', 'Boom.');

    expect(sink).toHaveBeenCalledWith('006', 'Boom.');
  });

  it('restores the default sink when passed null', () => {
    const sink = vi.fn();
    setDevWarnSink(sink);
    setDevWarnSink(null);

    devWarn('006', 'Boom.');

    expect(sink).not.toHaveBeenCalled();
  });

  it('routes addEdge error006 through the sink', () => {
    const sink = vi.fn();
    setDevWarnSink(sink);

    // A connection with no source is the error006 case.
    const result = addEdge({ source: '', target: 'b' } as never, []);

    expect(result).toEqual([]);
    expect(sink).toHaveBeenCalledWith('006', expect.stringContaining('source and a target'));
  });

  it('routes reconnectEdge error007 through the sink', () => {
    const sink = vi.fn();
    setDevWarnSink(sink);
    const edges = [{ id: 'e1', source: 'a', target: 'b' }];

    const result = reconnectEdge(
      { id: 'missing', source: 'a', target: 'b' },
      { source: 'a', target: 'b', sourceHandle: null, targetHandle: null },
      edges,
    );

    expect(result).toEqual(edges);
    expect(sink).toHaveBeenCalledWith('007', expect.stringContaining('missing'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/system && npx vitest run src/utils/general.spec.ts`
Expected: FAIL — `"setDevWarnSink" is not exported by "src/utils/general.ts"`.

- [ ] **Step 3: Write minimal implementation**

In `packages/system/src/utils/general.ts`, add `OnError` to the existing `from '../types'` type import, then replace the current `devWarn` declaration:

```ts
export const devWarn = (id: string, message: string) => {
  if (isDevEnv()) {
    console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
  }
};
```

with:

```ts
const defaultDevWarn: OnError = (id, message) => {
  if (isDevEnv()) {
    console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
  }
};

let devWarnSink: OnError = defaultDevWarn;

/**
 * DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this.
 *
 * Installs the dev-warning channel used by every `devWarn` call in this
 * package. The default is `isDevEnv()`-gated, and `isDevEnv()` tests
 * `process.env.NODE_ENV`, which Angular's esbuild-based builder never defines
 * for browser bundles — so under `@angflow/angular` the default sink is
 * permanently silent and warnings like error006/error007 from `addEdge` and
 * `reconnectEdge` never reach anyone. `@angflow/angular` installs its own
 * `isDevMode()`-gated sink here.
 *
 * Pass `null` to restore the default (tests must do this — the sink is module
 * state and outlives a single test).
 */
export const setDevWarnSink = (fn: OnError | null): void => {
  devWarnSink = fn ?? defaultDevWarn;
};

export const devWarn: OnError = (id, message) => devWarnSink(id, message);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/system && npx vitest run src/utils/general.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full system suite and type-check**

Run: `pnpm -F @angflow/system test` then `cd packages/system && npx tsc --noEmit`
Expected: all green. Every existing `devWarn` call site is untouched and behaves identically.

- [ ] **Step 6: Rebuild the system dist**

Run: `pnpm -F @angflow/system build`
Expected: clean build. **Required** — Task 2 imports `setDevWarnSink` from `@angflow/system`, which resolves through `dist/`, not source. Skipping this makes Task 2 fail with a missing export that looks like a code error.

- [ ] **Step 7: Commit**

```bash
git add packages/system/src/utils/general.ts packages/system/src/utils/general.spec.ts
git commit -m "feat(system): make the dev-warning channel installable"
```

---

### Task 2: `FlowStore` installs the Angular sink

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (add a constructor to the `FlowStore` class; add `setDevWarnSink` to the existing `@angflow/system` import)
- Create: `packages/angular/src/lib/services/flow-store.dev-warn-sink.spec.ts`

**Interfaces:**
- Consumes: `setDevWarnSink(fn: OnError | null): void` from `@angflow/system` (Task 1); `ngDevWarn` and `resetDevWarnDedupe()` from `packages/angular/src/lib/utils/dev-warn.ts` (already exist — `ngDevWarn` is already imported by this file as the `onError` default).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/services/flow-store.dev-warn-sink.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { devWarn, setDevWarnSink, addEdge } from '@angflow/system';
import { FlowStore } from './flow-store.service';
import { resetDevWarnDedupe } from '../utils/dev-warn';

describe('FlowStore installs the @angflow/system dev-warn sink', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Both the sink and ngDevWarn's dedupe cache are module state that
    // outlives a TestBed.
    setDevWarnSink(null);
    resetDevWarnDedupe();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
  });

  afterEach(() => {
    warn.mockRestore();
    setDevWarnSink(null);
  });

  it('leaves system devWarn silent before any FlowStore is constructed', () => {
    // Guards the test below against passing for the wrong reason: the default
    // sink is genuinely silent here, so a later warning proves the install.
    devWarn('006', 'Before any store.');
    expect(warn).not.toHaveBeenCalled();
  });

  it('routes system devWarn through ngDevWarn once a FlowStore exists', () => {
    TestBed.inject(FlowStore);

    devWarn('006', 'After the store.');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[angflow]:');
    expect(warn.mock.calls[0][0]).toContain('After the store.');
  });

  it('makes addEdge report a missing source', () => {
    TestBed.inject(FlowStore);

    const result = addEdge({ source: '', target: 'b' } as never, []);

    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[angflow]:');
    expect(warn.mock.calls[0][0]).toContain('source and a target');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/services/flow-store.dev-warn-sink.spec.ts`
Expected: FAIL on the second and third tests — `console.warn` not called, because nothing installs the sink yet. The first test passes already (that is its job).

> If instead this fails with `"setDevWarnSink" is not exported by @angflow/system`, Task 1's Step 6 (`pnpm -F @angflow/system build`) was skipped. Run it.

- [ ] **Step 3: Write minimal implementation**

In `packages/angular/src/lib/services/flow-store.service.ts`, add `setDevWarnSink` to the existing multi-line `@angflow/system` import, then add a constructor to the `FlowStore` class (it currently has none — put it immediately after the class's field declarations, before the first method):

```ts
  constructor() {
    // @angflow/system's own diagnostics (error006/error007 from addEdge and
    // reconnectEdge) go through its `devWarn`, whose default gate is
    // `process.env.NODE_ENV` — never defined by Angular's esbuild builder, so
    // those warnings were unreachable for every Angular consumer. Redirect
    // them into the same Angular-native channel this store's `onError` uses.
    //
    // Installed here rather than as a module-level side effect on purpose:
    // this package declares `"sideEffects": ["*.css"]`, so a bundler is
    // permitted to drop a top-level call it cannot prove is needed — and a
    // diagnostic channel that silently vanishes under production bundling is
    // the exact failure this change exists to remove.
    //
    // Idempotent: every FlowStore installs the same function.
    setDevWarnSink(ngDevWarn);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/services/flow-store.dev-warn-sink.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full angular suite, type-check and lint**

Run: `pnpm -F @angflow/angular test`, then `cd packages/angular && npx tsc --noEmit`, then `npx eslint src`
Expected: all green. Newly-audible warnings may appear in test output — that is the fix working. If an existing test fails because it now sees a warning, update that test to expect it rather than suppressing the channel.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.dev-warn-sink.spec.ts
git commit -m "fix(angular): route system dev warnings into the Angular channel"
```

---

### Task 3: `initial` flag on dimension changes

**Files:**
- Modify: `packages/system/src/types/changes.ts:3-11` (the `NodeDimensionChange` type)
- Modify: `packages/system/src/utils/store.ts` (the `changes.push({ type: 'dimensions' })` call inside `updateNodeInternals`)
- Create: `packages/system/src/utils/store.initial-dimensions.spec.ts`

**Interfaces:**
- Consumes: `adoptUserNodes`, `updateNodeInternals` from `./store`; `InternalNodeUpdate`, `NodeBase`, `InternalNodeBase`, `NodeLookup`, `ParentLookup` from `../types`.
- Produces: `NodeDimensionChange.initial?: boolean`. Task 4 asserts it reaches Angular consumers.

- [ ] **Step 1: Write the failing test**

Create `packages/system/src/utils/store.initial-dimensions.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adoptUserNodes, updateNodeInternals } from './store';
import type {
  NodeBase,
  InternalNodeBase,
  NodeLookup,
  ParentLookup,
  InternalNodeUpdate,
} from '../types';

function lookups() {
  return {
    nodeLookup: new Map() as NodeLookup<InternalNodeBase<NodeBase>>,
    parentLookup: new Map() as ParentLookup<InternalNodeBase<NodeBase>>,
  };
}

const node = (id: string, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});

/** updateNodeInternals bails unless the container holds `.xyflow__viewport`. */
function makeDom(): HTMLElement {
  const domNode = document.createElement('div');
  const viewport = document.createElement('div');
  viewport.classList.add('xyflow__viewport');
  domNode.appendChild(viewport);
  document.body.appendChild(domNode);
  return domNode;
}

/**
 * jsdom performs no layout, so offsetWidth/offsetHeight are 0 — and
 * updateNodeInternals skips any node whose measured size is falsy. Stub real
 * numbers or the test silently exercises nothing.
 */
function makeNodeEl(width: number, height: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      x: 0, y: 0, width, height,
      top: 0, left: 0, right: width, bottom: height,
      toJSON: () => ({}),
    }) as DOMRect;
  return el as HTMLDivElement;
}

const update = (id: string, el: HTMLDivElement) =>
  new Map<string, InternalNodeUpdate>([[id, { id, nodeElement: el }]]);

describe('updateNodeInternals initial flag', () => {
  beforeEach(() => {
    // jsdom implements neither layout nor DOMMatrixReadOnly; updateNodeInternals
    // reads the viewport transform's m22 as the zoom factor. 1 = unzoomed.
    vi.stubGlobal(
      'DOMMatrixReadOnly',
      class {
        m22 = 1;
        constructor(_transform?: string) {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('flags a node`s first measurement as initial', () => {
    const { nodeLookup, parentLookup } = lookups();
    // Declared width/height do NOT seed `measured`, so this is unmeasured.
    adoptUserNodes([node('a', { width: 200, height: 200 })], nodeLookup, parentLookup);

    const { changes } = updateNodeInternals(
      update('a', makeNodeEl(200, 200)),
      nodeLookup,
      parentLookup,
      makeDom(),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 'a', type: 'dimensions', initial: true });
  });

  it('does not flag a later genuine size change', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('a', { width: 200, height: 200 })], nodeLookup, parentLookup);
    const domNode = makeDom();

    updateNodeInternals(update('a', makeNodeEl(200, 200)), nodeLookup, parentLookup, domNode);
    const { changes } = updateNodeInternals(
      update('a', makeNodeEl(300, 200)),
      nodeLookup,
      parentLookup,
      domNode,
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 'a', type: 'dimensions' });
    expect(changes[0]).not.toMatchObject({ initial: true });
  });

  it('flags the first measurement even when the node declared no size', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('b')], nodeLookup, parentLookup);

    const { changes } = updateNodeInternals(
      update('b', makeNodeEl(120, 40)),
      nodeLookup,
      parentLookup,
      makeDom(),
    );

    expect(changes[0]).toMatchObject({ initial: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/system && npx vitest run src/utils/store.initial-dimensions.spec.ts`
Expected: FAIL on the first test — the change is emitted without `initial`, so `toMatchObject({ initial: true })` does not match.

- [ ] **Step 3: Add the type field**

In `packages/system/src/types/changes.ts`, extend `NodeDimensionChange` (currently ending with `setAttributes?: boolean | 'width' | 'height';`) with:

```ts
  /**
   * DELIBERATE DIVERGENCE FROM xyflow UPSTREAM — do not "restore" this.
   *
   * True on the first dimensions change after a node mounts: the measurement
   * that populates `measured` for the first time, rather than a real size
   * change. Consumers mirroring changes into external state (Yjs, an undo
   * stack, a server) can skip or coalesce it — it represents no user-visible
   * resize, and writing it back has been observed to fragment undo history.
   *
   * The change still fires. It is the only thing that populates `measured`, so
   * suppressing it would leave that field permanently unset.
   */
  initial?: boolean;
```

- [ ] **Step 4: Set the flag**

In `packages/system/src/utils/store.ts`, inside `updateNodeInternals`, the change is currently pushed as:

```ts
      if (dimensionChanged) {
        changes.push({
          id: node.id,
          type: 'dimensions',
          dimensions,
        });
```

Add the flag:

```ts
      if (dimensionChanged) {
        changes.push({
          id: node.id,
          type: 'dimensions',
          dimensions,
          // `node` still holds the PRE-update measurement here (the replacement
          // is built as `newNode`), so an absent width/height means this is the
          // node's first measurement. Safe to dereference without `?.`:
          // InternalNodeBase.measured is a required object, and the
          // `dimensionChanged` line just above already reads it unguarded.
          // Adding `?.` would yield `undefined` instead of `true` and silently
          // drop the flag.
          initial: node.measured.width === undefined || node.measured.height === undefined,
        });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/system && npx vitest run src/utils/store.initial-dimensions.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full system suite and type-check**

Run: `pnpm -F @angflow/system test` then `cd packages/system && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Rebuild the system dist**

Run: `pnpm -F @angflow/system build`
Expected: clean build. **Required** — Task 4 needs the updated `NodeDimensionChange` type declaration, which angular reads from `dist/`.

- [ ] **Step 8: Commit**

```bash
git add packages/system/src/types/changes.ts packages/system/src/utils/store.ts packages/system/src/utils/store.initial-dimensions.spec.ts
git commit -m "feat(system): mark a node's first dimensions change as initial"
```

---

### Task 4: `initial` reaches Angular consumers

**Files:**
- Create: `packages/angular/src/lib/services/flow-store.initial-dimensions.spec.ts`

No production code changes. Angular re-exports the type from `@angflow/system` and passes changes through untouched; this task proves that end to end and pins it against a regression.

**Interfaces:**
- Consumes: `FlowStore.updateNodeInternals(updates: Map<string, InternalNodeUpdate>)`, `FlowStore.domNode` (a `WritableSignal<HTMLDivElement | null>`), `FlowStore.setNodes`, and `FlowStore.nodesChangeMiddleware` — a public `Map<string, (changes) => changes>` consulted at the top of `triggerNodeChanges`, which is the cleanest seam for observing emitted changes without rendering a component.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/services/flow-store.initial-dimensions.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import type { InternalNodeUpdate } from '@angflow/system';
import { FlowStore } from './flow-store.service';
import type { Node, NodeChange } from '../types';

function makeDom(): HTMLDivElement {
  const domNode = document.createElement('div');
  const viewport = document.createElement('div');
  viewport.classList.add('xyflow__viewport');
  domNode.appendChild(viewport);
  document.body.appendChild(domNode);
  return domNode as HTMLDivElement;
}

function makeNodeEl(width: number, height: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      x: 0, y: 0, width, height,
      top: 0, left: 0, right: width, bottom: height,
      toJSON: () => ({}),
    }) as DOMRect;
  return el as HTMLDivElement;
}

const node = (id: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  type: 'default',
  width: 200,
  height: 200,
});

describe('initial dimensions flag reaches Angular consumers', () => {
  let store: FlowStore;
  let captured: NodeChange[];

  beforeEach(() => {
    vi.stubGlobal(
      'DOMMatrixReadOnly',
      class {
        m22 = 1;
        constructor(_transform?: string) {}
      },
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);

    captured = [];
    // Middleware runs at the top of triggerNodeChanges — the same batch a
    // consumer receives on (nodesChange).
    store.nodesChangeMiddleware.set('capture', (changes) => {
      captured.push(...changes);
      return changes;
    });

    store.domNode.set(makeDom());
    store.setNodes([node('a')]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('marks the first measurement initial and a later resize not', () => {
    const measure = (w: number, h: number) =>
      store.updateNodeInternals(
        new Map<string, InternalNodeUpdate>([['a', { id: 'a', nodeElement: makeNodeEl(w, h) }]]),
      );

    measure(200, 200);
    const first = captured.filter((c) => c.type === 'dimensions');
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ initial: true });

    captured = [];
    store.nodesChangeMiddleware.set('capture', (changes) => {
      captured.push(...changes);
      return changes;
    });

    measure(300, 200);
    const second = captured.filter((c) => c.type === 'dimensions');
    expect(second).toHaveLength(1);
    expect(second[0]).not.toMatchObject({ initial: true });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd packages/angular && npx vitest run src/lib/services/flow-store.initial-dimensions.spec.ts`
Expected: PASS, 1 test — Task 3 already made this true; this task pins it.

> If it fails with the flag absent, Task 3's Step 7 (`pnpm -F @angflow/system build`) was skipped — angular is running against a stale system `dist/`.
>
> If it fails because `captured` is empty, check that `setNodes` measured nothing itself and that `store.domNode` is set before `updateNodeInternals` — the system function returns early with no changes when it cannot find `.xyflow__viewport`.

- [ ] **Step 3: Run the full angular suite, type-check and lint**

Run: `pnpm -F @angflow/angular test`, then `cd packages/angular && npx tsc --noEmit`, then `npx eslint src`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add packages/angular/src/lib/services/flow-store.initial-dimensions.spec.ts
git commit -m "test(angular): pin the initial dimensions flag through the store"
```

---

### Task 5: Full verification

**Files:** none — this task only runs gates.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: a verified tree ready to publish.

- [ ] **Step 1: Run every gate**

```bash
pnpm -F @angflow/system build
pnpm -F @angflow/angular build
pnpm typecheck
pnpm lint
pnpm -F @angflow/system test
pnpm -F @angflow/angular test
pnpm -F @angflow/mcp test
```

Expected: all green. `@angflow/system` must build before `@angflow/angular`.

- [ ] **Step 2: Confirm no agent-surface drift**

Run: `git diff --stat origin/main -- packages/angular/src/lib/agent/`
Expected: no output. If anything changed there, `AGENT_BRIDGE.md` and the `@angflow/mcp` schema snapshot both need updating — neither is expected from this plan.

- [ ] **Step 3: Build the example suite**

Run: `pnpm -F angular-examples build`
Expected: clean build (pre-existing bundle-budget and CommonJS warnings are fine).

- [ ] **Step 4: Confirm the working tree is clean**

Run: `git status --short`
Expected: empty. **Do not bump any version and do not publish.** `publish-system.bat` and `publish-angular.bat` run `npm version` themselves; bumping here would double-bump, which is exactly what produced the phantom `0.3.21` on 2026-08-13. Publishing is the user's call, in this order: system first, then angular.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| §1 `setDevWarnSink` with byte-identical default, divergence marker | Task 1 |
| §1 Angular installs from `FlowStore`'s constructor, not a module side effect | Task 2 |
| §1 accepted consequence: silent before any `FlowStore` exists | Task 2 Step 1, first test (pins it deliberately) |
| §2 `NodeDimensionChange.initial` field + doc comment | Task 3 Step 3 |
| §2 predicate reads pre-update `measured`, no optional chaining | Task 3 Step 4 |
| §2 additive/compatible — consumers unchanged | Task 4 (no production code) |
| Testing: system sink redirect + null restore + 006 + 007 | Task 1 Step 1 (4 tests) |
| Testing: system `initial` set on first, absent on resize | Task 3 Step 1 (3 tests) |
| Testing: Angular installs sink, `addEdge` warns | Task 2 Step 1 (3 tests) |
| Testing: `initial` survives to a consumer | Task 4 Step 1 |
| Testing: restore sink + reset dedupe in tests | Task 1 `afterEach`, Task 2 `beforeEach`/`afterEach` |
| Release: no version bump in this plan | Task 5 Step 4 |

No gaps. The spec's release section is intentionally *not* executed here — Task 5 stops at a verified tree.

**Placeholder scan:** no TBD/TODO. Every code step carries real code. The three troubleshooting notes (Task 2 Step 2, Task 4 Step 2) are diagnostics for a predicted failure with a stated cause, not deferred decisions.

**Type consistency:** `setDevWarnSink(fn: OnError | null): void` is defined in Task 1 and used with that exact signature in Task 2 and in both tasks' `afterEach`. `initial?: boolean` is defined in Task 3 and asserted under that exact name in Tasks 3 and 4. `InternalNodeUpdate` is used identically in Tasks 3 and 4. `resetDevWarnDedupe()` matches the existing export in `utils/dev-warn.ts`.
