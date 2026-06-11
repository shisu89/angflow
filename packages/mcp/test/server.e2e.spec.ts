import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAngflowMcpServer, type AngflowMcpServer } from '../src/server';
import { AGENT_TOOL_SCHEMAS } from '../src/generated/tool-schemas';
import { FakeCanvas } from './fake-canvas';

let running: AngflowMcpServer | null = null;
let canvas: FakeCanvas | null = null;

afterEach(async () => {
  canvas?.close();
  canvas = null;
  await running?.stop();
  running = null;
});

async function startAll() {
  running = createAngflowMcpServer({
    port: 0,
    host: '127.0.0.1',
    timeoutMs: 1000,
    logLevel: 'silent',
  });
  await running.start();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'e2e', version: '0.0.0' }, { capabilities: {} });
  await Promise.all([running.mcpServer.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function textOf(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  return r.content?.[0]?.text ?? '';
}

describe('angflow MCP server e2e (in-process)', () => {
  it('seeds canvas_status flows via list_flows on connect (no events needed)', async () => {
    const client = await startAll();
    // A reconnecting canvas re-dials without re-emitting flow.registered —
    // the server must seed the mirror itself.
    canvas = new FakeCanvas({ handlers: { list_flows: () => ['demo', 'second'] } });
    await canvas.connect(running!.wsUrl);
    await expect.poll(async () => {
      const s = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
      return s.flows;
    }).toEqual(['demo', 'second']);
  });

  it('lists all snapshot tools + canvas_status over a real MCP session', async () => {
    const client = await startAll();
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(AGENT_TOOL_SCHEMAS.length + 1);
  });

  it('canvas_status reflects no-canvas, then a connected canvas with flows', async () => {
    const client = await startAll();
    let status = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
    expect(status.connected).toBe(false);
    expect(status.flows).toEqual([]);

    canvas = new FakeCanvas();
    await canvas.connect(running!.wsUrl);
    canvas.emit('flow.registered', { flowId: 'demo' });
    await expect.poll(async () => {
      const s = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
      return s.flows.length;
    }).toBe(1);

    status = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
    expect(status.connected).toBe(true);
    expect(status.flows).toEqual(['demo']);
  });

  it('round-trips a tool call to the canvas and back', async () => {
    const client = await startAll();
    canvas = new FakeCanvas({
      handlers: { add_node: (params) => ({ created: params?.['node'] }) },
    });
    await canvas.connect(running!.wsUrl);
    await expect.poll(async () => {
      const s = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
      return s.connected;
    }).toBe(true);
    const result = await client.callTool({
      name: 'add_node',
      arguments: { node: { id: 'n1', position: { x: 0, y: 0 }, data: {} } },
    });
    expect(result.isError ?? false).toBe(false);
    expect(JSON.parse(textOf(result))).toEqual({ created: { id: 'n1', position: { x: 0, y: 0 }, data: {} } });
  });

  it('surfaces no-canvas failures as isError with guidance', async () => {
    const client = await startAll();
    const result = await client.callTool({ name: 'get_state', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No canvas connected');
  });

  it('passes auth options through to the canvas socket', async () => {
    running = createAngflowMcpServer({
      port: 0,
      host: '127.0.0.1',
      token: 'sekret',
      tokenOptionalForAllowedOrigins: true,
      allowedOrigins: ['https://app.example.com'],
      timeoutMs: 1000,
      logLevel: 'silent',
    });
    await running.start();

    const noToken = new FakeCanvas();
    await noToken.connect(running.wsUrl);
    expect(await noToken.waitForClose()).toBe(4401);

    const trustedOrigin = new FakeCanvas({ handlers: { list_flows: () => [] } });
    await trustedOrigin.connect(running.wsUrl, { origin: 'https://app.example.com' });
    canvas = trustedOrigin;
    await expect.poll(() => trustedOrigin.received.length).toBeGreaterThan(0);
  });

  it('clears flows from canvas_status after the canvas disconnects', async () => {
    const client = await startAll();
    canvas = new FakeCanvas();
    await canvas.connect(running!.wsUrl);
    canvas.emit('flow.registered', { flowId: 'demo' });
    await expect.poll(async () => {
      const s = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
      return s.flows.length;
    }).toBe(1);
    canvas.close();
    await expect.poll(async () => {
      const s = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
      return s.connected;
    }).toBe(false);
    const status = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
    expect(status.connected).toBe(false);
    expect(status.flows).toEqual([]);
  });
});
