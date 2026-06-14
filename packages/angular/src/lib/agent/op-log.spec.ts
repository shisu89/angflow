import { describe, it, expect } from 'vitest';
import { OpLog } from './op-log';

const op = (method: string, source?: string) => ({ method, params: {}, source });

describe('OpLog', () => {
  it('assigns increasing per-flow cursors starting at 1', () => {
    const log = new OpLog();
    expect(log.append('f', op('add_node')).cursor).toBe(1);
    expect(log.append('f', op('add_edge')).cursor).toBe(2);
    expect(log.append('g', op('add_node')).cursor).toBe(1);
  });

  it('since(c) returns only entries after c, with latest cursor', () => {
    const log = new OpLog();
    log.append('f', op('a'));
    log.append('f', op('b'));
    log.append('f', op('c'));
    const res = log.since('f', 1);
    expect(res.ops.map((e) => e.method)).toEqual(['b', 'c']);
    expect(res.cursor).toBe(3);
    expect(res.truncated).toBe(false);
  });

  it('since(0) / omitted returns all retained entries', () => {
    const log = new OpLog();
    log.append('f', op('a'));
    log.append('f', op('b'));
    expect(log.since('f', 0).ops.map((e) => e.method)).toEqual(['a', 'b']);
  });

  it('drops oldest past maxOps (ring buffer) and reports truncated for a stale cursor', () => {
    const log = new OpLog({ maxOps: 2 });
    log.append('f', op('a'));
    log.append('f', op('b'));
    log.append('f', op('c'));
    const res = log.since('f', 1);
    expect(res.ops.map((e) => e.method)).toEqual(['b', 'c']);
    expect(res.truncated).toBe(true);
  });

  it('preserves source on entries', () => {
    const log = new OpLog();
    expect(log.append('f', op('a', 'agent:claude')).source).toBe('agent:claude');
  });

  it('dropFlow clears a flow', () => {
    const log = new OpLog();
    log.append('f', op('a'));
    log.dropFlow('f');
    expect(log.since('f', 0).ops).toEqual([]);
    expect(log.append('f', op('b')).cursor).toBe(1);
  });
});
