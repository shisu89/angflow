import { describe, it, expect } from 'vitest';
import { getCollapsedHiddenIds, rewriteEdgesForCollapse, type DisplayEdge } from './collapse';

type N = { id: string; parentId?: string; collapsed?: boolean };
type E = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };

function lookup(nodes: N[]): Map<string, N> {
  return new Map(nodes.map((n) => [n.id, n]));
}

describe('getCollapsedHiddenIds', () => {
  it('hides direct children of a collapsed group but not the group itself', () => {
    const ids = getCollapsedHiddenIds(lookup([
      { id: 'g', collapsed: true },
      { id: 'a', parentId: 'g' },
      { id: 'b', parentId: 'g' },
      { id: 'x' },
    ]));
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('hides nothing when the group is expanded', () => {
    const ids = getCollapsedHiddenIds(lookup([
      { id: 'g', collapsed: false },
      { id: 'a', parentId: 'g' },
    ]));
    expect(ids.size).toBe(0);
  });

  it('hides all descendants across nesting (deep child of a collapsed ancestor)', () => {
    const ids = getCollapsedHiddenIds(lookup([
      { id: 'g', collapsed: true },
      { id: 'sub', parentId: 'g' },
      { id: 'leaf', parentId: 'sub' },
    ]));
    expect(ids).toEqual(new Set(['sub', 'leaf']));
  });
});

describe('rewriteEdgesForCollapse', () => {
  const nodes: N[] = [
    { id: 'g', collapsed: true },
    { id: 'a', parentId: 'g' },
    { id: 'b', parentId: 'g' },
    { id: 'x' },
  ];
  const nl = lookup(nodes);
  const hidden = getCollapsedHiddenIds(nl);

  it('reroutes an outside→member edge to the collapsed box', () => {
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'x', target: 'a' }] as E[], nl, hidden);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('x');
    expect(out[0].target).toBe('g');
    expect(out[0].id).toBe('e1');
    expect(out[0].collapsedFrom).toEqual(['e1']);
  });

  it('drops an edge internal to one collapsed group', () => {
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'a', target: 'b' }] as E[], nl, hidden);
    expect(out).toHaveLength(0);
  });

  it('dedupes parallels created by rerouting into a merged render-only edge', () => {
    const out = rewriteEdgesForCollapse(
      [{ id: 'e1', source: 'x', target: 'a' }, { id: 'e2', source: 'x', target: 'b' }] as E[],
      nl,
      hidden,
    );
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('x');
    expect(out[0].target).toBe('g');
    expect(out[0].id).toBe('__collapsed:x->g');
    expect(out[0].collapsedFrom).toEqual(['e1', 'e2']);
  });

  it('passes untouched edges through with original identity', () => {
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'x', target: 'y' }] as E[], lookup([{ id: 'x' }, { id: 'y' }]), new Set());
    expect(out[0].id).toBe('e1');
    expect(out[0].collapsedFrom).toBeUndefined();
  });

  it('reroutes to the OUTERMOST collapsed ancestor under nesting', () => {
    const nlNest = lookup([
      { id: 'g', collapsed: true },
      { id: 'sub', parentId: 'g', collapsed: true },
      { id: 'leaf', parentId: 'sub' },
      { id: 'x' },
    ]);
    const out = rewriteEdgesForCollapse([{ id: 'e1', source: 'x', target: 'leaf' }] as E[], nlNest, getCollapsedHiddenIds(nlNest));
    expect(out[0].target).toBe('g');
  });
});
