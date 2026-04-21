# Custom Node `injectNgFlowNode` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `injectNgFlowNode<TData>()` helper in `@angflow/angular` that returns a typed context of reactive signals, letting consumers write custom node components with ~15 lines of class body instead of ~40 lines of input declarations. Ships additively alongside the existing input-based API.

**Architecture:** Library-internal plumbing adds one `InjectionToken` (`NG_FLOW_NODE_CONTEXT`), one `NgFlowNodeContext<TData>` interface, one helper file (`inject-ng-flow-node.ts`), and one method on `NodeRendererComponent` (`buildNodeContext`) that creates a per-node context of `computed()` signals against the FlowStore. The existing per-node `Injector` (created in `getNodeInjector()`) gains a new provider for the context. Consumer-facing surface is one function export and one type export. No removals, no deprecations, no changes to the input-based rendering path.

**Tech Stack:** Angular 19+ (signals, OnPush, inject), TypeScript 5.9, Vitest. Windows with bash; use forward-slash paths.

**Spec reference:** `docs/superpowers/specs/2026-04-21-custom-node-inject-design.md`.

---

## Branch

Work on `feat/custom-node-inject` (already created; spec commit lives here).

```bash
git branch --show-current
# feat/custom-node-inject
```

---

## File Structure

**Files created:**
- `packages/angular/src/lib/utils/inject-ng-flow-node.ts` — `injectNgFlowNode()` helper.
- `packages/angular/src/lib/utils/inject-ng-flow-node.spec.ts` — unit tests.
- `examples/angular/src/app/examples/custom-node-inject/custom-node-inject.component.ts` — gallery example.

**Files modified:**
- `packages/angular/src/lib/services/tokens.ts` — add `NG_FLOW_NODE_CONTEXT` token.
- `packages/angular/src/lib/types/nodes.ts` — add `NgFlowNodeContext<TData>` interface.
- `packages/angular/src/lib/utils/index.ts` — re-export the helper.
- `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts` — add `buildNodeContext`, extend `getNodeInjector` to provide `NG_FLOW_NODE_CONTEXT`.
- `packages/angular/src/lib/public-api.ts` — re-export `injectNgFlowNode` and `NgFlowNodeContext`.
- `examples/angular/src/app/app.routes.ts` — register the new example.
- `examples/angular/src/app/examples/custom-node/custom-node.component.ts` — append one sentence to the description cross-referencing the new example.

**Files deliberately not touched:**
- `DefaultNodeComponent`, `InputNodeComponent`, `OutputNodeComponent`, `GroupNodeComponent` — built-in nodes keep their input-based API.
- Any other example.
- Custom edge components — out of scope.

---

## Task 1: Add `NG_FLOW_NODE_CONTEXT` token and `NgFlowNodeContext<TData>` type

**Goal:** Introduce the DI token and the typed context interface. Pure type + declaration work, no logic yet.

**Files:**
- Modify: `packages/angular/src/lib/services/tokens.ts`
- Modify: `packages/angular/src/lib/types/nodes.ts`

- [ ] **Step 1: Read the current `tokens.ts`**

```bash
grep -n "NODE_ID\|EDGE_ID" packages/angular/src/lib/services/tokens.ts
```

Expected: `NODE_ID` and `EDGE_ID` already exported from this file.

- [ ] **Step 2: Add the `NG_FLOW_NODE_CONTEXT` token**

Edit `packages/angular/src/lib/services/tokens.ts`. Add the `NgFlowNodeContext` import from the types barrel and a new token after `EDGE_ID`:

```typescript
import { InjectionToken } from '@angular/core';
import type { NgFlowNodeContext } from '../types';

// ... existing NODE_ID and EDGE_ID exports remain unchanged ...

/**
 * DI token providing the per-node context (reactive signals) to components
 * registered via `nodeTypes` on `<ng-flow>`. Consumers retrieve the context
 * via the public `injectNgFlowNode<T>()` helper rather than reading the token
 * directly.
 */
export const NG_FLOW_NODE_CONTEXT = new InjectionToken<NgFlowNodeContext<unknown>>(
  'NG_FLOW_NODE_CONTEXT',
);
```

- [ ] **Step 3: Add the `NgFlowNodeContext` interface**

Edit `packages/angular/src/lib/types/nodes.ts`. Add the following at the end of the file:

```typescript
import type { Signal } from '@angular/core';
import type { Position } from '@angflow/system';

/**
 * Reactive context passed to a custom node component registered via `nodeTypes`.
 * Retrieved by `injectNgFlowNode<TData>()` inside the component class.
 *
 * All properties are read-only signals. Writes to node state must go through
 * `NgFlowService` or `FlowStore` — this context is a view-only projection.
 */
export interface NgFlowNodeContext<TData = unknown> {
  /** Node id. */
  readonly id: Signal<string>;

  /** Consumer-provided data payload. Typed via `TData`. */
  readonly data: Signal<TData | undefined>;

  /** The node's registered type string (or 'default'). */
  readonly type: Signal<string | undefined>;

  /** True while this node is part of the current selection. */
  readonly selected: Signal<boolean>;

  /** True while this node is being dragged. */
  readonly dragging: Signal<boolean>;

  /** Stacking order computed by the library (selection elevation, etc.). */
  readonly zIndex: Signal<number>;

  /** Whether connection drag is allowed from this node's handles. */
  readonly isConnectable: Signal<boolean>;

  /** Absolute position in flow coordinates. */
  readonly position: Signal<{ x: number; y: number }>;

  /** sourcePosition for default edges (Position enum, optional). */
  readonly sourcePosition: Signal<Position | undefined>;

  /** targetPosition for default edges. */
  readonly targetPosition: Signal<Position | undefined>;

  /** CSS selector for the drag-handle sub-element, if any. */
  readonly dragHandle: Signal<string | undefined>;
}
```

The `Signal` import is from `@angular/core`; the `Position` import is from `@angflow/system`. If `nodes.ts` already imports from either, merge the new import into the existing statement.

- [ ] **Step 4: Verify the `types/index.ts` barrel re-exports**

```bash
cat packages/angular/src/lib/types/index.ts
```

Expected: `export * from './nodes'` (or equivalent). If so, `NgFlowNodeContext` is automatically reachable from `'../types'`. If the file uses named re-exports instead, add `NgFlowNodeContext` to them.

- [ ] **Step 5: Typecheck**

```bash
cd packages/angular
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 6: Commit**

From repo root:
```bash
git add packages/angular/src/lib/services/tokens.ts packages/angular/src/lib/types/nodes.ts
git commit -m "feat(angular): add NG_FLOW_NODE_CONTEXT token and NgFlowNodeContext type"
```

---

## Task 2: Implement `injectNgFlowNode()` helper with unit tests (TDD)

**Goal:** Create the consumer-facing helper. Write failing tests first, then implement.

**Files:**
- Create: `packages/angular/src/lib/utils/inject-ng-flow-node.ts`
- Create: `packages/angular/src/lib/utils/inject-ng-flow-node.spec.ts`
- Modify: `packages/angular/src/lib/utils/index.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/angular/src/lib/utils/inject-ng-flow-node.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Injector, runInInjectionContext, signal, computed } from '@angular/core';
import { injectNgFlowNode } from './inject-ng-flow-node';
import { NG_FLOW_NODE_CONTEXT } from '../services/tokens';
import type { NgFlowNodeContext } from '../types';
import { Position } from '@angflow/system';

/**
 * Build a minimal NgFlowNodeContext backed by writable signals so tests can
 * drive state changes and assert reactive behavior.
 */
function makeStubContext(opts: {
  id?: string;
  data?: unknown;
  selected?: boolean;
} = {}) {
  const dataSig = signal<unknown>(opts.data);
  const selectedSig = signal(opts.selected ?? false);

  const context: NgFlowNodeContext<unknown> = {
    id: computed(() => opts.id ?? 'n1'),
    data: dataSig,
    type: computed(() => 'default'),
    selected: selectedSig,
    dragging: computed(() => false),
    zIndex: computed(() => 0),
    isConnectable: computed(() => true),
    position: computed(() => ({ x: 0, y: 0 })),
    sourcePosition: computed(() => undefined),
    targetPosition: computed(() => undefined),
    dragHandle: computed(() => undefined),
  };

  return { context, dataSig, selectedSig };
}

describe('injectNgFlowNode', () => {
  it('returns the provided NG_FLOW_NODE_CONTEXT', () => {
    const { context } = makeStubContext({ id: 'node-42' });
    const injector = Injector.create({
      providers: [{ provide: NG_FLOW_NODE_CONTEXT, useValue: context }],
    });

    const got = runInInjectionContext(injector, () => injectNgFlowNode());

    expect(got).toBe(context);
    expect(got.id()).toBe('node-42');
  });

  it('throws a descriptive error when called without the context in the injector tree', () => {
    const injector = Injector.create({ providers: [] });

    expect(() =>
      runInInjectionContext(injector, () => injectNgFlowNode()),
    ).toThrowError(/injectNgFlowNode\(\) was called outside/);
  });

  it('returns a context whose signals react to underlying state changes', () => {
    const { context, dataSig, selectedSig } = makeStubContext({ data: { label: 'A' } });
    const injector = Injector.create({
      providers: [{ provide: NG_FLOW_NODE_CONTEXT, useValue: context }],
    });

    const got = runInInjectionContext(injector, () =>
      injectNgFlowNode<{ label: string }>(),
    );

    expect(got.data()).toEqual({ label: 'A' });
    expect(got.selected()).toBe(false);

    dataSig.set({ label: 'B' });
    selectedSig.set(true);

    expect(got.data()).toEqual({ label: 'B' });
    expect(got.selected()).toBe(true);
  });

  it('type-parameterizes the data signal via the generic argument', () => {
    interface MyData { title: string; count: number }
    const { context } = makeStubContext({ data: { title: 'x', count: 2 } });
    const injector = Injector.create({
      providers: [{ provide: NG_FLOW_NODE_CONTEXT, useValue: context }],
    });

    const got = runInInjectionContext(injector, () => injectNgFlowNode<MyData>());

    // Compile-time assertion: `got.data()` is `MyData | undefined`.
    // Runtime assertion: the values survive the pass-through.
    const value = got.data();
    expect(value?.title).toBe('x');
    expect(value?.count).toBe(2);
  });

  it('does not touch the position signal when unused (passes through)', () => {
    const { context } = makeStubContext();
    const injector = Injector.create({
      providers: [{ provide: NG_FLOW_NODE_CONTEXT, useValue: context }],
    });

    const got = runInInjectionContext(injector, () => injectNgFlowNode());
    expect(got.position()).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd packages/angular
npx vitest run src/lib/utils/inject-ng-flow-node.spec.ts
```

Expected: FAIL with "Failed to resolve import './inject-ng-flow-node'".

- [ ] **Step 3: Write the implementation**

Create `packages/angular/src/lib/utils/inject-ng-flow-node.ts`:

```typescript
import { inject } from '@angular/core';
import { NG_FLOW_NODE_CONTEXT } from '../services/tokens';
import type { NgFlowNodeContext } from '../types';

/**
 * Retrieve the per-node reactive context from a component registered via
 * `nodeTypes` on `<ng-flow>`. The returned object exposes read-only signals
 * for every property the library tracks per node (id, data, selected,
 * dragging, position, zIndex, etc.).
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyNode {
 *   readonly node = injectNgFlowNode<MyData>();
 *   // node.id(), node.data(), node.selected(), ...
 * }
 * ```
 *
 * @throws Error when called outside of a node-rendered component tree.
 */
export function injectNgFlowNode<TData = unknown>(): NgFlowNodeContext<TData> {
  const context = inject(NG_FLOW_NODE_CONTEXT, { optional: true });
  if (!context) {
    throw new Error(
      'injectNgFlowNode() was called outside of a node-rendered component tree. ' +
      'It can only be called from components registered via nodeTypes on <ng-flow>.',
    );
  }
  return context as NgFlowNodeContext<TData>;
}
```

- [ ] **Step 4: Re-export from the utils barrel**

Edit `packages/angular/src/lib/utils/index.ts`. Add the new helper alongside the existing `applyNodeChanges` / `applyEdgeChanges` exports:

```typescript
export { applyNodeChanges, applyEdgeChanges, createSelectionChange, getSelectionChanges, getElementsDiffChanges, elementToRemoveChange } from './changes';
export { injectNgFlowNode } from './inject-ng-flow-node';
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd packages/angular
npx vitest run src/lib/utils/inject-ng-flow-node.spec.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Run the full Angular test suite to confirm no regressions**

```bash
cd packages/angular
npm run test
```

Expected: all specs pass (previous baseline + 5 new = 124 tests).

- [ ] **Step 7: Typecheck + build**

```bash
cd packages/angular
npx tsc --noEmit
npm run build
```

Expected: both clean.

- [ ] **Step 8: Commit**

From repo root:
```bash
git add packages/angular/src/lib/utils/inject-ng-flow-node.ts \
        packages/angular/src/lib/utils/inject-ng-flow-node.spec.ts \
        packages/angular/src/lib/utils/index.ts
git commit -m "feat(angular): add injectNgFlowNode() helper for custom node components

Returns the per-node reactive context provided by the library's node renderer.
Lets consumers replace ~11 signal-input declarations with a single helper
call. Throws with an actionable error when called outside a node-rendered
component tree."
```

---

## Task 3: Extend `NodeRendererComponent` to provide `NG_FLOW_NODE_CONTEXT` per node

**Goal:** Make the context actually reachable from consumer nodes. Adds `buildNodeContext(nodeId)` and wires `NG_FLOW_NODE_CONTEXT` into the per-node injector.

**Files:**
- Modify: `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts`

- [ ] **Step 1: Confirm the current structure**

```bash
grep -n "getNodeInjector\|nodeInjectorCache\|NODE_ID" packages/angular/src/lib/container/node-renderer/node-renderer.component.ts
```

Expected: `nodeInjectorCache` field, `getNodeInjector()` method around lines 307–317, `NODE_ID` import near the top.

- [ ] **Step 2: Add the new imports**

Edit the top of `node-renderer.component.ts`. Find the import line for `NODE_ID` (around line 17):

```typescript
import { NODE_ID } from '../../services/tokens';
```

Update it to also import the new token:

```typescript
import { NODE_ID, NG_FLOW_NODE_CONTEXT } from '../../services/tokens';
```

Find the `@angular/core` imports at the top. Ensure `computed` is in the imports; if not, add it. Also ensure the `types` barrel is imported for `NgFlowNodeContext`:

```typescript
import type { NgFlowNodeContext } from '../../types';
```

(If `../../types` is already imported for other types, merge `NgFlowNodeContext` into that import.)

- [ ] **Step 3: Add the context cache field**

In `NodeRendererComponent`, find the existing `nodeInjectorCache` field (it sits near other per-node caches like `nodeInputsCache`). Add a sibling field right after `nodeInjectorCache`:

```typescript
private readonly nodeContextCache = new Map<string, NgFlowNodeContext<unknown>>();
```

- [ ] **Step 4: Add the `buildNodeContext` method**

At the end of the class (just before the closing `}` of `NodeRendererComponent`), add:

```typescript
private buildNodeContext(nodeId: string): NgFlowNodeContext<unknown> {
  const store = this.store;
  const getNode = () => {
    store.version();
    return store.nodeLookup.get(nodeId);
  };

  return {
    id: computed(() => nodeId),
    data: computed(() => getNode()?.data),
    type: computed(() => getNode()?.type),
    selected: computed(() => getNode()?.selected ?? false),
    dragging: computed(() => getNode()?.dragging ?? false),
    zIndex: computed(() => getNode()?.internals?.z ?? 0),
    isConnectable: computed(() => true),
    position: computed(() => {
      const n = getNode();
      return {
        x: n?.internals?.positionAbsolute?.x ?? n?.position.x ?? 0,
        y: n?.internals?.positionAbsolute?.y ?? n?.position.y ?? 0,
      };
    }),
    sourcePosition: computed(() => getNode()?.sourcePosition),
    targetPosition: computed(() => getNode()?.targetPosition),
    dragHandle: computed(() => getNode()?.dragHandle),
  };
}
```

- [ ] **Step 5: Extend `getNodeInjector` to provide the context**

Find the existing `getNodeInjector` method (around lines 307–317). Replace its body with:

```typescript
getNodeInjector(nodeId: string): Injector {
  let injector = this.nodeInjectorCache.get(nodeId);
  if (!injector) {
    let context = this.nodeContextCache.get(nodeId);
    if (!context) {
      context = this.buildNodeContext(nodeId);
      this.nodeContextCache.set(nodeId, context);
    }

    injector = Injector.create({
      providers: [
        { provide: NODE_ID, useValue: nodeId },
        { provide: NG_FLOW_NODE_CONTEXT, useValue: context },
      ],
      parent: this.parentInjector,
    });
    this.nodeInjectorCache.set(nodeId, injector);
  }
  return injector;
}
```

- [ ] **Step 6: Run the full Angular test suite to confirm no regression**

```bash
cd packages/angular
npm run test
```

Expected: all 124 tests pass. The context is now provided, but no test exercises it yet beyond the unit tests in Task 2.

- [ ] **Step 7: Typecheck + build**

```bash
cd packages/angular
npx tsc --noEmit
npm run build
```

Expected: both clean.

- [ ] **Step 8: Commit**

From repo root:
```bash
git add packages/angular/src/lib/container/node-renderer/node-renderer.component.ts
git commit -m "feat(angular): provide NG_FLOW_NODE_CONTEXT on per-node injector

NodeRendererComponent now builds a reactive context per node id with
computed() signals derived from FlowStore state. The context is cached
alongside the node's Injector and provided via NG_FLOW_NODE_CONTEXT so
injectNgFlowNode() can retrieve it from consumer custom-node components."
```

---

## Task 4: Re-export `injectNgFlowNode` and `NgFlowNodeContext` from the public API

**Goal:** Make both the helper and the type reachable from `@angflow/angular`.

**Files:**
- Modify: `packages/angular/src/lib/public-api.ts`

- [ ] **Step 1: Read the current public-api.ts**

```bash
tail -30 packages/angular/src/lib/public-api.ts
```

Note where utility exports (`applyNodeChanges`, etc.) and type re-exports live. The new additions should sit alongside them.

- [ ] **Step 2: Add the new exports**

Edit `packages/angular/src/lib/public-api.ts`. Find a section that re-exports from `./utils` (there's likely a line like `export { applyNodeChanges, ... } from './utils'`). Add `injectNgFlowNode` to that export. If no such re-export exists, add a dedicated line near the end of the file:

```typescript
export { injectNgFlowNode } from './utils/inject-ng-flow-node';
```

Also add the type re-export. Find where node-related types are re-exported (a line like `export type { Node, Edge, ... } from './types'`). Add `NgFlowNodeContext` to that. If no such line exists, add:

```typescript
export type { NgFlowNodeContext } from './types';
```

**Do not export `NG_FLOW_NODE_CONTEXT`.** The token stays internal — consumers use the helper.

- [ ] **Step 3: Typecheck + build**

```bash
cd packages/angular
npx tsc --noEmit
npm run build
```

Expected: both clean. Inspect `dist/esm/index.d.ts` after build to confirm `injectNgFlowNode` and `NgFlowNodeContext` appear in the generated declarations:

```bash
grep -E "injectNgFlowNode|NgFlowNodeContext" packages/angular/dist/esm/index.d.ts
```

Expected: at least two matches (the helper declaration + the interface re-export).

- [ ] **Step 4: Commit**

From repo root:
```bash
git add packages/angular/src/lib/public-api.ts
git commit -m "feat(angular): export injectNgFlowNode and NgFlowNodeContext publicly"
```

---

## Task 5: Add the `custom-node-inject` gallery example

**Goal:** Create a runnable example demonstrating the new API. Consumer node drops from ~40 to ~15 lines of class body.

**Files:**
- Create: `examples/angular/src/app/examples/custom-node-inject/custom-node-inject.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Create the example file**

Write `examples/angular/src/app/examples/custom-node-inject/custom-node-inject.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  BackgroundComponent,
  ControlsComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  injectNgFlowNode,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

interface EmojiData { icon: string; title: string; subtitle: string }

// Custom node using the injection-based API. Note the class body: two lines.
@Component({
  selector: 'app-emoji-inject-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="emoji-inject-node" [class.selected]="node.selected()">
      <div class="emoji-inject-node__icon">{{ node.data()?.icon ?? '*' }}</div>
      <div class="emoji-inject-node__text">
        <div class="emoji-inject-node__title">{{ node.data()?.title ?? 'Untitled' }}</div>
        <div class="emoji-inject-node__subtitle">{{ node.data()?.subtitle ?? '' }}</div>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    .emoji-inject-node {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      border: 2px solid #6366f1;
      border-radius: 10px;
      min-width: 180px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.18);
      transition: box-shadow 0.15s, transform 0.15s;
      font-family: inherit;
    }
    .emoji-inject-node.selected {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
      transform: translateY(-1px);
    }
    .emoji-inject-node__icon {
      font-size: 22px;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .emoji-inject-node__title {
      font-size: 13px;
      font-weight: 700;
      color: #312e81;
    }
    .emoji-inject-node__subtitle {
      font-size: 11px;
      color: #4f46e5;
      margin-top: 2px;
    }
  `],
})
export class EmojiInjectNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<EmojiData>();
}

@Component({
  selector: 'app-custom-node-inject-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom node (inject)"
      description="Same shape as the Custom node example but using the injectNgFlowNode() API — the recommended pattern for new code. The class body shrinks from ~13 input declarations to one injection call. See Custom node for the input-based alternative."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" [gap]="20" [size]="1" />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class CustomNodeInjectExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = {
    emojiInject: EmojiInjectNodeComponent,
  };

  nodes: Node[] = [
    { id: '1', type: 'emojiInject', position: { x: 80, y: 80 }, data: { icon: 'A', title: 'Read data', subtitle: 'from source' } },
    { id: '2', type: 'emojiInject', position: { x: 340, y: 220 }, data: { icon: 'T', title: 'Transform', subtitle: 'map + filter' } },
    { id: '3', type: 'emojiInject', position: { x: 600, y: 100 }, data: { icon: 'W', title: 'Write', subtitle: 'to destination' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3', animated: true },
  ];

  onNodesChange(changes: any[]): void {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]): void {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection): void {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
```

- [ ] **Step 2: Register the route**

Edit `examples/angular/src/app/app.routes.ts`. Find the import block near the top:

```typescript
import { TypedHandlesExampleComponent } from './examples/typed-handles/typed-handles.component';
```

Add a new import after it (or wherever imports are grouped):

```typescript
import { CustomNodeInjectExampleComponent } from './examples/custom-node-inject/custom-node-inject.component';
```

Find the `HARNESS_ROUTES` array. Find the entry for `Custom node`:

```typescript
{ name: 'Custom node',           path: 'custom-node',           component: CustomNodeExampleComponent },
```

Add the new route immediately after:

```typescript
{ name: 'Custom node (inject)',  path: 'custom-node-inject',    component: CustomNodeInjectExampleComponent },
```

- [ ] **Step 3: Typecheck the examples app**

```bash
cd examples/angular
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Build the examples app**

```bash
cd examples/angular
npm run build 2>&1 | tail -10
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 5: Commit**

From repo root:
```bash
git add examples/angular/src/app/examples/custom-node-inject/ examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add Custom node (inject) example

Demonstrates the injectNgFlowNode() API. The EmojiInjectNodeComponent
class body is two lines (Position enum + injectNgFlowNode call) compared
to ~13 signal-input declarations in the equivalent input-based example."
```

---

## Task 6: Update the existing `custom-node` example description

**Goal:** Cross-reference the new inject-based example so a consumer landing on the old one knows the new option exists.

**Files:**
- Modify: `examples/angular/src/app/examples/custom-node/custom-node.component.ts`

- [ ] **Step 1: Locate the description string**

```bash
grep -n "description=" examples/angular/src/app/examples/custom-node/custom-node.component.ts
```

Expected: one match on the `<app-example-card>` template binding.

- [ ] **Step 2: Append a cross-reference sentence**

Edit the description. Find the current text (likely something like `"Build a node from scratch with your own template and styling. Wire up source/target handles with HandleComponent."`). Append one sentence at the end:

```
This example uses signal inputs per node property; for the newer injection-based API, see Custom node (inject).
```

Full replacement — change:

```typescript
description="Build a node from scratch with your own template and styling. Wire up source/target handles with HandleComponent."
```

To:

```typescript
description="Build a node from scratch with your own template and styling. Wire up source/target handles with HandleComponent. This example uses signal inputs per node property; for the newer injection-based API, see Custom node (inject)."
```

If the actual description text differs slightly from the version above, keep whatever is already there and append the cross-reference sentence unchanged.

- [ ] **Step 3: Typecheck**

```bash
cd examples/angular
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

From repo root:
```bash
git add examples/angular/src/app/examples/custom-node/custom-node.component.ts
git commit -m "docs(examples/angular): cross-reference Custom node (inject) from the input-based example"
```

---

## Task 7: Final validation

**Goal:** Run the full automated verification matrix before calling the branch done. No files change.

No commit in this task.

- [ ] **Step 1: Full test suite across both library packages**

```bash
cd packages/system
npx vitest run 2>&1 | grep -E "(Tests|Test Files|FAIL)"
cd ../angular
npm run test 2>&1 | grep -E "(Tests|Test Files|FAIL)"
```

Expected: no FAIL lines. System tests unchanged from baseline; Angular tests = baseline + 5 new (from Task 2).

- [ ] **Step 2: Builds**

```bash
cd packages/system
npm run build
cd ../angular
npm run build
cd ../../examples/angular
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

Expected: all four commands exit 0. Examples app produces `main-*.js` + `styles-*.css` under `dist/angular-examples/`.

- [ ] **Step 3: Manual smoke — inject example**

```bash
cd examples/angular
npm run dev
```

Navigate in a browser to the Custom node (inject) example (`/custom-node-inject`). Verify:

1. Three nodes render with the expected emoji labels.
2. Drag a node — position updates smoothly, other nodes stay put, edges follow.
3. Click a node — border highlights indicating selection; `node.selected()` is wired correctly.
4. Drag a new edge between handles — connection completes.
5. Reload the page — graph renders the same starting state.

- [ ] **Step 4: Manual smoke — regression on existing examples**

Still in the dev server:

1. Open the Custom node example (input-based). Confirm it still works identically to before — node inputs flow through normally.
2. Open the Overview example. Confirm nothing regressed.
3. Open the Floating edges example. Confirm the context extension didn't break the shared per-node injector path.

- [ ] **Step 5: Decision gate**

If all checks pass, the branch is ready for `finishing-a-development-branch`. No version bump required — ships with the next natural release.

If anything fails, stop and report with specifics.

---

## Self-Review Notes

Verified against spec `docs/superpowers/specs/2026-04-21-custom-node-inject-design.md`:

- **Public API** (`injectNgFlowNode<TData>`, `NgFlowNodeContext<TData>`) → Tasks 1, 2, 4.
- **Context shape** (11 signals including grouped `position`) → Task 1 Step 3 + Task 3 Step 4.
- **Reactivity via `computed()` + `store.version()`** → Task 3 Step 4.
- **Error on misuse** → Task 2 Step 1 test + Task 2 Step 3 implementation.
- **Token stays internal** → Task 4 explicitly forbids exporting `NG_FLOW_NODE_CONTEXT`.
- **Backward compatibility** (input-based API unchanged) → implicit in Tasks 3, 6: `getNodeInputs()` is not touched; old example keeps working.
- **Caching** (`nodeContextCache`) → Task 3 Step 3, wired in Step 5.
- **Gallery example** → Task 5. Cross-reference → Task 6.
- **Testing** (5 unit tests covering happy path, misuse, reactivity, generic typing, position) → Task 2 Step 1.
- **Built-in node migration** → explicitly not done; confirmed by absence from file structure.
- **Custom edge equivalent** → explicitly not in this plan.

No placeholders. Every step has exact code or exact commands. Type names (`NgFlowNodeContext`, `NG_FLOW_NODE_CONTEXT`, `injectNgFlowNode`, `buildNodeContext`, `nodeContextCache`) used consistently across tasks.
