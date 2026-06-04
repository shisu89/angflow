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
