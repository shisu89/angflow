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
