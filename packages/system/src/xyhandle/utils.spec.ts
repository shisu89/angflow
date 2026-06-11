import { describe, it, expect } from 'vitest';
import { getFloatingDropTarget, getClosestHandle } from './utils';
import { Position } from '../types/utils';
import type { NodeLookup } from '../types/nodes';

// Minimal internal-node factory for tests.
// Fields not relevant to hit-testing are stubbed with safe defaults.
function makeNode(id: string, opts: {
  x: number; y: number; width: number; height: number;
  zIndex?: number;
  floatingHandles?: Array<{ id: string; type: 'source' | 'target'; position: Position }>;
  fixedHandles?: Array<{ id: string; type: 'source' | 'target'; position: Position }>;
}): any {
  const sourceHandles = [
    ...(opts.fixedHandles?.filter(h => h.type === 'source') ?? []),
    ...(opts.floatingHandles?.filter(h => h.type === 'source') ?? []),
  ].map(h => ({
    id: h.id, nodeId: id, type: h.type, position: h.position,
    x: 0, y: 0, width: 0, height: 0,
    floating: opts.floatingHandles?.some(fh => fh.id === h.id) ? true : undefined,
  }));
  const targetHandles = [
    ...(opts.fixedHandles?.filter(h => h.type === 'target') ?? []),
    ...(opts.floatingHandles?.filter(h => h.type === 'target') ?? []),
  ].map(h => ({
    id: h.id, nodeId: id, type: h.type, position: h.position,
    x: 0, y: 0, width: 0, height: 0,
    floating: opts.floatingHandles?.some(fh => fh.id === h.id) ? true : undefined,
  }));

  return {
    id,
    position: { x: opts.x, y: opts.y },
    width: opts.width,
    height: opts.height,
    measured: { width: opts.width, height: opts.height },
    internals: {
      positionAbsolute: { x: opts.x, y: opts.y },
      z: opts.zIndex ?? 0,
      handleBounds: {
        source: sourceHandles,
        target: targetHandles,
      },
    },
  };
}

function makeLookup(...nodes: any[]): NodeLookup {
  const m = new Map();
  for (const n of nodes) m.set(n.id, n);
  return m as NodeLookup;
}

describe('getFloatingDropTarget', () => {
  it('returns null when pointer is outside all nodes', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 500, y: 500 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('returns null when the hovered node has no floating handles', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      fixedHandles: [{ id: 'fixed', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('returns the sole compatible floating handle when pointer is inside the node', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.id).toBe('auto');
    expect(result?.nodeId).toBe('A');
  });

  it('returns null when only same-type floating handles exist (type mismatch)', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'source', position: Position.Left }],
    }));
    // Drag started from a source handle → looking for a target. Only source floating
    // handles exist → no valid drop.
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('skips the source node (self-connection guard)', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    }));
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      lookup,
      { nodeId: 'A', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('prefers the floating handle at the pointer-side when multiple exist', () => {
    const lookup = makeLookup(makeNode('A', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [
        { id: 'left',  type: 'target', position: Position.Left },
        { id: 'right', type: 'target', position: Position.Right },
      ],
    }));
    // Pointer on the right half (x=75) → dx=25 > 0 → pointer side is Right.
    const result = getFloatingDropTarget(
      { x: 75, y: 25 },
      lookup,
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.id).toBe('right');
  });

  it('prefers the node with highest zIndex when pointer is inside overlapping nodes', () => {
    const lookup = makeLookup(
      makeNode('A', {
        x: 0, y: 0, width: 100, height: 50, zIndex: 1,
        floatingHandles: [{ id: 'a-auto', type: 'target', position: Position.Left }],
      }),
      makeNode('B', {
        x: 20, y: 10, width: 100, height: 50, zIndex: 5,
        floatingHandles: [{ id: 'b-auto', type: 'target', position: Position.Left }],
      }),
    );
    const result = getFloatingDropTarget(
      { x: 50, y: 30 },
      lookup,
      { nodeId: 'C', type: 'source', id: null },
    );
    expect(result?.nodeId).toBe('B');
  });

  it('skips hidden nodes even when the pointer is inside them', () => {
    const hiddenNode = makeNode('H', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    });
    hiddenNode.hidden = true;
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      makeLookup(hiddenNode),
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('prefers a visible node over an overlapping hidden node with higher z', () => {
    const hiddenNode = makeNode('H', {
      x: 0, y: 0, width: 100, height: 50, zIndex: 10,
      floatingHandles: [{ id: 'h', type: 'target', position: Position.Left }],
    });
    hiddenNode.hidden = true;
    const visibleNode = makeNode('V', {
      x: 0, y: 0, width: 100, height: 50, zIndex: 1,
      floatingHandles: [{ id: 'v', type: 'target', position: Position.Left }],
    });
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      makeLookup(hiddenNode, visibleNode),
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.nodeId).toBe('V');
  });
});

describe('getClosestHandle hidden-node guard', () => {
  it('never returns a handle on a hidden node', () => {
    // makeNode's handles have width/height 0, so getHandlePosition(center=true)
    // resolves the handle's absolute position to the node's positionAbsolute
    // (100,100). The node itself needs non-zero measured dims so it survives
    // getNodesWithinDistance's getOverlappingArea(>0) gate. Pointer sits on the
    // handle → distance 0 < connectionRadius → it is the only candidate.
    const hidden = makeNode('H', {
      x: 100, y: 100, width: 10, height: 10,
      fixedHandles: [{ id: 'h', type: 'target', position: Position.Left }],
    });
    hidden.hidden = true;

    const result = getClosestHandle(
      { x: 100, y: 100 },
      50, // connectionRadius
      makeLookup(hidden),
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('still returns a handle on a visible node at the same position', () => {
    const visible = makeNode('V', {
      x: 100, y: 100, width: 10, height: 10,
      fixedHandles: [{ id: 'v', type: 'target', position: Position.Left }],
    });
    const result = getClosestHandle(
      { x: 100, y: 100 },
      50,
      makeLookup(visible),
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.nodeId).toBe('V');
    expect(result?.id).toBe('v');
  });
});
