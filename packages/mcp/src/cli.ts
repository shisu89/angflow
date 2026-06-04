#!/usr/bin/env node
/**
 * CLI entry point: parse flags/env, start the WS listener, attach the stdio
 * MCP transport. All logging goes to stderr (stdout is the protocol).
 */
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAngflowMcpServer, SCHEMAS_FROM, VERSION } from './server.js';
import type { LogLevel } from './log.js';

function envOr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: envOr('ANGFLOW_MCP_PORT', '8765') },
    host: { type: 'string', default: envOr('ANGFLOW_MCP_HOST', '127.0.0.1') },
    token: { type: 'string', default: process.env['ANGFLOW_MCP_TOKEN'] },
    timeout: { type: 'string', default: envOr('ANGFLOW_MCP_TIMEOUT', '30000') },
    'log-level': { type: 'string', default: envOr('ANGFLOW_MCP_LOG_LEVEL', 'info') },
    version: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  // eslint-disable-next-line no-console
  console.error(`angflow-mcp — MCP server for a live angflow canvas

Usage: npx @angflow/mcp [options]

Options:
  --port <n>        WebSocket port the canvas dials (default 8765, env ANGFLOW_MCP_PORT)
  --host <addr>     Bind address (default 127.0.0.1, env ANGFLOW_MCP_HOST)
  --token <secret>  Require ?token=<secret> on canvas connections (env ANGFLOW_MCP_TOKEN)
  --timeout <ms>    Per-request canvas timeout (default 30000, env ANGFLOW_MCP_TIMEOUT)
  --log-level <l>   debug | info | silent (default info, env ANGFLOW_MCP_LOG_LEVEL)
  --version         Print version info and exit
  --help            This help`);
  process.exit(0);
}

if (values.version) {
  // eslint-disable-next-line no-console
  console.error(`@angflow/mcp ${VERSION} (tool schemas from @angflow/angular@${SCHEMAS_FROM})`);
  process.exit(0);
}

const port = Number(values.port);
const timeoutMs = Number(values.timeout);
const logLevel = values['log-level'] as LogLevel;
if (String(values.port).trim() === '' || !Number.isInteger(port) || port < 0 || port > 65535) {
  // eslint-disable-next-line no-console
  console.error(`[angflow-mcp] invalid --port: ${values.port}`);
  process.exit(1);
}
if (String(values.timeout).trim() === '' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  // eslint-disable-next-line no-console
  console.error(`[angflow-mcp] invalid --timeout: ${values.timeout}`);
  process.exit(1);
}
if (!['debug', 'info', 'silent'].includes(logLevel)) {
  // eslint-disable-next-line no-console
  console.error(`[angflow-mcp] invalid --log-level: ${String(values['log-level'])}`);
  process.exit(1);
}

const server = createAngflowMcpServer({
  port,
  host: values.host!,
  token: values.token,
  timeoutMs,
  logLevel,
});

async function shutdown(): Promise<void> {
  await server.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await server.start();
await server.mcpServer.connect(new StdioServerTransport());
