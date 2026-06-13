import { describe, it, expect } from 'vitest';
import { fitViewport } from './graph';
import { adoptUserNodes } from './store';
import type { NodeBase, InternalNodeBase, NodeLookup, ParentLookup, PanZoomInstance } from '../types';

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
  });
});
