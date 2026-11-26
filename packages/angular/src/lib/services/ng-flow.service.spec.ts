import { describe, it, expect, beforeEach, vi, onTestFinished } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, DOCUMENT, effect } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
import { layoutNodes } from '../layout/layout-nodes';
import type { Node, Edge } from '../types';
import type { NodeChangeset, EdgeChangeset } from '@angflow/system';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', ...overrides };
}

function makeEdge(id: string, source: string, target: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source, target, ...overrides };
}

describe('NgFlowService', () => {
  let service: NgFlowService;
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });

    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  // ── getEdge uses edgeLookup (O(1)) not edges().find() (O(n)) ─────────

  describe('getEdge uses edgeLookup', () => {
    it('returns edge from edgeLookup, not from iterating edges array', () => {
      service.setEdges([makeEdge('e1', '1', '2'), makeEdge('e2', '2', '3')]);

      // Verify it works
      expect(service.getEdge('e1')?.source).toBe('1');
      expect(service.getEdge('e2')?.target).toBe('3');
      expect(service.getEdge('missing')).toBeUndefined();
    });

    it('reflects updates after setEdges replaces data', () => {
      service.setEdges([makeEdge('e1', '1', '2')]);
      service.setEdges([makeEdge('e1', 'x', 'y')]);
      // edgeLookup should point to the new edge data
      expect(service.getEdge('e1')?.source).toBe('x');
    });
  });

  // ── deleteElements: cascading edge deletion ───────────────────────────

  describe('deleteElements cascading', () => {
    beforeEach(() => {
      service.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      service.setEdges([
        makeEdge('ab', 'a', 'b'),
        makeEdge('bc', 'b', 'c'),
        makeEdge('ac', 'a', 'c'),
      ]);
    });

    it('deleting a node also deletes all edges connected to it', async () => {
      const result = await service.deleteElements({ nodes: [{ id: 'b' } as Node] });

      expect(result.deletedNodes.map(n => n.id)).toEqual(['b']);
      // Edges ab (source=b target side) and bc (source=b) should both be deleted
      expect(result.deletedEdges.map(e => e.id).sort()).toEqual(['ab', 'bc']);
      // Only edge ac remains
      expect(store.edges()).toHaveLength(1);
      expect(store.edges()[0].id).toBe('ac');
    });

    it('deleting multiple nodes cascades correctly', async () => {
      const result = await service.deleteElements({
        nodes: [{ id: 'a' } as Node, { id: 'c' } as Node],
      });

      expect(result.deletedNodes).toHaveLength(2);
      // All 3 edges connect to a or c, so all should be deleted
      expect(result.deletedEdges).toHaveLength(3);
      expect(store.edges()).toHaveLength(0);
    });

    it('deleting an edge alone does not affect nodes', async () => {
      const result = await service.deleteElements({ edges: [{ id: 'ab' } as Edge] });
      expect(result.deletedEdges).toHaveLength(1);
      expect(store.nodes()).toHaveLength(3);
      expect(store.edges()).toHaveLength(2);
    });

    it('fires onNodesDelete/onEdgesDelete/onDelete for programmatic deletion', async () => {
      const onNodesDelete = vi.fn();
      const onEdgesDelete = vi.fn();
      const onDelete = vi.fn();
      store.onNodesDelete = onNodesDelete;
      store.onEdgesDelete = onEdgesDelete;
      store.onDelete = onDelete;

      await service.deleteElements({ nodes: [{ id: 'b' } as Node] });

      expect(onNodesDelete).toHaveBeenCalledTimes(1);
      expect(onNodesDelete.mock.calls[0][0].map((n: Node) => n.id)).toEqual(['b']);
      expect(onEdgesDelete).toHaveBeenCalledTimes(1);
      expect(onEdgesDelete.mock.calls[0][0].map((e: Edge) => e.id).sort()).toEqual(['ab', 'bc']);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('onBeforeDelete returning false vetoes the entire deletion', async () => {
      store.onBeforeDelete = async () => false;

      const result = await service.deleteElements({ nodes: [{ id: 'a' } as Node] });

      expect(result.deletedNodes).toEqual([]);
      expect(result.deletedEdges).toEqual([]);
      expect(store.nodes()).toHaveLength(3);
      expect(store.edges()).toHaveLength(3);
    });

    it('onBeforeDelete receives the full set including cascaded edges', async () => {
      const spy = vi.fn().mockResolvedValue(true);
      store.onBeforeDelete = spy;

      await service.deleteElements({ nodes: [{ id: 'b' } as Node] });

      expect(spy).toHaveBeenCalledOnce();
      const { nodes, edges } = spy.mock.calls[0][0];
      expect(nodes.map((n: Node) => n.id)).toEqual(['b']);
      expect(edges.map((e: Edge) => e.id).sort()).toEqual(['ab', 'bc']);
    });

    it('routes deletions through the change pipeline (emits remove changes)', async () => {
      const nodeChanges: unknown[] = [];
      const edgeChanges: unknown[] = [];
      store.onNodesChange = (c) => nodeChanges.push(...c.toArray());
      store.onEdgesChange = (c) => edgeChanges.push(...c.toArray());

      await service.deleteElements({ nodes: [{ id: 'b' } as Node] });

      expect(nodeChanges).toEqual([{ id: 'b', type: 'remove' }]);
      expect(edgeChanges).toEqual(
        expect.arrayContaining([
          { id: 'ab', type: 'remove' },
          { id: 'bc', type: 'remove' },
        ]),
      );
      expect(store.nodes().map((n) => n.id).sort()).toEqual(['a', 'c']);
      expect(store.edges().map((e) => e.id)).toEqual(['ac']);
    });

    it('change middleware can intercept deleteElements removals', async () => {
      // Register middleware that filters out all remove changes → nothing deleted
      service.onNodesChangeMiddleware('block-remove', (changes) =>
        changes.filter((c) => c.type !== 'remove'),
      );
      service.onEdgesChangeMiddleware('block-remove', (changes) =>
        changes.filter((c) => c.type !== 'remove'),
      );

      await service.deleteElements({ nodes: [{ id: 'b' } as Node] });

      // Middleware blocked the remove changes, so nodes and edges are unchanged
      expect(store.nodes().map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
      expect(store.edges().map((e) => e.id).sort()).toEqual(['ab', 'ac', 'bc']);
    });
  });

  describe('deleteElements via getElementsToRemove', () => {
    it('cascades to descendants (3 levels, child listed before parent), output in store order', async () => {
      service.setNodes([
        makeNode('gc', { parentId: 'c' }), makeNode('c', { parentId: 'p' }), makeNode('p'), makeNode('other'),
      ]);
      service.setEdges([makeEdge('c-other', 'c', 'other')]);
      const res = await service.deleteElements({ nodes: [{ id: 'p' }] });
      expect(res.deletedNodes.map((n) => n.id)).toEqual(['gc', 'c', 'p']);
      expect(res.deletedEdges.map((e) => e.id)).toEqual(['c-other']);
      expect(store.nodes().map((n) => n.id)).toEqual(['other']);
    });

    it('respects deletable: false on nodes and edges', async () => {
      service.setNodes([makeNode('a', { deletable: false }), makeNode('b'), makeNode('c')]);
      service.setEdges([makeEdge('bc', 'b', 'c', { deletable: false }), makeEdge('ac', 'a', 'c')]);
      const res = await service.deleteElements({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ id: 'bc' }] });
      expect(res.deletedNodes.map((n) => n.id)).toEqual(['b']);
      expect(res.deletedEdges).toEqual([]); // bc is locked; ac belongs to the locked node a
      expect(store.edges().map((e) => e.id).sort()).toEqual(['ac', 'bc']); // bc survives with a dangling source
    });

    it('a non-deletable child of a deleted parent survives orphaned; the store warns, never throws', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warn.mockRestore());
      service.setNodes([makeNode('p'), makeNode('locked', { parentId: 'p', deletable: false }), makeNode('gc', { parentId: 'locked' })]);
      const res = await service.deleteElements({ nodes: [{ id: 'p' }] });
      expect(res.deletedNodes.map((n) => n.id)).toEqual(['p']);
      expect(store.nodes().map((n) => n.id)).toEqual(['locked', 'gc']);
      expect(service.getNode('locked')?.parentId).toBe('p');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"locked"'));
    });

    it('onBeforeDelete: sync false vetoes, true deletes the matched set', async () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      store.onBeforeDelete = () => false;
      expect(await service.deleteElements({ nodes: [{ id: 'a' }] })).toEqual({ deletedNodes: [], deletedEdges: [] });
      store.onBeforeDelete = () => true;
      expect((await service.deleteElements({ nodes: [{ id: 'a' }] })).deletedNodes.map((n) => n.id)).toEqual(['a']);
    });

    it('onBeforeDelete may narrow the set ({ nodes, edges }, sync or async), used verbatim', async () => {
      service.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      service.setEdges([makeEdge('ab', 'a', 'b'), makeEdge('bc', 'b', 'c')]);
      store.onBeforeDelete = async ({ edges }) => ({ nodes: [], edges: edges.filter((e) => e.id === 'ab') });
      const res = await service.deleteElements({ edges: [{ id: 'ab' }, { id: 'bc' }] });
      expect(res.deletedEdges.map((e) => e.id)).toEqual(['ab']);
      expect(store.edges().map((e) => e.id)).toEqual(['bc']);
    });

    it('onBeforeDelete may narrow synchronously', async () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      store.onBeforeDelete = ({ nodes }) => ({ nodes: nodes.filter((n) => n.id === 'a'), edges: [] });
      const res = await service.deleteElements({ nodes: [{ id: 'a' }, { id: 'b' }] });
      expect(res.deletedNodes.map((n) => n.id)).toEqual(['a']);
      expect(store.nodes().map((n) => n.id)).toEqual(['b']);
    });

    it.each([
      ['throws synchronously', () => { throw new Error('boom'); }],
      ['rejects', () => Promise.reject(new Error('boom'))],
    ])('a hook that %s rejects deleteElements with no changes and no callbacks', async (_n, hook) => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      service.setEdges([makeEdge('ab', 'a', 'b')]);
      const cb = vi.fn();
      store.onNodesDelete = store.onEdgesDelete = store.onDelete = store.onNodesChange = store.onEdgesChange = cb;
      store.onBeforeDelete = hook as never;
      await expect(service.deleteElements({ nodes: [{ id: 'a' }] })).rejects.toThrow('boom');
      expect(store.nodes()).toHaveLength(2);
      expect(store.edges()).toHaveLength(1);
      expect(cb).not.toHaveBeenCalled();
    });

    it('fires each on*Delete once, before its changes, in upstream order', async () => {
      service.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      service.setEdges([makeEdge('ab', 'a', 'b'), makeEdge('bc', 'b', 'c'), makeEdge('ac', 'a', 'c')]);
      const order: string[] = [];
      store.onEdgesDelete = () => order.push(`edgesDelete:${store.edges().length}`);
      store.onEdgesChange = () => order.push('edgesChange');
      store.onNodesDelete = () => order.push(`nodesDelete:${store.nodes().length}`);
      store.onNodesChange = () => order.push('nodesChange');
      store.onDelete = ({ nodes, edges }) => order.push(`delete:${nodes.length}/${edges.length}`);
      await service.deleteElements({ nodes: [{ id: 'b' }] });
      expect(order).toEqual(['edgesDelete:3', 'edgesChange', 'nodesDelete:3', 'nodesChange', 'delete:1/2']);
    });

    it('empty input or nothing matching: no hook, no callbacks, no changes', async () => {
      service.setNodes([makeNode('a', { deletable: false })]);
      const hook = vi.fn().mockResolvedValue(true);
      const cb = vi.fn();
      store.onBeforeDelete = hook;
      store.onNodesDelete = store.onEdgesDelete = store.onDelete = store.onNodesChange = cb;
      for (const params of [{}, { nodes: [{ id: 'ghost' }] }, { nodes: [{ id: 'a' }] }]) {
        expect(await service.deleteElements(params)).toEqual({ deletedNodes: [], deletedEdges: [] });
      }
      expect(hook).not.toHaveBeenCalled(); // Open question 1 default
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ── batch: coalescing through the service layer ───────────────────────

  describe('batch through service', () => {
    it('setNodes + setEdges + addNodes in one batch = one version bump', () => {
      const v0 = store.version();

      service.batch(() => {
        service.setNodes([makeNode('1')]);
        service.setEdges([makeEdge('e1', '1', '2')]);
        service.addNodes(makeNode('2'));
      });

      expect(store.version()).toBe(v0 + 1);
      expect(store.nodes()).toHaveLength(2);
      expect(store.edges()).toHaveLength(1);
    });
  });

  // ── updateNode / updateNodeData: mutation correctness ─────────────────

  describe('updateNode mutation correctness', () => {
    it('updateNode does not mutate the original node in the array', () => {
      service.setNodes([makeNode('1', { data: { label: 'old' } })]);
      const nodesBefore = store.nodes();

      service.updateNode('1', { data: { label: 'new' } });

      const nodesAfter = store.nodes();
      // Should be a new array (immutable update)
      expect(nodesAfter).not.toBe(nodesBefore);
      expect(nodesAfter[0].data).toEqual({ label: 'new' });
    });

    it('updateNode with function-updater has access to current state', () => {
      service.setNodes([makeNode('1', { data: { items: ['a', 'b'] } })]);

      service.updateNode('1', (node) => ({
        data: { items: [...(node.data as any).items, 'c'] },
      }));

      expect(store.nodes()[0].data).toEqual({ items: ['a', 'b', 'c'] });
    });

    it('updateNodeData merges shallowly, not deep', () => {
      service.setNodes([makeNode('1', { data: { nested: { a: 1 }, other: 'keep' } })]);

      service.updateNodeData('1', { nested: { b: 2 } });

      // nested is replaced, not deep-merged; other is preserved
      expect(store.nodes()[0].data).toEqual({ nested: { b: 2 }, other: 'keep' });
    });

    it('updateNode on nonexistent ID is a no-op', () => {
      service.setNodes([makeNode('1')]);
      const _before = store.nodes();

      service.updateNode('nonexistent', { data: { x: 1 } });

      // Nodes array replaced (map always creates new array) but content unchanged
      expect(store.nodes()).toHaveLength(1);
      expect(store.nodes()[0].id).toBe('1');
    });
  });

  // ── update APIs emit upstream 1.0 'update' / 'data' changes ───────────

  describe('update APIs emit update/data changes', () => {
    let nodeChanges: unknown[][];
    let edgeChanges: unknown[][];

    beforeEach(() => {
      service.setNodes([makeNode('1', { data: { label: 'old', keep: true } })]);
      service.setEdges([makeEdge('e1', '1', '2', { data: { a: 1 } })]);
      nodeChanges = [];
      edgeChanges = [];
      store.onNodesChange = (c) => nodeChanges.push(c.toArray());
      store.onEdgesChange = (c) => edgeChanges.push(c.toArray());
    });

    it('updateNode emits a single update change carrying only the partial', () => {
      service.updateNode('1', { width: 80 });
      expect(nodeChanges).toEqual([[{ id: '1', type: 'update', item: { width: 80 } }]]);
      expect(store.nodes()[0].width).toBe(80);
    });

    it('updateNode resolves an updater function against the current node first', () => {
      service.updateNode('1', (n) => ({ position: { x: n.position.x + 5, y: 7 } }));
      expect(nodeChanges).toEqual([[{ id: '1', type: 'position', position: { x: 5, y: 7 } }]]);
    });

    it('updateNodeData emits a merging data change (no replace flag)', () => {
      service.updateNodeData('1', { label: 'new' });
      expect(nodeChanges).toEqual([[{ id: '1', type: 'data', data: { label: 'new' } }]]);
      expect(store.nodes()[0].data).toEqual({ label: 'new', keep: true });
    });

    it('updateNodeData passes the current node to an updater function', () => {
      const current = store.nodes()[0];
      let received: Node | undefined;
      service.updateNodeData('1', (node) => {
        received = node;
        return { label: `${node.data['label']}!` };
      });
      expect(received).toBe(current);
      expect(nodeChanges).toEqual([[{ id: '1', type: 'data', data: { label: 'old!' } }]]);
      expect(store.nodes()[0].data).toEqual({ label: 'old!', keep: true });
    });

    it('updateEdge / updateEdgeData emit update / data changes', () => {
      service.updateEdge('e1', { animated: true });
      service.updateEdgeData('e1', { b: 2 });
      expect(edgeChanges).toEqual([
        [{ id: 'e1', type: 'update', item: { animated: true } }],
        [{ id: 'e1', type: 'data', data: { b: 2 } }],
      ]);
      expect(store.edges()[0].animated).toBe(true);
      expect(store.edges()[0].data).toEqual({ a: 1, b: 2 });
    });

    it('all four return early for an unknown id', () => {
      service.updateNode('ghost', { width: 1 });
      service.updateNodeData('ghost', { x: 1 });
      service.updateEdge('ghost', { animated: true });
      service.updateEdgeData('ghost', { x: 1 });
      expect(nodeChanges).toEqual([]);
      expect(edgeChanges).toEqual([]);
    });

    it('addNodes / addEdges emit add changes carrying the id', () => {
      const n2 = makeNode('2');
      const e2 = makeEdge('e2', '1', '2');
      service.addNodes(n2);
      service.addEdges([e2]);
      expect(nodeChanges).toEqual([[{ id: '2', type: 'add', item: n2 }]]);
      expect(edgeChanges).toEqual([[{ id: 'e2', type: 'add', item: e2 }]]);
      expect(store.nodes().map((n) => n.id)).toEqual(['1', '2']);
      expect(store.edges().map((e) => e.id)).toEqual(['e1', 'e2']);
    });

    it('updateNode with parentId: undefined clears the parent (store, lookup and parentLookup)', () => {
      service.setNodes([
        makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 300, height: 300 }),
        makeNode('a', { parentId: 'g', position: { x: 10, y: 10 } }),
      ]);
      expect(store.parentLookup.get('g')?.has('a')).toBe(true);
      nodeChanges = [];

      service.updateNode('a', { parentId: undefined });

      expect(nodeChanges).toEqual([[{ id: 'a', type: 'update', item: { parentId: undefined } }]]);
      expect(store.nodes().find((n) => n.id === 'a')?.parentId).toBeUndefined();
      expect(store.nodeLookup.get('a')?.parentId).toBeUndefined();
      expect(store.parentLookup.get('g')?.has('a') ?? false).toBe(false);
      // Unparented, its absolute position is now its own position.
      expect(store.nodeLookup.get('a')?.internals.positionAbsolute).toEqual({ x: 10, y: 10 });
    });
  });

  // ── update APIs: { replace } and the Svelte-style split (E1) ──────────

  describe('update APIs: split changes and { replace }', () => {
    let nodeSets: NodeChangeset<Node>[];
    let edgeSets: EdgeChangeset<Edge>[];
    const nodeChanges = () => nodeSets.map((c) => c.toArray());
    const edgeChanges = () => edgeSets.map((c) => c.toArray());

    beforeEach(() => {
      service.setNodes([makeNode('1', { position: { x: 10, y: 20 }, data: { label: 'old', keep: true } })]);
      service.setEdges([makeEdge('e1', '1', '2', { data: { a: 1, b: 2 } })]);
      nodeSets = [];
      edgeSets = [];
      store.onNodesChange = (c) => nodeSets.push(c);
      store.onEdgesChange = (c) => edgeSets.push(c);
    });

    it('updateNode({ position }) emits exactly one position change that getByType sees', () => {
      service.updateNode('1', { position: { x: 30, y: 40 } });
      expect(nodeChanges()).toEqual([[{ id: '1', type: 'position', position: { x: 30, y: 40 } }]]);
      expect(nodeSets[0].getByType('position')).toEqual([{ id: '1', type: 'position', position: { x: 30, y: 40 } }]);
      expect(nodeSets[0].getByType('update')).toEqual([]);
      expect(store.nodes()[0].position).toEqual({ x: 30, y: 40 });
      expect(store.nodeLookup.get('1')!.internals.positionAbsolute).toEqual({ x: 30, y: 40 });
    });

    it('updateNode({ position, data, className }) emits position + replacing data + update in one changeset', () => {
      const data = { label: 'new' };
      service.updateNode('1', { position: { x: 1, y: 2 }, data, className: 'hot' });
      expect(nodeChanges()).toEqual([
        [
          { id: '1', type: 'position', position: { x: 1, y: 2 } },
          { id: '1', type: 'data', data: { label: 'new' }, replace: true },
          { id: '1', type: 'update', item: { className: 'hot' } },
        ],
      ]);
      const n = store.nodes()[0];
      expect(n.position).toEqual({ x: 1, y: 2 });
      // data is replaced, not merged: `keep` is gone.
      expect(n.data).toEqual({ label: 'new' });
      expect(n.className).toBe('hot');
    });

    it('updateNode with an unchanged position emits no position change', () => {
      service.updateNode('1', { position: { x: 10, y: 20 }, className: 'c' });
      expect(nodeChanges()).toEqual([[{ id: '1', type: 'update', item: { className: 'c' } }]]);
    });

    it('updateNode with only an unchanged position (or the same data object) emits nothing', () => {
      const sameData = store.nodes()[0].data;
      service.updateNode('1', { position: { x: 10, y: 20 } });
      service.updateNode('1', { data: sameData });
      service.updateNode('1', {});
      expect(nodeSets).toEqual([]);
    });

    it('updateNode(..., { replace: true }) with a full node emits one replace change', () => {
      const full = makeNode('1', { position: { x: 5, y: 5 }, data: { only: 1 } });
      service.updateNode('1', full, { replace: true });
      expect(nodeChanges()).toEqual([[{ id: '1', type: 'replace', item: full }]]);
      expect(store.nodes()[0].data).toEqual({ only: 1 });
      expect(store.nodes()[0].position).toEqual({ x: 5, y: 5 });
    });

    it('updateNode(..., { replace: true }) with a partial falls back to the split', () => {
      service.updateNode('1', { className: 'p' }, { replace: true });
      expect(nodeChanges()).toEqual([[{ id: '1', type: 'update', item: { className: 'p' } }]]);
    });

    it('updateNodeData(..., { replace: true }) replaces data entirely', () => {
      service.updateNodeData('1', { label: 'only' }, { replace: true });
      expect(nodeChanges()).toEqual([[{ id: '1', type: 'data', data: { label: 'only' }, replace: true }]]);
      expect(store.nodes()[0].data).toEqual({ label: 'only' });
    });

    it('updateNodeData updater + { replace: true } receives the node and replaces data', () => {
      service.updateNodeData('1', (node) => ({ moved: node.position.x }), { replace: true });
      expect(store.nodes()[0].data).toEqual({ moved: 10 });
    });

    it('updateEdge(..., { replace: true }) with a full edge emits one replace change', () => {
      const full = makeEdge('e1', '1', '2', { animated: true });
      service.updateEdge('e1', full, { replace: true });
      expect(edgeChanges()).toEqual([[{ id: 'e1', type: 'replace', item: full }]]);
      expect(store.edges()[0].data).toBeUndefined();
      expect(store.edges()[0].animated).toBe(true);
    });

    it('updateEdge({ data, label }) emits a replacing data change + update', () => {
      service.updateEdge('e1', { data: { z: 9 }, label: 'L' });
      expect(edgeChanges()).toEqual([
        [
          { id: 'e1', type: 'data', data: { z: 9 }, replace: true },
          { id: 'e1', type: 'update', item: { label: 'L' } },
        ],
      ]);
      expect(store.edges()[0].data).toEqual({ z: 9 });
      expect(store.edges()[0].label).toBe('L');
    });

    it('updateEdge with the same data object and nothing else emits nothing', () => {
      service.updateEdge('e1', { data: store.edges()[0].data });
      expect(edgeSets).toEqual([]);
    });

    it('updateEdgeData passes the current edge to an updater function', () => {
      let received: Edge | undefined;
      service.updateEdgeData('e1', (edge) => {
        received = edge;
        return { b: (edge.data!['b'] as number) + 1, from: edge.source };
      });
      expect(received?.id).toBe('e1');
      expect(edgeChanges()).toEqual([[{ id: 'e1', type: 'data', data: { b: 3, from: '1' } }]]);
      expect(store.edges()[0].data).toEqual({ a: 1, b: 3, from: '1' });
    });

    it('updateEdgeData(..., { replace: true }) replaces data entirely', () => {
      service.updateEdgeData('e1', { only: true }, { replace: true });
      expect(edgeChanges()).toEqual([[{ id: 'e1', type: 'data', data: { only: true }, replace: true }]]);
      expect(store.edges()[0].data).toEqual({ only: true });
    });
  });

  // ── updateNode({ position }) is applied immutably (full applyTo path) ──

  describe('updateNode({ position }) applies immutably', () => {
    it('replaces the node object and leaves the host object untouched', () => {
      const host = makeNode('a', { position: { x: 1, y: 2 } });
      const hostPosition = host.position;
      service.setNodes([host, makeNode('b')]);
      const otherBefore = store.nodes()[1];
      service.updateNode('a', { position: { x: 30, y: 40 } });
      const next = store.nodes().find((n) => n.id === 'a')!;
      expect(next).not.toBe(host);
      expect(next.position).toEqual({ x: 30, y: 40 });
      expect(host.position).toBe(hostPosition);
      expect(host.position).toEqual({ x: 1, y: 2 });
      expect(store.nodes()[1]).toBe(otherBefore);
      expect(store.nodeLookup.get('a')!.internals.userNode).toBe(next);
      expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual({ x: 30, y: 40 });
    });

    it('changeParent does not mutate the host object either', () => {
      const group = makeNode('g', { type: 'group', position: { x: 100, y: 50 }, width: 300, height: 300 });
      const host = makeNode('a', { position: { x: 150, y: 80 }, width: 20, height: 20 });
      service.setNodes([group, host]);
      service.changeParent('a', 'g');
      expect(host.position).toEqual({ x: 150, y: 80 });
      expect(host.parentId).toBeUndefined();
      expect(store.nodes().find((n) => n.id === 'a')).not.toBe(host);
    });
    it('moves a parented child: absolute = parent absolute + new position', () => {
      service.setNodes([
        makeNode('g', { type: 'group', position: { x: 100, y: 50 }, width: 300, height: 300 }),
        makeNode('a', { parentId: 'g', position: { x: 10, y: 10 }, width: 20, height: 20 }),
      ]);
      service.updateNode('a', { position: { x: 40, y: 60 } });
      expect(store.nodes().find((n) => n.id === 'a')!.position).toEqual({ x: 40, y: 60 });
      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 40, y: 60 });
      expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual({ x: 140, y: 110 });
    });

    it('moves a parent: its children follow', () => {
      service.setNodes([
        makeNode('g', { type: 'group', position: { x: 100, y: 50 }, width: 300, height: 300 }),
        makeNode('a', { parentId: 'g', position: { x: 10, y: 10 }, width: 20, height: 20 }),
      ]);
      service.updateNode('g', { position: { x: 200, y: 150 } });
      expect(store.nodeLookup.get('g')!.internals.positionAbsolute).toEqual({ x: 200, y: 150 });
      expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual({ x: 210, y: 160 });
      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 10, y: 10 });
    });

    it('moves a top-level node with a non-zero origin: absolute is origin-corrected', () => {
      store.nodeOrigin.set([0.5, 0.5]);
      service.setNodes([makeNode('a', { position: { x: 0, y: 0 }, width: 40, height: 20 })]);
      service.updateNode('a', { position: { x: 100, y: 100 } });
      expect(store.nodes()[0].position).toEqual({ x: 100, y: 100 });
      expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual({ x: 80, y: 90 });
    });

    it('honours a per-node origin as well', () => {
      service.setNodes([makeNode('a', { position: { x: 0, y: 0 }, width: 40, height: 20, origin: [1, 1] })]);
      service.updateNode('a', { position: { x: 100, y: 100 } });
      expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual({ x: 60, y: 80 });
    });
  });

  // ── changeParent (React / Svelte parity) ──────────────────────────────

  describe('changeParent', () => {
    let nodeSets: NodeChangeset<Node>[];
    const abs = (id: string) => ({ ...store.nodeLookup.get(id)!.internals.positionAbsolute });

    beforeEach(() => {
      nodeSets = [];
    });

    function listen(): void {
      nodeSets = [];
      store.onNodesChange = (c) => nodeSets.push(c);
    }

    it('moves a top-level node into a parent, keeping it in place, in one update + position changeset', () => {
      service.setNodes([
        makeNode('g', { type: 'group', position: { x: 50, y: 60 }, width: 400, height: 400 }),
        makeNode('a', { position: { x: 200, y: 200 }, width: 50, height: 50 }),
      ]);
      const before = abs('a');
      listen();
      service.changeParent('a', 'g');
      expect(nodeSets.length).toBe(1);
      expect(nodeSets[0].toArray()).toEqual([
        { id: 'a', type: 'position', position: { x: 150, y: 140 } },
        { id: 'a', type: 'update', item: { parentId: 'g' } },
      ]);
      expect(service.getNode('a')?.parentId).toBe('g');
      expect(service.getNode('a')?.position).toEqual({ x: 150, y: 140 });
      expect(store.parentLookup.get('g')?.has('a')).toBe(true);
      expect(abs('a')).toEqual(before);
    });

    it('moves a child out of its parent with null, keeping it in place', () => {
      service.setNodes([
        makeNode('g', { type: 'group', position: { x: 50, y: 60 }, width: 400, height: 400 }),
        makeNode('a', { parentId: 'g', position: { x: 10, y: 20 }, width: 50, height: 50 }),
      ]);
      const before = abs('a');
      listen();
      service.changeParent('a', null);
      expect(nodeSets[0].toArray()).toEqual([
        { id: 'a', type: 'position', position: { x: 60, y: 80 } },
        { id: 'a', type: 'update', item: { parentId: undefined } },
      ]);
      expect(service.getNode('a')?.parentId).toBeUndefined();
      expect(store.parentLookup.get('g')?.has('a') ?? false).toBe(false);
      expect(abs('a')).toEqual(before);
    });

    it('moves a node into a nested parent, keeping it in place', () => {
      service.setNodes([
        makeNode('outer', { type: 'group', position: { x: 100, y: 100 }, width: 500, height: 500 }),
        makeNode('inner', { type: 'group', parentId: 'outer', position: { x: 30, y: 40 }, width: 300, height: 300 }),
        makeNode('a', { position: { x: 400, y: 300 }, width: 50, height: 50 }),
      ]);
      const before = abs('a');
      service.changeParent('a', 'inner');
      expect(service.getNode('a')?.parentId).toBe('inner');
      expect(service.getNode('a')?.position).toEqual({ x: 270, y: 160 });
      expect(abs('a')).toEqual(before);
    });

    it('moves a node between parents, keeping it in place', () => {
      service.setNodes([
        makeNode('g1', { type: 'group', position: { x: 0, y: 0 }, width: 300, height: 300 }),
        makeNode('g2', { type: 'group', position: { x: 500, y: 100 }, width: 300, height: 300 }),
        makeNode('a', { parentId: 'g1', position: { x: 20, y: 30 }, width: 50, height: 50 }),
      ]);
      const before = abs('a');
      service.changeParent('a', 'g2');
      expect(service.getNode('a')?.parentId).toBe('g2');
      expect(service.getNode('a')?.position).toEqual({ x: -480, y: -70 });
      expect(abs('a')).toEqual(before);
    });

    it('keeps the node in place with a non-zero nodeOrigin (into, nested and out)', () => {
      store.nodeOrigin.set([0.5, 0.5]);
      service.setNodes([
        makeNode('outer', { type: 'group', position: { x: 300, y: 300 }, width: 400, height: 400 }),
        makeNode('inner', { type: 'group', parentId: 'outer', position: { x: 100, y: 100 }, width: 200, height: 200 }),
        makeNode('a', { position: { x: 500, y: 500 }, width: 40, height: 20 }),
      ]);
      const before = abs('a');
      expect(before).toEqual({ x: 480, y: 490 });

      service.changeParent('a', 'outer');
      expect(service.getNode('a')?.parentId).toBe('outer');
      expect(abs('a')).toEqual(before);

      service.changeParent('a', 'inner');
      expect(service.getNode('a')?.parentId).toBe('inner');
      expect(abs('a')).toEqual(before);

      service.changeParent('a', null);
      expect(service.getNode('a')?.parentId).toBeUndefined();
      expect(service.getNode('a')?.position).toEqual({ x: 500, y: 500 });
      expect(abs('a')).toEqual(before);
    });

    it('keeps the node in place with a per-node origin', () => {
      service.setNodes([
        makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
        makeNode('a', { position: { x: 200, y: 200 }, width: 40, height: 20, origin: [1, 0.5] }),
      ]);
      const before = abs('a');
      service.changeParent('a', 'g');
      expect(service.getNode('a')?.parentId).toBe('g');
      expect(abs('a')).toEqual(before);
    });

    it('is a no-op when parentId === nodeId', () => {
      service.setNodes([makeNode('a', { position: { x: 1, y: 2 }, width: 10, height: 10 })]);
      listen();
      service.changeParent('a', 'a');
      expect(nodeSets).toEqual([]);
      expect(service.getNode('a')?.parentId).toBeUndefined();
    });

    it('warns and changes nothing for a missing node or a missing parent', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      onTestFinished(() => warn.mockRestore());
      service.setNodes([makeNode('a', { position: { x: 1, y: 2 }, width: 10, height: 10 })]);
      const before = abs('a');
      listen();
      service.changeParent('ghost', null);
      service.changeParent('a', 'ghost-parent');
      expect(warn).toHaveBeenCalledTimes(2);
      expect(nodeSets).toEqual([]);
      expect(service.getNode('a')?.parentId).toBeUndefined();
      expect(abs('a')).toEqual(before);
    });
  });

  // ── updateEdge / updateEdgeData ───────────────────────────────────────

  describe('updateEdge mutation correctness', () => {
    it('updateEdge with function-updater', () => {
      service.setEdges([makeEdge('e1', '1', '2', { label: 'v1' })]);

      service.updateEdge('e1', (edge) => ({
        label: edge.label + '-v2',
      }));

      expect(store.edges()[0].label).toBe('v1-v2');
    });

    it('updateEdgeData merges shallowly', () => {
      service.setEdges([makeEdge('e1', '1', '2', { data: { a: 1, b: 2 } })]);

      service.updateEdgeData('e1', { b: 99, c: 3 });

      expect(store.edges()[0].data).toEqual({ a: 1, b: 99, c: 3 });
    });
  });

  // ── selectNodesData: reads from nodeLookup, not nodes array ───────────

  describe('selectNodesData reads from nodeLookup', () => {
    it('returns data from internal userNode, which stays in sync after updates', () => {
      service.setNodes([
        makeNode('1', { data: { label: 'A' }, type: 'custom' }),
        makeNode('2', { data: { label: 'B' } }),
      ]);

      const sig = service.selectNodesData(['1', '2']);
      expect(sig()).toHaveLength(2);
      expect(sig()[0]).toEqual(expect.objectContaining({ id: '1', type: 'custom' }));
    });

    it('keeps the same array when node data is unchanged', () => {
      const data = { label: 'A' };
      service.setNodes([makeNode('a', { data })]);

      const sig = service.selectNodesData(['a']);
      const first = sig();
      store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x: 5, y: 5 } }]);

      expect(sig()).toBe(first);
    });

    it('emits a new value when node data changes', () => {
      service.setNodes([makeNode('a', { data: { label: 'A' } })]);

      const sig = service.selectNodesData(['a']);
      const first = sig();
      service.updateNodeData('a', { label: 'B' });

      expect(sig()).not.toBe(first);
      expect(sig()[0].data).toEqual({ label: 'B' });
    });

    it('filters out IDs that no longer exist in nodeLookup', () => {
      service.setNodes([makeNode('1')]);
      const sig = service.selectNodesData(['1', 'gone']);
      expect(sig()).toHaveLength(1);
    });
  });

  describe('selectNode / selectEdge / selectInternalNodes', () => {
    function countNotifications<T>(sig: () => T): { count: () => number; stop: () => void } {
      let n = 0;
      const ref = TestBed.runInInjectionContext(() =>
        effect(() => {
          sig();
          n++;
        }),
      );
      TestBed.flushEffects();
      return { count: () => n, stop: () => ref.destroy() };
    }

    it('selectNode returns the node, undefined when missing, and updates on change', () => {
      service.setNodes([makeNode('a', { data: { l: 1 } }), makeNode('b')]);
      const a = service.selectNode('a');
      expect(a()?.id).toBe('a');
      expect(service.selectNode('nope')()).toBeUndefined();
      service.updateNodeData('a', { l: 2 });
      expect(a()?.data).toEqual({ l: 2 });
    });

    it('selectNode does not notify when another node changes', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      const probe = countNotifications(service.selectNode('a'));
      const before = probe.count();
      service.updateNodeData('b', { x: 1 });
      TestBed.flushEffects();
      expect(probe.count()).toBe(before);
      service.updateNodeData('a', { x: 1 });
      TestBed.flushEffects();
      expect(probe.count()).toBe(before + 1);
      probe.stop();
    });

    it('selectEdge returns the edge, undefined when missing, and updates on change', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      service.setEdges([makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'a')]);
      const e1 = service.selectEdge('e1');
      expect(e1()?.id).toBe('e1');
      expect(service.selectEdge('nope')()).toBeUndefined();
      service.updateEdgeData('e1', { w: 2 });
      expect(e1()?.data).toEqual({ w: 2 });
    });

    it('selectEdge does not notify when another edge changes', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      service.setEdges([makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'a')]);
      const probe = countNotifications(service.selectEdge('e1'));
      const before = probe.count();
      service.updateEdgeData('e2', { w: 1 });
      TestBed.flushEffects();
      expect(probe.count()).toBe(before);
      service.updateEdgeData('e1', { w: 1 });
      TestBed.flushEffects();
      expect(probe.count()).toBe(before + 1);
      probe.stop();
    });

    it('selectInternalNodes keeps order, collapses duplicates, skips missing and handles empty', () => {
      service.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      expect(service.selectInternalNodes([])()).toEqual([]);
      const sig = service.selectInternalNodes(['c', 'a', 'c', 'gone']);
      expect(sig().map(n => n.id)).toEqual(['c', 'a']);
    });

    it('selectInternalNodes updates when a node is removed and keeps identity otherwise', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      const sig = service.selectInternalNodes(['a', 'b']);
      const first = sig();
      service.updateNodeData('zzz', {});
      expect(sig()).toBe(first);
      service.setNodes([makeNode('a')]);
      expect(sig().map(n => n.id)).toEqual(['a']);
    });

    it('selectInternalNode does not notify when an unrelated node moves', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      const probe = countNotifications(service.selectInternalNode('a'));
      const before = probe.count();
      store.triggerNodeChanges([{ id: 'b', type: 'position', position: { x: 9, y: 9 } }]);
      TestBed.flushEffects();
      expect(probe.count()).toBe(before);
      probe.stop();
    });
  });

  describe('node selectors notify on in-place position/drag changes', () => {
    function probe(sig: () => unknown) {
      let n = 0;
      TestBed.runInInjectionContext(() => effect(() => { sig(); n++; }));
      TestBed.flushEffects();
      return () => n;
    }

    it('a position change of its own node notifies, another node does not', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      const c1 = probe(service.selectNode('a'));
      const c2 = probe(service.selectInternalNode('a'));
      const c3 = probe(service.selectInternalNodes(['a', 'b']));
      const c4 = probe(service.selectInternalNodes(['a']));
      const base = [c1(), c2(), c3(), c4()];

      store.triggerNodeChanges([{ id: 'b', type: 'position', position: { x: 3, y: 3 } }]);
      TestBed.flushEffects();
      expect([c1(), c2(), c3(), c4()]).toEqual([base[0], base[1], base[2] + 1, base[3]]);

      store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x: 7, y: 7 } }]);
      TestBed.flushEffects();
      expect([c1(), c2(), c3(), c4()]).toEqual([base[0] + 1, base[1] + 1, base[2] + 2, base[3] + 1]);
      expect(service.selectNode('a')()?.position).toEqual({ x: 7, y: 7 });
    });

    it('toggling dragging notifies', () => {
      service.setNodes([makeNode('a'), makeNode('b')]);
      const c1 = probe(service.selectNode('a'));
      const c2 = probe(service.selectInternalNode('a'));
      const c3 = probe(service.selectInternalNodes(['a', 'b']));
      const base = [c1(), c2(), c3()];
      store.triggerNodeChanges([{ id: 'a', type: 'position', dragging: true }]);
      TestBed.flushEffects();
      expect([c1(), c2(), c3()]).toEqual(base.map(v => v + 1));
    });
  });

  describe('selectInternalNode with parented movers', () => {
    it('does not notify for an unrelated node when a parented node moves', () => {
      service.setNodes([
        makeNode('a'),
        makeNode('p'),
        makeNode('c', { parentId: 'p' }),
      ]);
      let n = 0;
      const sig = service.selectInternalNode('a');
      TestBed.runInInjectionContext(() => effect(() => { sig(); n++; }));
      TestBed.flushEffects();
      const before = n;
      store.triggerNodeChanges([{ id: 'c', type: 'position', position: { x: 9, y: 9 } }]);
      TestBed.flushEffects();
      expect(n).toBe(before);
    });
  });

  // ── middleware registration/unregistration ─────────────────────────────

  describe('middleware lifecycle', () => {
    it('registered middleware intercepts changes', () => {
      service.setNodes([makeNode('1'), makeNode('2')]);
      const spy = vi.fn();
      store.onNodesChange = spy;

      // Block all changes
      const unregister = service.onNodesChangeMiddleware('blocker', () => []);

      store.addSelectedNodes(['1']);
      expect(spy).not.toHaveBeenCalled();
      // Note: addSelectedNodes mutates nodeLookup BEFORE middleware runs
      // (a known quirk of getSelectionChanges with mutateItem=true),
      // so we test unregister with a fresh node ID
      unregister();
      store.addSelectedNodes(['2']);
      expect(spy).toHaveBeenCalled();
    });

    it('multiple middleware run in registration order', () => {
      service.setNodes([makeNode('1')]);
      const order: string[] = [];

      service.onNodesChangeMiddleware('first', (changes) => {
        order.push('first');
        return changes;
      });
      service.onNodesChangeMiddleware('second', (changes) => {
        order.push('second');
        return changes;
      });

      store.addSelectedNodes(['1']);
      expect(order).toEqual(['first', 'second']);
    });
  });

  // ── getHandleData: pass-through to FlowStore ─────────────────────────

  describe('getHandleData', () => {
    it('returns data registered via FlowStore', () => {
      store.registerHandleData('n1', 'h1', 'source', 'string');
      expect(service.getHandleData('n1', 'h1', 'source')).toBe('string');
    });

    it('returns undefined for unknown keys', () => {
      expect(service.getHandleData('n1', 'nope', 'source')).toBeUndefined();
    });

    it('propagates null handleId', () => {
      store.registerHandleData('n1', null, 'target', { tag: 42 });
      expect(service.getHandleData('n1', null, 'target')).toEqual({ tag: 42 });
    });
  });

  // ── selectKeyPressed: key tracking ────────────────────────────────────

  describe('selectKeyPressed', () => {
    it('tracks keydown/keyup for specified keys', () => {
      const pressed = service.selectKeyPressed('Shift');
      expect(pressed()).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      expect(pressed()).toBe(true);

      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
      expect(pressed()).toBe(false);
    });

    it('tracks multiple keys', () => {
      const pressed = service.selectKeyPressed(['Meta', 'Control']);
      expect(pressed()).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
      expect(pressed()).toBe(true);

      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
      expect(pressed()).toBe(false);
    });

    it('ignores unrelated keys', () => {
      const pressed = service.selectKeyPressed('Shift');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      expect(pressed()).toBe(false);
    });

    it('does not collide cache keys for space-containing key names', () => {
      const combo = service.selectKeyPressed(['a', 'b']);
      const spaced = service.selectKeyPressed('a b');
      expect(spaced).not.toBe(combo);
    });

    it('requires all parts of a "+"-combo to be held', () => {
      const pressed = service.selectKeyPressed('Control+a');
      expect(pressed()).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
      expect(pressed()).toBe(false); // only one part down

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      expect(pressed()).toBe(true); // both down

      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
      expect(pressed()).toBe(false);
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    });

    it('matches against KeyboardEvent.code as well as key', () => {
      const pressed = service.selectKeyPressed('KeyS');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' }));
      expect(pressed()).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 's', code: 'KeyS' }));
      expect(pressed()).toBe(false);
    });
  });

  describe('fitBounds', () => {
    it('delegates to the store so overlapping calls share its fit chain', async () => {
      const result = true;
      const spy = vi.spyOn(store, 'fitBounds').mockResolvedValue(result);
      const bounds = { x: 0, y: 0, width: 10, height: 10 };
      const options = { padding: 0.2, duration: 100, ease: (t: number) => t };

      await expect(service.fitBounds(bounds, options)).resolves.toBe(result);
      expect(spy).toHaveBeenCalledWith(bounds, options);
    });
  });

  describe('measureFitView / measureFitBounds (@internal)', () => {
    function withPanZoom() {
      store.panZoom.set({ setViewport: async () => true, getViewport: () => ({ x: 0, y: 0, zoom: 1 }) } as never);
      store.width.set(800);
      store.height.set(600);
    }

    it('return null without panZoom', () => {
      service.setNodes([makeNode('a')]);
      expect(service.measureFitView()).toBeNull();
      expect(service.measureFitBounds({ x: 0, y: 0, width: 10, height: 10 })).toBeNull();
    });

    it('measureFitView flags a min-zoom clamp', () => {
      withPanZoom();
      store.minZoom.set(0.5);
      service.setNodes([
        makeNode('a', { width: 100, height: 50 }),
        makeNode('b', { position: { x: 100000, y: 0 }, width: 100, height: 50 }),
      ]);
      const m = service.measureFitView()!;
      expect(m.clamped).toBe(true);
      expect(m.zoom).toBeCloseTo(0.5, 5);
    });

    it('measureFitView does not flag a single small node', () => {
      withPanZoom();
      store.minZoom.set(0.5);
      service.setNodes([makeNode('a', { width: 100, height: 50 })]);
      expect(service.measureFitView()!.clamped).toBe(false);
    });

    it('measureFitView is null with no nodes', () => {
      withPanZoom();
      expect(service.measureFitView()).toBeNull();
    });

    it('measureFitBounds reports a finite unclamped zoom', () => {
      withPanZoom();
      const m = service.measureFitBounds({ x: 0, y: 0, width: 200, height: 100 }, { minZoom: 0.2 })!;
      expect(m.clamped).toBe(false);
      expect(Number.isFinite(m.zoom)).toBe(true);
    });
  });

  describe('selectNodesInitialized includeHiddenNodes', () => {
    it('ignores hidden nodes by default but requires them when includeHiddenNodes', () => {
      // A measured visible node + an unmeasured hidden node.
      store.setNodes([
        { id: 'v', position: { x: 0, y: 0 }, data: {}, measured: { width: 10, height: 10 } },
        { id: 'h', position: { x: 0, y: 0 }, data: {}, hidden: true },
      ] as never);

      expect(service.selectNodesInitialized()()).toBe(true);
      expect(service.selectNodesInitialized({ includeHiddenNodes: true })()).toBe(false);
    });
  });

  describe('connection queries (#6114)', () => {
    beforeEach(() => {
      service.setNodes([makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')]);
      service.setEdges([
        makeEdge('e1', 'a', 'b', { sourceHandle: 'h1' }),
        makeEdge('e2', 'a', 'c', { sourceHandle: 'h2' }),
        makeEdge('e3', 'd', 'a', { targetHandle: 't1' }),
      ]);
    });
    const ids = (cs: { edgeId: string }[]) => cs.map((c) => c.edgeId).sort();

    it('getNodeConnections takes { nodeId, type?, handleId? }', () => {
      expect(ids(service.getNodeConnections({ nodeId: 'a' }))).toEqual(['e1', 'e2', 'e3']);
      expect(ids(service.getNodeConnections({ nodeId: 'a', type: 'source' }))).toEqual(['e1', 'e2']);
      expect(ids(service.getNodeConnections({ nodeId: 'a', type: 'source', handleId: 'h1' }))).toEqual(['e1']);
      expect(ids(service.getNodeConnections({ nodeId: 'a', type: 'target', handleId: 't1' }))).toEqual(['e3']);
      expect(service.getNodeConnections({ nodeId: 'zz' })).toEqual([]);
    });

    it('selectNodeConnections takes the same params and tracks edge changes', () => {
      const sig = service.selectNodeConnections({ nodeId: 'a', type: 'source' });
      expect(ids(sig())).toEqual(['e1', 'e2']);
      service.setEdges([makeEdge('e1', 'a', 'b', { sourceHandle: 'h1' })]);
      expect(ids(sig())).toEqual(['e1']);
    });

    it('has no getHandleConnections / selectHandleConnections', () => {
      expect('getHandleConnections' in service).toBe(false);
      expect('selectHandleConnections' in service).toBe(false);
    });
  });
});

describe('setNodePositions / applyLayout', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('setNodePositions applies positions immediately when animation is off', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    await service.setNodePositions({ a: { x: 10, y: 20 }, b: { x: 30, y: 40 } });
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 10, y: 20 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 30, y: 40 });
  });

  it('setNodePositions skips unknown ids without throwing', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    await service.setNodePositions({ a: { x: 1, y: 1 }, ghost: { x: 9, y: 9 } });
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 1, y: 1 });
  });

  it('setNodePositions routes through the tween when animation is requested', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    const tween = vi.spyOn(store, 'tweenNodePositions').mockResolvedValue();
    await service.setNodePositions({ a: { x: 100, y: 0 } }, { animate: { duration: 150 } });
    expect(tween).toHaveBeenCalledWith({ a: { x: 100, y: 0 } }, 150);
  });

  it('per-call animate:false overrides the global animate signal', async () => {
    store.animate.set(true);
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    const tween = vi.spyOn(store, 'tweenNodePositions');
    await service.setNodePositions({ a: { x: 5, y: 5 } }, { animate: false });
    expect(tween).not.toHaveBeenCalled();
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 5, y: 5 });
  });

  it('applyLayout feeds store nodes/edges to the fn and applies its result', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b' }]);
    const layoutFn = vi.fn().mockReturnValue({ a: { x: 0, y: 0 }, b: { x: 0, y: 120 } });
    await service.applyLayout(layoutFn, { direction: 'TB' });
    expect(layoutFn).toHaveBeenCalledOnce();
    const [nodesArg, edgesArg, optsArg] = layoutFn.mock.calls[0];
    expect(nodesArg.map((n: { id: string }) => n.id)).toEqual(['a', 'b']);
    expect(edgesArg).toHaveLength(1);
    expect(optsArg).toEqual({ direction: 'TB' });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 0, y: 120 });
  });

  it('applyLayout awaits async layout functions', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    await service.applyLayout(async () => ({ a: { x: 42, y: 42 } }));
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 42, y: 42 });
  });

  function fakeContainer(
    nodeDims: Record<string, { w: number; h: number }>,
    labelDims: Record<string, { w: number; h: number }> = {},
    customLabelDims: Record<string, { w: number; h: number }> = {},
  ): HTMLDivElement {
    return {
      querySelector(selector: string): object | null {
        const node = selector.match(/^\.xy-flow__node\[data-id="(.+)"\]$/);
        if (node) {
          const d = nodeDims[node[1]];
          return d ? { offsetWidth: d.w, offsetHeight: d.h } : null;
        }
        // Built-in edge labels are SVG (`<g class="xy-flow__edge-textwrapper">`
        // inside the edge's `<g data-id>`), measured with getBBox().
        const label = selector.match(/^\.xy-flow__edge \[data-id="(.+)"\] \.xy-flow__edge-textwrapper$/);
        if (label) {
          const d = labelDims[label[1]];
          return d ? { getBBox: () => ({ x: 0, y: 0, width: d.w, height: d.h }) } : null;
        }
        const custom = selector.match(/^\.ng-flow__custom-edge\[data-edge-label-for="(.+)"\] \.xy-flow__edge-textwrapper$/);
        if (custom) {
          const d = customLabelDims[custom[1]];
          return d ? { getBBox: () => ({ x: 0, y: 0, width: d.w, height: d.h }) } : null;
        }
        return null;
      },
    } as unknown as HTMLDivElement;
  }

  it('applyLayout overrides node measured from the live DOM (always)', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    store.domNode.set(fakeContainer({ a: { w: 300, h: 120 } }));
    const layoutFn = vi.fn().mockReturnValue({ a: { x: 0, y: 0 } });
    await service.applyLayout(layoutFn);
    const nodesArg = layoutFn.mock.calls[0][0] as Array<{ id: string; measured?: { width?: number; height?: number } }>;
    expect(nodesArg[0].measured).toEqual({ width: 300, height: 120 });
    expect(store.nodeLookup.get('a')!.measured).not.toEqual({ width: 300, height: 120 });
  });

  it('applyLayout leaves a node unchanged when no DOM element exists', async () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 }, measured: { width: 10, height: 10 } }]);
    store.domNode.set(fakeContainer({}));
    const layoutFn = vi.fn().mockReturnValue({ a: { x: 0, y: 0 } });
    await service.applyLayout(layoutFn);
    const nodesArg = layoutFn.mock.calls[0][0] as Array<{ measured?: { width?: number; height?: number } }>;
    expect(nodesArg[0].measured).toEqual({ width: 10, height: 10 });
  });

  it('applyLayout fills edge label dims from the live DOM', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', label: 'rel' }]);
    store.domNode.set(fakeContainer({}, { e: { w: 140, h: 22 } }));
    const layoutFn = vi.fn().mockReturnValue({});
    await service.applyLayout(layoutFn);
    const edgesArg = layoutFn.mock.calls[0][1] as Array<{ id: string; labelWidth?: number; labelHeight?: number }>;
    expect(edgesArg[0].labelWidth).toBe(140);
    expect(edgesArg[0].labelHeight).toBe(22);
    expect((store.edgeLookup.get('e') as { labelWidth?: number }).labelWidth).toBeUndefined();
  });

  it('applyLayout fills label dims for custom-edge labels in the overlay', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', label: 'rel' }]);
    store.domNode.set(fakeContainer({}, {}, { e: { w: 90, h: 18 } }));
    const layoutFn = vi.fn().mockReturnValue({});
    await service.applyLayout(layoutFn);
    const edgesArg = layoutFn.mock.calls[0][1] as Array<{ labelWidth?: number; labelHeight?: number }>;
    expect(edgesArg[0].labelWidth).toBe(90);
    expect(edgesArg[0].labelHeight).toBe(18);
  });

  it('applyLayout passes edges through unchanged when no domNode is set', async () => {
    store.setNodes([
      { id: 'a', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e', source: 'a', target: 'b', label: 'rel' }]);
    const layoutFn = vi.fn().mockReturnValue({});
    await service.applyLayout(layoutFn);
    const edgesArg = layoutFn.mock.calls[0][1] as Array<{ labelWidth?: number }>;
    expect(edgesArg[0].labelWidth).toBeUndefined();
  });

  it('end-to-end: applyLayout(layoutNodes) — live node + edge-label measurements widen spacing', async () => {
    const seed = () => {
      store.setNodes([
        { id: 'a', data: {}, position: { x: 0, y: 0 } },
        { id: 'b', data: {}, position: { x: 0, y: 0 } },
      ]);
      store.setEdges([{ id: 'e', source: 'a', target: 'b', label: 'rel' }]);
    };

    // Baseline: no DOM → layoutNodes uses the 150×40 fallback and no label box.
    seed();
    store.domNode.set(null);
    await service.applyLayout(layoutNodes, { direction: 'TB' });
    const unmeasuredGap =
      store.nodeLookup.get('b')!.position.y - store.nodeLookup.get('a')!.position.y;

    // With live DOM: a is measured tall and the edge label box is measured, so dagre
    // must reserve more vertical space — node b ends up further below a.
    seed();
    store.domNode.set(
      fakeContainer({ a: { w: 100, h: 300 }, b: { w: 100, h: 40 } }, { e: { w: 120, h: 24 } }),
    );
    await service.applyLayout(layoutNodes, { direction: 'TB' });
    const measuredGap =
      store.nodeLookup.get('b')!.position.y - store.nodeLookup.get('a')!.position.y;

    expect(measuredGap).toBeGreaterThan(unmeasuredGap);
  });

  describe('updateNodeInternals selector escaping', () => {
    it('escapes hostile node ids before querySelector', () => {
      const selectors: string[] = [];
      store.domNode.set({
        querySelector(selector: string): null {
          selectors.push(selector);
          return null;
        },
      } as unknown as HTMLDivElement);

      const hostileId = 'a"]';
      service.updateNodeInternals(hostileId);

      // Mirror cssEscapeId: CSS.escape in the browser/jsdom, minimal fallback otherwise.
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(hostileId)
          : hostileId.replace(/["\\]/g, '\\$&');
      expect(selectors).toEqual([`[data-id="${escaped}"]`]);
    });
  });

  it('getAbsolutePosition resolves a top-level node verbatim', () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 30, y: 40 } }]);
    expect(service.getAbsolutePosition('a')).toEqual({ x: 30, y: 40 });
  });

  it('getAbsolutePosition sums the parentId chain for nested nodes', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 100, y: 100 } },
      { id: 'sub', data: {}, position: { x: 10, y: 20 }, parentId: 'g' },
      { id: 'leaf', data: {}, position: { x: 5, y: 5 }, parentId: 'sub' },
    ]);
    expect(service.getAbsolutePosition('leaf')).toEqual({ x: 115, y: 125 });
  });

  it('getAbsolutePosition returns null for an unknown id', () => {
    store.setNodes([{ id: 'a', data: {}, position: { x: 0, y: 0 } }]);
    expect(service.getAbsolutePosition('ghost')).toBeNull();
  });

  it('positionAbsolute and getAbsolutePosition agree right after applyLayout on a grouped canvas', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, type: 'group' },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
    ]);
    await service.applyLayout(
      () => ({ g: { x: 200, y: 200 }, c: { x: 224, y: 264 } }),
      { coordinateSpace: 'absolute', animate: false },
    );
    expect(service.getAbsolutePosition('c')).toEqual({ x: 224, y: 264 });
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 224, y: 264 });
  });
});

describe('collapse writers', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('setNodeCollapsed emits a replace change carrying collapsed', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 } }]);
    const changes: unknown[] = [];
    store.onNodesChange = (c) => changes.push(...c.toArray());
    service.setNodeCollapsed('g', true);
    expect(store.nodeLookup.get('g')!.collapsed).toBe(true);
    expect(changes).toEqual([{ id: 'g', type: 'replace', item: expect.objectContaining({ id: 'g', collapsed: true }) }]);
  });

  it('toggleNodeCollapsed flips the current value', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true }]);
    service.toggleNodeCollapsed('g');
    expect(store.nodeLookup.get('g')!.collapsed).toBe(false);
    service.toggleNodeCollapsed('g');
    expect(store.nodeLookup.get('g')!.collapsed).toBe(true);
  });

  it('toggleNodeCollapsed on a node with no collapsed field sets it to true', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 } }]);
    service.toggleNodeCollapsed('g');
    expect(store.nodeLookup.get('g')!.collapsed).toBe(true);
  });

  it('setNodeCollapsed on an unknown id is a no-op', () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 0, y: 0 } }]);
    expect(() => service.setNodeCollapsed('ghost', true)).not.toThrow();
  });
});

describe('setNodePositions coordinateSpace', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('absolute: a parented node is translated by the parent absolute position', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions({ c: { x: 300, y: 200 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 200, y: 150 });
  });

  it('absolute: a top-level node is an identity', async () => {
    store.setNodes([{ id: 'n', data: {}, position: { x: 0, y: 0 } }]);
    await service.setNodePositions({ n: { x: 42, y: 17 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('n')!.position).toEqual({ x: 42, y: 17 });
  });

  it('absolute: nested parent uses the immediate parent absolute (incl. grandparent)', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 1000, y: 1000 } },
      { id: 'p', data: {}, position: { x: 100, y: 100 }, parentId: 'g' },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions({ c: { x: 1500, y: 1300 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 400, y: 200 });
  });

  it('absolute: applies dims*origin for a non-default node origin', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 100 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p', width: 40, height: 20, origin: [1, 1] },
    ]);
    await service.setNodePositions({ c: { x: 300, y: 300 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 240, y: 220 });
  });

  it('absolute: a parented node whose parent is missing is used as-is (no throw)', async () => {
    store.setNodes([{ id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'ghost' }]);
    await service.setNodePositions({ c: { x: 5, y: 5 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 5, y: 5 });
  });

  it('default (relative): a parented node position is written verbatim', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions({ c: { x: 7, y: 7 } });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 7, y: 7 });
  });

  it('absolute + animate: the tween targets the converted (relative) position', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    const tween = vi.spyOn(store, 'tweenNodePositions').mockResolvedValue();
    await service.setNodePositions({ c: { x: 300, y: 200 } }, { coordinateSpace: 'absolute', animate: { duration: 100 } });
    expect(tween).toHaveBeenCalledWith({ c: { x: 200, y: 150 } }, 100);
  });

  it("absolute: moving a parent AND its child in one map resolves the child against the parent's NEW position", async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions(
      { p: { x: 200, y: 100 }, c: { x: 250, y: 160 } },
      { coordinateSpace: 'absolute' },
    );
    expect(store.nodeLookup.get('p')!.position).toEqual({ x: 200, y: 100 });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 50, y: 60 });
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 250, y: 160 });
  });

  it("absolute: combines the parent's NEW position with the child's dims*origin term", async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 0, y: 0 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p', width: 100, height: 40, origin: [1, 1] },
    ]);
    await service.setNodePositions(
      { p: { x: 500, y: 500 }, c: { x: 600, y: 580 } },
      { coordinateSpace: 'absolute' },
    );
    // relative = childAbs - parentNewAbs + dims*origin = (600-500+100, 580-500+40)
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 200, y: 120 });
  });

  it("absolute: nested groups moved together resolve each child against its own parent's NEW position", async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 } },
      { id: 'p', data: {}, position: { x: 100, y: 100 }, parentId: 'g' },
      { id: 'c', data: {}, position: { x: 10, y: 10 }, parentId: 'p' },
    ]);
    await service.setNodePositions(
      { g: { x: 1000, y: 1000 }, p: { x: 1100, y: 1100 }, c: { x: 1150, y: 1150 } },
      { coordinateSpace: 'absolute' },
    );
    expect(store.nodeLookup.get('g')!.position).toEqual({ x: 1000, y: 1000 });
    expect(store.nodeLookup.get('p')!.position).toEqual({ x: 100, y: 100 });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 50, y: 50 });
  });
});

describe('applyLayout coordinateSpace', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('forwards coordinateSpace:absolute so a layout fn returning absolute coords lands a parented child correctly', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    const layoutFn = vi.fn().mockReturnValue({ c: { x: 300, y: 200 } }); // absolute
    await service.applyLayout(layoutFn, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 200, y: 150 });
  });

  it('does NOT forward coordinateSpace (or animate) to the layout fn opts', async () => {
    store.setNodes([{ id: 'n', data: {}, position: { x: 0, y: 0 } }]);
    const layoutFn = vi.fn().mockReturnValue({ n: { x: 1, y: 1 } });
    await service.applyLayout(layoutFn, { coordinateSpace: 'absolute', direction: 'LR' } as never);
    const optsArg = layoutFn.mock.calls[0][2];
    expect(optsArg).toEqual({ direction: 'LR' });
  });
});

describe('sizeGroupToChildren', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('sizes + positions the group to wrap its children, keeping children visually fixed', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 100, y: 100 } },
      { id: 'c1', data: {}, position: { x: 10, y: 10 }, parentId: 'g', width: 40, height: 20 },
      { id: 'c2', data: {}, position: { x: 60, y: 30 }, parentId: 'g', width: 40, height: 20 },
    ]);
    await service.sizeGroupToChildren('g', { padding: 10, headerHeight: 20 });

    const g = store.nodeLookup.get('g')!;
    expect(g.width).toBe(110);
    expect(g.height).toBe(70);
    expect(g.position).toEqual({ x: 100, y: 90 });
    expect(store.nodeLookup.get('c1')!.internals.positionAbsolute).toEqual({ x: 110, y: 110 });
    expect(store.nodeLookup.get('c2')!.internals.positionAbsolute).toEqual({ x: 160, y: 130 });
  });

  it('is a no-op for a group with no children', async () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 5, y: 5 }, width: 80, height: 80 }]);
    await service.sizeGroupToChildren('g', { padding: 10 });
    const g = store.nodeLookup.get('g')!;
    expect(g.position).toEqual({ x: 5, y: 5 });
    expect(g.width).toBe(80);
    expect(g.height).toBe(80);
  });

  it('keeps children fixed even when the group itself is nested', async () => {
    store.setNodes([
      { id: 'outer', data: {}, position: { x: 50, y: 40 } },
      { id: 'g', data: {}, position: { x: 20, y: 20 }, parentId: 'outer' },
      { id: 'c', data: {}, position: { x: 5, y: 5 }, parentId: 'g', width: 40, height: 20 },
    ]);
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 75, y: 65 });
    await service.sizeGroupToChildren('g', { padding: 10, headerHeight: 0 });
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 75, y: 65 });
    const g = store.nodeLookup.get('g')!;
    expect(g.width).toBe(60);
    expect(g.height).toBe(30);
  });

  it('pins children immediately even when the flow [animate] is on', async () => {
    store.animate.set(true);
    store.setNodes([
      { id: 'g', data: {}, position: { x: 100, y: 100 } },
      { id: 'c1', data: {}, position: { x: 10, y: 10 }, parentId: 'g', width: 40, height: 20 },
      { id: 'c2', data: {}, position: { x: 60, y: 30 }, parentId: 'g', width: 40, height: 20 },
    ]);
    await service.sizeGroupToChildren('g', { padding: 10, headerHeight: 20 });
    // animate:false inside the method → final state is reached synchronously, children pinned
    expect(store.nodeLookup.get('c1')!.internals.positionAbsolute).toEqual({ x: 110, y: 110 });
    expect(store.nodeLookup.get('c2')!.internals.positionAbsolute).toEqual({ x: 160, y: 130 });
    expect(store.nodeLookup.get('g')!.position).toEqual({ x: 100, y: 90 });
  });

  describe('selectKeyPressed', () => {
    it('caches the signal per key set and registers document listeners once', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const first = service.selectKeyPressed('Shift');
      const second = service.selectKeyPressed('Shift');

      expect(second).toBe(first);
      const keydownRegistrations = addSpy.mock.calls.filter(([type]) => type === 'keydown');
      expect(keydownRegistrations).toHaveLength(1);
      addSpy.mockRestore();
    });

    it('tracks key state through the cached signal', () => {
      const pressed = service.selectKeyPressed('Shift');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      expect(pressed()).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
      expect(pressed()).toBe(false);
    });

    it('returns an inert signal when document is unavailable (SSR)', () => {
      // vi.stubGlobal('document', undefined) cannot override jsdom's non-configurable
      // document property. Instead we test the SSR path by providing DOCUMENT=null
      // via Angular's DI — the same guard the implementation uses.
      //
      // We use a sub-TestBed environment so the main beforeEach fixture isn't affected.
      // A minimal stub satisfies Angular's DOM test renderer teardown while being
      // falsy enough to trigger the SSR guard (DOCUMENT token resolved as null).
      TestBed.resetTestingModule();
      // Provide a minimal doc stub so Angular's DOMTestComponentRenderer doesn't
      // crash during teardown, while still being a distinct (non-real-document)
      // value that we can test separately.
      const docStub = {
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        body: { removeChild: () => {} },
      };
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          FlowStore,
          NgFlowService,
          { provide: DOCUMENT, useValue: docStub },
        ],
      });
      // Override the private doc field to null to simulate SSR (no document available)
      const ssrService = TestBed.inject(NgFlowService) as any;
      (ssrService as any)['doc'] = null;
      const pressed = ssrService.selectKeyPressed('Meta');
      expect(pressed()).toBe(false);
    });
  });

  // ── getCollapsedHiddenIds ─────────────────────────────────────────────

  describe('getCollapsedHiddenIds', () => {
    it('returns [] when nothing is collapsed', () => {
      service.setNodes([makeNode('g', { type: 'group' }), makeNode('a', { parentId: 'g' })]);
      expect(service.getCollapsedHiddenIds()).toEqual([]);
    });

    it('returns the nesting-aware descendants of a collapsed group', () => {
      service.setNodes([
        makeNode('g', { type: 'group', collapsed: true }),
        makeNode('a', { parentId: 'g' }),
        makeNode('b', { parentId: 'g' }),
        makeNode('c'),
      ]);
      expect(service.getCollapsedHiddenIds().sort()).toEqual(['a', 'b']);
    });

    it('includes grandchildren (depth > 1) of a collapsed group', () => {
      service.setNodes([
        makeNode('g', { type: 'group', collapsed: true }),
        makeNode('sub', { type: 'group', parentId: 'g' }),
        makeNode('leaf', { parentId: 'sub' }),
      ]);
      expect(service.getCollapsedHiddenIds().sort()).toEqual(['leaf', 'sub']);
    });
  });
});

describe('groupNodes', () => {
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    service = TestBed.inject(NgFlowService);
  });

  it('creates a group node, reparents members, and pins them visually', async () => {
    service.setNodes([
      makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('b', { position: { x: 300, y: 200 }, width: 50, height: 50 }),
    ]);
    const gid = await service.groupNodes(['a', 'b'], { groupId: 'g', label: 'G' });
    expect(gid).toBe('g');
    const g = service.getNode('g');
    expect(g?.type).toBe('group');
    expect(g?.data?.['label']).toBe('G');
    expect(service.getNode('a')?.parentId).toBe('g');
    expect(service.getNode('b')?.parentId).toBe('g');
    expect(service.getAbsolutePosition('a')).toEqual({ x: 100, y: 100 });
    expect(service.getAbsolutePosition('b')).toEqual({ x: 300, y: 200 });
  });

  it('throws when the group id already exists, leaving the flow untouched', async () => {
    service.setNodes([
      makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('g'),
    ]);
    await expect(service.groupNodes(['a'], { groupId: 'g' })).rejects.toThrow(/already exists/);
    expect(service.getNode('a')?.parentId).toBeUndefined();
    expect(service.getNodes()).toHaveLength(2);
  });

  it('resolves members listed before their group (#5915): parent lookup and internal absolutes', async () => {
    const store = TestBed.inject(FlowStore);
    service.setNodes([
      makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('b', { position: { x: 300, y: 200 }, width: 50, height: 50 }),
    ]);
    const before = {
      a: { ...store.nodeLookup.get('a')!.internals.positionAbsolute },
      b: { ...store.nodeLookup.get('b')!.internals.positionAbsolute },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const gid = await service.groupNodes(['a', 'b']);
    expect(warn).not.toHaveBeenCalled();
    // the service appends the group after its members
    const ids = service.getNodes().map((n) => n.id);
    expect(ids.indexOf(gid)).toBeGreaterThan(ids.indexOf('a'));
    expect(ids.indexOf(gid)).toBeGreaterThan(ids.indexOf('b'));
    const children = store.parentLookup.get(gid);
    expect(children?.has('a')).toBe(true);
    expect(children?.has('b')).toBe(true);
    expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual(before.a);
    expect(store.nodeLookup.get('b')!.internals.positionAbsolute).toEqual(before.b);

    // A later update re-adopts the same members-first order. Moving the group
    // must carry its members, and they must stay in the group's parent lookup.
    const g = service.getNode(gid)!;
    service.updateNode(gid, { position: { x: g.position.x + 1000, y: g.position.y + 500 } });
    expect(warn).not.toHaveBeenCalled();
    expect(store.parentLookup.get(gid)?.has('a')).toBe(true);
    expect(store.parentLookup.get(gid)?.has('b')).toBe(true);
    expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual({ x: before.a.x + 1000, y: before.a.y + 500 });
    expect(store.nodeLookup.get('b')!.internals.positionAbsolute).toEqual({ x: before.b.x + 1000, y: before.b.y + 500 });
  });
});

describe('setNodeGroup', () => {
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    service = TestBed.inject(NgFlowService);
  });

  it('reparents a node into a group, preserving its absolute position', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { position: { x: 200, y: 200 }, width: 50, height: 50 }),
    ]);
    await service.setNodeGroup('a', 'g');
    expect(service.getNode('a')?.parentId).toBe('g');
    expect(service.getAbsolutePosition('a')).toEqual({ x: 200, y: 200 });
  });

  it('detaches a node to top-level when groupId is null, preserving absolute position', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 150, y: 150 }, width: 50, height: 50 }),
    ]);
    const before = service.getAbsolutePosition('a');
    await service.setNodeGroup('a', null);
    expect(service.getNode('a')?.parentId).toBeUndefined();
    expect(service.getAbsolutePosition('a')).toEqual(before);
  });

  it('reparents in one synchronous changeset (update + position), via changeParent', async () => {
    const store = TestBed.inject(FlowStore);
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { position: { x: 200, y: 200 }, width: 50, height: 50 }),
    ]);
    const before = { ...store.nodeLookup.get('a')!.internals.positionAbsolute };
    const sets: unknown[][] = [];
    store.onNodesChange = (c) => sets.push(c.toArray());
    const done = service.setNodeGroup('a', 'g');
    // Applied before the promise settles: no animation or deferred step.
    expect(service.getNode('a')?.parentId).toBe('g');
    await expect(done).resolves.toBeUndefined();
    expect(sets).toEqual([
      [
        { id: 'a', type: 'position', position: { x: 150, y: 150 } },
        { id: 'a', type: 'update', item: { parentId: 'g' } },
      ],
    ]);
    expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual(before);
  });

  it('keeps the node in place with a non-zero nodeOrigin', async () => {
    const store = TestBed.inject(FlowStore);
    store.nodeOrigin.set([0.5, 0.5]);
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 300, y: 300 }, width: 400, height: 400 }),
      makeNode('a', { position: { x: 400, y: 400 }, width: 40, height: 20 }),
    ]);
    const before = { ...store.nodeLookup.get('a')!.internals.positionAbsolute };
    await service.setNodeGroup('a', 'g');
    expect(service.getNode('a')?.parentId).toBe('g');
    expect(store.nodeLookup.get('a')!.internals.positionAbsolute).toEqual(before);
  });

  it('resolves and no-ops on a missing node or a missing group', async () => {
    const store = TestBed.inject(FlowStore);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    onTestFinished(() => warn.mockRestore());
    service.setNodes([makeNode('a', { position: { x: 1, y: 2 }, width: 10, height: 10 })]);
    const sets: unknown[] = [];
    store.onNodesChange = (c) => sets.push(c);
    await expect(service.setNodeGroup('a', 'ghost')).resolves.toBeUndefined();
    await expect(service.setNodeGroup('ghost', null)).resolves.toBeUndefined();
    expect(sets).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    expect(service.getNode('a')?.parentId).toBeUndefined();
  });
});

describe('getGroupBox', () => {
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    service = TestBed.inject(NgFlowService);
  });

  it('returns the current absolute box of a group, null for unknown id', () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 60 }, width: 300, height: 200 }),
    ]);
    expect(service.getGroupBox('g')).toEqual({ x: 50, y: 60, width: 300, height: 200 });
    expect(service.getGroupBox('nope')).toBeNull();
  });
});

describe('dissolveGroup', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('removes the group, frees its children to top-level, and pins them', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('b', { parentId: 'g', position: { x: 150, y: 150 }, width: 50, height: 50 }),
    ]);
    const absA = service.getAbsolutePosition('a');
    const freed = await service.dissolveGroup('g');
    expect(freed.sort()).toEqual(['a', 'b']);
    expect(service.getNode('g')).toBeUndefined();
    expect(service.getNode('a')?.parentId).toBeUndefined();
    expect(service.getAbsolutePosition('a')).toEqual(absA);
  });

  it('reparents children to the group\'s parent for a nested group, pinned', async () => {
    service.setNodes([
      makeNode('outer', { type: 'group', position: { x: 10, y: 10 }, width: 600, height: 600 }),
      makeNode('inner', { type: 'group', parentId: 'outer', position: { x: 40, y: 40 }, width: 300, height: 300 }),
      makeNode('a', { parentId: 'inner', position: { x: 20, y: 20 }, width: 50, height: 50 }),
    ]);
    const absA = service.getAbsolutePosition('a');
    const freed = await service.dissolveGroup('inner');
    expect(freed).toEqual(['a']);
    expect(service.getNode('inner')).toBeUndefined();
    expect(service.getNode('a')?.parentId).toBe('outer'); // lands in the grandparent
    expect(service.getAbsolutePosition('a')).toEqual(absA); // still pinned
  });

  it('leaves everything untouched when onBeforeDelete vetoes', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    store.onBeforeDelete = async () => false;
    const freed = await service.dissolveGroup('g');
    expect(freed).toEqual([]);
    expect(service.getNode('g')).toBeTruthy(); // group survives
    expect(service.getNode('a')?.parentId).toBe('g'); // child not detached
  });

  it('reparents before deleting: onBeforeDelete sees only the group and its edges', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('x', { position: { x: 600, y: 0 } }),
    ]);
    service.setEdges([makeEdge('gx', 'g', 'x'), makeEdge('ax', 'a', 'x')]);
    const seen: { nodes: string[]; edges: string[]; parentOfA?: string } = { nodes: [], edges: [] };
    store.onBeforeDelete = async ({ nodes, edges }) => {
      seen.nodes = nodes.map((n) => n.id);
      seen.edges = edges.map((e) => e.id);
      seen.parentOfA = service.getNode('a')?.parentId; // already reparented when the hook runs
      return true;
    };
    expect(await service.dissolveGroup('g')).toEqual(['a']);
    expect(seen).toEqual({ nodes: ['g'], edges: ['gx'], parentOfA: undefined });
    expect(service.getEdge('ax')).toBeTruthy();
  });

  it('a top-level group frees an extent: parent child without error005 and keeps it where it was drawn', async () => {
    const onError = vi.fn();
    store.onError.set(onError);
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 200, height: 200 }),
      // Overflows the group on the right: drawn clamped at relative x = 150 (abs 200).
      makeNode('a', { parentId: 'g', extent: 'parent', position: { x: 180, y: 10 }, width: 50, height: 50 }),
    ]);
    const drawnBefore = { ...service.getInternalNode('a')!.internals.positionAbsolute };
    expect(drawnBefore.x).toBe(200); // precondition: the clamp applies in this setup
    await service.dissolveGroup('g');
    const a = service.getNode('a')!;
    expect(a.parentId).toBeUndefined();
    expect(a.extent).toBeUndefined();
    expect(service.getInternalNode('a')!.internals.positionAbsolute).toEqual(drawnBefore);
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps extent: parent under a grandparent', async () => {
    service.setNodes([
      makeNode('outer', { type: 'group', position: { x: 0, y: 0 }, width: 600, height: 600 }),
      makeNode('inner', { type: 'group', parentId: 'outer', position: { x: 40, y: 40 }, width: 300, height: 300 }),
      makeNode('a', { parentId: 'inner', extent: 'parent', position: { x: 20, y: 20 }, width: 50, height: 50 }),
    ]);
    const absA = service.getAbsolutePosition('a');
    await service.dissolveGroup('inner');
    expect(service.getNode('a')).toMatchObject({ parentId: 'outer', extent: 'parent' });
    expect(service.getAbsolutePosition('a')).toEqual(absA);
  });

  it('an extent: parent child that overhangs the grandparent is clamped into it (accepted)', async () => {
    service.setNodes([
      makeNode('outer', { type: 'group', position: { x: 0, y: 0 }, width: 300, height: 300 }),
      // inner overhangs outer (no extent on inner itself); a sits inside inner at abs (350, 350).
      makeNode('inner', { type: 'group', parentId: 'outer', position: { x: 200, y: 200 }, width: 200, height: 200 }),
      makeNode('a', { parentId: 'inner', extent: 'parent', position: { x: 150, y: 150 }, width: 50, height: 50 }),
    ]);
    expect(service.getInternalNode('a')!.internals.positionAbsolute).toEqual({ x: 350, y: 350 }); // precondition
    await service.dissolveGroup('inner');
    const a = service.getNode('a')!;
    expect(a).toMatchObject({ parentId: 'outer', extent: 'parent', position: { x: 350, y: 350 } }); // raw write
    // Drawn position: clamped into outer (0..300 minus a's 50px size).
    expect(service.getInternalNode('a')!.internals.positionAbsolute).toEqual({ x: 250, y: 250 });
  });

  it('keeps children where they are drawn under a non-zero nodeOrigin', async () => {
    store.nodeOrigin.set([0.5, 0.5]);
    service.setNodes([
      makeNode('outer', { type: 'group', position: { x: 10, y: 10 }, width: 600, height: 600 }),
      makeNode('inner', { type: 'group', parentId: 'outer', position: { x: 100, y: 80 }, width: 300, height: 300 }),
      makeNode('a', { parentId: 'inner', position: { x: 60, y: 40 }, width: 50, height: 30 }),
      makeNode('g', { type: 'group', position: { x: 500, y: 500 }, width: 200, height: 200 }),
      makeNode('b', { parentId: 'g', position: { x: 30, y: 20 }, width: 40, height: 20 }),
    ]);
    const drawnA = { ...service.getInternalNode('a')!.internals.positionAbsolute };
    const drawnB = { ...service.getInternalNode('b')!.internals.positionAbsolute };
    expect(await service.dissolveGroup('inner')).toEqual(['a']);
    expect(await service.dissolveGroup('g')).toEqual(['b']);
    expect(service.getNode('a')?.parentId).toBe('outer');
    expect(service.getNode('b')?.parentId).toBeUndefined();
    expect(service.getInternalNode('a')!.internals.positionAbsolute).toEqual(drawnA);
    expect(service.getInternalNode('b')!.internals.positionAbsolute).toEqual(drawnB);
  });

  it('a veto restores raw parentId, position and extent', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 200, height: 200 }),
      makeNode('a', { parentId: 'g', extent: 'parent', position: { x: 180, y: 10 }, width: 50, height: 50 }),
    ]);
    store.onBeforeDelete = async () => false;
    expect(await service.dissolveGroup('g')).toEqual([]);
    expect(service.getNode('g')).toBeTruthy();
    expect(service.getNode('a')).toMatchObject({ parentId: 'g', extent: 'parent', position: { x: 180, y: 10 } }); // raw, not re-clamped
  });
  it('a narrowing onBeforeDelete that keeps the group restores the children', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    store.onBeforeDelete = async () => ({ nodes: [], edges: [] });
    expect(await service.dissolveGroup('g')).toEqual([]);
    expect(service.getNode('g')).toBeTruthy();
    expect(service.getNode('a')).toMatchObject({ parentId: 'g', position: { x: 100, y: 100 } });
  });

  it('a throwing or rejecting onBeforeDelete restores the children and rethrows', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    store.onBeforeDelete = () => Promise.reject(new Error('boom'));
    await expect(service.dissolveGroup('g')).rejects.toThrow('boom');
    expect(service.getNode('g')).toBeTruthy();
    expect(service.getNode('a')).toMatchObject({ parentId: 'g', position: { x: 100, y: 100 } });
  });

  it('a deletable: false group restores the children', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', deletable: false, position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    expect(await service.dissolveGroup('g')).toEqual([]);
    expect(service.getNode('g')).toBeTruthy();
    expect(service.getNode('a')).toMatchObject({ parentId: 'g', position: { x: 100, y: 100 } });
  });

  it('a group whose child is itself a group: only the group is deleted', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 10, y: 10 }, width: 600, height: 600 }),
      makeNode('inner', { type: 'group', parentId: 'g', position: { x: 40, y: 40 }, width: 300, height: 300 }),
      makeNode('a', { parentId: 'inner', position: { x: 20, y: 20 }, width: 50, height: 50 }),
    ]);
    await service.dissolveGroup('g');
    expect(service.getNode('g')).toBeUndefined();
    expect(service.getNode('inner')).toBeTruthy();
    expect(service.getNode('inner')?.parentId).toBeUndefined();
    expect(service.getNode('a')?.parentId).toBe('inner');
  });
});

describe('getNodesBounds', () => {
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    service = TestBed.inject(NgFlowService);
  });

  it('uses absolute positions for sub-flow children', () => {
    service.setNodes([
      makeNode('p', { position: { x: 100, y: 100 } }),
      makeNode('c', { parentId: 'p', position: { x: 10, y: 10 }, width: 50, height: 50 }),
    ]);
    const bounds = service.getNodesBounds([service.getNode('c')!]);
    expect(bounds.x).toBe(110);
    expect(bounds.y).toBe(110);
  });
});
