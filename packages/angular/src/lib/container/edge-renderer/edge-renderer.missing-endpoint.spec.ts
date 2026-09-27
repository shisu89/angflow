import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ConnectionMode, Position, type Handle } from '@angflow/system';
import { EdgeRendererComponent } from './edge-renderer.component';
import { FlowStore } from '../../services/flow-store.service';
import { resetDevWarnDedupe } from '../../utils/dev-warn';
import type { Node } from '../../types';

const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function handle(id: string | null, type: 'source' | 'target', position: Position, x: number, y: number): Handle {
  return { id, type, position, x, y, width: 10, height: 10, nodeId: '' };
}

describe('EdgeRendererComponent — edges with unresolvable endpoints (React parity)', () => {
  let store: FlowStore;
  let component: EdgeRendererComponent;

  const node = (id: string, x: number): Node => ({ id, position: { x, y: 0 }, data: {} });

  /** Give a node measured handle bounds, as updateNodeInternals would. */
  function measure(id: string, source: Handle[], target: Handle[]): void {
    const n = store.nodeLookup.get(id)!;
    n.measured = { width: 100, height: 40 };
    n.internals.handleBounds = { source, target };
    store.bumpVersion();
  }

  beforeEach(() => {
    resetDevWarnDedupe();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EdgeRendererComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    component = TestBed.createComponent(EdgeRendererComponent).componentInstance;
  });

  it('skips an edge whose source or target node does not exist (no 0,0 edge)', () => {
    store.setNodes([node('a', 0), node('b', 300)]);
    store.setEdges([
      { id: 'ok', source: 'a', target: 'b' },
      { id: 'no-source', source: 'ghost', target: 'b' },
      { id: 'no-target', source: 'a', target: 'ghost' },
    ]);
    expect(component.renderedEdges().map((e) => e.id)).toEqual(['ok']);
  });

  it('renders the edge once the missing node appears', () => {
    store.setNodes([node('a', 0)]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b' }]);
    expect(component.renderedEdges()).toHaveLength(0);
    store.setNodes([node('a', 0), node('b', 300)]);
    expect(component.renderedEdges().map((e) => e.id)).toEqual(['e']);
  });

  it('skips an edge naming a handle id the measured node lacks and reports error008 once', async () => {
    const onError = vi.fn();
    store.onError.set(onError);
    store.setNodes([node('a', 0), node('b', 300)]);
    measure('a', [handle('out', 'source', Position.Right, 90, 15)], []);
    measure('b', [], [handle('in', 'target', Position.Left, 0, 15)]);
    store.setEdges([
      { id: 'good', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'bad', source: 'a', target: 'b', sourceHandle: 'nope', targetHandle: 'in' },
    ]);

    expect(component.renderedEdges().map((e) => e.id)).toEqual(['good']);
    store.bumpVersion();
    expect(component.renderedEdges().map((e) => e.id)).toEqual(['good']);
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe('008');
    expect(onError.mock.calls[0][1]).toContain('"nope"');
    expect(onError.mock.calls[0][1]).toContain('bad');

    // The good edge anchors at the named handle, not the first one.
    const ei = component.getEdgeInputs(component.renderedEdges()[0]);
    expect(ei['sourceX']).toBe(0 + 90 + 5);
    expect(ei['targetX']).toBe(300 + 0 + 5);
  });

  it('still renders edges to nodes whose handles are not measured yet', () => {
    store.setNodes([node('a', 0), node('b', 300)]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', sourceHandle: 'out' }]);
    expect(component.renderedEdges().map((e) => e.id)).toEqual(['e']);
  });

  it('in Loose mode a target endpoint may name a source handle', () => {
    store.connectionMode.set(ConnectionMode.Loose);
    store.setNodes([node('a', 0), node('b', 300)]);
    measure('a', [handle('out', 'source', Position.Right, 90, 15)], []);
    measure('b', [handle('b-src', 'source', Position.Top, 45, 0)], []);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'b-src' }]);
    expect(component.renderedEdges().map((e) => e.id)).toEqual(['e']);

    store.connectionMode.set(ConnectionMode.Strict);
    expect(component.renderedEdges()).toHaveLength(0);
  });
});
