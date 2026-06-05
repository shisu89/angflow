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
