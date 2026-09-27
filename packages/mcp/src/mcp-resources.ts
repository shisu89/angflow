/**
 * Exposes every registered flow as MCP resources so clients can attach the
 * live graph as context (or subscribe to it) without spending a tool call:
 *
 *   angflow://flows/{flowId}/summary  → get_summary (compact digest)
 *   angflow://flows/{flowId}/state    → get_state   (full nodes/edges/viewport)
 *
 * Reads always go to the live canvas. `resources/list_changed` fires when a
 * flow registers/unregisters; subscribers get `resources/updated` (throttled)
 * whenever the canvas pushes flow.state — including edits the USER makes in
 * the UI, which is how an agent can notice them without polling.
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolFn } from './mcp-tools.js';

const URI = /^angflow:\/\/flows\/([^/]+)\/(summary|state)$/;
const KIND_TOOL = { summary: 'get_summary', state: 'get_state' } as const;

export function flowResourceUri(flowId: string, kind: 'summary' | 'state'): string {
  return `angflow://flows/${encodeURIComponent(flowId)}/${kind}`;
}

export interface FlowResources {
  /** Call after the set of registered flows changed. */
  flowsChanged(): void;
  /** Call on every flow.state push from the canvas. */
  flowStateChanged(flowId: string): void;
  /** Cancel pending throttled notifications. */
  dispose(): void;
}

/**
 * @param server Must be constructed with capabilities: { resources: { subscribe: true, listChanged: true } }.
 */
export function installResources(
  server: Server,
  deps: { callTool: CallToolFn; flowIds: () => string[]; throttleMs?: number },
): FlowResources {
  const throttleMs = deps.throttleMs ?? 500;
  const subscribed = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: deps.flowIds().flatMap((id) => [
      {
        uri: flowResourceUri(id, 'summary'),
        name: `${id} (summary)`,
        description: `Compact digest of flow "${id}": counts, groups, node titles, viewport, bounds.`,
        mimeType: 'application/json',
      },
      {
        uri: flowResourceUri(id, 'state'),
        name: `${id} (full state)`,
        description: `Full nodes, edges and viewport of flow "${id}". Large on big boards — prefer the summary.`,
        mimeType: 'application/json',
      },
    ]),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const m = URI.exec(req.params.uri);
    if (!m) throw new Error(`Unknown resource: ${req.params.uri}`);
    const flowId = decodeURIComponent(m[1]);
    const value = await deps.callTool(KIND_TOOL[m[2] as 'summary' | 'state'], { flowId });
    return {
      contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify(value) }],
    };
  });

  server.setRequestHandler(SubscribeRequestSchema, async (req) => {
    subscribed.add(req.params.uri);
    return {};
  });
  server.setRequestHandler(UnsubscribeRequestSchema, async (req) => {
    subscribed.delete(req.params.uri);
    return {};
  });

  // Notifications are best-effort: the MCP client may not be connected yet.
  const notify = (p: Promise<void>) => void p.catch(() => {});

  return {
    flowsChanged() {
      notify(server.sendResourceListChanged());
    },
    flowStateChanged(flowId) {
      for (const kind of ['summary', 'state'] as const) {
        const uri = flowResourceUri(flowId, kind);
        if (!subscribed.has(uri) || timers.has(uri)) continue;
        timers.set(
          uri,
          setTimeout(() => {
            timers.delete(uri);
            notify(server.sendResourceUpdated({ uri }));
          }, throttleMs),
        );
      }
    },
    dispose() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}
