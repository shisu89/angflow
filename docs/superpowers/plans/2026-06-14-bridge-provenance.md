# Bridge provenance subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-call `source`, a host `canMutate` write guard, a bounded op-log with `onOp` sink and a `get_changes_since` poll tool, and `source` on `flow.history` — so agents edit attributably alongside humans.

**Architecture:** A new `OpLog` class (mirrors `history.ts`) holds per-flow bounded op buffers. `dispatch` resolves a per-call `source` (from the inbound frame / `callTool` opts), gates mutating tools through an optional host `canMutate`, and — on success — appends to the op-log + fires `onOp` + tags `flow.history` with the source. `get_changes_since` reads the log delta.

**Tech Stack:** TypeScript, `@angflow/angular` (ngc, vitest), `@angflow/mcp` (schema snapshot).

**Spec:** `docs/superpowers/specs/2026-06-14-bridge-provenance-design.md`

---

### Task 1: `OpLog` class + `OpLogEntry` type

**Files:**
- Create: `packages/angular/src/lib/agent/op-log.ts`
- Create: `packages/angular/src/lib/agent/op-log.spec.ts`
- Modify: `packages/angular/src/lib/agent/index.ts` (export `OpLogEntry`)
- Modify: `packages/angular/src/lib/public-api.ts` (re-export `OpLogEntry` in the agent block)

- [ ] **Step 1: Write the failing test**

Create `packages/angular/src/lib/agent/op-log.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OpLog } from './op-log';

const op = (method: string, source?: string) => ({ method, params: {}, source });

describe('OpLog', () => {
  it('assigns increasing per-flow cursors starting at 1', () => {
    const log = new OpLog();
    expect(log.append('f', op('add_node')).cursor).toBe(1);
    expect(log.append('f', op('add_edge')).cursor).toBe(2);
    expect(log.append('g', op('add_node')).cursor).toBe(1); // separate flow
  });

  it('since(c) returns only entries after c, with latest cursor', () => {
    const log = new OpLog();
    log.append('f', op('a'));
    log.append('f', op('b'));
    log.append('f', op('c'));
    const res = log.since('f', 1);
    expect(res.ops.map((e) => e.method)).toEqual(['b', 'c']);
    expect(res.cursor).toBe(3);
    expect(res.truncated).toBe(false);
  });

  it('since(0) / omitted returns all retained entries', () => {
    const log = new OpLog();
    log.append('f', op('a'));
    log.append('f', op('b'));
    expect(log.since('f', 0).ops.map((e) => e.method)).toEqual(['a', 'b']);
  });

  it('drops oldest past maxOps (ring buffer) and reports truncated for a stale cursor', () => {
    const log = new OpLog({ maxOps: 2 });
    log.append('f', op('a')); // cursor 1
    log.append('f', op('b')); // cursor 2
    log.append('f', op('c')); // cursor 3 — 'a' (cursor 1) dropped
    const res = log.since('f', 1); // caller wants > 1, but cursor 2 is now oldest
    expect(res.ops.map((e) => e.method)).toEqual(['b', 'c']);
    expect(res.truncated).toBe(true);
  });

  it('preserves source on entries', () => {
    const log = new OpLog();
    expect(log.append('f', op('a', 'agent:claude')).source).toBe('agent:claude');
  });

  it('dropFlow clears a flow', () => {
    const log = new OpLog();
    log.append('f', op('a'));
    log.dropFlow('f');
    expect(log.since('f', 0).ops).toEqual([]);
    expect(log.append('f', op('b')).cursor).toBe(1); // cursor reset
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/op-log.spec.ts`
Expected: FAIL — cannot find `./op-log`.

- [ ] **Step 3: Create `op-log.ts`**

```ts
/** One recorded mutating tool call. `cursor` is monotonic per flow (starts at 1). */
export interface OpLogEntry {
  cursor: number;
  flowId: string;
  method: string;
  params: Record<string, unknown>;
  source?: string;
}

export interface OpLogOptions {
  /** Max retained entries per flow (ring buffer). Default 1000. */
  maxOps?: number;
}

export interface ChangesSince {
  ops: OpLogEntry[];
  cursor: number;
  truncated: boolean;
}

/**
 * Per-flow bounded op-log. Records bridge-initiated mutating tool calls with a
 * monotonic cursor so an agent can poll `get_changes_since`. Bridge-only scope —
 * UI-driven changes and undo/redo are not recorded (mirrors AgentHistory).
 */
export class OpLog {
  private readonly logs = new Map<string, OpLogEntry[]>();
  private readonly cursors = new Map<string, number>();
  private readonly maxOps: number;

  constructor(options: OpLogOptions = {}) {
    this.maxOps = options.maxOps ?? 1000;
  }

  append(flowId: string, op: { method: string; params: Record<string, unknown>; source?: string }): OpLogEntry {
    const cursor = (this.cursors.get(flowId) ?? 0) + 1;
    this.cursors.set(flowId, cursor);
    const entry: OpLogEntry = { cursor, flowId, method: op.method, params: op.params, source: op.source };
    const log = this.logs.get(flowId) ?? [];
    log.push(entry);
    while (log.length > this.maxOps) log.shift();
    this.logs.set(flowId, log);
    return entry;
  }

  since(flowId: string, sinceCursor: number): ChangesSince {
    const log = this.logs.get(flowId) ?? [];
    const latest = this.cursors.get(flowId) ?? 0;
    if (sinceCursor <= 0) {
      return { ops: [...log], cursor: latest, truncated: false };
    }
    const oldestRetained = log.length > 0 ? log[0].cursor : latest;
    // Truncated when the caller's cursor predates the oldest entry we still hold
    // (entries it hasn't seen were dropped) → caller should re-sync via get_state.
    const truncated = oldestRetained > sinceCursor + 1;
    return { ops: log.filter((e) => e.cursor > sinceCursor), cursor: latest, truncated };
  }

  dropFlow(flowId: string): void {
    this.logs.delete(flowId);
    this.cursors.delete(flowId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/agent/op-log.spec.ts`
Expected: PASS (6).

- [ ] **Step 5: Export the type**

In `packages/angular/src/lib/agent/index.ts`, add after the history export line:
```ts
export type { OpLogEntry, OpLogOptions, ChangesSince } from './op-log';
```

In `packages/angular/src/lib/public-api.ts`, inside the `from './agent'` export block, add to the type list:
```ts
  type OpLogEntry,
```

- [ ] **Step 6: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/op-log.ts packages/angular/src/lib/agent/op-log.spec.ts packages/angular/src/lib/agent/index.ts packages/angular/src/lib/public-api.ts
git commit -m "feat(agent): OpLog (bounded per-flow op-log with cursor)"
```

---

### Task 2: `source` plumbing + `canMutate` guard

**Files:**
- Modify: `packages/angular/src/lib/agent/types.ts` (`AgentRequest.source`)
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (token, constructor, `callTool` opts, `dispatch` guard, `MutationDeniedError`, `-32001`)
- Modify: `packages/angular/src/lib/agent/provide-agent-bridge.ts` (`canMutate` config + token)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add a new describe block to `agent-bridge.spec.ts`. `setup()` accepts `transports`; for config we need a variant — use `TestBed` directly mirroring `setup()` but adding `provideAgentBridge({ transports: [], canMutate })`. Add a local helper inside the describe:

```ts
import { provideAgentBridge } from './provide-agent-bridge'; // confirm existing imports; setup() already uses it

describe('provenance: canMutate guard', () => {
  function setupGuarded(canMutate: any) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideAgentBridge({ transports: [], canMutate })],
    });
    const bridge = TestBed.inject(AngflowAgentBridge);
    const newFlow = () => {
      const child = Injector.create({ providers: [FlowStore, NgFlowService], parent: TestBed.inject(Injector) });
      return child.get(NgFlowService);
    };
    return { bridge, newFlow };
  }

  it('denies a mutating tool with -32001 when canMutate returns false', async () => {
    const { bridge, newFlow } = setupGuarded(() => false);
    const flow = newFlow();
    bridge.register('main', flow);
    await expect(bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } }))
      .rejects.toMatchObject({ code: -32001 });
    expect(flow.getNode('a')).toBeUndefined(); // not applied
  });

  it('uses the returned string as the denial reason', async () => {
    const { bridge, newFlow } = setupGuarded(() => 'read only board');
    bridge.register('main', newFlow());
    await expect(bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } }))
      .rejects.toMatchObject({ code: -32001, message: 'read only board' });
  });

  it('allows when canMutate returns true and passes the source through', async () => {
    const seen: any[] = [];
    const { bridge, newFlow } = setupGuarded((op: any, source: any) => { seen.push({ op, source }); return true; });
    const flow = newFlow();
    bridge.register('main', flow);
    await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } }, { source: 'agent:claude' });
    expect(flow.getNode('a')).toBeTruthy();
    expect(seen[0].op.method).toBe('add_node');
    expect(seen[0].source).toBe('agent:claude');
  });

  it('treats a throwing canMutate as a deny (fail-safe)', async () => {
    const { bridge, newFlow } = setupGuarded(() => { throw new Error('boom'); });
    const flow = newFlow();
    bridge.register('main', flow);
    await expect(bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } }))
      .rejects.toMatchObject({ code: -32001 });
    expect(flow.getNode('a')).toBeUndefined();
  });

  it('does not call canMutate for read tools', async () => {
    let calls = 0;
    const { bridge, newFlow } = setupGuarded(() => { calls++; return true; });
    bridge.register('main', newFlow());
    await bridge.callTool('get_state', {});
    expect(calls).toBe(0);
  });
});
```

(Confirm `AngflowAgentBridge`, `NgFlowService`, `FlowStore`, `Injector`, `provideZonelessChangeDetection` are imported at the top of the spec — `setup()` already uses them.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "canMutate"`
Expected: FAIL — no guard yet (mutations succeed; no -32001).

- [ ] **Step 3: Add `source` to the request frame**

In `packages/angular/src/lib/agent/types.ts`, add to `AgentRequest`:
```ts
export interface AgentRequest {
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
  /** Host-defined origin of this call (e.g. "agent:claude", "user"). Threaded to canMutate / op-log / flow.history. */
  source?: string;
}
```

- [ ] **Step 4: Add the token + config**

In `agent-bridge.service.ts`, near the other tokens (after `AGENT_LAYOUT`):
```ts
/** Optional host write-guard for mutating tools. */
export const AGENT_CAN_MUTATE = new InjectionToken<
  (op: { method: string; params: Record<string, unknown> }, source?: string) => boolean | string | Promise<boolean | string>
>('AngflowAgentCanMutate');
```

Add the error code near the others:
```ts
const ERROR_MUTATION_DENIED = -32001;
```

In `provide-agent-bridge.ts`, add to `AgentBridgeConfig`:
```ts
  /**
   * Optional host write-guard. Called before any mutating tool executes with
   * `({ method, params }, source)`. Return `true` to allow; `false` or a
   * non-empty string (the denial reason) to reject with `-32001`. Async-capable;
   * a throw is treated as a deny.
   */
  canMutate?: (op: { method: string; params: Record<string, unknown> }, source?: string) => boolean | string | Promise<boolean | string>;
```
and in `provideAgentBridge`'s returned providers array:
```ts
    ...(config.canMutate ? [{ provide: AGENT_CAN_MUTATE, useValue: config.canMutate }] : []),
```
(import `AGENT_CAN_MUTATE` from `./agent-bridge.service` alongside the existing token imports.)

- [ ] **Step 5: Inject in the constructor + store the field**

In `agent-bridge.service.ts`, add a field:
```ts
  private readonly canMutate:
    | ((op: { method: string; params: Record<string, unknown> }, source?: string) => boolean | string | Promise<boolean | string>)
    | null;
```
Add a constructor param (after `layoutFn`):
```ts
    @Optional() @Inject(AGENT_CAN_MUTATE) canMutate: ((op: { method: string; params: Record<string, unknown> }, source?: string) => boolean | string | Promise<boolean | string>) | null,
```
and in the constructor body:
```ts
    this.canMutate = canMutate ?? null;
```

- [ ] **Step 6: Add `MutationDeniedError` + the guard in `dispatch` + `callTool` opts**

Add the error class near `FlowNotFoundError`:
```ts
class MutationDeniedError extends Error {}
```

Change `callTool` to accept source:
```ts
  async callTool(method: string, params: Record<string, unknown> = {}, opts?: { source?: string }): Promise<unknown> {
    const response = await this.dispatch({
      id: `in-process:${this.nextInProcessId++}`,
      method,
      params,
      source: opts?.source,
    });
    if ('error' in response) {
      const err = new Error(response.error.message) as Error & { code?: number; data?: unknown };
      err.code = response.error.code;
      err.data = response.error.data;
      throw err;
    }
    return response.result;
  }
```

In `dispatch`, after `const isLayout = req.method === 'layout_nodes';` and before the snapshot block, add the guard:
```ts
      const isMutating = MUTATING_TOOLS.has(req.method) || isApplyChanges || isLayout;
      const source = req.source;
      if (this.canMutate && isMutating) {
        let verdict: boolean | string;
        try {
          verdict = await this.canMutate({ method: req.method, params }, source);
        } catch (err) {
          this.reportError(err, { kind: 'dispatch', method: req.method });
          verdict = false; // fail safe
        }
        if (verdict !== true) {
          throw new MutationDeniedError(typeof verdict === 'string' && verdict ? verdict : 'Mutation denied by host.');
        }
      }
```

Add a catch branch in `dispatch` (before the generic `reportError` fallback):
```ts
      if (err instanceof MutationDeniedError) {
        return { id: req.id, error: { code: ERROR_MUTATION_DENIED, message: err.message } };
      }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "canMutate"`
Expected: PASS (5).

- [ ] **Step 8: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/types.ts packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/provide-agent-bridge.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): per-call source + host canMutate write guard (-32001)"
```

---

### Task 3: op-log recording + `onOp` sink + `source` on `flow.history`

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (tokens, constructor, `OpLog` instance, `recordOp` in dispatch, `emitHistory` source, unregister `dropFlow`)
- Modify: `packages/angular/src/lib/agent/provide-agent-bridge.ts` (`onOp` + `opLog` config + tokens)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add a describe block to `agent-bridge.spec.ts`:

```ts
describe('provenance: op-log + onOp + flow.history source', () => {
  function setupLogged(extra: any = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideAgentBridge({ transports: [], ...extra })],
    });
    const bridge = TestBed.inject(AngflowAgentBridge);
    const newFlow = () => {
      const child = Injector.create({ providers: [FlowStore, NgFlowService], parent: TestBed.inject(Injector) });
      return child.get(NgFlowService);
    };
    return { bridge, newFlow };
  }

  it('onOp fires once per applied mutation with method + source', async () => {
    const ops: any[] = [];
    const { bridge, newFlow } = setupLogged({ onOp: (e: any) => ops.push(e) });
    bridge.register('main', newFlow());
    await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } }, { source: 'user' });
    expect(ops).toHaveLength(1);
    expect(ops[0].method).toBe('add_node');
    expect(ops[0].source).toBe('user');
    expect(ops[0].cursor).toBe(1);
  });

  it('a throwing onOp does not break the call', async () => {
    const { bridge, newFlow } = setupLogged({ onOp: () => { throw new Error('sink boom'); } });
    const flow = newFlow();
    bridge.register('main', flow);
    await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
    expect(flow.getNode('a')).toBeTruthy();
  });

  it('read tools produce no op-log entries', async () => {
    const ops: any[] = [];
    const { bridge, newFlow } = setupLogged({ onOp: (e: any) => ops.push(e) });
    bridge.register('main', newFlow());
    await bridge.callTool('get_state', {});
    expect(ops).toHaveLength(0);
  });

  it('flow.history event carries the source', async () => {
    const events: any[] = [];
    const transport = { start() {}, send: (f: any) => events.push(f), stop() {} };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideAgentBridge({ transports: [transport] })],
    });
    const bridge = TestBed.inject(AngflowAgentBridge);
    const child = Injector.create({ providers: [FlowStore, NgFlowService], parent: TestBed.inject(Injector) });
    bridge.register('main', child.get(NgFlowService));
    await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } }, { source: 'user' });
    const hist = events.find((e) => e.event === 'flow.history');
    expect(hist?.params?.source).toBe('user');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "op-log + onOp"`
Expected: FAIL — `onOp` never called; `flow.history` has no source.

- [ ] **Step 3: Add tokens + config**

In `agent-bridge.service.ts` near the other tokens:
```ts
/** Optional sink receiving each applied mutating op (for host persistence/replay). */
export const AGENT_ON_OP = new InjectionToken<(entry: import('./op-log').OpLogEntry) => void>('AngflowAgentOnOp');
/** Op-log config. `false` disables the op-log + get_changes_since. Default { maxOps: 1000 }. */
export const AGENT_OPLOG_OPTIONS = new InjectionToken<import('./op-log').OpLogOptions | false>('AngflowAgentOpLogOptions');
```

Add an import at the top: `import { OpLog } from './op-log'; import type { OpLogEntry } from './op-log';`

In `provide-agent-bridge.ts`, add to `AgentBridgeConfig`:
```ts
  /** Sink called after each applied mutating tool call with its op-log entry. */
  onOp?: (entry: import('./op-log').OpLogEntry) => void;
  /** Op-log config. Pass `false` to disable the op-log and `get_changes_since`. Default { maxOps: 1000 }. */
  opLog?: import('./op-log').OpLogOptions | false;
```
and in the providers array:
```ts
    ...(config.onOp ? [{ provide: AGENT_ON_OP, useValue: config.onOp }] : []),
    { provide: AGENT_OPLOG_OPTIONS, useValue: config.opLog ?? { maxOps: 1000 } },
```
(import `AGENT_ON_OP`, `AGENT_OPLOG_OPTIONS` from `./agent-bridge.service`.)

- [ ] **Step 4: Wire the constructor + fields**

In `agent-bridge.service.ts` add fields:
```ts
  private readonly opLog: OpLog | null;
  private readonly onOp: ((entry: OpLogEntry) => void) | null;
```
Add constructor params:
```ts
    @Optional() @Inject(AGENT_ON_OP) onOp: ((entry: OpLogEntry) => void) | null,
    @Optional() @Inject(AGENT_OPLOG_OPTIONS) opLogOptions: import('./op-log').OpLogOptions | false | null,
```
and body:
```ts
    this.onOp = onOp ?? null;
    this.opLog = opLogOptions === false ? null : new OpLog(opLogOptions ?? undefined);
```

- [ ] **Step 5: Record ops + thread source into history**

Change `emitHistory` to accept a source:
```ts
  private emitHistory(flowId: string, source?: string): void {
    if (!this.history) return;
    const status = this.history.status(flowId);
    this.emit({ event: 'flow.history', params: { flowId, ...status, source } });
  }
```

Add a `recordOp` helper:
```ts
  private recordOp(flowId: string, method: string, params: Record<string, unknown>, source?: string): void {
    if (!this.opLog) return;
    const entry = this.opLog.append(flowId, { method, params, source });
    if (this.onOp) {
      try { this.onOp(entry); } catch (err) { this.reportError(err, { kind: 'dispatch', method }); }
    }
  }
```

In `dispatch`, in the post-handler history-capture block, add `recordOp` calls and pass `source` to `emitHistory`. Replace the existing block (the `if (snapshot && flowId && this.history) { ... }`) with one that records ops independently of history:
```ts
      // Decide whether this call counts as a real recordable mutation
      // (mirrors the history-capture conditions).
      let recorded = false;
      if (isMutating && flowId) {
        if (isApplyChanges) {
          const ops = (params['ops'] as Array<Record<string, unknown>>) ?? [];
          recorded = ops.some(
            (o) => o['op'] !== 'select_nodes' && o['op'] !== 'select_edges' && o['op'] !== 'deselect_all',
          );
        } else if (isLayout) {
          const positions = (result as { positions?: Record<string, unknown> } | null)?.positions ?? {};
          recorded = Object.keys(positions).length > 0;
        } else {
          recorded = true;
        }
      }
      if (recorded && flowId) {
        if (this.history && snapshot) {
          this.history.capture(flowId, snapshot);
          this.emitHistory(flowId, source);
        }
        this.recordOp(flowId, req.method, params, source);
      }
```
(Delete the old capture block this replaces; `source` is the `const source = req.source` from Task 2.)

- [ ] **Step 6: Drop the flow's op-log on unregister**

In `unregister(id)`, alongside `this.history?.dropFlow(id);`, add:
```ts
    this.opLog?.dropFlow(id);
```
And in `register` where it drops history on a different-service re-register (`this.history?.dropFlow(id);`), add `this.opLog?.dropFlow(id);` too.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "op-log + onOp"`
Expected: PASS (4).

- [ ] **Step 8: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/provide-agent-bridge.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): op-log recording + onOp sink + source on flow.history"
```

---

### Task 4: `get_changes_since` tool

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (register handler)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `provenance: op-log + onOp + flow.history source` describe block (it has `setupLogged`):

```ts
it('get_changes_since returns ops after a cursor, then empty', async () => {
  const { bridge, newFlow } = setupLogged();
  bridge.register('main', newFlow());
  await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
  await bridge.callTool('add_node', { node: { id: 'b', position: { x: 0, y: 0 }, data: {} } });
  const first = (await bridge.callTool('get_changes_since', {})) as { ops: any[]; cursor: number; truncated: boolean };
  expect(first.ops.map((o) => o.method)).toEqual(['add_node', 'add_node']);
  expect(first.cursor).toBe(2);
  expect(first.truncated).toBe(false);
  const next = (await bridge.callTool('get_changes_since', { since: first.cursor })) as { ops: any[] };
  expect(next.ops).toEqual([]);
});

it('get_changes_since reports truncated when the cursor is too old', async () => {
  const { bridge, newFlow } = setupLogged({ opLog: { maxOps: 1 } });
  bridge.register('main', newFlow());
  await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
  await bridge.callTool('add_node', { node: { id: 'b', position: { x: 0, y: 0 }, data: {} } });
  const res = (await bridge.callTool('get_changes_since', { since: 1 })) as { truncated: boolean };
  expect(res.truncated).toBe(true);
});

it('get_changes_since returns an empty log when the op-log is disabled', async () => {
  const { bridge, newFlow } = setupLogged({ opLog: false });
  bridge.register('main', newFlow());
  await bridge.callTool('add_node', { node: { id: 'a', position: { x: 0, y: 0 }, data: {} } });
  const res = (await bridge.callTool('get_changes_since', {})) as { ops: any[]; cursor: number; truncated: boolean };
  expect(res).toEqual({ ops: [], cursor: 0, truncated: false });
});

it('get_changes_since captures no history entry', async () => {
  const { bridge, newFlow } = setupLogged();
  bridge.register('main', newFlow());
  await bridge.callTool('get_changes_since', {});
  const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
  expect(status.pastDepth).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "get_changes_since"`
Expected: FAIL — `Unknown method: get_changes_since`.

- [ ] **Step 3: Register the handler**

In `installHandlers()` (place it near the history tools), add:
```ts
    this.handlers.set('get_changes_since', (flow, params) => {
      const flowId = this.findFlowId(flow);
      if (!this.opLog || !flowId) return { ops: [], cursor: 0, truncated: false };
      const since = typeof params['since'] === 'number' ? (params['since'] as number) : 0;
      return this.opLog.since(flowId, since);
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "get_changes_since"`
Expected: PASS (4).

- [ ] **Step 5: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): get_changes_since poll tool"
```

---

### Task 5: Tool schema + AGENT_BRIDGE.md + MCP snapshot

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (add `get_changes_since`)
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Modify: `packages/mcp/...` snapshot (regenerated)

- [ ] **Step 1: Add the `get_changes_since` schema**

In `tool-schemas.ts`, add an entry (near the history/read tools):
```ts
  {
    name: 'get_changes_since',
    description:
      'Poll the op-log: return mutating tool calls applied since a cursor. ' +
      'Returns { ops: [{ cursor, flowId, method, params, source? }], cursor, truncated }. ' +
      'Pass the returned cursor on the next call; truncated:true means entries were dropped (re-sync via get_state). ' +
      'Records only bridge-initiated mutations (not UI edits or undo/redo).',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        since: { type: 'number', description: 'Return ops with cursor greater than this. Omit/0 for all retained.' },
      },
      additionalProperties: false,
    },
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Update `AGENT_BRIDGE.md`**

- Add `get_changes_since` to the Discovery/read table: params `since?: number`; Returns `{ ops, cursor, truncated }`; note "poll the op-log; records bridge-initiated mutations only".
- Add a **Provenance** section documenting: per-call `source` (frame-level / `callTool(method, params, { source })` / transport-injected); `canMutate(op, source)` guard config (returns `true` | reason; deny → `-32001`; not called for reads/undo/redo); `onOp` sink + `opLog: { maxOps } | false` config; the op-log's bridge-only scope.
- Add `-32001` ("mutation denied by host") to the **Error codes** table.
- In the **Events** section, note `flow.history` params now include an optional `source`.
- Update the `provideAgentBridge` wiring example/config list to include `canMutate`, `onOp`, `opLog`.

Read the relevant sections first and match the existing formatting.

- [ ] **Step 4: Regenerate the MCP snapshot**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp run generate:schemas`
Expected: rebuilds angular, rewrites the snapshot; tool count 57 → 58.

If `pnpm -F @angflow/angular build` fails for an unrelated reason, STOP and report BLOCKED.

- [ ] **Step 5: Run the MCP drift test**

Run: `pnpm -F @angflow/mcp run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/AGENT_BRIDGE.md packages/mcp
git commit -m "docs(agent): get_changes_since schema + AGENT_BRIDGE provenance; regen mcp snapshot"
```

---

### Task 6: Full verification + mark feedback #15 & #16

**Files:** none (verification); then `brainstorm_agentic_app/docs/angflow-feedback.md` (separate repo — confirm before committing)

- [ ] **Step 1: Build angular → mcp**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp build`
Expected: both clean. (`@angflow/system` unchanged this unit.)

- [ ] **Step 2: Run the full test suites**

Run: `pnpm -F @angflow/angular test && pnpm -F @angflow/mcp test`
Expected: all green.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Mark the feedback entries**

In `C:/Users/shisu/CodeWeb/brainstorm_agentic_app/docs/angflow-feedback.md`, change entries **#15** and **#16** headings `⛳` → `✅` and append a `**✅ Fixed in angflow**` bullet to each: #15 — per-call `source` + host `canMutate` guard (`-32001`) + `source` on `flow.history`; #16 — bounded op-log + `onOp` sink + `get_changes_since(cursor)`. Reference the commit/PR; note "not yet published"; adoption N/A (app uses its own CanvasOp protocol — both were parity suggestions citing it as reference).

- [ ] **Step 5: Commit the feedback update**

```bash
cd C:/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs: mark angflow feedback #15 + #16 fixed (provenance subsystem)"
```

> NOTE: separate git repo — confirm with the user before committing there.

---

## Publish (manual — requires npm 2FA, do with the user)

`@angflow/system` unchanged this unit.
1. `packages/angular`: `npm version patch && npm run build && pnpm publish --access public`
2. `packages/mcp`: `npm version patch && npm run build && npm publish --access public`

## Notes for the implementer

- **Spec coverage:** OpLog (T1), source + canMutate (T2), op-log recording + onOp + flow.history.source (T3), get_changes_since (T4), schema/docs/snapshot (T5), verification + feedback (T6).
- **Token/constructor wiring:** mirror the existing `AGENT_ON_ERROR`/`AGENT_HISTORY_OPTIONS` pattern exactly (all `@Optional() @Inject(...)`). The constructor already has 4 injected params; you're adding three more — keep them `@Optional()` so existing `provideAgentBridge` calls without the new config still construct.
- **`isMutating` = the gated set:** `MUTATING_TOOLS.has(method) || isApplyChanges || isLayout`. `MUTATING_TOOLS` already includes the #14 group tools, so `canMutate` and the op-log automatically cover them. Don't introduce a separate constant.
- **op-log independent of history:** record ops even when `history:false` (the T3 refactor computes `recorded` separately, then captures history *and* records the op). Don't re-nest the op-log inside the `if (this.history)` guard.
- **Source is frame-level**, not a per-tool param — no per-tool schema change for source; only `get_changes_since` is a new schema.
- **Test harness:** `setup()` exists but doesn't take a config; the provenance tests build their own TestBed with `provideAgentBridge({ transports: [], canMutate/onOp/opLog })` (helpers shown in the tasks). `newFlow()` mirrors `setup()`'s child-injector pattern. Reuse `makeNode` if present, or inline node literals as the tests above do.
- **Fail-safe canMutate:** a throw → deny (-32001), surfaced via `onError`. Confirm the dispatch catch ordering puts `MutationDeniedError` before the generic `-32603` fallback.
