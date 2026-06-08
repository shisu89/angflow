import { describe, it, expect } from 'vitest';
import { applyNodeChanges, applyEdgeChanges, applyDimensionChanges, createSelectionChange, getSelectionChanges } from './changes';
import type { Node, Edge } from '../types';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', ...overrides };
}

function makeEdge(id: string, source: string, target: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source, target, ...overrides };
}

describe('applyNodeChanges', () => {
  it('remove: deletes a node from the array', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')];
    const result = applyNodeChanges([{ id: '2', type: 'remove' }], nodes);
    expect(result.map(n => n.id)).toEqual(['1', '3']);
  });

  it('remove: multiple nodes at once', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')];
    const result = applyNodeChanges([
      { id: '1', type: 'remove' },
      { id: '3', type: 'remove' },
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['2']);
  });

  it('add: appends node to the end', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeChanges([
      { type: 'add', item: makeNode('2') } as any,
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['1', '2']);
  });

  it('add with index: inserts at specific position', () => {
    const nodes = [makeNode('1'), makeNode('3')];
    const result = applyNodeChanges([
      { type: 'add', item: makeNode('2'), index: 1 } as any,
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['1', '2', '3']);
  });

  it('select: sets selected flag', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyNodeChanges([
      { id: '1', type: 'select', selected: true },
    ], nodes);
    expect(result[0].selected).toBe(true);
    expect(result[1].selected).toBeUndefined();
  });

  it('select: can deselect', () => {
    const nodes = [makeNode('1', { selected: true } as any)];
    const result = applyNodeChanges([
      { id: '1', type: 'select', selected: false },
    ], nodes);
    expect(result[0].selected).toBe(false);
  });

  it('position: updates position and dragging', () => {
    const nodes = [makeNode('1', { position: { x: 0, y: 0 } })];
    const result = applyNodeChanges([
      { id: '1', type: 'position', position: { x: 100, y: 200 }, dragging: true },
    ], nodes);
    expect(result[0].position).toEqual({ x: 100, y: 200 });
    expect((result[0] as any).dragging).toBe(true);
  });

  it('position: partial update (only dragging, no position)', () => {
    const nodes = [makeNode('1', { position: { x: 50, y: 50 } })];
    const result = applyNodeChanges([
      { id: '1', type: 'position', dragging: false },
    ], nodes);
    // Position unchanged
    expect(result[0].position).toEqual({ x: 50, y: 50 });
    expect((result[0] as any).dragging).toBe(false);
  });

  it('dimensions: sets measured and optionally width/height', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeChanges([
      { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: true } as any,
    ], nodes);
    expect(result[0].measured).toEqual({ width: 200, height: 100 });
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(100);
  });

  it('dimensions: setAttributes=false does not set width/height', () => {
    const nodes = [makeNode('1', { width: 50 })];
    const result = applyNodeChanges([
      { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: false } as any,
    ], nodes);
    expect(result[0].measured).toEqual({ width: 200, height: 100 });
    expect(result[0].width).toBe(50); // unchanged
  });

  it('dimensions: setAttributes="width" only sets width', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeChanges([
      { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: 'width' } as any,
    ], nodes);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBeUndefined();
  });

  it('replace: swaps a node entirely', () => {
    const nodes = [makeNode('1', { data: { old: true } }), makeNode('2')];
    const replacement = makeNode('1', { data: { new: true }, position: { x: 999, y: 999 } });
    const result = applyNodeChanges([
      { id: '1', type: 'replace', item: replacement } as any,
    ], nodes);
    expect(result[0].data).toEqual({ new: true });
    expect(result[0].position).toEqual({ x: 999, y: 999 });
    expect(result).toHaveLength(2);
  });

  it('multiple changes on same node apply in order', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeChanges([
      { id: '1', type: 'position', position: { x: 10, y: 20 } },
      { id: '1', type: 'select', selected: true },
    ], nodes);
    expect(result[0].position).toEqual({ x: 10, y: 20 });
    expect(result[0].selected).toBe(true);
  });

  it('remove + add is not confused (remove happens first)', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyNodeChanges([
      { id: '1', type: 'remove' },
      { type: 'add', item: makeNode('3') } as any,
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['2', '3']);
  });

  it('changes for nonexistent IDs are ignored', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeChanges([
      { id: 'ghost', type: 'select', selected: true },
    ], nodes);
    expect(result).toHaveLength(1);
    expect(result[0].selected).toBeUndefined();
  });

  it('produces new object references (immutable)', () => {
    const original = makeNode('1');
    const nodes = [original];
    const result = applyNodeChanges([
      { id: '1', type: 'select', selected: true },
    ], nodes);
    expect(result[0]).not.toBe(original);
  });
});

describe('applyEdgeChanges', () => {
  it('remove: deletes an edge', () => {
    const edges = [makeEdge('e1', '1', '2'), makeEdge('e2', '2', '3')];
    const result = applyEdgeChanges([{ id: 'e1', type: 'remove' }], edges);
    expect(result.map(e => e.id)).toEqual(['e2']);
  });

  it('select: toggles edge selection', () => {
    const edges = [makeEdge('e1', '1', '2')];
    const result = applyEdgeChanges([
      { id: 'e1', type: 'select', selected: true },
    ], edges);
    expect(result[0].selected).toBe(true);
  });
});

describe('createSelectionChange', () => {
  it('creates a select change object', () => {
    expect(createSelectionChange('n1', true)).toEqual({
      id: 'n1', type: 'select', selected: true,
    });
    expect(createSelectionChange('n1', false)).toEqual({
      id: 'n1', type: 'select', selected: false,
    });
  });
});

describe('getSelectionChanges', () => {
  it('generates changes only for items whose selection state differs', () => {
    const lookup = new Map<string, any>([
      ['1', { id: '1', selected: false }],
      ['2', { id: '2', selected: true }],
      ['3', { id: '3', selected: undefined }],
    ]);

    // We want to select node 1, deselect node 2, leave node 3 unchanged
    const changes = getSelectionChanges(lookup, new Set(['1']));

    // Node 1: false→true (change), Node 2: true→false (change), Node 3: undefined→false (no change, both falsy)
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ id: '1', type: 'select', selected: true });
    expect(changes).toContainEqual({ id: '2', type: 'select', selected: false });
  });

  it('mutateItem=true updates items in-place', () => {
    const item1 = { id: '1', selected: false };
    const lookup = new Map([['1', item1]]);

    getSelectionChanges(lookup, new Set(['1']), true);

    expect(item1.selected).toBe(true);
  });

  it('mutateItem=false does not modify items', () => {
    const item1 = { id: '1', selected: false };
    const lookup = new Map([['1', item1]]);

    getSelectionChanges(lookup, new Set(['1']), false);

    expect(item1.selected).toBe(false);
  });

  it('returns empty array when nothing changes', () => {
    const lookup = new Map<string, any>([
      ['1', { id: '1', selected: true }],
    ]);
    const changes = getSelectionChanges(lookup, new Set(['1']));
    expect(changes).toHaveLength(0);
  });
});

describe('applyDimensionChanges', () => {
  it('writes measured from a dimensions change', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(nodes, [
      { id: '1', type: 'dimensions', dimensions: { width: 220, height: 90 } },
    ]);
    expect(result[0].measured).toEqual({ width: 220, height: 90 });
  });

  it('ignores non-dimensions changes', () => {
    const nodes = [makeNode('1', { measured: { width: 10, height: 10 } })];
    const result = applyDimensionChanges(nodes, [
      { id: '1', type: 'position', position: { x: 5, y: 5 } },
      { id: '1', type: 'select', selected: true },
    ]);
    expect(result[0].measured).toEqual({ width: 10, height: 10 });
    expect(result[0].position).toEqual({ x: 0, y: 0 });
    expect(result[0].selected).toBeUndefined();
  });

  it('returns the SAME array reference when no dimensions change is present', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(nodes, [
      { id: '1', type: 'position', position: { x: 1, y: 1 } },
    ]);
    expect(result).toBe(nodes);
  });

  it('skips unknown ids and applies the rest', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyDimensionChanges(nodes, [
      { id: 'ghost', type: 'dimensions', dimensions: { width: 1, height: 1 } },
      { id: '2', type: 'dimensions', dimensions: { width: 50, height: 30 } },
    ]);
    expect(result[0].measured).toBeUndefined();
    expect(result[1].measured).toEqual({ width: 50, height: 30 });
  });

  it('does not mutate the input nodes', () => {
    const nodes = [makeNode('1')];
    applyDimensionChanges(nodes, [
      { id: '1', type: 'dimensions', dimensions: { width: 7, height: 7 } },
    ]);
    expect(nodes[0].measured).toBeUndefined();
  });
});
