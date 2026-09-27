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

/**
 * MCP tool annotations (hints for clients, e.g. auto-approving read-only calls
 * and confirming destructive ones). Derived from the tool name so newly added
 * bridge tools get sensible defaults: get_/list_ reads are read-only.
 */
const READ_ONLY_EXTRA = new Set([
  'is_node_in_area',
  'screen_to_flow_position',
  'flow_to_screen_position',
  'history_status',
]);
const DESTRUCTIVE = new Set([
  'delete_elements',
  'set_nodes',
  'set_edges',
  'apply_changes',
  'dissolve_group',
  'undo',
  'redo',
  'clear_history',
  'unregister_node_template',
]);
// UI-state tools: they change what's selected/visible but never graph content,
// and repeating them with the same arguments has no additional effect.
const IDEMPOTENT_UI = /^(fit_view|fit_bounds|set_viewport|zoom_to|set_center|select_nodes|select_edges|deselect_all|set_group_collapsed)$/;

export function toolAnnotations(name: string): {
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint: boolean;
} {
  const readOnly =
    name === 'canvas_status' || /^(get_|list_)/.test(name) || READ_ONLY_EXTRA.has(name);
  if (readOnly) return { readOnlyHint: true, openWorldHint: false };
  return {
    readOnlyHint: false,
    destructiveHint: DESTRUCTIVE.has(name),
    idempotentHint: IDEMPOTENT_UI.test(name),
    openWorldHint: false,
  };
}

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
        annotations: toolAnnotations(s.name),
      })),
      { ...CANVAS_STATUS_TOOL, annotations: toolAnnotations(CANVAS_STATUS_TOOL.name) },
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
