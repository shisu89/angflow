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
