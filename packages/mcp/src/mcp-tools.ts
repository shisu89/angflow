/**
 * Registers the snapshot tool catalog (plus the server-local canvas_status)
 * on a low-level MCP Server. We use the low-level API because our tool
 * schemas are plain JSON Schema; the high-level McpServer.tool() API expects
 * zod shapes. Knows nothing about WebSockets — calls go through the injected
 * CallToolFn.
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { AgentToolSchema } from './generated/tool-schemas.js';
import {
  BridgeToolError,
  NoCanvasError,
  CanvasTimeoutError,
  CanvasDisconnectedError,
} from './canvas-socket.js';

export type CallToolFn = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface CanvasStatusInfo {
  connected: boolean;
  flows: string[];
  port: number;
  host: string;
}

export type StatusFn = () => CanvasStatusInfo;

export interface InstallToolsDeps {
  callTool: CallToolFn;
  status: StatusFn;
}

const CANVAS_STATUS_TOOL = {
  name: 'canvas_status',
  description:
    'Report whether an angflow canvas is currently connected to this MCP server, ' +
    'which flow ids it has registered, and the WebSocket host/port the server listens on. ' +
    'Call this first when other angflow tools fail.',
  inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
};

function ok(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function fail(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

/** Map a thrown error to the MCP isError text contract. */
export function formatToolError(err: unknown): string {
  if (err instanceof BridgeToolError) {
    const data = err.data !== undefined ? ` data: ${JSON.stringify(err.data)}` : '';
    return `[${err.code}] ${err.message}${data}`;
  }
  if (err instanceof NoCanvasError) {
    return (
      `No canvas connected. Open your angflow app with a WebSocketTransport pointed at ` +
      `${err.url} — e.g. provideAgentBridge({ transports: [new WebSocketTransport({ url: '${err.url}' })] }). ` +
      `See the @angflow/mcp README.`
    );
  }
  if (err instanceof CanvasDisconnectedError) {
    return `${err.message} — call get_state after the canvas reconnects.`;
  }
  if (err instanceof CanvasTimeoutError) {
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * @param server Must be constructed with capabilities: { tools: {} } — the SDK
 *   rejects the request-handler registrations otherwise.
 */
export function installTools(server: Server, schemas: AgentToolSchema[], deps: InstallToolsDeps): void {
  const known = new Set(schemas.map((s) => s.name));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...schemas.map((s) => ({
        name: s.name,
        description: s.description,
        inputSchema: s.inputSchema,
      })),
      CANVAS_STATUS_TOOL,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    if (name === CANVAS_STATUS_TOOL.name) {
      return ok(deps.status());
    }
    if (!known.has(name)) {
      return fail(`Unknown tool: ${name}`);
    }
    try {
      const result = await deps.callTool(name, args);
      return ok(result ?? null);
    } catch (err) {
      return fail(formatToolError(err));
    }
  });
}
