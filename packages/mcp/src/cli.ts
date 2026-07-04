#!/usr/bin/env node
/**
 * CLI entry point: parse flags/env, start the WS listener, attach the stdio
 * MCP transport. All logging goes to stderr (stdout is the protocol).
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_ALLOWED_ORIGINS } from './canvas-socket.js';
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
    'no-token': { type: 'boolean', default: false },
    'allow-origin': { type: 'string', default: envOr('ANGFLOW_MCP_ALLOW_ORIGIN', '') },
    timeout: { type: 'string', default: envOr('ANGFLOW_MCP_TIMEOUT', '30000') },
    'log-level': { type: 'string', default: envOr('ANGFLOW_MCP_LOG_LEVEL', 'info') },
    version: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.error(`angflow-mcp — MCP server for a live angflow canvas

Usage: npx @angflow/mcp [options]

Options:
  --port <n>        WebSocket port the canvas dials (default 8765, env ANGFLOW_MCP_PORT)
  --host <addr>     Bind address (default 127.0.0.1, env ANGFLOW_MCP_HOST)
  --token <secret>     Require this token on canvas connections (env ANGFLOW_MCP_TOKEN).
                       Omitted: an ephemeral token is generated and printed to stderr;
                       browser canvases from allowlisted origins may omit it.
  --no-token           Disable token auth entirely (explicit opt-out)
  --allow-origin <csv> Comma-separated Origin allowlist for browser connections;
                       supports a trailing :* port wildcard. Default: localhost dev
                       origins (env ANGFLOW_MCP_ALLOW_ORIGIN)
  --timeout <ms>    Per-request canvas timeout (default 30000, env ANGFLOW_MCP_TIMEOUT)
  --log-level <l>   debug | info | silent (default info, env ANGFLOW_MCP_LOG_LEVEL)
  --version         Print version info and exit
  --help            This help`);
  process.exit(0);
}

if (values.version) {
  console.error(`@angflow/mcp ${VERSION} (tool schemas from @angflow/angular@${SCHEMAS_FROM})`);
  process.exit(0);
}

const port = Number(values.port);
const timeoutMs = Number(values.timeout);
const logLevel = values['log-level'] as LogLevel;
if (String(values.port).trim() === '' || !Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`[angflow-mcp] invalid --port: ${values.port}`);
  process.exit(1);
}
if (String(values.timeout).trim() === '' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error(`[angflow-mcp] invalid --timeout: ${values.timeout}`);
  process.exit(1);
}
if (!['debug', 'info', 'silent'].includes(logLevel)) {
  console.error(`[angflow-mcp] invalid --log-level: ${String(values['log-level'])}`);
  process.exit(1);
}

// Only treat --token + --no-token as a conflict when --token was explicitly passed
// on the command line. If the token value came only from ANGFLOW_MCP_TOKEN and the
// user passed --no-token, let --no-token win (clear the env token silently).
const tokenOnCli = process.argv.includes('--token');
if (values['no-token'] && values.token) {
  if (tokenOnCli) {
    console.error('[angflow-mcp] --token and --no-token are mutually exclusive');
    process.exit(1);
  }
  // Env-only token: --no-token takes precedence; clear it so the block below doesn't use it.
  values.token = undefined;
}

let token: string | undefined = values.token;
let ephemeralToken = false;
if (values['no-token']) {
  token = undefined;
} else if (!token) {
  token = randomBytes(16).toString('hex');
  ephemeralToken = true;
}

const allowedOrigins =
  String(values['allow-origin']).trim() === ''
    ? DEFAULT_ALLOWED_ORIGINS
    : String(values['allow-origin'])
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

const server = createAngflowMcpServer({
  port,
  host: values.host!,
  token,
  tokenOptionalForAllowedOrigins: ephemeralToken,
  allowedOrigins,
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
if (ephemeralToken && logLevel !== 'silent') {
  console.error(
    `[angflow-mcp] no --token provided — generated an ephemeral canvas token: ${token}\n` +
      `[angflow-mcp] browser canvases from allowlisted origins (${allowedOrigins.join(', ')}) connect without it.\n` +
      `[angflow-mcp] SECURITY: in this mode any local page from an allowlisted origin can connect and\n` +
      `[angflow-mcp]   EVICT the active canvas (single-canvas policy), then answer the agent's tool calls\n` +
      `[angflow-mcp]   itself or cause a repeated-disconnect DoS. Pass --token <secret> and configure the\n` +
      `[angflow-mcp]   canvas to present it when other local apps share this machine.\n` +
      `[angflow-mcp] non-browser clients must present it (subprotocol "angflow.token.<token>" or ?token=<token>).\n` +
      `[angflow-mcp] pass --token <secret> to pin a token, or --no-token to disable token auth.`,
  );
}
await server.mcpServer.connect(new StdioServerTransport());
