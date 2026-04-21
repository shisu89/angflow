# Custom Node API Ergonomics (`injectNgFlowNode`) — Design

**Date:** 2026-04-21
**Status:** Approved design; ready for implementation planning
**Scope:** Add a boilerplate-free, injection-based API for consumer custom-node components in `@angflow/angular`. Ships alongside the existing signal-input-based API without deprecation.

## Context

This is **Topic 1** from the broader three-topic roadmap carved out at the start of the session (custom-node ergonomics, Angular v19 upgrade, out-of-box features). The v19 upgrade has shipped; floating edges from the out-of-box bucket has shipped; read-only mode was considered and skipped. Custom-node ergonomics is the remaining pain point every consumer hits when writing their first node component.

## Problem

Registering a custom node today requires declaring ~11 signal inputs per component:

```typescript
@Component({ ... })
export class EmojiNode {
  readonly id = input.required<string>();
  readonly data = input<EmojiData>();
  readonly type = input<string>();
  readonly selected = input(false);
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<Position>();
  readonly targetPosition = input<Position>();
  readonly dragHandle = input<string>();
}
```

These inputs aren't optional in practice — the library's `NodeRendererComponent.getNodeInputs()` (`:341-364`) passes all 12 properties to `NgComponentOutlet`, and each node template often reads several of them. A typical custom node is ~40 lines of component class code before any consumer-specific content. Every new node type duplicates this boilerplate.

The boilerplate is also **untyped** for the `data` payload without extra ceremony (consumers parametrize manually with `input<MyData>()`), and it's error-prone (miss a field → silently missing state).

## Goals

- Add `injectNgFlowNode<TData>()` to `@angflow/angular`'s public API. Returns a typed context of reactive signals carrying node state.
- Drop a typical custom node's class body from ~40 lines to ~15 lines.
- Preserve backward compatibility: existing components using `input()` per property work identically. No deprecation, no removal.
- Provide the same reactive guarantees as today's input-based API — state changes flow through signals and trigger view updates.
- Type-parameterize on `TData` so consumers get `Signal<MyNodeData | undefined>` instead of `Signal<unknown>`.
- Ship a new gallery example demonstrating the new API alongside the existing input-based example.

## Non-goals

- Base-class (`class X extends NgFlowNode<T>`) or host-directive (`hostDirectives: [NgFlowNodeDirective]`) alternatives. Evaluated during brainstorming (Approaches 2/3), rejected — base class imposes inheritance penalties; host directive adds a DOM concern to a data contract.
- Changes to the custom *edge* API. Edges have similar boilerplate; if the node pattern proves out, address edges in a parallel spec.
- Deprecating, warning on, or removing the existing input-based API. Pre-1.0 library, one consumer today — keep both APIs open.
- Migrating the built-in node components (`DefaultNodeComponent`, `InputNodeComponent`, `OutputNodeComponent`, `GroupNodeComponent`) to the new API. They're 8–15 lines each; migration is polish with no user-visible benefit.
- Reactive writes back into the store via the context (no `context.data.set(...)`). The context is read-only; mutations still go through `NgFlowService` / `FlowStore`.
- A generalized "custom component context injection" pattern for non-node components (edges, panels, etc.). Each is its own spec.
- Changes to `nodeTypes` registration, `NgComponentOutlet` usage, or the node-rendering path beyond adding one provider to the per-node injector.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Where the new API lives | Public export from `@angflow/angular` | Consumer-facing; needs to be reachable from user code. |
| Shape of the helper | `injectNgFlowNode<TData>(): NgFlowNodeContext<TData>` | Matches Angular's `inject(Service)` idiom; single import. |
| Context shape | 11 signals (`id`, `data`, `type`, `selected`, `dragging`, `zIndex`, `isConnectable`, `position`, `sourcePosition`, `targetPosition`, `dragHandle`) | Mirrors existing 12 inputs; `positionAbsoluteX/Y` grouped into one `position` signal. |
| Position shape | `Signal<{ x: number; y: number }>` | No real use case for one axis without the other; grouping simplifies consumer code. |
| Reactivity | `computed()` wrappers around `store.nodeLookup.get(id)` with `store.version()` subscription | Matches the reactivity model of the existing input path. No new plumbing. |
| Backward compatibility | Additive (Approach A from brainstorming) | Pre-1.0, one consumer. Keeping both APIs costs ~15 lines of library code and eliminates migration friction. |
| Error on misuse | Throw with a specific, actionable message | Matches Angular's convention for `inject()` outside the correct context (compare `inject(ActivatedRoute)` outside a router). |
| Token exposure | `NG_FLOW_NODE_CONTEXT` is **internal** (not re-exported); only `injectNgFlowNode()` is public | Hides the token detail so consumers don't reach past the intended API. |
| Built-in node migration | Not in this spec | Saves 2–3 lines per component for no user-visible change; pure churn. |
| Custom edge equivalent | Deferred to a parallel spec | Let the node pattern settle before generalizing. |

## Public API surface

### New export

```typescript
// packages/angular/src/public-api.ts (via re-export path)
export { injectNgFlowNode } from './lib/utils/inject-ng-flow-node';
export type { NgFlowNodeContext } from './lib/types';
```

### Helper signature

```typescript
export function injectNgFlowNode<TData = unknown>(): NgFlowNodeContext<TData>;
```

Generic defaults to `unknown` when omitted. Caller asserts `TData` at call site; library does not validate at runtime (nor does the existing `NgComponentOutlet` path).

### Context interface

```typescript
export interface NgFlowNodeContext<TData = unknown> {
  /** Node id. */
  readonly id: Signal<string>;

  /** Consumer-provided data payload. Typed via TData. */
  readonly data: Signal<TData | undefined>;

  /** The node's registered type string (or 'default'). */
  readonly type: Signal<string | undefined>;

  /** True while this node is part of the current selection. */
  readonly selected: Signal<boolean>;

  /** True while this node is being dragged. */
  readonly dragging: Signal<boolean>;

  /** Stacking order computed by the library (selection elevation etc.). */
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

### Error on misuse

```
injectNgFlowNode() was called outside of a node-rendered component tree. It can only be called from components registered via nodeTypes on <ng-flow>.
```

Thrown synchronously at call time when `NG_FLOW_NODE_CONTEXT` is not in the injector chain.

### Consumer usage

```typescript
@Component({
  selector: 'app-emoji-node',
  standalone: true,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="emoji-node" [class.selected]="node.selected()">
      <div class="emoji-node__icon">{{ node.data()?.icon ?? '*' }}</div>
      <div class="emoji-node__title">{{ node.data()?.title ?? 'Untitled' }}</div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
})
export class EmojiNode {
  readonly Position = Position;
  readonly node = injectNgFlowNode<EmojiData>();
}
```

Class body: two lines. Today's equivalent is 13 lines of `readonly ... = input<...>(...)` declarations.

## Library plumbing

### Injection token

```typescript
// packages/angular/src/lib/services/tokens.ts (add alongside existing NODE_ID)
export const NG_FLOW_NODE_CONTEXT = new InjectionToken<NgFlowNodeContext<unknown>>(
  'NG_FLOW_NODE_CONTEXT',
);
```

Internal; not re-exported from the package root.

### Helper implementation

```typescript
// packages/angular/src/lib/utils/inject-ng-flow-node.ts (new file)
import { inject } from '@angular/core';
import { NG_FLOW_NODE_CONTEXT } from '../services/tokens';
import type { NgFlowNodeContext } from '../types';

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

### Context construction

`NodeRendererComponent.getNodeInjector(nodeId)` at `:307-317` already creates a per-node `Injector` with `NODE_ID`. Extend it:

```typescript
private readonly nodeContextCache = new Map<string, NgFlowNodeContext<unknown>>();

getNodeInjector(nodeId: string): Injector {
  let injector = this.nodeInjectorCache.get(nodeId);
  if (!injector) {
    const context = this.buildNodeContext(nodeId);
    this.nodeContextCache.set(nodeId, context);
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

private buildNodeContext(nodeId: string): NgFlowNodeContext<unknown> {
  const store = this.store;
  const getNode = () => {
    store.version(); // subscribe to visual-change version bump
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

Every `computed()` subscribes to `store.version()` via `getNode()`. When any node moves, resizes, or changes state, `version()` bumps and all context signals become stale; consumers reading them recompute automatically.

### Cache semantics

`nodeContextCache` mirrors `nodeInjectorCache`. One context per node id, stable for the lifetime of that node id in the store. When the node is removed from the lookup, both caches are cleared via the existing cleanup hook (verified during implementation).

## Backward compatibility & coexistence

### Existing input-based API

`NodeRendererComponent.getNodeInputs(node)` at `:341-364` continues to run unchanged. Its 12-property `Record<string, unknown>` is still passed to `NgComponentOutlet` via `[inputs]`. Consumer components declaring `readonly data = input<MyData>()` work identically.

### New context-based API

Provided via the per-node injector. Consumers call `injectNgFlowNode<T>()`. Both paths read from the same underlying `FlowStore` state — no drift possible.

### Mixed usage

A component can declare both an input and inject the context. `this.node.selected()` and `this.selected()` return identical values. Not an error; not a warning; just redundant. Consumers naturally pick one style.

### No changes required of existing consumers

The one existing consumer using the library continues to work without touching their code.

## Example refresh

### New example

Create `examples/angular/src/app/examples/custom-node-inject/custom-node-inject.component.ts`. Demonstrates `injectNgFlowNode<T>()` with a ~15-line class body. Description contrasts explicitly against the existing input-based example.

### Existing `custom-node` example

Unchanged. Its description gains one sentence: *"This example uses signal inputs; for the newer injection-based API, see Custom node (inject)."*

### Routes

```typescript
// app.routes.ts
{ name: 'Custom node',          path: 'custom-node',          component: CustomNodeExampleComponent },
{ name: 'Custom node (inject)', path: 'custom-node-inject',   component: CustomNodeInjectExampleComponent },
```

## Testing

### Unit tests

`packages/angular/src/lib/utils/inject-ng-flow-node.spec.ts` (new file):

- **Happy path** — harness provides `NG_FLOW_NODE_CONTEXT` via an injector; `injectNgFlowNode()` returns the expected context. Assert each signal emits the seeded values.
- **Misuse** — call from an injector without `NG_FLOW_NODE_CONTEXT`; assert it throws with the documented error message.
- **Reactive update** — seed a FlowStore with a node, inject the context, read `node.data()`, mutate the store's node data, assert the signal re-emits.
- **Generic typing** — compile-time assertion that `injectNgFlowNode<MyData>().data()` has type `MyData | undefined` (via tsd-style test or a manual `satisfies` assertion in the spec file).

### Integration test

Extend existing node-renderer tests (or create `node-renderer.component.spec.ts` if absent) to verify `NG_FLOW_NODE_CONTEXT` is provided on the per-node injector for a rendered custom component. Test seeds a node, renders it via the renderer, and inspects the injector's tree for the token.

### Manual smoke

The new example at `/custom-node-inject` is the manual-test surface. Load it in the gallery; confirm drag/select/connect behave identically to the input-based equivalent.

### Not tested

- Coexistence of inject-based and input-based APIs on the same component — both hit the same FlowStore, no plumbing between them.
- `nodeContextCache` internal correctness — invisible to consumers, covered indirectly by any test that reads the context.

## Rollout

Branch: `feat/custom-node-inject`.

1. **Library plumbing commit.** `NG_FLOW_NODE_CONTEXT` token, `injectNgFlowNode()` helper, `NgFlowNodeContext<TData>` interface, `buildNodeContext()` + cache + updated `getNodeInjector()` in `NodeRendererComponent`. Unit tests. Library-internal build + tests pass.
2. **Public export commit.** Re-export `injectNgFlowNode` and `NgFlowNodeContext` from the package root.
3. **New example commit.** `custom-node-inject.component.ts` + route entry.
4. *(Optional)* **Existing example doc update commit.** Appends the cross-reference line to the existing `custom-node` example's description.

No version bump. Ships with the next natural release alongside floating-edges and any other accumulated work.

## Open questions

None at design approval. Implementation-phase questions (exact cleanup hook on `nodeContextCache`, location of the unit-test harness) will be resolved in the plan.
