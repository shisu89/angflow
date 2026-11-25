import { afterEach, describe, expect, it, vi } from 'vitest';

import { addEdge, reconnectEdge } from './general';
import { setDevWarnSink } from '../general';

const old = { id: 'old-edge', source: 'a', target: 'b' };

describe('reconnectEdge', () => {
  afterEach(() => setDevWarnSink(null));

  it('replaces the id when options omit shouldReplaceId', () => {
    const result = reconnectEdge(old, { source: 'a', target: 'c', sourceHandle: null, targetHandle: null }, [old], {
      getEdgeId: () => 'custom',
    });
    expect(result.map((e) => e.id)).toEqual(['custom']);
  });

  it('replaces the id when only onError is passed', () => {
    const result = reconnectEdge(old, { source: 'a', target: 'c', sourceHandle: null, targetHandle: null }, [old], {
      onError: () => {},
    });
    expect(result[0].id).toBe('xy-edge__a-c');
  });

  it('keeps the id when shouldReplaceId is false', () => {
    const result = reconnectEdge(old, { source: 'a', target: 'c', sourceHandle: null, targetHandle: null }, [old], {
      shouldReplaceId: false,
    });
    expect(result[0].id).toBe('old-edge');
  });

  it('reports 006 through onError and returns edges unchanged', () => {
    const onError = vi.fn();
    const edges = [old];
    const result = reconnectEdge(old, { source: '', target: 'c', sourceHandle: null, targetHandle: null }, edges, {
      onError,
    });
    expect(onError).toHaveBeenCalledWith('006', expect.any(String));
    expect(result).toBe(edges);
  });

  it('reports 007 through onError when the old edge is missing', () => {
    const onError = vi.fn();
    reconnectEdge(old, { source: 'a', target: 'c', sourceHandle: null, targetHandle: null }, [], { onError });
    expect(onError).toHaveBeenCalledWith('007', expect.any(String));
  });

  it('falls back to the dev-warn sink without onError', () => {
    const spy = vi.fn();
    setDevWarnSink(spy);
    reconnectEdge(old, { source: '', target: 'c', sourceHandle: null, targetHandle: null }, [old]);
    expect(spy).toHaveBeenCalledWith('006', expect.any(String));
  });
});

describe('addEdge', () => {
  afterEach(() => setDevWarnSink(null));

  it('reports 006 through onError', () => {
    const onError = vi.fn();
    const result = addEdge({ source: '', target: 'b' } as any, [], { onError });
    expect(onError).toHaveBeenCalledWith('006', expect.any(String));
    expect(result).toEqual([]);
  });

  it('falls back to the dev-warn sink without onError', () => {
    const spy = vi.fn();
    setDevWarnSink(spy);
    addEdge({ source: '', target: 'b' } as any, []);
    expect(spy).toHaveBeenCalledWith('006', expect.any(String));
  });
});
