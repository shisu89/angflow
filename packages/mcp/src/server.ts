/**
 * Composition root: wires CanvasSocket + SessionMirror + MCP tool handlers
 * into one runnable server. The MCP transport (stdio in production,
 * in-memory in tests) is connected by the caller.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createRequire } from 'node:module';
import { CanvasSocket } from './canvas-socket.js';
import { createLogger, type LogLevel } from './log.js';
import { installTools } from './mcp-tools.js';
import { installResources, type FlowResources } from './mcp-resources.js';
import { SessionMirror } from './session.js';
import { AGENT_TOOL_SCHEMAS, GENERATED_FROM_ANGULAR_VERSION } from './generated/tool-schemas.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export interface AngflowMcpServerOptions {
  port: number;
  host: string;
  token?: string;
  /** See CanvasSocketOptions.tokenOptionalForAllowedOrigins. */
  tokenOptionalForAllowedOrigins?: boolean;
  /** See CanvasSocketOptions.allowedOrigins. */
  allowedOrigins?: string[];
  timeoutMs: number;
  logLevel: LogLevel;
}

export interface AngflowMcpServer {
  mcpServer: Server;
  wsUrl: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const VERSION = pkg.version;
export const SCHEMAS_FROM = GENERATED_FROM_ANGULAR_VERSION;

export function createAngflowMcpServer(options: AngflowMcpServerOptions): AngflowMcpServer {
  const log = createLogger(options.logLevel);
  // Assigned below once the MCP server exists; the mirror only fires on events.
  let resources: FlowResources | null = null;
  const session = new SessionMirror(() => resources?.flowsChanged());

  const canvasSocket = new CanvasSocket({
    port: options.port,
    host: options.host,
    token: options.token,
    tokenOptionalForAllowedOrigins: options.tokenOptionalForAllowedOrigins,
    allowedOrigins: options.allowedOrigins,
    timeoutMs: options.timeoutMs,
    log,
    onEvent: (event, params) => {
      session.handleConnect();
      session.handleEvent(event, params);
      const flowId = params?.['flowId'];
      if (event === 'flow.state' && typeof flowId === 'string') resources?.flowStateChanged(flowId);
    },
    onConnect: () => {
      session.handleConnect();
      // A reconnecting canvas does not re-emit flow.registered (registration
      // happened at page init, possibly against a previous server instance).
      // Seed the mirror from the bridge's own registry so canvas_status is
      // accurate immediately. Races with live events are harmless: the
      // mirror's flow.registered handling is idempotent.
      void canvasSocket
        .call('list_flows', {})
        .then((ids) => {
          if (!Array.isArray(ids)) return;
          for (const id of ids) {
            if (typeof id === 'string') session.handleEvent('flow.registered', { flowId: id });
          }
        })
        .catch((err) => log.debug('list_flows seed failed:', err));
    },
    onDisconnect: () => session.handleDisconnect(),
  });

  const mcpServer = new Server(
    { name: 'angflow-mcp', version: pkg.version },
    { capabilities: { tools: {}, resources: { subscribe: true, listChanged: true } } },
  );

  resources = installResources(mcpServer, {
    callTool: (name, args) => canvasSocket.call(name, args),
    flowIds: () => session.flowIds(),
  });

  installTools(mcpServer, AGENT_TOOL_SCHEMAS, {
    callTool: (name, args) => canvasSocket.call(name, args),
    status: () => ({
      connected: canvasSocket.isConnected(),
      flows: session.flowIds(),
      port: canvasSocket.port,
      host: canvasSocket.host,
    }),
  });

  return {
    mcpServer,
    get wsUrl() {
      return canvasSocket.url;
    },
    async start() {
      await canvasSocket.start();
    },
    async stop() {
      resources?.dispose();
      await canvasSocket.stop();
      try {
        await mcpServer.close();
      } catch {
        // transport may already be closed during teardown
      }
    },
  };
}
