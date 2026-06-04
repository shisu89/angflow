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
          if (this.stopped) {
            // Synthesize cancelled results for all not-yet-executed tool_uses
            // so history never ends with a dangling assistant tool_use block.
            // Anthropic rejects any request where a tool_use has no matching
            // tool_result in the immediately following user turn.
            for (let j = i + 1; j < toolUses.length; j++) {
              results.push({
                type: 'tool_result',
                tool_use_id: toolUses[j].id,
                content: '[cancelled] the user stopped this turn',
                is_error: true,
              });
            }
            this.history.push({ role: 'user', content: results });
            return;
          }
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
    if (this.history.length <= this.config.maxHistory) {
      return this.history;
    }

    let trimmed = this.history.slice(this.history.length - this.config.maxHistory);
    // Anthropic requires the first message to be a user turn — and a
    // leading tool_result-only user turn is as confusing as an assistant
    // turn, so drop until we reach a plain user text message.
    while (
      trimmed.length > 0 &&
      !(trimmed[0].role === 'user' && trimmed[0].content.some((b) => b.type === 'text'))
    ) {
      trimmed = trimmed.slice(1);
    }

    if (trimmed.length === 0) {
      // The repair loop emptied the slice — this happens when maxHistory is
      // small and the tail lands entirely within a multi-round tool turn
      // (assistant tool_use + user tool_result, no plain text leader).
      // Protocol validity beats the soft cap: fall back to the most recent
      // plain user-text boundary in the FULL history so that all tool_use /
      // tool_result pairs of the current round are intact.
      // Note: this may yield slightly more than maxHistory entries — that is
      // the correct trade-off.
      let fallbackIndex = -1;
      for (let i = this.history.length - 1; i >= 0; i--) {
        const m = this.history[i];
        if (m.role === 'user' && m.content.some((b) => b.type === 'text')) {
          fallbackIndex = i;
          break;
        }
      }
      trimmed = fallbackIndex >= 0 ? this.history.slice(fallbackIndex) : this.history;
    }

    // Only collapse history when the trimmed result is valid (non-empty,
    // user-text leader). This avoids destructively assigning [] when the
    // repair fails, which would corrupt subsequent sends.
    if (trimmed.length > 0 && trimmed[0].role === 'user') {
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
