import { describe, it, expect } from 'vitest';
import {
  applyNodeChanges,
  applyEdgeChanges,
  NodeChangeset,
  EdgeChangeset,
  selectionChange,
  getSelectionChanges,
  type NodeChange,
  type EdgeChange,
} from '@angflow/system';
import { applyDimensionChanges } from './changes';
import type { Node, Edge } from '../types';

// Array-in helpers over the upstream changeset API, so each case below reads as
// a plain list of changes. They pin angflow's controlled-mode semantics on top
// of @angflow/system's applyNodeChanges(nodes, changeset).
function applyNodeList(list: NodeChange<Node>[], nodes: Node[]): Node[] {
  return applyNodeChanges(nodes, new NodeChangeset<Node>(list));
}
function applyEdgeList(list: EdgeChange<Edge>[], edges: Edge[]): Edge[] {
  return applyEdgeChanges(edges, new EdgeChangeset<Edge>(list));
}
function dims(changes: NodeChange<Node>[]): NodeChangeset<Node> {
  return new NodeChangeset<Node>(changes);
}

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', ...overrides };
}

function makeEdge(id: string, source: string, target: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source, target, ...overrides };
}

describe('applyNodeChanges(nodes, changeset)', () => {
  it('remove: deletes a node from the array', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')];
    const result = applyNodeList([{ id: '2', type: 'remove' }], nodes);
    expect(result.map(n => n.id)).toEqual(['1', '3']);
  });

  it('remove: multiple nodes at once', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')];
    const result = applyNodeList([
      { id: '1', type: 'remove' },
      { id: '3', type: 'remove' },
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['2']);
  });

  it('add: appends node to the end', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeList([
      { type: 'add', id: '2', item: makeNode('2') },
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['1', '2']);
  });

  it('add with index: index is ignored, the node is appended (upstream 1.0)', () => {
    const nodes = [makeNode('1'), makeNode('3')];
    const result = applyNodeList([
      { type: 'add', id: '2', item: makeNode('2'), index: 1 },
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['1', '3', '2']);
  });

  it('select: sets selected flag', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyNodeList([
      { id: '1', type: 'select', selected: true },
    ], nodes);
    expect(result[0].selected).toBe(true);
    expect(result[1].selected).toBeUndefined();
  });

  it('select: can deselect', () => {
    const nodes = [makeNode('1', { selected: true } as any)];
    const result = applyNodeList([
      { id: '1', type: 'select', selected: false },
    ], nodes);
    expect(result[0].selected).toBe(false);
  });

  it('position: updates position and dragging', () => {
    const nodes = [makeNode('1', { position: { x: 0, y: 0 } })];
    const result = applyNodeList([
      { id: '1', type: 'position', position: { x: 100, y: 200 }, dragging: true },
    ], nodes);
    expect(result[0].position).toEqual({ x: 100, y: 200 });
    expect((result[0] as any).dragging).toBe(true);
  });

  it('position: partial update (only dragging, no position)', () => {
    const nodes = [makeNode('1', { position: { x: 50, y: 50 } })];
    const result = applyNodeList([
      { id: '1', type: 'position', dragging: false },
    ], nodes);
    // Position unchanged
    expect(result[0].position).toEqual({ x: 50, y: 50 });
    expect((result[0] as any).dragging).toBe(false);
  });

  it('dimensions: sets measured and optionally width/height', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeList([
      { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: true } as any,
    ], nodes);
    expect(result[0].measured).toEqual({ width: 200, height: 100 });
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBe(100);
  });

  it('dimensions: setAttributes=false does not set width/height', () => {
    const nodes = [makeNode('1', { width: 50 })];
    const result = applyNodeList([
      { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: false } as any,
    ], nodes);
    expect(result[0].measured).toEqual({ width: 200, height: 100 });
    expect(result[0].width).toBe(50); // unchanged
  });

  it('dimensions: setAttributes="width" only sets width', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeList([
      { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: 'width' } as any,
    ], nodes);
    expect(result[0].width).toBe(200);
    expect(result[0].height).toBeUndefined();
  });

  it('replace: swaps a node entirely', () => {
    const nodes = [makeNode('1', { data: { old: true } }), makeNode('2')];
    const replacement = makeNode('1', { data: { new: true }, position: { x: 999, y: 999 } });
    const result = applyNodeList([
      { id: '1', type: 'replace', item: replacement } as any,
    ], nodes);
    expect(result[0].data).toEqual({ new: true });
    expect(result[0].position).toEqual({ x: 999, y: 999 });
    expect(result).toHaveLength(2);
  });

  it('multiple changes on same node apply in order', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeList([
      { id: '1', type: 'position', position: { x: 10, y: 20 } },
      { id: '1', type: 'select', selected: true },
    ], nodes);
    expect(result[0].position).toEqual({ x: 10, y: 20 });
    expect(result[0].selected).toBe(true);
  });

  it('remove + add is not confused (remove happens first)', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyNodeList([
      { id: '1', type: 'remove' },
      { type: 'add', id: '3', item: makeNode('3') },
    ], nodes);
    expect(result.map(n => n.id)).toEqual(['2', '3']);
  });

  it('changes for nonexistent IDs are ignored', () => {
    const nodes = [makeNode('1')];
    const result = applyNodeList([
      { id: 'ghost', type: 'select', selected: true },
    ], nodes);
    expect(result).toHaveLength(1);
    expect(result[0].selected).toBeUndefined();
  });

  it('produces new object references (immutable)', () => {
    const original = makeNode('1');
    const nodes = [original];
    const result = applyNodeList([
      { id: '1', type: 'select', selected: true },
    ], nodes);
    expect(result[0]).not.toBe(original);
  });
});

describe('applyEdgeChanges(edges, changeset)', () => {
  it('remove: deletes an edge', () => {
    const edges = [makeEdge('e1', '1', '2'), makeEdge('e2', '2', '3')];
    const result = applyEdgeList([{ id: 'e1', type: 'remove' }], edges);
    expect(result.map(e => e.id)).toEqual(['e2']);
  });

  it('select: toggles edge selection', () => {
    const edges = [makeEdge('e1', '1', '2')];
    const result = applyEdgeList([
      { id: 'e1', type: 'select', selected: true },
    ], edges);
    expect(result[0].selected).toBe(true);
  });
});

describe('selectionChange', () => {
  it('creates a select change object', () => {
    expect(selectionChange('n1', true)).toEqual({
      id: 'n1', type: 'select', selected: true,
    });
    expect(selectionChange('n1', false)).toEqual({
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

  it('never modifies the items it diffs (#6097)', () => {
    const item1 = { id: '1', selected: false };
    const lookup = new Map([['1', item1]]);

    getSelectionChanges(lookup, new Set(['1']));

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
    const result = applyDimensionChanges(
      nodes,
      dims([{ id: '1', type: 'dimensions', dimensions: { width: 220, height: 90 } }]),
    );
    expect(result[0].measured).toEqual({ width: 220, height: 90 });
  });

  it('ignores non-dimensions changes', () => {
    const nodes = [makeNode('1', { measured: { width: 10, height: 10 } })];
    const result = applyDimensionChanges(
      nodes,
      dims([
        { id: '1', type: 'position', position: { x: 5, y: 5 } },
        { id: '1', type: 'select', selected: true },
      ]),
    );
    expect(result[0].measured).toEqual({ width: 10, height: 10 });
    expect(result[0].position).toEqual({ x: 0, y: 0 });
    expect(result[0].selected).toBeUndefined();
  });

  it('returns the SAME array reference when no dimensions change is present', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(
      nodes,
      dims([{ id: '1', type: 'position', position: { x: 1, y: 1 } }]),
    );
    expect(result).toBe(nodes);
  });

  it('returns the SAME array reference for an empty changeset', () => {
    const nodes = [makeNode('1')];
    expect(applyDimensionChanges(nodes, new NodeChangeset<Node>())).toBe(nodes);
  });

  it('returns the SAME array reference when every dimensions change targets an unknown id', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(
      nodes,
      dims([{ id: 'ghost', type: 'dimensions', dimensions: { width: 1, height: 1 } }]),
    );
    expect(result).toBe(nodes);
  });

  it('keeps untouched nodes by identity', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyDimensionChanges(
      nodes,
      dims([{ id: '2', type: 'dimensions', dimensions: { width: 5, height: 5 } }]),
    );
    expect(result).not.toBe(nodes);
    expect(result[0]).toBe(nodes[0]);
    expect(result[1]).not.toBe(nodes[1]);
  });

  it('last dimensions change for a node wins', () => {
    const nodes = [makeNode('1')];
    const result = applyDimensionChanges(
      nodes,
      dims([
        { id: '1', type: 'dimensions', dimensions: { width: 10, height: 10 } },
        { id: '1', type: 'position', position: { x: 3, y: 3 } },
        { id: '1', type: 'dimensions', dimensions: { width: 40, height: 25 } },
      ]),
    );
    expect(result[0].measured).toEqual({ width: 40, height: 25 });
  });

  it('writes only measured: ignores setAttributes and resizing', () => {
    const nodes = [makeNode('1', { width: 50 })];
    const result = applyDimensionChanges(
      nodes,
      dims([
        { id: '1', type: 'dimensions', dimensions: { width: 200, height: 100 }, setAttributes: true, resizing: true },
      ]),
    );
    expect(result[0].measured).toEqual({ width: 200, height: 100 });
    expect(result[0].width).toBe(50);
    expect(result[0].height).toBeUndefined();
    expect(result[0].resizing).toBeUndefined();
  });

  it('skips unknown ids and applies the rest', () => {
    const nodes = [makeNode('1'), makeNode('2')];
    const result = applyDimensionChanges(
      nodes,
      dims([
        { id: 'ghost', type: 'dimensions', dimensions: { width: 1, height: 1 } },
        { id: '2', type: 'dimensions', dimensions: { width: 50, height: 30 } },
      ]),
    );
    expect(result[0].measured).toBeUndefined();
    expect(result[1].measured).toEqual({ width: 50, height: 30 });
  });

  it('does not mutate the input nodes', () => {
    const nodes = [makeNode('1')];
    applyDimensionChanges(
      nodes,
      dims([{ id: '1', type: 'dimensions', dimensions: { width: 7, height: 7 } }]),
    );
    expect(nodes[0].measured).toBeUndefined();
  });
});
