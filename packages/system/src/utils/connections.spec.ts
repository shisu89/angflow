import { describe, it, expect } from 'vitest';
import { getConnectionLookupKey, getConnectionsFromLookup } from './connections';
import { updateConnectionLookup } from './store';
import type { ConnectionLookup, EdgeBase, EdgeLookup } from '../types';

const edges: EdgeBase[] = [
  { id: 'e1', source: 'a', target: 'b', sourceHandle: 'h1' },
  { id: 'e2', source: 'a', target: 'c', sourceHandle: 'h2' },
  { id: 'e3', source: 'd', target: 'a', targetHandle: 't1' },
];

function lookupFor(list: EdgeBase[]): ConnectionLookup {
  const connectionLookup: ConnectionLookup = new Map();
  updateConnectionLookup(connectionLookup, new Map() as EdgeLookup, list);
  return connectionLookup;
}

describe('getConnectionLookupKey', () => {
  it('builds node, node-type and node-type-handle keys; a handle id without a type is ignored', () => {
    expect(getConnectionLookupKey('a')).toBe('a');
    expect(getConnectionLookupKey('a', 'source')).toBe('a-source');
    expect(getConnectionLookupKey('a', 'source', 'h1')).toBe('a-source-h1');
    expect(getConnectionLookupKey('a', null, 'h1')).toBe('a');
  });
});

describe('getConnectionsFromLookup', () => {
  const connectionLookup = lookupFor(edges);
  const ids = (p: Parameters<typeof getConnectionsFromLookup>[1]) =>
    getConnectionsFromLookup(connectionLookup, p)
      .map((c) => c.edgeId)
      .sort();

  it('returns every connection of a node', () => expect(ids({ nodeId: 'a' })).toEqual(['e1', 'e2', 'e3']));
  it('filters by handle type', () => {
    expect(ids({ nodeId: 'a', type: 'source' })).toEqual(['e1', 'e2']);
    expect(ids({ nodeId: 'a', type: 'target' })).toEqual(['e3']);
  });
  it('filters by type and handle id', () =>
    expect(ids({ nodeId: 'a', type: 'source', handleId: 'h2' })).toEqual(['e2']));
  it('ignores a handle id without a type', () =>
    expect(ids({ nodeId: 'a', handleId: 'h2' })).toEqual(['e1', 'e2', 'e3']));
  it('returns [] for an unknown node', () => expect(ids({ nodeId: 'zz' })).toEqual([]));
});
