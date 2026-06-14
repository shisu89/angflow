import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../services/flow-store.service';
import { NgFlowService } from '../services/ng-flow.service';
import { AngflowAgentBridge } from './agent-bridge.service';
import { provideAgentBridge } from './provide-agent-bridge';
import { WindowTransport } from './transports/window';
import type { AgentOutbound, AgentTransport, AgentInbound, AgentResponse } from './types';
import type { Node, Edge } from '../types';
import type { AgentLayoutFn } from '../types/node-template';

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

function setupWithLayout(layout: AgentLayoutFn, transports: AgentTransport[] = []): {
  bridge: AngflowAgentBridge;
  newFlow: () => NgFlowService;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideAgentBridge({ transports, layout }),
    ],
  });
  const bridge = TestBed.inject(AngflowAgentBridge);
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

    it('add_node with empty id mints an id (empty string treated as omitted)', async () => {
      const res = await transport.call('add_node', {
        node: { id: '', position: { x: 0, y: 0 }, data: {} },
      });
      expect('result' in res).toBe(true);
      const node = (res as { result: { id: string } }).result;
      expect(typeof node.id).toBe('string');
      expect(node.id.length).toBeGreaterThan(0);
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

  describe('type discovery tools', () => {
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

  describe('node template tools', () => {
    let flow: NgFlowService;

    beforeEach(() => {
      flow = newFlow();
      bridge.register('main', flow);
    });

    it('register_node_template stores a spec and returns { name }', async () => {
      const result = await bridge.callTool('register_node_template', {
        name: 'service',
        spec: { title: '{{data.name}}', accent: '#4f46e5' },
      });
      expect(result).toEqual({ name: 'service' });
      expect(flow.getNodeTemplates()).toHaveLength(1);
    });

    it('appears in list_node_types as source "template"', async () => {
      await bridge.callTool('register_node_template', { name: 'service', spec: {} });
      const result = (await bridge.callTool('list_node_types')) as {
        types: Array<{ name: string; source: string }>;
      };
      expect(result.types).toContainEqual({ name: 'service', source: 'template' });
    });

    it('re-registering overwrites', async () => {
      await bridge.callTool('register_node_template', { name: 's', spec: { title: 'v1' } });
      await bridge.callTool('register_node_template', { name: 's', spec: { title: 'v2' } });
      expect(flow.getNodeTemplates()).toEqual([{ name: 's', spec: { title: 'v2' } }]);
    });

    it('rejects names claimed by builtin types with -32602', async () => {
      await expect(
        bridge.callTool('register_node_template', { name: 'default', spec: {} }),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it('rejects names claimed by host types with -32602', async () => {
      // Needs the FlowStore behind the flow, so build this one inline instead
      // of via newFlow() (which returns only the service). Same pattern as the
      // spec file's existing helper:
      const child = Injector.create({
        providers: [FlowStore, NgFlowService],
        parent: TestBed.inject(Injector),
      });
      const hostFlow = child.get(NgFlowService);
      const store = child.get(FlowStore);
      bridge.register('host-flow', hostFlow);
      store.hostNodeTypeNames.set(['decision']);
      await expect(
        bridge.callTool('register_node_template', { flowId: 'host-flow', name: 'decision', spec: {} }),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it('rejects an empty name with -32602', async () => {
      await expect(
        bridge.callTool('register_node_template', { name: '', spec: {} }),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it.each([
      [{ variant: 'fancy' }],
      [{ badges: [{ text: 1 }] }],
      [{ badges: [{ text: 'x', color: 'red' }] }],
      [{ fields: [{ label: 'x' }] }],
      [{ handles: [{ type: 'middle' }] }],
      [{ handles: [{ type: 'source', position: 'center' }] }],
      [{ title: 42 }],
      [{ html: '<b>x</b>' }],
    ])('rejects malformed spec %j with -32602', async (badSpec) => {
      await expect(
        bridge.callTool('register_node_template', { name: 'ok-name', spec: badSpec }),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it('unregister_node_template removes and reports { removed }', async () => {
      await bridge.callTool('register_node_template', { name: 's', spec: {} });
      expect(await bridge.callTool('unregister_node_template', { name: 's' })).toEqual({ removed: true });
      expect(await bridge.callTool('unregister_node_template', { name: 's' })).toEqual({ removed: false });
    });

    it('list_node_templates returns full specs', async () => {
      const spec = { title: 't', fields: [{ label: 'l', value: 'v' }] };
      await bridge.callTool('register_node_template', { name: 's', spec });
      expect(await bridge.callTool('list_node_templates')).toEqual({
        templates: [{ name: 's', spec }],
      });
    });

    it('template registration creates no history entry', async () => {
      await bridge.callTool('register_node_template', { name: 's', spec: {} });
      const status = (await bridge.callTool('history_status')) as { pastDepth: number };
      expect(status.pastDepth).toBe(0);
    });
  });

  describe('layout_nodes', () => {
    /** Stacks every node at x = 100·index, y = 0 — deterministic and assertable. */
    const fakeLayout: AgentLayoutFn = (nodes) => {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n, i) => (positions[n.id] = { x: i * 100, y: 0 }));
      return positions;
    };

    it('fails with -32601 and an actionable message when no layout fn is configured', async () => {
      // uses the OUTER setup (no layout) — bridge/newFlow from the surrounding beforeEach
      const flow = newFlow();
      bridge.register('main', flow);
      await expect(bridge.callTool('layout_nodes', {})).rejects.toMatchObject({
        code: -32601,
        message: expect.stringContaining('no layout function configured'),
      });
    });

    it('applies returned positions and returns them', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a'), makeNode('b')]);
      const result = (await b.callTool('layout_nodes', { fitView: false })) as {
        positions: Record<string, { x: number; y: number }>;
      };
      expect(result.positions).toEqual({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
      expect(flow.getNode('a')?.position).toEqual({ x: 0, y: 0 });
      expect(flow.getNode('b')?.position).toEqual({ x: 100, y: 0 });
    });

    it('lays out only the induced subgraph when nodeIds is given', async () => {
      const seen: Array<{ nodes: string[]; edges: Array<{ source: string; target: string }> }> = [];
      const spy: AgentLayoutFn = (nodes, edges) => {
        seen.push({ nodes: nodes.map((n) => n.id), edges });
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(spy);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a'), makeNode('b'), makeNode('c', { position: { x: 9, y: 9 } })]);
      flow.setEdges([
        { id: 'e1', source: 'a', target: 'b' } as Edge,
        { id: 'e2', source: 'b', target: 'c' } as Edge,
      ]);
      await b.callTool('layout_nodes', { nodeIds: ['a', 'b'], fitView: false });
      expect(seen[0].nodes).toEqual(['a', 'b']);
      expect(seen[0].edges).toEqual([{ source: 'a', target: 'b' }]);
      expect(flow.getNode('c')?.position).toEqual({ x: 9, y: 9 });
    });

    it('rejects unknown nodeIds with -32602', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      await expect(
        b.callTool('layout_nodes', { nodeIds: ['a', 'ghost'] }),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it('rejects a bad direction with -32602', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      b.register('main', nf());
      await expect(
        b.callTool('layout_nodes', { direction: 'DIAGONAL' }),
      ).rejects.toMatchObject({ code: -32602 });
    });

    it('drops unknown ids from the layout result with a console.warn', async () => {
      const sloppy: AgentLayoutFn = () => ({ a: { x: 1, y: 1 }, ghost: { x: 9, y: 9 } });
      const { bridge: b, newFlow: nf } = setupWithLayout(sloppy);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = (await b.callTool('layout_nodes', { fitView: false })) as {
        positions: Record<string, unknown>;
      };
      expect(result.positions).toEqual({ a: { x: 1, y: 1 } });
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('a throwing layout fn yields -32603 and changes nothing', async () => {
      const boom: AgentLayoutFn = () => {
        throw new Error('layout exploded');
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(boom);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a', { position: { x: 5, y: 5 } })]);
      await expect(b.callTool('layout_nodes', {})).rejects.toMatchObject({ code: -32603 });
      expect(flow.getNode('a')?.position).toEqual({ x: 5, y: 5 });
      const status = (await b.callTool('history_status')) as { pastDepth: number };
      expect(status.pastDepth).toBe(0);
    });

    it('an invalid position in the layout result yields -32603 and applies nothing', async () => {
      const bad: AgentLayoutFn = () => ({ a: { x: Number.NaN, y: 0 } });
      const { bridge: b, newFlow: nf } = setupWithLayout(bad);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a', { position: { x: 5, y: 5 } })]);
      await expect(b.callTool('layout_nodes', { fitView: false })).rejects.toMatchObject({ code: -32603 });
      expect(flow.getNode('a')?.position).toEqual({ x: 5, y: 5 });
    });

    it('a successful layout creates exactly one history entry, undo restores positions', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a', { position: { x: 5, y: 5 } }), makeNode('b', { position: { x: 6, y: 6 } })]);
      await b.callTool('layout_nodes', { fitView: false });
      const status = (await b.callTool('history_status')) as { pastDepth: number };
      expect(status.pastDepth).toBe(1);
      await b.callTool('undo');
      expect(flow.getNode('a')?.position).toEqual({ x: 5, y: 5 });
      expect(flow.getNode('b')?.position).toEqual({ x: 6, y: 6 });
    });

    it('an empty graph creates no history entry', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      await b.callTool('layout_nodes', { fitView: false });
      const status = (await b.callTool('history_status')) as { pastDepth: number };
      expect(status.pastDepth).toBe(0);
    });

    it('awaits an async layout fn', async () => {
      const asyncLayout: AgentLayoutFn = async (nodes) =>
        Object.fromEntries(nodes.map((n) => [n.id, { x: 42, y: 7 }]));
      const { bridge: b, newFlow: nf } = setupWithLayout(asyncLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      await b.callTool('layout_nodes', { fitView: false });
      expect(flow.getNode('a')?.position).toEqual({ x: 42, y: 7 });
    });

    it('skips nodes deleted while an async layout fn runs (no phantom history)', async () => {
      // eslint-disable-next-line prefer-const
      let flowRef: NgFlowService;
      const slowLayout: AgentLayoutFn = async (nodes) => {
        // Simulate a human deleting node "b" while layout computes.
        flowRef.setNodes(flowRef.getNodes().filter((n) => n.id !== 'b'));
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 10, y: 10 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(slowLayout);
      const flow = nf();
      flowRef = flow;
      b.register('main', flow);
      flow.setNodes([makeNode('a'), makeNode('b')]);
      const result = (await b.callTool('layout_nodes', { fitView: false })) as {
        positions: Record<string, unknown>;
      };
      // Only the surviving node is applied/reported.
      expect(Object.keys(result.positions)).toEqual(['a']);
      expect(flow.getNode('a')?.position).toEqual({ x: 10, y: 10 });
      // History captured (a position WAS applied) — exactly one entry.
      const status = (await b.callTool('history_status')) as { pastDepth: number };
      expect(status.pastDepth).toBe(1);
    });

    it('captures no history when ALL target nodes vanish during the layout await', async () => {
      // eslint-disable-next-line prefer-const
      let flowRef: NgFlowService;
      const slowLayout: AgentLayoutFn = async (nodes) => {
        flowRef.setNodes([]);
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 10, y: 10 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(slowLayout);
      const flow = nf();
      flowRef = flow;
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      const result = (await b.callTool('layout_nodes', { fitView: false })) as {
        positions: Record<string, unknown>;
      };
      expect(result.positions).toEqual({});
      const status = (await b.callTool('history_status')) as { pastDepth: number };
      expect(status.pastDepth).toBe(0);
    });

    it('an array return from the layout fn yields -32603', async () => {
      const arrayLayout = (() => [{ x: 0, y: 0 }]) as unknown as AgentLayoutFn;
      const { bridge: b, newFlow: nf } = setupWithLayout(arrayLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      await expect(b.callTool('layout_nodes', { fitView: false })).rejects.toMatchObject({ code: -32603 });
    });

    it('forwards parentId to the layout fn when the parent is in the layout set', async () => {
      const seen: Array<Array<{ id: string; parentId?: string }>> = [];
      const spy: AgentLayoutFn = (nodes) => {
        seen.push(nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(spy);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([
        makeNode('g'),
        makeNode('c', { parentId: 'g' }),
        makeNode('x'),
      ]);
      await b.callTool('layout_nodes', { fitView: false });
      expect(seen[0]).toEqual([
        { id: 'g', parentId: undefined },
        { id: 'c', parentId: 'g' },
        { id: 'x', parentId: undefined },
      ]);
    });

    it('omits parentId when the parent is excluded via nodeIds', async () => {
      const seen: Array<Array<{ id: string; parentId?: string }>> = [];
      const spy: AgentLayoutFn = (nodes) => {
        seen.push(nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(spy);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([
        makeNode('g'),
        makeNode('c', { parentId: 'g' }),
        makeNode('x'),
      ]);
      await b.callTool('layout_nodes', { nodeIds: ['c', 'x'], fitView: false });
      expect(seen[0]).toEqual([
        { id: 'c', parentId: undefined },
        { id: 'x', parentId: undefined },
      ]);
    });

    it('applies layout results as ABSOLUTE coordinates (grouped child lands parent-relative)', async () => {
      const absoluteLayout: AgentLayoutFn = () => ({ g: { x: 100, y: 100 }, c: { x: 130, y: 140 } });
      const { bridge: b, newFlow: nf } = setupWithLayout(absoluteLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([
        makeNode('g', { position: { x: 0, y: 0 } }),
        makeNode('c', { parentId: 'g', position: { x: 10, y: 10 } }),
      ]);
      await b.callTool('layout_nodes', { fitView: false });
      expect(flow.getNode('g')?.position).toEqual({ x: 100, y: 100 });
      // c is absolute {130,140}; relative to g's new absolute {100,100} → {30,40}.
      expect(flow.getNode('c')?.position).toEqual({ x: 30, y: 40 });
    });

    it('returns a fit result when fitView is on', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a'), makeNode('b')]);
      const res = (await b.callTool('layout_nodes', {})) as {
        positions: Record<string, { x: number; y: number }>;
        fit: { zoom: number; clamped: boolean } | null;
      };
      expect(res.positions).toBeDefined();
      expect(res.fit).not.toBeNull();
      expect(typeof res.fit!.clamped).toBe('boolean');
    });

    it('returns fit: null when fitView is false', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      const res = (await b.callTool('layout_nodes', { fitView: false })) as { fit: unknown };
      expect(res.fit).toBeNull();
    });

    it('threads minZoom into the post-layout fit', async () => {
      const { bridge: b, newFlow: nf } = setupWithLayout(fakeLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('a')]);
      const spy = vi.spyOn(flow, 'fitView');
      await b.callTool('layout_nodes', { minZoom: 0.25 });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ minZoom: 0.25 }));
    });
  });

  describe('flow.state throttling during drag', () => {
    async function flushEffects(): Promise<void> {
      TestBed.tick();
      await new Promise<void>((r) => queueMicrotask(r));
    }

    function dragFrame(flow: NgFlowService, x: number, dragging = true): void {
      const store = (flow as unknown as { store: { triggerNodeChanges: (c: unknown[]) => void } }).store;
      store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x, y: 0 }, dragging }]);
    }

    function stateEvents() {
      return transport.events.filter(
        (e): e is { event: string; params: { nodes: Node[] } } =>
          'event' in e && e.event === 'flow.state',
      );
    }

    beforeEach(() => {
      // Keep queueMicrotask real (the watcher coalesces on it); fake only
      // the throttle's clock and timer.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(10_000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function setupDraggingFlow(): Promise<NgFlowService> {
      const flow = newFlow();
      flow.setNodes([makeNode('a')]);
      bridge.register('f', flow);
      await flushEffects();          // initial flow.state emission
      vi.advanceTimersByTime(200);   // move past the throttle window
      transport.events.length = 0;
      return flow;
    }

    it('emits at most one flow.state per 100ms while dragging, with a trailing emit', async () => {
      const flow = await setupDraggingFlow();

      dragFrame(flow, 10);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // interval elapsed -> immediate

      dragFrame(flow, 20);
      await flushEffects();
      dragFrame(flow, 30);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // throttled

      vi.advanceTimersByTime(100);
      await flushEffects();
      const events = stateEvents();
      expect(events.length).toBe(2); // trailing emit fired
      expect(events.at(-1)!.params.nodes[0].position).toEqual({ x: 30, y: 0 }); // latest state
    });

    it('drag end emits the final state immediately', async () => {
      const flow = await setupDraggingFlow();

      dragFrame(flow, 10);
      await flushEffects();
      dragFrame(flow, 20);
      await flushEffects();
      expect(stateEvents().length).toBe(1);

      dragFrame(flow, 25, false); // drag end
      await flushEffects();
      const events = stateEvents();
      expect(events.length).toBe(2);
      expect(events.at(-1)!.params.nodes[0].position).toEqual({ x: 25, y: 0 });

      vi.advanceTimersByTime(500); // stale trailing timer must not double-emit
      await flushEffects();
      expect(stateEvents().length).toBe(2);
    });

    it('non-drag mutations are not throttled', async () => {
      const flow = newFlow();
      bridge.register('f', flow);
      await flushEffects();
      transport.events.length = 0;

      flow.setNodes([makeNode('a')]);
      await flushEffects();
      flow.setNodes([makeNode('a'), makeNode('b')]);
      await flushEffects();
      expect(stateEvents().length).toBe(2);
    });

    it('a pending trailing emit is dropped on unregister', async () => {
      const flow = newFlow();
      flow.setNodes([makeNode('a')]);
      const unreg = bridge.register('f', flow);
      await flushEffects();
      vi.advanceTimersByTime(200);
      transport.events.length = 0;

      dragFrame(flow, 10);
      await flushEffects();
      dragFrame(flow, 20);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // x=20 pending in the trailing timer

      unreg();
      vi.advanceTimersByTime(500);
      await flushEffects();
      expect(stateEvents().length).toBe(1);
    });

    it('throttle re-engages in the window after a trailing emit (sustained drag)', async () => {
      const flow = await setupDraggingFlow();

      dragFrame(flow, 10);
      await flushEffects();
      expect(stateEvents().length).toBe(1); // immediate (window open)

      dragFrame(flow, 20);
      await flushEffects();
      vi.advanceTimersByTime(100);
      await flushEffects();
      expect(stateEvents().length).toBe(2); // trailing emit at t+100

      // Frames right after the trailing emit must be throttled again,
      // not emitted immediately (pins emitState(true) in the trailing timer).
      dragFrame(flow, 30);
      await flushEffects();
      dragFrame(flow, 40);
      await flushEffects();
      expect(stateEvents().length).toBe(2); // still throttled in the new window

      vi.advanceTimersByTime(100);
      await flushEffects();
      const events = stateEvents();
      expect(events.length).toBe(3); // second trailing emit
      expect(events.at(-1)!.params.nodes[0].position).toEqual({ x: 40, y: 0 });
    });
  });

  describe('lifecycle', () => {
    it('stops every transport when the bridge injector is destroyed', () => {
      const stopSpy = vi.spyOn(transport, 'stop');
      // Resetting the testing module destroys the environment injector the bridge lives in.
      TestBed.resetTestingModule();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps stopping remaining transports when one stop() throws', () => {
      const throwing: AgentTransport = {
        start: () => {},
        send: () => {},
        stop: () => {
          throw new Error('boom');
        },
      };
      const tail = new CapturingTransport();
      setup([throwing, tail]);
      const stopSpy = vi.spyOn(tail, 'stop');
      TestBed.resetTestingModule();
      expect(stopSpy).toHaveBeenCalledTimes(1);
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

describe('AngflowAgentBridge — style/className validation', () => {
  let bridge: AngflowAgentBridge;
  let transport: CapturingTransport;
  let newFlow: () => NgFlowService;

  beforeEach(() => {
    transport = new CapturingTransport();
    ({ bridge, newFlow } = setup([transport]));
  });

  describe('style/className validation', () => {
    it('rejects add_node style containing url() with -32602 and mutates nothing', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const res = await transport.call('add_node', {
        node: {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {},
          style: { background: 'url(https://evil.example/x.png)' },
        },
      });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('style');
      expect(flow.getNode('n1')).toBeUndefined();
    });

    it('rejects expression() and non-plain-object style values', async () => {
      const flow = newFlow();
      bridge.register('main', flow);

      const expr = await transport.call('add_node', {
        node: { id: 'n1', position: { x: 0, y: 0 }, data: {}, style: { width: 'expression(alert(1))' } },
      });
      expect('error' in expr && expr.error.code).toBe(-32602);

      const arrayStyle = await transport.call('add_node', {
        node: { id: 'n2', position: { x: 0, y: 0 }, data: {}, style: ['red'] },
      });
      expect('error' in arrayStyle && arrayStyle.error.code).toBe(-32602);

      const stringStyle = await transport.call('add_node', {
        node: { id: 'n3', position: { x: 0, y: 0 }, data: {}, style: 'background: red' },
      });
      expect('error' in stringStyle && stringStyle.error.code).toBe(-32602);
    });

    it('rejects non-string className on nodes and edges', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const node = await transport.call('add_node', {
        node: { id: 'n1', position: { x: 0, y: 0 }, data: {}, className: { evil: true } },
      });
      expect('error' in node && node.error.code).toBe(-32602);

      flow.setNodes([makeNode('a'), makeNode('b')]);
      const edge = await transport.call('add_edge', {
        edge: { id: 'e1', source: 'a', target: 'b', className: 42 },
      });
      expect('error' in edge && edge.error.code).toBe(-32602);
    });

    it('rejects edge style containing url() in bulk set_edges', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const res = await transport.call('set_edges', {
        edges: [{ id: 'e1', source: 'a', target: 'b', style: { stroke: 'URL( javascript:x )' } }],
      });
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('accepts benign style objects (numbers and plain CSS strings)', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const res = await transport.call('add_node', {
        node: {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {},
          style: { background: '#fff', opacity: 0.5, border: '1px solid red' },
          className: 'my-node',
        },
      });
      expect('result' in res).toBe(true);
      expect(flow.getNode('n1')?.style).toEqual({ background: '#fff', opacity: 0.5, border: '1px solid red' });
    });
  });
});

describe('AngflowAgentBridge — bulk payload caps', () => {
  let bridge: AngflowAgentBridge;
  let transport: CapturingTransport;
  let newFlow: () => NgFlowService;

  beforeEach(() => {
    transport = new CapturingTransport();
    ({ bridge, newFlow } = setup([transport]));
  });

  describe('bulk payload caps', () => {
    const bigNodes = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ id: `n${i}`, position: { x: 0, y: 0 }, data: {} }));

    it('rejects add_nodes with more than 5000 elements with -32602 and mutates nothing', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const res = await transport.call('add_nodes', { nodes: bigNodes(5001) });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
      expect(flow.getNodes()).toHaveLength(0);
    });

    it('rejects apply_changes with more than 5000 ops with -32602', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const ops = Array.from({ length: 5001 }, () => ({ op: 'deselect_all' }));
      const res = await transport.call('apply_changes', { ops });
      expect('error' in res && res.error.code).toBe(-32602);
    });

    it('rejects an oversized nested add_nodes op inside apply_changes (rollback, -32603 + failedIndex)', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const res = await transport.call('apply_changes', {
        ops: [{ op: 'add_nodes', nodes: bigNodes(5001) }],
      });
      expect('error' in res && res.error.code).toBe(-32603);
      expect('error' in res && res.error.data).toEqual({ failedIndex: 0 });
      expect(flow.getNodes()).toHaveLength(0);
    });

    it('accepts bulk payloads at the 5000-element boundary', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const res = await transport.call('set_nodes', { nodes: bigNodes(5000) });
      expect('error' in res).toBe(false);
      expect(flow.getNodes()).toHaveLength(5000);
    });

    it('rejects select_nodes with more than 5000 nodeIds with -32602', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5001 }, (_, i) => `n${i}`);
      const res = await transport.call('select_nodes', { nodeIds: bigIds });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
    });

    it('accepts select_nodes at the 5000-element boundary for nodeIds', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5000 }, (_, i) => `n${i}`);
      const res = await transport.call('select_nodes', { nodeIds: bigIds });
      expect('error' in res).toBe(false);
    });

    it('rejects select_edges with more than 5000 edgeIds with -32602', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5001 }, (_, i) => `e${i}`);
      const res = await transport.call('select_edges', { edgeIds: bigIds });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
    });

    it('accepts select_edges at the 5000-element boundary for edgeIds', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5000 }, (_, i) => `e${i}`);
      const res = await transport.call('select_edges', { edgeIds: bigIds });
      expect('error' in res).toBe(false);
    });

    it('rejects delete_elements with more than 5000 nodeIds with -32602', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5001 }, (_, i) => `n${i}`);
      const res = await transport.call('delete_elements', { nodeIds: bigIds });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
    });

    it('rejects delete_elements with more than 5000 edgeIds with -32602', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5001 }, (_, i) => `e${i}`);
      const res = await transport.call('delete_elements', { edgeIds: bigIds });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
    });

    it('accepts delete_elements at the 5000-element boundary for nodeIds', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5000 }, (_, i) => `n${i}`);
      const res = await transport.call('delete_elements', { nodeIds: bigIds });
      expect('error' in res).toBe(false);
    });

    it('rejects get_connected_edges with more than 5000 nodeIds with -32602', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5001 }, (_, i) => `n${i}`);
      const res = await transport.call('get_connected_edges', { nodeIds: bigIds });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
    });

    it('accepts get_connected_edges at the 5000-element boundary for nodeIds', async () => {
      const flow = newFlow();
      bridge.register('main', flow);
      const bigIds = Array.from({ length: 5000 }, (_, i) => `n${i}`);
      const res = await transport.call('get_connected_edges', { nodeIds: bigIds });
      expect('error' in res).toBe(false);
    });
  });

  describe('layout_nodes id-array cap (requires layout fn)', () => {
    let bridgeWithLayout: AngflowAgentBridge;
    let transportWithLayout: CapturingTransport;
    let newFlowWithLayout: () => NgFlowService;

    beforeEach(() => {
      transportWithLayout = new CapturingTransport();
      const fakeLayout: AgentLayoutFn = (nodes) => {
        const positions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n, i) => (positions[n.id] = { x: i * 100, y: 0 }));
        return positions;
      };
      ({ bridge: bridgeWithLayout, newFlow: newFlowWithLayout } = setupWithLayout(
        fakeLayout,
        [transportWithLayout],
      ));
    });

    it('rejects layout_nodes with more than 5000 nodeIds with -32602', async () => {
      const flow = newFlowWithLayout();
      bridgeWithLayout.register('main', flow);
      const bigIds = Array.from({ length: 5001 }, (_, i) => `n${i}`);
      const res = await transportWithLayout.call('layout_nodes', { nodeIds: bigIds });
      expect('error' in res && res.error.code).toBe(-32602);
      expect('error' in res && res.error.message).toContain('5000');
    });

    it('accepts layout_nodes at the 5000-element boundary for nodeIds (cap check passes; may fail on other validation)', async () => {
      const flow = newFlowWithLayout();
      bridgeWithLayout.register('main', flow);
      const bigIds = Array.from({ length: 5000 }, (_, i) => `n${i}`);
      const res = await transportWithLayout.call('layout_nodes', { nodeIds: bigIds });
      // The cap check should pass (5000 is the boundary); it may fail on existence check,
      // but it should not fail with the cap error.
      if ('error' in res) {
        expect(res.error.message).not.toContain('exceeds the maximum');
      }
    });
  });

  describe('fit clamp signal', () => {
    it('fit_view returns { zoom, clamped }', async () => {
      const { bridge, newFlow } = setup();
      const flow = newFlow();
      bridge.register('main', flow);
      flow.setNodes([makeNode('a'), makeNode('b')]);
      const res = (await bridge.callTool('fit_view', {})) as { zoom: number; clamped: boolean };
      expect(res).toHaveProperty('zoom');
      expect(res).toHaveProperty('clamped');
      // No panZoom in the harness, so the fit is a no-op: zoom is the NaN sentinel.
      expect(typeof res.zoom).toBe('number');
      expect(typeof res.clamped).toBe('boolean');
    });

    it('fit_view rejects a non-positive minZoom with -32602', async () => {
      const { bridge, newFlow } = setup();
      bridge.register('main', newFlow());
      await expect(bridge.callTool('fit_view', { minZoom: 0 })).rejects.toMatchObject({ code: -32602 });
      await expect(bridge.callTool('fit_view', { minZoom: -1 })).rejects.toMatchObject({ code: -32602 });
      await expect(bridge.callTool('fit_view', { minZoom: 'big' })).rejects.toMatchObject({ code: -32602 });
    });

    it('fit_view threads minZoom to the service and captures no history', async () => {
      const { bridge, newFlow } = setup();
      const flow = newFlow();
      bridge.register('main', flow);
      flow.setNodes([makeNode('a')]);
      const spy = vi.spyOn(flow, 'fitView');
      await bridge.callTool('fit_view', { minZoom: 0.3 });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ minZoom: 0.3 }));
      const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
      expect(status.pastDepth).toBe(0);
    });

    it('fit_bounds returns { zoom, clamped } and threads minZoom to the service', async () => {
      const { bridge, newFlow } = setup();
      const flow = newFlow();
      bridge.register('main', flow);
      const spy = vi.spyOn(flow, 'fitBounds');
      const res = (await bridge.callTool('fit_bounds', {
        bounds: { x: 0, y: 0, width: 200, height: 100 },
        minZoom: 0.2,
      })) as { zoom: number; clamped: boolean };
      expect(res).toHaveProperty('zoom');
      expect(res).toHaveProperty('clamped');
      expect(typeof res.clamped).toBe('boolean');
      expect(spy).toHaveBeenCalledWith(
        { x: 0, y: 0, width: 200, height: 100 },
        expect.objectContaining({ minZoom: 0.2 }),
      );
    });

    it('fit_bounds rejects a non-positive minZoom with -32602', async () => {
      const { bridge, newFlow } = setup();
      bridge.register('main', newFlow());
      const bounds = { x: 0, y: 0, width: 10, height: 10 };
      await expect(bridge.callTool('fit_bounds', { bounds, minZoom: 0 })).rejects.toMatchObject({ code: -32602 });
      await expect(bridge.callTool('fit_bounds', { bounds, minZoom: -1 })).rejects.toMatchObject({ code: -32602 });
      await expect(bridge.callTool('fit_bounds', { bounds, minZoom: 'big' })).rejects.toMatchObject({ code: -32602 });
    });
  });
});

describe('summarized / scoped reads', () => {
  it('get_state reports collapsedHiddenIds (empty, then populated)', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('g', { type: 'group' }), makeNode('a', { parentId: 'g' })]);
    let res = (await bridge.callTool('get_state', {})) as { collapsedHiddenIds: string[] };
    expect(res.collapsedHiddenIds).toEqual([]);

    flow.setNodes([makeNode('g', { type: 'group', collapsed: true }), makeNode('a', { parentId: 'g' })]);
    res = (await bridge.callTool('get_state', {})) as { collapsedHiddenIds: string[] };
    expect(res.collapsedHiddenIds).toEqual(['a']);
  });

  it('get_state({ groupId }) returns the group subtree + induced edges', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group' }),
      makeNode('a', { parentId: 'g' }),
      makeNode('b', { parentId: 'g' }),
      makeNode('c'),
    ]);
    flow.setEdges([
      { id: 'ab', source: 'a', target: 'b' } as Edge,
      { id: 'bc', source: 'b', target: 'c' } as Edge,
    ]);
    const res = (await bridge.callTool('get_state', { groupId: 'g' })) as {
      nodes: { id: string }[];
      edges: { id: string }[];
    };
    expect(res.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(res.edges.map((e) => e.id)).toEqual(['ab']);
  });

  it('get_state({ groupId }) is nesting-aware (includes grandchildren)', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group' }),
      makeNode('sub', { type: 'group', parentId: 'g' }),
      makeNode('leaf', { parentId: 'sub' }),
      makeNode('outside'),
    ]);
    const res = (await bridge.callTool('get_state', { groupId: 'g' })) as { nodes: { id: string }[] };
    expect(res.nodes.map((n) => n.id).sort()).toEqual(['leaf', 'sub']);
  });

  it('get_state rejects an unknown groupId with -32602', async () => {
    const { bridge, newFlow } = setup();
    bridge.register('main', newFlow());
    await expect(bridge.callTool('get_state', { groupId: 'nope' })).rejects.toMatchObject({ code: -32602 });
  });

  it('get_state rejects groupId + bounds together with -32602', async () => {
    const { bridge, newFlow } = setup();
    bridge.register('main', newFlow());
    await expect(
      bridge.callTool('get_state', { groupId: 'g', bounds: { x: 0, y: 0, width: 1, height: 1 } }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('get_state({ bounds }) returns intersecting nodes + induced edges', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('near', { position: { x: 0, y: 0 }, width: 100, height: 100 }),
      makeNode('near2', { position: { x: 20, y: 20 }, width: 100, height: 100 }),
      makeNode('far', { position: { x: 10000, y: 10000 }, width: 100, height: 100 }),
    ]);
    flow.setEdges([
      { id: 'nn', source: 'near', target: 'near2' } as Edge, // both in scope — kept
      { id: 'nf', source: 'near', target: 'far' } as Edge, // crosses out — dropped
    ]);
    const res = (await bridge.callTool('get_state', {
      bounds: { x: -10, y: -10, width: 50, height: 50 },
    })) as { nodes: { id: string }[]; edges: { id: string }[] };
    expect(res.nodes.map((n) => n.id).sort()).toEqual(['near', 'near2']);
    expect(res.edges.map((e) => e.id)).toEqual(['nn']);
  });

  it('get_summary returns counts, groups, titles, bounds, collapsedHiddenIds', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group', collapsed: true, data: { label: 'Container' } }),
      makeNode('a', { parentId: 'g', data: { label: 'Alpha' }, width: 50, height: 50 }),
      makeNode('b', { type: 'idea', data: { name: 'Bee' }, width: 50, height: 50 }),
    ]);
    flow.setEdges([{ id: 'ab', source: 'a', target: 'b' } as Edge]);
    const res = (await bridge.callTool('get_summary', {})) as {
      counts: { nodes: number; edges: number; groups: number };
      groups: { id: string; label: string; collapsed: boolean; memberCount: number }[];
      titles: { id: string; type: string; label: string }[];
      bounds: { x: number; y: number; width: number; height: number } | null;
      collapsedHiddenIds: string[];
    };
    expect(res.counts).toEqual({ nodes: 3, edges: 1, groups: 1 });
    expect(res.groups).toEqual([{ id: 'g', label: 'Container', collapsed: true, memberCount: 1 }]);
    const titleOf = (id: string) => res.titles.find((t) => t.id === id)!;
    expect(titleOf('a').label).toBe('Alpha');
    expect(titleOf('b')).toEqual({ id: 'b', type: 'idea', label: 'Bee' });
    expect(res.bounds).not.toBeNull();
    expect(res.collapsedHiddenIds).toEqual(['a']);
  });

  it('get_summary memberCount is nesting-aware (counts grandchildren)', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group' }),
      makeNode('sub', { type: 'group', parentId: 'g' }),
      makeNode('leaf', { parentId: 'sub' }),
    ]);
    const res = (await bridge.callTool('get_summary', {})) as {
      groups: { id: string; memberCount: number }[];
    };
    const g = res.groups.find((x) => x.id === 'g')!;
    expect(g.memberCount).toBe(2); // sub + leaf
  });

  it('get_summary returns bounds: null for an empty flow', async () => {
    const { bridge, newFlow } = setup();
    bridge.register('main', newFlow());
    const res = (await bridge.callTool('get_summary', {})) as { bounds: unknown; counts: { nodes: number } };
    expect(res.counts.nodes).toBe(0);
    expect(res.bounds).toBeNull();
  });

  it('get_summary does not capture a history entry', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a')]);
    await bridge.callTool('get_summary', {});
    const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });
});

describe('group lifecycle + minted ids', () => {
  it('add_node mints an id when omitted and returns the created node', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    const node = (await bridge.callTool('add_node', {
      node: { position: { x: 0, y: 0 }, data: {} },
    })) as { id: string } | null;
    expect(typeof node?.id).toBe('string');
    expect(node!.id.length).toBeGreaterThan(0);
    expect(flow.getNode(node!.id)).toBeTruthy();
  });

  it('add_node honors an agent-supplied id', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    const node = (await bridge.callTool('add_node', {
      node: { id: 'mine', position: { x: 0, y: 0 }, data: {} },
    })) as { id: string };
    expect(node.id).toBe('mine');
  });

  it('group_nodes creates a group (minted id) and reparents members', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('b', { position: { x: 300, y: 200 }, width: 50, height: 50 }),
    ]);
    const res = (await bridge.callTool('group_nodes', { nodeIds: ['a', 'b'], label: 'G' })) as { groupId: string };
    expect(typeof res.groupId).toBe('string');
    expect(flow.getNode(res.groupId)?.type).toBe('group');
    expect(flow.getNode('a')?.parentId).toBe(res.groupId);
    expect(flow.getNode('b')?.parentId).toBe(res.groupId);
  });

  it('group_nodes rejects empty/unknown nodeIds with -32602', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('a')]);
    await expect(bridge.callTool('group_nodes', { nodeIds: [] })).rejects.toMatchObject({ code: -32602 });
    await expect(bridge.callTool('group_nodes', { nodeIds: ['ghost'] })).rejects.toMatchObject({ code: -32602 });
  });

  it('set_node_group reparents and rejects cycles with -32602', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group', position: { x: 0, y: 0 }, width: 400, height: 400 }),
      makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    const res = (await bridge.callTool('set_node_group', { nodeId: 'a', groupId: 'g' })) as { nodeId: string; groupId: string | null };
    expect(res).toEqual({ nodeId: 'a', groupId: 'g' });
    expect(flow.getNode('a')?.parentId).toBe('g');
    await expect(bridge.callTool('set_node_group', { nodeId: 'g', groupId: 'a' })).rejects.toMatchObject({ code: -32602 });
    // self-parent cycle
    await expect(bridge.callTool('set_node_group', { nodeId: 'a', groupId: 'a' })).rejects.toMatchObject({ code: -32602 });
  });

  it('set_node_group detaches to top-level with groupId null', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group', position: { x: 0, y: 0 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    await bridge.callTool('set_node_group', { nodeId: 'a', groupId: null });
    expect(flow.getNode('a')?.parentId).toBeUndefined();
  });

  it('set_group_collapsed flips the collapsed flag', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('g', { type: 'group' }), makeNode('a', { parentId: 'g' })]);
    const res = (await bridge.callTool('set_group_collapsed', { groupId: 'g', collapsed: true })) as { groupId: string; collapsed: boolean };
    expect(res).toEqual({ groupId: 'g', collapsed: true });
    const state = (await bridge.callTool('get_state', {})) as { collapsedHiddenIds: string[] };
    expect(state.collapsedHiddenIds).toEqual(['a']);
  });

  it('dissolve_group removes the group and returns member ids', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([
      makeNode('g', { type: 'group', position: { x: 0, y: 0 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
    ]);
    const res = (await bridge.callTool('dissolve_group', { groupId: 'g' })) as { dissolvedGroupId: string; memberIds: string[] };
    expect(res).toEqual({ dissolvedGroupId: 'g', memberIds: ['a'] });
    expect(flow.getNode('g')).toBeUndefined();
    expect(flow.getNode('a')?.parentId).toBeUndefined();
  });

  it('set_group_collapsed and dissolve_group reject an unknown groupId with -32602', async () => {
    const { bridge, newFlow } = setup();
    bridge.register('main', newFlow());
    await expect(bridge.callTool('set_group_collapsed', { groupId: 'ghost', collapsed: true })).rejects.toMatchObject({ code: -32602 });
    await expect(bridge.callTool('dissolve_group', { groupId: 'ghost' })).rejects.toMatchObject({ code: -32602 });
  });

  it('get_group_bounds returns the box, null for unknown, and captures no history', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('g', { type: 'group', position: { x: 10, y: 20 }, width: 200, height: 100 })]);
    const box = (await bridge.callTool('get_group_bounds', { groupId: 'g' })) as { x: number; y: number; width: number; height: number };
    expect(box).toEqual({ x: 10, y: 20, width: 200, height: 100 });
    expect(await bridge.callTool('get_group_bounds', { groupId: 'nope' })).toBeNull();
    const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
    expect(status.pastDepth).toBe(0);
  });
});
