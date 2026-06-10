# Absolute-Coordinate Node Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `setNodePositions`/`applyLayout` accept absolute coordinates for parented nodes via `coordinateSpace: 'absolute'`, translating to each node's parent-relative `node.position` space internally.

**Architecture:** A private `toRelativePositions` on `NgFlowService` inverts the store's child-positioning transform (`relative = absolute − parent.positionAbsolute + dims·origin`). `setNodePositions` converts once at the top when `coordinateSpace==='absolute'`, then runs unchanged; `applyLayout` forwards the option. No store/system changes.

**Tech Stack:** Angular 19 (zoneless, signals), TypeScript, Vitest + jsdom, Angular `TestBed`.

**Spec:** `docs/superpowers/specs/2026-06-09-absolute-coordinate-positioning-design.md`

**Conventions for every task:**
- Tests from `packages/angular`: `npm test`; one file via `npx vitest run <path>`.
- Type-check: `npx tsc --noEmit` in `packages/angular`.
- Trunk-based on `main`; commit directly. Footer line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Leave pre-existing untracked PNGs / unrelated working-tree changes unstaged.

---

## Task 1: `coordinateSpace` on `setNodePositions` + `toRelativePositions`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`setNodePositions` ~lines 270-297; add private helper after it)
- Modify: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

In `packages/angular/src/lib/services/ng-flow.service.spec.ts`, add a new top-level `describe` at the END of the file (after the last `});`):

```ts
describe('setNodePositions coordinateSpace', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('absolute: a parented node is translated by the parent absolute position', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions({ c: { x: 300, y: 200 } }, { coordinateSpace: 'absolute' });
    // relative = absolute - parent.positionAbsolute = {300-100, 200-50}
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 200, y: 150 });
  });

  it('absolute: a top-level node is an identity (absolute === its position space)', async () => {
    store.setNodes([{ id: 'n', data: {}, position: { x: 0, y: 0 } }]);
    await service.setNodePositions({ n: { x: 42, y: 17 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('n')!.position).toEqual({ x: 42, y: 17 });
  });

  it('absolute: nested parent uses the immediate parent absolute (which includes the grandparent)', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 1000, y: 1000 } },
      { id: 'p', data: {}, position: { x: 100, y: 100 }, parentId: 'g' },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    // p.positionAbsolute = {1100,1100}; relative = {1500-1100, 1300-1100}
    await service.setNodePositions({ c: { x: 1500, y: 1300 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 400, y: 200 });
  });

  it('absolute: applies the dims*origin term for a non-default node origin', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 100 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p', width: 40, height: 20, origin: [1, 1] },
    ]);
    // relative = abs - parent.posAbs + dims*origin = {300-100+40, 300-100+20}
    await service.setNodePositions({ c: { x: 300, y: 300 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 240, y: 220 });
  });

  it('absolute: a parented node whose parent is missing is used as-is (no throw)', async () => {
    store.setNodes([{ id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'ghost' }]);
    await service.setNodePositions({ c: { x: 5, y: 5 } }, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 5, y: 5 });
  });

  it('default (relative): a parented node position is written verbatim', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    await service.setNodePositions({ c: { x: 7, y: 7 } });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 7, y: 7 });
  });

  it('absolute + animate: the tween targets the converted (relative) position', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    const tween = vi.spyOn(store, 'tweenNodePositions').mockResolvedValue();
    await service.setNodePositions({ c: { x: 300, y: 200 } }, { coordinateSpace: 'absolute', animate: { duration: 100 } });
    expect(tween).toHaveBeenCalledWith({ c: { x: 200, y: 150 } }, 100);
  });
});
```

(`provideZonelessChangeDetection`, `TestBed`, `FlowStore`, `NgFlowService`, `vi` are already imported in this spec — reuse them.)

- [ ] **Step 2: Run tests, verify fail**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — `coordinateSpace` not honored (parented absolute positions written verbatim instead of translated; tween gets absolute coords).

- [ ] **Step 3: Implement**

In `packages/angular/src/lib/services/ng-flow.service.ts`:

(a) Replace the `setNodePositions` signature + first lines. Change the opts type and convert at the top:

```ts
  setNodePositions(
    positions: Record<string, { x: number; y: number }>,
    opts?: { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' },
  ): Promise<void> {
    const resolved = opts?.coordinateSpace === 'absolute' ? this.toRelativePositions(positions) : positions;
    const valid: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of Object.entries(resolved)) {
      if (this.store.nodeLookup.has(id)) valid[id] = pos;
    }
    if (Object.keys(valid).length === 0) return Promise.resolve();
    // ...rest of the method body UNCHANGED (animate decision, tween/immediate on `valid`)...
```

Keep everything from `const setting = opts?.animate ...` onward exactly as it is.

(b) Add the private helper immediately after `setNodePositions`' closing brace:

```ts
  /**
   * Convert a flow-absolute position map into the store's `node.position` space
   * (parent-relative for parented nodes). Inverts the store's child transform
   * (`updateChildNode` → `getNodePositionWithOrigin`):
   * `relative = absolute − parent.positionAbsolute + dims·origin`, using the
   * child's origin (`node.origin ?? store.nodeOrigin`) and resolved dimensions.
   * Top-level nodes, unknown ids, and nodes whose parent is missing pass through
   * unchanged. The store re-applies extent clamping on write, so we don't clamp.
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
      const pAbs = parent.internals.positionAbsolute;
      out[id] = { x: abs.x - pAbs.x + w * origin[0], y: abs.y - pAbs.y + h * origin[1] };
    }
    return out;
  }
```

(`this.store.nodeOrigin()` is an existing signal — it's already read by `adoptUserNodes` calls in the store. `node.origin`, `node.measured`, `node.width`, `node.initialWidth`, `parent.internals.positionAbsolute` are all on `InternalNodeBase`. If TypeScript complains that `node.origin`/`initialWidth` is missing, confirm the type via the store's `nodeLookup` value type and adjust — report what you used.)

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Update `setNodePositions` JSDoc**

In the `setNodePositions` JSDoc (the block ending `* Positions are in \`node.position\` space (parent-relative for child nodes).`), append before the closing `*/`:

```
   *
   * Pass `opts.coordinateSpace: 'absolute'` to provide flow-absolute coordinates
   * instead; parented nodes are translated to their parent-relative space
   * internally (top-level nodes are unaffected). Default is `'relative'`.
```

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): setNodePositions coordinateSpace:'absolute' for parented nodes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `applyLayout` forwards `coordinateSpace`

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (`applyLayout` ~lines 322-337; JSDoc above it)
- Modify: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (add a test)

- [ ] **Step 1: Write the failing test**

Add to the `describe('setNodePositions / applyLayout', ...)` block (the existing one near the `applyLayout` tests) OR a new `describe` — append at end of the spec file inside a new block:

```ts
describe('applyLayout coordinateSpace', () => {
  let store: FlowStore;
  let service: NgFlowService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), FlowStore, NgFlowService],
    });
    store = TestBed.inject(FlowStore);
    service = TestBed.inject(NgFlowService);
  });

  it('forwards coordinateSpace:absolute so a layout fn returning absolute coords lands a parented child correctly', async () => {
    store.setNodes([
      { id: 'p', data: {}, position: { x: 100, y: 50 } },
      { id: 'c', data: {}, position: { x: 0, y: 0 }, parentId: 'p' },
    ]);
    const layoutFn = vi.fn().mockReturnValue({ c: { x: 300, y: 200 } }); // absolute
    await service.applyLayout(layoutFn, { coordinateSpace: 'absolute' });
    expect(store.nodeLookup.get('c')!.position).toEqual({ x: 200, y: 150 });
  });

  it('does NOT forward coordinateSpace to the layout fn opts', async () => {
    store.setNodes([{ id: 'n', data: {}, position: { x: 0, y: 0 } }]);
    const layoutFn = vi.fn().mockReturnValue({ n: { x: 1, y: 1 } });
    await service.applyLayout(layoutFn, { coordinateSpace: 'absolute', direction: 'LR' } as never);
    const optsArg = layoutFn.mock.calls[0][2];
    expect(optsArg).toEqual({ direction: 'LR' }); // coordinateSpace stripped, animate stripped
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — child written at absolute {300,200} (not translated); and/or `coordinateSpace` leaks into layoutFn opts.

- [ ] **Step 3: Implement**

In `applyLayout`, change the opts type and destructure + forward `coordinateSpace`:

```ts
  async applyLayout<O extends Record<string, unknown>>(
    layoutFn: (
      nodes: InternalNode<NodeType>[],
      edges: EdgeType[],
      opts?: O,
    ) => Record<string, { x: number; y: number }> | Promise<Record<string, { x: number; y: number }>>,
    opts?: O & { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' },
  ): Promise<void> {
    const { animate, coordinateSpace, ...layoutOpts } = opts ?? ({} as O & { animate?: boolean | { duration?: number }; coordinateSpace?: 'relative' | 'absolute' });
    const nodes = this.withLiveMeasurements(
      this.getNodes().map((n) => this.getInternalNode(n.id) ?? (n as unknown as InternalNode<NodeType>)),
    );
    const edges = this.withLiveEdgeLabels(this.getEdges());
    const positions = await layoutFn(nodes, edges, layoutOpts as unknown as O);
    await this.setNodePositions(positions, { animate, coordinateSpace });
  }
```

Note: `setNodePositions({ animate, coordinateSpace })` with `animate` undefined is equivalent to the old `animate === undefined ? undefined : { animate }` — because `setNodePositions` does `opts?.animate ?? this.store.animate()`, so an undefined `animate` still falls back to the store's `[animate]` input.

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Update `applyLayout` JSDoc**

In the `applyLayout` JSDoc, replace the "Note: flat layout functions like `layoutNodes` emit positions in one global space; nodes with a `parentId` would be mis-placed because positions are written parent-relative. Sub-flow layout is not supported …" note with:

```
   * Sub-flow note: `layoutNodes` and other flat layout fns emit positions in one
   * global (absolute) space. To place parented nodes from such a fn, pass
   * `opts.coordinateSpace: 'absolute'` — angflow then translates each parented
   * node into its parent-relative space on apply. (Group-aware *layout* itself —
   * clustering children within a box — is separate.)
```

- [ ] **Step 6: Run the full suite (no regressions)**

Run: `cd packages/angular && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts
git commit -m "feat(angular): applyLayout forwards coordinateSpace to setNodePositions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Build, version bump, example regression

**Files:**
- Modify: `packages/angular/package.json` (version)

- [ ] **Step 1: Build the angular package**

Run (in `packages/angular`): `npm run build`
Expected: clean ngc + CSS bundle.

- [ ] **Step 2: Example regression (regression bar)**

Run: `cd packages/system && npm run build` then `cd packages/angular && npm run build` then `cd examples/angular && npm run build`
Expected: example builds clean against the rebuilt packages (pre-existing bundle-budget + dagre-not-ESM warnings are fine).

- [ ] **Step 3: Version bump (patch — additive, backward-compatible)**

Edit `packages/angular/package.json` `"version"` from its current value (e.g. `0.1.0`) to the next patch (e.g. `0.1.1`).

- [ ] **Step 4: Publish (USER ACTION — npm 2FA)**

> Do not run autonomously. Surface: `cd packages/angular && npm publish --access public`.

- [ ] **Step 5: Commit the version bump**

```bash
git add packages/angular/package.json
git commit -m "chore(angular): version bump for absolute-coordinate positioning

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Feedback bookkeeping (#10)

**Files:**
- Modify: `C:\Users\shisu\CodeWeb\brainstorm_agentic_app\docs\angflow-feedback.md`

- [ ] **Step 1: Mark #10 ✅**

Change `## 10. ⛳ \`setNodePositions\` can't tween compound children (absolute vs parent-relative)` to `## 10. ✅ …` and append (use the real commit hashes from Tasks 1 & 2 — `git -C C:/Users/shisu/CodeWeb/angflow log --oneline -6`):

```markdown
- **✅ Fixed in angflow** (`<task1-hash>`, `<task2-hash>`): `NgFlowService.setNodePositions` and
  `applyLayout` accept `coordinateSpace: 'absolute'` — parented nodes' absolute coords are
  translated to their parent-relative `node.position` space internally (inverting the store's
  child transform, nesting- and origin-correct; the immediate and animated/tween paths both
  honor it). Shipped in `@angflow/angular@<new-version>`. Once the app is on it: in `tidy()`, stop
  skipping the tween for grouped nodes — pass absolute layout positions with
  `coordinateSpace:'absolute'` so grouped children animate. (Compound *layout* #8 and auto-size
  #9 are still open and build on this.)
```

- [ ] **Step 2: Commit (in the brainstorm_agentic_app repo)**

```bash
cd /c/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs(feedback): mark angflow #10 (absolute-coordinate positioning) fixed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- API (`coordinateSpace` on `setNodePositions` + `applyLayout`, default `'relative'`) → Task 1 + Task 2. ✓
- Conversion (inverse of the store child transform, child origin/dims, no clamp) → Task 1 `toRelativePositions`. ✓
- Single-point conversion, store paths untouched → Task 1 (convert at top, rest unchanged). ✓
- `applyLayout` forwards, `coordinateSpace` not leaked to layoutFn → Task 2 (+ its 2nd test). ✓
- Edge cases (top-level identity, missing parent, nested, origin) → Task 1 tests. ✓
- Tween path honors conversion → Task 1 tween test. ✓
- Rollout (build, version, feedback) → Task 3 + Task 4. ✓

**Type consistency:**
- `coordinateSpace?: 'relative' | 'absolute'` — identical on both methods (Task 1, Task 2). ✓
- `toRelativePositions(positions): Record<string,{x,y}>` — defined Task 1, called only from `setNodePositions` Task 1. ✓
- `{ animate, coordinateSpace }` forwarded from `applyLayout` matches `setNodePositions` opts shape. ✓

**Placeholder scan:** No TBD/TODO. Task 4 `<task-hash>`/`<new-version>` are runtime values resolved at execution (per the prior plans' convention). ✓
