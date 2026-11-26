import { describe, it, expect } from 'vitest';
import { NodeChangeset, EdgeChangeset } from './index';
import { applyNodeChanges } from './apply';
import { getSelectionChanges, getDeselectionChanges } from './utils';
import { selectionChange, positionChange, dimensionChange, removeChange, addChange } from './create';
import type { NodeChange } from './types';
import type { NodeBase, EdgeBase } from '../types';

const node = (id: string, extra: Partial<NodeBase> = {}): NodeBase => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});
const edge = (id: string, extra: Partial<EdgeBase> = {}): EdgeBase => ({
  id,
  source: 'a',
  target: 'b',
  ...extra,
});

describe('Changeset collection', () => {
  it('adds a single change and an array', () => {
    const cs = new NodeChangeset();
    cs.add(selectionChange('1', true));
    cs.add([positionChange('2', { x: 1, y: 1 }), selectionChange('2', true)]);
    expect(cs.toArray()).toHaveLength(3);
  });

  it('iterates adds first, then per element in insertion order; toArray matches', () => {
    const cs = new NodeChangeset();
    const s1 = selectionChange('1', true);
    const p2 = positionChange('2', { x: 1, y: 1 });
    const p1 = positionChange('1', { x: 2, y: 2 });
    const a = addChange(node('3'));
    cs.add([s1, p2, p1, a]);
    expect([...cs]).toEqual([a, s1, p1, p2]);
    expect(cs.toArray()).toEqual([a, s1, p1, p2]);
  });

  it('getByType returns matching changes, add changes, and [] for unseen types', () => {
    const cs = new NodeChangeset();
    const a = addChange(node('3'));
    cs.add([selectionChange('1', true), positionChange('1', { x: 1, y: 1 }), a]);
    expect(cs.getByType('select')).toHaveLength(1);
    expect(cs.getByType('add')).toEqual([a]);
    expect(cs.getByType('dimensions')).toEqual([]);
  });

  it('getForElement / removeForElement', () => {
    const cs = new NodeChangeset();
    cs.add([selectionChange('1', true), selectionChange('2', true)]);
    expect(cs.getForElement('1')).toHaveLength(1);
    expect(cs.getForElement('nope')).toEqual([]);
    cs.removeForElement('1');
    expect(cs.getForElement('1')).toEqual([]);
    expect(cs.getForElement('2')).toHaveLength(1);
  });

  it('remove by reference, last change leaves the changeset empty', () => {
    const cs = new NodeChangeset();
    const c1 = selectionChange('1', true);
    const c2 = positionChange('1', { x: 1, y: 1 });
    cs.add([c1, c2]);
    cs.remove(selectionChange('1', true)); // different reference: no-op
    expect(cs.getForElement('1')).toHaveLength(2);
    cs.remove(c1);
    expect(cs.getForElement('1')).toEqual([c2]);
    expect(cs.isEmpty()).toBe(false);
    cs.remove(c2);
    expect(cs.isEmpty()).toBe(true);
  });

  it('clear and isEmpty', () => {
    const cs = new NodeChangeset();
    expect(cs.isEmpty()).toBe(true);
    cs.add([selectionChange('1', true), addChange(node('2'))]);
    expect(cs.isEmpty()).toBe(false);
    cs.clear();
    expect(cs.isEmpty()).toBe(true);
    expect(cs.toArray()).toEqual([]);
    expect(cs.getByType('select')).toEqual([]);
  });

  it('getNewNodes / getNewEdges return the added items', () => {
    const ncs = new NodeChangeset([addChange(node('n1')), addChange(node('n2'))]);
    expect(ncs.getNewNodes().map((n) => n.id)).toEqual(['n1', 'n2']);
    const ecs = new EdgeChangeset([addChange(edge('e1'))]);
    expect(ecs.getNewEdges().map((e) => e.id)).toEqual(['e1']);
  });
});

describe('Changeset.applyTo', () => {
  it('a remove anywhere in the batch drops the element', () => {
    const cs = new NodeChangeset([removeChange('1'), selectionChange('1', true)]);
    expect(cs.applyTo([node('1'), node('2')]).map((n) => n.id)).toEqual(['2']);
    const cs2 = new NodeChangeset([selectionChange('1', true), removeChange('1')]);
    expect(cs2.applyTo([node('1'), node('2')]).map((n) => n.id)).toEqual(['2']);
  });

  it('replace followed by position applies both', () => {
    const cs = new NodeChangeset([
      { id: '1', type: 'replace', item: node('1', { data: { r: true } }) },
      positionChange('1', { x: 5, y: 6 }),
    ]);
    const [n] = cs.applyTo([node('1')]);
    expect(n.data).toEqual({ r: true });
    expect(n.position).toEqual({ x: 5, y: 6 });
  });

  it('an add for an existing id keeps the existing element', () => {
    const existing = node('1', { data: { v: 'old' } });
    const cs = new NodeChangeset([addChange(node('1', { data: { v: 'new' } }))]);
    const result = cs.applyTo([existing]);
    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual({ v: 'old' });
  });

  it('an add with index appends', () => {
    const cs = new NodeChangeset([{ id: '3', type: 'add', item: node('3'), index: 0 }]);
    expect(cs.applyTo([node('1'), node('2')]).map((n) => n.id)).toEqual(['1', '2', '3']);
  });

  it('preserves array order and element identity for unchanged elements', () => {
    const a = node('a');
    const b = node('b');
    const c = node('c');
    const result = new NodeChangeset([selectionChange('b', true)]).applyTo([a, b, c]);
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(result[0]).toBe(a);
    expect(result[2]).toBe(c);
    expect(result[1]).not.toBe(b);
    expect(result[1].selected).toBe(true);
  });

  it("applies 'update' with Object.assign", () => {
    const [n] = new NodeChangeset([{ id: '1', type: 'update', item: { hidden: true, position: { x: 9, y: 9 } } }]).applyTo(
      [node('1')]
    );
    expect(n.hidden).toBe(true);
    expect(n.position).toEqual({ x: 9, y: 9 });
  });

  it("applies 'data' as a merge, or a replacement with replace: true", () => {
    const merged = new NodeChangeset<NodeBase>([{ id: '1', type: 'data', data: { b: 2 } }]).applyTo([
      node('1', { data: { a: 1 } }),
    ]);
    expect(merged[0].data).toEqual({ a: 1, b: 2 });
    const replaced = new NodeChangeset<NodeBase>([{ id: '1', type: 'data', data: { b: 2 }, replace: true }]).applyTo([
      node('1', { data: { a: 1 } }),
    ]);
    expect(replaced[0].data).toEqual({ b: 2 });
  });

  it('applies dimensions with setAttributes variants and resizing', () => {
    const dims = { width: 10, height: 20 };
    const run = (setAttributes?: boolean | 'width' | 'height', resizing?: boolean) =>
      new NodeChangeset([{ ...dimensionChange('1', dims), setAttributes, resizing }]).applyTo([node('1')])[0];

    const none = run();
    expect(none.measured).toEqual(dims);
    expect(none.width).toBeUndefined();
    expect(none.height).toBeUndefined();

    const both = run(true);
    expect(both.width).toBe(10);
    expect(both.height).toBe(20);

    const w = run('width');
    expect(w.width).toBe(10);
    expect(w.height).toBeUndefined();

    const h = run('height');
    expect(h.width).toBeUndefined();
    expect(h.height).toBe(20);

    expect(run(undefined, true).resizing).toBe(true);
    expect(run(undefined, false).resizing).toBe(false);
  });

  it('a DimensionChange with initial: true type-checks and applies like any other', () => {
    const change: NodeChange = { id: '1', type: 'dimensions', dimensions: { width: 5, height: 6 }, initial: true };
    const [n] = applyNodeChanges([node('1')], new NodeChangeset([change]));
    expect(n.measured).toEqual({ width: 5, height: 6 });
  });
});

describe('selection helpers', () => {
  const items = new Map([
    ['a', { id: 'a', selected: true }],
    ['b', { id: 'b', selected: false }],
    ['c', { id: 'c' }],
  ]);

  it('getSelectionChanges emits only differences and skips undefined -> unselected', () => {
    const changes = getSelectionChanges(items, new Set(['b']));
    expect(changes).toEqual([selectionChange('a', false), selectionChange('b', true)]);
  });

  it('getSelectionChanges selects an undefined item when it will be selected', () => {
    expect(getSelectionChanges(items, new Set(['a', 'c']))).toEqual([selectionChange('c', true)]);
  });

  it('getDeselectionChanges deselects only selected items from the given ids', () => {
    expect(getDeselectionChanges(items, new Set(['a', 'b']))).toEqual([selectionChange('a', false)]);
    expect(getDeselectionChanges(items, new Set(['b']))).toEqual([]);
  });

  it('getDeselectionChanges with null means all', () => {
    expect(getDeselectionChanges(items, null)).toEqual([selectionChange('a', false)]);
  });
});
