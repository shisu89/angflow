import { describe, it, expect } from 'vitest';

import { getDragItems } from './utils';
import { adoptUserNodes } from '../utils/store';
import type { InternalNodeBase, NodeBase, ParentLookup } from '../types';

function lookupOf(nodes: NodeBase[]) {
  const nodeLookup = new Map<string, InternalNodeBase<NodeBase>>();
  const parentLookup: ParentLookup<InternalNodeBase<NodeBase>> = new Map();
  adoptUserNodes(nodes, nodeLookup, parentLookup);
  return nodeLookup;
}

describe('getDragItems onlyDragNode (#6097)', () => {
  const nodes: NodeBase[] = [
    { id: 'a', position: { x: 0, y: 0 }, data: {}, selected: true },
    { id: 'b', position: { x: 10, y: 0 }, data: {}, selected: true },
    { id: 'c', position: { x: 20, y: 0 }, data: {} },
  ];

  it('drags only the grabbed node when onlyDragNode is set', () => {
    const items = getDragItems(lookupOf(nodes), true, { x: 0, y: 0 }, 'c', true);
    expect([...items.keys()]).toEqual(['c']);
  });

  it('drags the selection along with the grabbed node without the flag', () => {
    const items = getDragItems(lookupOf(nodes), true, { x: 0, y: 0 }, 'c');
    expect([...items.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('drags a child of a selected parent on its own when onlyDragNode is set', () => {
    const lookup = lookupOf([
      { id: 'p', position: { x: 0, y: 0 }, data: {}, selected: true },
      { id: 'child', position: { x: 5, y: 5 }, data: {}, parentId: 'p' },
    ]);
    const items = getDragItems(lookup, true, { x: 0, y: 0 }, 'child', true);
    expect([...items.keys()]).toEqual(['child']);
  });
});
