# Bridge group / container lifecycle + server-minted ids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-class group lifecycle agent-bridge tools (`group_nodes`, `set_node_group`, `set_group_collapsed`, `dissolve_group`, `get_group_bounds`) plus server-minted ids on `add_node`/`group_nodes`.

**Architecture:** New `NgFlowService` methods (`groupNodes`, `setNodeGroup`, `dissolveGroup`, `getGroupBox`) own the coordinate logic — every reparent captures absolute positions first and re-bases via `setNodePositions({coordinateSpace:'absolute'})` so nodes stay visually pinned. Bridge handlers wrap them; a `mintId` helper makes ids optional. Reuses #17's `descendantIdsOf`/`buildChildMap` for the cycle guard.

**Tech Stack:** TypeScript, `@angflow/angular` (ngc, vitest), `@angflow/mcp` (schema snapshot).

**Spec:** `docs/superpowers/specs/2026-06-14-bridge-group-lifecycle-design.md`

---

### Task 1: `NgFlowService.groupNodes`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (add after `sizeGroupToChildren`, ~line 324)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts`

- [ ] **Step 1: Write the failing test**

In `ng-flow.service.spec.ts`, add a describe block (`makeNode(id, overrides)` and `service` are defined in the file):

```ts
describe('groupNodes', () => {
  it('creates a group node, reparents members, and pins them visually', async () => {
    service.setNodes([
      makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('b', { position: { x: 300, y: 200 }, width: 50, height: 50 }),
    ]);
    const gid = await service.groupNodes(['a', 'b'], { groupId: 'g', label: 'G' });
    expect(gid).toBe('g');
    const g = service.getNode('g');
    expect(g?.type).toBe('group');
    expect(g?.data?.['label']).toBe('G');
    expect(service.getNode('a')?.parentId).toBe('g');
    expect(service.getNode('b')?.parentId).toBe('g');
    // visually pinned — absolute positions unchanged
    expect(service.getAbsolutePosition('a')).toEqual({ x: 100, y: 100 });
    expect(service.getAbsolutePosition('b')).toEqual({ x: 300, y: 200 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "groupNodes"`
Expected: FAIL — `service.groupNodes is not a function`.

- [ ] **Step 3: Implement `groupNodes`**

In `ng-flow.service.ts`, after `sizeGroupToChildren` (~line 324). `getGroupBounds`/`GroupBoundsOptions` are already imported; `addNodes`/`updateNode`/`getInternalNode`/`getAbsolutePosition`/`setNodePositions` exist on the class.

```ts
  /**
   * Create a `type:'group'` node wrapping the given nodes, reparent them into it,
   * and pin them visually (their absolute positions are preserved). Returns the
   * group id. The group box wraps members with `padding`/`headerHeight` insets.
   */
  async groupNodes(
    nodeIds: string[],
    opts?: { groupId?: string; label?: string; collapsed?: boolean; padding?: number; headerHeight?: number },
  ): Promise<string> {
    const groupId = opts?.groupId ?? `group_${nodeIds.join('-')}`;
    const members = nodeIds
      .map((id) => this.getInternalNode(id))
      .filter((n): n is InternalNode<NodeType> => n != null);
    const abs: Record<string, { x: number; y: number }> = {};
    const memberBoxes = members.map((m) => {
      const a = this.getAbsolutePosition(m.id)!;
      abs[m.id] = a;
      return { position: a, measured: m.measured, width: m.width, height: m.height };
    });
    const box = getGroupBounds(memberBoxes, {
      padding: opts?.padding ?? 20,
      headerHeight: opts?.headerHeight ?? 40,
    });
    this.addNodes({
      id: groupId,
      type: 'group',
      position: { x: box.position.x, y: box.position.y },
      width: box.width,
      height: box.height,
      data: opts?.label != null ? { label: opts.label } : {},
      ...(opts?.collapsed != null ? { collapsed: opts.collapsed } : {}),
    } as unknown as NodeType);
    this.store.batch(() => {
      for (const m of members) this.updateNode(m.id, { parentId: groupId } as Partial<NodeType>);
    });
    await this.setNodePositions(
      { [groupId]: box.position, ...abs },
      { coordinateSpace: 'absolute', animate: false },
    );
    return groupId;
  }
```

(Confirm `this.store.batch` exists — it's used elsewhere in the codebase; if the method name differs, drop the `batch()` wrapper and call `updateNode` in a plain loop.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "groupNodes"`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): NgFlowService.groupNodes (visually-stable grouping)"
```

---

### Task 2: `NgFlowService.setNodeGroup`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (after `groupNodes`)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('setNodeGroup', () => {
  it('reparents a node into a group, preserving its absolute position', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { position: { x: 200, y: 200 }, width: 50, height: 50 }),
    ]);
    await service.setNodeGroup('a', 'g');
    expect(service.getNode('a')?.parentId).toBe('g');
    expect(service.getAbsolutePosition('a')).toEqual({ x: 200, y: 200 });
  });

  it('detaches a node to top-level when groupId is null, preserving absolute position', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 150, y: 150 }, width: 50, height: 50 }),
    ]);
    const before = service.getAbsolutePosition('a');
    await service.setNodeGroup('a', null);
    expect(service.getNode('a')?.parentId).toBeUndefined();
    expect(service.getAbsolutePosition('a')).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "setNodeGroup"`
Expected: FAIL — `service.setNodeGroup is not a function`.

- [ ] **Step 3: Implement `setNodeGroup`**

After `groupNodes`:

```ts
  /**
   * Reparent a node into `groupId` (or detach to top-level when `null`), keeping
   * it visually fixed. Caller must ensure no cycle (the agent bridge guards this).
   */
  async setNodeGroup(nodeId: string, groupId: string | null): Promise<void> {
    if (!this.getNode(nodeId)) return;
    const abs = this.getAbsolutePosition(nodeId);
    this.updateNode(nodeId, { parentId: groupId ?? undefined } as Partial<NodeType>);
    if (abs) {
      await this.setNodePositions({ [nodeId]: abs }, { coordinateSpace: 'absolute', animate: false });
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "setNodeGroup"`
Expected: PASS (2).

- [ ] **Step 5: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): NgFlowService.setNodeGroup (reparent/detach, pinned)"
```

---

### Task 3: `NgFlowService.dissolveGroup`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (after `setNodeGroup`)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('dissolveGroup', () => {
  it('removes the group, frees its children to top-level, and pins them', async () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 50 }, width: 400, height: 400 }),
      makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
      makeNode('b', { parentId: 'g', position: { x: 150, y: 150 }, width: 50, height: 50 }),
    ]);
    const absA = service.getAbsolutePosition('a');
    const freed = await service.dissolveGroup('g');
    expect(freed.sort()).toEqual(['a', 'b']);
    expect(service.getNode('g')).toBeUndefined();
    expect(service.getNode('a')?.parentId).toBeUndefined();
    expect(service.getAbsolutePosition('a')).toEqual(absA);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "dissolveGroup"`
Expected: FAIL — `service.dissolveGroup is not a function`.

- [ ] **Step 3: Implement `dissolveGroup`**

After `setNodeGroup`:

```ts
  /**
   * Remove a group node; its direct children survive, reparented to the group's
   * own parent (top-level if it had none) and pinned in place. Returns freed ids.
   */
  async dissolveGroup(groupId: string): Promise<string[]> {
    const group = this.getNode(groupId);
    if (!group) return [];
    const newParent = group.parentId;
    const children = this.getNodes().filter((n) => n.parentId === groupId);
    const childAbs: Record<string, { x: number; y: number }> = {};
    for (const c of children) {
      const a = this.getAbsolutePosition(c.id);
      if (a) childAbs[c.id] = a;
    }
    this.store.batch(() => {
      for (const c of children) this.updateNode(c.id, { parentId: newParent } as Partial<NodeType>);
    });
    await this.deleteElements({ nodes: [{ id: groupId }] });
    if (Object.keys(childAbs).length > 0) {
      await this.setNodePositions(childAbs, { coordinateSpace: 'absolute', animate: false });
    }
    return children.map((c) => c.id);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "dissolveGroup"`
Expected: PASS.

- [ ] **Step 5: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): NgFlowService.dissolveGroup (free + pin children)"
```

---

### Task 4: `NgFlowService.getGroupBox`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (after `dissolveGroup`)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('getGroupBox', () => {
  it('returns the current absolute box of a group, null for unknown id', () => {
    service.setNodes([
      makeNode('g', { type: 'group', position: { x: 50, y: 60 }, width: 300, height: 200 }),
    ]);
    expect(service.getGroupBox('g')).toEqual({ x: 50, y: 60, width: 300, height: 200 });
    expect(service.getGroupBox('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "getGroupBox"`
Expected: FAIL — `service.getGroupBox is not a function`.

- [ ] **Step 3: Implement `getGroupBox`**

After `dissolveGroup`:

```ts
  /**
   * Current rendered box of a group on the canvas: absolute top-left +
   * measured (or declared) size. Returns null for an unknown id.
   */
  getGroupBox(groupId: string): { x: number; y: number; width: number; height: number } | null {
    const node = this.getNode(groupId);
    if (!node) return null;
    const pos = this.getAbsolutePosition(groupId) ?? node.position;
    const internal = this.getInternalNode(groupId);
    const width = internal?.measured?.width ?? node.width ?? 0;
    const height = internal?.measured?.height ?? node.height ?? 0;
    return { x: pos.x, y: pos.y, width, height };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts -t "getGroupBox"`
Expected: PASS.

- [ ] **Step 5: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): NgFlowService.getGroupBox (current box query)"
```

---

### Task 5: Bridge — server-minted ids (`mintId` + optional `add_node` id)

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (add `nextNodeIdSeq` field + `mintId` method on the class; update the `add_node` handler ~line 548)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add a new describe block to `agent-bridge.spec.ts`:

```ts
describe('group lifecycle + minted ids', () => {
  it('add_node mints an id when omitted and returns the created node', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    const node = (await bridge.callTool('add_node', {
      node: { position: { x: 0, y: 0 }, data: {} },
    })) as { id: string } | null;
    expect(typeof node?.id).toBe('string');
    expect(node!.id.length).toBeGreaterThan(0);
    expect(flow.getNode(node!.id)).toBeTruthy();
  });

  it('add_node honors an agent-supplied id', async () => {
    const { bridge, newFlow } = setup();
    const flow = newFlow();
    bridge.register('main', flow);
    const node = (await bridge.callTool('add_node', {
      node: { id: 'mine', position: { x: 0, y: 0 }, data: {} },
    })) as { id: string };
    expect(node.id).toBe('mine');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "add_node mints"`
Expected: FAIL — `validateNodeShape` rejects the missing `id` with `-32602`.

- [ ] **Step 3: Add `nextNodeIdSeq` field + `mintId` method**

In `agent-bridge.service.ts`, add a field near `nextInProcessId` (~line 115):

```ts
  private nextNodeIdSeq = 0;
```

Add a private method on the class (near `findFlowId`, after the `getFlow` method ~line 195):

```ts
  /** Mint a unique node/group id for a flow (collision-safe vs agent-supplied ids). */
  private mintId(flow: NgFlowService, prefix: string): string {
    let id: string;
    do {
      id = `${prefix}_${++this.nextNodeIdSeq}`;
    } while (flow.getNode(id));
    return id;
  }
```

- [ ] **Step 4: Update the `add_node` handler to mint when id is absent**

Replace the `add_node` handler (~lines 548-552):

```ts
    this.handlers.set('add_node', (flow, params) => {
      const raw = requireObject(params, 'node');
      if (raw['id'] == null || raw['id'] === '') {
        raw['id'] = this.mintId(flow, 'node');
      }
      const node = validateNodeShape(raw, 'add_node');
      flow.addNodes(node);
      return flow.getNode(node.id) ?? null;
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "add_node"`
Expected: PASS (the two new tests + existing add_node tests).

- [ ] **Step 6: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): server-minted ids — add_node id optional"
```

---

### Task 6: Bridge — `group_nodes` + `set_node_group`

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (register handlers after `add_node`; add both to `MUTATING_TOOLS`)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Inside the `group lifecycle + minted ids` describe block:

```ts
it('group_nodes creates a group (minted id) and reparents members', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
    makeNode('b', { position: { x: 300, y: 200 }, width: 50, height: 50 }),
  ]);
  const res = (await bridge.callTool('group_nodes', { nodeIds: ['a', 'b'], label: 'G' })) as { groupId: string };
  expect(typeof res.groupId).toBe('string');
  expect(flow.getNode(res.groupId)?.type).toBe('group');
  expect(flow.getNode('a')?.parentId).toBe(res.groupId);
});

it('group_nodes rejects empty/unknown nodeIds with -32602', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([makeNode('a')]);
  await expect(bridge.callTool('group_nodes', { nodeIds: [] })).rejects.toMatchObject({ code: -32602 });
  await expect(bridge.callTool('group_nodes', { nodeIds: ['ghost'] })).rejects.toMatchObject({ code: -32602 });
});

it('set_node_group reparents and rejects cycles with -32602', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('g', { type: 'group', position: { x: 0, y: 0 }, width: 400, height: 400 }),
    makeNode('a', { position: { x: 100, y: 100 }, width: 50, height: 50 }),
  ]);
  const res = (await bridge.callTool('set_node_group', { nodeId: 'a', groupId: 'g' })) as { nodeId: string; groupId: string | null };
  expect(res).toEqual({ nodeId: 'a', groupId: 'g' });
  expect(flow.getNode('a')?.parentId).toBe('g');
  // cycle: make 'g' a child of 'a' would be a cycle
  await expect(bridge.callTool('set_node_group', { nodeId: 'g', groupId: 'a' })).rejects.toMatchObject({ code: -32602 });
});

it('set_node_group detaches to top-level with groupId null', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('g', { type: 'group', position: { x: 0, y: 0 }, width: 400, height: 400 }),
    makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
  ]);
  await bridge.callTool('set_node_group', { nodeId: 'a', groupId: null });
  expect(flow.getNode('a')?.parentId).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "group_nodes"`
Expected: FAIL — `Unknown method: group_nodes`.

- [ ] **Step 3: Add both tools to `MUTATING_TOOLS`**

In `agent-bridge.service.ts`, add to the `MUTATING_TOOLS` set (~lines 49-61):

```ts
  'group_nodes',
  'set_node_group',
  'set_group_collapsed',
  'dissolve_group',
```

(All four mutating group tools added now; the latter two are wired in Task 7.)

- [ ] **Step 4: Register the `group_nodes` and `set_node_group` handlers**

After the `add_node` handler:

```ts
    this.handlers.set('group_nodes', async (flow, params) => {
      const nodeIds = optionalStringArray(params, 'nodeIds');
      if (!nodeIds || nodeIds.length === 0) {
        throw new InvalidParamsError('Param "nodeIds" must be a non-empty array of strings.');
      }
      for (const id of nodeIds) {
        if (!flow.getNode(id)) throw new InvalidParamsError(`group_nodes: unknown node id "${id}".`);
      }
      const groupId = typeof params['groupId'] === 'string' && params['groupId'] ? (params['groupId'] as string) : this.mintId(flow, 'group');
      const label = typeof params['label'] === 'string' ? (params['label'] as string) : undefined;
      const collapsed = typeof params['collapsed'] === 'boolean' ? (params['collapsed'] as boolean) : undefined;
      const padding = optionalPositiveNumber(params, 'padding');
      const headerHeight = typeof params['headerHeight'] === 'number' ? (params['headerHeight'] as number) : undefined;
      await flow.groupNodes(nodeIds, { groupId, label, collapsed, padding, headerHeight });
      return { groupId };
    });

    this.handlers.set('set_node_group', async (flow, params) => {
      const nodeId = requireString(params, 'nodeId');
      if (!flow.getNode(nodeId)) throw new InvalidParamsError(`set_node_group: unknown node id "${nodeId}".`);
      const rawGroup = params['groupId'];
      if (rawGroup !== null && typeof rawGroup !== 'string') {
        throw new InvalidParamsError('Param "groupId" must be a string or null.');
      }
      const groupId = rawGroup as string | null;
      if (groupId !== null) {
        if (!flow.getNode(groupId)) throw new InvalidParamsError(`set_node_group: unknown group id "${groupId}".`);
        if (groupId === nodeId || descendantIdsOf(nodeId, buildChildMap(flow.getNodes())).has(groupId)) {
          throw new InvalidParamsError('set_node_group: groupId would create a cycle (it is the node or a descendant).');
        }
      }
      await flow.setNodeGroup(nodeId, groupId);
      return { nodeId, groupId };
    });
```

(`optionalPositiveNumber`, `descendantIdsOf`, `buildChildMap`, `requireString`, `optionalStringArray`, `InvalidParamsError` all already exist in this file from earlier units.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "group_nodes"` then `-t "set_node_group"`
Expected: PASS.

- [ ] **Step 6: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): group_nodes + set_node_group tools"
```

---

### Task 7: Bridge — `set_group_collapsed` + `dissolve_group` + `get_group_bounds`

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (register handlers after `set_node_group`)
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Inside the same describe block:

```ts
it('set_group_collapsed flips the collapsed flag', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([makeNode('g', { type: 'group' }), makeNode('a', { parentId: 'g' })]);
  const res = (await bridge.callTool('set_group_collapsed', { groupId: 'g', collapsed: true })) as { groupId: string; collapsed: boolean };
  expect(res).toEqual({ groupId: 'g', collapsed: true });
  const state = (await bridge.callTool('get_state', {})) as { collapsedHiddenIds: string[] };
  expect(state.collapsedHiddenIds).toEqual(['a']);
});

it('dissolve_group removes the group and returns member ids', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([
    makeNode('g', { type: 'group', position: { x: 0, y: 0 }, width: 400, height: 400 }),
    makeNode('a', { parentId: 'g', position: { x: 100, y: 100 }, width: 50, height: 50 }),
  ]);
  const res = (await bridge.callTool('dissolve_group', { groupId: 'g' })) as { dissolvedGroupId: string; memberIds: string[] };
  expect(res).toEqual({ dissolvedGroupId: 'g', memberIds: ['a'] });
  expect(flow.getNode('g')).toBeUndefined();
  expect(flow.getNode('a')?.parentId).toBeUndefined();
});

it('get_group_bounds returns the box, null for unknown, and captures no history', async () => {
  const { bridge, newFlow } = setup();
  const flow = newFlow();
  bridge.register('main', flow);
  flow.setNodes([makeNode('g', { type: 'group', position: { x: 10, y: 20 }, width: 200, height: 100 })]);
  const box = (await bridge.callTool('get_group_bounds', { groupId: 'g' })) as { x: number; y: number; width: number; height: number };
  expect(box).toEqual({ x: 10, y: 20, width: 200, height: 100 });
  expect(await bridge.callTool('get_group_bounds', { groupId: 'nope' })).toBeNull();
  const status = (await bridge.callTool('history_status', {})) as { pastDepth: number };
  expect(status.pastDepth).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "set_group_collapsed"` (and `dissolve_group`, `get_group_bounds`)
Expected: FAIL — unknown methods.

- [ ] **Step 3: Register the three handlers**

After the `set_node_group` handler:

```ts
    this.handlers.set('set_group_collapsed', (flow, params) => {
      const groupId = requireString(params, 'groupId');
      if (!flow.getNode(groupId)) throw new InvalidParamsError(`set_group_collapsed: unknown group id "${groupId}".`);
      const collapsed = params['collapsed'];
      if (typeof collapsed !== 'boolean') throw new InvalidParamsError('Param "collapsed" must be a boolean.');
      flow.setNodeCollapsed(groupId, collapsed);
      return { groupId, collapsed };
    });

    this.handlers.set('dissolve_group', async (flow, params) => {
      const groupId = requireString(params, 'groupId');
      if (!flow.getNode(groupId)) throw new InvalidParamsError(`dissolve_group: unknown group id "${groupId}".`);
      const memberIds = await flow.dissolveGroup(groupId);
      return { dissolvedGroupId: groupId, memberIds };
    });

    this.handlers.set('get_group_bounds', (flow, params) => {
      const groupId = requireString(params, 'groupId');
      if (!flow.getNode(groupId)) return null;
      return flow.getGroupBox(groupId);
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/angular && npx vitest run src/lib/agent/agent-bridge.spec.ts -t "group lifecycle"`
Expected: PASS (the whole describe block).

- [ ] **Step 5: Typecheck + Commit**

```bash
cd packages/angular && npx tsc --noEmit
git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts
git commit -m "feat(agent): set_group_collapsed + dissolve_group + get_group_bounds"
```

---

### Task 8: Tool schemas + AGENT_BRIDGE.md + MCP snapshot

**Files:**
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts`
- Modify: `packages/angular/AGENT_BRIDGE.md`
- Modify: `packages/mcp/...` snapshot (regenerated)

- [ ] **Step 1: Make `add_node`'s `id` optional in its schema**

In `tool-schemas.ts`, find the `add_node` entry's `node` object `required` array (`required: ['id', 'position', 'data']`, ~line 118) and change it to:

```ts
          required: ['position', 'data'],
```

Update the `add_node` tool `description` to append: `' If id is omitted, the bridge mints and returns one.'`

- [ ] **Step 2: Add the five group tool schemas**

After the `add_edge` entry (or anywhere in the array; keep them together), add:

```ts
  {
    name: 'group_nodes',
    description:
      'Create a group (container) node wrapping the given nodes and reparent them into it (visually pinned). ' +
      'Mints and returns a groupId when none is supplied. Returns { groupId }.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'Members to group (non-empty).' },
        label: { type: 'string', description: 'Group title (→ data.label).' },
        collapsed: { type: 'boolean' },
        groupId: { type: 'string', description: 'Optional id for the new group; minted when omitted.' },
        padding: { type: 'number', description: 'Box inset around members. Default 20.' },
        headerHeight: { type: 'number', description: 'Top inset for the title bar. Default 40.' },
      },
      required: ['nodeIds'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_node_group',
    description:
      'Reparent a node into a group (or detach to top-level with groupId null), keeping it visually fixed. ' +
      'Rejects cycles (-32602). Returns { nodeId, groupId }.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        nodeId: { type: 'string' },
        groupId: { type: ['string', 'null'], description: 'Target group id, or null to detach.' },
      },
      required: ['nodeId', 'groupId'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_group_collapsed',
    description: 'Collapse or expand a group node (hides/shows its descendants). Returns { groupId, collapsed }.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        groupId: { type: 'string' },
        collapsed: { type: 'boolean' },
      },
      required: ['groupId', 'collapsed'],
      additionalProperties: false,
    },
  },
  {
    name: 'dissolve_group',
    description:
      'Remove a group node; its direct children survive (reparented to the group\'s parent, pinned in place). ' +
      'Returns { dissolvedGroupId, memberIds }.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        groupId: { type: 'string' },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_group_bounds',
    description: "Return a group's current box on the canvas { x, y, width, height } (absolute), or null if absent.",
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'string' },
        groupId: { type: 'string' },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/angular && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Update `AGENT_BRIDGE.md`**

In `packages/angular/AGENT_BRIDGE.md`, add a new `### Groups` subsection in the Tool catalog (after the Mutate sections) with a table covering the five tools (params + returns + the "visually pinned" / cycle / mint notes from the schemas above). Also update the `add_node` row note to say its `id` is optional (minted + returned when omitted). Match the existing table column format.

- [ ] **Step 5: Regenerate the MCP snapshot**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp run generate:schemas`
Expected: rebuilds angular, rewrites the snapshot; tool count 52 → 57.

If `pnpm -F @angflow/angular build` fails for an unrelated reason, STOP and report BLOCKED.

- [ ] **Step 6: Run the MCP drift test**

Run: `pnpm -F @angflow/mcp run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/agent/tool-schemas.ts packages/angular/AGENT_BRIDGE.md packages/mcp
git commit -m "docs(agent): schemas + AGENT_BRIDGE for group lifecycle; regen mcp snapshot"
```

---

### Task 9: Full verification + mark feedback #14

**Files:** none (verification); then `brainstorm_agentic_app/docs/angflow-feedback.md` (separate repo — confirm before committing there)

- [ ] **Step 1: Build angular → mcp**

Run: `pnpm -F @angflow/angular build && pnpm -F @angflow/mcp build`
Expected: both build clean. (`@angflow/system` unchanged this unit.)

- [ ] **Step 2: Run the full test suites**

Run: `pnpm -F @angflow/angular test && pnpm -F @angflow/mcp test`
Expected: all green.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Mark the feedback entry**

In `C:/Users/shisu/CodeWeb/brainstorm_agentic_app/docs/angflow-feedback.md`, change entry #14's heading marker `⛳` → `✅` and append a `**✅ Fixed in angflow**` bullet: the five group tools + optional minted ids on `add_node`/`group_nodes`; reference the commit/PR; note "not yet published" / "not yet adopted here" (the app drives its own CanvasOp protocol, so adoption is N/A — note that).

- [ ] **Step 5: Commit the feedback update**

```bash
cd C:/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs: mark angflow feedback #14 fixed (group lifecycle + minted ids)"
```

> NOTE: separate git repo — confirm with the user before committing there.

---

## Publish (manual — requires npm 2FA, do with the user)

`@angflow/system` is unchanged this unit.
1. `packages/angular`: `npm version patch && npm run build && pnpm publish --access public`
2. `packages/mcp`: `npm version patch && npm run build && npm publish --access public`

## Notes for the implementer

- **Spec coverage:** `groupNodes` (T1), `setNodeGroup` (T2), `dissolveGroup` (T3), `getGroupBox` (T4), minted ids + `add_node` optional (T5), `group_nodes`/`set_node_group` handlers + cycle guard (T6), `set_group_collapsed`/`dissolve_group`/`get_group_bounds` + MUTATING_TOOLS (T6/T7), schemas/docs/snapshot (T8), verification + feedback (T9).
- **Visually-stable reparent:** every group mutation captures `getAbsolutePosition` before changing `parentId`, then `setNodePositions({coordinateSpace:'absolute'})` re-bases — mirrors the proven `sizeGroupToChildren` technique. Assert absolute positions are preserved, not the raw relative `position`.
- **Test harness:** bridge spec uses `setup()` → `{ bridge, newFlow }` + `makeNode`; service spec uses `service`/`makeNode`. No panZoom needed — all node-model ops. Give nodes explicit `width`/`height` where box math matters.
- **Reused helpers:** `descendantIdsOf` + `buildChildMap` (from #17) power the `set_node_group` cycle guard; `optionalPositiveNumber`/`requireString`/`optionalStringArray`/`requireObject`/`InvalidParamsError` already exist.
- **`store.batch`:** used to coalesce the reparent loop. If the exact method name differs in the store, drop the wrapper and loop plainly (correctness is unaffected, only emission coalescing).
