# Bridge summarized / scoped / collapse-aware reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact `get_summary` digest and scope/collapse-awareness to `get_state` so an AI agent can read a large board without a context bomb and sees what the human sees.

**Architecture:** A single new service getter (`getCollapsedHiddenIds`) wraps the existing `FlowStore.collapsedHiddenIds` computed; everything else is composed in the agent-bridge handlers from existing service reads (`getNodes`, `getEdges`, `getViewport`, `getNodesBounds`, `isNodeIntersecting`) plus three pure helpers (`descendantIdsOf`, `inducedEdges`, `nodeTitle`). `get_state` gains a `collapsedHiddenIds` return key and optional `groupId`/`bounds` scoping; `get_summary` is a new read-only tool.

**Tech Stack:** TypeScript, `@angflow/angular` (ngc, vitest), `@angflow/mcp` (schema snapshot).

**Spec:** `docs/superpowers/specs/2026-06-14-bridge-summarized-reads-design.md`

---

### Task 1: `NgFlowService.getCollapsedHiddenIds()`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (add method near the other read getters, e.g. after `getNodesBounds` ~line 746)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts`

- [ ] **Step 1: Write the failing test**

In `packages/angular/src/lib/services/ng-flow.service.spec.ts`, add a new describe block (the file already defines `makeNode(id, overrides)` and a `service` instance in `beforeEach`):

```ts
describe('getCollapsedHiddenIds', () => {
  it('returns [] when nothing is collapsed', () => {
    service.setNodes([makeNode('g', { type: 'group' }), makeNode('a', { parentId: 'g' })]);
    expect(service.getCollapsedHiddenIds()).toEqual([]);
  });

  it('returns the nesting-aware descendants of a collapsed group', () => {
    service.setNodes([
      makeNode('g', { type: 'group', collapsed: true }),
      makeNode('a', { parentId: 'g' }),
      makeNode('b', { parentId: 'g' }),
      makeNode('c'),
    ]);
    expect(service.getCollapsedHiddenIds().sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "getCollapsedHiddenIds"`
Expected: FAIL — `service.getCollapsedHiddenIds is not a function`.

- [ ] **Step 3: Add the method**

In `packages/angular/src/lib/services/ng-flow.service.ts`, after the `getNodesBounds` method (~line 746-748):

```ts
  /**
   * Ids of all nodes currently hidden because an ancestor group is collapsed
   * (nesting-aware). Non-reactive snapshot — prefer the store signal in templates.
   */
  getCollapsedHiddenIds(): string[] {
    return Array.from(this.store.collapsedHiddenIds());
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "getCollapsedHiddenIds"`
Expected: PASS (2).

- [ ] **Step 5: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): NgFlowService.getCollapsedHiddenIds()"
```

---

### Task 2: `get_state` returns `collapsedHiddenIds`

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`get_state` handler ~lines 480-484)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing test**

In `agent-bridge.spec.ts`, add a new describe block (the file defines `setup()` → `{ bridge, newFlow }` and `makeNode`). Place it near the other read-tool tests:

```ts
describe('summarized / scoped reads', () => {
  it('get_state reports collapsedHiddenIds (empty, then populated)', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    flow.setNodes([makeNode('g', { type: 'group' }), makeNode('a', { parentId: 'g' })]);
    let res = (await bridge.callTool('get_state', {})) as { collapsedHiddenIds: string[] };
    expect(res.collapsedHiddenIds).toEqual([]);

    flow.setNodes([makeNode('g', { type: 'group', collapsed: true }), makeNode('a', { parentId: 'g' })]);
    res = (await bridge.callTool('get_state', {})) as { collapsedHiddenIds: string[] };
    expect(res.collapsedHiddenIds).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "collapsedHiddenIds"`
Expected: FAIL — `res.collapsedHiddenIds` is undefined.

- [ ] **Step 3: Update the `get_state` handler**

In `packages/angular/src/lib/agent/agent-bridge.service.ts`, replace the `get_state` handler (~lines 480-484):

```ts
    this.handlers.set('get_state', (flow) => ({
      nodes: flow.getNodes(),
      edges: flow.getEdges(),
      viewport: flow.getViewport(),
      collapsedHiddenIds: flow.getCollapsedHiddenIds(),
    }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "collapsedHiddenIds"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): get_state reports collapsedHiddenIds"
```

---

### Task 3: `get_state` scoping (`groupId` / `bounds`) + helpers

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (`get_state` handler again; add `descendantIdsOf`, `inducedEdges`, `requireRect` helpers near the other param helpers ~line 1224)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Inside the `describe('summarized / scoped reads', ...)` block, add:

```ts
it('get_state({ groupId }) returns the group subtree + induced edges', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('g', { type: 'group' }),
    makeNode('a', { parentId: 'g' }),
    makeNode('b', { parentId: 'g' }),
    makeNode('c'),
  ]);
  flow.setEdges([
    { id: 'ab', source: 'a', target: 'b' } as Edge,   // induced — kept
    { id: 'bc', source: 'b', target: 'c' } as Edge,   // crosses out — dropped
  ]);
  const res = (await bridge.callTool('get_state', { groupId: 'g' })) as {
    nodes: { id: string }[];
    edges: { id: string }[];
  };
  expect(res.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']); // group node 'g' excluded
  expect(res.edges.map((e) => e.id)).toEqual(['ab']);
});

it('get_state rejects an unknown groupId with -32602', async () => {
  const { bridge, newFlow } = setup();
  bridge.register('main', newFlow());
  await expect(bridge.callTool('get_state', { groupId: 'nope' })).rejects.toMatchObject({ code: -32602 });
});

it('get_state rejects groupId + bounds together with -32602', async () => {
  const { bridge, newFlow } = setup();
  bridge.register('main', newFlow());
  await expect(
    bridge.callTool('get_state', { groupId: 'g', bounds: { x: 0, y: 0, width: 1, height: 1 } }),
  ).rejects.toMatchObject({ code: -32602 });
});

it('get_state({ bounds }) returns intersecting nodes + induced edges', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('near', { position: { x: 0, y: 0 }, width: 100, height: 100 }),
    makeNode('far', { position: { x: 10000, y: 10000 }, width: 100, height: 100 }),
  ]);
  flow.setEdges([{ id: 'nf', source: 'near', target: 'far' } as Edge]);
  const res = (await bridge.callTool('get_state', {
    bounds: { x: -10, y: -10, width: 50, height: 50 },
  })) as { nodes: { id: string }[]; edges: { id: string }[] };
  expect(res.nodes.map((n) => n.id)).toEqual(['near']);
  expect(res.edges).toEqual([]); // 'nf' crosses out of scope
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "get_state"`
Expected: the 4 new scoping tests FAIL (handler ignores `groupId`/`bounds`).

- [ ] **Step 3: Add the helpers**

In `packages/angular/src/lib/agent/agent-bridge.service.ts`, after `optionalPositiveNumber` (~line 1224):

```ts
function requireRect(
  params: Record<string, unknown>,
  key: string,
): { x: number; y: number; width: number; height: number } {
  const v = requireObject(params, key);
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    if (typeof v[k] !== 'number' || !Number.isFinite(v[k])) {
      throw new InvalidParamsError(`Param "${key}.${k}" must be a finite number.`);
    }
  }
  return v as { x: number; y: number; width: number; height: number };
}

/** Nesting-aware descendant ids of a node (excludes the node itself; cycle-guarded). */
function descendantIdsOf(groupId: string, nodes: readonly Node[]): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId != null) {
      const arr = childrenByParent.get(n.parentId);
      if (arr) arr.push(n.id);
      else childrenByParent.set(n.parentId, [n.id]);
    }
  }
  const out = new Set<string>();
  const queue = [...(childrenByParent.get(groupId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (out.has(id)) continue; // self-parent / cycle guard
    out.add(id);
    const kids = childrenByParent.get(id);
    if (kids) queue.push(...kids);
  }
  return out;
}

/** Edges whose source AND target are both in the id set. */
function inducedEdges(edges: readonly Edge[], nodeIds: ReadonlySet<string>): Edge[] {
  return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
}
```

- [ ] **Step 4: Update the `get_state` handler for scoping**

Replace the `get_state` handler (the version from Task 2) with:

```ts
    this.handlers.set('get_state', (flow, params) => {
      const hasGroup = params['groupId'] !== undefined;
      const hasBounds = params['bounds'] !== undefined;
      if (hasGroup && hasBounds) {
        throw new InvalidParamsError('Pass either "groupId" or "bounds", not both.');
      }
      const allNodes = flow.getNodes();
      const allEdges = flow.getEdges();
      let nodes = allNodes;
      let edges = allEdges;
      if (hasGroup) {
        const groupId = requireString(params, 'groupId');
        if (!flow.getNode(groupId)) {
          throw new InvalidParamsError(`get_state: no node with id "${groupId}".`);
        }
        const ids = descendantIdsOf(groupId, allNodes);
        nodes = allNodes.filter((n) => ids.has(n.id));
        edges = inducedEdges(allEdges, ids);
      } else if (hasBounds) {
        const rect = requireRect(params, 'bounds');
        nodes = allNodes.filter((n) => flow.isNodeIntersecting(n, rect, true));
        const idSet = new Set(nodes.map((n) => n.id));
        edges = inducedEdges(allEdges, idSet);
      }
      return {
        nodes,
        edges,
        viewport: flow.getViewport(),
        collapsedHiddenIds: flow.getCollapsedHiddenIds(),
      };
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "get_state"`
Expected: PASS (all get_state tests, including the Task 2 collapsedHiddenIds one).

- [ ] **Step 6: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): scope get_state by groupId or bounds"
```

---

### Task 4: `get_summary` tool + `nodeTitle` helper

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (register `get_summary` in `installHandlers`, e.g. right after `get_state`; add `nodeTitle` helper near the others)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Inside the `describe('summarized / scoped reads', ...)` block, add:

```ts
it('get_summary returns counts, groups, titles, bounds, collapsedHiddenIds', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('g', { type: 'group', collapsed: true, data: { label: 'Container' } }),
    makeNode('a', { parentId: 'g', data: { label: 'Alpha' }, width: 50, height: 50 }),
    makeNode('b', { type: 'idea', data: { name: 'Bee' }, width: 50, height: 50 }),
  ]);
  flow.setEdges([{ id: 'ab', source: 'a', target: 'b' } as Edge]);
  const res = (await bridge.callTool('get_summary', {})) as {
    counts: { nodes: number; edges: number; groups: number };
    groups: { id: string; label: string; collapsed: boolean; memberCount: number }[];
    titles: { id: string; type: string; label: string }[];
    bounds: { x: number; y: number; width: number; height: number } | null;
    collapsedHiddenIds: string[];
  };
  expect(res.counts).toEqual({ nodes: 3, edges: 1, groups: 1 });
  expect(res.groups).toEqual([{ id: 'g', label: 'Container', collapsed: true, memberCount: 1 }]);
  // title heuristic: data.label, then data.name, then type
  const titleOf = (id: string) => res.titles.find((t) => t.id === id)!;
  expect(titleOf('a').label).toBe('Alpha');
  expect(titleOf('b')).toEqual({ id: 'b', type: 'idea', label: 'Bee' });
  expect(res.bounds).not.toBeNull();
  expect(res.collapsedHiddenIds).toEqual(['a']);
});

it('get_summary returns bounds: null for an empty flow', async () => {
  const { bridge, newFlow } = setup();
  bridge.register('main', newFlow());
  const res = (await bridge.callTool('get_summary', {})) as { bounds: unknown; counts: { nodes: number } };
  expect(res.counts.nodes).toBe(0);
  expect(res.bounds).toBeNull();
});

it('get_summary does not capture a history entry', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([makeNode('a')]);
  await bridge.callTool('get_summary', {});
  const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
  expect(status.pastDepth).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "get_summary"`
Expected: FAIL — `Unknown method: get_summary` (`-32601`).

- [ ] **Step 3: Add the `nodeTitle` helper**

In `agent-bridge.service.ts`, after the `descendantIdsOf`/`inducedEdges` helpers added in Task 3:

```ts
/** Best-effort display title for a node: data.label/title/name, else type, else id. */
function nodeTitle(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  for (const key of ['label', 'title', 'name'] as const) {
    const v = data?.[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  if (typeof node.type === 'string' && node.type.length > 0) return node.type;
  return node.id;
}
```

- [ ] **Step 4: Register the `get_summary` handler**

In `installHandlers()`, immediately after the `get_state` handler:

```ts
    this.handlers.set('get_summary', (flow) => {
      const nodes = flow.getNodes();
      const edges = flow.getEdges();
      const groups = nodes
        .filter((n) => n.type === 'group')
        .map((g) => ({
          id: g.id,
          label: nodeTitle(g),
          collapsed: g.collapsed === true,
          memberCount: descendantIdsOf(g.id, nodes).size,
        }));
      return {
        counts: { nodes: nodes.length, edges: edges.length, groups: groups.length },
        groups,
        titles: nodes.map((n) => ({ id: n.id, type: n.type ?? 'default', label: nodeTitle(n) })),
        viewport: flow.getViewport(),
        bounds: nodes.length > 0 ? flow.getNodesBounds(nodes) : null,
        collapsedHiddenIds: flow.getCollapsedHiddenIds(),
      };
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "get_summary"`
Expected: PASS (3).

- [ ] **Step 6: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): get_summary compact digest tool"
```

---

### Task 5: Tool schemas + AGENT_BRIDGE.md + MCP snapshot

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (`get_state` entry ~lines 16-28; add a `get_summary` entry)
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Modify: `packages/mcp/...` snapshot (regenerated, not hand-edited)

- [ ] **Step 1: Update the `get_state` schema**

In `packages/angular/src/lib/agent/tool-schemas.ts`, replace the `get_state` entry (~lines 16-28) with:

```ts
  {
    name: 'get_state',
    description:
      'Return a snapshot of a flow: { nodes, edges, viewport, collapsedHiddenIds }. ' +
      'collapsedHiddenIds lists nodes hidden because an ancestor group is collapsed. ' +
      'Optionally scope to a group subtree (groupId) OR a bounds rect — not both. ' +
      'For a compact overview of a large board, prefer get_summary.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'Flow id. Omit if exactly one flow is registered.' },
        groupId: {
          type: 'string',
          description: 'Scope to this node\'s nesting-aware descendant subtree (group node excluded).',
        },
        bounds: {
          type: 'object',
          description: 'Scope to nodes intersecting this rect (flow coordinates).',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      additionalProperties: false,
    },
  },
```

- [ ] **Step 2: Add the `get_summary` schema**

Immediately after the `get_state` entry, add:

```ts
  {
    name: 'get_summary',
    description:
      'Compact digest of a flow for large boards (avoids dumping every node). Returns ' +
      '{ counts: { nodes, edges, groups }, groups: [{ id, label, collapsed, memberCount }], ' +
      'titles: [{ id, type, label }], viewport, bounds, collapsedHiddenIds }. ' +
      'titles carry id/type/label only (no data/style); use get_state (optionally scoped) for full node data.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' } },
      additionalProperties: false,
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Update `AGENT_BRIDGE.md`**

In `packages/angular/AGENT_BRIDGE.md`, in the **Discovery / read** table:
- Change the `get_state` row to: params `groupId?`, `bounds?: { x, y, width, height }`; Returns `{ nodes, edges, viewport, collapsedHiddenIds }`. Notes: "Optionally scope to a group's nesting-aware subtree (`groupId`) or a bounds rect (`bounds`) — not both (`-32602`); unknown `groupId` → `-32602`. `collapsedHiddenIds` is the board-wide set of nodes hidden by collapse."
- Add a `get_summary` row: params — (none); Returns `{ counts, groups, titles, viewport, bounds, collapsedHiddenIds }`; Notes: "Compact digest for large boards. `groups` = one entry per `type:'group'` node (`memberCount` is nesting-aware). `titles` = `{ id, type, label }` per node — no `data`/`style`. `bounds` is the bounding rect of all nodes (`null` when empty)."

Match the existing table's column structure (read the Discovery/read table first). If there's a natural place for a short prose note on the digest shape, add one sentence; otherwise the table Notes suffice.

- [ ] **Step 5: Regenerate the MCP snapshot**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp run generate:schemas`
Expected: rebuilds angular and rewrites the snapshot; it should now include `get_summary` and the new `get_state` params (tool count goes from 51 to 52).

If `pnpm -F @angflow/angular build` fails for an unrelated environment reason, STOP and report BLOCKED with the error.

- [ ] **Step 6: Run the MCP drift test**

Run: `pnpm -F @angflow/mcp run test`
Expected: PASS (schema-drift test green against the regenerated snapshot).

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/AGENT_BRIDGE.md packages/mcp
git commit -m "docs(agent): schemas + AGENT_BRIDGE for get_summary / scoped get_state; regen mcp snapshot"
```

---

### Task 6: Full verification + mark feedback #17

**Files:** none (verification); then `brainstorm_agentic_app/docs/angflow-feedback.md` (separate repo — confirm before committing there)

- [ ] **Step 1: Build angular → mcp**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp build`
Expected: both build clean. (`@angflow/system` is unchanged this unit.)

- [ ] **Step 2: Run the full test suites**

Run: `pnpm -F @angflow/angular test && pnpm -F @angflow/mcp test`
Expected: all green.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (Mirrors CI.)

- [ ] **Step 4: Mark the feedback entry**

In `C:/Users/shisu/CodeWeb/brainstorm_agentic_app/docs/angflow-feedback.md`, change entry #17's heading marker from `⛳` to `✅` and append a `**✅ Fixed in angflow**` bullet noting: `get_summary` digest (counts/groups/titles/viewport/bounds/collapsedHiddenIds) + `get_state` scoping (`groupId`/`bounds`) and `collapsedHiddenIds`; shipped in the next `@angflow/angular` + `@angflow/mcp` patch (note "not yet published" / "not yet adopted here" if unpublished at the time). Reference the commit/PR.

- [ ] **Step 5: Commit the feedback update**

```bash
cd C:/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs: mark angflow feedback #17 fixed (summarized/scoped reads)"
```

> NOTE: the feedback file is in a separate git repo. Confirm with the user before committing there (publish status may affect whether to mark it now or after publish).

---

## Publish (manual — requires npm 2FA, do with the user)

Per `CLAUDE.md`: bump + publish in order. `@angflow/system` is unchanged this unit.

1. `packages/angular`: `npm version patch && npm run build && pnpm publish --access public`
2. `packages/mcp`: `npm version patch && npm run build && npm publish --access public`

## Notes for the implementer

- **Spec coverage:** `getCollapsedHiddenIds` (Task 1), `get_state` collapsedHiddenIds (Task 2), `get_state` scoping + helpers (Task 3), `get_summary` + `nodeTitle` (Task 4), schemas + docs + snapshot (Task 5), verification + feedback (Task 6).
- **Test harness:** the bridge spec uses `setup()` → `{ bridge, newFlow }`; `newFlow()` flows have **no panZoom and no DOM** — so give nodes explicit `width`/`height` in the `bounds` test (no `measured` is available). `makeNode(id, overrides)` is defined at the top of the spec; collapse is set by putting `collapsed: true` on the group node and `parentId` on members (no panZoom needed — `collapsedHiddenIds` derives from the node lookup).
- **Store rule:** only `getCollapsedHiddenIds` touches the store; all bridge handlers compose service reads + the pure helpers. Don't reach into `FlowStore` from a handler.
- **Read-only:** neither `get_state` nor `get_summary` is in `MUTATING_TOOLS`; they must not capture history (Task 4 has an explicit no-history test).
- **`Node`/`Edge` types** are already imported in `agent-bridge.service.ts` (`import type { Node, Edge } from '../types';`). The helpers use them directly.
