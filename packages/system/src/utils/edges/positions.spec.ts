import { describe, it, expect, vi } from 'vitest';
import { getEdgePosition } from './positions';
import { adoptUserNodes } from '../store';
import {
  ConnectionMode,
  Position,
  type InternalNodeBase,
  type NodeBase,
  type NodeLookup,
  type ParentLookup,
} from '../../types';

function lookup(nodes: NodeBase[]): NodeLookup<InternalNodeBase<NodeBase>> {
  const nodeLookup = new Map() as NodeLookup<InternalNodeBase<NodeBase>>;
  adoptUserNodes(nodes, nodeLookup, new Map() as ParentLookup<InternalNodeBase<NodeBase>>);
  return nodeLookup;
}

// User-declared handles, no measured DOM: width/height are left out on purpose.
const declared = (id: string, x: number): NodeBase => ({
  id,
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
  handles: [
    { type: 'source', position: Position.Right, x: 100, y: 20 },
    { type: 'target', position: Position.Left, x: 0, y: 20 },
  ],
});

describe('getEdgePosition with user-declared handles (#5987)', () => {
  it('positions an edge from node.handles through parseHandles', () => {
    const l = lookup([declared('a', 0), declared('b', 300)]);
    const pos = getEdgePosition({
      id: 'e', sourceNode: l.get('a')!, sourceHandle: null, targetNode: l.get('b')!, targetHandle: null,
      connectionMode: ConnectionMode.Strict,
    });
    // parseHandles gives a declared handle a 1x1 box.
    expect(pos).toEqual({
      sourceX: 101, sourceY: 20.5, targetX: 300, targetY: 20.5,
      sourcePosition: Position.Right, targetPosition: Position.Left,
    });
  });

  it('has no toHandleBounds fallback: without internals.handleBounds there is no position, and node.handles is not mutated', () => {
    const l = lookup([declared('a', 0), declared('b', 300)]);
    const a = l.get('a')!;
    const bare = { ...a, internals: { ...a.internals, handleBounds: undefined } } as InternalNodeBase;
    const onError = vi.fn();
    const pos = getEdgePosition({
      id: 'e', sourceNode: bare, sourceHandle: null, targetNode: l.get('b')!, targetHandle: null,
      connectionMode: ConnectionMode.Strict, onError,
    });
    expect(pos).toBeNull();
    expect(onError).toHaveBeenCalledWith('008', expect.any(String));
    expect(bare.handles![0].width).toBeUndefined();
  });
});
