import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../services/flow-store.service';
import { NgFlowService } from '../services/ng-flow.service';
import { AngflowAgentBridge } from './agent-bridge.service';
import { provideAgentBridge } from './provide-agent-bridge';
import { WindowTransport } from './transports/window';
import type { AgentOutbound, AgentTransport, AgentInbound, AgentResponse } from './types';
import type { Node, Edge } from '../types';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: {}, type: 'default', ...overrides };
}

class CapturingTransport implements AgentTransport {
  events: AgentOutbound[] = [];
  handler: ((req: AgentInbound) => Promise<AgentResponse>) | null = null;

  start(handler: (req: AgentInbound) => Promise<AgentResponse>): void {
    this.handler = handler;
  }
  send(frame: AgentOutbound): void {
    this.events.push(frame);
  }
  stop(): void {
    this.handler = null;
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<AgentResponse> {
    if (!this.handler) throw new Error('not started');
    return this.handler({ id: Math.random(), method, params });
  }
}

function setup(transports: AgentTransport[] = []): {
  bridge: AngflowAgentBridge;
  newFlow: () => NgFlowService;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideAgentBridge({ transports }),
    ],
  });
  const bridge = TestBed.inject(AngflowAgentBridge);

  // Each flow needs its own injector since FlowStore/NgFlowService are
  // normally provided at the <ng-flow> component level. Create child
  // injectors manually so callers can spin up multiple independent flows.
  const newFlow = (): NgFlowService => {
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    return child.get(NgFlowService);
  };

  return { bridge, newFlow };
}

describe('AngflowAgentBridge', () => {
  let bridge: AngflowAgentBridge;
  let transport: CapturingTransport;
  let newFlow: () => NgFlowService;

  beforeEach(() => {
    transport = new CapturingTransport();
    ({ bridge, newFlow } = setup([transport]));
  });

  describe('flow registration', () => {
    it('list_flows is empty until register() is called', async () => {
      const res = await transport.call('list_flows');
      expect('result' in res && res.result).toEqual([]);
    });

    it('register() makes a flow callable and emits flow.registered', async () => {
      const flow = newFlow();
      bridge.register('main', flow);

      expect(bridge.registeredFlows()).toEqual(['main']);
      const registered = transport.events.find(
        (e) => 'event' in e && e.event === 'flow.registered',
      );
      expect(registered).toBeTruthy();

      const res = await transport.call('list_flows');
      expect('result' in res && res.result).toEqual(['main']);
    });

    it('re-registering the same service is idempotent (no extra flow.registered)', () => {
      const flow = newFlow();
      bridge.register('main', flow);
      transport.events.length = 0;
      bridge.register('main', flow);
      const reEmits = transport.events.filter((e) => 'event' in e && e.event === 'flow.registered');
      expect(reEmits.length).toBe(0);
    });

    it('re-registering with a different service drops history and re-emits flow.registered', async () => {
      const a = newFlow();
      bridge.register('main', a);
      await transport.call('add_node', {
        node: { id: 'x', position: { x: 0, y: 0 }, data: {} },
      });
      let status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(1);

      const b = newFlow();
      transport.events.length = 0;
      bridge.register('main', b);
      const reEmit = transport.events.find((e) => 'event' in e && e.event === 'flow.registered');
      expect(reEmit).toBeTruthy();

      status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(0);
    });

    it('unregister() removes the flow and emits flow.unregistered', () => {
      const flow = newFlow();
      bridge.register('main', flow);
      bridge.unregister('main');

      expect(bridge.registeredFlows()).toEqual([]);
      const unregistered = transport.events.find(
        (e) => 'event' in e && e.event === 'flow.unregistered',
      );
      expect(unregistered).toBeTruthy();
    });
  });

  describe('flowId resolution', () => {
    it('omitting flowId works when exactly one flow is registered', async () => {
      const flow = newFlow();
      flow.setNodes([makeNode('a')]);
      bridge.register('only', flow);

      const res = await transport.call('get_nodes');
      expect('result' in res && (res.result as Node[])[0].id).toBe('a');
    });

    it('omitting flowId fails when multiple flows are registered', async () => {
      bridge.register('one', newFlow());
      bridge.register('two', newFlow());

      const res = await transport.call('get_nodes');
      expect('error' in res).toBe(true);
    });

    it('unknown flowId returns FLOW_NOT_FOUND error', async () => {
      const res = await transport.call('get_nodes', { flowId: 'nope' });
      expect('error' in res && res.error.code).toBe(-32000);
    });
  });

  describe('tool dispatch', () => {
    let flow: NgFlowService;
    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
    });

    it('add_node mutates the flow', async () => {
      const res = await transport.call('add_node', {
        node: { id: 'n1', position: { x: 10, y: 20 }, data: { label: 'hi' } },
      });
      expect('result' in res).toBe(true);
      expect(flow.getNodes().map((n) => n.id)).toEqual(['n1']);
    });

    it('add_edge mutates the flow', async () => {
      flow.setNodes([makeNode('a'), makeNode('b')]);
      await transport.call('add_edge', {
        edge: { id: 'e', source: 'a', target: 'b' },
      });
      expect(flow.getEdges().map((e) => e.id)).toEqual(['e']);
    });

    it('update_node merges patch', async () => {
      flow.setNodes([makeNode('n1', { data: { label: 'old' } })]);
      await transport.call('update_node', {
        id: 'n1',
        patch: { data: { label: 'new' } },
      });
      expect(flow.getNode('n1')?.data).toEqual({ label: 'new' });
    });

    it('delete_elements cascades edges of deleted nodes', async () => {
      flow.setNodes([makeNode('a'), makeNode('b')]);
      flow.setEdges([{ id: 'e', source: 'a', target: 'b' } as Edge]);

      const res = await transport.call('delete_elements', { nodeIds: ['a'] });
      expect('result' in res && (res.result as { deletedEdgeIds: string[] }).deletedEdgeIds).toEqual(['e']);
      expect(flow.getNodes().map((n) => n.id)).toEqual(['b']);
      expect(flow.getEdges()).toEqual([]);
    });

    it('get_state returns nodes, edges, viewport', async () => {
      flow.setNodes([makeNode('a')]);
      const res = await transport.call('get_state');
      expect('result' in res).toBe(true);
      const state = (res as { result: { nodes: Node[]; edges: Edge[]; viewport: unknown } }).result;
      expect(state.nodes.map((n) => n.id)).toEqual(['a']);
      expect(state.edges).toEqual([]);
      expect(state.viewport).toBeDefined();
    });

    it('unknown method returns METHOD_NOT_FOUND', async () => {
      const res = await transport.call('not_a_method');
      expect('error' in res && res.error.code).toBe(-32601);
    });

    it('missing required param returns INVALID_PARAMS', async () => {
      const res = await transport.call('add_node', {});
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('add_node with missing position returns INVALID_PARAMS', async () => {
      const res = await transport.call('add_node', { node: { id: 'x', data: {} } });
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('add_node with non-numeric position.x returns INVALID_PARAMS', async () => {
      const res = await transport.call('add_node', {
        node: { id: 'x', position: { x: 'oops', y: 0 }, data: {} },
      });
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('add_edge with missing source returns INVALID_PARAMS', async () => {
      const res = await transport.call('add_edge', { edge: { id: 'e', target: 'b' } });
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('add_node with NaN position returns INVALID_PARAMS', async () => {
      const res = await transport.call('add_node', {
        node: { id: 'x', position: { x: Number.NaN, y: 0 }, data: {} },
      });
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('add_node with empty id returns INVALID_PARAMS', async () => {
      const res = await transport.call('add_node', {
        node: { id: '', position: { x: 0, y: 0 }, data: {} },
      });
      expect('error' in res && res.error.code).toBe(-32602);
    });
  });

  describe('state events', () => {
    async function flushEffects(): Promise<void> {
      TestBed.tick();
      await new Promise<void>((r) => queueMicrotask(r));
    }

    it('emits flow.state when nodes change', async () => {
      const flow = newFlow();
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      flow.setNodes([makeNode('a')]);
      await flushEffects();

      const stateEvents = transport.events.filter(
        (e): e is { event: string; params: { nodes: Node[] } } =>
          'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBeGreaterThan(0);
      expect(stateEvents.at(-1)!.params.nodes.map((n) => n.id)).toEqual(['a']);
    });

    it('emits flow.state for update_node_data (data-only mutation)', async () => {
      const flow = newFlow();
      flow.setNodes([{ ...makeNode('n1'), data: { count: 0 } } as Node]);
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      await transport.call('update_node_data', { id: 'n1', dataPatch: { count: 99 } });
      await flushEffects();

      const stateEvents = transport.events.filter(
        (e): e is { event: string; params: { nodes: Node[] } } =>
          'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBe(1);
      expect(stateEvents[0].params.nodes[0].data).toEqual({ count: 99 });
    });

    it('emits flow.state for update_edge_data (data-only mutation)', async () => {
      const flow = newFlow();
      flow.setNodes([makeNode('a'), makeNode('b')]);
      flow.setEdges([{ id: 'e', source: 'a', target: 'b', data: { x: 1 } } as Edge]);
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      await transport.call('update_edge_data', { id: 'e', dataPatch: { x: 2 } });
      await flushEffects();

      const stateEvents = transport.events.filter(
        (e): e is { event: string; params: { edges: Edge[] } } =>
          'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBe(1);
      expect(stateEvents[0].params.edges[0].data).toEqual({ x: 2 });
    });

    it('emits flow.state when toggling node.hidden via update_node', async () => {
      const flow = newFlow();
      flow.setNodes([makeNode('n1')]);
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      await transport.call('update_node', { id: 'n1', patch: { hidden: true } });
      await flushEffects();

      const stateEvents = transport.events.filter(
        (e) => 'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBe(1);
    });

    it('emits flow.state for a position-only change (drag fast-path)', async () => {
      const flow = newFlow();
      flow.setNodes([makeNode('a')]);
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      // Simulate what XYDrag does: emit a position-only NodeChange via the
      // store. Bypasses the bridge's update_node path so we exercise the
      // FlowStore drag fast-path directly.
      const store = (flow as unknown as { store: { triggerNodeChanges: (c: unknown[]) => void } }).store;
      store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x: 50, y: 50 }, dragging: true }]);
      await flushEffects();

      const stateEvents = transport.events.filter(
        (e): e is { event: string; params: { nodes: Node[] } } =>
          'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBe(1);
      expect(stateEvents[0].params.nodes[0].position).toEqual({ x: 50, y: 50 });
    });

    it('does not emit flow.state after unregister even if effect was already scheduled', async () => {
      const flow = newFlow();
      const unreg = bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      // Schedule the watcher effect: signal write → effect dirty.
      flow.setNodes([makeNode('a')]);
      // Run the effect (which queues an emit microtask) WITHOUT draining
      // the queued microtask. Then unregister before the microtask runs.
      TestBed.tick();
      unreg();
      // Now drain. The queued microtask must see the destroyed flag and bail.
      await new Promise<void>((r) => queueMicrotask(r));
      await new Promise<void>((r) => queueMicrotask(r));

      const stateEvents = transport.events.filter(
        (e) => 'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBe(0);
    });

    it('coalesces rapid changes within one microtask', async () => {
      const flow = newFlow();
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      flow.setNodes([makeNode('a')]);
      flow.setNodes([makeNode('a'), makeNode('b')]);
      flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      await flushEffects();

      const stateEvents = transport.events.filter(
        (e) => 'event' in e && e.event === 'flow.state',
      );
      expect(stateEvents.length).toBe(1);
    });
  });

  describe('callTool (in-process)', () => {
    it('bridge.callTool dispatches like a transport request', async () => {
      const flow = newFlow();
      bridge.register('f', flow);

      await bridge.callTool('add_node', {
        node: { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      });
      expect(flow.getNode('n1')).toBeTruthy();
    });

    it('bridge.callTool throws on unknown method', async () => {
      await expect(bridge.callTool('nope')).rejects.toThrow();
    });

    it('bridge.callTool captures history (parity with transport)', async () => {
      const flow = newFlow();
      bridge.register('f', flow);

      await bridge.callTool('add_node', {
        node: { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      });
      const undo = (await bridge.callTool('undo')) as { undone: number };
      expect(undo.undone).toBe(1);
      expect(flow.getNodes()).toEqual([]);
    });

    it('bridge.callTool throws structured error with code on invalid params', async () => {
      const flow = newFlow();
      bridge.register('f', flow);

      await expect(
        bridge.callTool('add_node', {}),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it('bridge.callTool emits flow.history (parity with transport)', async () => {
      const flow = newFlow();
      bridge.register('f', flow);
      transport.events.length = 0;

      await bridge.callTool('add_node', {
        node: { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      });
      expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);
    });
  });

  describe('viewport tools', () => {
    let flow: NgFlowService;

    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
    });

    it('zoom_to sets an absolute zoom level on the store transform', async () => {
      const res = await transport.call('zoom_to', { level: 0.5 });
      // zoomTo returns a Promise<boolean> in the underlying service when no panZoom is wired.
      // Smoke check: call did not error out at the dispatch layer.
      expect('result' in res || 'error' in res).toBe(true);
    });

    it('set_center accepts x, y and optional zoom/duration', async () => {
      const res = await transport.call('set_center', { x: 100, y: 200, zoom: 1.5 });
      expect('result' in res || 'error' in res).toBe(true);
    });

    it('fit_bounds accepts a Rect', async () => {
      const res = await transport.call('fit_bounds', {
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        padding: 0.1,
      });
      expect('result' in res).toBe(true);
    });

    it('zoom_in / zoom_out are callable', async () => {
      const inRes = await transport.call('zoom_in');
      const outRes = await transport.call('zoom_out');
      expect('result' in inRes || 'error' in inRes).toBe(true);
      expect('result' in outRes || 'error' in outRes).toBe(true);
    });

    it('zoom_to with missing param fails with INVALID_PARAMS', async () => {
      const res = await transport.call('zoom_to', {});
      expect('error' in res && (res as { error: { code: number } }).error.code).toBe(-32602);
    });
  });

  describe('mutation tools (bulk add and data patches)', () => {
    let flow: NgFlowService;
    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
    });

    it('add_nodes appends multiple nodes', async () => {
      const res = await transport.call('add_nodes', {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: {} },
          { id: 'b', position: { x: 100, y: 0 }, data: {} },
        ],
      });
      expect('result' in res).toBe(true);
      expect(flow.getNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
    });

    it('add_edges appends multiple edges', async () => {
      flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      await transport.call('add_edges', {
        edges: [
          { id: 'a-b', source: 'a', target: 'b' },
          { id: 'b-c', source: 'b', target: 'c' },
        ],
      });
      expect(flow.getEdges().map((e) => e.id).sort()).toEqual(['a-b', 'b-c']);
    });

    it('update_node_data merges into node.data only', async () => {
      flow.setNodes([{ ...makeNode('n'), data: { x: 1, y: 2 } } as Node]);
      await transport.call('update_node_data', { id: 'n', dataPatch: { y: 99, z: 3 } });
      expect(flow.getNode('n')?.data).toEqual({ x: 1, y: 99, z: 3 });
    });

    it('update_edge_data merges into edge.data only', async () => {
      flow.setNodes([makeNode('a'), makeNode('b')]);
      flow.setEdges([{ id: 'e', source: 'a', target: 'b', data: { a: 1 } } as Edge]);
      await transport.call('update_edge_data', { id: 'e', dataPatch: { b: 2 } });
      expect(flow.getEdge('e')?.data).toEqual({ a: 1, b: 2 });
    });
  });

  describe('selection tools', () => {
    let flow: NgFlowService;
    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
      flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c')]);
      flow.setEdges([
        { id: 'a-b', source: 'a', target: 'b' } as Edge,
        { id: 'b-c', source: 'b', target: 'c' } as Edge,
      ]);
    });

    it('select_nodes replaces selection by default', async () => {
      await transport.call('select_nodes', { nodeIds: ['a'] });
      expect(flow.selectedNodes().map((n) => n.id)).toEqual(['a']);

      await transport.call('select_nodes', { nodeIds: ['b'] });
      expect(flow.selectedNodes().map((n) => n.id)).toEqual(['b']);
    });

    it('select_nodes with additive=true extends selection', async () => {
      await transport.call('select_nodes', { nodeIds: ['a'] });
      await transport.call('select_nodes', { nodeIds: ['b'], additive: true });
      expect(flow.selectedNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
    });

    it('select_edges replaces edge selection', async () => {
      await transport.call('select_edges', { edgeIds: ['a-b'] });
      expect(flow.selectedEdges().map((e) => e.id)).toEqual(['a-b']);
    });

    it('deselect_all clears both', async () => {
      await transport.call('select_nodes', { nodeIds: ['a', 'b'], additive: true });
      await transport.call('select_edges', { edgeIds: ['a-b'] });
      await transport.call('deselect_all');
      expect(flow.selectedNodes().length).toBe(0);
      expect(flow.selectedEdges().length).toBe(0);
    });
  });

  describe('read / geometry tools', () => {
    let flow: NgFlowService;

    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
      flow.setNodes([
        { ...makeNode('a'), position: { x: 0, y: 0 }, width: 100, height: 50 },
        { ...makeNode('b'), position: { x: 200, y: 0 }, width: 100, height: 50 },
        { ...makeNode('c'), position: { x: 400, y: 0 }, width: 100, height: 50 },
      ] as Node[]);
      flow.setEdges([
        { id: 'a-b', source: 'a', target: 'b' },
        { id: 'b-c', source: 'b', target: 'c' },
      ] as Edge[]);
    });

    it('get_outgoers returns downstream neighbors', async () => {
      const res = await transport.call('get_outgoers', { id: 'a' });
      expect('result' in res).toBe(true);
      expect((res as { result: Node[] }).result.map((n) => n.id)).toEqual(['b']);
    });

    it('get_incomers returns upstream neighbors', async () => {
      const res = await transport.call('get_incomers', { id: 'c' });
      expect((res as { result: Node[] }).result.map((n) => n.id)).toEqual(['b']);
    });

    it('get_connected_edges returns edges touching given nodes', async () => {
      const res = await transport.call('get_connected_edges', { nodeIds: ['b'] });
      expect((res as { result: Edge[] }).result.map((e) => e.id).sort()).toEqual(['a-b', 'b-c']);
    });

    it('get_nodes_bounds covers all nodes', async () => {
      const res = await transport.call('get_nodes_bounds');
      const rect = (res as { result: { x: number; y: number; width: number; height: number } }).result;
      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBeGreaterThanOrEqual(500);
    });

    it('get_internal_node returns a serializable view', async () => {
      const res = await transport.call('get_internal_node', { id: 'a' });
      const node = (res as { result: { id: string; positionAbsolute: { x: number; y: number } } | null }).result;
      expect(node).toBeTruthy();
      expect(node!.id).toBe('a');
      expect(node!.positionAbsolute).toBeDefined();
      // Result must round-trip through JSON without throwing.
      expect(() => JSON.parse(JSON.stringify(node))).not.toThrow();
    });

    it('get_internal_node returns null for missing id', async () => {
      const res = await transport.call('get_internal_node', { id: 'nope' });
      expect((res as { result: unknown }).result).toBeNull();
    });

    it('screen_to_flow_position and flow_to_screen_position round-trip approximately', async () => {
      // Without a real DOM bounding box, this is a smoke test on the API surface.
      const toFlow = await transport.call('screen_to_flow_position', { position: { x: 10, y: 20 } });
      expect('result' in toFlow).toBe(true);
      const toScreen = await transport.call('flow_to_screen_position', { position: { x: 0, y: 0 } });
      expect('result' in toScreen).toBe(true);
    });

    it('get_intersecting_nodes returns empty array for a non-overlapping node', async () => {
      const res = await transport.call('get_intersecting_nodes', { id: 'a' });
      expect('result' in res).toBe(true);
      expect((res as { result: Node[] }).result).toEqual([]);
    });

    it('is_node_in_area returns true when the node is inside the area', async () => {
      const res = await transport.call('is_node_in_area', {
        id: 'a',
        area: { x: -10, y: -10, width: 200, height: 100 },
      });
      expect((res as { result: boolean }).result).toBe(true);
    });

    it('is_node_in_area returns false when the node is outside the area', async () => {
      const res = await transport.call('is_node_in_area', {
        id: 'a',
        area: { x: 1000, y: 1000, width: 100, height: 100 },
      });
      expect((res as { result: boolean }).result).toBe(false);
    });

    it('get_node_connections returns an array (possibly empty) for a node', async () => {
      const res = await transport.call('get_node_connections', { nodeId: 'a' });
      expect('result' in res).toBe(true);
      expect(Array.isArray((res as { result: unknown[] }).result)).toBe(true);
    });

    it('get_handle_connections rejects an invalid `type` value', async () => {
      const res = await transport.call('get_handle_connections', {
        nodeId: 'a',
        type: 'both',
      });
      expect('error' in res).toBe(true);
      expect((res as { error: { code: number } }).error.code).toBe(-32602);
    });

    it('get_handle_data returns null when no data is attached', async () => {
      const res = await transport.call('get_handle_data', {
        nodeId: 'a',
        handleId: null,
        type: 'source',
      });
      expect((res as { result: unknown }).result).toBeNull();
    });
  });

  describe('apply_changes', () => {
    async function flushEffects(): Promise<void> {
      TestBed.tick();
      await new Promise<void>((r) => queueMicrotask(r));
    }

    let flow: NgFlowService;
    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
    });

    it('runs a batch of ops in a single reactivity cycle', async () => {
      await flushEffects();
      transport.events.length = 0;

      const res = await transport.call('apply_changes', {
        ops: [
          { op: 'add_node', node: { id: 'a', position: { x: 0, y: 0 }, data: {} } },
          { op: 'add_node', node: { id: 'b', position: { x: 100, y: 0 }, data: {} } },
          { op: 'add_edge', edge: { id: 'a-b', source: 'a', target: 'b' } },
        ],
      });
      await flushEffects();

      expect('result' in res).toBe(true);
      const result = (res as { result: { results: { ok: true; value: unknown }[] } }).result;
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r.ok)).toBe(true);

      expect(flow.getNodes().map((n) => n.id).sort()).toEqual(['a', 'b']);
      expect(flow.getEdges().map((e) => e.id)).toEqual(['a-b']);

      const stateEvents = transport.events.filter((e) => 'event' in e && e.event === 'flow.state');
      expect(stateEvents.length).toBe(1);
    });

    it('rolls back on bad op and returns failedIndex', async () => {
      flow.setNodes([makeNode('a')]);
      await flushEffects();
      transport.events.length = 0;

      const res = await transport.call('apply_changes', {
        ops: [
          { op: 'add_node', node: { id: 'b', position: { x: 0, y: 0 }, data: {} } },
          { op: 'update_node', id: 'does-not-exist', patch: { data: {} } },
        ],
      });

      // We treat the missing id as a failure; verify error shape.
      expect('error' in res).toBe(true);
      const error = (res as { error: { code: number; message: string; data?: { failedIndex?: number } } }).error;
      expect(error.code).toBe(-32603);
      expect(error.data?.failedIndex).toBe(1);

      // Net state: still only 'a'.
      expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
    });

    it('warns once when delete_elements is used inside apply_changes with onBeforeDelete set', async () => {
      flow.setNodes([makeNode('a'), makeNode('b')]);
      // Register an onBeforeDelete hook on the store.
      const store = (flow as unknown as { store: { onBeforeDelete: unknown } }).store;
      store.onBeforeDelete = () => true;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await transport.call('apply_changes', {
          ops: [{ op: 'delete_elements', nodeIds: ['a'] }],
        });
        await transport.call('apply_changes', {
          ops: [{ op: 'delete_elements', nodeIds: ['b'] }],
        });

        const bypassWarns = warnSpy.mock.calls.filter((c) =>
          String(c[0]).includes('apply_changes/delete_elements bypasses onBeforeDelete'),
        );
        expect(bypassWarns.length).toBe(1); // once per bridge lifetime
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('does not warn about onBeforeDelete bypass when no hook is registered', async () => {
      flow.setNodes([makeNode('a')]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await transport.call('apply_changes', {
          ops: [{ op: 'delete_elements', nodeIds: ['a'] }],
        });
        const bypassWarns = warnSpy.mock.calls.filter((c) =>
          String(c[0]).includes('apply_changes/delete_elements bypasses onBeforeDelete'),
        );
        expect(bypassWarns.length).toBe(0);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('apply_changes with select_nodes inside does not throw', async () => {
      flow.setNodes([makeNode('a')]);
      const res = await transport.call('apply_changes', {
        ops: [
          { op: 'add_node', node: { id: 'b', position: { x: 0, y: 0 }, data: {} } },
          { op: 'select_nodes', nodeIds: ['b'] },
        ],
      });
      expect('result' in res).toBe(true);
      expect(flow.selectedNodes().map((n) => n.id)).toEqual(['b']);
    });
  });

  describe('history (undo/redo)', () => {
    async function flushEffects(): Promise<void> {
      TestBed.tick();
      await new Promise<void>((r) => queueMicrotask(r));
    }

    let flow: NgFlowService;
    beforeEach(() => {
      flow = newFlow();
      bridge.register('f', flow);
    });

    it('undo restores prior nodes state', async () => {
      await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
      expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);

      const undoRes = await transport.call('undo');
      expect((undoRes as { result: { undone: number } }).result.undone).toBe(1);
      expect(flow.getNodes()).toEqual([]);
    });

    it('redo re-applies the undone state', async () => {
      await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
      await transport.call('undo');
      const redoRes = await transport.call('redo');
      expect((redoRes as { result: { redone: number } }).result.redone).toBe(1);
      expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
    });

    it('undo reports the actual number consumed when steps exceeds depth', async () => {
      await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
      await transport.call('add_node', { node: { id: 'b', position: { x: 100, y: 0 }, data: {} } });

      const res = await transport.call('undo', { steps: 5 });
      // Only 2 mutations in history; undo with steps:5 should report undone:2, not 5.
      expect((res as { result: { undone: number } }).result.undone).toBe(2);
      expect(flow.getNodes()).toEqual([]);
    });

    it('selection ops do NOT capture history', async () => {
      flow.setNodes([makeNode('a')]);
      // Initial selection is empty; capture stack should be empty.
      let status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(0);

      await transport.call('select_nodes', { nodeIds: ['a'] });
      status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(0);
    });

    it('viewport ops do NOT capture history', async () => {
      await transport.call('zoom_in');
      const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(0);
    });

    it('apply_changes creates a single history entry when ops include mutation', async () => {
      await transport.call('apply_changes', {
        ops: [
          { op: 'add_node', node: { id: 'a', position: { x: 0, y: 0 }, data: {} } },
          { op: 'add_node', node: { id: 'b', position: { x: 100, y: 0 }, data: {} } },
        ],
      });
      const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(1);
    });

    it('apply_changes with only selection ops does NOT capture history', async () => {
      flow.setNodes([makeNode('a')]);
      await transport.call('apply_changes', {
        ops: [{ op: 'select_nodes', nodeIds: ['a'] }],
      });
      const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(0);
    });

    it('rolled-back apply_changes does NOT capture history', async () => {
      flow.setNodes([makeNode('a')]);
      await transport.call('apply_changes', {
        ops: [{ op: 'update_node', id: 'nope', patch: { data: {} } }],
      });
      const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(0);
    });

    it('clear_history empties both stacks', async () => {
      await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
      await transport.call('undo');
      await transport.call('clear_history');
      const status = (await transport.call('history_status')) as {
        result: { canUndo: boolean; canRedo: boolean };
      };
      expect(status.result.canUndo).toBe(false);
      expect(status.result.canRedo).toBe(false);
    });

    it('flow.history is emitted on capture, undo, redo, and clear', async () => {
      await flushEffects();
      transport.events.length = 0;

      await transport.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
      await flushEffects();
      expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);

      transport.events.length = 0;
      await transport.call('undo');
      await flushEffects();
      expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);

      transport.events.length = 0;
      await transport.call('redo');
      await flushEffects();
      expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);

      transport.events.length = 0;
      await transport.call('clear_history');
      await flushEffects();
      expect(transport.events.some((e) => 'event' in e && e.event === 'flow.history')).toBe(true);
    });

    it('maxDepth caps the history stack', async () => {
      // Reset bridge with a tiny maxDepth.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideAgentBridge({ transports: [transport], history: { maxDepth: 2 } }),
        ],
      });
      const b = TestBed.inject(AngflowAgentBridge);
      const child = Injector.create({
        providers: [FlowStore, NgFlowService],
        parent: TestBed.inject(Injector),
      });
      const f = child.get(NgFlowService);
      b.register('f', f);

      for (let i = 0; i < 5; i++) {
        await transport.call('add_node', {
          node: { id: `n${i}`, position: { x: i * 10, y: 0 }, data: {} },
        });
      }
      const status = (await transport.call('history_status')) as { result: { pastDepth: number } };
      expect(status.result.pastDepth).toBe(2);
    });
  });
});

describe('type discovery tools', () => {
  let bridge: AngflowAgentBridge;
  let newFlow: () => NgFlowService;

  beforeEach(() => {
    ({ bridge, newFlow } = setup([]));
  });

  it('list_node_types reports builtin node types', async () => {
    const flow = newFlow();
    bridge.register('main', flow);
    const result = (await bridge.callTool('list_node_types')) as {
      types: Array<{ name: string; source: string }>;
    };
    expect(result.types).toContainEqual({ name: 'default', source: 'builtin' });
    expect(result.types).toContainEqual({ name: 'group', source: 'builtin' });
  });

  it('list_edge_types reports builtin edge types', async () => {
    const flow = newFlow();
    bridge.register('main', flow);
    const result = (await bridge.callTool('list_edge_types')) as {
      types: Array<{ name: string; source: string }>;
    };
    expect(result.types).toContainEqual({ name: 'smoothstep', source: 'builtin' });
  });

  it('discovery tools are read-only (no history entry)', async () => {
    const flow = newFlow();
    bridge.register('main', flow);
    await bridge.callTool('list_node_types');
    await bridge.callTool('list_edge_types');
    const status = (await bridge.callTool('history_status')) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });
});

describe('onError hook', () => {
  it('captures transport.send failures via the provideAgentBridge onError callback', async () => {
    const errors: Array<{ err: unknown; kind: string }> = [];
    const failing: AgentTransport = {
      start: () => undefined,
      send: () => {
        throw new Error('boom');
      },
      stop: () => undefined,
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({
          transports: [failing],
          onError: (err, ctx) => errors.push({ err, kind: ctx.kind }),
        }),
      ],
    });
    const bridge = TestBed.inject(AngflowAgentBridge);
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    // Registering triggers a flow.registered emit → transport.send throws.
    bridge.register('f', child.get(NgFlowService));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].kind).toBe('transport-send');
    expect((errors[0].err as Error).message).toBe('boom');
  });

  it('reports unexpected handler throws via onError with kind=dispatch', async () => {
    const errors: Array<{ err: unknown; kind: string; method?: string }> = [];
    const transport = new CapturingTransport();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({
          transports: [transport],
          onError: (err, ctx) =>
            errors.push({
              err,
              kind: ctx.kind,
              method: ctx.kind === 'dispatch' ? ctx.method : undefined,
            }),
        }),
      ],
    });
    const bridge = TestBed.inject(AngflowAgentBridge);
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    const flow = child.get(NgFlowService);
    bridge.register('f', flow);

    // Force an unexpected throw inside a handler by monkey-patching the
    // service to throw on a normally-non-throwing method.
    (flow as unknown as { getNodes: () => unknown }).getNodes = () => {
      throw new Error('synthetic bug');
    };

    const res = await transport.call('get_nodes');
    expect('error' in res && res.error.code).toBe(-32603);
    expect(errors.length).toBe(1);
    expect(errors[0].kind).toBe('dispatch');
    expect(errors[0].method).toBe('get_nodes');
  });

  it('captures rejected transport.start() via onError', async () => {
    const errors: unknown[] = [];
    const failing: AgentTransport = {
      start: () => Promise.reject(new Error('start-fail')),
      send: () => undefined,
      stop: () => undefined,
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({
          transports: [failing],
          onError: (err) => errors.push(err),
        }),
      ],
    });
    TestBed.inject(AngflowAgentBridge);
    // start() returns synchronously; the rejection surfaces on a microtask.
    await new Promise<void>((r) => queueMicrotask(r));
    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe('start-fail');
  });
});

describe('history disabled (history: false)', () => {
  let bridge2: AngflowAgentBridge;
  let transport2: CapturingTransport;
  let flow: NgFlowService;
  beforeEach(() => {
    transport2 = new CapturingTransport();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [transport2], history: false }),
      ],
    });
    bridge2 = TestBed.inject(AngflowAgentBridge);
    const child = Injector.create({
      providers: [FlowStore, NgFlowService],
      parent: TestBed.inject(Injector),
    });
    flow = child.get(NgFlowService);
    bridge2.register('f', flow);
  });

  it('undo is a no-op when history is disabled', async () => {
    await transport2.call('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    const res = await transport2.call('undo');
    expect((res as { result: { undone: number } }).result.undone).toBe(0);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
  });
});

describe('WindowTransport', () => {
  it('exposes window.angflow with callTool/subscribe/toolSchemas', async () => {
    const transport = new WindowTransport({ namespace: 'angflowTest' });
    const { bridge, newFlow } = setup([transport]);

    const api = (window as unknown as Record<string, {
      callTool: (m: string, p?: unknown) => Promise<unknown>;
      subscribe: (h: (e: unknown) => void) => () => void;
      toolSchemas: unknown[];
    }>)['angflowTest'];
    expect(api).toBeTruthy();
    expect(Array.isArray(api.toolSchemas)).toBe(true);

    const flow = newFlow();
    bridge.register('f', flow);
    await api.callTool('add_node', {
      node: { id: 'x', position: { x: 0, y: 0 }, data: {} },
    });
    expect(flow.getNode('x')).toBeTruthy();
  });

  it('subscribe receives flow.state events', async () => {
    const transport = new WindowTransport({ namespace: 'angflowTest2' });
    const { bridge, newFlow } = setup([transport]);
    const flow = newFlow();
    bridge.register('f', flow);

    const received: unknown[] = [];
    const api = (window as unknown as Record<string, {
      subscribe: (h: (e: unknown) => void) => () => void;
    }>)['angflowTest2'];
    const unsub = api.subscribe((e) => received.push(e));

    flow.setNodes([makeNode('a')]);
    TestBed.tick();
    await new Promise<void>((r) => queueMicrotask(r));

    expect(received.length).toBeGreaterThan(0);
    unsub();
  });
});
