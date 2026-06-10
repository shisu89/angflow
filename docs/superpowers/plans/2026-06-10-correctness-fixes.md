# Correctness Fixes (Drag/Layout/Collapse/Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed correctness bugs in the drag fast path, compound-layout apply path, dagre compound layout, collapse edge rewriting, the agent bridge `layout_nodes` tool, and `deleteElements`.

**Architecture:** All fixes are localized to existing functions in `@angflow/angular` (FlowStore fast path, NgFlowService coordinate conversion, layout-nodes guards, collapse rewrite, bridge tool handler). TDD throughout; each fix lands with the regression tests the review identified as missing.

**Tech Stack:** Angular 21 signals (zoneless), vitest, @dagrejs/dagre, @angflow/system internals (`updateAbsolutePositions`).

**Part of:** `2026-06-10-review-remediation-master.md` (Plan A — execute FIRST; Plans C/D touch some of the same files).

---

Verification notes from planning (read before executing):

- **Finding 1 is partially fixed on HEAD** (commit `5657d6a3d` added a `touchedParented` gate at `flow-store.service.ts:601,630-636` that calls `updateAbsolutePositions` when the moved node *has* a `parentId`). The still-live bugs are: (a) moving a **group** (node with children, no `parentId`) never triggers the recompute — children's `positionAbsolute` go stale; (b) a top-level node with **origin ≠ [0,0]** gets `positionAbsolute = position` verbatim instead of `position − dims·origin` (`getNodePositionWithOrigin`, system `general.ts:140-150`). Task 1 fixes exactly those gaps.
- **`sizeGroupToChildren` already passes `animate: false`** (ng-flow.service.ts:276-277). Task 2 keeps it while collapsing the two awaited calls into one corrected map.

All commands run from the repo root `C:\Users\shisu\CodeWeb\angflow`. Test runner: Vitest (`packages/angular/package.json` → `"test": "vitest run"`); `pnpm -F @angflow/angular test <path>` filters to one spec file.

### Task 1: Position fast path — recompute `positionAbsolute` for groups and non-default origins

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts` (lines 582–647, the `allPosition` fast path in `triggerNodeChanges`)
- Test: `packages/angular/src/lib/services/flow-store.service.spec.ts` (append a new `describe` after the existing `triggerNodeChanges` block)

Why: the fast path writes `internals.positionAbsolute = change.position` verbatim (lines 596–599) and only calls `updateAbsolutePositions` when the moved node itself has a `parentId` (line 601). Moving a group therefore leaves its children's absolute positions stale (drag, tween, arrow keys, and XYResizer child moves all flow through here), and any flow with `nodeOrigin ≠ [0,0]` renders top-level nodes offset by `dims·origin` (node-renderer.component.ts:402-406 renders `positionAbsolute`).

- [ ] **Step 1: Write failing tests.** Append to `packages/angular/src/lib/services/flow-store.service.spec.ts` (same `describe('FlowStore')` scope, reusing the file's `makeNode` helper and the `store = new FlowStore()` from `beforeEach`):

```ts
  // ── Fast path: positionAbsolute correctness (groups, origin) ──────────

  describe('position fast-path keeps positionAbsolute consistent', () => {
    it('moving a group updates its children’s positionAbsolute', () => {
      store.setNodes([
        makeNode('g', { position: { x: 100, y: 100 } }),
        makeNode('c', { position: { x: 10, y: 10 }, parentId: 'g' }),
      ]);
      expect(store.nodeLookup.get('c')!.internals!.positionAbsolute).toEqual({ x: 110, y: 110 });

      store.triggerNodeChanges([
        { id: 'g', type: 'position', position: { x: 200, y: 300 }, dragging: true },
      ]);

      expect(store.nodeLookup.get('g')!.internals!.positionAbsolute).toEqual({ x: 200, y: 300 });
      expect(store.nodeLookup.get('c')!.internals!.positionAbsolute).toEqual({ x: 210, y: 310 });
    });

    it('moving a group updates grandchildren too (nested groups)', () => {
      store.setNodes([
        makeNode('g', { position: { x: 0, y: 0 } }),
        makeNode('sub', { position: { x: 10, y: 10 }, parentId: 'g' }),
        makeNode('leaf', { position: { x: 5, y: 5 }, parentId: 'sub' }),
      ]);
      store.triggerNodeChanges([
        { id: 'g', type: 'position', position: { x: 100, y: 100 } },
      ]);
      expect(store.nodeLookup.get('leaf')!.internals!.positionAbsolute).toEqual({ x: 115, y: 115 });
    });

    it('a top-level node with non-default origin gets an origin-adjusted positionAbsolute', () => {
      store.nodeOrigin.set([0.5, 0.5]);
      store.setNodes([
        makeNode('n', { position: { x: 0, y: 0 }, width: 100, height: 40 }),
      ]);
      store.triggerNodeChanges([
        { id: 'n', type: 'position', position: { x: 100, y: 100 } },
      ]);
      // positionAbsolute = position − dims·origin = (100 − 50, 100 − 20)
      expect(store.nodeLookup.get('n')!.internals!.positionAbsolute).toEqual({ x: 50, y: 80 });
    });

    it('moving a child node resolves against the parent chain (regression guard)', () => {
      store.setNodes([
        makeNode('g', { position: { x: 100, y: 100 } }),
        makeNode('c', { position: { x: 0, y: 0 }, parentId: 'g' }),
      ]);
      store.triggerNodeChanges([
        { id: 'c', type: 'position', position: { x: 25, y: 25 }, dragging: true },
      ]);
      expect(store.nodeLookup.get('c')!.internals!.positionAbsolute).toEqual({ x: 125, y: 125 });
    });
  });
```

- [ ] **Step 2: Run the tests, confirm the new ones fail.**
  Command: `pnpm -F @angflow/angular test src/lib/services/flow-store.service.spec.ts`
  Expected: the first three new tests fail — child of moved group asserts `{x: 210, y: 310}` but receives `{x: 110, y: 110}`; the origin test asserts `{x: 50, y: 80}` but receives `{x: 100, y: 100}`. The fourth (regression guard) passes already. All pre-existing tests pass.

- [ ] **Step 3: Implement.** In `flow-store.service.ts`, replace the fast-path body of `triggerNodeChanges` from line 583 (`const currentNodes = this.nodes();`) through the `touchedParented` recompute block (line 636) with:

```ts
      // Update user nodes array with new positions (cheap shallow copy)
      const currentNodes = this.nodes();
      const storeOrigin = this.nodeOrigin();
      let nodesChanged = false;
      let needsAbsoluteRecompute = false;

      for (const change of changes) {
        if (change.type !== 'position') continue;
        const internalNode = this.nodeLookup.get(change.id);
        if (!internalNode) continue;

        let mutated = false;

        // Update internal node position in-place (fast)
        if (change.position) {
          internalNode.position = change.position;
          if (internalNode.internals) {
            internalNode.internals.positionAbsolute = change.position;
          }
          // The verbatim assignment above is only correct for a top-level node
          // with origin [0,0] that has no children. Otherwise positionAbsolute
          // must be re-derived: from the parent chain (parented node), with an
          // origin offset (non-default origin), or for the whole subtree (the
          // moved node is itself a parent — its children shift with it).
          const origin = internalNode.origin ?? storeOrigin;
          if (
            internalNode.parentId ||
            this.parentLookup.has(change.id) ||
            origin[0] !== 0 ||
            origin[1] !== 0
          ) {
            needsAbsoluteRecompute = true;
          }
          mutated = true;
        }
        if (change.dragging !== undefined) {
          internalNode.dragging = change.dragging;
          mutated = true;
        }

        // Mirror the mutation onto the user-facing node reference so that
        // external consumers observing `nodes()` see consistent state.
        const userNode = internalNode.internals?.userNode as any;
        if (userNode) {
          if (change.position) {
            userNode.position = change.position;
          }
          if (change.dragging !== undefined) {
            userNode.dragging = change.dragging;
          }
        }

        if (mutated) {
          nodesChanged = true;
        }
      }

      // positionAbsolute needs recomputing from the parent chain / origin when a
      // parented node, a parent (group) node, or an origin-offset node moved.
      // This walks the whole lookup, so it's gated to those runs — plain
      // top-level drags with origin [0,0] keep the O(changes) fast path.
      if (needsAbsoluteRecompute) {
        updateAbsolutePositions(this.nodeLookup, this.parentLookup, {
          nodeOrigin: this.nodeOrigin(),
          nodeExtent: this.nodeExtent(),
          zIndexMode: this.zIndexMode(),
        });
      }
```

(The remainder — `if (nodesChanged) { ... this.nodes.set([...currentNodes]); }` — is unchanged. NOTE: adapt the exact `updateAbsolutePositions` options object to whatever the existing `touchedParented` block at line 630-636 passes today — keep it identical.)

- [ ] **Step 4: Run the full package suite, confirm green.**
  Command: `pnpm -F @angflow/angular test`
  Expected: all tests pass, including the four new ones and the existing tween/drag/sizeGroupToChildren suites.

- [ ] **Step 5: Commit.**
  Command: `git add packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts` then
  `git commit -m "fix(store): recompute positionAbsolute for group moves and non-default origins in the position fast-path"`

---

### Task 2: `toRelativePositions` — resolve children against the parent's NEW absolute position

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (lines 351–370 `toRelativePositions`; lines 273–277 `sizeGroupToChildren` tail)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (inside the existing `describe('setNodePositions coordinateSpace')`)

Why: when one absolute positions map moves a group AND its children (exactly what compound `layoutNodes` returns), each child is converted against the parent's *pre-move* `internals.positionAbsolute` (line 366), so children land offset by the parent's delta, compounding for nested groups. The incoming map is already in absolute space, so the parent's entry in the same map *is* its new absolute position — no recursion needed.

- [ ] **Step 1: Write failing tests.** Add to the `describe('setNodePositions coordinateSpace')` block in `ng-flow.service.spec.ts`:

```ts
  it('absolute: moving a parent AND its child in one map resolves the child against the parent’s NEW position', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions(
      { p: { x: 200, y: 100 }, c: { x: 250, y: 160 } },
      { coordinateSpace: 'absolute' },
    );
    expect(store.nodeLookup.get('p')!.position).toEqual({ x: 200, y: 100 });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 50, y: 60 });
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 250, y: 160 });
  });

  it('absolute: nested groups moved together resolve each child against its own parent’s NEW position', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 0, y: 0 } },
      { id: 'p', data: {}, position: { x: 100, y: 100 }, parentId: 'g' },
      { id: 'c', data: {}, position: { x: 10, y: 10 }, parentId: 'p' },
    ]);
    await service.setNodePositions(
      { g: { x: 1000, y: 1000 }, p: { x: 1100, y: 1100 }, c: { x: 1150, y: 1150 } },
      { coordinateSpace: 'absolute' },
    );
    expect(store.nodeLookup.get('g')!.position).toEqual({ x: 1000, y: 1000 });
    expect(store.nodeLookup.get('p')!.position).toEqual({ x: 100, y: 100 });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 50, y: 50 });
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/services/ng-flow.service.spec.ts`
  Expected: both new tests fail — `c.position` comes back `{x: 150, y: 110}` (offset by the parent's delta) in the first, and `{x: 1050, y: 1050}` for `p` in the second. All existing tests pass.

- [ ] **Step 3: Implement.** Replace `toRelativePositions` (ng-flow.service.ts:342-370, including its doc comment's last paragraph) with:

```ts
  /**
   * Convert a flow-absolute position map into the store's `node.position` space
   * (parent-relative for parented nodes). Inverts the store's child transform
   * (`updateChildNode` → `calculateChildXYZ` → `getNodePositionWithOrigin`):
   * `relative = absolute − parent.positionAbsolute + dims·origin`, using the
   * child's origin (`node.origin ?? store.nodeOrigin`) and resolved dimensions.
   * When the SAME map also moves the parent (e.g. compound layout output), the
   * child is resolved against the parent's NEW absolute position — the map is
   * in absolute space, so the parent's entry IS that position. Top-level nodes,
   * unknown ids, and nodes whose parent is missing pass through unchanged. The
   * store re-applies extent clamping on write, so we don't clamp.
   */
  private toRelativePositions(
    positions: Record<string, { x: number; y: number }>,
  ): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const storeOrigin = this.store.nodeOrigin();
    for (const [id, abs] of Object.entries(positions)) {
      const node = this.store.nodeLookup.get(id);
      const parent = node?.parentId ? this.store.nodeLookup.get(node.parentId) : undefined;
      if (!node || !parent) {
        out[id] = abs;
        continue;
      }
      const origin = node.origin ?? storeOrigin;
      const w = node.measured?.width ?? node.width ?? node.initialWidth ?? 0;
      const h = node.measured?.height ?? node.height ?? node.initialHeight ?? 0;
      const pAbs = positions[node.parentId!] ?? parent.internals.positionAbsolute;
      out[id] = { x: abs.x - pAbs.x + w * origin[0], y: abs.y - pAbs.y + h * origin[1] };
    }
    return out;
  }
```

- [ ] **Step 4: Simplify `sizeGroupToChildren` to a single corrected map.** Replace the last three statements of `sizeGroupToChildren` (lines 273–277) with:

```ts
    const bounds = getGroupBounds(members, opts);
    this.updateNode(groupId, { width: bounds.width, height: bounds.height } as Partial<NodeType>);
    // One corrected map: toRelativePositions resolves each child against the
    // group's NEW absolute position from this same map, so the box moves and
    // the children stay pinned in a single change batch.
    // animate:false — this is a synchronous pin; tweening would drift the children mid-flight.
    await this.setNodePositions(
      { [groupId]: bounds.position, ...childAbsolute },
      { coordinateSpace: 'absolute', animate: false },
    );
```

(Adapt the local variable names — `members`, `childAbsolute`, `opts` — to the actual identifiers in the current function body; keep the existing bounds computation untouched.)

- [ ] **Step 5: Run the spec file, confirm green** (the existing `sizeGroupToChildren` describe must stay green — it pins exact child absolutes).
  Command: `pnpm -F @angflow/angular test src/lib/services/ng-flow.service.spec.ts`
  Expected: all tests pass.

- [ ] **Step 6: Commit.**
  Command: `git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts` then
  `git commit -m "fix(angular): resolve absolute->relative conversion against the parent's NEW position when one map moves parent and child"`

---

### Task 3: `layoutNodes` — skip edges incident on compound parents (dagre crash)

**Files:**
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts` (lines 106–128)
- Test: `packages/angular/src/lib/layout/layout-nodes.spec.ts` (inside `describe('layoutNodes compound groups')`)

Why: dagre throws `Cannot set properties of undefined (setting 'rank')` for any edge whose endpoint is a compound cluster parent.

- [ ] **Step 1: Write failing tests** (plus the reviewer-requested determinism test, which passes today and guards the upcoming refactors):

```ts
  it('does not throw when an edge targets a group node (x → group)', () => {
    const positions = layoutNodes(
      [
        { id: 'g', width: 10, height: 10 },
        { id: 'm', width: 40, height: 40, parentId: 'g' },
        { id: 'x', width: 40, height: 40 },
      ],
      [{ source: 'x', target: 'g' }],
      { direction: 'TB' },
    );
    for (const id of ['g', 'm', 'x']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it('does not throw when a member connects to its own group (member → group)', () => {
    const positions = layoutNodes(
      [
        { id: 'g', width: 10, height: 10 },
        { id: 'm', width: 40, height: 40, parentId: 'g' },
      ],
      [{ source: 'm', target: 'g' }],
      { direction: 'TB' },
    );
    expect(Number.isFinite(positions['m'].x)).toBe(true);
    expect(Number.isFinite(positions['g'].y)).toBe(true);
  });

  it('is deterministic: the same input twice yields identical output', () => {
    const nodes = [
      { id: 'g', width: 10, height: 10 },
      { id: 'a', width: 40, height: 40, parentId: 'g' },
      { id: 'b', width: 40, height: 40, parentId: 'g' },
      { id: 'x', width: 40, height: 40 },
    ];
    const edges = [{ source: 'x', target: 'a' }, { source: 'a', target: 'b' }];
    expect(layoutNodes(nodes, edges, { direction: 'TB' }))
      .toEqual(layoutNodes(nodes, edges, { direction: 'TB' }));
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/layout/layout-nodes.spec.ts`
  Expected: the two group-edge tests fail with `TypeError: Cannot set properties of undefined (setting 'rank')` thrown from dagre. The determinism test passes.

- [ ] **Step 3: Implement.** Replace lines 106–117 of `layout-nodes.ts` (the `setParent` loop and the start of the edge loop) with:

```ts
  const compoundParentIds = new Set<string>();
  if (compound) {
    for (const n of nodes) {
      if (n.parentId != null && n.parentId !== n.id && ids.has(n.parentId)) {
        g.setParent(n.id, n.parentId);
        compoundParentIds.add(n.parentId);
      }
    }
  }

  for (const e of edges) {
    // Skip dangling edges: otherwise dagre auto-creates phantom nodes that
    // distort layout (especially compound clusters).
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    // Skip edges incident on a compound parent: dagre cannot rank an edge
    // touching a cluster and throws ("Cannot set properties of undefined").
    if (compoundParentIds.has(e.source) || compoundParentIds.has(e.target)) continue;
```

- [ ] **Step 4: Run, confirm green.**
  Command: `pnpm -F @angflow/angular test src/lib/layout/layout-nodes.spec.ts`
  Expected: all pass (including existing flat-layout tests — `compoundParentIds` is empty in flat mode, so nothing is skipped).

- [ ] **Step 5: Commit.**
  Command: `git add packages/angular/src/lib/layout/layout-nodes.ts packages/angular/src/lib/layout/layout-nodes.spec.ts` then
  `git commit -m "fix(layout): skip edges incident on compound parents - dagre throws on cluster-touching edges"`

---

### Task 4: `layoutNodes` — tolerate `parentId` cycles of length ≥ 2

**Files:**
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts` (lines 89–112, parent-relation construction)
- Test: `packages/angular/src/lib/layout/layout-nodes.spec.ts` (same compound describe)

Why: only the self-parent (`parentId === id`) is guarded; graphlib's `setParent` throws on any longer cycle.

- [ ] **Step 1: Write failing tests:**

```ts
  it('treats a 2-cycle (A→B→A) as top-level without throwing', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 40, height: 40, parentId: 'b' },
        { id: 'b', width: 40, height: 40, parentId: 'a' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['a', 'b']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it('treats a 3-cycle (A→B→C→A) as top-level, keeping unrelated valid groups intact', () => {
    const positions = layoutNodes(
      [
        { id: 'a', width: 40, height: 40, parentId: 'b' },
        { id: 'b', width: 40, height: 40, parentId: 'c' },
        { id: 'c', width: 40, height: 40, parentId: 'a' },
        { id: 'g', width: 10, height: 10 },
        { id: 'm', width: 40, height: 40, parentId: 'g' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['a', 'b', 'c', 'g', 'm']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/layout/layout-nodes.spec.ts`
  Expected: both new tests throw from graphlib's `setParent` ("Setting X as parent of Y would create a cycle" or similar). Everything else passes.

- [ ] **Step 3: Implement.** Replace lines 89–112 of `layout-nodes.ts` (from `const ids = ...` through the `setParent` loop, absorbing Task 3's version) with:

```ts
  const ids = new Set(nodes.map((n) => n.id));

  // Parent relation restricted to ids in the input; self-parents excluded.
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    if (n.parentId != null && n.parentId !== n.id && ids.has(n.parentId)) {
      parentOf.set(n.id, n.parentId);
    }
  }

  // graphlib's setParent throws on parentId cycles (A→B→…→A). Detect them with
  // a cycle-guarded ancestor walk (same pattern as graph/collapse.ts) and treat
  // every cycle member as top-level, matching the self-parent guard.
  const inCycle = new Set<string>();
  for (const start of parentOf.keys()) {
    if (inCycle.has(start)) continue;
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      cur = parentOf.get(cur);
    }
    // Within one walk the parent relation is a function, so revisiting a node
    // means the walk entered a cycle at `cur`. Mark the cycle's members.
    if (cur != null && !inCycle.has(cur)) {
      let member = cur;
      do {
        inCycle.add(member);
        member = parentOf.get(member)!;
      } while (member !== cur);
    }
  }
  for (const id of inCycle) parentOf.delete(id);

  const compound = parentOf.size > 0;

  const g = new graphlib.Graph(compound ? { compound: true } : undefined);
  g.setGraph({
    rankdir: opts.direction ?? 'TB',
    nodesep: opts.nodeSep ?? 50,
    ranksep: opts.rankSep ?? 80,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const width = n.measured?.width ?? n.width ?? n.initialWidth ?? DEFAULT_WIDTH;
    const height = n.measured?.height ?? n.height ?? n.initialHeight ?? DEFAULT_HEIGHT;
    g.setNode(n.id, { width, height });
  }

  const compoundParentIds = new Set<string>(parentOf.values());
  if (compound) {
    for (const [child, parent] of parentOf) {
      g.setParent(child, parent);
    }
  }
```

(The edge loop with the two `continue` guards from Task 3 follows unchanged; `compoundParentIds` is now derived from the cycle-cleaned relation. Adapt the graph-options block — `rankdir`/`nodesep`/`ranksep` defaults and `DEFAULT_WIDTH`/`DEFAULT_HEIGHT` — to the exact existing constants in the file; do not change defaults.)

- [ ] **Step 4: Run, confirm green** (the pre-existing self-parent / ghost-parent / nested-group tests are the regression net for this refactor).
  Command: `pnpm -F @angflow/angular test src/lib/layout/layout-nodes.spec.ts`
  Expected: all pass.

- [ ] **Step 5: Commit.**
  Command: `git add packages/angular/src/lib/layout/layout-nodes.ts packages/angular/src/lib/layout/layout-nodes.spec.ts` then
  `git commit -m "fix(layout): treat parentId cycles as top-level - graphlib setParent throws on cycles of length >= 2"`

---

### Task 5: `rewriteEdgesForCollapse` — only rewritten edges enter the dedupe map

**Files:**
- Modify: `packages/angular/src/lib/graph/collapse.ts` (lines 61–95)
- Test: `packages/angular/src/lib/graph/collapse.spec.ts` (inside `describe('rewriteEdgesForCollapse')`)

Why: every edge flows through `byKey`, so two legitimate parallel `x→y` edges merge into one synthetic `__collapsed:x->y` edge whenever any unrelated group is collapsed.

- [ ] **Step 1: Write failing test** (reuses the spec's `lookup`/`E` helpers):

```ts
  it('does NOT merge unrelated parallel edges when some other group is collapsed', () => {
    const nl2 = lookup([
      { id: 'g', collapsed: true },
      { id: 'a', parentId: 'g' },
      { id: 'x' },
      { id: 'y' },
    ]);
    const hidden2 = getCollapsedHiddenIds(nl2);
    const out = rewriteEdgesForCollapse(
      [
        { id: 'p1', source: 'x', target: 'y' },
        { id: 'p2', source: 'x', target: 'y' },
        { id: 'e1', source: 'x', target: 'a' },
      ] as E[],
      nl2,
      hidden2,
    );
    expect(out.map((e) => e.id).sort()).toEqual(['e1', 'p1', 'p2']);
    expect(out.find((e) => e.id === 'p1')!.collapsedFrom).toBeUndefined();
    expect(out.find((e) => e.id === 'e1')!.target).toBe('g');
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/graph/collapse.spec.ts`
  Expected: fails — `out` has length 2 with ids `['__collapsed:x->y', 'e1']` instead of three edges.

- [ ] **Step 3: Implement.** Replace the body of `rewriteEdgesForCollapse` (collapse.ts:66-94) with:

```ts
  if (hiddenIds.size === 0) return edges as DisplayEdge<EdgeType>[];

  const untouched: DisplayEdge<EdgeType>[] = [];
  const byKey = new Map<string, { edge: EdgeType; source: string; target: string; from: string[] }>();

  for (const edge of edges) {
    const sourceHidden = hiddenIds.has(edge.source);
    const targetHidden = hiddenIds.has(edge.target);
    // Only rewritten edges enter the dedupe map. An edge untouched by collapse
    // passes through verbatim so unrelated parallels are never merged.
    if (!sourceHidden && !targetHidden) {
      untouched.push(edge as DisplayEdge<EdgeType>);
      continue;
    }
    const source = sourceHidden ? outermostCollapsedAncestor(edge.source, nodeLookup) : edge.source;
    const target = targetHidden ? outermostCollapsedAncestor(edge.target, nodeLookup) : edge.target;
    if (source === target) continue; // internal to one collapsed box

    const key = `${source}\0${target}\0${edge.sourceHandle ?? ''}\0${edge.targetHandle ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.from.push(edge.id);
    } else {
      byKey.set(key, { edge, source, target, from: [edge.id] });
    }
  }

  const rewritten = Array.from(byKey.values(), ({ edge, source, target, from }) => {
    const merged = from.length > 1;
    return {
      ...edge,
      id: merged ? `__collapsed:${source}->${target}` : edge.id,
      source,
      target,
      collapsedFrom: from,
    } as DisplayEdge<EdgeType>;
  });

  return [...untouched, ...rewritten];
```

Also update the function's doc comment third bullet to: `dedupe parallels created by rewriting — only edges with a rewritten endpoint enter the dedupe; untouched edges pass through verbatim (original identity, no collapsedFrom), so unrelated parallels are never merged.` Accepted trade-off (document in the comment): a pre-existing real `x→g` edge no longer absorbs an `x→a` edge rerouted to `x→g`; they render as parallels.

- [ ] **Step 4: Run collapse spec and the store spec** (displayEdges in `flow-store.service.ts` consumes this).
  Command: `pnpm -F @angflow/angular test src/lib/graph/collapse.spec.ts src/lib/services/flow-store.service.spec.ts`
  Expected: all pass.

- [ ] **Step 5: Commit.**
  Command: `git add packages/angular/src/lib/graph/collapse.ts packages/angular/src/lib/graph/collapse.spec.ts` then
  `git commit -m "fix(graph): collapse rewrite no longer merges unrelated parallel edges - dedupe scoped to rewritten endpoints"`

---

### Task 6: Collapse-rerouted edges — null the hidden child's handle ids

**Files:**
- Modify: `packages/angular/src/lib/graph/collapse.ts` (the loop and output builder from Task 5)
- Test: `packages/angular/src/lib/graph/collapse.spec.ts`

Why: a rewritten endpoint keeps the hidden child's `sourceHandle`/`targetHandle`; the collapsed box has no such handle (arbitrary anchoring) and the dedupe key keys on stale handle ids, so two edges rerouted to the same box with different child handles fail to merge.

- [ ] **Step 1: Write failing tests** (in `describe('rewriteEdgesForCollapse')`, using the existing `nl`/`hidden` fixtures):

```ts
  it('nulls the handle on a rewritten endpoint but keeps the kept endpoint’s handle', () => {
    const out = rewriteEdgesForCollapse(
      [{ id: 'e1', source: 'x', sourceHandle: 'out', target: 'a', targetHandle: 'in' }] as E[],
      nl,
      hidden,
    );
    expect(out).toHaveLength(1);
    expect(out[0].sourceHandle).toBe('out');
    expect(out[0].targetHandle).toBeNull();
  });

  it('dedupes rerouted edges whose stale child handles differ', () => {
    const out = rewriteEdgesForCollapse(
      [
        { id: 'e1', source: 'x', target: 'a', targetHandle: 'ta' },
        { id: 'e2', source: 'x', target: 'b', targetHandle: 'tb' },
      ] as E[],
      nl,
      hidden,
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('__collapsed:x->g');
    expect(out[0].collapsedFrom).toEqual(['e1', 'e2']);
    expect(out[0].targetHandle).toBeNull();
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/graph/collapse.spec.ts`
  Expected: first test fails (`targetHandle` is `'in'`, not null); second fails (`out` has length 2 — stale handles split the key).

- [ ] **Step 3: Implement.** In the rewritten-edge branch from Task 5, compute post-rewrite handles, key on them, and carry them to the output. Replace from `const source = ...` through the `byKey.set` call with:

```ts
    const source = sourceHidden ? outermostCollapsedAncestor(edge.source, nodeLookup) : edge.source;
    const target = targetHidden ? outermostCollapsedAncestor(edge.target, nodeLookup) : edge.target;
    if (source === target) continue; // internal to one collapsed box

    // A rewritten endpoint's handle belongs to the hidden child — the collapsed
    // box has no such handle. Null it so anchoring falls back to the box and
    // the dedupe key is not split by stale child handle ids.
    const sourceHandle = sourceHidden ? null : edge.sourceHandle ?? null;
    const targetHandle = targetHidden ? null : edge.targetHandle ?? null;

    const key = `${source}\0${target}\0${sourceHandle ?? ''}\0${targetHandle ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.from.push(edge.id);
    } else {
      byKey.set(key, { edge, source, target, sourceHandle, targetHandle, from: [edge.id] });
    }
```

Update the map's value type to `{ edge: EdgeType; source: string; target: string; sourceHandle: string | null; targetHandle: string | null; from: string[] }`, and the output builder to:

```ts
  const rewritten = Array.from(byKey.values(), ({ edge, source, target, sourceHandle, targetHandle, from }) => {
    const merged = from.length > 1;
    return {
      ...edge,
      id: merged ? `__collapsed:${source}->${target}` : edge.id,
      source,
      target,
      sourceHandle,
      targetHandle,
      collapsedFrom: from,
    } as DisplayEdge<EdgeType>;
  });
```

- [ ] **Step 4: Run, confirm green.**
  Command: `pnpm -F @angflow/angular test src/lib/graph/collapse.spec.ts`
  Expected: all pass (the pre-existing handle-less merge test still produces `__collapsed:x->g`).

- [ ] **Step 5: Commit.**
  Command: `git add packages/angular/src/lib/graph/collapse.ts packages/angular/src/lib/graph/collapse.spec.ts` then
  `git commit -m "fix(graph): null hidden-child handle ids on collapse-rerouted edge endpoints"`

---

### Task 7: Agent bridge `layout_nodes` — forward `parentId`, apply results as absolute coordinates

Depends on Tasks 2–4 (correct absolute application and crash-free compound layout).

**Files:**
- Modify: `packages/angular/src/lib/agent/agent-bridge.service.ts` (lines 864–872 node mapping; line 926 apply)
- Modify: `packages/angular/src/lib/types/node-template.ts` (lines 68–72, `AgentLayoutFn`)
- Modify: `packages/angular/src/lib/agent/tool-schemas.ts` (lines 769–774, `layout_nodes` description)
- Modify: `packages/angular/AGENT_BRIDGE.md` (line 171 tool-table row)
- Modify (generated): `packages/mcp` schema snapshot via `pnpm -F @angflow/mcp run generate:schemas`
- Test: `packages/angular/src/lib/agent/agent-bridge.spec.ts` (inside `describe('layout_nodes')`)

- [ ] **Step 1: Write failing tests** (file's `makeNode` and `setupWithLayout` helpers, verified at agent-bridge.spec.ts:13-15, 64-76):

```ts
    it('forwards parentId to the layout fn when the parent is in the layout set', async () => {
      const seen: Array<Array<{ id: string; parentId?: string }>> = [];
      const spy: AgentLayoutFn = (nodes) => {
        seen.push(nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(spy);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('g'), makeNode('c', { parentId: 'g' }), makeNode('x')]);
      await b.callTool('layout_nodes', { fitView: false });
      expect(seen[0]).toEqual([
        { id: 'g', parentId: undefined },
        { id: 'c', parentId: 'g' },
        { id: 'x', parentId: undefined },
      ]);
    });

    it('omits parentId when the parent is excluded via nodeIds', async () => {
      const seen: Array<Array<{ id: string; parentId?: string }>> = [];
      const spy: AgentLayoutFn = (nodes) => {
        seen.push(nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
        return Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      };
      const { bridge: b, newFlow: nf } = setupWithLayout(spy);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('g'), makeNode('c', { parentId: 'g' }), makeNode('x')]);
      await b.callTool('layout_nodes', { nodeIds: ['c', 'x'], fitView: false });
      expect(seen[0]).toEqual([
        { id: 'c', parentId: undefined },
        { id: 'x', parentId: undefined },
      ]);
    });

    it('applies layout results as ABSOLUTE coordinates (grouped child lands parent-relative)', async () => {
      const absoluteLayout: AgentLayoutFn = () => ({ g: { x: 100, y: 100 }, c: { x: 130, y: 140 } });
      const { bridge: b, newFlow: nf } = setupWithLayout(absoluteLayout);
      const flow = nf();
      b.register('main', flow);
      flow.setNodes([makeNode('g'), makeNode('c', { parentId: 'g', position: { x: 10, y: 10 } })]);
      await b.callTool('layout_nodes', { fitView: false });
      expect(flow.getNode('g')?.position).toEqual({ x: 100, y: 100 });
      expect(flow.getNode('c')?.position).toEqual({ x: 30, y: 40 });
    });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/agent/agent-bridge.spec.ts`
  Expected: test 1 fails (`c.parentId` is `undefined` — never forwarded); test 2 passes trivially today (keep as a guard); test 3 fails (`c.position` is `{x: 130, y: 140}` — applied as relative). Note test 1 may also fail to compile until Step 3 widens `AgentLayoutFn`; that compile error is the expected red state.

- [ ] **Step 3: Implement.**
  (a) `types/node-template.ts:68-72` — widen the node shape:

```ts
export type AgentLayoutFn = (
  nodes: Array<{
    id: string;
    width: number;
    height: number;
    position: { x: number; y: number };
    /** Present when the node is grouped AND its parent is in the layout set. */
    parentId?: string;
  }>,
  edges: Array<{ source: string; target: string }>,
  opts: AgentLayoutOptions,
) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>;
```

  (`dagreLayout` at `packages/angular/src/lib/layout/dagre-layout.ts:14` passes nodes straight to `layoutNodes`, whose `LayoutNodeInput` already accepts `parentId` — no adapter change needed. Match the exact existing signature shape — adapt if `AgentLayoutOptions`/return type differ.)

  (b) `agent-bridge.service.ts:864-872` — forward `parentId`:

```ts
      const layoutNodes = targetNodes.map((n) => {
        const internal = flow.getInternalNode(n.id);
        return {
          id: n.id,
          width: internal?.measured?.width ?? n.width ?? 150,
          height: internal?.measured?.height ?? n.height ?? 40,
          position: { x: n.position.x, y: n.position.y },
          // Forward grouping so group-aware layout fns (layoutNodes compound
          // mode) can cluster members — only when the parent is also being
          // laid out; an out-of-set parent is treated as top-level anyway.
          parentId: n.parentId != null && idSet.has(n.parentId) ? n.parentId : undefined,
        };
      });
```

  (Adapt to the actual local variable names — `targetNodes`, `idSet` — in the current handler; if no id-set exists for the target nodes, build one: `const idSet = new Set(targetNodes.map((n) => n.id));`.)

  (c) `agent-bridge.service.ts:924-926` — apply as absolute:

```ts
      // Honors the host's [animate] input: positions tween when it's on, and
      // the await keeps the subsequent fitView measuring settled positions.
      // Layout fns emit one global (absolute) space; applying as 'absolute'
      // translates grouped children into their parent-relative positions.
      await flow.setNodePositions(actuallyApplied, { coordinateSpace: 'absolute' });
```

- [ ] **Step 4: Run the bridge spec, confirm green** (the existing flat-graph layout tests must stay green — absolute equals relative for top-level nodes).
  Command: `pnpm -F @angflow/angular test src/lib/agent/agent-bridge.spec.ts`
  Expected: all pass. Then `pnpm -F @angflow/angular typecheck` — exits 0.

- [ ] **Step 5: Update docs and schemas (same commit — project rule).**
  (a) `tool-schemas.ts:769-774` — append to the `layout_nodes` description string: `' Group (parentId) nodes are laid out as compound clusters; results are applied in absolute coordinates, so grouped children stay inside their group.'`
  (b) `AGENT_BRIDGE.md` line 171 — extend the `layout_nodes` row's Returns/notes: positions are flow-absolute top-left corners; grouped nodes are clustered within their parent and applied via `coordinateSpace: 'absolute'`.
  (c) Regenerate the MCP snapshot (schema text changed, so the drift test would fail): `pnpm -F @angflow/mcp run generate:schemas`, then `pnpm -F @angflow/mcp test` — expected: drift test passes.

- [ ] **Step 6: Commit.**
  Command: `git add packages/angular/src/lib/agent/agent-bridge.service.ts packages/angular/src/lib/agent/agent-bridge.spec.ts packages/angular/src/lib/types/node-template.ts packages/angular/src/lib/agent/tool-schemas.ts packages/angular/AGENT_BRIDGE.md packages/mcp` then
  `git commit -m "fix(agent): layout_nodes forwards parentId and applies results as absolute coordinates"`

---

### Task 8: `NgFlowService.deleteElements()` — route through the change pipeline

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (lines 599–604)
- Test: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (inside `describe('deleteElements cascading')`)

Why: `deleteElements` calls `store.setNodes`/`setEdges` directly — no `remove` changes are emitted, so `(nodesChange)`/`(edgesChange)` hosts in controlled mode silently diverge, and change middleware is bypassed. The keyboard path (`key-handler.directive.ts:133-137`) already does this correctly via `elementToRemoveChange` + `triggerNodeChanges`/`triggerEdgeChanges`. (The agent bridge takes its own synchronous deletion path — see `hasOnBeforeDeleteHook` doc at ng-flow.service.ts:560-567 — so no AGENT_BRIDGE.md change is needed; verify with a grep for `deleteElements` in `agent-bridge.service.ts` before committing.)

- [ ] **Step 1: Write failing test** (in the existing `deleteElements cascading` describe, which seeds nodes a/b/c and edges ab/bc/ac):

```ts
    it('routes deletions through the change pipeline (emits remove changes)', async () => {
      const nodeChanges: unknown[] = [];
      const edgeChanges: unknown[] = [];
      store.onNodesChange = (c) => nodeChanges.push(...c);
      store.onEdgesChange = (c) => edgeChanges.push(...c);

      await service.deleteElements({ nodes: [{ id: 'b' } as Node] });

      expect(nodeChanges).toEqual([{ id: 'b', type: 'remove' }]);
      expect(edgeChanges).toEqual(
        expect.arrayContaining([
          { id: 'ab', type: 'remove' },
          { id: 'bc', type: 'remove' },
        ]),
      );
      expect(store.nodes().map((n) => n.id).sort()).toEqual(['a', 'c']);
      expect(store.edges().map((e) => e.id)).toEqual(['ac']);
    });

    it('change middleware can intercept deleteElements removals', async () => {
      service.onNodesChangeMiddleware('block-remove', (changes) =>
        changes.filter((c) => c.type !== 'remove'),
      );
      await service.deleteElements({ nodes: [{ id: 'b' } as Node] });
      expect(store.nodes().map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    });
```

(Adapt the change-callback / middleware registration API to the actual store/service surface — read how `key-handler.directive.ts` and the existing specs hook `onNodesChange` before writing; the assertion intent is fixed: remove changes must be observable and interceptable.)

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/angular test src/lib/services/ng-flow.service.spec.ts`
  Expected: first test fails with `nodeChanges` empty (no callbacks fired); second fails with node `b` deleted despite the middleware.

- [ ] **Step 3: Implement.** Replace ng-flow.service.ts:599-604 with:

```ts
    // Route through the change pipeline (mirrors the keyboard delete path in
    // key-handler.directive.ts): controlled-mode hosts observe 'remove'
    // changes via (nodesChange)/(edgesChange), and middleware can intercept.
    if (nodesToDelete.length > 0) {
      this.store.triggerNodeChanges(
        nodesToDelete.map((n) => ({ id: n.id, type: 'remove' as const })) as NodeChange<NodeType>[],
      );
    }
    if (edgesToDelete.length > 0) {
      this.store.triggerEdgeChanges(
        edgesToDelete.map((e) => ({ id: e.id, type: 'remove' as const })) as EdgeChange<EdgeType>[],
      );
    }
```

(`NodeChange`/`EdgeChange` are already imported at the top of the file; the `remove` change shape matches `elementToRemoveChange` in `utils/changes.ts:235-237`, applied by `applyNodeChanges`/`applyEdgeChanges` on the full path of `triggerNodeChanges`/`triggerEdgeChanges`.)

- [ ] **Step 4: Run the full package suite, confirm green** (existing `deleteElements cascading` and `onBeforeDelete` tests must keep passing — the veto path and return values are untouched).
  Command: `pnpm -F @angflow/angular test`
  Expected: all pass.

- [ ] **Step 5: Commit.**
  Command: `git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts` then
  `git commit -m "fix(angular): deleteElements emits remove changes through the change pipeline instead of bypassing it"`

---

### Critical Files for Implementation
- `packages/angular/src/lib/services/flow-store.service.ts`
- `packages/angular/src/lib/services/ng-flow.service.ts`
- `packages/angular/src/lib/layout/layout-nodes.ts`
- `packages/angular/src/lib/graph/collapse.ts`
- `packages/angular/src/lib/agent/agent-bridge.service.ts`
