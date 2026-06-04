import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, provideZonelessChangeDetection } from '@angular/core';
import { FlowStore } from '../../services/flow-store.service';
import { NgFlowService } from '../../services/ng-flow.service';
import { AngflowAgentBridge } from '../agent-bridge.service';
import { provideAgentBridge } from '../provide-agent-bridge';
import { provideAgentChat } from './provide-agent-chat';
import { AgentChatService } from './agent-chat.service';
import type { AgentChatRequest, AgentChatResponse, CompleteFn } from './types';

/** Scripted CompleteFn: pops canned responses, records every request. */
function makeFakeComplete(responses: AgentChatResponse[]): {
  fn: CompleteFn;
  requests: AgentChatRequest[];
} {
  const requests: AgentChatRequest[] = [];
  const queue = [...responses];
  const fn: CompleteFn = async (req) => {
    requests.push(JSON.parse(JSON.stringify(req)) as AgentChatRequest);
    const next = queue.shift();
    if (!next) throw new Error('FakeComplete: no scripted response left');
    return next;
  };
  return { fn, requests };
}

function textTurn(text: string): AgentChatResponse {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

function setup(responses: AgentChatResponse[], overrides: Partial<import('./types').AgentChatConfig> = {}) {
  const fake = makeFakeComplete(responses);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideAgentBridge({ transports: [] }),
      provideAgentChat({ complete: fake.fn, ...overrides }),
    ],
  });
  const bridge = TestBed.inject(AngflowAgentBridge);
  const child = Injector.create({
    providers: [FlowStore, NgFlowService],
    parent: TestBed.inject(Injector),
  });
  const flow = child.get(NgFlowService);
  bridge.register('main', flow);
  const chat = TestBed.inject(AgentChatService);
  return { chat, flow, bridge, ...fake };
}

describe('AgentChatService — text turns', () => {
  it('appends user and assistant messages for a text-only exchange', async () => {
    const { chat } = setup([textTurn('Hello there')]);
    await chat.send('hi');
    const msgs = chat.messages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: 'user', text: 'hi' });
    expect(msgs[1]).toMatchObject({ role: 'assistant', text: 'Hello there' });
    expect(chat.busy()).toBe(false);
    expect(chat.error()).toBeNull();
  });

  it('sends system prompt, mapped tools, and max_tokens in the request', async () => {
    const { chat, requests } = setup([textTurn('ok')], { maxTokens: 999 });
    await chat.send('hi');
    expect(requests).toHaveLength(1);
    expect(requests[0].system.length).toBeGreaterThan(100);
    expect(requests[0].max_tokens).toBe(999);
    const tool = requests[0].tools.find((t) => t.name === 'add_node')!;
    expect(tool.input_schema).toBeDefined();
    expect((tool as unknown as Record<string, unknown>)['inputSchema']).toBeUndefined();
  });

  it('send() while busy is a no-op', async () => {
    let release!: (r: AgentChatResponse) => void;
    const gate = new Promise<AgentChatResponse>((r) => (release = r));
    const fake: CompleteFn = () => gate;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [] }),
        provideAgentChat({ complete: fake }),
      ],
    });
    const chat = TestBed.inject(AgentChatService);
    const first = chat.send('one');
    await chat.send('two'); // ignored
    expect(chat.messages().filter((m) => m.role === 'user')).toHaveLength(1);
    release(textTurn('done'));
    await first;
  });
});

describe('AgentChatService — tool loop', () => {
  it('executes tool_use via the bridge and feeds tool_result back', async () => {
    const { chat, flow, requests } = setup([
      {
        content: [
          { type: 'text', text: 'Adding a node.' },
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'add_node',
            input: { node: { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'A' } } },
          },
        ],
        stop_reason: 'tool_use',
      },
      textTurn('Done.'),
    ]);
    await chat.send('add a node');

    expect(flow.getNode('n1')).toBeTruthy();

    // Second request carries the assistant turn + a user turn of tool_results.
    const second = requests[1];
    const lastMsg = second.messages[second.messages.length - 1];
    expect(lastMsg.role).toBe('user');
    expect(lastMsg.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu_1' });
    expect((lastMsg.content[0] as { is_error?: boolean }).is_error).toBeUndefined();

    const msgs = chat.messages();
    expect(msgs[1].activity).toEqual([
      expect.objectContaining({ name: 'add_node', status: 'ok' }),
    ]);
    expect(msgs[2]).toMatchObject({ role: 'assistant', text: 'Done.' });
  });

  it('tool errors become is_error tool_results and the loop continues', async () => {
    const { chat, requests } = setup([
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'add_node', input: { node: { id: '' } } },
        ],
        stop_reason: 'tool_use',
      },
      textTurn('I will fix that.'),
    ]);
    await chat.send('add a broken node');

    const second = requests[1];
    const result = second.messages[second.messages.length - 1].content[0] as {
      is_error?: boolean;
      content: string;
    };
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('-32602');

    const msgs = chat.messages();
    expect(msgs[1].activity[0]).toMatchObject({ name: 'add_node', status: 'error' });
    expect(msgs[2].text).toBe('I will fix that.');
    expect(chat.error()).toBeNull(); // tool errors are NOT loop errors
  });

  it('stops after maxTurns and appends the cap note', async () => {
    const toolRound: AgentChatResponse = {
      content: [{ type: 'tool_use', id: 'tu_x', name: 'get_state', input: {} }],
      stop_reason: 'tool_use',
    };
    const { chat, requests } = setup([toolRound, toolRound, toolRound], { maxTurns: 2 });
    await chat.send('loop forever');
    expect(requests).toHaveLength(2);
    const msgs = chat.messages();
    expect(msgs[msgs.length - 1].text).toContain('too many tool rounds');
    expect(chat.busy()).toBe(false);
  });

  it('complete() rejection sets error, clears busy, and keeps history retry-safe', async () => {
    const failing: CompleteFn = async () => {
      throw new Error('proxy unreachable');
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [] }),
        provideAgentChat({ complete: failing }),
      ],
    });
    const chat = TestBed.inject(AgentChatService);
    await chat.send('hi');
    expect(chat.error()).toContain('proxy unreachable');
    expect(chat.busy()).toBe(false);
    // The user message stays visible; resending works once the proxy is back.
    expect(chat.messages()).toHaveLength(1);
    expect(chat.messages()[0]).toMatchObject({ role: 'user', text: 'hi' });
  });

  it('a later send clears the previous error', async () => {
    const responses = [textTurn('ok now')];
    let failFirst = true;
    const flaky: CompleteFn = async (req) => {
      if (failFirst) {
        failFirst = false;
        throw new Error('boom');
      }
      return responses.shift()!;
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [] }),
        provideAgentChat({ complete: flaky }),
      ],
    });
    const chat = TestBed.inject(AgentChatService);
    await chat.send('first');
    expect(chat.error()).toContain('boom');
    await chat.send('second');
    expect(chat.error()).toBeNull();
  });

  it('stop() prevents further rounds; in-flight results are discarded', async () => {
    let release!: (r: AgentChatResponse) => void;
    const gate = new Promise<AgentChatResponse>((r) => (release = r));
    let calls = 0;
    const fake: CompleteFn = () => {
      calls++;
      return gate;
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideAgentBridge({ transports: [] }),
        provideAgentChat({ complete: fake }),
      ],
    });
    const chat = TestBed.inject(AgentChatService);
    const sending = chat.send('go');
    chat.stop();
    release({
      content: [{ type: 'tool_use', id: 't', name: 'get_state', input: {} }],
      stop_reason: 'tool_use',
    });
    await sending;
    expect(calls).toBe(1); // no second round after stop
    expect(chat.busy()).toBe(false);
    // Discarded: no assistant message or activity from the in-flight response.
    expect(chat.messages().filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('caps wire history at maxHistory keeping a leading user message', async () => {
    const turns: AgentChatResponse[] = [];
    for (let i = 0; i < 6; i++) turns.push(textTurn(`reply ${i}`));
    const { chat, requests } = setup(turns, { maxHistory: 4 });
    for (let i = 0; i < 6; i++) await chat.send(`msg ${i}`);
    const last = requests[requests.length - 1];
    expect(last.messages.length).toBeLessThanOrEqual(4);
    expect(last.messages[0].role).toBe('user');
  });

  it('clear() resets messages, history, and error when idle', async () => {
    const { chat, requests } = setup([textTurn('a'), textTurn('b')]);
    await chat.send('one');
    chat.clear();
    expect(chat.messages()).toHaveLength(0);
    await chat.send('two');
    // Fresh conversation: only the new user message in the wire history.
    expect(requests[1].messages).toHaveLength(1);
  });

  it('stop() mid-tools leaves history resumable (no dangling tool_use)', async () => {
    const { chat, requests, bridge } = setup([
      {
        content: [
          { type: 'tool_use', id: 'tu_a', name: 'get_state', input: {} },
          { type: 'tool_use', id: 'tu_b', name: 'get_state', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      textTurn('after resume'),
    ]);

    // Make stop() fire right after the FIRST tool completes (deterministic).
    const orig = bridge.callTool.bind(bridge);
    let firstCall = true;
    (bridge as unknown as Record<string, unknown>)['callTool'] = async (n: string, a: unknown) => {
      const r = await orig(n, a as Record<string, unknown>);
      if (firstCall) {
        firstCall = false;
        chat.stop();
      }
      return r;
    };

    await chat.send('go');

    // Resume: a new send must NOT be rejected — its request history must
    // contain a tool_result for EVERY tool_use of the aborted turn.
    await chat.send('continue');
    const resumed = requests[requests.length - 1];
    const toolUseIds: string[] = [];
    const toolResultIds: string[] = [];
    for (const m of resumed.messages) {
      for (const b of m.content) {
        if (b.type === 'tool_use') toolUseIds.push((b as { id: string }).id);
        if (b.type === 'tool_result') toolResultIds.push((b as { tool_use_id: string }).tool_use_id);
      }
    }
    for (const id of toolUseIds) {
      expect(toolResultIds).toContain(id);
    }
  });

  it('small maxHistory during a multi-round tool turn never produces an empty request', async () => {
    const toolRound = (id: string): AgentChatResponse => ({
      content: [{ type: 'tool_use', id, name: 'get_state', input: {} }],
      stop_reason: 'tool_use',
    });
    const { chat, requests } = setup(
      [toolRound('t1'), toolRound('t2'), textTurn('done')],
      { maxHistory: 2 },
    );
    await chat.send('go');
    for (const req of requests) {
      expect(req.messages.length).toBeGreaterThan(0);
      // First message must be a user turn (Anthropic requirement).
      expect(req.messages[0].role).toBe('user');
    }
    expect(chat.error()).toBeNull();
  });
});
