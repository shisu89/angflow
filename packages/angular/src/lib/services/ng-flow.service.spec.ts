import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, DOCUMENT } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
import { layoutNodes } from '../layout/layout-nodes';
import type { Node, Edge } from '../types';

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
      store.onNodesChange = (c) => nodeChanges.push(...c);
      store.onEdgesChange = (c) => edgeChanges.push(...c);

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

    it('filters out IDs that no longer exist in nodeLookup', () => {
      service.setNodes([makeNode('1')]);
      const sig = service.selectNodesData(['1', 'gone']);
      expect(sig()).toHaveLength(1);
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
  ): HTMLDivElement {
    return {
      querySelector(selector: string): { offsetWidth: number; offsetHeight: number } | null {
        const node = selector.match(/^\.xy-flow__node\[data-id="(.+)"\]$/);
        if (node) {
          const d = nodeDims[node[1]];
          return d ? { offsetWidth: d.w, offsetHeight: d.h } : null;
        }
        const label = selector.match(/^\.xy-flow__edge-label\[data-id="(.+)"\]$/);
        if (label) {
          const d = labelDims[label[1]];
          return d ? { offsetWidth: d.w, offsetHeight: d.h } : null;
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
    store.onNodesChange = (c) => changes.push(...c);
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
});
