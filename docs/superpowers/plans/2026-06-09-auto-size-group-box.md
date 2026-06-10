# Auto-Size Group Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure `getGroupBounds(members, opts)` helper and an imperative `NgFlowService.sizeGroupToChildren(groupId, opts)` that sizes/positions a group to wrap its children while keeping the children visually fixed.

**Architecture:** `getGroupBounds` is a pure geometry function (new `src/lib/graph/group-bounds.ts`). `sizeGroupToChildren` captures children's original absolute positions, computes the box, applies size (`updateNode`) + position (`setNodePositions` with `coordinateSpace:'absolute'`), then re-applies children's original absolutes against the moved box (rebasing their parent-relative positions). Reuses the shipped #10 `coordinateSpace` primitive. No store/system change.

**Tech Stack:** Angular 19 (zoneless, signals), TypeScript, Vitest + jsdom, Angular `TestBed`.

**Spec:** `docs/superpowers/specs/2026-06-09-auto-size-group-box-design.md`

**Conventions for every task:**
- Tests from `packages/angular`: `npm test`; one file via `npx vitest run <path>`.
- Type-check: `npx tsc --noEmit` in `packages/angular`.
- Trunk-based on `main`; commit directly. Footer line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Leave pre-existing untracked PNGs / unrelated working-tree changes unstaged.

---

## Task 1: Pure `getGroupBounds` helper

**Files:**
- Create: `packages/angular/src/lib/graph/group-bounds.ts`
- Create: `packages/angular/src/lib/graph/group-bounds.spec.ts`
- Modify: `packages/angular/src/lib/public-api.ts` (export)

- [ ] **Step 1: Write the failing tests**

Create `packages/angular/src/lib/graph/group-bounds.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getGroupBounds } from './group-bounds';

describe('getGroupBounds', () => {
  it('wraps members with padding and an asymmetric header inset', () => {
    const b = getGroupBounds(
      [
        { position: { x: 110, y: 110 }, width: 40, height: 20 },
        { position: { x: 160, y: 130 }, width: 40, height: 20 },
      ],
      { padding: 10, headerHeight: 20 },
    );
    // minX=110,minY=110,maxX=200,maxY=150
    expect(b.position).toEqual({ x: 100, y: 90 }); // {minX-padding, minY-headerHeight}
    expect(b.width).toBe(110);  // (200-110)+2*10
    expect(b.height).toBe(70);  // (150-110)+20+10
  });

  it('prefers measured size, then width/height, then 0', () => {
    const b = getGroupBounds([
      { position: { x: 0, y: 0 }, measured: { width: 30, height: 30 }, width: 999, height: 999 },
    ]);
    expect(b.width).toBe(30);
    expect(b.height).toBe(30);
  });

  it('clamps to minWidth/minHeight', () => {
    const b = getGroupBounds([{ position: { x: 0, y: 0 }, width: 5, height: 5 }], { minWidth: 100, minHeight: 80 });
    expect(b.width).toBe(100);
    expect(b.height).toBe(80);
  });

  it('returns a min box at origin for no members', () => {
    const b = getGroupBounds([], { padding: 10, headerHeight: 20, minWidth: 50, minHeight: 40 });
    expect(b.position).toEqual({ x: 0, y: 0 });
    expect(b.width).toBe(50);   // max(50, 2*10)
    expect(b.height).toBe(40);  // max(40, 20+10)
  });

  it('defaults padding/header to 0 (tight wrap)', () => {
    const b = getGroupBounds([{ position: { x: 5, y: 7 }, width: 40, height: 20 }]);
    expect(b.position).toEqual({ x: 5, y: 7 });
    expect(b.width).toBe(40);
    expect(b.height).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `cd packages/angular && npx vitest run src/lib/graph/group-bounds.spec.ts`
Expected: FAIL — module `./group-bounds` not found.

- [ ] **Step 3: Implement** — create `packages/angular/src/lib/graph/group-bounds.ts`:

```ts
/** Options for {@link getGroupBounds}. */
export interface GroupBoundsOptions {
  /** Inset on left, right, and bottom. Default 0. */
  padding?: number;
  /** Extra inset on top (for a header/title bar). Default 0. */
  headerHeight?: number;
  /** Minimum box width. Default 0. */
  minWidth?: number;
  /** Minimum box height. Default 0. */
  minHeight?: number;
}

/** A computed group box. */
export interface GroupBounds {
  position: { x: number; y: number };
  width: number;
  height: number;
}

/** Minimal member shape {@link getGroupBounds} reads. */
interface GroupMember {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number | null;
  height?: number | null;
}

/**
 * Compute the box that wraps `members` with padding and an optional header
 * inset. Coordinate-agnostic: members' positions and the returned position are
 * in the same space (pass absolute members → absolute bounds). Member sizes
 * resolve `measured → width → 0`. With no members, returns a min-sized box at
 * `{0,0}` (the caller positions it).
 */
export function getGroupBounds(members: ReadonlyArray<GroupMember>, opts: GroupBoundsOptions = {}): GroupBounds {
  const p = opts.padding ?? 0;
  const hh = opts.headerHeight ?? 0;
  const minWidth = opts.minWidth ?? 0;
  const minHeight = opts.minHeight ?? 0;

  if (members.length === 0) {
    return { position: { x: 0, y: 0 }, width: Math.max(minWidth, 2 * p), height: Math.max(minHeight, hh + p) };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of members) {
    const w = m.measured?.width ?? m.width ?? 0;
    const h = m.measured?.height ?? m.height ?? 0;
    minX = Math.min(minX, m.position.x);
    minY = Math.min(minY, m.position.y);
    maxX = Math.max(maxX, m.position.x + w);
    maxY = Math.max(maxY, m.position.y + h);
  }

  return {
    position: { x: minX - p, y: minY - hh },
    width: Math.max(minWidth, maxX - minX + 2 * p),
    height: Math.max(minHeight, maxY - minY + hh + p),
  };
}
```

- [ ] **Step 4: Export from public-api**

In `packages/angular/src/lib/public-api.ts`, add near the other type/util exports:

```ts
export { getGroupBounds } from './graph/group-bounds';
export type { GroupBounds, GroupBoundsOptions } from './graph/group-bounds';
```

(Confirm the relative prefix matches the file's existing exports — the collapse export is `./graph/collapse`, so `./graph/group-bounds` is correct.)

- [ ] **Step 5: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/graph/group-bounds.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/angular/src/lib/graph/group-bounds.ts packages/angular/src/lib/graph/group-bounds.spec.ts packages/angular/src/lib/public-api.ts
git commit -m "feat(graph): pure getGroupBounds — wrap members with padding + header inset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `NgFlowService.sizeGroupToChildren` + docs

**Files:**
- Modify: `packages/angular/src/lib/services/ng-flow.service.ts` (import + new method)
- Modify: `packages/angular/src/lib/services/ng-flow.service.spec.ts` (add a `describe` block)
- Modify: `packages/angular/README.md` (short note)

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/services/ng-flow.service.spec.ts`:

```ts
describe('sizeGroupToChildren', () => {
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

  it('sizes + positions the group to wrap its children, keeping children visually fixed', async () => {
    store.setNodes([
      { id: 'g', data: {}, position: { x: 100, y: 100 } },
      { id: 'c1', data: {}, position: { x: 10, y: 10 }, parentId: 'g', width: 40, height: 20 },
      { id: 'c2', data: {}, position: { x: 60, y: 30 }, parentId: 'g', width: 40, height: 20 },
    ]);
    // children absolute: c1 = {110,110}, c2 = {160,130}
    await service.sizeGroupToChildren('g', { padding: 10, headerHeight: 20 });

    const g = store.nodeLookup.get('g')!;
    expect(g.width).toBe(110);
    expect(g.height).toBe(70);
    expect(g.position).toEqual({ x: 100, y: 90 }); // top-level group: absolute === position
    // load-bearing invariant: children unchanged in absolute space
    expect(store.nodeLookup.get('c1')!.internals.positionAbsolute).toEqual({ x: 110, y: 110 });
    expect(store.nodeLookup.get('c2')!.internals.positionAbsolute).toEqual({ x: 160, y: 130 });
  });

  it('is a no-op for a group with no children', async () => {
    store.setNodes([{ id: 'g', data: {}, position: { x: 5, y: 5 }, width: 80, height: 80 }]);
    await service.sizeGroupToChildren('g', { padding: 10 });
    const g = store.nodeLookup.get('g')!;
    expect(g.position).toEqual({ x: 5, y: 5 });
    expect(g.width).toBe(80);
    expect(g.height).toBe(80);
  });

  it('keeps children fixed even when the group itself is nested', async () => {
    store.setNodes([
      { id: 'outer', data: {}, position: { x: 50, y: 40 } },
      { id: 'g', data: {}, position: { x: 20, y: 20 }, parentId: 'outer' },
      { id: 'c', data: {}, position: { x: 5, y: 5 }, parentId: 'g', width: 40, height: 20 },
    ]);
    // c absolute = outer(50,40) + g(20,20) + c(5,5) = {75,65}
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 75, y: 65 });
    await service.sizeGroupToChildren('g', { padding: 10, headerHeight: 0 });
    // c must remain visually fixed
    expect(store.nodeLookup.get('c')!.internals.positionAbsolute).toEqual({ x: 75, y: 65 });
    // g sized to wrap c: width = 40 + 2*10 = 60, height = 20 + 10 = 30
    const g = store.nodeLookup.get('g')!;
    expect(g.width).toBe(60);
    expect(g.height).toBe(30);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts`
Expected: FAIL — `sizeGroupToChildren` is not a function.

- [ ] **Step 3: Implement**

In `packages/angular/src/lib/services/ng-flow.service.ts`, add the import near the top (with the other `../graph` / local imports):

```ts
import { getGroupBounds, type GroupBoundsOptions } from '../graph/group-bounds';
```

Add the method after `updateNodeData` (or near the other node operations — keep it with node ops, before the edge ops section):

```ts
  /**
   * Size and position a group node to wrap its direct children (nodes with
   * `parentId === groupId`), keeping the children visually fixed. Sets the
   * group's `width`/`height` and moves its top-left to the wrapping box (with
   * `opts.padding`/`headerHeight`/`minWidth`/`minHeight`). No-op if the group has
   * no children. Immediate (not animated).
   *
   * Resolves the box-origin ↔ child-coordinate feedback loop by capturing the
   * children's absolute positions first, moving the box, then re-applying those
   * absolutes against the moved box so the children's parent-relative positions
   * shift to keep them pinned.
   */
  async sizeGroupToChildren(groupId: string, opts?: GroupBoundsOptions): Promise<void> {
    const children = this.getNodes()
      .filter((n) => n.parentId === groupId)
      .map((n) => this.getInternalNode(n.id))
      .filter((n): n is InternalNode<NodeType> => n != null);
    if (children.length === 0) return;

    const members = children.map((c) => ({
      position: c.internals.positionAbsolute,
      measured: c.measured,
      width: c.width,
      height: c.height,
    }));
    // Snapshot the children's original absolute positions (copied, since the
    // store replaces these objects on each mutation below).
    const childAbsolute: Record<string, { x: number; y: number }> = {};
    for (const c of children) {
      childAbsolute[c.id] = { x: c.internals.positionAbsolute.x, y: c.internals.positionAbsolute.y };
    }

    const bounds = getGroupBounds(members, opts);
    this.updateNode(groupId, { width: bounds.width, height: bounds.height } as Partial<NodeType>);
    // Move the box (absolute → its own parent-relative). Must precede the rebase
    // so children convert against the box's new positionAbsolute.
    await this.setNodePositions({ [groupId]: bounds.position }, { coordinateSpace: 'absolute' });
    await this.setNodePositions(childAbsolute, { coordinateSpace: 'absolute' });
  }
```

(`getInternalNode`, `getNodes`, `updateNode`, `setNodePositions`, `InternalNode<NodeType>` are all already in this service. If `getInternalNode` isn't present, use `this.store.nodeLookup.get(n.id)` instead — confirm against the existing `applyLayout`, which uses `this.getInternalNode(n.id)`.)

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/services/ng-flow.service.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Add a README note**

In `packages/angular/README.md`, under the `## Group Collapse` section (or right after it, before `## Architecture`), add:

```markdown
## Group Auto-Size

Compute a box that wraps a group's members, or have the service size a group for you:

```ts
import { getGroupBounds } from '@angflow/angular';

// Pure: bounds in the same coordinate space as the members you pass.
const box = getGroupBounds(members, { padding: 24, headerHeight: 40 });

// Imperative: size + position a group to wrap its children, keeping them pinned.
await flow.sizeGroupToChildren(groupId, { padding: 24, headerHeight: 40 });
```

`getGroupBounds` resolves member sizes `measured → width → 0` and applies an asymmetric top
(`headerHeight`) vs. other-sides (`padding`) inset. `sizeGroupToChildren` sets the group's
`width`/`height` and moves its top-left to wrap its `parentId` children, re-basing the children so
they stay visually fixed (nested groups handled via absolute-coordinate translation). It is a no-op
for a childless group.
```

(Ensure the nested ```ts fence is balanced.)

- [ ] **Step 6: Full suite (no regressions)**

Run: `cd packages/angular && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/services/ng-flow.service.ts packages/angular/src/lib/services/ng-flow.service.spec.ts packages/angular/README.md
git commit -m "feat(angular): sizeGroupToChildren wraps a group to its children, pinning them

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
Expected: example builds clean (pre-existing bundle-budget + dagre-not-ESM warnings are fine).

- [ ] **Step 3: Version bump (minor — new exported API)**

Edit `packages/angular/package.json` `"version"` from `0.1.2` to `0.2.0`.

- [ ] **Step 4: Publish (USER ACTION — npm 2FA)**

> Do not run autonomously. Surface: `cd packages/angular && npm publish --access public`.

- [ ] **Step 5: Commit the version bump**

```bash
git add packages/angular/package.json
git commit -m "chore(angular): 0.2.0 — group auto-size (getGroupBounds + sizeGroupToChildren)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Feedback bookkeeping (#9) — group cluster complete

**Files:**
- Modify: `C:\Users\shisu\CodeWeb\brainstorm_agentic_app\docs\angflow-feedback.md`

- [ ] **Step 1: Mark #9 ✅**

Change `## 9. ⛳ No helper to size a group box to its children's bounds` to `## 9. ✅ …` and append (use the real implementing commit hashes from Tasks 1 & 2 — `git -C C:/Users/shisu/CodeWeb/angflow log --oneline -6`):

```markdown
- **✅ Fixed in angflow** (`<task1-hash>` getGroupBounds, `<task2-hash>` sizeGroupToChildren):
  exported pure `getGroupBounds(members, { padding, headerHeight, minWidth, minHeight })` (wraps
  members by their measured size; asymmetric header inset) and
  `NgFlowService.sizeGroupToChildren(groupId, opts)` which sets the group's `width`/`height` and
  moves it to wrap its children while keeping them visually pinned (resolving the box-origin ↔
  child-coordinate loop via absolute-coordinate translation). Shipped in `@angflow/angular@0.2.0`.
  Once the app is on it: replace `boundsFromMembers`/`groupBounds` in
  `web/src/app/canvas/group-render.ts` with `getGroupBounds`, and call `sizeGroupToChildren` where
  boxes are derived imperatively (e.g. post-Tidy).
- **Group-layout cluster complete:** #7 (collapse), #8 (compound layout), #9 (auto-size), #10
  (absolute-coord apply) are all shipped — first-class groups in angflow.
```

- [ ] **Step 2: Commit (in the brainstorm_agentic_app repo)**

```bash
cd /c/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs(feedback): mark angflow #9 (group auto-size) fixed — group cluster complete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Part A `getGroupBounds` (pure, measured sizes, asymmetric inset, min clamp, empty) → Task 1. ✓
- Exported from main entry → Task 1 Step 4. ✓
- Part B `sizeGroupToChildren` (capture → size+move → rebase; no-op empty; nested) → Task 2. ✓
- Coordinate-loop correctness (capture-before-move, rebase-after-move) → Task 2 Step 3 + the "children pinned" assertions. ✓
- Reuse #10 `coordinateSpace:'absolute'` → Task 2 Step 3. ✓
- No system change → only angular files touched. ✓
- Docs → Task 2 Step 5. ✓
- Rollout (build, minor bump, feedback, cluster-complete) → Task 3 + Task 4. ✓

**Type consistency:**
- `GroupBoundsOptions` / `GroupBounds` — defined Task 1, imported/used in Task 2. ✓
- `getGroupBounds(members, opts)` signature — same in Task 1 impl/tests and Task 2 call. ✓
- `sizeGroupToChildren(groupId, opts?): Promise<void>` — consistent Task 2 impl/tests + README + feedback. ✓
- Member shape `{ position; measured?; width?; height? }` — matches what `sizeGroupToChildren` builds from internal nodes. ✓

**Placeholder scan:** No TBD/TODO. Task 4 `<task-hash>`/`@0.2.0` resolved at execution (runtime values). ✓
