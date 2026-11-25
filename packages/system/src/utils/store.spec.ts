import { describe, it, expect, vi, afterEach } from 'vitest';
import { adoptUserNodes, updateAbsolutePositions } from './store';
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

describe('subflow order (#5915)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a child listed before its parent', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes(
      [
        node('c', { parentId: 'g', position: { x: 10, y: 20 } }),
        node('g', { position: { x: 100, y: 200 }, width: 300, height: 300 }),
      ],
      nodeLookup,
      parentLookup
    );
    expect(nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 110, y: 220 });
    expect(parentLookup.get('g')?.has('c')).toBe(true);
  });

  it('resolves three generations listed grandchild, child, group', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes(
      [
        node('gc', { parentId: 'c', position: { x: 1, y: 2 } }),
        node('c', { parentId: 'g', position: { x: 10, y: 20 } }),
        node('g', { position: { x: 100, y: 200 }, width: 300, height: 300 }),
      ],
      nodeLookup,
      parentLookup
    );
    expect(nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 110, y: 220 });
    expect(nodeLookup.get('gc')!.internals.positionAbsolute).toEqual({ x: 111, y: 222 });
    expect(parentLookup.get('g')?.has('c')).toBe(true);
    expect(parentLookup.get('c')?.has('gc')).toBe(true);
  });

  it('warns once for a child whose parent is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes([node('c', { parentId: 'g', position: { x: 10, y: 20 } })], nodeLookup, parentLookup);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Parent node with id "g" is missing for child node with id "c"');
  });

  it('updateAbsolutePositions resolves a parent before a child listed ahead of it', () => {
    const { nodeLookup, parentLookup } = lookups();
    adoptUserNodes(
      [
        node('c', { parentId: 'g', position: { x: 10, y: 20 } }),
        node('g', { position: { x: 100, y: 200 }, width: 300, height: 300 }),
      ],
      nodeLookup,
      parentLookup
    );
    nodeLookup.get('g')!.position = { x: 500, y: 500 };
    updateAbsolutePositions(nodeLookup, parentLookup);
    expect(nodeLookup.get('g')!.internals.positionAbsolute).toEqual({ x: 500, y: 500 });
    expect(nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 510, y: 520 });
  });
});
