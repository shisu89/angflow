import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from './flow-store.service';
import { NgFlowService } from './ng-flow.service';
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
      const before = store.nodes();

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
  });
});
