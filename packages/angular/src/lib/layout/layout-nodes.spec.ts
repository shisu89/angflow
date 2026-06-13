import { describe, it, expect } from 'vitest';
import { layoutNodes, connectedComponents, packComponentsIntoGrid } from './layout-nodes';

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

  it('chain-into-cycle (d→a where a→b→a): d keeps its parent, all finite', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 40, height: 40, parentId: 'b' },
        { id: 'b', width: 40, height: 40, parentId: 'a' },
        { id: 'd', width: 40, height: 40, parentId: 'a' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['a', 'b', 'd']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });
});

describe('connectedComponents', () => {
  it('groups ids joined by edges and isolates the rest', () => {
    const comps = connectedComponents(
      ['a', 'b', 'c', 'd'],
      [{ source: 'a', target: 'b' }],
    );
    const sets = comps.map((c) => new Set(c));
    expect(comps).toHaveLength(3);
    expect(sets.some((s) => s.has('a') && s.has('b'))).toBe(true);
    expect(sets.some((s) => s.size === 1 && s.has('c'))).toBe(true);
    expect(sets.some((s) => s.size === 1 && s.has('d'))).toBe(true);
  });

  it('returns one component when all ids are connected', () => {
    const comps = connectedComponents(
      ['a', 'b', 'c'],
      [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }],
    );
    expect(comps).toHaveLength(1);
  });

  it('ignores edges whose endpoints are not in the id list', () => {
    const comps = connectedComponents(['a', 'b'], [{ source: 'a', target: 'ghost' }]);
    expect(comps).toHaveLength(2);
  });
});

describe('packComponentsIntoGrid', () => {
  const size = () => ({ width: 100, height: 100 });

  it('returns positions unchanged for a single component', () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const out = packComponentsIntoGrid(positions, () => size(), [['a', 'b']], {});
    expect(out).toEqual(positions);
  });

  it('packs many disconnected single-node components into a compact grid (not a line)', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `n${i}`);
    const positions = Object.fromEntries(ids.map((id, i) => [id, { x: i * 500, y: i * 500 }]));
    const components = ids.map((id) => [id]);
    const out = packComponentsIntoGrid(positions, () => size(), components, { nodeSep: 50 });
    const xs = ids.map((id) => out[id].x);
    const ys = ids.map((id) => out[id].y);
    const bboxW = Math.max(...xs) - Math.min(...xs) + 100;
    const bboxH = Math.max(...ys) - Math.min(...ys) + 100;
    expect(bboxW).toBeLessThan(700);
    expect(bboxH).toBeLessThan(700);
  });

  it('preserves each component\'s internal layout (relative offsets) while repacking', () => {
    const positions = {
      a1: { x: 0, y: 0 }, a2: { x: 20, y: 0 },
      b1: { x: 9999, y: 9999 }, b2: { x: 10019, y: 9999 },
    };
    const out = packComponentsIntoGrid(positions, () => size(), [['a1', 'a2'], ['b1', 'b2']], { nodeSep: 50 });
    expect(out.a2.x - out.a1.x).toBe(20);
    expect(out.b2.x - out.b1.x).toBe(20);
  });

  it('ignores empty components and never emits NaN positions', () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 500, y: 500 } };
    const out = packComponentsIntoGrid(positions, () => size(), [['a'], [], ['b']], { nodeSep: 50 });
    for (const id of ['a', 'b']) {
      expect(Number.isFinite(out[id].x)).toBe(true);
      expect(Number.isFinite(out[id].y)).toBe(true);
    }
  });
});

describe('layoutNodes packing (feedback #12)', () => {
  const bbox = (positions: Record<string, { x: number; y: number }>, sizeById: Record<string, number>) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [id, p] of Object.entries(positions)) {
      const s = sizeById[id] ?? 0;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s); maxY = Math.max(maxY, p.y + s);
    }
    return { w: maxX - minX, h: maxY - minY };
  };

  it('grid-packs many disconnected ungrouped nodes instead of cascading them', () => {
    const nodes = Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, width: 100, height: 100 }));
    const positions = layoutNodes(nodes, [], { direction: 'LR' });
    const sizeById = Object.fromEntries(nodes.map((n) => [n.id, 100]));
    const { w, h } = bbox(positions, sizeById);
    expect(w).toBeLessThan(1200);
    expect(h).toBeLessThan(1200);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(3);
  });

  it('keeps a spatially-grouped, internally-disconnected canvas compact (no diagonal staircase)', () => {
    const nodes: Array<{ id: string; width: number; height: number; parentId?: string }> = [];
    for (let g = 0; g < 4; g++) {
      nodes.push({ id: `g${g}`, width: 10, height: 10 });
      for (let m = 0; m < 4; m++) nodes.push({ id: `g${g}_m${m}`, width: 80, height: 80, parentId: `g${g}` });
    }
    const positions = layoutNodes(nodes, [], { direction: 'LR' });
    for (const id of Object.keys(positions)) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
    const groupOnly = Object.fromEntries(Object.entries(positions).filter(([id]) => /^g\d+$/.test(id)));
    const sizeById = Object.fromEntries(Object.keys(groupOnly).map((id) => [id, 10]));
    const { w, h } = bbox(groupOnly, sizeById);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(4);
  });

  it('clusters each group\'s members within its own region', () => {
    const nodes = [
      { id: 'gA', width: 10, height: 10 },
      { id: 'gB', width: 10, height: 10 },
      { id: 'a1', width: 40, height: 40, parentId: 'gA' },
      { id: 'a2', width: 40, height: 40, parentId: 'gA' },
      { id: 'b1', width: 40, height: 40, parentId: 'gB' },
      { id: 'b2', width: 40, height: 40, parentId: 'gB' },
    ];
    const positions = layoutNodes(nodes, [], { direction: 'LR' });
    const aXs = [positions.a1.x, positions.a2.x];
    const bXs = [positions.b1.x, positions.b2.x];
    const separated = Math.max(...aXs) < Math.min(...bXs) || Math.max(...bXs) < Math.min(...aXs);
    expect(separated).toBe(true);
  });

  it('places members inside their group box (padding + header offset)', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'm', width: 60, height: 60, parentId: 'g' },
    ];
    const positions = layoutNodes(nodes, [], { direction: 'TB', groupPadding: 24, groupHeaderHeight: 40 });
    expect(positions.m.x - positions.g.x).toBeCloseTo(24, 5);
    expect(positions.m.y - positions.g.y).toBeCloseTo(64, 5);
  });

  it('nests: a sub-group\'s members land inside the sub-group, inside the outer group', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'sub', width: 10, height: 10, parentId: 'g' },
      { id: 'leaf', width: 40, height: 40, parentId: 'sub' },
    ];
    const positions = layoutNodes(nodes, [], { direction: 'TB', groupPadding: 24, groupHeaderHeight: 40 });
    expect(positions.leaf.x).toBeGreaterThan(positions.sub.x);
    expect(positions.leaf.y).toBeGreaterThan(positions.sub.y);
    expect(positions.sub.x).toBeGreaterThanOrEqual(positions.g.x);
    expect(positions.sub.y).toBeGreaterThan(positions.g.y);
  });

  it('packComponents:false leaves dagre\'s spread cascade; packing makes it compact', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, width: 100, height: 100 }));
    const packed = layoutNodes(nodes, [], { direction: 'LR' });
    const cascaded = layoutNodes(nodes, [], { direction: 'LR', packComponents: false });
    const span = (pos: Record<string, { x: number; y: number }>) => {
      const xs = Object.values(pos).map((p) => p.x);
      const ys = Object.values(pos).map((p) => p.y);
      return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    };
    // Packing collapses dagre's disconnected-component cascade into a compact grid.
    expect(span(packed)).toBeLessThan(span(cascaded));
  });
});
