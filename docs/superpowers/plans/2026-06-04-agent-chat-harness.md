# In-Browser Agent Chat Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the embeddable "chat with your canvas" feature per `docs/superpowers/specs/2026-06-04-agent-chat-harness-design.md`: a headless `AgentChatService` running an Anthropic-shaped tool-use loop in-process against `AngflowAgentBridge`, a turnkey `<ng-flow-agent-chat>` component, `provideAgentChat({ complete })`, and a reference backend proxy + example page.

**Architecture:** Everything lives in `packages/angular/src/lib/agent/chat/`. The service builds Anthropic Messages requests from `AGENT_TOOL_SCHEMAS` (mapping `inputSchema` → `input_schema`), calls the host's `complete()` fn, executes `tool_use` blocks via `bridge.callTool`, feeds `tool_result` blocks back, and exposes pure signal state. The component renders only from those signals (zoneless-clean). The example app gains a plain-`node:http` reference proxy and an `agent-chat` example page.

**Tech Stack:** Angular signals (zoneless), vitest + TestBed (analog plugin already configured in `packages/angular/vitest.config.ts` — signal inputs and template bindings work in tests), `@anthropic-ai/sdk` (example proxy only, devDep of `angular-examples`).

**Repo rules:** never inject NgZone; assistant/chat text renders via text bindings only (no innerHTML — XSS stance matches node templates); `AGENT_BRIDGE.md` updated in the same commit as the harness exports land (Task 4); zero diffs in `packages/system` and `packages/mcp`.

**Key commands** (from `packages/angular/` unless noted):
- Tests: `npx vitest run` (one file: `npx vitest run src/lib/agent/chat/agent-chat.service.spec.ts`)
- Typecheck: `npm run typecheck` — Build: `npm run build`
- Example build: `npm run build` in `examples/angular`
- pnpm (repo root, v11): `CI=true pnpm install`

---

## Pre-flight

`git status --porcelain` clean except the two known untracked PNGs at repo root. Current state: sub-projects 1–2 merged; `packages/angular` suite is 307/307.

---

### Task 1: Chat types, tool mapping, default system prompt

**Files:**
- Create: `packages/angular/src/lib/agent/chat/types.ts`
- Create: `packages/angular/src/lib/agent/chat/default-system-prompt.ts`
- Test: `packages/angular/src/lib/agent/chat/types.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/agent/chat/types.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toAgentChatTools } from './types';
import { AGENT_TOOL_SCHEMAS } from '../tool-schemas';
import { DEFAULT_AGENT_CHAT_SYSTEM_PROMPT } from './default-system-prompt';

describe('toAgentChatTools', () => {
  it('maps every catalog entry to the Anthropic wire format', () => {
    const tools = toAgentChatTools(AGENT_TOOL_SCHEMAS);
    expect(tools).toHaveLength(AGENT_TOOL_SCHEMAS.length);
    const addNode = tools.find((t) => t.name === 'add_node')!;
    const source = AGENT_TOOL_SCHEMAS.find((s) => s.name === 'add_node')!;
    expect(addNode.description).toBe(source.description);
    // Anthropic uses snake_case input_schema; the catalog uses inputSchema.
    expect(addNode.input_schema).toEqual(source.inputSchema);
    expect((addNode as Record<string, unknown>)['inputSchema']).toBeUndefined();
  });

  it('does not mutate the source schemas', () => {
    const before = JSON.stringify(AGENT_TOOL_SCHEMAS);
    toAgentChatTools(AGENT_TOOL_SCHEMAS);
    expect(JSON.stringify(AGENT_TOOL_SCHEMAS)).toBe(before);
  });
});

describe('DEFAULT_AGENT_CHAT_SYSTEM_PROMPT', () => {
  it('mentions the key canvas-operation guidance', () => {
    for (const phrase of ['layout_nodes', 'register_node_template', 'get_state', 'undo']) {
      expect(DEFAULT_AGENT_CHAT_SYSTEM_PROMPT).toContain(phrase);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/agent/chat/types.spec.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Create `packages/angular/src/lib/agent/chat/types.ts`**

```ts
/**
 * Contracts for the in-browser agent chat harness.
 *
 * `CompleteFn` carries the Anthropic Messages API subset the loop uses —
 * the host's backend proxy forwards it into `client.messages.create` (adding
 * model + key server-side) and returns `{ content, stop_reason }`. The
 * library and the browser never see an API key.
 */
import type { AgentToolSchema } from '../types';

// ── Wire shapes (Anthropic Messages subset) ─────────────────────────────

export interface AgentChatTextBlock {
  type: 'text';
  text: string;
}

export interface AgentChatToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentChatToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type AgentChatContentBlock =
  | AgentChatTextBlock
  | AgentChatToolUseBlock
  | AgentChatToolResultBlock;

export interface AgentChatMessageParam {
  role: 'user' | 'assistant';
  content: AgentChatContentBlock[];
}

/** Anthropic's wire tool format (snake_case `input_schema`). */
export interface AgentChatTool {
  name: string;
  description: string;
  input_schema: AgentToolSchema['inputSchema'];
}

export interface AgentChatRequest {
  system: string;
  messages: AgentChatMessageParam[];
  tools: AgentChatTool[];
  max_tokens: number;
}

export interface AgentChatResponse {
  content: Array<AgentChatTextBlock | AgentChatToolUseBlock>;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | (string & {});
}

/**
 * Host-supplied completion function — typically a fetch to the host's own
 * backend proxy. Must reject (throw) on transport/HTTP failure.
 */
export type CompleteFn = (req: AgentChatRequest) => Promise<AgentChatResponse>;

// ── UI-facing state ─────────────────────────────────────────────────────

export interface ToolActivity {
  name: string;
  status: 'running' | 'ok' | 'error';
  /** Short result/error preview for tooltips. */
  summary: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  activity: ToolActivity[];
}

// ── Configuration ───────────────────────────────────────────────────────

export interface AgentChatConfig {
  complete: CompleteFn;
  /** Defaults to DEFAULT_AGENT_CHAT_SYSTEM_PROMPT. */
  systemPrompt?: string;
  /** Max model round-trips per send(). Default 12. */
  maxTurns?: number;
  /** max_tokens per completion. Default 2048. */
  maxTokens?: number;
  /** Max wire-history entries kept (oldest dropped first). Default 40. */
  maxHistory?: number;
}

/** Map the bridge catalog to Anthropic's wire tool format. Pure; no mutation. */
export function toAgentChatTools(schemas: readonly AgentToolSchema[]): AgentChatTool[] {
  return schemas.map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: s.inputSchema,
  }));
}
```

- [ ] **Step 4: Create `packages/angular/src/lib/agent/chat/default-system-prompt.ts`**

```ts
/**
 * Default system prompt for the in-browser canvas copilot. Hosts override
 * via `provideAgentChat({ systemPrompt })`.
 */
export const DEFAULT_AGENT_CHAT_SYSTEM_PROMPT = `You are a copilot operating a node-graph canvas on behalf of the user. You manipulate the canvas exclusively through the provided tools while the user watches — and may keep editing alongside you.

Guidelines:
- Inspect before large changes: call get_state to see the current graph, and list_node_types to learn which node types this app renders.
- Never hand-compute coordinates for more than a couple of nodes — create the nodes, then call layout_nodes to arrange them.
- For new visual kinds of nodes, call register_node_template once, then create nodes with that type. Interpolate node data into the template with {{data.field}} placeholders.
- Prefer incremental tools (add_node, add_edge, update_node, delete_elements, apply_changes) over set_nodes/set_edges full replacement.
- Every mutation you make is undoable: the user can revert via undo, so act decisively rather than asking for confirmation.
- The user sees the canvas change live. Keep your text responses to one or two short sentences describing what you did.`;
```

- [ ] **Step 5: Run to verify pass + typecheck + commit**

Run: `npx vitest run src/lib/agent/chat/types.spec.ts` → PASS (3 tests). `npm run typecheck` → clean.

```bash
git add src/lib/agent/chat/types.ts src/lib/agent/chat/default-system-prompt.ts src/lib/agent/chat/types.spec.ts
git commit -m "feat(angular): agent chat contracts, tool mapping, and default system prompt

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: provideAgentChat + AgentChatService (the loop)

**Files:**
- Create: `packages/angular/src/lib/agent/chat/provide-agent-chat.ts`
- Create: `packages/angular/src/lib/agent/chat/agent-chat.service.ts`
- Test: `packages/angular/src/lib/agent/chat/agent-chat.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/angular/src/lib/agent/chat/agent-chat.service.spec.ts`. Setup mirrors `src/lib/agent/agent-bridge.spec.ts` (read it for the flow-registration pattern):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
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
    expect((tool as Record<string, unknown>)['inputSchema']).toBeUndefined();
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/agent/chat/agent-chat.service.spec.ts`
Expected: FAIL — cannot resolve `./provide-agent-chat` / `./agent-chat.service`.

- [ ] **Step 3: Create `packages/angular/src/lib/agent/chat/provide-agent-chat.ts`**

```ts
import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { AgentChatService } from './agent-chat.service';
import { DEFAULT_AGENT_CHAT_SYSTEM_PROMPT } from './default-system-prompt';
import type { AgentChatConfig } from './types';

/** Resolved (defaults applied) chat configuration. */
export type ResolvedAgentChatConfig = Required<AgentChatConfig>;

export const AGENT_CHAT_CONFIG = new InjectionToken<ResolvedAgentChatConfig>(
  'AngflowAgentChatConfig',
);

/**
 * Register the in-browser agent chat harness.
 *
 * The `complete` function is the ONLY path to the model: typically a fetch
 * to your own backend proxy, which holds the API key server-side. The
 * library and the browser bundle never handle a key.
 *
 * @example
 * ```ts
 * provideAgentChat({
 *   complete: (req) =>
 *     fetch('/api/agent', {
 *       method: 'POST',
 *       headers: { 'content-type': 'application/json' },
 *       body: JSON.stringify(req),
 *     }).then((r) => {
 *       if (!r.ok) throw new Error(`agent proxy responded ${r.status}`);
 *       return r.json();
 *     }),
 * })
 * ```
 */
export function provideAgentChat(config: AgentChatConfig): EnvironmentProviders {
  const resolved: ResolvedAgentChatConfig = {
    complete: config.complete,
    systemPrompt: config.systemPrompt ?? DEFAULT_AGENT_CHAT_SYSTEM_PROMPT,
    maxTurns: config.maxTurns ?? 12,
    maxTokens: config.maxTokens ?? 2048,
    maxHistory: config.maxHistory ?? 40,
  };
  return makeEnvironmentProviders([
    { provide: AGENT_CHAT_CONFIG, useValue: resolved },
    AgentChatService,
  ]);
}
```

- [ ] **Step 4: Create `packages/angular/src/lib/agent/chat/agent-chat.service.ts`**

```ts
import { Injectable, inject, signal } from '@angular/core';
import { AngflowAgentBridge } from '../agent-bridge.service';
import { AGENT_TOOL_SCHEMAS } from '../tool-schemas';
import { AGENT_CHAT_CONFIG } from './provide-agent-chat';
import {
  toAgentChatTools,
  type AgentChatContentBlock,
  type AgentChatMessageParam,
  type AgentChatResponse,
  type AgentChatTextBlock,
  type AgentChatToolResultBlock,
  type AgentChatToolUseBlock,
  type ChatMessage,
  type ToolActivity,
} from './types';

const SUMMARY_MAX = 120;

function truncate(text: string): string {
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX)}…` : text;
}

/**
 * Headless tool-use loop for the in-browser canvas copilot.
 *
 * Each `send()` runs: build request → `complete()` → execute `tool_use`
 * blocks in-process via `bridge.callTool` → feed `tool_result` blocks back →
 * repeat until `end_turn`, `maxTurns`, or `stop()`. State is exposed as
 * signals so any UI (the bundled `<ng-flow-agent-chat>` or a custom one)
 * renders zoneless-clean.
 *
 * Tool errors do NOT abort the loop — they become `is_error` tool_results
 * the model can react to. Only `complete()` failures abort the turn.
 */
@Injectable()
export class AgentChatService {
  private readonly bridge = inject(AngflowAgentBridge);
  private readonly config = inject(AGENT_CHAT_CONFIG);

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _busy = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Conversation as rendered by the UI. */
  readonly messages = this._messages.asReadonly();
  /** True while a send() turn (including tool rounds) is running. */
  readonly busy = this._busy.asReadonly();
  /** Last transport/loop failure; cleared on the next send(). */
  readonly error = this._error.asReadonly();

  /** Wire-format history sent to complete(). */
  private history: AgentChatMessageParam[] = [];
  private stopped = false;
  private nextMessageId = 1;
  private readonly tools = toAgentChatTools(AGENT_TOOL_SCHEMAS);

  /** Abort after the current step; in-flight complete() results are discarded. */
  stop(): void {
    this.stopped = true;
  }

  /** Reset the conversation. No-op while busy. */
  clear(): void {
    if (this._busy()) return;
    this.history = [];
    this._messages.set([]);
    this._error.set(null);
  }

  async send(text: string): Promise<void> {
    if (this._busy() || text.trim().length === 0) return;
    this._busy.set(true);
    this._error.set(null);
    this.stopped = false;

    this.appendMessage({ role: 'user', text, activity: [] });
    this.history.push({ role: 'user', content: [{ type: 'text', text }] });

    try {
      for (let turn = 0; turn < this.config.maxTurns; turn++) {
        if (this.stopped) return;

        const response = await this.config.complete({
          system: this.config.systemPrompt,
          messages: this.trimmedHistory(),
          tools: this.tools,
          max_tokens: this.config.maxTokens,
        });
        if (this.stopped) return; // discard in-flight results

        const { assistantText, toolUses } = splitContent(response);
        const message = this.appendMessage({
          role: 'assistant',
          text: assistantText,
          activity: toolUses.map((tu) => ({
            name: tu.name,
            status: 'running' as const,
            summary: '',
          })),
        });
        this.history.push({ role: 'assistant', content: response.content });

        if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
          return; // end_turn / max_tokens: the text shown is the final answer
        }

        const results: AgentChatToolResultBlock[] = [];
        for (let i = 0; i < toolUses.length; i++) {
          const tu = toolUses[i];
          try {
            const result = await this.bridge.callTool(tu.name, tu.input);
            this.updateActivity(message.id, i, {
              status: 'ok',
              summary: truncate(JSON.stringify(result ?? null)),
            });
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result ?? null),
            });
          } catch (err) {
            const detail = formatToolError(err);
            this.updateActivity(message.id, i, { status: 'error', summary: detail });
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: detail,
              is_error: true,
            });
          }
          if (this.stopped) return;
        }
        this.history.push({ role: 'user', content: results });
      }

      // maxTurns exhausted.
      this.appendMessage({
        role: 'assistant',
        text: '(stopped: too many tool rounds)',
        activity: [],
      });
    } catch (err) {
      // complete() failed: abort the turn, keep history retry-safe (the
      // user message stays; no partial assistant turn was recorded for
      // the failed round because history.push happens after complete()).
      this._error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this._busy.set(false);
    }
  }

  private trimmedHistory(): AgentChatMessageParam[] {
    let trimmed = this.history;
    if (trimmed.length > this.config.maxHistory) {
      trimmed = trimmed.slice(trimmed.length - this.config.maxHistory);
      // Anthropic requires the first message to be a user turn — and a
      // leading tool_result-only user turn is as confusing as an assistant
      // turn, so drop until we reach a plain user text message.
      while (
        trimmed.length > 0 &&
        !(trimmed[0].role === 'user' && trimmed[0].content.some((b) => b.type === 'text'))
      ) {
        trimmed = trimmed.slice(1);
      }
      this.history = trimmed;
    }
    return trimmed;
  }

  private appendMessage(msg: Omit<ChatMessage, 'id'>): ChatMessage {
    const full: ChatMessage = { id: this.nextMessageId++, ...msg };
    this._messages.update((all) => [...all, full]);
    return full;
  }

  private updateActivity(
    messageId: number,
    index: number,
    patch: Partial<Pick<ToolActivity, 'status' | 'summary'>>,
  ): void {
    this._messages.update((all) =>
      all.map((m) =>
        m.id === messageId
          ? {
              ...m,
              activity: m.activity.map((a, i) => (i === index ? { ...a, ...patch } : a)),
            }
          : m,
      ),
    );
  }
}

function splitContent(response: AgentChatResponse): {
  assistantText: string;
  toolUses: AgentChatToolUseBlock[];
} {
  const texts: string[] = [];
  const toolUses: AgentChatToolUseBlock[] = [];
  for (const block of response.content as AgentChatContentBlock[]) {
    if (block.type === 'text') texts.push((block as AgentChatTextBlock).text);
    if (block.type === 'tool_use') toolUses.push(block as AgentChatToolUseBlock);
  }
  return { assistantText: texts.join('\n'), toolUses };
}

/** Bridge errors carry code/data (see AngflowAgentBridge.callTool). */
function formatToolError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: number }).code;
    return code !== undefined ? `[${code}] ${err.message}` : err.message;
  }
  return String(err);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/agent/chat/agent-chat.service.spec.ts` → PASS (11 tests).
Then full suite: `npx vitest run` → all green (307 + new). `npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/chat/provide-agent-chat.ts src/lib/agent/chat/agent-chat.service.ts src/lib/agent/chat/agent-chat.service.spec.ts
git commit -m "feat(angular): AgentChatService tool-use loop with provideAgentChat config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `<ng-flow-agent-chat>` component

**Files:**
- Create: `packages/angular/src/lib/agent/chat/agent-chat.component.ts`
- Test: `packages/angular/src/lib/agent/chat/agent-chat.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/angular/src/lib/agent/chat/agent-chat.component.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAgentBridge } from '../provide-agent-bridge';
import { provideAgentChat } from './provide-agent-chat';
import { AgentChatService } from './agent-chat.service';
import { AgentChatComponent } from './agent-chat.component';
import type { AgentChatResponse, CompleteFn } from './types';

function mount(complete: CompleteFn): {
  fixture: ComponentFixture<AgentChatComponent>;
  el: HTMLElement;
  chat: AgentChatService;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideAgentBridge({ transports: [] }),
      provideAgentChat({ complete }),
    ],
  });
  const chat = TestBed.inject(AgentChatService);
  const fixture = TestBed.createComponent(AgentChatComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, chat };
}

const echo: CompleteFn = async () => ({
  content: [{ type: 'text', text: 'echo reply' }],
  stop_reason: 'end_turn',
});

describe('AgentChatComponent', () => {
  it('renders the default title (overridable via input)', () => {
    const { el, fixture } = mount(echo);
    expect(el.querySelector('.ng-flow__agent-chat__title')?.textContent).toContain(
      'Canvas copilot',
    );
    fixture.componentRef.setInput('title', 'My copilot');
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__agent-chat__title')?.textContent).toContain('My copilot');
  });

  it('sends input text through the service and renders both bubbles', async () => {
    const { el, fixture, chat } = mount(echo);
    const input = el.querySelector('textarea')!;
    input.value = 'hello agent';
    input.dispatchEvent(new Event('input'));
    (el.querySelector('.ng-flow__agent-chat__send') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(chat.messages()).toHaveLength(2));
    fixture.detectChanges();
    const bubbles = el.querySelectorAll('.ng-flow__agent-chat__bubble');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].textContent).toContain('hello agent');
    expect(bubbles[1].textContent).toContain('echo reply');
    expect(input.value).toBe(''); // cleared after send
  });

  it('renders assistant <script> text inert', async () => {
    const xss: CompleteFn = async () => ({
      content: [{ type: 'text', text: '<script>alert(1)</script>' }],
      stop_reason: 'end_turn',
    });
    const { el, fixture, chat } = mount(xss);
    await chat.send('go');
    fixture.detectChanges();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>');
  });

  it('shows tool chips with status classes', async () => {
    const withTool: CompleteFn = (() => {
      let first = true;
      return async () => {
        if (first) {
          first = false;
          return {
            content: [{ type: 'tool_use', id: 't1', name: 'get_state', input: {} }],
            stop_reason: 'tool_use',
          } as AgentChatResponse;
        }
        return { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn' };
      };
    })();
    const { el, fixture, chat } = mount(withTool);
    await chat.send('inspect');
    fixture.detectChanges();
    const chip = el.querySelector('.ng-flow__agent-chat__chip')!;
    expect(chip.textContent).toContain('get_state');
    // get_state fails (no flow registered in this minimal mount) → error chip,
    // which is exactly the behavior we want to see surfaced.
    expect(chip.classList.contains('ng-flow__agent-chat__chip--error')).toBe(true);
  });

  it('disables input and shows Stop while busy; error banner on failure', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: CompleteFn = async () => {
      await gate;
      throw new Error('proxy down');
    };
    const { el, fixture, chat } = mount(slow);
    const sending = chat.send('hi');
    fixture.detectChanges();
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
    expect(el.querySelector('.ng-flow__agent-chat__stop')).not.toBeNull();
    release();
    await sending;
    fixture.detectChanges();
    expect(el.querySelector('.ng-flow__agent-chat__error')?.textContent).toContain('proxy down');
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(false);
  });
});
```

Add `import { vi } from 'vitest';` if `vi.waitFor` is used and `vi` isn't auto-global (globals are on; verify and drop the import if redundant).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/agent/chat/agent-chat.component.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `packages/angular/src/lib/agent/chat/agent-chat.component.ts`**

```ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AgentChatService } from './agent-chat.service';

/**
 * Drop-in chat panel for the canvas copilot. Renders purely from
 * AgentChatService signals (zoneless-clean). All message text goes through
 * Angular text bindings — never innerHTML. Theme via --ngf-chat-* CSS vars.
 */
@Component({
  selector: 'ng-flow-agent-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ng-flow__agent-chat">
      <div class="ng-flow__agent-chat__header">
        <span class="ng-flow__agent-chat__title">{{ title() }}</span>
        @if (chat.busy()) {
          <button
            type="button"
            class="ng-flow__agent-chat__stop"
            (click)="chat.stop()"
          >Stop</button>
        }
      </div>

      <div class="ng-flow__agent-chat__messages" #scroller>
        @for (m of chat.messages(); track m.id) {
          <div
            class="ng-flow__agent-chat__bubble ng-flow__agent-chat__bubble--{{ m.role }}"
          >
            @if (m.text) {
              <div class="ng-flow__agent-chat__text">{{ m.text }}</div>
            }
            @if (m.activity.length > 0) {
              <div class="ng-flow__agent-chat__chips">
                @for (a of m.activity; track $index) {
                  <span
                    class="ng-flow__agent-chat__chip ng-flow__agent-chat__chip--{{ a.status }}"
                    [title]="a.summary"
                  >
                    {{ a.status === 'running' ? '⏳' : a.status === 'ok' ? '✓' : '✗' }}
                    {{ a.name }}
                  </span>
                }
              </div>
            }
          </div>
        }
        @if (chat.busy()) {
          <div class="ng-flow__agent-chat__busy">…</div>
        }
      </div>

      @if (chat.error(); as err) {
        <div class="ng-flow__agent-chat__error">{{ err }}</div>
      }

      <div class="ng-flow__agent-chat__composer">
        <textarea
          rows="2"
          [placeholder]="placeholder()"
          [disabled]="chat.busy()"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <button
          type="button"
          class="ng-flow__agent-chat__send"
          [disabled]="chat.busy() || draft().trim().length === 0"
          (click)="submit()"
        >▶</button>
      </div>
    </div>
  `,
  styles: [
    `
      .ng-flow__agent-chat {
        display: flex;
        flex-direction: column;
        width: var(--ngf-chat-width, 320px);
        height: var(--ngf-chat-height, 420px);
        background: var(--ngf-chat-bg, #ffffff);
        border: 1px solid var(--ngf-chat-border, #d4d4d8);
        border-radius: 8px;
        font-size: 13px;
        color: #1e293b;
        overflow: hidden;
      }
      .ng-flow__agent-chat__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px solid var(--ngf-chat-border, #e4e4e7);
        font-weight: 600;
      }
      .ng-flow__agent-chat__stop {
        font-size: 11px;
        padding: 2px 8px;
        border: 1px solid #fca5a5;
        background: #fef2f2;
        color: #b91c1c;
        border-radius: 4px;
        cursor: pointer;
      }
      .ng-flow__agent-chat__messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ng-flow__agent-chat__bubble {
        max-width: 85%;
        padding: 6px 10px;
        border-radius: 10px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .ng-flow__agent-chat__bubble--user {
        align-self: flex-end;
        background: var(--ngf-chat-accent, #4f46e5);
        color: #ffffff;
      }
      .ng-flow__agent-chat__bubble--assistant {
        align-self: flex-start;
        background: var(--ngf-chat-assistant-bg, #f1f5f9);
      }
      .ng-flow__agent-chat__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }
      .ng-flow__agent-chat__chip {
        font-size: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        padding: 1px 6px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
      }
      .ng-flow__agent-chat__chip--ok { background: #d1fae5; color: #047857; }
      .ng-flow__agent-chat__chip--error { background: #ffe4e6; color: #be123c; }
      .ng-flow__agent-chat__busy { color: #94a3b8; }
      .ng-flow__agent-chat__error {
        padding: 6px 10px;
        background: #fef2f2;
        color: #b91c1c;
        font-size: 12px;
        border-top: 1px solid #fecaca;
      }
      .ng-flow__agent-chat__composer {
        display: flex;
        gap: 6px;
        padding: 8px;
        border-top: 1px solid var(--ngf-chat-border, #e4e4e7);
      }
      .ng-flow__agent-chat__composer textarea {
        flex: 1;
        resize: none;
        border: 1px solid #d4d4d8;
        border-radius: 6px;
        padding: 6px 8px;
        font: inherit;
      }
      .ng-flow__agent-chat__send {
        align-self: flex-end;
        border: none;
        border-radius: 6px;
        background: var(--ngf-chat-accent, #4f46e5);
        color: #ffffff;
        padding: 6px 10px;
        cursor: pointer;
      }
      .ng-flow__agent-chat__send:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class AgentChatComponent {
  readonly chat = inject(AgentChatService);

  readonly title = input('Canvas copilot');
  readonly placeholder = input('Ask the copilot to edit the canvas…');

  readonly draft = signal('');

  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

  constructor() {
    // Auto-scroll on new messages. setTimeout schedules after render —
    // framework-agnostic timer use, not a CD workaround (zoneless rule 3).
    effect(() => {
      this.chat.messages();
      this.chat.busy();
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 0);
    });
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return; // shift+enter = newline
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    void this.chat.send(text);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/agent/chat/agent-chat.component.spec.ts` → PASS (5 tests).
Full suite + `npm run typecheck` → green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/chat/agent-chat.component.ts src/lib/agent/chat/agent-chat.component.spec.ts
git commit -m "feat(angular): ng-flow-agent-chat drop-in copilot panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Exports + documentation

**Files:**
- Create: `packages/angular/src/lib/agent/chat/index.ts`
- Modify: `packages/angular/src/lib/agent/index.ts`
- Modify: `packages/angular/src/lib/public-api.ts` (nothing if agent barrel re-exports flow through — verify)
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create the chat barrel** `packages/angular/src/lib/agent/chat/index.ts`:

```ts
export { provideAgentChat, AGENT_CHAT_CONFIG } from './provide-agent-chat';
export type { ResolvedAgentChatConfig } from './provide-agent-chat';
export { AgentChatService } from './agent-chat.service';
export { AgentChatComponent } from './agent-chat.component';
export { DEFAULT_AGENT_CHAT_SYSTEM_PROMPT } from './default-system-prompt';
export type {
  AgentChatConfig,
  AgentChatRequest,
  AgentChatResponse,
  AgentChatMessageParam,
  AgentChatContentBlock,
  AgentChatTextBlock,
  AgentChatToolUseBlock,
  AgentChatToolResultBlock,
  AgentChatTool,
  CompleteFn,
  ChatMessage,
  ToolActivity,
} from './types';
```

- [ ] **Step 2: Re-export from the agent barrel.** In `packages/angular/src/lib/agent/index.ts` append:

```ts
export * from './chat';
```

Then check `packages/angular/src/lib/public-api.ts`'s "Agent bridge" export block: it uses NAMED exports from `'./agent'`, so append the chat names there:

```ts
  provideAgentChat,
  AgentChatService,
  AgentChatComponent,
  DEFAULT_AGENT_CHAT_SYSTEM_PROMPT,
  type AgentChatConfig,
  type AgentChatRequest,
  type AgentChatResponse,
  type CompleteFn,
  type ChatMessage,
  type ToolActivity,
```

(Add to the existing `export { ... } from './agent';` list. `AGENT_CHAT_CONFIG` stays internal — do not export it from public-api.)

Note: if `AGENT_CHAT_CONFIG` flows out via `export * from './chat'` in the agent barrel but public-api uses named exports, it remains package-internal as intended — verify public-api doesn't `export *` from `'./agent'`.

- [ ] **Step 3: AGENT_BRIDGE.md.** Add after the "## MCP server" section:

```markdown
## In-browser chat harness

`provideAgentChat({ complete })` + `<ng-flow-agent-chat>` (in
`src/lib/agent/chat/`) embed a canvas copilot directly in the app: a headless
`AgentChatService` runs an Anthropic-shaped tool-use loop, executing every
`tool_use` block in-process via `bridge.callTool` — same semantics, history,
and events as any other bridge caller. The `complete` function is the only
path to the model (typically a fetch to the host's own backend proxy holding
the API key server-side; the library never handles keys). Tools come straight
from `AGENT_TOOL_SCHEMAS` at runtime — no snapshot, no regeneration step.
See the `agent-chat` example and `examples/angular/server/agent-proxy.mjs`
for the reference wiring.
```

- [ ] **Step 4: CLAUDE.md.** In the "Agent Bridge" section, after the MCP snapshot bullet, add:

```markdown
- The in-browser chat harness (`src/lib/agent/chat/`) consumes `AGENT_TOOL_SCHEMAS` directly at runtime — no snapshot regeneration needed for it.
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run && npm run typecheck && npm run build` → green; grep `dist/esm/lib/public-api.d.ts` for `provideAgentChat`.

```bash
git add src/lib/agent/chat/index.ts src/lib/agent/index.ts src/lib/public-api.ts AGENT_BRIDGE.md ../../CLAUDE.md
git commit -m "feat(angular): export agent chat harness and document it in AGENT_BRIDGE.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Reference proxy + example page + final verification

**Files:**
- Create: `examples/angular/server/agent-proxy.mjs`
- Create: `examples/angular/src/app/examples/agent-chat/agent-chat.component.ts`
- Modify: `examples/angular/src/app/app.config.ts`
- Modify: `examples/angular/src/app/app.routes.ts`
- Modify: `examples/angular/package.json` (devDep `@anthropic-ai/sdk`)

- [ ] **Step 1: Install the SDK (example app only).** From the repo root:

```bash
CI=true pnpm -F angular-examples add -D @anthropic-ai/sdk
```

- [ ] **Step 2: Create `examples/angular/server/agent-proxy.mjs`**

```js
#!/usr/bin/env node
/**
 * Reference agent proxy for the angflow chat example.
 *
 * The ONLY place an API key exists. Forwards the chat harness's
 * AgentChatRequest into Anthropic's Messages API and returns
 * { content, stop_reason }.
 *
 * Run:  ANTHROPIC_API_KEY=sk-ant-... node server/agent-proxy.mjs
 * Env:  PORT (default 8787), ANGFLOW_AGENT_MODEL (default claude-sonnet-4-6)
 *
 * PRODUCTION CAVEATS — this is example code. Before deploying anything like
 * it: add authentication (this proxy answers anyone who can reach it), add
 * rate limiting / spend caps, consider moving the system prompt server-side,
 * and never expose it beyond localhost as-is.
 */
import { createServer } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[agent-proxy] ANTHROPIC_API_KEY is not set. Exiting.');
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANGFLOW_AGENT_MODEL ?? 'claude-sonnet-4-6';
const client = new Anthropic();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== 'POST' || req.url !== '/api/agent') {
    res.writeHead(404, CORS);
    return res.end('not found');
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'invalid JSON body' }));
  }
  try {
    const { system, messages, tools, max_tokens } = parsed;
    const response = await client.messages.create({
      model: MODEL,
      system,
      messages,
      tools,
      max_tokens: max_tokens ?? 2048,
    });
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' });
    res.end(JSON.stringify({ content: response.content, stop_reason: response.stop_reason }));
  } catch (err) {
    console.error('[agent-proxy] upstream error:', err?.message ?? err);
    res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err?.message ?? err) }));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.error(`[agent-proxy] listening on http://127.0.0.1:${PORT}/api/agent (model: ${MODEL})`);
});
```

- [ ] **Step 3: Wire `provideAgentChat` in `examples/angular/src/app/app.config.ts`.** Read the file; add the import and provider:

```ts
import { provideAgentChat } from '@angflow/angular';

// inside the providers array, after provideAgentBridge(...):
    provideAgentChat({
      complete: async (req) => {
        let res: Response;
        try {
          res = await fetch('http://localhost:8787/api/agent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req),
          });
        } catch {
          throw new Error(
            'Agent proxy unreachable. Start it with: ANTHROPIC_API_KEY=... node server/agent-proxy.mjs',
          );
        }
        if (!res.ok) {
          throw new Error(`Agent proxy responded ${res.status}: ${await res.text()}`);
        }
        return res.json();
      },
    }),
```

- [ ] **Step 4: Create the example page** `examples/angular/src/app/examples/agent-chat/agent-chat.component.ts`. Follow the structure of `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts` (read it): an `app-example-card` wrapping an `<ng-flow>` with Background/Controls plus a `<ng-flow-panel position="top-right">` containing `<ng-flow-agent-chat />`. Starter graph: the same 3 nodes/2 edges as the agent-bridge example. Register the flow with the bridge in `(init)` (`bridge.register('demo', $event)` with the same unregister-on-destroy pattern). Description text: `An end-user copilot embedded in the app. Start the reference proxy (ANTHROPIC_API_KEY=... node server/agent-proxy.mjs from examples/angular), then ask the copilot to edit this canvas — e.g. "add a database node, connect it to Process, and tidy the layout".` Include `(nodesChange)`/`(edgesChange)`/`(connect)` handlers like the agent-bridge example so human editing works.

- [ ] **Step 5: Register the route.** In `examples/angular/src/app/app.routes.ts`, add the import and a row next to the Agent bridge entry:

```ts
import { AgentChatExampleComponent } from './examples/agent-chat/agent-chat.component';
// ...
  { name: 'Agent chat',              path: 'agent-chat',              component: AgentChatExampleComponent },
```

- [ ] **Step 6: Build + verify everything**

```bash
cd packages/angular && npm run build && npx vitest run && npm run typecheck
cd ../../examples/angular && npm run build
node --check server/agent-proxy.mjs            # syntax-valid without a key
cd ../.. && git diff --stat HEAD -- packages/system packages/mcp   # zero lines
```

- [ ] **Step 7: Manual e2e (user-run; report as pending if no browser/key)**

1. `cd examples/angular && ANTHROPIC_API_KEY=sk-... node server/agent-proxy.mjs`
2. `npm run dev`, open the "Agent chat" example.
3. Ask: "add a database node, connect it to Process, then tidy the layout" → watch nodes appear, chips tick, layout snap. Drag a node mid-conversation; ask for another change; undo via console `angflow.callTool('undo')`.
4. Stop the proxy; send a message → error banner with the start-the-proxy hint.

- [ ] **Step 8: Commit**

```bash
git add examples/angular/server/agent-proxy.mjs examples/angular/src/app/examples/agent-chat examples/angular/src/app/app.config.ts examples/angular/src/app/app.routes.ts examples/angular/package.json pnpm-lock.yaml
git commit -m "feat(examples): agent-chat example page with reference backend proxy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage checklist (self-review against the design doc)

| Spec requirement | Task |
|---|---|
| Anthropic-shaped contracts + `inputSchema`→`input_schema` mapping | 1 |
| Default canvas-aware system prompt, overridable | 1, 2 (config default) |
| `provideAgentChat` with defaults (maxTurns 12, maxTokens 2048, maxHistory 40) | 2 |
| Loop: tool_use → `bridge.callTool` → tool_result; tool errors `is_error` + continue; `complete()` failure aborts retry-safe; maxTurns note; stop() discards; history cap with leading-user repair; busy/error signals | 2 |
| `<ng-flow-agent-chat>`: bubbles, chips, busy/Stop, error banner, input, CSS vars, text-bindings-only | 3 |
| Exports (AGENT_CHAT_CONFIG internal) + AGENT_BRIDGE.md same-commit + CLAUDE.md note | 4 |
| Reference proxy (node:http, key/model envs, CORS, production caveats) | 5 |
| Example page + route + proxy-down graceful degradation | 5 |
| FakeComplete harness; service tests (11); component tests (5) | 2, 3 |
| No streaming/markdown/gating/persistence/BYOK; no system/mcp diffs | enforced in 5's verification |
| `@angflow/angular` minor bump | deferred to publish time |
