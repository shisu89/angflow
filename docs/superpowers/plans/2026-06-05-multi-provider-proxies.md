# Multi-Provider Reference Proxies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OpenAI and Gemini reference proxies for the agent chat harness (with Ollama/OpenRouter via base-URL override) plus runtime model switching via an allowlist-gated `x-angflow-model` header on all three proxies, per `docs/superpowers/specs/2026-06-05-multi-provider-proxies-design.md`.

**Architecture:** Three self-contained `.mjs` files under `examples/angular/server/`, each exporting pure translation/config functions and guarding server startup behind an is-main check so tests can import them. Translation layers tested with Node's built-in `node --test`. Zero changes to any `packages/*`.

**Tech Stack:** Plain Node 20+ (`node:http`, global `fetch`, `node:test`, `node:assert`). The only dependency is the already-installed `@anthropic-ai/sdk` (Anthropic proxy, unchanged usage).

**Repo rules:** zero diffs under `packages/` (the AGENT_BRIDGE.md update in Task 4 is the docs exception, allowed since the chat-harness section documents proxy usage). All proxies bind `127.0.0.1`, keys only from env, CORS allow-headers must include `x-angflow-model`.

**Key commands** (from `examples/angular/`):
- Proxy tests: `node --test server/`
- Syntax check: `node --check server/agent-proxy-openai.mjs`
- Example build (Task 4 verification): `npm run build`

---

## Pre-flight

`git status --porcelain` clean except the known untracked root PNGs (`01-overview.png`, `custom-node-broken.png`, `demo-*.png`). Leave them.

---

### Task 1: Anthropic proxy retrofit (importable + model switching) and the shared test pattern

**Files:**
- Modify: `examples/angular/server/agent-proxy.mjs`
- Create: `examples/angular/server/translate.test.mjs`
- Modify: `examples/angular/package.json` (add `test:proxies` script)

- [ ] **Step 1: Write the failing test**

Create `examples/angular/server/translate.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel } from './agent-proxy.mjs';

test('resolveModel: header ignored when allowlist unset', () => {
  assert.equal(resolveModel('gpt-5.2', undefined, 'default-model'), 'default-model');
  assert.equal(resolveModel('gpt-5.2', '', 'default-model'), 'default-model');
});

test('resolveModel: allowlisted header honored', () => {
  assert.equal(resolveModel('claude-opus-4-8', 'claude-sonnet-4-6, claude-opus-4-8', 'claude-sonnet-4-6'), 'claude-opus-4-8');
});

test('resolveModel: non-allowlisted header falls back to default', () => {
  assert.equal(resolveModel('expensive-model', 'claude-sonnet-4-6', 'claude-sonnet-4-6'), 'claude-sonnet-4-6');
});

test('resolveModel: missing header uses default', () => {
  assert.equal(resolveModel(undefined, 'claude-sonnet-4-6', 'claude-sonnet-4-6'), 'claude-sonnet-4-6');
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `examples/angular/`): `node --test server/`
Expected: FAIL — `agent-proxy.mjs` does not export `resolveModel`. NOTE: if the import instead causes `process.exit(1)` ("ANTHROPIC_API_KEY is not set"), that demonstrates exactly why the retrofit needs the is-main guard — proceed.

- [ ] **Step 3: Retrofit `examples/angular/server/agent-proxy.mjs`**

Read the current file first. Restructure it to (full replacement — same behavior when run directly, plus exports and model switching):

```js
#!/usr/bin/env node
/**
 * Reference agent proxy for the angflow chat example (Anthropic).
 *
 * The ONLY place an API key exists. Forwards the chat harness's
 * AgentChatRequest into Anthropic's Messages API and returns
 * { content, stop_reason }.
 *
 * Run:  ANTHROPIC_API_KEY=sk-ant-... node server/agent-proxy.mjs
 * Env:  PORT (default 8787)
 *       ANGFLOW_AGENT_MODEL (default claude-sonnet-4-6 — current as of June 2026)
 *       ANGFLOW_ALLOWED_MODELS (comma-separated; enables the x-angflow-model
 *         request header so an app can let END USERS pick a model at runtime.
 *         Unset = header ignored. Never trust client strings into your bill.)
 *
 * PRODUCTION CAVEATS — this is example code. Before deploying anything like
 * it: add authentication (this proxy answers anyone who can reach it), add
 * rate limiting / spend caps, consider moving the system prompt server-side,
 * and never expose it beyond localhost as-is.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Pick the model for a request: the x-angflow-model header is honored only
 * when ANGFLOW_ALLOWED_MODELS lists it; otherwise the env/default model wins.
 */
export function resolveModel(headerValue, allowlistEnv, defaultModel) {
  if (!headerValue || !allowlistEnv) return defaultModel;
  const allowed = allowlistEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(headerValue) ? headerValue : defaultModel;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-angflow-model',
};

function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[agent-proxy] ANTHROPIC_API_KEY is not set. Exiting.');
    process.exit(1);
  }
  const PORT = Number(process.env.PORT ?? 8787);
  const MODEL = process.env.ANGFLOW_AGENT_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic();

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
      const model = resolveModel(
        req.headers['x-angflow-model'],
        process.env.ANGFLOW_ALLOWED_MODELS,
        MODEL,
      );
      const response = await client.messages.create({
        model,
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
}

// Start only when executed directly — tests import the pure helpers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 4: Add the test script**

In `examples/angular/package.json` `scripts`, add: `"test:proxies": "node --test server/"`.

- [ ] **Step 5: Run to verify pass**

Run: `node --test server/` → 4 tests pass. Also `node --check server/agent-proxy.mjs` → clean. Confirm direct-run behavior unchanged: `node server/agent-proxy.mjs` (without a key) → prints the key error, exit 1.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/server/agent-proxy.mjs examples/angular/server/translate.test.mjs examples/angular/package.json
git commit -m "feat(examples): allowlist-gated runtime model switching in the Anthropic agent proxy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: OpenAI proxy (+ Ollama/OpenRouter path)

**Files:**
- Create: `examples/angular/server/agent-proxy-openai.mjs`
- Modify: `examples/angular/server/translate.test.mjs` (append)

- [ ] **Step 1: Write the failing tests**

Append to `examples/angular/server/translate.test.mjs`:

```js
import { toOpenAiRequest, fromOpenAiResponse } from './agent-proxy-openai.mjs';

test('toOpenAiRequest: system, text, assistant tool_use, tool_result mapping', () => {
  const body = {
    system: 'be brief',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'add a node' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'adding' },
          { type: 'tool_use', id: 'tu_1', name: 'add_node', input: { node: { id: 'n1' } } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu_1', content: '{"id":"n1"}' },
          { type: 'tool_result', tool_use_id: 'tu_2', content: 'boom', is_error: true },
        ],
      },
    ],
    tools: [{ name: 'add_node', description: 'adds', input_schema: { type: 'object', properties: {} } }],
    max_tokens: 1024,
  };
  const req = toOpenAiRequest(body, 'gpt-5.2', 'https://api.openai.com/v1');

  assert.equal(req.model, 'gpt-5.2');
  assert.equal(req.max_completion_tokens, 1024); // openai.com → new param name
  assert.equal(req.messages[0].role, 'system');
  assert.equal(req.messages[0].content, 'be brief');
  assert.equal(req.messages[1].role, 'user');
  assert.equal(req.messages[1].content, 'add a node');
  assert.equal(req.messages[2].role, 'assistant');
  assert.equal(req.messages[2].content, 'adding');
  assert.deepEqual(req.messages[2].tool_calls, [
    { id: 'tu_1', type: 'function', function: { name: 'add_node', arguments: '{"node":{"id":"n1"}}' } },
  ]);
  assert.deepEqual(req.messages[3], { role: 'tool', tool_call_id: 'tu_1', content: '{"id":"n1"}' });
  assert.deepEqual(req.messages[4], { role: 'tool', tool_call_id: 'tu_2', content: '[tool error] boom' });
  assert.deepEqual(req.tools[0], {
    type: 'function',
    function: { name: 'add_node', description: 'adds', parameters: { type: 'object', properties: {} } },
  });
});

test('toOpenAiRequest: non-openai.com base URL uses legacy max_tokens (Ollama/gateways)', () => {
  const body = { system: 's', messages: [], tools: [], max_tokens: 512 };
  const req = toOpenAiRequest(body, 'qwen3', 'http://localhost:11434/v1');
  assert.equal(req.max_tokens, 512);
  assert.equal(req.max_completion_tokens, undefined);
});

test('fromOpenAiResponse: text + tool_calls + finish_reason map', () => {
  const out = fromOpenAiResponse({
    choices: [{
      message: {
        content: 'on it',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_state', arguments: '{}' } }],
      },
      finish_reason: 'tool_calls',
    }],
  });
  assert.deepEqual(out.content[0], { type: 'text', text: 'on it' });
  assert.deepEqual(out.content[1], { type: 'tool_use', id: 'call_1', name: 'get_state', input: {} });
  assert.equal(out.stop_reason, 'tool_use');
});

test('fromOpenAiResponse: defensive parse of malformed arguments JSON', () => {
  const out = fromOpenAiResponse({
    choices: [{
      message: { content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'x', arguments: '{oops' } }] },
      finish_reason: 'tool_calls',
    }],
  });
  assert.deepEqual(out.content[0].input, {});
});

test('fromOpenAiResponse: stop and length map; unknown passes through', () => {
  const mk = (finish_reason) =>
    fromOpenAiResponse({ choices: [{ message: { content: 'x' }, finish_reason }] }).stop_reason;
  assert.equal(mk('stop'), 'end_turn');
  assert.equal(mk('length'), 'max_tokens');
  assert.equal(mk('content_filter'), 'content_filter');
});
```

Run: `node --test server/` → FAIL (cannot find `./agent-proxy-openai.mjs`).

- [ ] **Step 2: Create `examples/angular/server/agent-proxy-openai.mjs`**

```js
#!/usr/bin/env node
/**
 * Reference agent proxy for the angflow chat example (OpenAI-compatible APIs).
 *
 * Translates the chat harness's Anthropic-shaped AgentChatRequest to the
 * OpenAI Chat Completions API and back. Works with api.openai.com AND any
 * OpenAI-compatible gateway via OPENAI_BASE_URL.
 *
 * Run (OpenAI):     OPENAI_API_KEY=sk-... node server/agent-proxy-openai.mjs
 * Run (Ollama):     OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama \
 *                     ANGFLOW_AGENT_MODEL=qwen3 node server/agent-proxy-openai.mjs
 *                   (Qwen3 is the most reliable local tool-caller as of mid-2026.
 *                    Small local models can degrade with this catalog's 52 tools.)
 * Run (OpenRouter): OPENAI_BASE_URL=https://openrouter.ai/api/v1 OPENAI_API_KEY=sk-or-... \
 *                     ANGFLOW_AGENT_MODEL=<provider/model> node server/agent-proxy-openai.mjs
 *
 * Env:  PORT (default 8787)
 *       OPENAI_BASE_URL (default https://api.openai.com/v1)
 *       ANGFLOW_AGENT_MODEL (default gpt-5.2 — current as of June 2026)
 *       ANGFLOW_ALLOWED_MODELS (comma-separated; enables the x-angflow-model header)
 *
 * PRODUCTION CAVEATS — example code: add auth, rate limiting / spend caps,
 * and never expose beyond localhost as-is.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Same allowlist gate as the other proxies (duplicated: each file is copy-pasteable). */
export function resolveModel(headerValue, allowlistEnv, defaultModel) {
  if (!headerValue || !allowlistEnv) return defaultModel;
  const allowed = allowlistEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(headerValue) ? headerValue : defaultModel;
}

/**
 * AgentChatRequest → OpenAI Chat Completions body.
 * api.openai.com expects max_completion_tokens (max_tokens is rejected for
 * reasoning models); Ollama and most gateways still expect max_tokens — pick
 * by base URL.
 */
export function toOpenAiRequest(body, model, baseUrl) {
  const messages = [{ role: 'system', content: body.system }];
  for (const msg of body.messages) {
    if (msg.role === 'assistant') {
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const toolCalls = msg.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      const m = { role: 'assistant', content: text || null };
      if (toolCalls.length > 0) m.tool_calls = toolCalls;
      messages.push(m);
    } else {
      const toolResults = msg.content.filter((b) => b.type === 'tool_result');
      if (toolResults.length > 0) {
        for (const r of toolResults) {
          messages.push({
            role: 'tool',
            tool_call_id: r.tool_use_id,
            content: (r.is_error ? '[tool error] ' : '') + r.content,
          });
        }
      } else {
        messages.push({
          role: 'user',
          content: msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
        });
      }
    }
  }
  const request = {
    model,
    messages,
    tools: body.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    })),
  };
  const maxTokens = body.max_tokens ?? 2048;
  if (baseUrl.includes('api.openai.com')) {
    request.max_completion_tokens = maxTokens;
  } else {
    request.max_tokens = maxTokens;
  }
  return request;
}

/** OpenAI Chat Completions response → AgentChatResponse. */
export function fromOpenAiResponse(data) {
  const choice = data.choices?.[0] ?? {};
  const msg = choice.message ?? {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  for (const tc of msg.tool_calls ?? []) {
    let input = {};
    try {
      input = JSON.parse(tc.function.arguments);
    } catch {
      // Defensive: a weak model emitting bad JSON becomes an empty input —
      // the bridge's validation error feeds back as an is_error tool_result.
    }
    content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
  }
  const finish = choice.finish_reason;
  const stop_reason =
    finish === 'tool_calls' ? 'tool_use'
    : finish === 'stop' ? 'end_turn'
    : finish === 'length' ? 'max_tokens'
    : (finish ?? 'end_turn');
  return { content, stop_reason };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-angflow-model',
};

function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[agent-proxy-openai] OPENAI_API_KEY is not set. Exiting.');
    process.exit(1);
  }
  const PORT = Number(process.env.PORT ?? 8787);
  const BASE_URL = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const MODEL = process.env.ANGFLOW_AGENT_MODEL ?? DEFAULT_MODEL;

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
      const model = resolveModel(req.headers['x-angflow-model'], process.env.ANGFLOW_ALLOWED_MODELS, MODEL);
      const upstream = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(toOpenAiRequest(parsed, model, BASE_URL)),
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error('[agent-proxy-openai] upstream error:', upstream.status, detail);
        res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: `upstream ${upstream.status}: ${detail}` }));
      }
      const out = fromOpenAiResponse(await upstream.json());
      res.writeHead(200, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (err) {
      console.error('[agent-proxy-openai] error:', err?.message ?? err);
      res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
  }).listen(PORT, '127.0.0.1', () => {
    console.error(
      `[agent-proxy-openai] listening on http://127.0.0.1:${PORT}/api/agent (model: ${MODEL}, upstream: ${BASE_URL})`,
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 3: Run to verify pass**

Run: `node --test server/` → 9 tests pass (4 from Task 1 + 5 new). `node --check server/agent-proxy-openai.mjs` → clean. Keyless direct run → key error, exit 1.

- [ ] **Step 4: Commit**

```bash
git add examples/angular/server/agent-proxy-openai.mjs examples/angular/server/translate.test.mjs
git commit -m "feat(examples): OpenAI-compatible agent proxy with Ollama/OpenRouter base-URL path

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Gemini proxy

**Files:**
- Create: `examples/angular/server/agent-proxy-gemini.mjs`
- Modify: `examples/angular/server/translate.test.mjs` (append)

- [ ] **Step 1: Write the failing tests**

Append to `translate.test.mjs`:

```js
import { cleanSchema, createGeminiTranslator } from './agent-proxy-gemini.mjs';

test('cleanSchema strips additionalProperties and $schema at every depth', () => {
  const cleaned = cleanSchema({
    type: 'object',
    additionalProperties: false,
    $schema: 'x',
    properties: {
      node: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      list: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  });
  assert.equal(JSON.stringify(cleaned).includes('additionalProperties'), false);
  assert.equal(JSON.stringify(cleaned).includes('$schema'), false);
  // Everything else preserved.
  assert.deepEqual(cleaned.properties.node.required, ['id']);
  assert.equal(cleaned.properties.list.items.type, 'object');
});

test('gemini round trip: ids synthesized on response, mapped back on next request', () => {
  const tr = createGeminiTranslator();

  // Model replies with two function calls (no ids — Gemini has none).
  const out = tr.fromGeminiResponse({
    candidates: [{
      content: {
        parts: [
          { text: 'working' },
          { functionCall: { name: 'add_node', args: { node: { id: 'n1' } } } },
          { functionCall: { name: 'layout_nodes', args: {} } },
        ],
      },
      finishReason: 'STOP',
    }],
  });
  assert.deepEqual(out.content[0], { type: 'text', text: 'working' });
  assert.equal(out.content[1].type, 'tool_use');
  assert.equal(out.content[1].name, 'add_node');
  assert.match(out.content[1].id, /^gemini-call-\d+$/);
  assert.notEqual(out.content[1].id, out.content[2].id);
  assert.equal(out.stop_reason, 'tool_use'); // functionCall parts present → tool_use

  // The harness sends back tool_results with those synthesized ids; the next
  // request must translate them to functionResponse parts matched by name.
  const req = tr.toGeminiRequest({
    system: 'be brief',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'go' }] },
      { role: 'assistant', content: out.content },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: out.content[1].id, content: '{"id":"n1"}' },
          { type: 'tool_result', tool_use_id: out.content[2].id, content: 'fail', is_error: true },
        ],
      },
    ],
    tools: [{ name: 'add_node', description: 'adds', input_schema: { type: 'object', properties: {}, additionalProperties: false } }],
    max_tokens: 777,
  }, 'gemini-3.5-flash');

  assert.equal(req.systemInstruction.parts[0].text, 'be brief');
  assert.equal(req.generationConfig.maxOutputTokens, 777);
  assert.equal(req.contents[0].role, 'user');
  assert.equal(req.contents[1].role, 'model');
  assert.deepEqual(req.contents[1].parts[1], { functionCall: { name: 'add_node', args: { node: { id: 'n1' } } } });
  const responses = req.contents[2].parts;
  assert.deepEqual(responses[0], { functionResponse: { name: 'add_node', response: { result: '{"id":"n1"}' } } });
  assert.deepEqual(responses[1], { functionResponse: { name: 'layout_nodes', response: { result: '[tool error] fail' } } });
  // Schema cleaning applied to tools.
  assert.equal(JSON.stringify(req.tools).includes('additionalProperties'), false);
});

test('gemini stop_reason: MAX_TOKENS maps; plain text is end_turn', () => {
  const tr = createGeminiTranslator();
  const maxed = tr.fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }] });
  assert.equal(maxed.stop_reason, 'max_tokens');
  const plain = tr.fromGeminiResponse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }] });
  assert.equal(plain.stop_reason, 'end_turn');
});
```

Run: `node --test server/` → FAIL (cannot find `./agent-proxy-gemini.mjs`).

- [ ] **Step 2: Create `examples/angular/server/agent-proxy-gemini.mjs`**

```js
#!/usr/bin/env node
/**
 * Reference agent proxy for the angflow chat example (Google Gemini).
 *
 * Translates the chat harness's Anthropic-shaped AgentChatRequest to the
 * Gemini generateContent REST API and back. Two Gemini quirks handled here:
 *   1. Gemini functionCall parts carry NO ids, but the chat loop pairs tool
 *      results by id — this proxy synthesizes `gemini-call-<n>` ids on the
 *      way out and maps tool_results back to functionResponse parts by name
 *      via a per-process table (single-conversation reference scope).
 *   2. Gemini's `parameters` accepts an OpenAPI subset — additionalProperties
 *      and $schema are stripped from tool schemas recursively.
 *
 * Run:  GEMINI_API_KEY=... node server/agent-proxy-gemini.mjs
 * Env:  PORT (default 8787)
 *       ANGFLOW_AGENT_MODEL (default gemini-3.5-flash — current as of June 2026)
 *       ANGFLOW_ALLOWED_MODELS (comma-separated; enables the x-angflow-model header)
 *
 * PRODUCTION CAVEATS — example code: add auth, rate limiting / spend caps,
 * and never expose beyond localhost as-is.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const DEFAULT_MODEL = 'gemini-3.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** Same allowlist gate as the other proxies (duplicated: each file is copy-pasteable). */
export function resolveModel(headerValue, allowlistEnv, defaultModel) {
  if (!headerValue || !allowlistEnv) return defaultModel;
  const allowed = allowlistEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(headerValue) ? headerValue : defaultModel;
}

/** Recursively strip JSON-Schema keywords Gemini's OpenAPI subset rejects. */
export function cleanSchema(schema) {
  if (Array.isArray(schema)) return schema.map(cleanSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties' || key === '$schema') continue;
    out[key] = cleanSchema(value);
  }
  return out;
}

/**
 * Stateful translator: remembers synthesized call ids → function names so the
 * NEXT request can convert tool_result blocks into functionResponse parts.
 */
export function createGeminiTranslator() {
  const callNames = new Map();
  let nextId = 1;

  return {
    toGeminiRequest(body, model) {
      void model; // model goes in the URL, not the body
      const contents = [];
      for (const msg of body.messages) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({ functionCall: { name: block.name, args: block.input ?? {} } });
          } else if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: callNames.get(block.tool_use_id) ?? 'unknown_function',
                response: { result: (block.is_error ? '[tool error] ' : '') + block.content },
              },
            });
          }
        }
        contents.push({ role, parts });
      }
      return {
        systemInstruction: { parts: [{ text: body.system }] },
        contents,
        tools: [{
          functionDeclarations: body.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: cleanSchema(t.input_schema),
          })),
        }],
        generationConfig: { maxOutputTokens: body.max_tokens ?? 2048 },
      };
    },

    fromGeminiResponse(data) {
      const candidate = data.candidates?.[0] ?? {};
      const parts = candidate.content?.parts ?? [];
      const content = [];
      let sawFunctionCall = false;
      for (const part of parts) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          content.push({ type: 'text', text: part.text });
        } else if (part.functionCall) {
          sawFunctionCall = true;
          const id = `gemini-call-${nextId++}`;
          callNames.set(id, part.functionCall.name);
          content.push({
            type: 'tool_use',
            id,
            name: part.functionCall.name,
            input: part.functionCall.args ?? {},
          });
        }
      }
      const stop_reason = sawFunctionCall
        ? 'tool_use'
        : candidate.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn';
      return { content, stop_reason };
    },
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-angflow-model',
};

function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[agent-proxy-gemini] GEMINI_API_KEY is not set. Exiting.');
    process.exit(1);
  }
  const PORT = Number(process.env.PORT ?? 8787);
  const MODEL = process.env.ANGFLOW_AGENT_MODEL ?? DEFAULT_MODEL;
  const translator = createGeminiTranslator();

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
      const model = resolveModel(req.headers['x-angflow-model'], process.env.ANGFLOW_ALLOWED_MODELS, MODEL);
      const upstream = await fetch(`${BASE_URL}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify(translator.toGeminiRequest(parsed, model)),
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error('[agent-proxy-gemini] upstream error:', upstream.status, detail);
        res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: `upstream ${upstream.status}: ${detail}` }));
      }
      const out = translator.fromGeminiResponse(await upstream.json());
      res.writeHead(200, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (err) {
      console.error('[agent-proxy-gemini] error:', err?.message ?? err);
      res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
  }).listen(PORT, '127.0.0.1', () => {
    console.error(`[agent-proxy-gemini] listening on http://127.0.0.1:${PORT}/api/agent (model: ${MODEL})`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 3: Run to verify pass**

Run: `node --test server/` → 12 tests pass. `node --check server/agent-proxy-gemini.mjs` → clean. Keyless run → key error, exit 1.

- [ ] **Step 4: Commit**

```bash
git add examples/angular/server/agent-proxy-gemini.mjs examples/angular/server/translate.test.mjs
git commit -m "feat(examples): Gemini agent proxy with id synthesis and schema cleaning

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Docs + final verification

**Files:**
- Modify: `packages/angular/AGENT_BRIDGE.md` (chat-harness section)
- Modify: `examples/angular/src/app/examples/agent-chat/agent-chat.component.ts` (description text only)

- [ ] **Step 1: Provider table in AGENT_BRIDGE.md**

In the "## In-browser chat harness" section, after the existing prose, add:

```markdown
### Provider proxies (reference implementations in `examples/angular/server/`)

| Provider | File | Key env | Default model (June 2026) | Notes |
|---|---|---|---|---|
| Anthropic | `agent-proxy.mjs` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Near-passthrough (the wire shape is Anthropic's) |
| OpenAI | `agent-proxy-openai.mjs` | `OPENAI_API_KEY` | `gpt-5.2` | Tool-call/finish-reason translation |
| Ollama / OpenRouter / any OpenAI-compatible gateway | `agent-proxy-openai.mjs` + `OPENAI_BASE_URL` | `OPENAI_API_KEY` (dummy for Ollama) | set `ANGFLOW_AGENT_MODEL` (e.g. `qwen3`) | Local models: pick a tools-capable one; small models can degrade with the 52-tool catalog |
| Gemini | `agent-proxy-gemini.mjs` | `GEMINI_API_KEY` | `gemini-3.5-flash` | Synthesizes tool-call ids; strips `additionalProperties` from schemas |

All proxies accept an optional `x-angflow-model` request header for end-user
runtime model switching, honored only when `ANGFLOW_ALLOWED_MODELS`
(comma-separated) lists the value — the host's `complete()` fn sets the header;
the library is unaware. Model-name defaults age; override via
`ANGFLOW_AGENT_MODEL`.
```

- [ ] **Step 2: Example page description**

In the agent-chat example component's `description` string, replace the proxy sentence so it reads (adapt to the existing sentence structure): `Start a reference proxy (Anthropic, OpenAI, Gemini, or Ollama via the OpenAI proxy — see server/ in examples/angular), then ask the copilot to edit this canvas…` keeping the rest intact.

- [ ] **Step 3: Final verification**

```bash
cd examples/angular
node --test server/          # 12/12
npm run build                # example still builds (description change is template text)
cd ../..
git diff --stat HEAD -- packages/system packages/mcp packages/angular/src   # ZERO lines (AGENT_BRIDGE.md is the only packages/ change)
```

- [ ] **Step 4: Commit**

```bash
git add packages/angular/AGENT_BRIDGE.md examples/angular/src/app/examples/agent-chat/agent-chat.component.ts
git commit -m "docs(examples): provider proxy table and multi-provider example description

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage checklist (self-review against the design doc)

| Spec requirement | Task |
|---|---|
| OpenAI proxy (fetch, env, base-URL override, token-param split, Ollama/OpenRouter recipes + 52-tool caveat) | 2 |
| Gemini proxy (id synthesis + per-process table, schema cleaning, x-goog-api-key) | 3 |
| `x-angflow-model` + `ANGFLOW_ALLOWED_MODELS` on all three proxies, CORS header updated | 1 (Anthropic), 2, 3 |
| Pure exported translate/resolve functions + `node --test` suite (incl. malformed-arguments defense, finish-reason maps, round-trip id pairing, schema cleaning, model gate) | 1, 2, 3 |
| is-main guard so tests can import without keys | 1, 2, 3 |
| `test:proxies` script | 1 |
| `is_error` → `[tool error]` prefix | 2, 3 |
| 502 passthrough / 400 invalid JSON / exit-1 missing key | all three (in each main) |
| AGENT_BRIDGE.md provider table + example description | 4 |
| Defaults `gpt-5.2` / `gemini-3.5-flash`, vintage-noted | 2, 3, 4 |
| Zero `packages/*` code changes | enforced in Task 4 verification |
