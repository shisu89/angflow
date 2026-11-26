import { describe, it, expect, vi } from 'vitest';
import {
  calculateNodePosition,
  fitViewport,
  getFitViewport,
  getNodesBounds,
  getNodesInside,
  getElementsToRemove,
  isEdgeBase,
  isNodeBase,
  isInternalNodeBase,
} from './graph';
import { adoptUserNodes } from './store';
import type { NodeBase, EdgeBase, InternalNodeBase, NodeLookup, ParentLookup, PanZoomInstance } from '../types';

function buildLookup(nodes: NodeBase[]): NodeLookup<InternalNodeBase<NodeBase>> {
  const nodeLookup = new Map() as NodeLookup<InternalNodeBase<NodeBase>>;
  const parentLookup = new Map() as ParentLookup<InternalNodeBase<NodeBase>>;
  adoptUserNodes(nodes, nodeLookup, parentLookup);
  return nodeLookup;
}

// Minimal PanZoom stub; setViewport resolves immediately like the real instance.
const fakePanZoom = (): PanZoomInstance =>
  ({ setViewport: async () => true } as unknown as PanZoomInstance);

const sized = (id: string, x: number, y: number, w = 100, h = 50): NodeBase => ({
  id,
  position: { x, y },
  data: {},
  measured: { width: w, height: h },
});

describe('getFitViewport', () => {
  const params = (nodes: NodeLookup<InternalNodeBase<NodeBase>>, minZoom = 0.5, maxZoom = 2) => ({
    nodes,
    width: 800,
    height: 600,
    minZoom,
    maxZoom,
  });

  it('clamps to minZoom when the board is too big', () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 100000, 0)]);
    expect(getFitViewport(params(nodes), { padding: 0.1 })!.zoom).toBeCloseTo(0.5, 5);
  });

  it('lands strictly inside [minZoom, maxZoom] when the board fits', () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 300, 200)]);
    const zoom = getFitViewport(params(nodes), { padding: 0.1 })!.zoom;
    expect(zoom).toBeGreaterThan(0.5);
    expect(zoom).toBeLessThan(2);
  });

  it('clamps to maxZoom for a tiny board', () => {
    const nodes = buildLookup([sized('a', 0, 0, 10, 10)]);
    expect(getFitViewport(params(nodes), { padding: 0.1 })!.zoom).toBeCloseTo(2, 5);
  });

  it('honors an options.minZoom override', () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 100000, 0)]);
    expect(getFitViewport(params(nodes), { padding: 0.1, minZoom: 0.0001 })!.zoom).toBeLessThan(0.1);
  });

  it('returns null for an empty lookup, `nodes: []` and all-hidden nodes', () => {
    expect(getFitViewport(params(new Map() as NodeLookup<InternalNodeBase<NodeBase>>), {})).toBeNull();
    expect(getFitViewport(params(buildLookup([sized('a', 0, 0)])), { nodes: [] } as never)).toBeNull();
    expect(getFitViewport(params(buildLookup([{ ...sized('a', 0, 0), hidden: true }])), {})).toBeNull();
  });
});

describe('fitViewport', () => {
  const base = (nodes: NodeLookup<InternalNodeBase<NodeBase>>, panZoom: PanZoomInstance) => ({
    nodes,
    width: 800,
    height: 600,
    panZoom,
    minZoom: 0.5,
    maxZoom: 2,
  });

  it('resolves true when the animation runs to the end', async () => {
    expect(await fitViewport(base(buildLookup([sized('a', 0, 0)]), fakePanZoom()), {})).toBe(true);
  });

  it('resolves false when setViewport is interrupted', async () => {
    const panZoom = { setViewport: async () => false } as unknown as PanZoomInstance;
    expect(await fitViewport(base(buildLookup([sized('a', 0, 0)]), panZoom), {})).toBe(false);
  });

  it('resolves true without calling setViewport when there is nothing to fit', async () => {
    const setViewport = vi.fn(async () => false);
    const panZoom = { setViewport } as unknown as PanZoomInstance;
    const unsized: NodeBase = { id: 'u', position: { x: 0, y: 0 }, data: {} };
    // empty lookup
    expect(await fitViewport(base(new Map() as NodeLookup<InternalNodeBase<NodeBase>>, panZoom), {})).toBe(true);
    // no fittable node (#6158)
    expect(await fitViewport(base(buildLookup([unsized]), panZoom), {})).toBe(true);
    expect(await fitViewport(base(buildLookup([sized('a', 0, 0)]), panZoom), { nodes: [{ id: 'missing' }] } as never)).toBe(true);
    // `nodes: []` is not "all nodes"
    expect(await fitViewport(base(buildLookup([sized('a', 0, 0)]), panZoom), { nodes: [] } as never)).toBe(true);
    // every node hidden
    expect(await fitViewport(base(buildLookup([{ ...sized('a', 0, 0), hidden: true }]), panZoom), {})).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();
  });
});

describe('type guards are null/primitive safe', () => {
  it('return false (not throw) for null, undefined, and primitives', () => {
    for (const guard of [isEdgeBase, isNodeBase, isInternalNodeBase]) {
      expect(guard(null as never)).toBe(false);
      expect(guard(undefined as never)).toBe(false);
      expect(guard('str' as never)).toBe(false);
      expect(guard(42 as never)).toBe(false);
    }
  });

  it('filtering an array containing null does not throw', () => {
    const arr = [{ id: 'n', position: { x: 0, y: 0 }, data: {} }, null, undefined];
    expect(() => arr.filter((e) => isNodeBase(e as never))).not.toThrow();
    expect(arr.filter((e) => isNodeBase(e as never)).length).toBe(1);
  });

  it('still identify valid nodes and edges', () => {
    expect(isNodeBase({ id: 'n', position: { x: 0, y: 0 }, data: {} } as never)).toBe(true);
    expect(isEdgeBase({ id: 'e', source: 'a', target: 'b' } as never)).toBe(true);
  });
});

describe('getNodesBounds with nodeLookup', () => {
  it('skips ids that cannot be resolved instead of stretching to the origin', () => {
    const nodeLookup = buildLookup([sized('a', 100, 100, 50, 50)]);
    expect(getNodesBounds(['missing', 'a'], { nodeLookup })).toEqual({ x: 100, y: 100, width: 50, height: 50 });
  });

  it('returns an empty rect when nothing resolves', () => {
    const nodeLookup = buildLookup([sized('a', 100, 100, 50, 50)]);
    expect(getNodesBounds(['missing'], { nodeLookup })).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('calculateNodePosition with extent: parent', () => {
  it('clamps to an unmeasured parent that has a width and height', () => {
    const parent = { id: 'p', position: { x: 0, y: 0 }, data: {}, width: 100, height: 100 } as NodeBase;
    const child: NodeBase = {
      id: 'c',
      position: { x: 0, y: 0 },
      data: {},
      parentId: 'p',
      extent: 'parent',
      measured: { width: 20, height: 20 },
    };
    const nodeLookup = buildLookup([parent, child]);
    const result = calculateNodePosition({
      nodeId: 'c',
      nextPosition: { x: 500, y: 500 },
      nodeLookup,
      nodeOrigin: [0, 0],
    });
    expect(result.positionAbsolute).toEqual({ x: 80, y: 80 });
  });
});

describe('getNodesInside', () => {
  it('returns only fully-contained nodes, or also partially overlapping ones when partially is set', () => {
    const nodes = buildLookup([sized('inside', 10, 10, 50, 50), sized('overlap', 180, 180, 100, 100)]);
    // handleBounds marks a node as measured; without it getNodesInside force-renders the node.
    nodes.forEach((n) => {
      n.internals.handleBounds = { source: [], target: [] };
    });
    const viewport = { x: 0, y: 0, width: 200, height: 200 };

    const full = getNodesInside(nodes, viewport, [0, 0, 1], false).map((n) => n.id);
    const partial = getNodesInside(nodes, viewport, [0, 0, 1], true).map((n) => n.id);

    expect(full).toEqual(['inside']);
    expect(partial.sort()).toEqual(['inside', 'overlap']);
  });
});

describe('getElementsToRemove', () => {
  const parent: NodeBase = { id: 'parent', data: {}, position: { x: 0, y: 0 } };
  const child: NodeBase = { ...parent, id: 'child', parentId: 'parent' };
  const grandchild: NodeBase = { ...parent, id: 'grandchild', parentId: 'child' };
  const edge: EdgeBase = { id: 'child-grandchild', source: 'child', target: 'grandchild' };

  it.each([
    [parent, grandchild, child],
    [child, parent, grandchild],
  ])('removes the full subtree in input order: %j, %j, %j', async (...nodes) => {
    const result = await getElementsToRemove({ nodesToRemove: [parent], edgesToRemove: [], nodes, edges: [edge] });
    expect(result.nodes).toEqual(nodes);
    expect(result.edges).toEqual([edge]);
  });

  it('preserves protected subtrees but allows explicitly selected descendants to be removed', async () => {
    const nodes = [grandchild, { ...child, deletable: false }, parent];
    const result = await getElementsToRemove({ nodesToRemove: [parent], edgesToRemove: [], nodes, edges: [edge] });
    expect(result.nodes).toEqual([parent]);
    expect(result.edges).toEqual([]);

    const explicit = await getElementsToRemove({ nodesToRemove: [parent, grandchild], edgesToRemove: [], nodes, edges: [edge] });
    expect(explicit.nodes).toEqual([grandchild, parent]);
    expect(explicit.edges).toEqual([edge]);
  });

  it('passes the complete unordered subtree to onBeforeDelete and respects a veto', async () => {
    const nodes = [grandchild, child, parent];
    const onBeforeDelete = vi.fn().mockResolvedValue(false);
    const result = await getElementsToRemove({ nodesToRemove: [parent], edgesToRemove: [], nodes, edges: [edge], onBeforeDelete });
    expect(onBeforeDelete).toHaveBeenCalledWith({ nodes, edges: [edge] });
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('keeps a non-deletable connected edge', async () => {
    const locked: EdgeBase = { ...edge, deletable: false };
    const result = await getElementsToRemove({ nodesToRemove: [parent], edgesToRemove: [], nodes: [parent, child, grandchild], edges: [locked] });
    expect(result.edges).toEqual([]);
  });
});
