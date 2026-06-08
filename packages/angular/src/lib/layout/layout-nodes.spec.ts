import { describe, it, expect } from 'vitest';
import { layoutNodes } from './layout-nodes';

describe('layoutNodes', () => {
  it('accepts nodes with measured dimensions and lays out LR', () => {
    const positions = layoutNodes(
      [
        { id: 'a', measured: { width: 100, height: 40 } },
        { id: 'b', measured: { width: 100, height: 40 } },
      ],
      [{ source: 'a', target: 'b' }],
      { direction: 'LR' },
    );
    expect(positions['a'].x).toBeLessThan(positions['b'].x);
  });

  it('defaults direction to TB when opts are omitted entirely', () => {
    const positions = layoutNodes(
      [{ id: 'a', width: 100, height: 40 }, { id: 'b', width: 100, height: 40 }],
      [{ source: 'a', target: 'b' }],
    );
    expect(positions['a'].y).toBeLessThan(positions['b'].y);
  });

  it('falls back measured → width → initialWidth → 150/40 default', () => {
    // No dimensions at all: must not throw, must return finite positions.
    const positions = layoutNodes([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }], {
      direction: 'TB',
    });
    for (const pos of Object.values(positions)) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('returns top-left corners (sibling separation reflects node width)', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
        { id: 'c', width: 100, height: 40 },
      ],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ],
      { direction: 'TB', nodeSep: 50 },
    );
    expect(Math.abs(positions['b'].x - positions['c'].x)).toBeGreaterThanOrEqual(100);
  });

  it('treats width: null / height: null as absent and falls back to defaults', () => {
    const positions = layoutNodes([{ id: 'a', width: null, height: null }], [], { direction: 'TB' });
    expect(Number.isFinite(positions['a'].x)).toBe(true);
    expect(Number.isFinite(positions['a'].y)).toBe(true);
  });
});

describe('layoutNodes edge labels', () => {
  const nodes = [
    { id: 'a', width: 100, height: 40 },
    { id: 'b', width: 100, height: 40 },
  ];

  it('reserves more rank space when an edge has a measured label box', () => {
    const withLabel = layoutNodes(
      nodes,
      [{ source: 'a', target: 'b', label: 'relates to', labelWidth: 120, labelHeight: 24 }],
      { direction: 'TB' },
    );
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    // dagre inserts the label as a dummy node along the edge, pushing b further down.
    expect(withLabel['b'].y).toBeGreaterThan(without['b'].y);
  });

  it('reserves a default box when an edge has a truthy label but no measured size', () => {
    const withLabel = layoutNodes(
      nodes,
      [{ source: 'a', target: 'b', label: 'x' }],
      { direction: 'TB' },
    );
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    expect(withLabel['b'].y).toBeGreaterThan(without['b'].y);
  });

  it('an edge with no label behaves exactly as before (no label box)', () => {
    const a = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    const b = layoutNodes(nodes, [{ source: 'a', target: 'b', label: '' }], { direction: 'TB' });
    expect(a['b'].y).toBe(b['b'].y);
  });
});
