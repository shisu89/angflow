# In-Browser Agent Chat Harness — Design

**Date:** 2026-06-04
**Status:** Approved design; ready for implementation planning
**Scope:** Sub-project 3 of 3 in the "solidify the agentic entry point" effort (decomposition and cross-cutting decisions: `docs/superpowers/specs/2026-06-03-agent-tool-surface-completeness-design.md`). Adds an embeddable "chat with your canvas" feature to `@angflow/angular`: a headless `AgentChatService` running the LLM tool-use loop in-process against `AngflowAgentBridge`, a turnkey `<ng-flow-agent-chat>` panel component, a host-pluggable `complete()` contract carrying the Anthropic Messages shape, and a reference backend proxy in `examples/angular`. No API key ever touches the library or the browser bundle.

## Context

Sub-projects 1–2 delivered a 51-tool bridge catalog (`AGENT_TOOL_SCHEMAS`) and an MCP server for external agents. This sub-project makes the agent an embeddable *feature of the app itself*: an end-user types "add a database node and wire it to the API" into a chat panel and watches the canvas build itself, while still editing alongside. Tool execution is a synchronous in-process call (`bridge.callTool`) — no transport hop; undo, `flow.state` events, and template rendering behave identically to every other bridge caller.

Binding cross-cutting decisions (from sub-project 1's spec):
- **No API keys in the library or browser.** The harness takes a pluggable `complete(req): Promise<res>` function; the documented production path is a small host-owned backend proxy holding the key server-side. A reference proxy ships in `examples/angular`.
- **`AGENT_TOOL_SCHEMAS` is the single tool-truth** shared with the MCP server.
- Independent of sub-project 2 (the MCP server); both consume the same bridge.

## Problem

There is no supported way to ship an AI copilot *to end-users* of an angflow app. The console (`window.angflow`) is developer-only; the MCP server targets external developer tools. The pieces (tool catalog, bridge, undo) exist; nothing runs an LLM tool-use loop in the page or gives hosts a drop-in chat UI.

## Goals

- `provideAgentChat({ complete, systemPrompt?, maxTurns?, maxTokens?, maxHistory? })` provider API in `@angflow/angular`.
- Headless `AgentChatService`: signal state (`messages`, `busy`, `error`), `send()`, `stop()`, `clear()`; runs the Anthropic-shaped tool-use loop, executing `tool_use` blocks via `bridge.callTool` and feeding `tool_result` blocks back until `end_turn` (or caps).
- Turnkey `<ng-flow-agent-chat>` component: plain-text bubbles, per-call tool chips (`running/ok/error`), busy state, Stop, error banner, input; CSS-variable theming; zoneless-clean (renders purely from signals).
- `complete()` contract = Anthropic Messages request/response subset, so the reference proxy is a near-passthrough and non-Anthropic backends translate server-side.
- Canvas-aware default system prompt, host-overridable.
- Reference proxy (`examples/angular/server/agent-proxy.mjs`, plain `node:http` + `@anthropic-ai/sdk`) and a new `agent-chat` example page that degrades gracefully when the proxy is down.
- Agent acts freely; **undo is the safety net** — no approval gating (user-confirmed).
- Tree-shakeable: apps not calling `provideAgentChat` pay nothing.
- Update `AGENT_BRIDGE.md` (pointer section) in the same commit as the harness lands.

## Non-goals

- **Streaming.** `complete()` returns a single response; token streaming is a compatible future variant. UI shows busy state until the turn completes.
- **Markdown rendering.** Assistant text renders via Angular text bindings only — same no-HTML-injection stance as node templates. (Also avoids a sanitizer surface.)
- **Approval gating.** No confirm-before-mutate UI or `approveToolCall` hook in v1; bridge undo covers mistakes. Addable compatibly later.
- **Multi-flow targeting.** The chat uses the bridge's default-flow resolution (works when one flow is registered, which is the embed case). A `flowId` plumb-through is deferred.
- **Conversation persistence, voice, BYOK browser-key mode** (rejected in the cross-cutting decisions).
- **A separate `@angflow/chat` package** — the harness lives in `@angflow/angular` next to the bridge it is coupled to.
- **Proxy productionization** — the reference proxy documents (in comments) but does not implement auth, rate limiting, or multi-tenant key handling.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| `complete()` contract shape | Anthropic Messages subset (`system`, `messages` with content blocks, `tools`, `max_tokens` → `content` blocks + `stop_reason`) | `AGENT_TOOL_SCHEMAS` is already LLM-tool formatted; the reference proxy becomes ~15 lines of passthrough; provider adaptation belongs server-side in the proxy. Rejected: neutral mini-schema (second schema to own; every adopter writes more translation). User-confirmed. |
| Tool-call gating | None — act freely, undo is the safety net | Watching the canvas build itself is the product; the activity trail gives visibility; bridge undo reverts mistakes. Rejected: confirm-destructive (loop-suspension machinery, flow-breaking) and pluggable hook (API surface without a v1 consumer). User-confirmed. |
| UI scope | Clean & minimal: text bubbles, tool chips, busy, Stop, error banner, input; non-streaming; no markdown | Smallest safe turnkey surface; custom UIs use the headless service. User-confirmed. |
| Placement | `packages/angular/src/lib/agent/chat/`, headless service + component | Chat is bridge-coupled (in-process `callTool`); headless-first matches the codebase pattern; tree-shaken when unused. Rejected: component-owned loop (untestable, locks UI), separate package (publish ceremony, split docs). |
| Schema key mapping | Service maps `inputSchema` → `input_schema` when building requests | Anthropic's wire format uses snake_case; our catalog uses camelCase. One mapping point in the service, not a schema fork. |
| Tool errors | Become `tool_result` with `is_error: true` carrying the `[code] message` text; loop continues | The model sees failures and self-corrects — same philosophy as the MCP error surface. Chip shows ✗. |
| `complete()` failure | Aborts the turn; `error` signal set; history keeps the user message so retry = resend | Transport failures are the host's domain (proxy down); the conversation must stay consistent. |
| Loop caps | `maxTurns` default 12 (then "(stopped: too many tool rounds)" assistant note); history capped at `maxHistory` default 40 messages, oldest pairs dropped | Bounds cost and request size for long sessions; defaults host-overridable. |
| `stop()` semantics | Flag checked between loop iterations and after each tool call; an in-flight `complete()` finishes but its results are discarded | Simple and safe; no AbortSignal plumbed through `complete()` in v1 (compatible addition later). |
| `max_tokens` | Default 2048, host-overridable via `provideAgentChat` | Sane default for canvas-operation responses. |
| Default system prompt | Ships canvas-aware guidance (prefer `layout_nodes`; use `register_node_template`; check `get_state`/`list_node_types`; mutations undoable); overridable | The prompt is product knowledge the host shouldn't have to rediscover. |
| Reference proxy tech | Plain `node:http` + `@anthropic-ai/sdk`, ~40 lines, CORS for dev, `ANTHROPIC_API_KEY` + `ANGFLOW_AGENT_MODEL` envs (model default `claude-sonnet-4-6`) | Zero framework dependency keeps the example copy-pasteable; production caveats documented in header comments. |
| Flow targeting | No chat-side registry: `AgentChatService` injects `AngflowAgentBridge` and calls `bridge.callTool` directly, relying on the bridge's default-flow resolution | The bridge already owns flow registry/resolution; the chat adds no second registry. Hosts register flows with the bridge exactly as today. |
| Versioning | `@angflow/angular` minor bump | Additive feature surface (new provider, service, component). |

## Architecture

### Module layout

```
packages/angular/src/lib/agent/chat/
  types.ts                  # AgentChatRequest/Response, content blocks, CompleteFn,
                            # ChatMessage, ToolActivity, AgentChatConfig
  provide-agent-chat.ts     # provideAgentChat(config) → providers for AGENT_CHAT_CONFIG
  agent-chat.service.ts     # AgentChatService — the loop + signal state
  agent-chat.component.ts   # <ng-flow-agent-chat>
  default-system-prompt.ts  # DEFAULT_AGENT_CHAT_SYSTEM_PROMPT
  index.ts                  # barrel (re-exported via agent/index.ts → public-api)
examples/angular/
  server/agent-proxy.mjs    # reference proxy (committed example code, not a package)
  src/app/examples/agent-chat/agent-chat.component.ts   # example page
```

### Contracts (`types.ts`)

```ts
/** Content blocks — the Anthropic Messages subset the loop uses. */
export interface AgentChatTextBlock { type: 'text'; text: string; }
export interface AgentChatToolUseBlock { type: 'tool_use'; id: string; name: string; input: Record<string, unknown>; }
export interface AgentChatToolResultBlock { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean; }
export type AgentChatContentBlock = AgentChatTextBlock | AgentChatToolUseBlock | AgentChatToolResultBlock;

export interface AgentChatMessageParam { role: 'user' | 'assistant'; content: AgentChatContentBlock[]; }

/** Wire tool format (Anthropic uses snake_case input_schema). */
export interface AgentChatTool { name: string; description: string; input_schema: Record<string, unknown>; }

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
export type CompleteFn = (req: AgentChatRequest) => Promise<AgentChatResponse>;

/** UI-facing state. */
export interface ToolActivity { name: string; status: 'running' | 'ok' | 'error'; summary: string; }
export interface ChatMessage { id: number; role: 'user' | 'assistant'; text: string; activity: ToolActivity[]; }

export interface AgentChatConfig {
  complete: CompleteFn;
  systemPrompt?: string;     // default: DEFAULT_AGENT_CHAT_SYSTEM_PROMPT
  maxTurns?: number;         // default 12
  maxTokens?: number;        // default 2048
  maxHistory?: number;       // default 40 (AgentChatMessageParam entries)
}
```

### Loop (per `send(text)`)

1. Guard: no-op while `busy()`. Set `busy`, clear `error`.
2. Append user message to UI state and to the wire history.
3. Build `AgentChatRequest` — `tools` derived once from `AGENT_TOOL_SCHEMAS` (mapping `inputSchema` → `input_schema`), history trimmed to `maxHistory`.
4. `await complete(request)`.
5. For each content block in order: `text` → accumulate into the assistant message (signal write per block is fine); `tool_use` → push a `running` ToolActivity, `await bridge.callTool(name, input)`, mark `ok` with a short summary (or `error` with the thrown `[code] message`), append a `tool_result` block (stringified result, or `is_error: true` text).
6. Append the assistant turn (text + tool_use blocks) and a user turn (tool_result blocks) to wire history.
7. `stop_reason === 'tool_use'` and turn count < `maxTurns` and not stopped → loop to 4. Otherwise finish: clear `busy`.
8. `complete()` rejection anywhere → set `error` with the message, keep partial activity, clear `busy`. The conversation history excludes the failed assistant turn (retry = user sends again).
9. `maxTurns` exhausted → append assistant note "(stopped: too many tool rounds)".
10. `stop()` → flag; checked before each loop iteration and after each tool call; discard results of an in-flight `complete()` when it lands.

### `<ng-flow-agent-chat>`

Standalone, OnPush, zoneless (pure signal reads). Inputs: `title` (default "Canvas copilot"), `placeholder`. Renders: header; auto-scrolling message list (an `effect` watching message count sets `scrollTop` after render); per-assistant-message activity chips (`⏳ name` / `✓ name` / `✗ name`, with the summary as `title` tooltip); error banner bound to `error()`; textarea + send button (disabled while busy or empty); Stop button while busy. All text content via interpolation bindings; CSS custom properties `--ngf-chat-bg`, `--ngf-chat-accent`, etc., with sensible defaults in component styles.

### Default system prompt

Canvas-operations guidance shipped as an exported constant: the assistant operates a node-graph canvas through tools; prefer `layout_nodes` over hand-computed coordinates; use `register_node_template` + typed nodes for new visual kinds; inspect with `get_state` / `list_node_types` before large changes; all mutations are undoable via `undo`; keep responses brief because the user watches the canvas. Hosts override via `provideAgentChat({ systemPrompt })`.

### Reference proxy (`examples/angular/server/agent-proxy.mjs`)

Plain `node:http` server, port 8787 (env `PORT`): handles `OPTIONS` (CORS for dev origins) and `POST /api/agent` — parses JSON `{ system, messages, tools, max_tokens }`, calls `@anthropic-ai/sdk` `client.messages.create({ model: process.env.ANGFLOW_AGENT_MODEL ?? 'claude-sonnet-4-6', ...body })`, responds `{ content, stop_reason }`; non-2xx upstream → 502 with the message. Header comment block: production caveats (auth, rate limiting, server-side system prompt, never expose beyond localhost as-is). `@anthropic-ai/sdk` becomes a devDependency of the example app.

### Example page

New `agent-chat` example route: canvas (a starter graph) + `<ng-flow-agent-chat>` in a right-hand panel; `app.config` registers `provideAgentChat({ complete: fetch-to-localhost-8787 })`. A note panel shows the one-liner to start the proxy. Without the proxy, sending surfaces the error banner with that hint (the `complete` fn maps fetch failures to a helpful message).

## Error handling summary

| Failure | Behavior |
|---|---|
| Bridge tool throws (any code) | `tool_result` with `is_error: true`, text `[code] message`; chip ✗; loop continues |
| `complete()` rejects / non-OK proxy response | Turn aborts; `error` signal set with actionable text; `busy` cleared; history consistent for retry |
| `stop_reason: 'max_tokens'` | Treated as turn end; assistant text shown as-is |
| `maxTurns` exceeded | Loop stops; "(stopped: too many tool rounds)" appended |
| `send()` while busy | No-op |
| No flow registered with the bridge | The bridge's own error (`No flows are registered…`) flows through the tool-error path — visible in chips/results |

## Testing

Vitest + TestBed (analog plugin already configured):

1. **FakeComplete harness** — a scripted `CompleteFn` returning a queue of canned `AgentChatResponse`s; records received requests for assertions.
2. **Service tests** — text-only turn updates `messages`; multi-round tool loop (tool_use → spy on `bridge.callTool` → tool_result content fed to the next request); `inputSchema`→`input_schema` mapping present in requests; tool error → `is_error` result + loop continues + chip state; `complete` rejection → `error` set, busy cleared, retry works; `maxTurns` cap message; `stop()` discards in-flight results; `maxHistory` trimming; `send` while busy no-ops.
3. **Component tests** — user/assistant bubbles render; activity chips reflect `running/ok/error`; busy disables input and shows Stop; error banner; `<script>` in assistant text renders inert (text binding).
4. **Manual e2e (user-run)** — start the proxy with a real key, open the example, converse; verify live canvas mutation + undo while dragging nodes mid-conversation.

Proxy is example code — covered by the manual e2e, not unit tests.

## Documentation

- `AGENT_BRIDGE.md`: short "In-browser chat harness" section (after the MCP server section) pointing at the chat module + example; same-commit rule.
- Example page itself is the primary doc; `provideAgentChat` JSDoc covers the config.
- Root `CLAUDE.md` Agent Bridge section: note that the chat harness consumes `AGENT_TOOL_SCHEMAS` directly (no snapshot — in-process import), so no extra regeneration step.

## Versioning

`@angflow/angular` minor bump (with the sub-project-1 changes if published together). No `@angflow/system` or `@angflow/mcp` changes.
