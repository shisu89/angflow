# injectNgFlowNode Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the four built-in node components (default, input, output, group) plus the agent-template renderer to read per-node state through `injectNgFlowNode()` instead of flat `@Input()`s. Cheapen `getNodeInputs` for components that declare zero inputs by returning a shared frozen empty object (skipping construction and inputs-identity churn). Keep the `@Input()` path fully supported for user components (no deprecation warning). Document `injectNgFlowNode` as the preferred custom-node API and ship a context-based example exercising `data`/`selected`/`isConnectable`.

**Architecture:** The per-node DI machinery already exists and runs for every node: `NodeRendererComponent.getNodeInjector(nodeId)` builds a child injector providing `NODE_ID` and `NG_FLOW_NODE_CONTEXT` (a `buildNodeContext()`-produced object of per-property `computed()` signals). `injectNgFlowNode<TData>()` reads that token. The built-ins currently ignore it and declare 13 `@Input()`s each, so `getNodeInputs`/`getDeclaredInputs` builds and filters a flat inputs object on every cache miss. This plan drops those `@Input()`s, has each built-in `injectNgFlowNode()` once, and short-circuits the inputs path to a module-level frozen `{}` when a component declares no inputs. Visual output stays pixel-identical — templates change binding sources only (`data()` → `node.data()`, etc.).

**Tech Stack:** Angular 19 zoneless (signals-only; no `NgZone`; signal reads in templates), TypeScript, Vitest via `pnpm -F @angflow/angular test`. The example app is `examples/angular` (Angular dev server via `npm run dev`).

**Part of:** 2026-06-11-deferred-work-master.md (Cluster 6). Runs last.

---

## Context audit (read before starting)

**Built-ins enumerated** from `builtInNodeTypes` in `node-renderer.component.ts` (~lines 58-63) plus the registry-resolved `TemplateNodeComponent`:

| Component | File | Current `@Input()`s |
|-----------|------|---------------------|
| `DefaultNodeComponent` | `components/nodes/default-node.component.ts` | id, data, type, selected, dragging, zIndex, isConnectable, positionAbsoluteX, positionAbsoluteY, sourcePosition, targetPosition, dragHandle |
| `InputNodeComponent` | `components/nodes/input-node.component.ts` | same 12 |
| `OutputNodeComponent` | `components/nodes/output-node.component.ts` | same 12 |
| `GroupNodeComponent` | `components/nodes/group-node.component.ts` | same 12 |
| `TemplateNodeComponent` | `components/nodes/template-node.component.ts` | same 12; also injects `FlowStore` and derives `spec`/`title`/`iconPath`/`badges`/`fields`/`bodyText`/`handles` computeds from `data()`/`type()`/`selected()` |

**Input → context-signal mapping** (every input maps to an existing `NgFlowNodeContext` signal — verified against `buildNodeContext()` lines 500-522 and the `NgFlowNodeContext` interface in `types/nodes.ts` lines 80-116):

| `@Input()` | Context read | Notes |
|-----------|--------------|-------|
| `id()` | `node.id()` | `Signal<string>` |
| `data()` | `node.data()` | typed `Signal<TData \| undefined>` |
| `type()` | `node.type()` | `Signal<string \| undefined>` |
| `selected()` | `node.selected()` | `Signal<boolean>` |
| `dragging()` | `node.dragging()` | `Signal<boolean>` |
| `zIndex()` | `node.zIndex()` | `Signal<number>` |
| `isConnectable()` | `node.isConnectable()` | `Signal<boolean>` |
| `positionAbsoluteX()` | `node.position().x` | context exposes `position: Signal<{x,y}>` |
| `positionAbsoluteY()` | `node.position().y` | same |
| `sourcePosition()` | `node.sourcePosition()` | `Signal<Position \| undefined>` |
| `targetPosition()` | `node.targetPosition()` | `Signal<Position \| undefined>` |
| `dragHandle()` | `node.dragHandle()` | `Signal<string \| undefined>` |

**Context gaps:** NONE. The five built-ins only ever read `data`, `selected`, `isConnectable`, and `type` in their templates/computeds — all present. `buildNodeContext()` does **not** need extending. (`positionAbsoluteX/Y`, `sourcePosition`, `targetPosition`, `dragHandle`, `id`, `dragging`, `zIndex` are declared inputs today but unused in any built-in template; they're dropped, not re-read.)

**Specs that drive inputs directly** (must be updated — they set `@Input()`s the migrated component no longer declares):
- `container/node-renderer/node-renderer.component.spec.ts` — `getNodeInputs` tests reference `DefaultNodeComponent`/`InputNodeComponent` and assert the inputs object's `isConnectable`. After migration those built-ins declare zero inputs, so `getNodeInputs` short-circuits to the shared empty object. These tests are re-pointed at a fixture component that *does* declare inputs (legacy back-compat) and at the context signals (Task 7).
- `components/nodes/template-node.component.spec.ts` — uses `fixture.componentRef.setInput('id'|'type'|'data', ...)`. After migration `TemplateNodeComponent` reads context, so `setInput` no longer drives it. Updated to provide `NG_FLOW_NODE_CONTEXT` via a stub (Task 5).

---

### Task 1: Convert DefaultNodeComponent, InputNodeComponent, OutputNodeComponent to injectNgFlowNode

**Files:**
- `packages/angular/src/lib/components/nodes/default-node.component.ts`
- `packages/angular/src/lib/components/nodes/input-node.component.ts`
- `packages/angular/src/lib/components/nodes/output-node.component.ts`

These three share an identical input surface and only read `data()` (label text) and `isConnectable()` (handle wiring). Convert all three in one task.

- [ ] Replace the full contents of `default-node.component.ts` with:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@angflow/system';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in node renderer with a target handle on top and a source handle on
 * bottom. Used when a node has no `type` or `type: 'default'`. Reads per-node
 * state through `injectNgFlowNode()` (no `@Input()`s).
 */
@Component({
  selector: 'ng-flow-default-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div>{{ node.data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
})
export class DefaultNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<{ label?: string } & Record<string, unknown>>();
}
```

- [ ] Replace the full contents of `input-node.component.ts` with:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@angflow/system';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in node renderer with only a source handle on the bottom.
 * Used when a node has `type: 'input'`. Reads per-node state through
 * `injectNgFlowNode()` (no `@Input()`s).
 */
@Component({
  selector: 'ng-flow-input-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>{{ node.data()?.label }}</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
})
export class InputNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<{ label?: string } & Record<string, unknown>>();
}
```

- [ ] Replace the full contents of `output-node.component.ts` with:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HandleComponent } from '../handle/handle.component';
import { Position } from '@angflow/system';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in node renderer with only a target handle on the top.
 * Used when a node has `type: 'output'`. Reads per-node state through
 * `injectNgFlowNode()` (no `@Input()`s).
 */
@Component({
  selector: 'ng-flow-output-node',
  standalone: true,
  imports: [HandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div>{{ node.data()?.label }}</div>
  `,
})
export class OutputNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<{ label?: string } & Record<string, unknown>>();
}
```

- [ ] Type-check: `pnpm -F @angflow/angular exec tsc --noEmit`
- [ ] Build: `pnpm -F @angflow/angular build`
- [ ] Commit:

```
refactor(angular): default/input/output nodes read injectNgFlowNode context

Drop the 12 flat @Input()s on the default, input, and output built-in nodes;
read data and isConnectable from the per-node injectNgFlowNode() context.
Template output is pixel-identical (binding sources only). The @Input() path
stays supported for user components.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 2: Convert GroupNodeComponent to injectNgFlowNode

**Files:**
- `packages/angular/src/lib/components/nodes/group-node.component.ts`

`GroupNodeComponent` has an empty template and reads nothing from its inputs — it only sizes itself via the host style. It still must drop its `@Input()`s so the short-circuit applies. It does not need to call `injectNgFlowNode()` at all (it reads no context), but call it for consistency and to keep the DI contract obvious; the call is cheap (a single `inject`).

- [ ] Replace the full contents of `group-node.component.ts` with:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';

/**
 * Built-in container node used for sub-flows. No handles and no label —
 * other nodes parent to it via `parentId` and optionally constrain movement
 * with `extent: 'parent'`. Reads per-node state through `injectNgFlowNode()`
 * (no `@Input()`s); the renderer applies width/height/transform on the host
 * wrapper, so the group body itself just fills its box.
 */
@Component({
  selector: 'ng-flow-group-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'style': 'width: 100%; height: 100%;',
  },
  template: ``,
})
export class GroupNodeComponent {
  readonly node = injectNgFlowNode();
}
```

- [ ] Type-check: `pnpm -F @angflow/angular exec tsc --noEmit`
- [ ] Build: `pnpm -F @angflow/angular build`
- [ ] Commit:

```
refactor(angular): group node drops @Input()s for injectNgFlowNode context

The group container reads no per-node fields in its template, but dropping its
flat @Input()s lets the renderer short-circuit its inputs object. Pixel-identical
output (empty body sized by the host wrapper).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 3: Convert TemplateNodeComponent to injectNgFlowNode

**Files:**
- `packages/angular/src/lib/components/nodes/template-node.component.ts`

`TemplateNodeComponent` is the agent-bridge data-driven renderer. It already injects `FlowStore` and derives `spec`/`title`/`iconPath`/`badges`/`fields`/`bodyText`/`handles` computeds from `this.data()`, `this.type()`, `this.selected()`, `this.isConnectable()`. Migration: add `injectNgFlowNode()`, repoint those four reads at the context, drop the 12 `@Input()`s. The template, styles, icon map, position map, and helper computeds are unchanged except for the three direct context reads in the template (`selected()` → `node.selected()`, `isConnectable()` → `node.isConnectable()`).

- [ ] Edit the class to inject the context and drop the inputs. Replace the imports/class-head region. Change the top import line:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
```

(removed `input` — no longer used.)

- [ ] Add the inject helper import alongside the existing imports (after the `template-interpolation` import block):

```typescript
import { injectNgFlowNode } from '../../utils/inject-ng-flow-node';
```

- [ ] In the template, change the two direct context reads (leave everything else byte-identical):
  - `[class.ng-flow__template-node--selected]="selected()"` → `[class.ng-flow__template-node--selected]="node.selected()"`
  - `[isConnectable]="isConnectable()"` → `[isConnectable]="node.isConnectable()"`

- [ ] Replace the class body's input block (the 12 `input(...)` lines, `readonly id` through `readonly dragHandle`) with the context injection, and repoint the computeds at `this.node`:

```typescript
export class TemplateNodeComponent {
  private readonly store = inject(FlowStore);
  readonly node = injectNgFlowNode<Record<string, unknown>>();

  readonly spec = computed(() => this.store.nodeTemplates().get(this.node.type() ?? ''));

  readonly title = computed(() =>
    interpolateTemplateString(this.spec()?.title ?? '', this.node.data()),
  );

  readonly iconPath = computed(() => {
    const icon = this.spec()?.icon;
    return icon ? ICONS[icon] ?? null : null;
  });

  readonly badges = computed(() =>
    (this.spec()?.badges ?? [])
      .filter((b) => isTemplateConditionTrue(b.showIf, this.node.data()))
      .map((b) => ({
        text: interpolateTemplateString(b.text, this.node.data()),
        color: BADGE_COLORS.has(b.color as NodeTemplateBadgeColor) ? b.color! : 'slate',
      })),
  );

  readonly fields = computed(() =>
    (this.spec()?.fields ?? [])
      .filter((f) => isTemplateConditionTrue(f.showIf, this.node.data()))
      .map((f) => ({ label: f.label, value: interpolateTemplateString(f.value, this.node.data()) })),
  );

  readonly bodyText = computed(() =>
    interpolateTemplateString(this.spec()?.body ?? '', this.node.data()),
  );

  readonly handles = computed(() => {
    const declared = this.spec()?.handles ?? [
      { type: 'target' as const, position: 'left' as const },
      { type: 'source' as const, position: 'right' as const },
    ];
    return declared.map((h) => ({
      type: h.type,
      id: h.id,
      position: POSITION_MAP[h.position ?? (h.type === 'target' ? 'left' : 'right')],
    }));
  });
}
```

> Note: `interpolateTemplateString`/`isTemplateConditionTrue` accept `unknown`/`Record<string, unknown>` data; the context's `data()` is `Record<string, unknown> | undefined`, matching the prior `input<any>()`. Verify no `tsc` error; if the helper signatures reject `undefined`, the call sites already passed possibly-undefined `data()` before, so no change is needed.

- [ ] Type-check: `pnpm -F @angflow/angular exec tsc --noEmit`
- [ ] Build: `pnpm -F @angflow/angular build`
- [ ] Commit:

```
refactor(angular): template node reads injectNgFlowNode context

The agent-bridge data-driven renderer derives spec/title/badges/fields from the
per-node context instead of flat @Input()s. Interpolation, icon map, and handle
derivation are unchanged. Pixel-identical output.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 4: Short-circuit getNodeInputs for zero-input components

**Files:**
- `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts`

After Tasks 1-3, all five resolvable built-ins declare zero inputs. `getDeclaredInputs` returns an empty `Set` for them (not `null` — `reflectComponentType` succeeds with `inputs: []`). The short-circuit: when the declared set is empty, return a module-level frozen `{}` and skip building/filtering `allInputs` entirely. The C2 cache entry still stores `{key, data, inputs}` so the existing reference-compare fast-path holds — but `inputs` becomes the shared frozen object, so the reference returned is stable across recomputes (no thrash) and identical across nodes.

Interaction with the C2 cache (`{key, data, inputs}`):
- The cache is keyed per node id. On a hit (`cached.key === key && cached.data === node.data`) the cached `inputs` is returned unchanged — for a zero-input component that's the shared frozen `{}`.
- On a miss we recompute the key, detect the empty declared set, store `{key, data: node.data, inputs: EMPTY_INPUTS}`, and return `EMPTY_INPUTS`. Because `EMPTY_INPUTS` is a module constant, two successive misses (e.g. a position change that bumps the key) still return the same object reference — the identity is stable regardless of cache state. This is the property the Task 7 identity-stability test pins.
- `ngComponentOutlet` with `inputs: {}` (frozen, empty) sets no inputs — correct for a zero-input component (matches today's `Object.fromEntries(...filter(empty set))` which also produced `{}`, just a fresh one each miss).
- The `declared === null` branch (reflection failed — defensive) keeps passing the full `allInputs`, unchanged.

- [ ] Add a module-level frozen empty object near `computeNodeInputsKey` (top of file, after the existing `builtInNodeTypes` const):

```typescript
/**
 * Shared inputs object for components that declare zero @Input()s (every
 * built-in after the injectNgFlowNode migration). Returning one frozen instance
 * keeps ngComponentOutlet's inputs reference stable across recomputes — no
 * per-render object churn, no cache thrash — and provides nothing to set.
 */
const EMPTY_INPUTS: Readonly<Record<string, unknown>> = Object.freeze({});
```

- [ ] Replace the body of `getNodeInputs` (the region from `const allInputs` through `return inputs;`) so the empty-declared-set case short-circuits before building `allInputs`. The full method becomes:

```typescript
  getNodeInputs(node: InternalNode): Record<string, unknown> {
    const nodesConnectable = this.store.nodesConnectable();
    const isTemplate = this.store.nodeTemplates().has(node.type ?? 'default');
    // Per-node key: a global version bump (every drag frame) must not
    // invalidate all N nodes' inputs — only fields this node's inputs
    // actually read. The template stays version-reactive via visibleNodes().
    const key = computeNodeInputsKey(node, nodesConnectable, isTemplate);
    const cached = this.nodeInputsCache.get(node.id);
    if (cached && cached.key === key && cached.data === node.data) {
      return cached.inputs;
    }

    // Short-circuit: components that declare no @Input()s (all built-ins use
    // injectNgFlowNode()) get the shared frozen empty object — skip building
    // and filtering allInputs entirely. We still seed the cache entry so the
    // key/data reference-compare fast-path holds; inputs is the shared object,
    // so the returned reference is identity-stable across recomputes (no thrash).
    const declared = this.getDeclaredInputs(this.getNodeComponent(node.type));
    if (declared && declared.size === 0) {
      this.nodeInputsCache.set(node.id, { key, data: node.data, inputs: EMPTY_INPUTS });
      return EMPTY_INPUTS;
    }

    const allInputs: Record<string, unknown> = {
      id: node.id,
      data: node.data,
      type: node.type,
      selected: node.selected ?? false,
      dragging: node.dragging ?? false,
      zIndex: node.internals?.z ?? 0,
      isConnectable: node.connectable ?? nodesConnectable,
      positionAbsoluteX: node.internals?.positionAbsolute?.x ?? node.position.x,
      positionAbsoluteY: node.internals?.positionAbsolute?.y ?? node.position.y,
      sourcePosition: node.sourcePosition,
      targetPosition: node.targetPosition,
      dragHandle: node.dragHandle,
    };

    // Only push keys the target component actually declares as inputs.
    // declared === null means reflection failed (defensive) — pass everything.
    const inputs: Record<string, unknown> = declared
      ? Object.fromEntries(Object.entries(allInputs).filter(([k]) => declared.has(k)))
      : allInputs;

    this.nodeInputsCache.set(node.id, { key, data: node.data, inputs });
    return inputs;
  }
```

> The `EMPTY_INPUTS` entry stored in the cache is `Readonly<...>`; the cache field type is `Record<string, unknown>`. `Object.freeze` returns `Readonly<T>` which is assignable to `Record<string, unknown>` for the return type (frozen object is structurally a `Record`). If `tsc` complains about the cache value type, widen the literal at the call site: `inputs: EMPTY_INPUTS as Record<string, unknown>`. Verify and apply only if needed.

- [ ] Type-check: `pnpm -F @angflow/angular exec tsc --noEmit`
- [ ] Build: `pnpm -F @angflow/angular build`
- [ ] Commit:

```
perf(angular): getNodeInputs short-circuits zero-input components

Components that declare no @Input()s (every built-in after the injectNgFlowNode
migration) now return a module-level frozen empty object, skipping allInputs
construction and filtering. The C2 cache entry stores the shared object, so the
inputs reference is identity-stable across recomputes — no churn, no thrash.
User components with @Input()s are unaffected.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 5: Update TemplateNodeComponent spec to drive context

**Files:**
- `packages/angular/src/lib/components/nodes/template-node.component.spec.ts`

The spec's `mount()` helper drives the component via `setInput('id'|'type'|'data', ...)`. After Task 3 the component reads `NG_FLOW_NODE_CONTEXT`, so `setInput` no longer feeds it (and `id` is no longer a declared input — `setInput` would throw NG0303). Update `mount()` to provide a stub context via the per-node injector token. Keep every assertion identical — they test rendered output, which is the pixel-parity net.

- [ ] Add an import for the context token and signal at the top of the file (after the existing `NODE_ID` import):

```typescript
import { signal } from '@angular/core';
import { NG_FLOW_NODE_CONTEXT } from '../../services/tokens';
import type { NgFlowNodeContext } from '../../types';
import { Position } from '@angflow/system';
```

- [ ] Replace the `mount()` helper so it provides a stubbed `NgFlowNodeContext` (writable signals so individual tests can later flip `selected`, though current tests don't):

```typescript
function makeContext(
  data: Record<string, unknown>,
  type: string,
): NgFlowNodeContext<Record<string, unknown>> {
  return {
    id: signal('n1'),
    data: signal<Record<string, unknown> | undefined>(data),
    type: signal<string | undefined>(type),
    selected: signal(false),
    dragging: signal(false),
    zIndex: signal(0),
    isConnectable: signal(true),
    position: signal({ x: 0, y: 0 }),
    sourcePosition: signal<Position | undefined>(undefined),
    targetPosition: signal<Position | undefined>(undefined),
    dragHandle: signal<string | undefined>(undefined),
    collapsed: signal(false),
  };
}

function mount(
  spec: NodeTemplateSpec,
  data: Record<string, unknown>,
): { fixture: ComponentFixture<TemplateNodeComponent>; el: HTMLElement; store: FlowStore } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      FlowStore,
      NgFlowService,
      { provide: NODE_ID, useValue: 'n1' },
      { provide: NG_FLOW_NODE_CONTEXT, useValue: makeContext(data, 'service') },
    ],
  });
  const store = TestBed.inject(FlowStore);
  store.nodeTemplates.set(new Map([['service', spec]]));
  const fixture = TestBed.createComponent(TemplateNodeComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, store };
}
```

> The `data` param feeds `makeContext`; the third `makeContext` arg is fixed `'service'` to match `store.nodeTemplates` keyed on `'service'` (the spec's existing convention). Drop the three `setInput` lines — they're replaced by the context provider.

- [ ] Run the spec: `pnpm -F @angflow/angular test -- template-node.component.spec.ts`
- [ ] All existing assertions must pass unchanged.
- [ ] Commit:

```
test(angular): template-node spec drives context, not @Input()s

After the injectNgFlowNode migration TemplateNodeComponent reads
NG_FLOW_NODE_CONTEXT; the spec provides a stub context instead of setInput().
Assertions (rendered output) are unchanged — the pixel-parity net holds.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 6: Add context-rendering + live-update test for a built-in (TDD net)

**Files:**
- `packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts`

Add a new `describe` block that mounts the full `NodeRendererComponent` with a default node and asserts the built-in renders its label from context and live-updates when `data`/`selected` change through the per-node injector. This is the integration net that the per-component unit specs can't give (it exercises the real `getNodeInjector` → `injectNgFlowNode` path end to end). Use the existing ResizeObserver/MutationObserver stubs pattern from the `entry animation tracking` block.

- [ ] Append this `describe` block to the spec file:

```typescript
describe('built-in node renders + live-updates through the per-node injector', () => {
  let store: FlowStore;
  let fixture: ComponentFixture<NodeRendererComponent>;

  beforeEach(() => {
    if (typeof (globalThis as any).ResizeObserver === 'undefined') {
      (globalThis as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (typeof (globalThis as any).MutationObserver === 'undefined') {
      (globalThis as any).MutationObserver = class {
        observe() {}
        disconnect() {}
      };
    }
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    fixture = TestBed.createComponent(NodeRendererComponent);
  });

  it('renders the default node label from context data', async () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Alpha' }, type: 'default' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alpha');
  });

  it('live-updates the label when data changes (no input rebind)', async () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Alpha' }, type: 'default' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Beta' }, type: 'default' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Beta');
    expect(el.textContent).not.toContain('Alpha');
  });

  it('reflects selected state on the node wrapper through the store', async () => {
    store.elementsSelectable.set(true);
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Alpha' }, type: 'default' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    store.addSelectedNodes(['n1']);
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = (fixture.nativeElement as HTMLElement).querySelector('.xy-flow__node');
    expect(wrapper?.classList.contains('selected')).toBe(true);
  });
});
```

> `selected` is asserted on the renderer's own `.xy-flow__node` wrapper (`[class.selected]="node.selected"` in the renderer template) rather than inside the default node body, since `DefaultNodeComponent` has no selected-dependent markup — the parity point is that the store-driven selection propagates, which is what the context's `selected()` signal also reads. (The context `selected()` path itself is already covered by the existing `getNodeInjector` describe at lines 65-90.)

- [ ] Run: `pnpm -F @angflow/angular test -- node-renderer.component.spec.ts`
- [ ] Commit:

```
test(angular): built-in renders + live-updates through per-node injector

End-to-end net for the injectNgFlowNode migration: a default node mounted via
NodeRendererComponent renders its label from context data and re-renders when
the store's data/selected change — exercising the real getNodeInjector path.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 7: Short-circuit identity-stability + legacy @Input() back-compat tests; repoint moved input specs

**Files:**
- `packages/angular/src/lib/container/node-renderer/node-renderer.component.spec.ts`

Two new pins plus repointing the pre-existing `getNodeInputs` tests that relied on built-ins declaring inputs.

**7a — repoint the existing `getNodeInputs / context isConnectable` block.** After Task 4, `DefaultNodeComponent` declares zero inputs, so `getNodeInputs(internal)['isConnectable']` is `undefined` (short-circuited to `EMPTY_INPUTS`). The two `getNodeInputs.isConnectable*` tests must change subject. Replace them with assertions against a legacy fixture component that *does* declare inputs (the back-compat path), keeping the third `context.isConnectable` test as-is.

- [ ] Add a legacy fixture component at the top of the spec file (after imports):

```typescript
import { Component, input } from '@angular/core';

// A user component on the legacy @Input() path — the back-compat pin. It still
// receives flat inputs from getNodeInputs (declared set is non-empty), so the
// short-circuit must NOT apply to it.
@Component({
  selector: 'app-legacy-input-node',
  standalone: true,
  template: `{{ data()?.label }}`,
})
class LegacyInputNodeComponent {
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly isConnectable = input(true);
}
```

- [ ] In the `getNodeInputs / context isConnectable` describe, replace the two `getNodeInputs.isConnectable*` tests with legacy-fixture versions that register the component via `customNodeTypes` so `getNodeComponent` resolves it:

```typescript
  it('LEGACY @Input() node still receives isConnectable from store.nodesConnectable', () => {
    const fixture = TestBed.createComponent(NodeRendererComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('customNodeTypes', { legacy: LegacyInputNodeComponent });
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'legacy' } as Node]);
    const internal = store.nodeLookup.get('n1')!;

    store.nodesConnectable.set(true);
    expect(comp.getNodeInputs(internal)['isConnectable']).toBe(true);

    store.nodesConnectable.set(false);
    expect(comp.getNodeInputs(internal)['isConnectable']).toBe(false);
  });

  it('LEGACY @Input() node honors per-node connectable override', () => {
    const fixture = TestBed.createComponent(NodeRendererComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('customNodeTypes', { legacy: LegacyInputNodeComponent });
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'legacy', connectable: false } as Node,
    ]);
    const internal = store.nodeLookup.get('n1')!;

    store.nodesConnectable.set(true);
    expect(comp.getNodeInputs(internal)['isConnectable']).toBe(false);
  });
```

> These use a fresh `fixture.componentInstance` so `customNodeTypes` is wired; the block's `component` field (from `beforeEach`) lacks the custom type registration. Leave the existing `context.isConnectable is reactive` test untouched.

**7b — short-circuit identity-stability pin.** A zero-input built-in's inputs object is the shared frozen instance, identity-stable across recomputes and across nodes.

- [ ] Append a new describe:

```typescript
describe('getNodeInputs short-circuit (zero-input components)', () => {
  let store: FlowStore;
  let component: NodeRendererComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    component = TestBed.createComponent(NodeRendererComponent).componentInstance;
  });

  it('returns a frozen empty object for a built-in (zero declared inputs)', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const inputs = component.getNodeInputs(store.nodeLookup.get('n1')!);
    expect(Object.keys(inputs)).toHaveLength(0);
    expect(Object.isFrozen(inputs)).toBe(true);
  });

  it('returns the SAME shared object across a key-changing recompute (identity-stable)', () => {
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' }]);
    const before = component.getNodeInputs(store.nodeLookup.get('n1')!);
    // A position change bumps the cache key -> recompute path, but the
    // short-circuit returns the shared frozen object, so identity is stable.
    store.triggerNodeChanges([
      { id: 'n1', type: 'position', position: { x: 30, y: 40 }, dragging: true },
    ] as never);
    const after = component.getNodeInputs(store.nodeLookup.get('n1')!);
    expect(after).toBe(before);
  });

  it('shares one object across two different built-in nodes', () => {
    store.setNodes([
      { id: 'n1', position: { x: 0, y: 0 }, data: {}, type: 'default' },
      { id: 'n2', position: { x: 100, y: 0 }, data: {}, type: 'input' },
    ]);
    const a = component.getNodeInputs(store.nodeLookup.get('n1')!);
    const b = component.getNodeInputs(store.nodeLookup.get('n2')!);
    expect(a).toBe(b);
  });
});
```

> Note: the pre-existing `getNodeInputs cache keying` describe (lines 290-345) sets `type: 'default'` and asserts `.not.toBe(before)` on position/selection/data changes. After Task 4 those built-ins short-circuit, so those PERF/REGRESSION assertions would flip to `.toBe`. Repoint that entire describe at `LegacyInputNodeComponent` (register via `customNodeTypes` and use `type: 'legacy'`) so it keeps testing the *construction* path it was written for. Apply this in the same task — update each of the six tests in that block to register the legacy fixture and use `type: 'legacy'`.

- [ ] Rewrite the `getNodeInputs cache keying (per-node, not global version)` describe so each test registers the legacy fixture. The `beforeEach` becomes:

```typescript
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NodeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    const fixture = TestBed.createComponent(NodeRendererComponent);
    fixture.componentRef.setInput('customNodeTypes', { legacy: LegacyInputNodeComponent });
    component = fixture.componentInstance;
  });
```

  and every `type: 'default'` in that block's `setNodes` calls becomes `type: 'legacy'` (so the node resolves to the input-declaring fixture and the construction/cache path stays exercised). The assertions (`.toBe` / `.not.toBe`) are unchanged.

- [ ] Run: `pnpm -F @angflow/angular test -- node-renderer.component.spec.ts`
- [ ] Commit:

```
test(angular): pin short-circuit identity + legacy @Input() back-compat

New pins: zero-input built-ins return one frozen shared inputs object that is
identity-stable across key-changing recomputes and across nodes. The pre-existing
getNodeInputs construction/cache tests are repointed at a legacy @Input() fixture
(the back-compat path) so they keep exercising object construction.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 8: Document injectNgFlowNode as the preferred custom-node API

**Files:**
- `packages/angular/README.md`

The README's `## Custom Nodes` section (lines ~119-165) currently shows the `@Input()` pattern. Lead with `injectNgFlowNode`, then document the `@Input()` path as supported-but-legacy. No deprecation warning (explicitly decided against this round).

- [ ] Replace the `## Custom Nodes` section body (from the line after the `## Custom Nodes` heading through the `<ng-flow [nodes]=... [nodeTypes]=...>` html block, i.e. everything up to but not including `## Programmatic API`) with:

````markdown
Create any Angular component and register it as a node type. The preferred way to read per-node state is `injectNgFlowNode<TData>()`, which returns reactive read-only signals for every property the library tracks (`id`, `data`, `selected`, `dragging`, `zIndex`, `isConnectable`, `position`, `sourcePosition`, `targetPosition`, `dragHandle`, `type`, `collapsed`). Use the `nodrag` CSS class on interactive elements (inputs, dropdowns) to prevent drag interference.

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  HandleComponent,
  Position,
  NgFlowService,
  injectNgFlowNode,
} from '@angflow/angular';

interface FormData { title: string; name: string; type: string }

@Component({
  selector: 'app-form-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div class="my-node" [class.selected]="node.selected()">
      <h3>{{ node.data()?.title }}</h3>
      <div class="nodrag">
        <input [value]="node.data()?.name" (input)="onNameChange($event)" />
        <select [value]="node.data()?.type" (change)="onTypeChange($event)">
          <option value="string">String</option>
          <option value="number">Number</option>
        </select>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
})
export class FormNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<FormData>();

  private flowService = inject(NgFlowService);

  onNameChange(event: Event) {
    this.flowService.updateNodeData(this.node.id(), {
      name: (event.target as HTMLInputElement).value,
    });
  }

  onTypeChange(event: Event) {
    this.flowService.updateNodeData(this.node.id(), {
      type: (event.target as HTMLSelectElement).value,
    });
  }
}
```

Register it:

```typescript
nodeTypes = { formNode: FormNodeComponent };
```

```html
<ng-flow [nodes]="nodes" [edges]="edges" [nodeTypes]="nodeTypes" ...>
```

#### Legacy: flat `@Input()`s

The original API — declaring one `@Input()` per tracked property — is still fully supported, so existing custom nodes keep working without changes:

```typescript
export class FormNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<FormData>();
  readonly selected = input(false);
  readonly isConnectable = input(true);
  // ...plus type, dragging, zIndex, positionAbsoluteX/Y,
  //    sourcePosition, targetPosition, dragHandle as needed
}
```

Prefer `injectNgFlowNode()` for new code: one injection call replaces ~13 input declarations, the signals are reactive in the same way, and you only pull the fields you actually use.
````

- [ ] Verify the section renders (eyeball the markdown; no build step for README). Confirm the `## Programmatic API` heading immediately follows.
- [ ] Commit:

```
docs(angular): present injectNgFlowNode as the preferred custom-node API

README Custom Nodes section leads with injectNgFlowNode() and documents the
flat @Input() path as supported-but-legacy (no deprecation warning).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 9: Example node exercising data + selected + isConnectable

**Files:**
- `examples/angular/src/app/examples/custom-node-inject/custom-node-inject.component.ts`

A `custom-node-inject` example already exists and uses `injectNgFlowNode`, exercising `data()` and `selected()`. The spec requires the example to also exercise `isConnectable()`. Extend the existing node to bind `node.isConnectable()` on its handles (and dim them when connection is disabled) so all three signals are demonstrated, and add a node with `connectable: false` to make the difference visible.

- [ ] In the `EmojiInjectNodeComponent` template, bind `isConnectable` on both handles and reflect it visually:

```typescript
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div
      class="emoji-inject-node"
      [class.selected]="node.selected()"
      [class.not-connectable]="!node.isConnectable()"
    >
      <div class="emoji-inject-node__icon">{{ node.data()?.icon ?? '*' }}</div>
      <div class="emoji-inject-node__text">
        <div class="emoji-inject-node__title">{{ node.data()?.title ?? 'Untitled' }}</div>
        <div class="emoji-inject-node__subtitle">{{ node.data()?.subtitle ?? '' }}</div>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
```

- [ ] Add a style for the new class to the component's `styles` array (append inside the existing backtick block, before its closing backtick):

```css
    .emoji-inject-node.not-connectable {
      border-style: dashed;
      opacity: 0.85;
    }
```

- [ ] Add a fourth, non-connectable node and update the description so the example clearly exercises `data`, `selected`, and `isConnectable`:

```typescript
  nodes: Node[] = [
    { id: '1', type: 'emojiInject', position: { x: 80, y: 80 }, data: { icon: 'A', title: 'Read data', subtitle: 'from source' } },
    { id: '2', type: 'emojiInject', position: { x: 340, y: 220 }, data: { icon: 'T', title: 'Transform', subtitle: 'map + filter' } },
    { id: '3', type: 'emojiInject', position: { x: 600, y: 100 }, data: { icon: 'W', title: 'Write', subtitle: 'to destination' } },
    { id: '4', type: 'emojiInject', position: { x: 340, y: 380 }, connectable: false, data: { icon: 'L', title: 'Locked', subtitle: 'connectable: false' } },
  ];
```

- [ ] Update the `<app-example-card>` description to mention all three signals:

```
description="Custom node built with the injectNgFlowNode() API — the recommended pattern for new code. Reads node.data() (icon/title/subtitle), node.selected() (lift on selection), and node.isConnectable() (the 'Locked' node sets connectable: false, dimming its dashed handles). The class body is one injection call instead of ~13 input declarations."
```

- [ ] Build the library so the example resolves the new code: `pnpm -F @angflow/system build && pnpm -F @angflow/angular build`
- [ ] Smoke instructions (manual): from repo root run `pnpm -F angular-examples dev` (or `npm run dev` in `examples/angular`), open the dev URL, navigate to the **Custom node (inject)** route (`/custom-node-inject`). Verify:
  - the three emoji cards render their icon/title/subtitle (exercises `data()`),
  - clicking a card lifts it and adds the selected shadow (exercises `selected()`),
  - dragging from a normal card's bottom handle starts a connection, while the **Locked** card's handles are dashed/dimmed and do not start a connection (exercises `isConnectable()`),
  - dragging a card moves it live with no console errors.
- [ ] Commit:

```
docs(example): custom-node-inject exercises data, selected, isConnectable

The injectNgFlowNode example now binds node.isConnectable() on its handles and
adds a connectable:false "Locked" node, so the example demonstrates all three
of the spec's required context signals.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 10: Cluster gate — full suite + typecheck + lint

**Files:** none (verification only).

- [ ] System build (built-ins depend on `@angflow/system` types): `pnpm -F @angflow/system build`
- [ ] Angular build: `pnpm -F @angflow/angular build`
- [ ] Angular tests: `pnpm -F @angflow/angular test`
- [ ] MCP tests (must not need snapshot regen — no tool-schema change): `pnpm -F @angflow/mcp test`
- [ ] Typecheck workspace: `pnpm typecheck`
- [ ] Lint workspace: `pnpm lint`
- [ ] Example builds: `pnpm -F angular-examples build` (confirm the converted example compiles against the built library)
- [ ] Confirm no `NgZone` import was introduced and every template binding is a signal read (grep the touched files).
- [ ] No commit (verification only). If any step fails, fix in the owning task's file and re-run from that task.

---

## Self-review

- **Coverage vs spec:** built-in migration (Tasks 1-3, all five resolvable components incl. TemplateNode); short-circuit with C2-cache interaction described and implemented (Task 4); docs preferred/legacy no-deprecation (Task 8); example with data+selected+isConnectable (Task 9); tests — context render + live-update (Task 6), short-circuit identity stability (Task 7b), legacy @Input() back-compat pin (Task 7a/7b legacy fixture), updated specs that drove inputs directly named explicitly (template-node spec Task 5; node-renderer getNodeInputs/cache-keying blocks Task 7). All spec "Testing" bullets covered.
- **Placeholders:** none — every converted component is given in full; no "similar to".
- **Type consistency:** built-in `data()` typed `{ label?: string } & Record<string, unknown>` to match `data()?.label` usage; TemplateNode `data()` typed `Record<string, unknown>` matching the interpolation helpers' prior `any` input; `EMPTY_INPUTS` frozen-object/`Record` assignability flagged with a fallback cast; stub context in Task 5 lists all 12 `NgFlowNodeContext` members with correct signal types.
- **Zoneless:** no `NgZone`; all template reads are signal calls; no timer-driven CD. Gate (Task 10) re-checks.
- **Context gaps:** none — `buildNodeContext()` is not extended (audit confirmed every used field exists).
