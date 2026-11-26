import { describe, it, expect, vi, afterEach } from 'vitest';
import { devWarn, setDevWarnSink, getViewportForBounds } from './general';
import { errorMessages } from '../constants';
import { addEdge, reconnectEdge } from './edges/general';
import type { Connection, EdgeBase, Padding } from '../types';

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

describe('dev warning branding', () => {
  afterEach(() => {
    setDevWarnSink(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('error001/error004 messages carry no React Flow branding or link', () => {
    expect(errorMessages.error001()).toBe('Seems like you have not used zustand provider as an ancestor.');
    expect(errorMessages.error004()).toBe('The parent container needs a width and a height to render the graph.');
  });

  it('default sink prints the upstream xyflow prefix and help link', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setDevWarnSink(null);
    devWarn('001', 'Boom.');
    expect(warn).toHaveBeenCalledWith('[xyflow]: Boom. Help: https://xyflow.com/error#001');
  });
});

describe('getViewportForBounds padding (#5927)', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const zoomFor = (padding?: Padding) => getViewportForBounds(bounds, 400, 400, 0, 10, padding as Padding).zoom;

  it('a number is pixels per side', () => expect(zoomFor(20)).toBeCloseTo(3.6)); // (400 - 2*20) / 100
  it('0.1 is 0px, not a ratio', () => expect(zoomFor(0.1)).toBeCloseTo(4));
  it("'10%' is a share of the viewport", () => expect(zoomFor('10%')).toBeCloseTo(3.2));
  it("'20px' is pixels", () => expect(zoomFor('20px')).toBeCloseTo(3.6));
  it('an invalid value logs and counts as 0', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(zoomFor('abc' as Padding)).toBeCloseTo(4);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
  it('defaults: minZoom 0, maxZoom Infinity, padding 0', () => {
    expect(getViewportForBounds(bounds, 400, 400).zoom).toBeCloseTo(4);
    expect(getViewportForBounds({ x: 0, y: 0, width: 1, height: 1 }, 400, 400).zoom).toBeCloseTo(400);
  });
  it('object padding: numeric sides are pixels', () => {
    expect(zoomFor({ x: 20, top: '10%' })).toBeCloseTo(3.6);
    expect(zoomFor({ top: 10, right: '5%', bottom: '10px', left: 0 })).toBeCloseTo(3.8);
  });
});
