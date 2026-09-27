import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ResourceUpdatedNotificationSchema, ResourceListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { installResources, flowResourceUri } from '../src/mcp-resources';

async function makePair(flows: string[]) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const server = new Server(
    { name: 'angflow-mcp-test', version: '0.0.0' },
    { capabilities: { resources: { subscribe: true, listChanged: true } } },
  );
  const resources = installResources(server, {
    callTool: async (name, args) => {
      calls.push({ name, args });
      return { tool: name, flowId: args['flowId'] };
    },
    flowIds: () => flows,
    throttleMs: 5,
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'c', version: '0' }, { capabilities: {} });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { client, resources, calls };
}

describe('flow resources', () => {
  it('lists a summary and a state resource per registered flow', async () => {
    const { client } = await makePair(['main', 'side']);
    const uris = (await client.listResources()).resources.map((r) => r.uri);
    expect(uris).toEqual([
      'angflow://flows/main/summary',
      'angflow://flows/main/state',
      'angflow://flows/side/summary',
      'angflow://flows/side/state',
    ]);
  });

  it('reads live from the canvas via get_summary / get_state', async () => {
    const { client, calls } = await makePair(['main']);
    const res = await client.readResource({ uri: flowResourceUri('main', 'summary') });
    expect(calls).toEqual([{ name: 'get_summary', args: { flowId: 'main' } }]);
    expect(JSON.parse(res.contents[0].text as string)).toEqual({ tool: 'get_summary', flowId: 'main' });
    await client.readResource({ uri: flowResourceUri('main', 'state') });
    expect(calls[1]).toEqual({ name: 'get_state', args: { flowId: 'main' } });
  });

  it('rejects unknown resource URIs', async () => {
    const { client } = await makePair(['main']);
    await expect(client.readResource({ uri: 'angflow://nope' })).rejects.toThrow();
  });

  it('notifies subscribers (throttled) on flow.state and everyone on list changes', async () => {
    const { client, resources } = await makePair(['main']);
    const updated: string[] = [];
    let listChanged = 0;
    client.setNotificationHandler(ResourceUpdatedNotificationSchema, (n) => {
      updated.push(n.params.uri);
    });
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      listChanged++;
    });
    await client.subscribeResource({ uri: flowResourceUri('main', 'summary') });

    resources.flowStateChanged('main');
    resources.flowStateChanged('main'); // coalesced
    resources.flowsChanged();
    await new Promise((r) => setTimeout(r, 30));

    expect(updated).toEqual(['angflow://flows/main/summary']);
    expect(listChanged).toBe(1);
    resources.dispose();
  });
});
