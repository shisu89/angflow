import { describe, it, expect, vi } from 'vitest';
import {
  calculateNodePosition,
  fitViewport,
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

describe('fitViewport', () => {
  it('returns clamped: true when the board is too big to fit at minZoom', async () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 100000, 0)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      { padding: 0.1 },
    );
    expect(result.clamped).toBe(true);
    expect(result.zoom).toBeCloseTo(0.5, 5);
  });

  it('returns clamped: false when the board fits inside [minZoom, maxZoom]', async () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 300, 200)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.1, maxZoom: 2 },
      { padding: 0.1 },
    );
    expect(result.clamped).toBe(false);
  });

  it('does not flag clamped when clamped at maxZoom (tiny board, over-zoom)', async () => {
    const nodes = buildLookup([sized('a', 0, 0, 10, 10)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      { padding: 0.1 },
    );
    expect(result.zoom).toBeCloseTo(2, 5);
    expect(result.clamped).toBe(false);
  });

  it('honors an options.minZoom override that loosens the floor', async () => {
    const nodes = buildLookup([sized('a', 0, 0), sized('b', 100000, 0)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      { padding: 0.1, minZoom: 0.0001 },
    );
    expect(result.clamped).toBe(false);
  });

  it('returns { zoom: NaN, clamped: false } when there are no nodes to fit', async () => {
    const nodes = new Map() as NodeLookup<InternalNodeBase<NodeBase>>;
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      {},
    );
    expect(Number.isNaN(result.zoom)).toBe(true);
    expect(result.clamped).toBe(false);
    expect(result.ended).toBe(true);
  });

  it('reports ended: true when the animation runs to the end', async () => {
    const nodes = buildLookup([sized('a', 0, 0)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom: fakePanZoom(), minZoom: 0.5, maxZoom: 2 },
      {},
    );
    expect(result.ended).toBe(true);
  });

  it('reports ended: false when setViewport is interrupted', async () => {
    const nodes = buildLookup([sized('a', 0, 0)]);
    const panZoom = { setViewport: async () => false } as unknown as PanZoomInstance;
    const result = await fitViewport({ nodes, width: 800, height: 600, panZoom, minZoom: 0.5, maxZoom: 2 }, {});
    expect(result.ended).toBe(false);
  });

  it('keeps the viewport when no node is fittable (#6158)', async () => {
    const setViewport = vi.fn(async () => true);
    const panZoom = { setViewport } as unknown as PanZoomInstance;
    const unsized: NodeBase = { id: 'u', position: { x: 0, y: 0 }, data: {} };
    const nodes = buildLookup([unsized]);
    const result = await fitViewport({ nodes, width: 800, height: 600, panZoom, minZoom: 0.5, maxZoom: 2 }, {});
    expect(Number.isNaN(result.zoom)).toBe(true);
    expect(result.clamped).toBe(false);
    expect(result.ended).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();

    const sizedNodes = buildLookup([sized('a', 0, 0)]);
    const r2 = await fitViewport(
      { nodes: sizedNodes, width: 800, height: 600, panZoom, minZoom: 0.5, maxZoom: 2 },
      { nodes: [{ id: 'missing' }] } as never,
    );
    expect(Number.isNaN(r2.zoom)).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();
  });

  it('fits nothing for `nodes: []` (an empty selection is not "all nodes")', async () => {
    const setViewport = vi.fn(async () => true);
    const panZoom = { setViewport } as unknown as PanZoomInstance;
    const nodes = buildLookup([sized('a', 0, 0)]);
    const result = await fitViewport(
      { nodes, width: 800, height: 600, panZoom, minZoom: 0.5, maxZoom: 2 },
      { nodes: [] } as never,
    );
    expect(Number.isNaN(result.zoom)).toBe(true);
    expect(result.ended).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();
  });

  it('fits nothing when every node is hidden', async () => {
    const setViewport = vi.fn(async () => true);
    const panZoom = { setViewport } as unknown as PanZoomInstance;
    const nodes = buildLookup([{ ...sized('a', 0, 0), hidden: true }]);
    const result = await fitViewport({ nodes, width: 800, height: 600, panZoom, minZoom: 0.5, maxZoom: 2 }, {});
    expect(Number.isNaN(result.zoom)).toBe(true);
    expect(result.ended).toBe(true);
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
