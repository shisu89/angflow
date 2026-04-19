import { describe, it, expect } from 'vitest';
import { getFloatingDropTarget } from './utils';
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
});
