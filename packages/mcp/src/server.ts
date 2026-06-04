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
import { SessionMirror } from './session.js';
import { AGENT_TOOL_SCHEMAS, GENERATED_FROM_ANGULAR_VERSION } from './generated/tool-schemas.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export interface AngflowMcpServerOptions {
  port: number;
  host: string;
  token?: string;
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
  const session = new SessionMirror();

  const canvasSocket = new CanvasSocket({
    port: options.port,
    host: options.host,
    token: options.token,
    timeoutMs: options.timeoutMs,
    log,
    onEvent: (event, params) => {
      session.handleConnect();
      session.handleEvent(event, params);
    },
    onDisconnect: () => session.handleDisconnect(),
  });

  const mcpServer = new Server(
    { name: 'angflow-mcp', version: pkg.version },
    { capabilities: { tools: {} } },
  );

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
      await canvasSocket.stop();
      try {
        await mcpServer.close();
      } catch {
        // transport may already be closed during teardown
      }
    },
  };
}
