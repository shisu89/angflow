import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { installTools, formatToolError, type CallToolFn, type StatusFn } from '../src/mcp-tools';
import { AGENT_TOOL_SCHEMAS } from '../src/generated/tool-schemas';
import {
  BridgeToolError,
  NoCanvasError,
  CanvasTimeoutError,
  CanvasDisconnectedError,
} from '../src/canvas-socket';

async function makePair(callTool: CallToolFn, status?: StatusFn) {
  const server = new Server(
    { name: 'angflow-mcp-test', version: '0.0.0' },
    { capabilities: { tools: {} } },
  );
  installTools(server, AGENT_TOOL_SCHEMAS, {
    callTool,
    status: status ?? (() => ({ connected: true, flows: ['demo'], port: 8765, host: '127.0.0.1' })),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

// The SDK's callTool return type is a union of {content: ...} | {toolResult: unknown}.
// Cast to a simpler shape so we can extract the first text content item.
function textOf(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  return r.content?.[0]?.text ?? '';
}

describe('installTools', () => {
  it('lists every snapshot tool plus canvas_status', async () => {
    const { client } = await makePair(async () => null);
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(AGENT_TOOL_SCHEMAS.length + 1);
    const names = tools.tools.map((t) => t.name);
    expect(names).toContain('add_node');
    expect(names).toContain('layout_nodes');
    expect(names).toContain('canvas_status');
  });

  it('passes the schema through verbatim', async () => {
    const { client } = await makePair(async () => null);
    const tools = await client.listTools();
    const addNode = tools.tools.find((t) => t.name === 'add_node')!;
    const source = AGENT_TOOL_SCHEMAS.find((s) => s.name === 'add_node')!;
    expect(addNode.description).toBe(source.description);
    expect(addNode.inputSchema).toEqual(source.inputSchema);
  });

  it('proxies a call and returns the JSON-stringified result', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const { client } = await makePair(async (name, args) => {
      calls.push({ name, args });
      return { ok: true };
    });
    const result = await client.callTool({ name: 'get_state', arguments: { flowId: 'demo' } });
    expect(calls).toEqual([{ name: 'get_state', args: { flowId: 'demo' } }]);
    expect(result.isError ?? false).toBe(false);
    expect(JSON.parse(textOf(result))).toEqual({ ok: true });
  });

  it('stringifies null results as "null"', async () => {
    const { client } = await makePair(async () => null);
    const result = await client.callTool({ name: 'deselect_all', arguments: {} });
    expect(textOf(result)).toBe('null');
  });

  it('canvas_status returns the status object without touching callTool', async () => {
    let called = false;
    const { client } = await makePair(
      async () => {
        called = true;
        return null;
      },
      () => ({ connected: false, flows: [], port: 9999, host: '127.0.0.1' }),
    );
    const result = await client.callTool({ name: 'canvas_status', arguments: {} });
    expect(called).toBe(false);
    expect(JSON.parse(textOf(result))).toEqual({ connected: false, flows: [], port: 9999, host: '127.0.0.1' });
  });

  it('maps BridgeToolError to isError with [code] message and data', async () => {
    const { client } = await makePair(async () => {
      throw new BridgeToolError(-32603, 'boom', { failedIndex: 2 });
    });
    const result = await client.callTool({ name: 'apply_changes', arguments: { ops: [] } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('[-32603] boom data: {"failedIndex":2}');
  });

  it('maps NoCanvasError to actionable guidance', async () => {
    const { client } = await makePair(async () => {
      throw new NoCanvasError('ws://127.0.0.1:8765');
    });
    const result = await client.callTool({ name: 'get_state', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No canvas connected');
    expect(textOf(result)).toContain('ws://127.0.0.1:8765');
    expect(textOf(result)).toContain('WebSocketTransport');
  });

  it('maps CanvasTimeoutError naming the tool and timeout', async () => {
    const { client } = await makePair(async () => {
      throw new CanvasTimeoutError('get_state', 30000);
    });
    const result = await client.callTool({ name: 'get_state', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('get_state');
    expect(textOf(result)).toContain('30000');
  });

  it('maps CanvasDisconnectedError advising get_state after reconnect', async () => {
    const { client } = await makePair(async () => {
      throw new CanvasDisconnectedError('add_node');
    });
    const result = await client.callTool({ name: 'add_node', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('effect is unknown');
    expect(textOf(result)).toContain('get_state');
  });

  it('rejects names outside the snapshot with isError', async () => {
    const { client } = await makePair(async () => null);
    const result = await client.callTool({ name: 'not_a_tool', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unknown tool');
  });
});

describe('formatToolError', () => {
  it('formats BridgeToolError with code and data', () => {
    expect(formatToolError(new BridgeToolError(-32602, 'bad param', { field: 'x' }))).toBe(
      '[-32602] bad param data: {"field":"x"}',
    );
  });

  it('formats BridgeToolError without data', () => {
    expect(formatToolError(new BridgeToolError(-32601, 'unknown'))).toBe('[-32601] unknown');
  });

  it('formats NoCanvasError with wiring guidance', () => {
    const text = formatToolError(new NoCanvasError('ws://127.0.0.1:9999'));
    expect(text).toContain('ws://127.0.0.1:9999');
    expect(text).toContain('WebSocketTransport');
  });

  it('formats CanvasTimeoutError with tool and timeout', () => {
    const text = formatToolError(new CanvasTimeoutError('fit_view', 5000));
    expect(text).toContain('fit_view');
    expect(text).toContain('5000');
  });

  it('formats CanvasDisconnectedError exactly once with the get_state advice', () => {
    const text = formatToolError(new CanvasDisconnectedError('add_node'));
    expect(text).toContain('add_node');
    expect(text).toContain('call get_state');
    expect(text.match(/effect is unknown/gi)?.length).toBe(1);
  });

  it('falls back to the message for unknown errors', () => {
    expect(formatToolError(new Error('surprise'))).toBe('surprise');
    expect(formatToolError('raw string')).toBe('raw string');
  });
});
