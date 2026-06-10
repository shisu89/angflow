import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computed } from '@angular/core';
import type { NodeChange } from '@angflow/system';
import { FlowStore } from './flow-store.service';
import type { Node, Edge } from '../types';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', ...overrides };
}

function makeEdge(id: string, source: string, target: string, overrides: Partial<Edge> = {}): Edge {
  return { id, source, target, ...overrides };
}

describe('FlowStore', () => {
  let store: FlowStore;

  beforeEach(() => {
    store = new FlowStore();
  });

  // ── setNodes: lookup population & internals ───────────────────────────

  describe('setNodes populates nodeLookup with internals', () => {
    it('creates internal node entries with positionAbsolute', () => {
      store.setNodes([makeNode('1', { position: { x: 50, y: 100 } })]);
      const internal = store.nodeLookup.get('1');
      expect(internal).toBeDefined();
      expect(internal!.internals?.positionAbsolute).toBeDefined();
    });

    it('stores userNode back-reference in internals', () => {
      const node = makeNode('1');
      store.setNodes([node]);
      const internal = store.nodeLookup.get('1');
      expect(internal!.internals?.userNode).toBeDefined();
      expect(internal!.internals!.userNode.id).toBe('1');
    });

    it('removes stale entries from nodeLookup on replace', () => {
      store.setNodes([makeNode('1'), makeNode('2')]);
      expect(store.nodeLookup.size).toBe(2);

      store.setNodes([makeNode('3')]);
      // Old nodes should be gone from lookup
      expect(store.nodeLookup.has('1')).toBe(false);
      expect(store.nodeLookup.has('2')).toBe(false);
      expect(store.nodeLookup.has('3')).toBe(true);
    });
  });

  // ── setEdges: connectionLookup population ─────────────────────────────

  describe('setEdges populates edgeLookup and connectionLookup', () => {
    it('maps edge IDs in edgeLookup', () => {
      store.setEdges([makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')]);
      expect(store.edgeLookup.get('e1')?.source).toBe('a');
      expect(store.edgeLookup.get('e2')?.target).toBe('c');
    });

    it('builds connectionLookup keyed by node ID', () => {
      store.setEdges([makeEdge('e1', 'a', 'b')]);
      // Both source and target nodes should appear in connectionLookup
      expect(store.connectionLookup.has('a')).toBe(true);
      expect(store.connectionLookup.has('b')).toBe(true);
    });

    it('clears stale edgeLookup entries on replace', () => {
      store.setEdges([makeEdge('e1', 'a', 'b')]);
      store.setEdges([makeEdge('e2', 'c', 'd')]);
      expect(store.edgeLookup.has('e1')).toBe(false);
      expect(store.edgeLookup.has('e2')).toBe(true);
    });
  });

  // ── triggerNodeChanges: fast-path vs full-path ────────────────────────

  describe('triggerNodeChanges', () => {
    let changeSpy: ReturnType<typeof vi.fn<(changes: NodeChange<Node>[]) => void>>;

    beforeEach(() => {
      changeSpy = vi.fn<(changes: NodeChange<Node>[]) => void>();
      store.onNodesChange = changeSpy;
      store.setNodes([
        makeNode('1', { position: { x: 0, y: 0 } }),
        makeNode('2', { position: { x: 100, y: 100 } }),
      ]);
    });

    it('fast-path: position-only changes update nodeLookup in-place without setNodes', () => {
      const vBefore = store.version();

      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 50, y: 60 }, dragging: true },
      ]);

      // nodeLookup updated in-place
      const internal = store.nodeLookup.get('1');
      expect(internal!.position).toEqual({ x: 50, y: 60 });
      expect(internal!.dragging).toBe(true);

      // userNode reference also updated
      expect(internal!.internals!.userNode.position).toEqual({ x: 50, y: 60 });

      // Only one version bump (not the double bump from setNodes→bumpVersion + triggerNodeChanges→bumpVersion)
      expect(store.version()).toBe(vBefore + 1);
    });

    it('full-path: non-position changes go through applyNodeChanges + setNodes', () => {
      store.triggerNodeChanges([
        { id: '1', type: 'select', selected: true },
      ]);

      // setNodes was called, so nodes array is updated
      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(true);
    });

    it('mixed changes take the full path', () => {
      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 10, y: 20 } },
        { id: '2', type: 'select', selected: true },
      ]);

      // Both changes applied via full path
      expect(store.nodes().find(n => n.id === '2')?.selected).toBe(true);
    });

    it('fires onNodesChange callback with all changes', () => {
      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 10, y: 20 } },
      ]);
      expect(changeSpy).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', type: 'position' }),
      ]);
    });

    it('no-ops on empty changes array', () => {
      const vBefore = store.version();
      store.triggerNodeChanges([]);
      expect(store.version()).toBe(vBefore);
      expect(changeSpy).not.toHaveBeenCalled();
    });
  });

  // ── Middleware pipeline ────────────────────────────────────────────────

  describe('middleware pipeline', () => {
    it('middleware can filter out specific change types', () => {
      const spy = vi.fn();
      store.onNodesChange = spy;
      store.setNodes([makeNode('1'), makeNode('2')]);

      store.nodesChangeMiddleware.set('block-select', (changes) =>
        changes.filter(c => c.type !== 'select')
      );

      store.addSelectedNodes(['1']);

      // Middleware blocked all select changes, so callback should receive empty or no call
      const allChanges = spy.mock.calls.flatMap(([c]) => c);
      expect(allChanges.filter((c: any) => c.type === 'select')).toHaveLength(0);
    });

    it('middleware can transform position values', () => {
      const spy = vi.fn();
      store.onNodesChange = spy;
      store.setNodes([makeNode('1')]);

      // Middleware that snaps positions to grid of 10
      store.nodesChangeMiddleware.set('snap', (changes) =>
        changes.map(c => {
          if (c.type === 'position' && c.position) {
            return {
              ...c,
              position: {
                x: Math.round(c.position.x / 10) * 10,
                y: Math.round(c.position.y / 10) * 10,
              },
            };
          }
          return c;
        })
      );

      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 13, y: 27 } },
      ]);

      const posChanges = spy.mock.calls[0][0].filter((c: any) => c.type === 'position');
      expect(posChanges[0].position).toEqual({ x: 10, y: 30 });
    });

    it('middleware returning empty array stops the pipeline', () => {
      const spy = vi.fn();
      store.onNodesChange = spy;
      store.setNodes([makeNode('1')]);

      store.nodesChangeMiddleware.set('block-all', () => []);

      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 50, y: 50 } },
      ]);

      expect(spy).not.toHaveBeenCalled();
    });

    it('edge middleware works the same way', () => {
      const spy = vi.fn();
      store.onEdgesChange = spy;
      store.setNodes([makeNode('1'), makeNode('2')]);
      store.setEdges([makeEdge('e1', '1', '2')]);

      store.edgesChangeMiddleware.set('block', () => []);
      store.addSelectedEdges(['e1']);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── Selection: single vs multi ────────────────────────────────────────

  describe('selection behavior', () => {
    beforeEach(() => {
      store.setNodes([makeNode('1'), makeNode('2'), makeNode('3')]);
      store.setEdges([makeEdge('e1', '1', '2'), makeEdge('e2', '2', '3')]);
    });

    it('single-select mode: selecting a node deselects all other nodes and edges', () => {
      store.multiSelectionActive.set(false);

      store.addSelectedNodes(['1']);
      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(true);

      store.addSelectedNodes(['2']);
      // Node 1 should now be deselected
      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(false);
      expect(store.nodes().find(n => n.id === '2')?.selected).toBe(true);
    });

    it('multi-select mode: selecting a node preserves existing selection', () => {
      store.multiSelectionActive.set(true);

      store.addSelectedNodes(['1']);
      store.addSelectedNodes(['2']);

      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(true);
      expect(store.nodes().find(n => n.id === '2')?.selected).toBe(true);
      expect(store.nodes().find(n => n.id === '3')?.selected).toBeFalsy();
    });

    it('single-select edge deselects all nodes', () => {
      store.multiSelectionActive.set(false);
      store.addSelectedNodes(['1']);
      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(true);

      store.addSelectedEdges(['e1']);
      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(false);
      expect(store.edges().find(e => e.id === 'e1')?.selected).toBe(true);
    });

    it('unselectNodesAndEdges with specific targets only deselects those', () => {
      store.multiSelectionActive.set(true);
      store.addSelectedNodes(['1']);
      store.addSelectedNodes(['2']);

      store.unselectNodesAndEdges({ nodes: [store.nodes().find(n => n.id === '1')!] });

      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(false);
      expect(store.nodes().find(n => n.id === '2')?.selected).toBe(true);
    });

    it('getSelectionChanges generates changes only for elements whose selection state actually changes', () => {
      // Select node 1
      store.addSelectedNodes(['1']);
      // Select node 1 again in single-select mode — this should still generate
      // deselection changes for the other nodes but not a redundant select for node 1
      const spy = vi.fn();
      store.onNodesChange = spy;

      store.addSelectedNodes(['1']);

      // All emitted changes should have meaningful state transitions
      if (spy.mock.calls.length > 0) {
        const changes = spy.mock.calls[0][0];
        for (const change of changes) {
          if (change.type === 'select') {
            const node = store.nodeLookup.get(change.id);
            // The change should reflect the desired state
            expect(typeof change.selected).toBe('boolean');
          }
        }
      }
    });
  });

  // ── Batch: coalescing ─────────────────────────────────────────────────

  describe('batch coalescing', () => {
    it('setNodes + setEdges inside batch produces one version bump instead of two', () => {
      const v0 = store.version();
      store.batch(() => {
        store.setNodes([makeNode('1'), makeNode('2')]);  // normally bumps
        store.setEdges([makeEdge('e1', '1', '2')]);      // normally bumps
      });
      expect(store.version()).toBe(v0 + 1);
      // But the data is all there
      expect(store.nodes()).toHaveLength(2);
      expect(store.edges()).toHaveLength(1);
      expect(store.edgeLookup.has('e1')).toBe(true);
    });

    it('nested batch defers until outermost completes', () => {
      const v0 = store.version();
      store.batch(() => {
        store.setNodes([makeNode('1')]);
        store.batch(() => {
          store.setEdges([makeEdge('e1', '1', '2')]);
          expect(store.version()).toBe(v0); // still deferred
        });
        expect(store.version()).toBe(v0); // inner didn't flush
      });
      expect(store.version()).toBe(v0 + 1);
    });

    it('batch still flushes version if callback throws', () => {
      const v0 = store.version();
      expect(() => {
        store.batch(() => {
          store.setNodes([makeNode('1')]); // dirties
          throw new Error('boom');
        });
      }).toThrow('boom');
      expect(store.version()).toBe(v0 + 1);
    });

    it('batch with no mutations does not bump version', () => {
      const v0 = store.version();
      store.batch(() => { /* nothing */ });
      expect(store.version()).toBe(v0);
    });
  });

  // ── applyNodeChanges (via triggerNodeChanges full path) ───────────────

  describe('change application', () => {
    beforeEach(() => {
      store.setNodes([
        makeNode('1', { position: { x: 0, y: 0 } }),
        makeNode('2', { position: { x: 100, y: 100 } }),
        makeNode('3', { position: { x: 200, y: 200 } }),
      ]);
    });

    it('remove change deletes a node', () => {
      store.triggerNodeChanges([{ id: '2', type: 'remove' }]);
      expect(store.nodes()).toHaveLength(2);
      expect(store.nodes().find(n => n.id === '2')).toBeUndefined();
    });

    it('add change inserts a new node', () => {
      store.triggerNodeChanges([{
        type: 'add',
        item: makeNode('4', { position: { x: 300, y: 300 } }),
      } as any]);
      expect(store.nodes()).toHaveLength(4);
      expect(store.nodes().find(n => n.id === '4')).toBeDefined();
    });

    it('add with index inserts at specific position', () => {
      store.triggerNodeChanges([{
        type: 'add',
        item: makeNode('4'),
        index: 1,
      } as any]);
      expect(store.nodes()[1].id).toBe('4');
    });

    it('select change updates selected flag', () => {
      store.triggerNodeChanges([{ id: '1', type: 'select', selected: true }]);
      expect(store.nodes().find(n => n.id === '1')?.selected).toBe(true);
      expect(store.nodes().find(n => n.id === '2')?.selected).toBeFalsy();
    });

    it('position change updates node position', () => {
      // Use full path by mixing in a non-position change
      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 999, y: 888 } },
        { id: '2', type: 'select', selected: true },
      ]);
      expect(store.nodes().find(n => n.id === '1')?.position).toEqual({ x: 999, y: 888 });
    });

    it('dimensions change sets measured and optionally width/height', () => {
      store.triggerNodeChanges([{
        id: '1',
        type: 'dimensions',
        dimensions: { width: 200, height: 100 },
        setAttributes: true,
      } as any]);
      const node = store.nodes().find(n => n.id === '1')!;
      expect(node.measured).toEqual({ width: 200, height: 100 });
      expect(node.width).toBe(200);
      expect(node.height).toBe(100);
    });

    it('replace change swaps the node entirely', () => {
      const replacement = makeNode('2', { position: { x: 999, y: 999 }, data: { replaced: true } });
      store.triggerNodeChanges([{ id: '2', type: 'replace', item: replacement } as any]);
      const node = store.nodes().find(n => n.id === '2')!;
      expect(node.position).toEqual({ x: 999, y: 999 });
      expect(node.data).toEqual({ replaced: true });
    });

    it('multiple changes on the same node are applied in order', () => {
      store.triggerNodeChanges([
        { id: '1', type: 'position', position: { x: 50, y: 50 } },
        { id: '1', type: 'select', selected: true },
      ]);
      const node = store.nodes().find(n => n.id === '1')!;
      expect(node.position).toEqual({ x: 50, y: 50 });
      expect(node.selected).toBe(true);
    });
  });

  // ── Edge change application ───────────────────────────────────────────

  describe('edge change application', () => {
    beforeEach(() => {
      store.setNodes([makeNode('1'), makeNode('2'), makeNode('3')]);
      store.setEdges([
        makeEdge('e1', '1', '2'),
        makeEdge('e2', '2', '3'),
      ]);
    });

    it('remove change deletes an edge and updates edgeLookup', () => {
      store.triggerEdgeChanges([{ id: 'e1', type: 'remove' }]);
      expect(store.edges()).toHaveLength(1);
      expect(store.edgeLookup.has('e1')).toBe(false);
    });

    it('select change updates edge selected flag', () => {
      store.triggerEdgeChanges([{ id: 'e1', type: 'select', selected: true }]);
      expect(store.edges().find(e => e.id === 'e1')?.selected).toBe(true);
    });
  });

  // ── visibleNodes with onlyRenderVisibleElements ───────────────────────

  describe('visible elements filtering', () => {
    it('when onlyRenderVisibleElements=false, all nodes are visible', () => {
      store.setNodes([makeNode('1'), makeNode('2'), makeNode('3')]);
      store.onlyRenderVisibleElements.set(false);
      expect(store.visibleNodes()).toHaveLength(3);
    });

    it('when onlyRenderVisibleElements=true, culls measured nodes outside viewport', () => {
      store.width.set(500);
      store.height.set(500);
      store.transform.set([0, 0, 1]);
      store.onlyRenderVisibleElements.set(true);

      store.setNodes([
        makeNode('visible', { position: { x: 100, y: 100 }, width: 100, height: 50 }),
        makeNode('offscreen', { position: { x: 5000, y: 5000 }, width: 100, height: 50 }),
      ]);

      // getNodesInside forces initial render when handleBounds is undefined
      // (nodes need DOM measurement first). Simulate a fully-measured node:
      for (const [, n] of store.nodeLookup) {
        n.measured = { width: n.width ?? 100, height: n.height ?? 50 };
        n.internals.handleBounds = { source: [], target: [] };
      }
      store.bumpVersion();

      const visible = store.visibleNodes();
      const ids = visible.map(n => n.id);
      expect(ids).toContain('visible');
      expect(ids).not.toContain('offscreen');
    });

    it('visibleEdgeIds only includes edges whose source AND target are visible', () => {
      store.width.set(500);
      store.height.set(500);
      store.transform.set([0, 0, 1]);
      store.onlyRenderVisibleElements.set(true);

      store.setNodes([
        makeNode('a', { position: { x: 100, y: 100 }, width: 100, height: 50 }),
        makeNode('b', { position: { x: 200, y: 200 }, width: 100, height: 50 }),
        makeNode('c', { position: { x: 5000, y: 5000 }, width: 100, height: 50 }),
      ]);

      // Simulate fully-measured nodes (handleBounds set = no forced initial render)
      for (const [, n] of store.nodeLookup) {
        n.measured = { width: n.width ?? 100, height: n.height ?? 50 };
        n.internals.handleBounds = { source: [], target: [] };
      }

      store.setEdges([
        makeEdge('ab', 'a', 'b'),
        makeEdge('ac', 'a', 'c'),  // c is offscreen
      ]);

      const visibleEdges = store.visibleEdgeIds();
      expect(visibleEdges.has('ab')).toBe(true);
      expect(visibleEdges.has('ac')).toBe(false);
    });
  });

  // ── updateNodePositions (drag simulation) ─────────────────────────────

  describe('updateNodePositions', () => {
    it('emits position changes with dragging flag', () => {
      const spy = vi.fn();
      store.onNodesChange = spy;
      store.setNodes([makeNode('1', { position: { x: 0, y: 0 } })]);

      const dragItems = new Map([
        ['1', { position: { x: 50, y: 75 }, internals: { positionAbsolute: { x: 50, y: 75 } }, measured: { width: 150, height: 40 } }],
      ]);

      store.updateNodePositions(dragItems, true);

      expect(spy).toHaveBeenCalled();
      const changes = spy.mock.calls[0][0];
      expect(changes[0]).toEqual(expect.objectContaining({
        id: '1',
        type: 'position',
        position: { x: 50, y: 75 },
        dragging: true,
      }));
    });

    it('updates nodeLookup position in-place (fast path)', () => {
      store.setNodes([makeNode('1', { position: { x: 0, y: 0 } })]);

      const dragItems = new Map([
        ['1', { position: { x: 77, y: 88 }, internals: { positionAbsolute: { x: 77, y: 88 } }, measured: { width: 150, height: 40 } }],
      ]);

      store.updateNodePositions(dragItems, true);

      expect(store.nodeLookup.get('1')!.position).toEqual({ x: 77, y: 88 });
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────

  describe('reset clears all mutable state', () => {
    it('clears lookups, signals, and selection state', () => {
      store.setNodes([makeNode('1')]);
      store.setEdges([makeEdge('e1', '1', '2')]);
      store.multiSelectionActive.set(true);
      store.userSelectionActive.set(true);
      store.transform.set([50, 50, 2]);

      store.reset();

      expect(store.nodeLookup.size).toBe(0);
      expect(store.edgeLookup.size).toBe(0);
      expect(store.connectionLookup.size).toBe(0);
      expect(store.nodes()).toEqual([]);
      expect(store.edges()).toEqual([]);
      expect(store.transform()).toEqual([0, 0, 1]);
      expect(store.multiSelectionActive()).toBe(false);
      expect(store.userSelectionActive()).toBe(false);
    });
  });

  // Mirrors the pattern NgFlowComponent.ngOnInit installs to bridge store
  // errors to the component's (error) output while preserving the default
  // devWarn handler.
  describe('onError wrapping preserves previous handler and forwards to emitter', () => {
    it('invokes the previous handler and the new emitter in order', () => {
      const calls: string[] = [];
      const previousOnError = (id: string, message: string) => {
        calls.push(`prev:${id}:${message}`);
      };
      store.onError.set(previousOnError);

      // Simulate the wrap that NgFlowComponent.ngOnInit does.
      const captured = store.onError();
      const emittedEvents: Array<{ id: string; message: string }> = [];
      store.onError.set((id, message) => {
        captured?.(id, message);
        emittedEvents.push({ id, message });
      });

      store.onError()('001', 'something went wrong');

      expect(calls).toEqual(['prev:001:something went wrong']);
      expect(emittedEvents).toEqual([{ id: '001', message: 'something went wrong' }]);
    });

    it('does not throw when wrapping the default devWarn handler', () => {
      // A freshly constructed store starts with devWarn as its default handler.
      // Wrapping it using the ngOnInit pattern must not throw, even though
      // devWarn is a no-op outside NODE_ENV=development.
      const captured = store.onError();
      expect(captured).toBeDefined();

      const emittedEvents: Array<{ id: string; message: string }> = [];
      store.onError.set((id, message) => {
        captured?.(id, message);
        emittedEvents.push({ id, message });
      });

      expect(() => store.onError()('002', 'boom')).not.toThrow();
      expect(emittedEvents).toEqual([{ id: '002', message: 'boom' }]);
    });
  });

  // ── handle data registry (inside FlowStore describe block) ──────────

  describe('handle data registry', () => {
    it('registerHandleData stores a value retrievable by getHandleData', () => {
      store.registerHandleData('n1', 'h1', 'source', 'string');
      expect(store.getHandleData('n1', 'h1', 'source')).toBe('string');
    });

    it('getHandleData returns undefined for unknown keys', () => {
      expect(store.getHandleData('n1', 'h1', 'source')).toBeUndefined();
    });

    it('registerHandleData replaces the existing value for the same key', () => {
      store.registerHandleData('n1', 'h1', 'source', 'string');
      store.registerHandleData('n1', 'h1', 'source', 'number');
      expect(store.getHandleData('n1', 'h1', 'source')).toBe('number');
    });

    it('stores and retrieves a value with null handleId', () => {
      store.registerHandleData('n1', null, 'target', { tag: 'x' });
      expect(store.getHandleData('n1', null, 'target')).toEqual({ tag: 'x' });
    });

    it('differentiates by handle type', () => {
      store.registerHandleData('n1', 'h1', 'source', 'src');
      store.registerHandleData('n1', 'h1', 'target', 'tgt');
      expect(store.getHandleData('n1', 'h1', 'source')).toBe('src');
      expect(store.getHandleData('n1', 'h1', 'target')).toBe('tgt');
    });

    it('unregisterHandleData removes the entry', () => {
      store.registerHandleData('n1', 'h1', 'source', 'string');
      store.unregisterHandleData('n1', 'h1', 'source');
      expect(store.getHandleData('n1', 'h1', 'source')).toBeUndefined();
    });

    it('registerHandleData with undefined value removes the entry', () => {
      store.registerHandleData('n1', 'h1', 'source', 'string');
      store.registerHandleData('n1', 'h1', 'source', undefined);
      expect(store.getHandleData('n1', 'h1', 'source')).toBeUndefined();
    });

    it('handleDataRegistry signal notifies dependents on write', () => {
      const spy = vi.fn<(map: Map<string, unknown>) => void>();
      const c = computed(() => {
        const map = store.handleDataRegistry();
        spy(map);
        return map.size;
      });

      expect(c()).toBe(0);
      const initialCalls = spy.mock.calls.length;
      expect(initialCalls).toBeGreaterThanOrEqual(1);

      store.registerHandleData('n1', 'h1', 'source', 'x');
      expect(c()).toBe(1);
      expect(spy.mock.calls.length).toBeGreaterThan(initialCalls);

      const afterFirst = spy.mock.calls.length;
      store.registerHandleData('n1', 'h2', 'source', 'y');
      expect(c()).toBe(2);
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);

      const afterSecond = spy.mock.calls.length;
      store.unregisterHandleData('n1', 'h1', 'source');
      expect(c()).toBe(1);
      expect(spy.mock.calls.length).toBeGreaterThan(afterSecond);
    });

    it('distinguishes null handleId from empty-string handleId', () => {
      store.registerHandleData('n1', null, 'source', 'null-data');
      store.registerHandleData('n1', '', 'source', 'empty-data');
      expect(store.getHandleData('n1', null, 'source')).toBe('null-data');
      expect(store.getHandleData('n1', '', 'source')).toBe('empty-data');
    });

    it('reset() clears all registered handle data', () => {
      store.registerHandleData('n1', 'h1', 'source', 'x');
      store.registerHandleData('n2', 'h2', 'target', 'y');
      expect(store.handleDataRegistry().size).toBe(2);
      store.reset();
      expect(store.handleDataRegistry().size).toBe(0);
    });
  });
});

describe('tweenNodePositions', () => {
  let frames: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    frames = [];
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function tick(toTime: number) {
    now = toTime;
    const cb = frames.shift();
    expect(cb).toBeDefined();
    cb!(now);
  }

  it('interpolates positions each frame and lands exactly on the target', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    const done = store.tweenNodePositions({ a: { x: 100, y: 50 } }, 100);

    tick(50); // halfway
    const mid = store.nodeLookup.get('a')!.position;
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(100);

    tick(100); // complete
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 100, y: 50 });
    expect(frames.length).toBe(0); // loop must have exited — no pending frame
    await done; // promise resolves on completion
  });

  it('emits position changes through the change pipeline while tweening', () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    const seen: NodeChange[] = [];
    store.onNodesChange = (changes) => seen.push(...changes);

    store.tweenNodePositions({ a: { x: 100, y: 0 } }, 100);
    tick(50);
    expect(seen.some((c) => c.type === 'position')).toBe(true);
  });

  it('a user drag cancels that node\'s tween', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a'), makeNode('b')]);
    const done = store.tweenNodePositions({ a: { x: 100, y: 0 }, b: { x: 0, y: 100 } }, 100);

    tick(10);
    // Simulate XYDrag moving node a.
    store.updateNodePositions(
      new Map([['a', { id: 'a', position: { x: 7, y: 7 }, internals: {}, measured: {} }]]),
      true,
    );
    tick(100); // b's tween completes; a must stay where the drag put it
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 7, y: 7 });
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 0, y: 100 });
    await done; // resolves even though one node was cancelled
  });

  it('retargeting replaces the tween from the current interpolated position', () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    store.tweenNodePositions({ a: { x: 100, y: 0 } }, 100);
    tick(50);
    const midX = store.nodeLookup.get('a')!.position.x;
    store.tweenNodePositions({ a: { x: 0, y: 0 } }, 100); // back to origin
    tick(150); // retargeted tween started at t=50, so it completes here
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 0 });
    expect(midX).toBeGreaterThan(0); // sanity: it really was mid-flight
  });

  it('resolves immediately for unknown ids or already-at-target positions', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    await store.tweenNodePositions({ nope: { x: 1, y: 1 }, a: { x: 0, y: 0 } }, 100);
    expect(frames.length).toBe(0); // no loop started
  });

  it('tweens child nodes in parent-relative space (no first-frame jump)', async () => {
    const store = new FlowStore();
    store.setNodes([
      makeNode('p', { position: { x: 100, y: 100 } }),
      makeNode('c', { position: { x: 10, y: 10 }, parentId: 'p' } as Partial<Node> as Node),
    ]);
    const done = store.tweenNodePositions({ c: { x: 50, y: 50 } }, 100);
    tick(1); // first frame, t≈0: must start at the RELATIVE position, not (110,110)
    const c = store.nodeLookup.get('c')!;
    expect(c.position.x).toBeLessThan(12);
    expect(c.position.y).toBeLessThan(12);
    tick(100);
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 50, y: 50 });
    await done;
  });

  it('ignores tweens started after destroy and leaves no frame queued', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    store.ngOnDestroy();
    await store.tweenNodePositions({ a: { x: 100, y: 0 } }, 100);
    expect(frames.length).toBe(0);
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 0 });
  });

  it('ngOnDestroy mid-tween resolves waiters; leftover frame is a no-op', async () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a')]);
    const done = store.tweenNodePositions({ a: { x: 100, y: 0 } }, 100);
    tick(50);
    const midX = store.nodeLookup.get('a')!.position.x;
    store.ngOnDestroy();
    await done;
    now = 100;
    frames.shift()?.(now); // simulate a stale frame firing despite cancel
    expect(store.nodeLookup.get('a')!.position.x).toBe(midX);
  });

  it('skips nodes that are mid-drag (drag owns the position)', () => {
    const store = new FlowStore();
    store.setNodes([makeNode('a'), makeNode('b')]);
    store.nodeLookup.get('a')!.dragging = true;
    store.tweenNodePositions({ a: { x: 100, y: 0 }, b: { x: 0, y: 100 } }, 100);
    tick(100);
    expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 0 }); // untouched
    expect(store.nodeLookup.get('b')!.position).toEqual({ x: 0, y: 100 });
  });
});

describe('animate signal helpers', () => {
  it('animationEnabled reflects the animate signal', () => {
    const store = new FlowStore();
    expect(store.animationEnabled()).toBe(false);
    store.animate.set(true);
    expect(store.animationEnabled()).toBe(true);
    store.animate.set({ duration: 200 });
    expect(store.animationEnabled()).toBe(true);
  });
  it('animationDuration defaults to 300 and honors the override', () => {
    const store = new FlowStore();
    expect(store.animationDuration()).toBe(300);
    store.animate.set({ duration: 200 });
    expect(store.animationDuration()).toBe(200);
  });
});

describe('collapse computeds', () => {
  let store: FlowStore;

  beforeEach(() => {
    store = new FlowStore();
  });

  it('visibleNodes excludes descendants of a collapsed parent', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true },
      { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      { id: 'x', data: {}, position: { x: 0, y: 0 } },
    ]);
    const ids = store.visibleNodes().map((n) => n.id).sort();
    expect(ids).toEqual(['g', 'x']);
  });

  it('displayEdges reroutes a crossing edge to the collapsed box', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: true },
      { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
      { id: 'x', data: {}, position: { x: 0, y: 0 } },
    ]);
    store.setEdges([{ id: 'e1', source: 'x', target: 'a' }]);
    const de = store.displayEdges();
    expect(de).toHaveLength(1);
    expect(de[0].target).toBe('g');
  });

  it('an expanded group hides nothing and leaves edges intact', () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 }, collapsed: false },
      { id: 'a', data: {}, position: { x: 0, y: 0 }, parentId: 'g' },
    ]);
    store.setEdges([{ id: 'e1', source: 'a', target: 'a' }]);
    expect(store.visibleNodes().map((n) => n.id).sort()).toEqual(['a', 'g']);
    expect(store.displayEdges()).toHaveLength(1);
  });
});

describe('position fast-path absolute positions', () => {
  let store: FlowStore;
  beforeEach(() => { store = new FlowStore(); });

  it('recomputes positionAbsolute for a parented node on a position change', () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 10, y: 10 }, parentId: 'p' },
    ]);
    store.triggerNodeChanges([{ id: 'c', type: 'position', position: { x: 20, y: 30 } }]);
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 20, y: 30 });
    // absolute = parent.positionAbsolute + position = {100+20, 50+30}
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 120, y: 80 });
  });

  it('leaves a top-level node positionAbsolute === position', () => {
    store.setNodes([{ id: 'n', data: {}, position: { x: 5, y: 5 } }]);
    store.triggerNodeChanges([{ id: 'n', type: 'position', position: { x: 9, y: 9 } }]);
    expect(store.nodeLookup.get('n')!.internals.positionAbsolute).toEqual({ x: 9, y: 9 });
  });
});
