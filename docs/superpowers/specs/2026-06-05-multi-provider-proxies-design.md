# Multi-Provider Reference Proxies (OpenAI, Gemini, Ollama path) — Design

**Date:** 2026-06-05
**Status:** Approved design; ready for implementation planning
**Scope:** Two new reference backend proxies for the in-browser agent chat harness (`docs/superpowers/specs/2026-06-04-agent-chat-harness-design.md`): `agent-proxy-openai.mjs` (which also serves Ollama/OpenRouter/vLLM via a base-URL override) and `agent-proxy-gemini.mjs`, plus tests for their translation layers and doc updates. **Zero changes to `@angflow/angular`, `@angflow/mcp`, or `@angflow/system`** — the `complete()` contract was designed for exactly this: provider adaptation lives server-side in the proxy.

## Context

The chat harness speaks a fixed Anthropic-Messages-shaped wire format (`AgentChatRequest`/`AgentChatResponse` in `packages/angular/src/lib/agent/chat/types.ts`). The shipped reference proxy (`examples/angular/server/agent-proxy.mjs`) forwards it 1:1 to Anthropic. Wiring another provider means translating that shape to the provider's tool-calling format and back — in a proxy, where keys and provider choices belong.

Ollama exposes an OpenAI-compatible endpoint (`http://localhost:11434/v1`) with tool-calling support, so a base-URL-configurable OpenAI proxy covers local models and every OpenAI-compatible gateway (OpenRouter, vLLM, LiteLLM) without a third translation layer.

## Goals

- `examples/angular/server/agent-proxy-openai.mjs` — self-contained `node:http` + global-`fetch` proxy translating to/from the OpenAI Chat Completions API. Env: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (default `https://api.openai.com/v1`), `ANGFLOW_AGENT_MODEL` (default `gpt-4.1`), `PORT` (default 8787). Header comment documents the Ollama recipe (`OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama`, pick a tools-capable model such as `llama3.1` or `qwen3`) and OpenRouter equivalent.
- `examples/angular/server/agent-proxy-gemini.mjs` — same skeleton, translating to/from the Gemini `generateContent` REST API. Env: `GEMINI_API_KEY`, `ANGFLOW_AGENT_MODEL` (default `gemini-2.5-flash`), `PORT`.
- Translation functions are pure and exported from each proxy module; `examples/angular/server/translate.test.mjs` covers them with Node's built-in `node --test` runner (zero new dependencies).
- Same `/api/agent` endpoint, CORS handling, 502-on-upstream-error behavior, and production-caveat header comments as the existing Anthropic proxy — switching providers = starting a different proxy; the Angular app is untouched.
- Docs: the chat-harness section of `packages/angular/AGENT_BRIDGE.md` gains a provider table (Anthropic / OpenAI / Gemini / Ollama+compatible) naming the three proxy files; the agent-chat example page description mentions provider choice.

## Non-goals

- **No library changes.** The `complete()` contract, chat service, and component stay byte-identical.
- **No streaming, retries, rate limiting, auth** — same production-caveats-as-comments stance as the Anthropic proxy.
- **No provider SDKs** (`openai`, `@google/genai`) — each call is one `fetch`; SDK deps would triple the install for reference code.
- **No universal/multi-provider single proxy** — three readable files beat one tangled one for reference code.
- **No provider auto-detection or failover.**

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Two self-contained proxies; Ollama via `OPENAI_BASE_URL` on the OpenAI one | Ollama (and OpenRouter/vLLM/LiteLLM) speak OpenAI's API; a base-URL override covers them all with zero extra translation code. Rejected: universal proxy (tangled), per-provider SDKs (deps). User-confirmed. |
| HTTP client | Global `fetch` (Node 20+) | One POST per call; keeps each file copy-pasteable with zero imports beyond `node:http`. |
| Tool-call ID handling (Gemini) | Synthesize `gemini-call-<n>` IDs per `functionCall` part, in order; map `tool_result` blocks back to `functionResponse` parts by stored order/name | Gemini's `functionCall` carries no ID, but our loop pairs by `tool_use_id`. Order-stable synthesis is deterministic within one request/response cycle. |
| Schema cleaning (Gemini) | Recursively strip `additionalProperties` (and any `$schema`) from `input_schema` before sending | Gemini's `parameters` accepts an OpenAPI 3.0 subset and rejects unknown keywords; our 51 catalog schemas use `additionalProperties` throughout. |
| Malformed `arguments` JSON (OpenAI) | `JSON.parse` defensively; on failure pass `{}` as the tool input | A local/weak model emitting bad JSON should produce a bridge-side validation error the model can react to (`is_error` tool_result), not a proxy crash. |
| `is_error` tool results → OpenAI/Gemini | Prefix the result content with `[tool error] ` in the translated message (OpenAI `role:'tool'` content; Gemini `functionResponse.response`) | Neither provider has Anthropic's `is_error` flag; an explicit text prefix preserves the signal. |
| stop_reason mapping | OpenAI: `tool_calls→tool_use`, `stop→end_turn`, `length→max_tokens`, else passthrough. Gemini: any `functionCall` parts present → `tool_use`; `finishReason MAX_TOKENS→max_tokens`; else `end_turn` | Matches the loop's three meaningful values; unknown reasons pass through (the loop treats non-`tool_use` as turn end). |
| Testing | Pure exported translate functions + `node --test` file | The translation layers are the fiddly part (ID pairing, schema cleaning, JSON defense); Node's built-in runner needs no new infra in the examples app. Server skeletons remain manual-e2e like the Anthropic proxy. |
| Defaults | `gpt-4.1` / `gemini-2.5-flash` | Capable tool-calling defaults at sane cost; overridable via `ANGFLOW_AGENT_MODEL`. |

## Translation reference

### OpenAI (Chat Completions `/chat/completions`)

Request (ours → OpenAI):
- `system` → leading `{ role: 'system', content }` message.
- User message with text blocks → `{ role: 'user', content: <joined text> }`.
- User message with `tool_result` blocks → one `{ role: 'tool', tool_call_id, content }` message per block (`is_error` → content prefixed `[tool error] `).
- Assistant message → `{ role: 'assistant', content: <text or null>, tool_calls?: [{ id, type:'function', function: { name, arguments: JSON.stringify(input) } }] }`.
- `tools` → `[{ type: 'function', function: { name, description, parameters: input_schema } }]`.
- `max_tokens` → `max_tokens`.

Response (OpenAI → ours):
- `choices[0].message.content` (string, nullable) → one `text` block when non-empty.
- `choices[0].message.tool_calls[]` → `tool_use` blocks (`input` = defensive `JSON.parse(arguments)`, `{}` on failure).
- `finish_reason` → `stop_reason` per the decision-log map.

### Gemini (`POST /v1beta/models/<model>:generateContent?key=…`)

Request (ours → Gemini):
- `system` → `systemInstruction: { parts: [{ text }] }`.
- Messages → `contents[]` with role `user`/`model`; text blocks → `{ text }` parts; `tool_use` → `{ functionCall: { name, args: input } }` parts (IDs dropped — Gemini has none); `tool_result` → `{ functionResponse: { name: <name of the matching call>, response: { result: content } } }` parts, matched to the prior assistant turn's calls by the synthesized ID table.
- `tools` → `[{ functionDeclarations: [{ name, description, parameters: cleaned(input_schema) }] }]`.
- `max_tokens` → `generationConfig.maxOutputTokens`.

Response (Gemini → ours):
- `candidates[0].content.parts[]`: `{ text }` → `text` blocks; `{ functionCall }` → `tool_use` blocks with synthesized IDs `gemini-call-<n>` (stored so the NEXT request can translate the corresponding `tool_result` blocks back to `functionResponse` parts by name).
- ID table scope: per-proxy-process map of synthesized ID → function name; entries are written on response translation and read on the next request translation. (Single-conversation reference scope; documented as such.)
- `stop_reason` per the decision-log map.

## Error handling

| Condition | Behavior |
|---|---|
| Missing provider key at startup | stderr message naming the env var, exit 1 (matches Anthropic proxy) |
| Upstream non-2xx | 502 with the provider's error body text passed through |
| Malformed inbound JSON | 400 `{ error: 'invalid JSON body' }` |
| Malformed model-emitted `arguments` | tool input `{}` → bridge validation produces the `is_error` tool_result the model can self-correct from |

## Testing

`examples/angular/server/translate.test.mjs`, run with `node --test server/` (documented in the proxy headers; no package.json script required, though adding `"test:proxies": "node --test server/"` to the example app is in scope):
1. OpenAI request translation: system placement, text/tool_result/assistant block mapping, `is_error` prefix, tools format.
2. OpenAI response translation: text+tool_calls → blocks, defensive arguments parse (malformed JSON → `{}`), finish_reason map (all three + unknown).
3. Gemini request translation: roles, functionCall/functionResponse parts, ID-table lookups, max_tokens placement.
4. Gemini response translation: ID synthesis (`gemini-call-<n>` stable ordering), text+functionCall mixed parts, finishReason mapping.
5. Schema cleaning: nested `additionalProperties` stripped at every depth; other keywords untouched.
6. Manual e2e (user-run): start each proxy with a real key (or Ollama locally), converse via the agent-chat example.

## Documentation

- `packages/angular/AGENT_BRIDGE.md` chat-harness section: provider table (file, env vars, default model, notes incl. the Ollama recipe). Same-commit rule applies.
- Agent-chat example page description: mention that three provider proxies ship and any OpenAI-compatible gateway works.

## Versioning

No package version changes (example + docs only).
