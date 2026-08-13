# mural-copy Feedback Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the Angular package's dev-diagnostics channel, warn on unknown node/edge types through it, make `paneMouseLeave` gesture-aware, and let the minimap draw DOM-hidden nodes.

**Architecture:** Four independent changes to `@angflow/angular` only. A new Angular-native `ngDevWarn` replaces `@angflow/system`'s `devWarn` as the `FlowStore.onError` default (system's version is gated on `process.env.NODE_ENV`, which Angular's esbuild builder never defines, so it has never fired). Two renderers report unknown types through that channel with per-type dedupe and a `queueMicrotask` to escape the change-detection pass. A new `gestureActive` store computed lets `<ng-flow>` latch `paneMouseLeave` until a gesture ends. The minimap gains one input.

**Tech Stack:** Angular 21 (zoneless), TypeScript, vitest + `@angular/core/testing` TestBed, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-08-13-mural-copy-feedback-remediation-design.md`

## Global Constraints

- **Never inject `NgZone`.** Drive view updates via signal writes only (`CLAUDE.md` zoneless rules).
- **Timers are permitted to delay work, forbidden to force change detection.** The `queueMicrotask` in Tasks 2 and 3 defers an output emission out of a template binding; that is delaying work.
- **Do not modify `packages/system`.** It is framework-agnostic and shared with the react/svelte reference ports; `CLAUDE.md` states it should rarely change. Every change in this plan lands in `packages/angular`.
- **Angular peer floor is `>=19`.** `DOCUMENT` must be imported from `@angular/common`, never `@angular/core`.
- Test command: `pnpm -F @angflow/angular test` (vitest). Type-check: `npx tsc --noEmit` in `packages/angular`.
- Error codes and message text come from `errorMessages` in `@angflow/system` — do not hand-write message strings.
- Warning prefix is exactly `[angflow]: `. The `Help: https://reactflow.dev/error#<id>` suffix is retained deliberately; angflow inherits those numbered codes.

---

### Task 1: `ngDevWarn` helper and `FlowStore.onError` default

**Files:**
- Create: `packages/angular/src/lib/utils/dev-warn.ts`
- Create: `packages/angular/src/lib/utils/dev-warn.spec.ts`
- Modify: `packages/angular/src/lib/services/flow-store.service.ts:17` (drop `devWarn` from the `@angflow/system` import), `:216` (swap the default)

**Interfaces:**
- Consumes: `OnError` from `@angflow/system` — `(id: string, message: string) => void`.
- Produces: `ngDevWarn: OnError` and `resetDevWarnDedupe(): void`, both from `packages/angular/src/lib/utils/dev-warn.ts`. Tasks 2 and 3 do not import these directly — they route through `store.onError()`. Their specs import `resetDevWarnDedupe` for `beforeEach` cleanup.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/utils/dev-warn.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ngDevWarn, resetDevWarnDedupe } from './dev-warn';

describe('ngDevWarn', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDevWarnDedupe();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('warns with the angflow prefix and the help link', () => {
    ngDevWarn('011', 'Edge type "bogus" not found. Using fallback type "default".');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      '[angflow]: Edge type "bogus" not found. Using fallback type "default". Help: https://reactflow.dev/error#011'
    );
  });

  it('warns only once for a repeated id+message pair', () => {
    ngDevWarn('011', 'same message');
    ngDevWarn('011', 'same message');
    ngDevWarn('011', 'same message');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not collapse distinct messages sharing one code', () => {
    // The whole reason the dedupe key is `id::message` and not `id`: two
    // different bad node types are both error003, and the second must warn.
    ngDevWarn('003', 'Node type "typoA" not found. Using fallback type "default".');
    ngDevWarn('003', 'Node type "typoB" not found. Using fallback type "default".');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('resetDevWarnDedupe clears the cache', () => {
    ngDevWarn('011', 'same message');
    resetDevWarnDedupe();
    ngDevWarn('011', 'same message');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('ngDevWarn outside dev mode', () => {
  afterEach(() => {
    vi.doUnmock('@angular/core');
    vi.resetModules();
  });

  it('stays silent when isDevMode() is false', async () => {
    vi.resetModules();
    vi.doMock('@angular/core', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@angular/core')>()),
      isDevMode: () => false,
    }));
    const mod = await import('./dev-warn');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mod.ngDevWarn('011', 'should not appear');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @angflow/angular test -- dev-warn`
Expected: FAIL — `Failed to resolve import "./dev-warn"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/angular/src/lib/utils/dev-warn.ts`:

```ts
import { isDevMode } from '@angular/core';
import type { OnError } from '@angflow/system';

/**
 * Warn-once diagnostic sink, and the default value of `FlowStore.onError`.
 *
 * Replaces `@angflow/system`'s `devWarn`, which gates on
 * `process.env.NODE_ENV === 'development'`. Angular's `@angular/build:application`
 * (esbuild) never defines `process.env.NODE_ENV` for browser bundles and nothing
 * polyfills it, so `globalThis.process` is undefined at runtime and that check is
 * permanently false — system's `devWarn` has never logged for an Angular consumer
 * in either dev or prod. `isDevMode()` is the Angular-native equivalent that
 * actually works.
 *
 * The dedupe key is `id::message`, NOT `id`: two different unknown node types are
 * both `error003`, and keying on the code alone would silence every typo after the
 * first. Callers on a per-render path must still dedupe locally — this cache only
 * guarantees the console is not spammed, not that the work is skipped.
 */
const seen = new Set<string>();

export const ngDevWarn: OnError = (id: string, message: string): void => {
  const key = `${id}::${message}`;
  if (!isDevMode() || seen.has(key)) return;
  seen.add(key);
  console.warn(`[angflow]: ${message} Help: https://reactflow.dev/error#${id}`);
};

/**
 * Test-only. The dedupe cache is module-scoped so it survives a page's lifetime,
 * which also means it outlives a TestBed — call this in `beforeEach` or the
 * second test asserting the same warning will see nothing.
 */
export const resetDevWarnDedupe = (): void => {
  seen.clear();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @angflow/angular test -- dev-warn`
Expected: PASS, 5 tests.

- [ ] **Step 5: Swap the FlowStore default**

In `packages/angular/src/lib/services/flow-store.service.ts`, remove `devWarn,` from the `@angflow/system` import list at line 17, and add near the other local imports:

```ts
import { ngDevWarn } from '../utils/dev-warn';
```

Then change line 216 from:

```ts
  readonly onError = signal<OnError>(devWarn);
```

to:

```ts
  readonly onError = signal<OnError>(ngDevWarn);
```

- [ ] **Step 6: Verify nothing else imported system's devWarn**

Run: `grep -rn "devWarn" packages/angular/src --include="*.ts" | grep -v "ngDevWarn\|dev-warn"`
Expected: no output. If any line remains, it is a leftover import — remove it.

- [ ] **Step 7: Run the full angular suite and type-check**

Run: `pnpm -F @angflow/angular test` then `cd packages/angular && npx tsc --noEmit`
Expected: all green. `console.warn` output may now appear in tests that trigger store errors — that is the fix working. If a test asserts on silence, update it to expect the warning.

- [ ] **Step 8: Commit**

```bash
git add packages/angular/src/lib/utils/dev-warn.ts packages/angular/src/lib/utils/dev-warn.spec.ts packages/angular/src/lib/services/flow-store.service.ts
git commit -m "fix(angular): revive the dev-warning channel in Angular builds"
```

---

### Task 2: Warn on unknown node type

**Files:**
- Modify: `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts:406-415`
- Create: `packages/angular/src/lib/container/node-renderer/node-renderer.unknown-type.spec.ts`

**Interfaces:**
- Consumes: `store.onError()` (a `signal<OnError>`, defaulted by Task 1); `errorMessages` from `@angflow/system`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/container/node-renderer/node-renderer.unknown-type.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NodeRendererComponent } from './node-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { DefaultNodeComponent } from '../../components/nodes/default-node.component';
import { resetDevWarnDedupe } from '../../utils/dev-warn';

/** Lets the queueMicrotask in getNodeComponent run before assertions. */
const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('NodeRendererComponent unknown node type', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    resetDevWarnDedupe();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeRendererComponent);
    component = fixture.componentInstance;
  });

  it('reports error003 once for an unknown type, however many times it renders', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
    expect(component.getNodeComponent('nope')).toBe(DefaultNodeComponent);
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      '003',
      'Node type "nope" not found. Using fallback type "default".'
    );
  });

  it('reports each distinct unknown type separately', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getNodeComponent('typoA');
    component.getNodeComponent('typoB');
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('does not report for built-in or absent types', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getNodeComponent('default');
    component.getNodeComponent('input');
    component.getNodeComponent(undefined);
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it('does not report for an agent-registered template type', async () => {
    const onError = vi.fn();
    store.onError.set(onError);
    store.nodeTemplates.set(new Map([['agentCard', { template: '<div></div>' } as never]]));

    component.getNodeComponent('agentCard');
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it('does not emit during the synchronous call', () => {
    // The emission must be deferred: getNodeComponent runs inside an
    // *ngComponentOutlet binding, and onError emits the public (error) output.
    const onError = vi.fn();
    store.onError.set(onError);

    component.getNodeComponent('nope');

    expect(onError).not.toHaveBeenCalled();
  });
});
```

> If `store.nodeTemplates` is not a writable signal of `Map<string, ...>`, read its
> declaration in `flow-store.service.ts` and set it however that signal is written
> elsewhere in the file. The assertion — a registered template type must not warn —
> does not change.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @angflow/angular test -- node-renderer.unknown-type`
Expected: FAIL — `expected "spy" to be called 1 times, but got 0 times`.

- [ ] **Step 3: Write minimal implementation**

In `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts`, add `errorMessages` to the existing `@angflow/system` import, then replace `getNodeComponent` (lines 406-415) with:

```ts
  /**
   * Types already reported through `onError`. Local to the renderer because
   * `getNodeComponent` runs on every change-detection pass — without this, a
   * single bad type would emit the public (error) output on every frame.
   */
  private warnedNodeTypes = new Set<string>();

  getNodeComponent(type?: string): Type<unknown> {
    const resolvedType = type || 'default';
    const hostOrBuiltIn = this.customNodeTypes()[resolvedType] ?? builtInNodeTypes[resolvedType];
    if (hostOrBuiltIn) return hostOrBuiltIn;
    // Agent-registered data-driven templates: reading the registry signal here
    // makes the template binding reactive — registering/unregistering a
    // template re-renders affected nodes with no host involvement.
    if (this.store.nodeTemplates().has(resolvedType)) return TemplateNodeComponent;

    if (!this.warnedNodeTypes.has(resolvedType)) {
      this.warnedNodeTypes.add(resolvedType);
      // Deferred: this method runs inside an *ngComponentOutlet binding, and
      // onError emits the public (error) output. Emitting mid-template would
      // risk ExpressionChangedAfterItHasBeenChecked in consumers reacting to it.
      queueMicrotask(() => this.store.onError()?.('003', errorMessages.error003(resolvedType)));
    }
    return DefaultNodeComponent;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @angflow/angular test -- node-renderer.unknown-type`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite and type-check**

Run: `pnpm -F @angflow/angular test` then `cd packages/angular && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/container/node-renderer/
git commit -m "feat(angular): warn on unknown node type before falling back"
```

---

### Task 3: Warn on unknown edge type

**Files:**
- Modify: `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts:406-409`
- Create: `packages/angular/src/lib/container/edge-renderer/edge-renderer.unknown-type.spec.ts`

**Interfaces:**
- Consumes: `store.onError()`; `errorMessages` from `@angflow/system`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/container/edge-renderer/edge-renderer.unknown-type.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { BezierEdgeComponent } from '../../components/edges/bezier-edge.component';
import { resetDevWarnDedupe } from '../../utils/dev-warn';

const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('EdgeRendererComponent unknown edge type', () => {
  let store: FlowStore;
  let component: EdgeRendererComponent;

  beforeEach(() => {
    resetDevWarnDedupe();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(EdgeRendererComponent);
    component = fixture.componentInstance;
  });

  it('reports error011 once for an unknown type, however many times it renders', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    // 'arrow' is the real mural-copy case: an arrowhead style was passed as an
    // edge type, so every connector silently rendered as a bezier for months.
    expect(component.getEdgeComponent('arrow')).toBe(BezierEdgeComponent);
    expect(component.getEdgeComponent('arrow')).toBe(BezierEdgeComponent);
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      '011',
      'Edge type "arrow" not found. Using fallback type "default".'
    );
  });

  it('reports each distinct unknown type separately', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getEdgeComponent('arrow');
    component.getEdgeComponent('line');
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('does not report for built-in or absent types', async () => {
    const onError = vi.fn();
    store.onError.set(onError);

    for (const t of ['default', 'bezier', 'straight', 'step', 'smoothstep', 'simplebezier']) {
      component.getEdgeComponent(t);
    }
    component.getEdgeComponent(undefined);
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it('does not emit during the synchronous call', () => {
    const onError = vi.fn();
    store.onError.set(onError);

    component.getEdgeComponent('arrow');

    expect(onError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @angflow/angular test -- edge-renderer.unknown-type`
Expected: FAIL — `expected "spy" to be called 1 times, but got 0 times`.

- [ ] **Step 3: Write minimal implementation**

In `packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts`, add `errorMessages` to the existing `@angflow/system` import, then replace `getEdgeComponent` (lines 406-409) with:

```ts
  /**
   * Types already reported through `onError`. Local to the renderer because
   * `getEdgeComponent` runs on every change-detection pass — and is called twice
   * per edge per pass (once for the outlet, once from getEdgeComponentInputs).
   */
  private warnedEdgeTypes = new Set<string>();

  getEdgeComponent(type?: string): Type<unknown> {
    const resolvedType = type || 'default';
    const resolved = this.customEdgeTypes()[resolvedType] ?? builtInEdgeTypes[resolvedType];
    if (resolved) return resolved;

    if (!this.warnedEdgeTypes.has(resolvedType)) {
      this.warnedEdgeTypes.add(resolvedType);
      // Deferred: see the node renderer's equivalent. This runs inside a
      // template binding and onError emits the public (error) output.
      queueMicrotask(() => this.store.onError()?.('011', errorMessages.error011(resolvedType)));
    }
    return BezierEdgeComponent;
  }
```

> Note the restructure: the original was a single `??` chain ending in
> `BezierEdgeComponent`, which cannot distinguish "resolved to bezier because the
> type *is* bezier" from "fell back to bezier". Splitting the lookup from the
> fallback is what makes the warning possible.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @angflow/angular test -- edge-renderer.unknown-type`
Expected: PASS, 4 tests.

- [ ] **Step 5: Confirm the store is reachable from this component**

Run: `grep -n "store" packages/angular/src/lib/container/edge-renderer/edge-renderer.component.ts | head -3`
Expected: an `inject(FlowStore)` field. If the field is named something other than `store`, use that name in Step 3 instead.

- [ ] **Step 6: Run the full suite and type-check**

Run: `pnpm -F @angflow/angular test` then `cd packages/angular && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/container/edge-renderer/
git commit -m "feat(angular): warn on unknown edge type before falling back"
```

---

### Task 4: Gesture state on the store

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (add two signals near `:139-141`, one computed, and a write in `updateNodePositions` at `:476`)
- Modify: `packages/angular/src/lib/components/node-resizer/node-resizer.component.ts` (`applyResizerConfig`, around `:317-346`)
- Create: `packages/angular/src/lib/services/flow-store.gesture.spec.ts`

**Interfaces:**
- Consumes: existing `paneDragging`, `userSelectionActive`, `connection` signals on `FlowStore`.
- Produces: `FlowStore.nodeDragging: WritableSignal<boolean>`, `FlowStore.nodeResizing: WritableSignal<boolean>`, `FlowStore.gestureActive: Signal<boolean>`. Task 5 consumes `gestureActive`.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/services/flow-store.gesture.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';

describe('FlowStore.gestureActive', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  it('is false with no gesture in progress', () => {
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while the pane is being dragged', () => {
    store.paneDragging.set(true);
    expect(store.gestureActive()).toBe(true);
    store.paneDragging.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a box selection is active', () => {
    store.userSelectionActive.set(true);
    expect(store.gestureActive()).toBe(true);
    store.userSelectionActive.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a node is being dragged', () => {
    store.nodeDragging.set(true);
    expect(store.gestureActive()).toBe(true);
    store.nodeDragging.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a node is being resized', () => {
    store.nodeResizing.set(true);
    expect(store.gestureActive()).toBe(true);
    store.nodeResizing.set(false);
    expect(store.gestureActive()).toBe(false);
  });

  it('is true while a connection is in progress', () => {
    // ConnectionState is a discriminated union: NoConnection has
    // `inProgress: false`, ConnectionInProgress has `inProgress: true` plus
    // several required fields. Spreading the initial value does NOT produce a
    // valid ConnectionInProgress, so cast the whole literal.
    store.connection.set({ inProgress: true } as unknown as ReturnType<typeof store.connection>);
    expect(store.gestureActive()).toBe(true);
  });

  it('stays true while any one source is still active', () => {
    store.paneDragging.set(true);
    store.nodeDragging.set(true);
    store.paneDragging.set(false);
    expect(store.gestureActive()).toBe(true);
    store.nodeDragging.set(false);
    expect(store.gestureActive()).toBe(false);
  });
});

describe('FlowStore.nodeDragging via updateNodePositions', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
  });

  it('tracks the dragging flag XYDrag passes through', () => {
    // XYDrag calls updateNodePositions(items, true) per frame while dragging
    // and updateNodePositions(items, false) exactly once at drag end.
    expect(store.nodeDragging()).toBe(false);
    store.updateNodePositions(new Map(), true);
    expect(store.nodeDragging()).toBe(true);
    store.updateNodePositions(new Map(), false);
    expect(store.nodeDragging()).toBe(false);
  });

  it('defaults to not-dragging when the flag is omitted', () => {
    store.nodeDragging.set(true);
    store.updateNodePositions(new Map());
    expect(store.nodeDragging()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @angflow/angular test -- flow-store.gesture`
Expected: FAIL — `store.gestureActive is not a function`.

- [ ] **Step 3: Add the signals to FlowStore**

In `packages/angular/src/lib/services/flow-store.service.ts`, after line 141 (`readonly userSelectionActive = signal(false);`) add:

```ts
  /**
   * True while a node drag is in flight. Written from `updateNodePositions`,
   * which XYDrag calls with `true` per frame during a drag and with `false`
   * exactly once at drag end — the only choke point that sees both edges.
   */
  readonly nodeDragging = signal(false);

  /** True while a node resize is in flight. Written by NodeResizerComponent. */
  readonly nodeResizing = signal(false);

  /**
   * Any pointer gesture the flow owns is in progress. Used to suppress pane
   * hover events that would otherwise fire when the pointer crosses onto
   * content projected via `<ng-content/>` (minimap, panels), which sits as a
   * sibling of the pane rather than inside it.
   */
  readonly gestureActive = computed(
    () =>
      this.paneDragging() ||
      this.userSelectionActive() ||
      this.nodeDragging() ||
      this.nodeResizing() ||
      this.connection().inProgress
  );
```

If `computed` is not already imported from `@angular/core` in this file, add it.

> `gestureActive` is declared after `connection` is used but signals are read
> lazily inside the computed, so declaration order relative to `connection`
> (line 201) does not matter. Keep it here with the other gesture flags.

- [ ] **Step 4: Write nodeDragging from updateNodePositions**

In the same file, at the top of `updateNodePositions` (line 476), immediately after the opening brace:

```ts
  updateNodePositions(nodeDragItems: Map<string, any>, dragging = false): void { // store drag-callback boundary mirrors xyflow's untyped signature
    this.nodeDragging.set(dragging);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @angflow/angular test -- flow-store.gesture`
Expected: PASS, 9 tests.

- [ ] **Step 6: Write nodeResizing from the resizer**

In `packages/angular/src/lib/components/node-resizer/node-resizer.component.ts`, in `applyResizerConfig`, wrap the resolved start/end callbacks. Replace:

```ts
    const onResizeStart = this.onResizeStartCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeStart.emit({ event, ...params });
    });
```

with:

```ts
    const userOnResizeStart = this.onResizeStartCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeStart.emit({ event, ...params });
    });
    // Wrap rather than fold the store write into the default: a consumer-supplied
    // [onResizeStart] replaces the default entirely, and the gesture flag must be
    // set either way or paneMouseLeave suppression silently stops working for
    // anyone using the callback inputs.
    const onResizeStart = (event: ResizeDragEvent, params: ResizeParams) => {
      this.store.nodeResizing.set(true);
      userOnResizeStart(event, params);
    };
```

and replace:

```ts
    const onResizeEnd = this.onResizeEndCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeEnd.emit({ event, ...params });
    });
```

with:

```ts
    const userOnResizeEnd = this.onResizeEndCb() ?? ((event: ResizeDragEvent, params: ResizeParams) => {
      this.resizeEnd.emit({ event, ...params });
    });
    const onResizeEnd = (event: ResizeDragEvent, params: ResizeParams) => {
      this.store.nodeResizing.set(false);
      userOnResizeEnd(event, params);
    };
```

Also clear the flag in `ngOnDestroy` so a resizer torn down mid-gesture cannot
strand it (this is exactly the mural-copy scenario — proximity chrome unmounting
the resizer mid-drag):

```ts
  ngOnDestroy(): void {
    this.store.nodeResizing.set(false);
    this.destroyResizers();
  }
```

- [ ] **Step 7: Add the resizer test**

Append to `packages/angular/src/lib/services/flow-store.gesture.spec.ts`:

```ts
describe('NodeResizerComponent nodeResizing flag', () => {
  it('sets the flag on resize start and clears it on resize end', async () => {
    const { NodeResizerComponent } = await import('../components/node-resizer/node-resizer.component');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeResizerComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    const store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeResizerComponent);
    fixture.componentRef.setInput('nodeId', 'n1');
    fixture.detectChanges();

    expect(store.nodeResizing()).toBe(false);

    // The real scenario: proximity-gated chrome unmounts the resizer WHILE a
    // resize is in flight. Without the ngOnDestroy clear, the flag strands at
    // true and every later paneMouseLeave is suppressed forever.
    store.nodeResizing.set(true);
    fixture.destroy();
    expect(store.nodeResizing()).toBe(false);
  });
});
```

> This covers the default and the destroy-while-resizing path — the one that
> can permanently wedge `gestureActive`. It deliberately does not drive a real
> `XYResizer` drag, which needs a laid-out DOM; the start/end wrapping is
> covered end-to-end by Task 5's tests, which set `nodeResizing` directly. If
> the component requires inputs beyond `nodeId`, read its input declarations
> and supply them.

- [ ] **Step 8: Run the full suite and type-check**

Run: `pnpm -F @angflow/angular test` then `cd packages/angular && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add packages/angular/src/lib/services/ packages/angular/src/lib/components/node-resizer/
git commit -m "feat(angular): track node drag and resize gestures on the store"
```

---

### Task 5: Latch `paneMouseLeave` until the gesture ends

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts:203` and `:205` (template bindings), constructor at `:715` (add an effect), plus new handler methods near `onPanePointerDown` at `:1051`
- Create: `packages/angular/src/lib/container/ng-flow/ng-flow.pane-hover.spec.ts`

**Interfaces:**
- Consumes: `FlowStore.gestureActive` (Task 4).
- Produces: `NgFlowComponent.onPaneMouseEnter(event: MouseEvent): void` and `NgFlowComponent.onPaneMouseLeave(event: MouseEvent): void`.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/container/ng-flow/ng-flow.pane-hover.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { FlowStore } from '../../services/flow-store.service';

describe('NgFlowComponent pane hover during gestures', () => {
  let fixture: ComponentFixture<NgFlowComponent>;
  let component: NgFlowComponent;
  let store: FlowStore;
  let leaves: MouseEvent[];
  let enters: MouseEvent[];

  const leaveEvent = new MouseEvent('mouseleave');
  const enterEvent = new MouseEvent('mouseenter');

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NgFlowComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(NgFlowComponent);
    component = fixture.componentInstance;
    store = fixture.debugElement.injector.get(FlowStore);
    leaves = [];
    enters = [];
    component.paneMouseLeave.subscribe((e) => leaves.push(e));
    component.paneMouseEnter.subscribe((e) => enters.push(e));
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('emits leave immediately when no gesture is active', () => {
    component.onPaneMouseLeave(leaveEvent);
    expect(leaves).toEqual([leaveEvent]);
  });

  it('emits enter normally when no latch is pending', () => {
    component.onPaneMouseEnter(enterEvent);
    expect(enters).toEqual([enterEvent]);
  });

  it('suppresses leave during a gesture and delivers it when the gesture ends', () => {
    store.nodeDragging.set(true);
    fixture.detectChanges();

    component.onPaneMouseLeave(leaveEvent);
    expect(leaves).toEqual([]);

    store.nodeDragging.set(false);
    fixture.detectChanges();

    expect(leaves).toEqual([leaveEvent]);
  });

  it('never delivers the leave if the pointer came back before the gesture ended', () => {
    store.nodeDragging.set(true);
    fixture.detectChanges();

    component.onPaneMouseLeave(leaveEvent);
    component.onPaneMouseEnter(enterEvent);

    store.nodeDragging.set(false);
    fixture.detectChanges();

    expect(leaves).toEqual([]);
  });

  it('suppresses the re-entry enter that pairs with a suppressed leave', () => {
    // The consumer never saw the leave, so they still believe the pointer is
    // over the pane. An enter here would be an unpaired duplicate.
    store.nodeDragging.set(true);
    fixture.detectChanges();

    component.onPaneMouseLeave(leaveEvent);
    component.onPaneMouseEnter(enterEvent);

    expect(enters).toEqual([]);
  });

  it('delivers the latched leave exactly once', () => {
    store.nodeDragging.set(true);
    fixture.detectChanges();
    component.onPaneMouseLeave(leaveEvent);

    store.nodeDragging.set(false);
    fixture.detectChanges();
    store.nodeDragging.set(true);
    fixture.detectChanges();
    store.nodeDragging.set(false);
    fixture.detectChanges();

    expect(leaves).toEqual([leaveEvent]);
  });

  it('latches for every gesture source', () => {
    const sources: Array<[string, () => void, () => void]> = [
      ['paneDragging', () => store.paneDragging.set(true), () => store.paneDragging.set(false)],
      ['userSelectionActive', () => store.userSelectionActive.set(true), () => store.userSelectionActive.set(false)],
      ['nodeResizing', () => store.nodeResizing.set(true), () => store.nodeResizing.set(false)],
    ];

    // Never reassign `leaves` — the subscription above closes over the original
    // array, so a fresh array would silently stop receiving emissions and every
    // assertion after it would pass vacuously. Compare counts instead.
    for (const [name, start, end] of sources) {
      const before = leaves.length;

      start();
      fixture.detectChanges();
      component.onPaneMouseLeave(leaveEvent);
      expect(leaves.length, `${name}: leave must be suppressed mid-gesture`).toBe(before);

      end();
      fixture.detectChanges();
      expect(leaves.length, `${name}: leave must be delivered at gesture end`).toBe(before + 1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @angflow/angular test -- ng-flow.pane-hover`
Expected: FAIL — `component.onPaneMouseLeave is not a function`.

- [ ] **Step 3: Change the template bindings**

In `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`, change line 203 from:

```html
        (mouseenter)="paneMouseEnter.emit($event)"
```

to:

```html
        (mouseenter)="onPaneMouseEnter($event)"
```

and line 205 from:

```html
        (mouseleave)="paneMouseLeave.emit($event)"
```

to:

```html
        (mouseleave)="onPaneMouseLeave($event)"
```

Leave `(mousemove)` on line 204 alone — a mousemove over projected content is
not misleading the way an unpaired leave is, and suppressing it would break
consumers tracking pointer position.

- [ ] **Step 4: Add the handlers**

Next to `onPanePointerDown` (around line 1051) add:

```ts
  /**
   * `<ng-content/>` is projected as a SIBLING of `.xy-flow__pane` (see the
   * template), so a pointer crossing from the canvas onto a projected minimap
   * or panel fires a real `mouseleave` on the pane — indistinguishable from
   * leaving onto unrelated page chrome. Mid-gesture that is a lie: the gesture
   * is still tracking the pointer. Consumers using `paneMouseLeave` to tear
   * down hover chrome would tear down chrome that owns the live gesture.
   *
   * So while a gesture is active the leave is latched, not emitted, and:
   *  - if the pointer returns first, the latch is dropped and the paired enter
   *    is swallowed too (the consumer never learned the pointer left, so an
   *    enter would be an unpaired duplicate);
   *  - if the gesture ends with the pointer still outside, the latched leave is
   *    delivered then, preserving the enter/leave pairing.
   */
  private latchedPaneLeave: MouseEvent | null = null;

  onPaneMouseEnter(event: MouseEvent): void {
    if (this.latchedPaneLeave) {
      this.latchedPaneLeave = null;
      return;
    }
    this.paneMouseEnter.emit(event);
  }

  onPaneMouseLeave(event: MouseEvent): void {
    if (this.store.gestureActive()) {
      this.latchedPaneLeave = event;
      return;
    }
    this.paneMouseLeave.emit(event);
  }
```

- [ ] **Step 5: Add the flush effect**

In the constructor (line 715 onward), alongside the other effects, add:

```ts
    // Flush a latched pane leave when the gesture that suppressed it ends.
    // Signal-driven, no NgZone — see onPaneMouseLeave for why the latch exists.
    effect(() => {
      if (this.store.gestureActive()) return;
      const latched = this.latchedPaneLeave;
      if (latched) {
        this.latchedPaneLeave = null;
        this.paneMouseLeave.emit(latched);
      }
    });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm -F @angflow/angular test -- ng-flow.pane-hover`
Expected: PASS, 7 tests.

> If the first assertion fails because the effect runs once at construction with
> `gestureActive() === false` and `latchedPaneLeave === null`, that is the
> intended no-op path — the guard handles it. A genuine failure here means the
> effect is not re-running on the signal; confirm `gestureActive()` is read
> unconditionally at the top of the effect (it is, in the code above).

- [ ] **Step 7: Run the full suite and type-check**

Run: `pnpm -F @angflow/angular test` then `cd packages/angular && npx tsc --noEmit`
Expected: all green. Pay attention to `ng-flow.pane-click.spec.ts` and
`ng-flow.autopan-focus.spec.ts` — they exercise neighbouring pane behavior.

- [ ] **Step 8: Commit**

```bash
git add packages/angular/src/lib/container/ng-flow/
git commit -m "fix(angular): stop pane hover events firing mid-gesture"
```

---

### Task 6: Minimap `[includeHiddenNodes]`

**Files:**
- Modify: `packages/angular/src/lib/components/minimap/minimap.component.ts` (one input near `:139`, filter at `:247-255`)
- Create: `packages/angular/src/lib/components/minimap/minimap.hidden-nodes.spec.ts`

**Interfaces:**
- Consumes: `FlowStore.nodeLookup`, `FlowStore.collapsedHiddenIds()`.
- Produces: `MinimapComponent.includeHiddenNodes` — `InputSignal<boolean>`, default `false`.

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/components/minimap/minimap.hidden-nodes.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MinimapComponent } from './minimap.component';
import { FlowStore } from '../../services/flow-store.service';
import type { Node } from '../../types';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', width: 100, height: 50, ...overrides };
}

describe('MinimapComponent includeHiddenNodes', () => {
  let fixture: ComponentFixture<MinimapComponent>;
  let component: MinimapComponent;
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MinimapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(MinimapComponent);
    component = fixture.componentInstance;
    store.setNodes([
      makeNode('visible'),
      makeNode('domHidden', { hidden: true, position: { x: 500, y: 500 } }),
    ]);
  });

  it('excludes hidden nodes by default', () => {
    expect(component.minimapNodes().map((n) => n.id)).toEqual(['visible']);
  });

  it('includes hidden nodes when the input is set', () => {
    fixture.componentRef.setInput('includeHiddenNodes', true);
    fixture.detectChanges();
    expect(component.minimapNodes().map((n) => n.id).sort()).toEqual(['domHidden', 'visible']);
  });

  it('still excludes collapse-hidden nodes when the input is set', () => {
    // A collapsed group's own rect already represents its descendants; drawing
    // them too would double-draw the region and inflate the viewBox.
    //
    // `collapsedHiddenIds` is a COMPUTED (flow-store.service.ts:345) derived
    // from getCollapsedHiddenIds(nodeLookup) — it has no .set(). Drive it the
    // only way the real feature does: a parent marked `collapsed: true` hides
    // every descendant that points at it via `parentId`.
    store.setNodes([
      makeNode('group', { collapsed: true } as Partial<Node>),
      makeNode('child', { parentId: 'group' } as Partial<Node>),
      makeNode('domHidden', { hidden: true, position: { x: 500, y: 500 } }),
    ]);
    expect(store.collapsedHiddenIds().has('child')).toBe(true);

    fixture.componentRef.setInput('includeHiddenNodes', true);
    fixture.detectChanges();

    const ids = component.minimapNodes().map((n) => n.id).sort();
    expect(ids).toContain('domHidden'); // node.hidden revealed by the input
    expect(ids).not.toContain('child'); // collapse-hidden stays excluded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @angflow/angular test -- minimap.hidden-nodes`
Expected: FAIL on the second test — hidden node still filtered out, so
`['visible']` is returned instead of `['domHidden', 'visible']`.

- [ ] **Step 3: Add the input**

In `packages/angular/src/lib/components/minimap/minimap.component.ts`, after line 145 (`readonly inversePan = input(false);`) add:

```ts
  /**
   * Draw nodes whose `hidden` flag is `true`. `hidden` conflates two things —
   * "skip this node's DOM" and "drop it from the minimap" — which forces a
   * consumer doing viewport culling to give up the cheap DOM skip just to keep
   * off-screen elements navigable on the minimap. Set this to `true` to get
   * both. Mirrors `fitView`'s option of the same name.
   *
   * Collapse-hidden nodes are unaffected: they stay excluded regardless,
   * because their collapsed ancestor's rect already covers that region.
   */
  readonly includeHiddenNodes = input(false);
```

- [ ] **Step 4: Change the filter**

Replace the `minimapNodes` filter (lines 247-255) with:

```ts
  readonly minimapNodes = computed(() => {
    this.store.version(); // react to node changes
    const collapsed = this.store.collapsedHiddenIds();
    const includeHidden = this.includeHiddenNodes();
    // Collapse-hidden nodes are always excluded — the collapsed ancestor's own
    // rect stands in for them. `node.hidden` is opt-in via [includeHiddenNodes]:
    // the node renderer skips those nodes' DOM, but a consumer culling by
    // viewport still wants them as navigable dots.
    const nodes = Array.from(this.store.nodeLookup.values()).filter(
      (node) => !collapsed.has(node.id) && (includeHidden || !node.hidden),
    );
```

Leave the `.map(...)` body that follows unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @angflow/angular test -- minimap.hidden-nodes`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full suite and type-check**

Run: `pnpm -F @angflow/angular test` then `cd packages/angular && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/components/minimap/
git commit -m "feat(angular): add [includeHiddenNodes] to the minimap"
```

---

### Task 7: Full verification and release prep

**Files:**
- Modify: `packages/angular/package.json` (version bump)

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: a publishable `@angflow/angular`.

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

Expected: all green. `@angflow/system` is unchanged by this plan, but it must be
built before `@angflow/angular` (angular depends on its `dist/`).

- [ ] **Step 2: Confirm no agent-surface drift**

Run: `git diff --stat main -- packages/angular/src/lib/agent/`
Expected: no output. If anything changed there, `AGENT_BRIDGE.md` and the
`@angflow/mcp` schema snapshot both need updating — neither is expected here.

- [ ] **Step 3: Build and check the example suite**

```bash
pnpm -F angular-examples build
```

Expected: clean build. This is the zonal example suite that must keep passing per
`CLAUDE.md`.

- [ ] **Step 4: Bump the version**

```bash
cd packages/angular && npm version patch
```

Expected: `0.3.19` → `0.3.20`.

- [ ] **Step 5: Verify the packed manifest**

```bash
cd packages/angular && pnpm pack && tar -xzOf angflow-angular-*.tgz package/package.json | grep angflow/system
```

Expected: a real semver range such as `"@angflow/system": "^0.1.12"` — **never**
`"workspace:^"`. A literal workspace protocol here breaks every clean install
(this shipped for real in 0.3.18). Delete the tarball afterwards.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/package.json
git commit -m "chore(angular): 0.3.20"
```

---

### Task 8: Send the correction back to mural-copy

**Files:**
- Modify: `C:\code\projects\web\mural-copy\docs\angflow-feedback.md`

**Interfaces:**
- Consumes: verification results from the spec's "Verification results" table.
- Produces: nothing consumed by other tasks. This is a different repository —
  make no code changes there and do not touch its build.

- [ ] **Step 1: Update the status table**

Change the status of these rows:

| Finding | New status |
|---|---|
| `hidden` also removes nodes from the minimap | **Fixed in `@angflow/angular@0.3.20`** — `<ng-flow-minimap [includeHiddenNodes]="true">` |
| Unknown edge type has no warning | **Fixed in `@angflow/angular@0.3.20`** |
| Unknown node type has no warning | **Fixed in `@angflow/angular@0.3.20`** |
| Core dev-warning channel is missing | **Premise corrected — see below; the real defect is fixed in 0.3.20** |
| Projected overlays trigger `paneMouseLeave` mid-gesture | **Fixed in `@angflow/angular@0.3.20`** |
| Remounted handles do not refresh edge anchors | **Premise corrected — a public API already covers this** |
| Redundant initial `dimensions` change | Open (deferred upstream — verbatim xyflow behavior) |

- [ ] **Step 2: Add a correction block to the remounted-handles entry**

Insert directly under that entry's heading:

```markdown
> **Correction (2026-08-13, from angflow):** the premise "No public, app-level lever
> exists" / "`updateNodeInternals` … is just never reachable from application code"
> is wrong. `NgFlowService.updateNodeInternals(nodeIds: string | string[])` is public
> (`packages/angular/src/lib/services/ng-flow.service.ts:1000`), passes `force: true`
> — which bypasses the `dimensionChanged` gate that would otherwise skip a
> same-size remeasure — and is documented in angflow's `docs/examples-parity.md`.
> It has existed since the initial Angular wrapper commit and **is present in the
> 0.3.17 dist this finding was written against** (`ng-flow.service.js:888` in this
> project's own `node_modules`).
>
> So the handle-unmounting revert was not forced. Calling
> `flow.updateNodeInternals(id)` when a node un-culls refreshes `handleBounds` and
> fixes the stale edge anchor, which means the culling win (unmounting 8 handles per
> off-screen node, plus their `computed()`s) is available after all — relevant at the
> 5,000-element target. The ResizeObserver gap itself is real and unchanged; angflow
> has recorded the automatic-detection idea (a subtree `MutationObserver`) as
> deferred, since the public API already covers the case.
```

- [ ] **Step 3: Add a correction block to the dev-warning-channel entry**

Insert directly under that entry's heading:

```markdown
> **Correction (2026-08-13, from angflow):** the channel exists. `devWarn(id, message)`
> lives in `@angflow/system` (`utils/general.ts`), `errorMessages` in its
> `constants.ts` — already containing `error003` and `error011`, the exact two
> messages this document asks for — `FlowStore.onError` defaults to `devWarn`, and
> `<ng-flow>` bridges it to a public `(error)` output while preserving the console
> default. The sweep missed it because it grepped `console.warn` in the
> **`@angflow/angular`** dist; the literal `console.warn` is in `@angflow/system`.
>
> The accident found something worse, though. `isDevEnv()` gates on
> `process.env.NODE_ENV === 'development'`, and Angular's `@angular/build:application`
> (esbuild) never defines `process.env.NODE_ENV` for browser bundles. Verified in
> angflow's own committed example bundle, which carries
> `globalThis.process?.env?.NODE_ENV==="development"` verbatim and unsubstituted — so
> `globalThis.process` is undefined at runtime, the check is permanently false, and
> **that console channel had never fired for any Angular consumer, in dev or prod.**
> The `(error)` output was unaffected; only the console fallback was dead.
>
> Fixed in `@angflow/angular@0.3.20`: an Angular-native `ngDevWarn` gated on
> `isDevMode()`, with warn-once-per-`id::message` dedupe and an `[angflow]` prefix,
> is now the `onError` default. The unknown node-type and edge-type fallbacks are its
> first two callers. Still outstanding: `addEdge`/`reconnectEdge` (`error006`/`error007`)
> call system's `devWarn` directly, bypassing the store, so those remain silent in
> Angular builds.
```

- [ ] **Step 4: Add a correction to the `dimensions` entry**

Insert directly under that entry's heading:

```markdown
> **Correction and status (2026-08-13, from angflow):** confirmed, but the mechanism
> is not "fires even when the measured size is identical". `updateNodeInternals` gates
> the change on a comparison against `node.measured`, and `adoptUserNodes` seeds
> `measured` **only** from `userNode.measured` — never from `userNode.width`/`height`.
> A sticky created at `width: 200, height: 200` therefore has
> `measured = {undefined, undefined}` until the ResizeObserver fires, and the first
> measurement is always `undefined !== 200`. The declared size is never in the
> comparison at all.
>
> Deferred, not fixed: both the gate and the seeding are verbatim xyflow (confirmed by
> diffing against `upstream/main`), so React Flow emits the identical echo. Changing it
> is a one-way divergence in shared framework-agnostic code. This app's diff-before-write
> fix is the right layer for now. Will revisit if a second consumer hits it.
```

- [ ] **Step 5: Update the header status paragraph**

Update the "Status as of …" prose above the table to reflect the new counts:
three findings fixed in 0.3.18/0.1.12, four more fixed in 0.3.20, two premises
corrected, one deferred. Keep the existing 0.3.19/0.1.12 upgrade narrative intact —
it is still accurate history.

- [ ] **Step 6: Verify no code changed in that repo**

```bash
cd /c/code/projects/web/mural-copy && git status --short
```

Expected: only `docs/angflow-feedback.md` modified. Do not commit — mural-copy is
the user's repo and its commit cadence is theirs to choose. Report the edit and stop.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 `ngDevWarn` helper + `FlowStore.onError` default | Task 1 |
| §1 call sites (`error003`, `error011`) | Tasks 2, 3 |
| §1 remaining gap (`error006`/`error007`) recorded, not fixed | Recorded in Task 8 Step 3 |
| §2 `nodeDragging`, `nodeResizing`, `gestureActive` | Task 4 |
| §2 latch/flush/enter-suppression semantics | Task 5 |
| §3 minimap `[includeHiddenNodes]`, collapse excluded | Task 6 |
| §4 correction back to mural-copy | Task 8 |
| §Testing (all five bullets) | Tasks 1-6 test steps |
| §Release (patch bump, no system republish, no mcp regen) | Task 7 |

No gaps.

**Placeholder scan:** No TBD/TODO. Every code step carries real code. Three steps
carry conditional fallbacks (Task 2 Step 1 on `nodeTemplates`, Task 3 Step 5 on the
store field name, Task 6 Step 1 on `collapsedHiddenIds`) — these are verification
instructions with a stated invariant, not deferred decisions.

**Type consistency:** `ngDevWarn`/`resetDevWarnDedupe` (Task 1) are used with those
exact names in Tasks 2, 3. `gestureActive`/`nodeDragging`/`nodeResizing` (Task 4)
are used with those exact names in Task 5's tests and effect. `includeHiddenNodes`
(Task 6) matches between the input declaration, the computed, and the test's
`setInput`. `onPaneMouseEnter`/`onPaneMouseLeave` (Task 5) match between template
bindings, handlers, and tests.
