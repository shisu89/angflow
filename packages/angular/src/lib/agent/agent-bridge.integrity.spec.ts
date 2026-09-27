import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../services/flow-store.service';
import { NgFlowService } from '../services/ng-flow.service';
import { AngflowAgentBridge } from './agent-bridge.service';
import { provideAgentBridge } from './provide-agent-bridge';
import type { AgentInbound, AgentOutbound, AgentResponse, AgentTransport } from './types';

/**
 * Graph-integrity guards: the bridge is fed by LLMs that routinely reuse ids,
 * typo ids and reference nodes that don't exist. Each of these used to
 * "succeed" and leave a corrupt or silently-unchanged graph.
 */

class EventTransport implements AgentTransport {
  events: AgentOutbound[] = [];
  start(_h: (req: AgentInbound) => Promise<AgentResponse>): void {}
  send(frame: AgentOutbound): void {
    this.events.push(frame);
  }
  stop(): void {}
  stateCount(): number {
    return this.events.filter((e) => 'event' in e && e.event === 'flow.state').length;
  }
}

const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, position: { x: 0, y: 0 }, data: {}, ...extra });
const settle = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const transport = new EventTransport();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideAgentBridge({ transports: [transport] })],
  });
  const bridge = TestBed.inject(AngflowAgentBridge);
  const flow = Injector.create({ providers: [FlowStore, NgFlowService], parent: TestBed.inject(Injector) }).get(
    NgFlowService,
  );
  bridge.register('main', flow);
  return { bridge, flow, transport };
}

async function expectCode(p: Promise<unknown>, code: number): Promise<void> {
  await expect(p).rejects.toMatchObject({ code });
}

describe('AngflowAgentBridge — id integrity', () => {
  it('rejects add_node / add_nodes / apply_changes ids that already exist or repeat', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('add_node', { node: node('a') });
    await expectCode(bridge.callTool('add_node', { node: node('a') }), -32602);
    await expectCode(bridge.callTool('add_nodes', { nodes: [node('b'), node('b')] }), -32602);
    await expectCode(bridge.callTool('apply_changes', { ops: [{ op: 'add_node', node: node('a') }] }), -32603);
    await expectCode(bridge.callTool('set_nodes', { nodes: [node('x'), node('x')] }), -32602);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a']);
  });

  it('rejects edges with reused ids or endpoints that are not nodes', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('add_nodes', { nodes: [node('a'), node('b')] });
    await bridge.callTool('add_edge', { edge: { id: 'e1', source: 'a', target: 'b' } });
    await expectCode(bridge.callTool('add_edge', { edge: { id: 'e1', source: 'b', target: 'a' } }), -32602);
    await expectCode(bridge.callTool('add_edge', { edge: { id: 'e2', source: 'a', target: 'ghost' } }), -32602);
    await expectCode(bridge.callTool('set_edges', { edges: [{ id: 'e3', source: 'ghost', target: 'a' }] }), -32602);
    expect(flow.getEdges().map((e) => e.id)).toEqual(['e1']);
  });

  it('lets apply_changes add an edge to a node added earlier in the same batch', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('apply_changes', {
      ops: [
        { op: 'add_nodes', nodes: [node('a'), node('b')] },
        { op: 'add_edge', edge: { id: 'e', source: 'a', target: 'b' } },
      ],
    });
    expect(flow.getEdges()).toHaveLength(1);
  });

  it('fails updates to unknown ids instead of returning null and recording history', async () => {
    const { bridge } = setup();
    await expectCode(bridge.callTool('update_node', { id: 'nope', patch: { data: {} } }), -32602);
    await expectCode(bridge.callTool('update_node_data', { id: 'nope', dataPatch: {} }), -32602);
    await expectCode(bridge.callTool('update_edge', { id: 'nope', patch: {} }), -32602);
    await expectCode(bridge.callTool('update_edge_data', { id: 'nope', dataPatch: {} }), -32602);
    expect(await bridge.callTool('history_status')).toMatchObject({ pastDepth: 0 });
  });

  it('rejects patches that rename, mis-position or cyclically reparent a node', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('add_nodes', { nodes: [node('a'), node('b', { parentId: 'a' })] });
    await expectCode(bridge.callTool('update_node', { id: 'b', patch: { id: 'a' } }), -32602);
    await expectCode(bridge.callTool('update_node', { id: 'b', patch: { position: { x: 'nope', y: 0 } } }), -32602);
    await expectCode(bridge.callTool('update_node', { id: 'a', patch: { parentId: 'b' } }), -32602);
    await expectCode(bridge.callTool('update_node', { id: 'a', patch: { parentId: 'ghost' } }), -32602);
    expect(flow.getNodes().map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('rejects a non-finite viewport', async () => {
    const { bridge } = setup();
    await expectCode(bridge.callTool('set_viewport', { viewport: { x: 'x', y: 0, zoom: 1 } }), -32602);
    await expectCode(bridge.callTool('set_viewport', { viewport: { x: 0, y: 0, zoom: 0 } }), -32602);
  });
});

describe('AngflowAgentBridge — deletion', () => {
  it('delete_elements removes descendants of a deleted group instead of orphaning them', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('add_nodes', {
      nodes: [node('g', { type: 'group' }), node('c', { parentId: 'g' }), node('gc', { parentId: 'c' })],
    });
    const res = await bridge.callTool('delete_elements', { nodeIds: ['g'] });
    expect(res).toMatchObject({ deletedNodeIds: ['g', 'c', 'gc'] });
    expect(flow.getNodes()).toHaveLength(0);
  });

  it('delete_elements honours deletable: false and ignores unknown ids', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('add_nodes', { nodes: [node('locked', { deletable: false }), node('free')] });
    const res = await bridge.callTool('delete_elements', { nodeIds: ['locked', 'free', 'ghost'] });
    expect(res).toMatchObject({ deletedNodeIds: ['free'] });
    expect(flow.getNodes().map((n) => n.id)).toEqual(['locked']);
  });

  it('apply_changes delete_elements applies the same cascade and deletable rules', async () => {
    const { bridge, flow } = setup();
    await bridge.callTool('add_nodes', {
      nodes: [node('g', { type: 'group' }), node('c', { parentId: 'g' }), node('locked', { deletable: false })],
    });
    const res = (await bridge.callTool('apply_changes', {
      ops: [{ op: 'delete_elements', nodeIds: ['g', 'locked'] }],
    })) as { results: Array<{ value: unknown }> };
    expect(res.results[0].value).toMatchObject({ deletedNodeIds: ['g', 'c'] });
    expect(flow.getNodes().map((n) => n.id)).toEqual(['locked']);
  });
});

describe('AngflowAgentBridge — op-log and events', () => {
  it('records bridge-minted ids in the op-log so ops can be replayed', async () => {
    const { bridge } = setup();
    const created = (await bridge.callTool('add_node', { node: { position: { x: 0, y: 0 }, data: {} } })) as { id: string };
    const { groupId } = (await bridge.callTool('group_nodes', { nodeIds: [created.id] })) as { groupId: string };
    const log = (await bridge.callTool('get_changes_since', { since: 0 })) as {
      ops: Array<{ method: string; params: Record<string, unknown> }>;
    };
    expect((log.ops[0].params['node'] as { id: string }).id).toBe(created.id);
    expect(log.ops[1].params['groupId']).toBe(groupId);
  });

  it('emits flow.state for collapse, reparent and className/zIndex changes', async () => {
    const { bridge, transport } = setup();
    await bridge.callTool('add_nodes', { nodes: [node('g', { type: 'group' }), node('c')] });
    await settle();

    const cases: Array<[string, Record<string, unknown>]> = [
      ['set_group_collapsed', { groupId: 'g', collapsed: true }],
      ['update_node', { id: 'c', patch: { parentId: 'g' } }],
      ['update_node', { id: 'c', patch: { className: 'hot', zIndex: 5 } }],
    ];
    for (const [method, params] of cases) {
      const before = transport.stateCount();
      await bridge.callTool(method, params);
      await settle();
      expect(transport.stateCount(), method).toBeGreaterThan(before);
    }
  });
});
