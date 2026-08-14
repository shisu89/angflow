import { describe, it, expect, vi, afterEach } from 'vitest';
import { devWarn, setDevWarnSink } from './general';
import { addEdge, reconnectEdge } from './edges/general';
import type { Connection, EdgeBase } from '../types';

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
    // A connection with an empty source is the error006 case. `Connection` is
    // a real exported type — build a valid literal rather than casting, so a
    // signature change breaks this test instead of silently passing.
    const conn: Connection = { source: '', target: 'b', sourceHandle: null, targetHandle: null };

    const result = addEdge(conn, [] as EdgeBase[]);

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
