# @angflow/mcp Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@angflow/mcp` — a Node MCP server (stdio) that proxies the full angflow bridge tool catalog to MCP clients over a WebSocket the browser canvas dials into, per the spec at `docs/superpowers/specs/2026-06-04-angflow-mcp-server-design.md`.

**Architecture:** Four small units composed in `server.ts`: `CanvasSocket` (WS server, single-active-connection policy, request correlation — knows nothing of MCP), `mcp-tools` (registers snapshot tools + `canvas_status` on the low-level MCP SDK `Server` — knows nothing of WebSockets), `SessionMirror` (event-fed flow/state mirror), and `cli.ts` (flags/env, stdio transport, signals). Tool schemas come from a committed build-time snapshot generated from the workspace's angular source, guarded by a drift test.

**Tech Stack:** TypeScript (NodeNext ESM, plain `tsc`), `@modelcontextprotocol/sdk` (low-level `Server` API — our schemas are JSON Schema, not zod, so we do NOT use the high-level `McpServer.tool()` API), `ws`, `tsx` (generation script), vitest (node environment).

**SDK caveat for the executor:** the import paths and request-schema names below (`Server` from `@modelcontextprotocol/sdk/server/index.js`, `StdioServerTransport` from `.../server/stdio.js`, `ListToolsRequestSchema`/`CallToolRequestSchema` from `.../types.js`, `InMemoryTransport` from `.../inMemory.js`, `Client` from `.../client/index.js`) match SDK 1.x. After installing, verify against `node_modules/@modelcontextprotocol/sdk/dist` and adapt minimally if the installed version differs — report any such deviation.

**Module-system rule:** this package emits ESM that plain `node` executes directly. `package.json` has `"type": "module"`, tsconfig uses `module: "nodenext"` / `moduleResolution: "nodenext"`, and **every relative import in `src/` must carry a `.js` extension** (`import { CanvasSocket } from './canvas-socket.js'`). Test files under `test/` are run by vitest and import from `../src/*.ts` WITHOUT extension (vitest resolves TS directly) — yes, the two worlds differ; follow the code blocks exactly.

**Repo rules:** logs to **stderr only** (stdout is the MCP protocol channel). `AGENT_BRIDGE.md` updates ride in the same commit as the change that warrants them (Task 7). Zero diffs under `packages/system/` and zero behavior changes under `packages/angular/`.

**Key commands** (from `packages/mcp/` unless noted):
- Tests: `npx vitest run` (one file: `npx vitest run test/canvas-socket.spec.ts`)
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`
- Workspace install (repo root, pnpm 11): `$env:CI='true'; pnpm install` (PowerShell) / `CI=true pnpm install` (bash)

---

## Pre-flight

`git status --porcelain` must be clean apart from the two known untracked PNGs at repo root (`01-overview.png`, `custom-node-broken.png`) — leave those alone.

---

### Task 1: Package scaffold

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/vitest.config.ts`
- Create: `packages/mcp/src/log.ts`
- Test: `packages/mcp/test/log.spec.ts`

- [ ] **Step 1: Register the workspace package**

In `pnpm-workspace.yaml`, add `'packages/mcp'` to the `packages:` list (after `'packages/angular'`).

- [ ] **Step 2: Create `packages/mcp/package.json`**

```json
{
  "name": "@angflow/mcp",
  "version": "0.0.1",
  "type": "module",
  "description": "MCP server that exposes a live angflow canvas to AI agents (Claude Code, Claude Desktop, Cursor) over the agent-bridge WebSocket transport.",
  "keywords": ["mcp", "model-context-protocol", "angflow", "agent", "diagram"],
  "repository": {
    "type": "git",
    "url": "https://github.com/angflow/angflow.git",
    "directory": "packages/mcp"
  },
  "license": "MIT",
  "bin": {
    "angflow-mcp": "dist/cli.js"
  },
  "main": "dist/server.js",
  "types": "dist/server.d.ts",
  "files": ["dist", "README.md"],
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "generate:schemas": "tsx scripts/generate-schemas.ts",
    "build": "tsx scripts/generate-schemas.ts && tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@angflow/tsconfig": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "5.9.3",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 3: Create `packages/mcp/tsconfig.json`**

```json
{
  "display": "@angflow/mcp",
  "extends": "@angflow/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2022",
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create `packages/mcp/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
```

- [ ] **Step 5: Install**

From the repo root:

```bash
CI=true pnpm install
```

Expected: lockfile updated, `packages/mcp/node_modules` linked, no errors. (PowerShell: `$env:CI='true'; pnpm install`.)

- [ ] **Step 6: Write the failing smoke test**

Create `packages/mcp/test/log.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from '../src/log';

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes to stderr, never stdout', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger('info');
    log.info('hello');
    log.warn('careful');
    expect(err).toHaveBeenCalledTimes(2);
    expect(out).not.toHaveBeenCalled();
  });

  it('filters below the configured level', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('info');
    log.debug('noise');
    expect(err).not.toHaveBeenCalled();
  });

  it('silent level suppresses everything', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('silent');
    log.info('x');
    log.warn('x');
    log.debug('x');
    expect(err).not.toHaveBeenCalled();
  });

  it('prefixes messages with [angflow-mcp] and the level', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('debug');
    log.debug('details');
    expect(err).toHaveBeenCalledWith('[angflow-mcp]', 'debug:', 'details');
  });
});
```

- [ ] **Step 7: Run to verify failure**

Run (from `packages/mcp/`): `npx vitest run test/log.spec.ts`
Expected: FAIL — cannot resolve `../src/log`.

- [ ] **Step 8: Implement `packages/mcp/src/log.ts`**

```ts
/**
 * Minimal stderr logger. stdout belongs to the stdio MCP protocol — writing
 * anything else there corrupts the framing — so every log path goes through
 * console.error.
 */

export type LogLevel = 'debug' | 'info' | 'silent';

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, silent: 99 };

export function createLogger(level: LogLevel): Logger {
  const rank = LEVEL_RANK[level];
  const emit = (label: string, labelRank: number, args: unknown[]): void => {
    if (labelRank < rank || rank === 99) return;
    // eslint-disable-next-line no-console
    console.error('[angflow-mcp]', `${label}:`, ...args);
  };
  return {
    debug: (...args) => emit('debug', 0, args),
    info: (...args) => emit('info', 1, args),
    warn: (...args) => emit('warn', 1, args),
  };
}
```

- [ ] **Step 9: Run to verify pass + typecheck**

Run: `npx vitest run test/log.spec.ts` → PASS.
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 10: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/mcp
git commit -m "feat(mcp): scaffold @angflow/mcp workspace package

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Schema snapshot pipeline + drift test

**Files:**
- Create: `packages/mcp/scripts/generate-schemas.ts`
- Create: `packages/mcp/src/generated/tool-schemas.ts` (generated, committed)
- Test: `packages/mcp/test/schema-snapshot.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/mcp/test/schema-snapshot.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AGENT_TOOL_SCHEMAS, GENERATED_FROM_ANGULAR_VERSION } from '../src/generated/tool-schemas';
// Workspace source of truth — dependency-free file inside the angular package.
import { AGENT_TOOL_SCHEMAS as SOURCE_SCHEMAS } from '../../angular/src/lib/agent/tool-schemas';

describe('generated schema snapshot', () => {
  it('matches the workspace source exactly (run `npm run generate:schemas` if this fails)', () => {
    expect(AGENT_TOOL_SCHEMAS).toEqual(SOURCE_SCHEMAS);
  });

  it('is stamped with the angular package version it was generated from', () => {
    expect(GENERATED_FROM_ANGULAR_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('every entry is a structurally valid tool definition', () => {
    expect(AGENT_TOOL_SCHEMAS.length).toBeGreaterThanOrEqual(51);
    const names = new Set<string>();
    for (const s of AGENT_TOOL_SCHEMAS) {
      expect(typeof s.name).toBe('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(names.has(s.name)).toBe(false);
      names.add(s.name);
      expect(typeof s.description).toBe('string');
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.inputSchema.type).toBe('object');
      expect(typeof s.inputSchema.properties).toBe('object');
    }
  });

  it('does not contain the server-local canvas_status name (reserved)', () => {
    expect(AGENT_TOOL_SCHEMAS.some((s) => s.name === 'canvas_status')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/schema-snapshot.spec.ts`
Expected: FAIL — cannot resolve `../src/generated/tool-schemas`.

- [ ] **Step 3: Write the generation script**

Create `packages/mcp/scripts/generate-schemas.ts`:

```ts
/**
 * Build-time schema snapshot.
 *
 * Imports AGENT_TOOL_SCHEMAS from the workspace's angular SOURCE (the file is
 * dependency-free — no Angular imports) and emits a committed TypeScript
 * module so @angflow/mcp has zero runtime dependency on @angflow/angular.
 * Run via `npm run generate:schemas` (tsx). The drift test in
 * test/schema-snapshot.spec.ts fails whenever the catalog changes without
 * regenerating.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_TOOL_SCHEMAS } from '../../angular/src/lib/agent/tool-schemas';

const here = dirname(fileURLToPath(import.meta.url));
const angularPkg = JSON.parse(
  readFileSync(join(here, '../../angular/package.json'), 'utf8'),
) as { version: string };

const outDir = join(here, '../src/generated');
const outFile = join(outDir, 'tool-schemas.ts');

const banner = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Snapshot of AGENT_TOOL_SCHEMAS from @angflow/angular@${angularPkg.version}.
 * Regenerate with \`npm run generate:schemas\` (runs automatically in
 * \`npm run build\`). The drift test in test/schema-snapshot.spec.ts compares
 * this file against the workspace source.
 */
`;

const body = `export interface AgentToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export const GENERATED_FROM_ANGULAR_VERSION = ${JSON.stringify(angularPkg.version)};

export const AGENT_TOOL_SCHEMAS: AgentToolSchema[] = ${JSON.stringify(AGENT_TOOL_SCHEMAS, null, 2)};
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, banner + body, 'utf8');
// eslint-disable-next-line no-console
console.error(
  `[generate-schemas] wrote ${AGENT_TOOL_SCHEMAS.length} tool schemas (from @angflow/angular@${angularPkg.version})`,
);
```

- [ ] **Step 4: Generate and verify pass**

Run: `npm run generate:schemas`
Expected: stderr line reporting 51 schemas written; `src/generated/tool-schemas.ts` exists.
Run: `npx vitest run test/schema-snapshot.spec.ts` → PASS (4 tests).
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit (generated file included — it is a committed build artifact)**

```bash
git add packages/mcp/scripts/generate-schemas.ts packages/mcp/src/generated/tool-schemas.ts packages/mcp/test/schema-snapshot.spec.ts
git commit -m "feat(mcp): build-time tool-schema snapshot with drift test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: FakeCanvas test harness + CanvasSocket

This is the core unit. The FakeCanvas speaks the bridge wire protocol (see `packages/angular/src/lib/agent/types.ts`: server→canvas `AgentRequest {id, method, params}`; canvas→server `{id, result} | {id, error: {code, message, data?}}` and events `{event, params}`).

**Files:**
- Create: `packages/mcp/test/fake-canvas.ts`
- Create: `packages/mcp/src/canvas-socket.ts`
- Test: `packages/mcp/test/canvas-socket.spec.ts`

- [ ] **Step 1: Write the FakeCanvas harness**

Create `packages/mcp/test/fake-canvas.ts`:

```ts
/**
 * Test double for a browser canvas running AngflowAgentBridge with a
 * WebSocketTransport. Dials the CanvasSocket under test and answers
 * AgentRequest frames from a scripted handler table.
 */
import WebSocket from 'ws';

type Handler = (params: Record<string, unknown> | undefined) => unknown | Promise<unknown>;

export interface FakeCanvasOptions {
  /** Per-method scripted responses. Throwing → {id, error} with code -32603. */
  handlers?: Record<string, Handler>;
  /** 'silent' never answers requests; 'wrong-id' answers with id + 1000. */
  mode?: 'normal' | 'silent' | 'wrong-id';
}

export class FakeCanvas {
  readonly received: Array<{ id: number | string; method: string; params?: Record<string, unknown> }> = [];
  private socket: WebSocket | null = null;
  private readonly handlers: Record<string, Handler>;
  private readonly mode: 'normal' | 'silent' | 'wrong-id';

  constructor(options: FakeCanvasOptions = {}) {
    this.handlers = options.handlers ?? {};
    this.mode = options.mode ?? 'normal';
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = new WebSocket(url);
      this.socket = sock;
      sock.on('open', () => resolve());
      sock.on('error', (err) => reject(err));
      sock.on('message', (data) => void this.onMessage(String(data)));
    });
  }

  /** Resolves with the close code when the server (or close()) ends the connection. */
  waitForClose(): Promise<number> {
    return new Promise((resolve) => {
      this.socket?.on('close', (code) => resolve(code));
    });
  }

  emit(event: string, params?: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify({ event, params }));
  }

  sendRaw(text: string): void {
    this.socket?.send(text);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private async onMessage(text: string): Promise<void> {
    const req = JSON.parse(text) as { id: number | string; method: string; params?: Record<string, unknown> };
    this.received.push(req);
    if (this.mode === 'silent') return;
    const replyId = this.mode === 'wrong-id' ? (req.id as number) + 1000 : req.id;
    const handler = this.handlers[req.method];
    if (!handler) {
      this.socket?.send(
        JSON.stringify({ id: replyId, error: { code: -32601, message: `Unknown method: ${req.method}` } }),
      );
      return;
    }
    try {
      const result = await handler(req.params);
      this.socket?.send(JSON.stringify({ id: replyId, result: result ?? null }));
    } catch (err) {
      this.socket?.send(
        JSON.stringify({
          id: replyId,
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        }),
      );
    }
  }
}
```

- [ ] **Step 2: Write the failing CanvasSocket tests**

Create `packages/mcp/test/canvas-socket.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  CanvasSocket,
  BridgeToolError,
  NoCanvasError,
  CanvasTimeoutError,
  CanvasDisconnectedError,
} from '../src/canvas-socket';
import { createLogger } from '../src/log';
import { FakeCanvas } from './fake-canvas';

const log = createLogger('silent');

let sockets: CanvasSocket[] = [];
let canvases: FakeCanvas[] = [];

async function makeSocket(opts: Partial<ConstructorParameters<typeof CanvasSocket>[0]> = {}): Promise<CanvasSocket> {
  const cs = new CanvasSocket({ port: 0, host: '127.0.0.1', timeoutMs: 1000, log, ...opts });
  await cs.start();
  sockets.push(cs);
  return cs;
}

function makeCanvas(...args: ConstructorParameters<typeof FakeCanvas>): FakeCanvas {
  const c = new FakeCanvas(...args);
  canvases.push(c);
  return c;
}

afterEach(async () => {
  for (const c of canvases) c.close();
  canvases = [];
  for (const s of sockets) await s.stop();
  sockets = [];
});

describe('CanvasSocket lifecycle', () => {
  it('starts on an ephemeral port and reports it', async () => {
    const cs = await makeSocket();
    expect(cs.port).toBeGreaterThan(0);
    expect(cs.isConnected()).toBe(false);
  });

  it('accepts a canvas connection', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas();
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect.poll(() => cs.isConnected()).toBe(true);
  });

  it('replaces an existing connection with close code 4000', async () => {
    const cs = await makeSocket();
    const first = makeCanvas();
    await first.connect(`ws://127.0.0.1:${cs.port}`);
    const closed = first.waitForClose();
    const second = makeCanvas({ handlers: { ping: () => 'pong-2' } });
    await second.connect(`ws://127.0.0.1:${cs.port}`);
    expect(await closed).toBe(4000);
    expect(await cs.call('ping', {})).toBe('pong-2');
  });

  it('rejects connections with a bad token (close 4401) when token is configured', async () => {
    const cs = await makeSocket({ token: 'sekret' });
    const bad = makeCanvas();
    await bad.connect(`ws://127.0.0.1:${cs.port}`);
    expect(await bad.waitForClose()).toBe(4401);
    expect(cs.isConnected()).toBe(false);

    const good = makeCanvas({ handlers: { ping: () => 'pong' } });
    await good.connect(`ws://127.0.0.1:${cs.port}?token=sekret`);
    expect(await cs.call('ping', {})).toBe('pong');
  });
});

describe('CanvasSocket calls', () => {
  it('rejects with NoCanvasError when nothing is connected', async () => {
    const cs = await makeSocket();
    await expect(cs.call('get_state', {})).rejects.toBeInstanceOf(NoCanvasError);
  });

  it('round-trips a call and resolves with the result', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas({
      handlers: { add_node: (params) => ({ added: params?.['node'] }) },
    });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const result = await cs.call('add_node', { node: { id: 'n1' } });
    expect(result).toEqual({ added: { id: 'n1' } });
    expect(canvas.received[0]).toMatchObject({ method: 'add_node', params: { node: { id: 'n1' } } });
  });

  it('maps bridge {id, error} frames to BridgeToolError with code/data', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas(); // no handlers → FakeCanvas answers -32601
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const err = await cs.call('nope', {}).catch((e) => e);
    expect(err).toBeInstanceOf(BridgeToolError);
    expect((err as BridgeToolError).code).toBe(-32601);
    expect((err as BridgeToolError).message).toContain('Unknown method');
  });

  it('correlates out-of-order responses by id', async () => {
    const cs = await makeSocket();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const canvas = makeCanvas({
      handlers: {
        slow: async () => {
          await gate;
          return 'slow-result';
        },
        fast: () => 'fast-result',
      },
    });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const slow = cs.call('slow', {});
    const fast = cs.call('fast', {});
    expect(await fast).toBe('fast-result');
    release();
    expect(await slow).toBe('slow-result');
  });

  it('times out a never-answered call with CanvasTimeoutError', async () => {
    const cs = await makeSocket({ timeoutMs: 100 });
    const canvas = makeCanvas({ mode: 'silent' });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect(cs.call('get_state', {})).rejects.toBeInstanceOf(CanvasTimeoutError);
  });

  it('rejects in-flight calls with CanvasDisconnectedError when the canvas drops', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas({ mode: 'silent' });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    const pending = cs.call('get_state', {});
    canvas.close();
    await expect(pending).rejects.toBeInstanceOf(CanvasDisconnectedError);
  });

  it('drops responses with unknown ids without affecting real calls', async () => {
    const cs = await makeSocket({ timeoutMs: 100 });
    const canvas = makeCanvas({ mode: 'wrong-id' });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect(cs.call('get_state', {})).rejects.toBeInstanceOf(CanvasTimeoutError);
  });

  it('tolerates malformed JSON frames', async () => {
    const cs = await makeSocket();
    const canvas = makeCanvas({ handlers: { ping: () => 'pong' } });
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    canvas.sendRaw('{not json');
    expect(await cs.call('ping', {})).toBe('pong');
  });
});

describe('CanvasSocket events', () => {
  it('routes AgentEvent frames to onEvent', async () => {
    const events: Array<{ event: string; params?: Record<string, unknown> }> = [];
    const cs = await makeSocket({ onEvent: (event, params) => events.push({ event, params }) });
    const canvas = makeCanvas();
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    canvas.emit('flow.registered', { flowId: 'demo' });
    await expect.poll(() => events.length).toBe(1);
    expect(events[0]).toEqual({ event: 'flow.registered', params: { flowId: 'demo' } });
  });

  it('signals disconnect via onDisconnect', async () => {
    let disconnects = 0;
    const cs = await makeSocket({ onDisconnect: () => disconnects++ });
    const canvas = makeCanvas();
    await canvas.connect(`ws://127.0.0.1:${cs.port}`);
    await expect.poll(() => cs.isConnected()).toBe(true);
    canvas.close();
    await expect.poll(() => disconnects).toBe(1);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run test/canvas-socket.spec.ts`
Expected: FAIL — cannot resolve `../src/canvas-socket`.

- [ ] **Step 4: Implement `packages/mcp/src/canvas-socket.ts`**

```ts
/**
 * WebSocket server side of the agent-bridge wire protocol.
 *
 * The browser canvas (WebSocketTransport in @angflow/angular) DIALS this
 * server. Policy: single active canvas — a new connection replaces the old
 * one (close 4000). Optional shared-token auth (bad token → close 4401).
 * Knows nothing about MCP; exposes call()/status and event callbacks.
 */
import { IncomingMessage } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import type { Logger } from './log.js';

/** A JSON-RPC-style error returned by the bridge for a tool call. */
export class BridgeToolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
  }
}

/** No canvas is currently connected. */
export class NoCanvasError extends Error {
  constructor(public readonly url: string) {
    super(`No canvas connected at ${url}`);
  }
}

/** The canvas did not answer within the configured timeout. */
export class CanvasTimeoutError extends Error {
  constructor(method: string, timeoutMs: number) {
    super(`Canvas did not answer "${method}" within ${timeoutMs}ms`);
  }
}

/** The canvas disconnected while a call was in flight. */
export class CanvasDisconnectedError extends Error {
  constructor(method: string) {
    super(`Canvas disconnected while "${method}" was in flight; its effect is unknown`);
  }
}

export interface CanvasSocketOptions {
  /** Port to listen on; 0 picks an ephemeral port (tests). */
  port: number;
  host: string;
  /** When set, connections must present ?token=<value> or are closed (4401). */
  token?: string;
  /** Per-request timeout in ms. */
  timeoutMs: number;
  log: Logger;
  /** Push events (flow.state, flow.registered, …) from the canvas. */
  onEvent?: (event: string, params: Record<string, unknown> | undefined) => void;
  /** Fired when the active canvas connection ends (incl. replacement). */
  onDisconnect?: () => void;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  method: string;
};

export class CanvasSocket {
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private actualPort = 0;

  constructor(private readonly options: CanvasSocketOptions) {}

  /** The bound port (resolves option `port: 0` to the real ephemeral port). */
  get port(): number {
    return this.actualPort;
  }

  get host(): string {
    return this.options.host;
  }

  get url(): string {
    return `ws://${this.options.host}:${this.actualPort}`;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ host: this.options.host, port: this.options.port });
      this.wss = wss;
      wss.on('listening', () => {
        const addr = wss.address();
        this.actualPort = typeof addr === 'object' && addr ? addr.port : this.options.port;
        this.options.log.info(`listening for canvas connections on ${this.url}`);
        resolve();
      });
      wss.on('error', (err) => reject(err));
      wss.on('connection', (socket, req) => this.onConnection(socket, req));
    });
  }

  async stop(): Promise<void> {
    this.rejectAllPending('stop');
    this.socket?.close();
    this.socket = null;
    await new Promise<void>((resolve) => {
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
    });
    this.wss = null;
  }

  call(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected()) {
      return Promise.reject(new NoCanvasError(this.url));
    }
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CanvasTimeoutError(method, this.options.timeoutMs));
      }, this.options.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.socket!.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private onConnection(socket: WebSocket, req: IncomingMessage): void {
    if (this.options.token) {
      const url = new URL(req.url ?? '/', 'ws://placeholder');
      if (url.searchParams.get('token') !== this.options.token) {
        this.options.log.warn('rejected canvas connection: bad or missing token');
        socket.close(4401, 'invalid token');
        return;
      }
    }

    if (this.socket) {
      this.options.log.warn(
        'a new canvas connected — replacing the previous connection (did you open a second tab?)',
      );
      const old = this.socket;
      this.socket = null;
      this.rejectAllPending('replaced');
      old.close(4000, 'replaced by newer canvas');
      this.options.onDisconnect?.();
    }

    this.socket = socket;
    this.options.log.info('canvas connected');

    socket.on('message', (data) => this.onMessage(String(data)));
    socket.on('close', () => {
      if (this.socket !== socket) return; // already replaced
      this.socket = null;
      this.options.log.info('canvas disconnected');
      this.rejectAllPending('disconnect');
      this.options.onDisconnect?.();
    });
    socket.on('error', (err) => this.options.log.warn('canvas socket error:', err));
  }

  private onMessage(text: string): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.options.log.debug('dropping malformed frame:', text.slice(0, 200));
      return;
    }

    if (typeof frame['event'] === 'string') {
      this.options.onEvent?.(frame['event'], frame['params'] as Record<string, unknown> | undefined);
      return;
    }

    const id = frame['id'];
    if (typeof id !== 'number' || !this.pending.has(id)) {
      this.options.log.debug('dropping response with unknown id:', id);
      return;
    }
    const entry = this.pending.get(id)!;
    this.pending.delete(id);
    clearTimeout(entry.timer);

    if (frame['error'] !== undefined && frame['error'] !== null) {
      const err = frame['error'] as { code?: number; message?: string; data?: unknown };
      entry.reject(new BridgeToolError(err.code ?? -32603, err.message ?? 'Unknown bridge error', err.data));
      return;
    }
    entry.resolve(frame['result']);
  }

  private rejectAllPending(reason: 'disconnect' | 'replaced' | 'stop'): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new CanvasDisconnectedError(entry.method));
    }
    this.pending.clear();
    void reason;
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/canvas-socket.spec.ts` → PASS (all 14 tests).
Run: `npx vitest run && npx tsc --noEmit` → all green.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/canvas-socket.ts packages/mcp/test/canvas-socket.spec.ts packages/mcp/test/fake-canvas.ts
git commit -m "feat(mcp): CanvasSocket WS server with single-canvas policy and request correlation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: SessionMirror

**Files:**
- Create: `packages/mcp/src/session.ts`
- Test: `packages/mcp/test/session.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/mcp/test/session.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SessionMirror } from '../src/session';

describe('SessionMirror', () => {
  it('starts disconnected with no flows', () => {
    const s = new SessionMirror();
    expect(s.connected).toBe(false);
    expect(s.flowIds()).toEqual([]);
  });

  it('tracks flow registration and unregistration', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.registered', { flowId: 'a' });
    s.handleEvent('flow.registered', { flowId: 'b' });
    expect(s.flowIds()).toEqual(['a', 'b']);
    s.handleEvent('flow.unregistered', { flowId: 'a' });
    expect(s.flowIds()).toEqual(['b']);
  });

  it('records last-known state per flow', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.state', { flowId: 'a', nodes: [{ id: 'n1' }], edges: [] });
    expect(s.lastState('a')).toMatchObject({ nodes: [{ id: 'n1' }] });
    expect(s.lastState('missing')).toBeUndefined();
  });

  it('flow.state implies the flow exists even without flow.registered', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.state', { flowId: 'implied', nodes: [], edges: [] });
    expect(s.flowIds()).toEqual(['implied']);
  });

  it('clears everything on disconnect (a different canvas may connect next)', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.registered', { flowId: 'a' });
    s.handleDisconnect();
    expect(s.connected).toBe(false);
    expect(s.flowIds()).toEqual([]);
  });

  it('ignores events without a string flowId', () => {
    const s = new SessionMirror();
    s.handleConnect();
    s.handleEvent('flow.registered', {});
    s.handleEvent('flow.registered', undefined);
    expect(s.flowIds()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/session.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `packages/mcp/src/session.ts`**

```ts
/**
 * Event-fed mirror of the connected canvas: which flows exist and their
 * last-known state. Consumed by canvas_status and logging — agents read live
 * state via the passthrough tools, not from this mirror.
 */
export class SessionMirror {
  connected = false;
  private readonly flows = new Map<string, unknown>();

  handleConnect(): void {
    this.connected = true;
  }

  handleDisconnect(): void {
    this.connected = false;
    this.flows.clear();
  }

  handleEvent(event: string, params?: Record<string, unknown>): void {
    const flowId = params?.['flowId'];
    if (typeof flowId !== 'string' || flowId.length === 0) return;
    switch (event) {
      case 'flow.registered':
        if (!this.flows.has(flowId)) this.flows.set(flowId, undefined);
        break;
      case 'flow.unregistered':
        this.flows.delete(flowId);
        break;
      case 'flow.state':
        this.flows.set(flowId, params);
        break;
      default:
        // flow.history and future events: nothing to mirror yet.
        break;
    }
  }

  flowIds(): string[] {
    return Array.from(this.flows.keys());
  }

  lastState(flowId: string): unknown {
    return this.flows.get(flowId);
  }
}
```

- [ ] **Step 4: Run to verify pass + commit**

Run: `npx vitest run test/session.spec.ts` → PASS (6 tests). `npx tsc --noEmit` → clean.

```bash
git add packages/mcp/src/session.ts packages/mcp/test/session.spec.ts
git commit -m "feat(mcp): session mirror tracking connected flows and last state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: MCP tool registration + error mapping

**Files:**
- Create: `packages/mcp/src/mcp-tools.ts`
- Test: `packages/mcp/test/mcp-tools.spec.ts`

- [ ] **Step 1: Write the failing tests**

`installTools` is tested through a real low-level `Server` plus the SDK's in-memory transport and `Client` — that exercises the actual request handlers without any WebSocket.

Create `packages/mcp/test/mcp-tools.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { installTools, type CallToolFn, type StatusFn } from '../src/mcp-tools';
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

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.[0]?.text ?? '';
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/mcp-tools.spec.ts` → FAIL (module not found). If the SDK import paths themselves fail, check the installed SDK's actual entry points (see the SDK caveat in the header) and fix the TEST imports first.

- [ ] **Step 3: Implement `packages/mcp/src/mcp-tools.ts`**

```ts
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
  if (err instanceof CanvasTimeoutError || err instanceof CanvasDisconnectedError) {
    return err instanceof CanvasDisconnectedError
      ? `${err.message}. Its effect is unknown — call get_state after the canvas reconnects.`
      : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

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
```

- [ ] **Step 4: Run to verify pass + commit**

Run: `npx vitest run test/mcp-tools.spec.ts` → PASS (10 tests). Full: `npx vitest run && npx tsc --noEmit` → green.

```bash
git add packages/mcp/src/mcp-tools.ts packages/mcp/test/mcp-tools.spec.ts
git commit -m "feat(mcp): MCP tool registration with passthrough proxying and error mapping

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Server composition + CLI + end-to-end-in-process

**Files:**
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/cli.ts`
- Test: `packages/mcp/test/server.e2e.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `packages/mcp/test/server.e2e.spec.ts`:

```ts
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

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return result.content?.[0]?.text ?? '';
}

describe('angflow MCP server e2e (in-process)', () => {
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
    await new Promise((r) => setTimeout(r, 50));

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
    await new Promise((r) => setTimeout(r, 20));
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

  it('clears flows from canvas_status after the canvas disconnects', async () => {
    const client = await startAll();
    canvas = new FakeCanvas();
    await canvas.connect(running!.wsUrl);
    canvas.emit('flow.registered', { flowId: 'demo' });
    await new Promise((r) => setTimeout(r, 50));
    canvas.close();
    await new Promise((r) => setTimeout(r, 50));
    const status = JSON.parse(textOf(await client.callTool({ name: 'canvas_status', arguments: {} })));
    expect(status.connected).toBe(false);
    expect(status.flows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/server.e2e.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `packages/mcp/src/server.ts`**

```ts
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
    onEvent: (event, params) => session.handleEvent(event, params),
    onDisconnect: () => session.handleDisconnect(),
  });

  const mcpServer = new Server(
    { name: 'angflow-mcp', version: pkg.version },
    { capabilities: { tools: {} } },
  );

  installTools(mcpServer, AGENT_TOOL_SCHEMAS, {
    callTool: (name, args) => {
      // Connection state can only flip to connected via a live socket; mark
      // the mirror connected lazily on first sight of the socket.
      if (canvasSocket.isConnected()) session.handleConnect();
      return canvasSocket.call(name, args);
    },
    status: () => {
      if (canvasSocket.isConnected()) session.handleConnect();
      else session.handleDisconnect();
      return {
        connected: canvasSocket.isConnected(),
        flows: session.flowIds(),
        port: canvasSocket.port,
        host: canvasSocket.host,
      };
    },
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
      await mcpServer.close();
    },
  };
}
```

Note: `session.handleDisconnect()` inside `status()` clears flows when nothing is connected — but `handleDisconnect` is also wired to `onDisconnect`, so the status-path call is a cheap idempotent re-sync. If the e2e "clears flows after disconnect" test reveals double-clearing problems, simplify by removing the status-path sync (the onDisconnect wiring is authoritative) — but DON'T weaken the test.

- [ ] **Step 4: Implement `packages/mcp/src/cli.ts`**

```ts
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
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  // eslint-disable-next-line no-console
  console.error(`[angflow-mcp] invalid --port: ${values.port}`);
  process.exit(1);
}
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
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
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/server.e2e.spec.ts` → PASS (5 tests). Full suite + `npx tsc --noEmit` → green.

- [ ] **Step 6: Build + smoke the CLI**

```bash
npm run build
node dist/cli.js --version
```
Expected: stderr prints `@angflow/mcp 0.0.1 (tool schemas from @angflow/angular@<version>)`, exit 0.

```bash
node dist/cli.js --help
```
Expected: usage text, exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/src/cli.ts packages/mcp/test/server.e2e.spec.ts
git commit -m "feat(mcp): server composition root, CLI entry point, and in-process e2e tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Documentation (README + AGENT_BRIDGE.md + CLAUDE.md)

**Files:**
- Create: `packages/mcp/README.md`
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write `packages/mcp/README.md`**

Structure (write full prose for each — this is the user-facing doc):

1. **Title + one-paragraph pitch**: drive a live angflow canvas from Claude Code / Claude Desktop / Cursor while a human edits alongside.
2. **Quickstart (3 steps)**:
   - Step 1 — wire the canvas (code block):
     ```ts
     import { provideAgentBridge, WindowTransport, WebSocketTransport } from '@angflow/angular';
     import { dagreLayout } from '@angflow/angular/layout';

     provideAgentBridge({
       transports: [
         new WindowTransport(),
         new WebSocketTransport({ url: 'ws://localhost:8765' }),
       ],
       layout: dagreLayout,
     });
     ```
   - Step 2 — register the server with your MCP client:
     ```bash
     claude mcp add angflow -- npx @angflow/mcp
     ```
     plus the Claude Desktop / Cursor JSON block:
     ```json
     { "mcpServers": { "angflow": { "command": "npx", "args": ["@angflow/mcp"] } } }
     ```
   - Step 3 — open the app and ask the agent (example prompt: "add a database node and connect it to the API service, then tidy the layout").
3. **How it works**: the ASCII diagram from the spec (MCP stdio ⇄ server ⇄ WS ⇄ browser); start order doesn't matter (transport reconnects).
4. **CLI reference**: the table of flags + env vars from cli.ts.
5. **Tools**: one line — every `@angflow/angular` agent-bridge tool is exposed 1:1 (link to `AGENT_BRIDGE.md` on GitHub), plus `canvas_status`.
6. **Security**: binds 127.0.0.1 by default; `--token` for shared machines (canvas URL becomes `ws://localhost:8765?token=...`); non-localhost `--host` is at-your-own-risk.
7. **Troubleshooting table**: "No canvas connected" → open the app / check the transport URL; port in use → `--port`; agent edits the wrong tab → two-tab takeover explanation (last connection wins; watch stderr); tool returns `[-32601] Unknown method` → canvas runs an older `@angflow/angular` than the server's snapshot (check `--version`).

- [ ] **Step 2: Update `packages/angular/AGENT_BRIDGE.md`**

Add a section after "Two ways to call":

```markdown
## MCP server

`@angflow/mcp` (in `packages/mcp/`) exposes this entire tool catalog to MCP
clients (Claude Code, Claude Desktop, Cursor): it hosts the WebSocket endpoint
a `WebSocketTransport` dials and re-publishes every tool above 1:1, plus a
server-local `canvas_status` tool. Tool schemas are snapshotted from
`AGENT_TOOL_SCHEMAS` at build time — when you add or change a tool here,
rebuild/republish `@angflow/mcp` (its drift test fails until regenerated).
See [`packages/mcp/README.md`](../mcp/README.md) for setup.
```

- [ ] **Step 3: Update root `CLAUDE.md`**

- Project-structure block: add `    mcp/                   # MCP server exposing the agent bridge to MCP clients` under `packages/`.
- Key Commands table: add rows `| Build mcp | npm run build | packages/mcp |`, `| Test mcp | npm run test | packages/mcp |`, `| Publish mcp | npm publish --access public | packages/mcp |`.
- Publish flow section: add a note that `@angflow/mcp` should be republished (patch) whenever the agent tool catalog changes, since its schemas are a build-time snapshot.
- Agent Bridge section: append to the update-rules list: "Adding/changing a tool also requires regenerating the `@angflow/mcp` schema snapshot (`pnpm -F @angflow/mcp run generate:schemas`) — its drift test fails otherwise."

- [ ] **Step 4: Verify + commit**

Run (from `packages/mcp/`): `npx vitest run` → still green (docs only).

```bash
git add packages/mcp/README.md packages/angular/AGENT_BRIDGE.md CLAUDE.md
git commit -m "docs(mcp): README quickstart, AGENT_BRIDGE.md pointer, CLAUDE.md workspace entries

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Example app wiring + final verification

**Files:**
- Modify: `examples/angular/src/app/app.config.ts`
- Possibly modify: `examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts` (description text only)

- [ ] **Step 1: Wire WebSocketTransport in the example app**

In `examples/angular/src/app/app.config.ts`, extend the existing `provideAgentBridge` transports array (read it first — it already has `WindowTransport` and `layout: dagreLayout`):

```ts
import { provideAgentBridge, WindowTransport, WebSocketTransport } from '@angflow/angular';

provideAgentBridge({
  transports: [
    new WindowTransport(),
    // Dials the @angflow/mcp server when one is running; silently retries
    // with backoff otherwise, so `ng serve` works fine without it.
    new WebSocketTransport({ url: 'ws://localhost:8765', onError: () => {} }),
  ],
  layout: dagreLayout,
  // ...existing config unchanged
})
```

(Check `WebSocketTransport`'s import is exported from `@angflow/angular` — it is, via the agent barrel.)

- [ ] **Step 2: Mention MCP in the agent-bridge example description**

In `agent-bridge.component.ts`, extend the `description` string of the example card with one sentence: `Also connectable from Claude Code via @angflow/mcp — see packages/mcp/README.md.` (Template-text-only change.)

- [ ] **Step 3: Build the example**

```bash
cd examples/angular
npm run build
```
Expected: success.

- [ ] **Step 4: Full workspace verification**

```bash
cd packages/mcp && npx vitest run && npx tsc --noEmit && npm run build
cd ../angular && npx vitest run && npm run typecheck
git diff --stat -- ../system   # zero lines
git status --porcelain          # only intended changes
```

- [ ] **Step 5: Manual e2e (report instructions, perform if a browser is available)**

1. Terminal A: `cd examples/angular && npm run dev`
2. Terminal B: `node packages/mcp/dist/cli.js` (watch stderr for "canvas connected" after opening the app)
3. `claude mcp add angflow -- node <abs-path>/packages/mcp/dist/cli.js` then in a Claude Code session: `canvas_status` → connected with flow `demo`; `register_node_template` + `add_nodes` + `layout_nodes` + `undo` against the agent-bridge example page.

If running this manually is not possible in the execution environment, verify steps 1–2 are at least startable (server boots, app builds) and report the manual steps as pending for the user.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/app.config.ts examples/angular/src/app/examples/agent-bridge/agent-bridge.component.ts
git commit -m "feat(examples): dial the @angflow/mcp server from the example app

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage checklist (self-review against the design doc)

| Spec requirement | Task |
|---|---|
| Workspace package `packages/mcp`, bin `angflow-mcp`, npx-runnable | 1, 6 |
| `pnpm-workspace.yaml` entry | 1 |
| 1:1 tool passthrough + `canvas_status` | 5 |
| WS server, 127.0.0.1 default, single-active policy (4000), token (4401), timeout, correlation, in-flight rejection | 3 |
| Push events internal-only → session mirror | 3 (routing), 4 (mirror), 6 (wiring) |
| Build-time snapshot, committed, version-stamped, drift + validity tests | 2 |
| Error mapping table (bridge codes, no-canvas, timeout, disconnected) | 5 |
| CLI flags + env fallbacks + `--version` with snapshot provenance | 6 |
| stderr-only logging | 1 (logger), 6 (CLI) |
| README quickstart/CLI/security/troubleshooting | 7 |
| AGENT_BRIDGE.md pointer section; CLAUDE.md structure/commands/publish notes | 7 |
| Example app wiring (always-on transport) | 8 |
| FakeCanvas harness + unit + e2e-in-process + manual e2e | 3, 5, 6, 8 |
| Zero changes to `packages/system`; `packages/angular` docs-only | enforced in 8's verification |
| Publish at 0.0.1 | deferred to publish time per CLAUDE.md flow |
