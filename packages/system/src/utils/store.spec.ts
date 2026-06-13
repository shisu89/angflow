import { describe, it, expect } from 'vitest';
import { adoptUserNodes } from './store';
import type { NodeBase, InternalNodeBase, NodeLookup, ParentLookup } from '../types';

function lookups() {
  return {
    nodeLookup: new Map() as NodeLookup<InternalNodeBase<NodeBase>>,
    parentLookup: new Map() as ParentLookup<InternalNodeBase<NodeBase>>,
  };
}

const node = (id: string, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});

describe('adoptUserNodes measured preservation', () => {
  it('preserves prior measured when a re-adopted node (new identity) omits it', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('a', { measured: { width: 200, height: 80 } })], nodeLookup, parentLookup);
    expect(nodeLookup.get('a')!.measured).toEqual({ width: 200, height: 80 });
    adoptUserNodes([node('a')], nodeLookup, parentLookup);
    expect(nodeLookup.get('a')!.measured).toEqual({ width: 200, height: 80 });
  });

  it('leaves measured undefined for a brand-new node', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('b')], nodeLookup, parentLookup);
    expect(nodeLookup.get('b')!.measured).toEqual({ width: undefined, height: undefined });
  });

  it('lets incoming measured override the prior value', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('a', { measured: { width: 200, height: 80 } })], nodeLookup, parentLookup);
    adoptUserNodes([node('a', { measured: { width: 120, height: 60 } })], nodeLookup, parentLookup);
    expect(nodeLookup.get('a')!.measured).toEqual({ width: 120, height: 60 });
  });
});
