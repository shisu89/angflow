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

  it('reserves space when only one explicit label dimension is given (no label)', () => {
    const withWidthOnly = layoutNodes(
      nodes,
      [{ source: 'a', target: 'b', labelWidth: 120 }],
      { direction: 'TB' },
    );
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    expect(withWidthOnly['b'].y).toBeGreaterThan(without['b'].y);
  });
});

describe('layoutNodes compound groups', () => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it('clusters grouped members (interleaved insertion would scatter when flat)', () => {
    const positions = layoutNodes(
      [
        { id: 'gA', width: 10, height: 10 },
        { id: 'gB', width: 10, height: 10 },
        { id: 'a1', width: 40, height: 40, parentId: 'gA' },
        { id: 'b1', width: 40, height: 40, parentId: 'gB' },
        { id: 'a2', width: 40, height: 40, parentId: 'gA' },
        { id: 'b2', width: 40, height: 40, parentId: 'gB' },
      ],
      [],
      { direction: 'TB' },
    );
    expect(dist(positions['a1'], positions['a2'])).toBeLessThan(dist(positions['a1'], positions['b1']));
    expect(dist(positions['b1'], positions['b2'])).toBeLessThan(dist(positions['b1'], positions['a1']));
    // Structural: the two clusters don't interleave on x — every member of one
    // group is entirely to one side of the other group.
    const aXs = [positions['a1'].x, positions['a2'].x];
    const bXs = [positions['b1'].x, positions['b2'].x];
    const groupsSeparated = Math.max(...aXs) < Math.min(...bXs) || Math.max(...bXs) < Math.min(...aXs);
    expect(groupsSeparated).toBe(true);
  });

  it('treats a node whose parentId is not in the set as top-level (no throw, finite)', () => {
    const positions = layoutNodes([{ id: 'c', width: 40, height: 40, parentId: 'ghost' }], [], { direction: 'TB' });
    expect(Number.isFinite(positions['c'].x)).toBe(true);
    expect(Number.isFinite(positions['c'].y)).toBe(true);
  });

  it('handles nested groups (g → sub → leaf): all finite', () => {
    const positions = layoutNodes(
      [
        { id: 'g', width: 10, height: 10 },
        { id: 'sub', width: 10, height: 10, parentId: 'g' },
        { id: 'leaf', width: 40, height: 40, parentId: 'sub' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['g', 'sub', 'leaf']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it('skips dangling edges (endpoint not in node set) — no phantom-node distortion', () => {
    const nodes = [
      { id: 'a', width: 40, height: 40 },
      { id: 'b', width: 40, height: 40 },
    ];
    const withDangling = layoutNodes(nodes, [{ source: 'a', target: 'b' }, { source: 'a', target: 'ghost' }], { direction: 'TB' });
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    expect(withDangling).toEqual(without);
  });

  it('skips dangling edges in compound mode without throwing', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'a', width: 40, height: 40, parentId: 'g' },
      { id: 'b', width: 40, height: 40, parentId: 'g' },
    ];
    const withDangling = layoutNodes(
      nodes,
      [{ source: 'a', target: 'b' }, { source: 'a', target: 'ghost' }],
      { direction: 'TB' },
    );
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    expect(withDangling).toEqual(without);
  });

  it('treats a self-parent (parentId === id) as top-level without throwing', () => {
    const positions = layoutNodes([{ id: 's', width: 40, height: 40, parentId: 's' }], [], { direction: 'TB' });
    expect(Number.isFinite(positions['s'].x)).toBe(true);
    expect(Number.isFinite(positions['s'].y)).toBe(true);
  });

  it('does not throw when an edge targets a group node (x → group)', () => {
    const positions = layoutNodes(
      [
        { id: 'g', width: 10, height: 10 },
        { id: 'm', width: 40, height: 40, parentId: 'g' },
        { id: 'x', width: 40, height: 40 },
      ],
      [{ source: 'x', target: 'g' }],
      { direction: 'TB' },
    );
    for (const id of ['g', 'm', 'x']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it('does not throw when a member connects to its own group (member → group)', () => {
    const positions = layoutNodes(
      [
        { id: 'g', width: 10, height: 10 },
        { id: 'm', width: 40, height: 40, parentId: 'g' },
      ],
      [{ source: 'm', target: 'g' }],
      { direction: 'TB' },
    );
    expect(Number.isFinite(positions['m'].x)).toBe(true);
    expect(Number.isFinite(positions['g'].y)).toBe(true);
  });

  it('is deterministic: the same input twice yields identical output', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'a', width: 40, height: 40, parentId: 'g' },
      { id: 'b', width: 40, height: 40, parentId: 'g' },
      { id: 'x', width: 40, height: 40 },
    ];
    const edges = [{ source: 'x', target: 'a' }, { source: 'a', target: 'b' }];
    expect(layoutNodes(nodes, edges, { direction: 'TB' }))
      .toEqual(layoutNodes(nodes, edges, { direction: 'TB' }));
  });

  it('treats a 2-cycle (A→B→A) as top-level without throwing', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 40, height: 40, parentId: 'b' },
        { id: 'b', width: 40, height: 40, parentId: 'a' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['a', 'b']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it('treats a 3-cycle (A→B→C→A) as top-level, keeping unrelated valid groups intact', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 40, height: 40, parentId: 'b' },
        { id: 'b', width: 40, height: 40, parentId: 'c' },
        { id: 'c', width: 40, height: 40, parentId: 'a' },
        { id: 'g', width: 10, height: 10 },
        { id: 'm', width: 40, height: 40, parentId: 'g' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['a', 'b', 'c', 'g', 'm']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });
});
