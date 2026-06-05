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
