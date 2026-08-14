import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import type { InternalNodeUpdate, NodeChange } from '@angflow/system';
import { FlowStore } from './flow-store.service';
import type { Node } from '../types';

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

    // Emptying in place, NOT reassigning: the middleware closure registered in
    // beforeEach pushes into whatever `captured` refers to, so a fresh array
    // would still be written to — but clearing in place keeps that obvious and
    // needs no re-registration.
    captured.length = 0;

    measure(300, 200);
    const second = captured.filter((c) => c.type === 'dimensions');
    expect(second).toHaveLength(1);
    expect(second[0]).not.toMatchObject({ initial: true });
  });
});
