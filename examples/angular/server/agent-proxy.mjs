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
 *       ANGFLOW_AGENT_MODEL (default claude-opus-5)
 *       ANGFLOW_ALLOWED_ORIGINS (comma-separated extra browser origins; localhost is always allowed)
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
import { corsHeaders, isOriginAllowed } from './cors.mjs';

const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Pick the model for a request: the x-angflow-model header is honored only
 * when ANGFLOW_ALLOWED_MODELS lists it; otherwise the env/default model wins.
 */
export function resolveModel(headerValue, allowlistEnv, defaultModel) {
  if (!headerValue || !allowlistEnv) return defaultModel;
  const allowed = allowlistEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(headerValue) ? headerValue : defaultModel;
}


function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[agent-proxy] ANTHROPIC_API_KEY is not set. Exiting.');
    process.exit(1);
  }
  const PORT = Number(process.env.PORT ?? 8787);
  const MODEL = process.env.ANGFLOW_AGENT_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic();

  createServer(async (req, res) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (!isOriginAllowed(origin)) {
      res.writeHead(403, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: `origin ${origin} not allowed (set ANGFLOW_ALLOWED_ORIGINS)` }));
    }
    const CORS = corsHeaders(origin);
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
        max_tokens: Math.min(Number(max_tokens) || 4096, 16000),
        // Top-level auto-caching: caches the last cacheable block, so the large
        // tool catalog + system prompt + growing tool-use history are read from
        // cache on every round of the loop instead of re-billed in full.
        cache_control: { type: 'ephemeral' },
      });
      res.writeHead(200, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ content: response.content, stop_reason: response.stop_reason }));
    } catch (err) {
      console.error('[agent-proxy] upstream error:', err?.message ?? err);
      const status = err instanceof Anthropic.RateLimitError ? 429 : err instanceof Anthropic.BadRequestError ? 400 : 502;
      res.writeHead(status, { ...CORS, 'content-type': 'application/json' });
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
