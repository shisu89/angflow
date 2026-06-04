import { describe, it, expect } from 'vitest';
import { toAgentChatTools } from './types';
import { AGENT_TOOL_SCHEMAS } from '../tool-schemas';
import { DEFAULT_AGENT_CHAT_SYSTEM_PROMPT } from './default-system-prompt';

describe('toAgentChatTools', () => {
  it('maps every catalog entry to the Anthropic wire format', () => {
    const tools = toAgentChatTools(AGENT_TOOL_SCHEMAS);
    expect(tools).toHaveLength(AGENT_TOOL_SCHEMAS.length);
    const addNode = tools.find((t) => t.name === 'add_node')!;
    const source = AGENT_TOOL_SCHEMAS.find((s) => s.name === 'add_node')!;
    expect(addNode.description).toBe(source.description);
    // Anthropic uses snake_case input_schema; the catalog uses inputSchema.
    expect(addNode.input_schema).toEqual(source.inputSchema);
    expect((addNode as unknown as Record<string, unknown>)['inputSchema']).toBeUndefined();
  });

  it('does not mutate the source schemas', () => {
    const before = JSON.stringify(AGENT_TOOL_SCHEMAS);
    toAgentChatTools(AGENT_TOOL_SCHEMAS);
    expect(JSON.stringify(AGENT_TOOL_SCHEMAS)).toBe(before);
  });
});

describe('DEFAULT_AGENT_CHAT_SYSTEM_PROMPT', () => {
  it('mentions the key canvas-operation guidance', () => {
    for (const phrase of ['layout_nodes', 'register_node_template', 'get_state', 'undo']) {
      expect(DEFAULT_AGENT_CHAT_SYSTEM_PROMPT).toContain(phrase);
    }
  });
});
