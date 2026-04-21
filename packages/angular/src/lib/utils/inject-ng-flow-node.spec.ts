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
