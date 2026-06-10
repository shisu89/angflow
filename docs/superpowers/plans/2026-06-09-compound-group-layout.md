# Compound (Group-Aware) Auto-Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `layoutNodes` clusters grouped members within their parent via dagre compound layout, driven by each node's `parentId`.

**Architecture:** A pure change to `layoutNodes` only: detect `parentId` membership, build a `{ compound: true }` dagre graph and `setParent` members, guard dangling-edge endpoints, and convert positions using dagre's computed node box (correct for clusters). `applyLayout` already forwards `coordinateSpace` (from #10), so callers apply the absolute output with `coordinateSpace:'absolute'`. No store/system change.

**Tech Stack:** TypeScript, `@dagrejs/dagre` (compound graph), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-compound-group-layout-design.md`

**Conventions for every task:**
- Tests from `packages/angular`: `npm test`; one file via `npx vitest run <path>`.
- Type-check: `npx tsc --noEmit` in `packages/angular`.
- Trunk-based on `main`; commit directly. Footer line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Leave pre-existing untracked PNGs / unrelated working-tree changes unstaged.

---

## Task 1: Compound `layoutNodes`

**Files:**
- Modify: `packages/angular/src/lib/layout/layout-nodes.ts` (`LayoutNodeInput`, `layoutNodes`, docstring)
- Modify: `packages/angular/src/lib/layout/layout-nodes.spec.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to `packages/angular/src/lib/layout/layout-nodes.spec.ts`:

```ts
describe('layoutNodes compound groups', () => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it('clusters grouped members (interleaved insertion would scatter when flat)', () => {
    // Parents first, members interleaved so a FLAT layout would NOT keep a1/a2 adjacent.
    const positions = layoutNodes(
      [
        { id: 'gA', width: 10, height: 10 },
        { id: 'gB', width: 10, height: 10 },
        { id: 'a1', width: 40, height: 40, parentId: 'gA' },
        { id: 'b1', width: 40, height: 40, parentId: 'gB' },
        { id: 'a2', width: 40, height: 40, parentId: 'gA' },
        { id: 'b2', width: 40, height: 40, parentId: 'gB' },
      ],
      [],
      { direction: 'TB' },
    );
    // Same-group members are closer to each other than to the other group's members.
    expect(dist(positions['a1'], positions['a2'])).toBeLessThan(dist(positions['a1'], positions['b1']));
    expect(dist(positions['b1'], positions['b2'])).toBeLessThan(dist(positions['b1'], positions['a1']));
  });

  it('treats a node whose parentId is not in the set as top-level (no throw, finite)', () => {
    const positions = layoutNodes(
      [{ id: 'c', width: 40, height: 40, parentId: 'ghost' }],
      [],
      { direction: 'TB' },
    );
    expect(Number.isFinite(positions['c'].x)).toBe(true);
    expect(Number.isFinite(positions['c'].y)).toBe(true);
  });

  it('handles nested groups (g → sub → leaf): all finite', () => {
    const positions = layoutNodes(
      [
        { id: 'g', width: 10, height: 10 },
        { id: 'sub', width: 10, height: 10, parentId: 'g' },
        { id: 'leaf', width: 40, height: 40, parentId: 'sub' },
      ],
      [],
      { direction: 'TB' },
    );
    for (const id of ['g', 'sub', 'leaf']) {
      expect(Number.isFinite(positions[id].x)).toBe(true);
      expect(Number.isFinite(positions[id].y)).toBe(true);
    }
  });

  it('skips dangling edges (endpoint not in node set) — no phantom-node distortion', () => {
    const nodes = [
      { id: 'a', width: 40, height: 40 },
      { id: 'b', width: 40, height: 40 },
    ];
    const withDangling = layoutNodes(nodes, [{ source: 'a', target: 'b' }, { source: 'a', target: 'ghost' }], { direction: 'TB' });
    const without = layoutNodes(nodes, [{ source: 'a', target: 'b' }], { direction: 'TB' });
    expect(withDangling).toEqual(without);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `cd packages/angular && npx vitest run src/lib/layout/layout-nodes.spec.ts`
Expected: FAIL — clustering test (flat layout scatters interleaved members); dangling-edge test (phantom node shifts positions). Nested/parent-outside may pass incidentally; the clustering + dangling tests must fail.

- [ ] **Step 3: Implement**

In `packages/angular/src/lib/layout/layout-nodes.ts`:

(a) Add `parentId?` to `LayoutNodeInput`:

```ts
export interface LayoutNodeInput {
  id: string;
  width?: number | null;
  height?: number | null;
  initialWidth?: number;
  initialHeight?: number;
  measured?: { width?: number; height?: number };
  /** Group/sub-flow parent id. When present (and in the node set), the node is
   *  clustered within that parent via dagre compound layout. */
  parentId?: string;
}
```

(b) Replace the `layoutNodes` body (from `const g = new graphlib.Graph();` through the final `return positions;`) with:

```ts
  const ids = new Set(nodes.map((n) => n.id));
  const compound = nodes.some((n) => n.parentId != null && ids.has(n.parentId));

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

  if (compound) {
    // Cluster each node under its parent (a node is a "group"/cluster iff some
    // node names it as parentId). Parents not in the set are ignored.
    for (const n of nodes) {
      if (n.parentId != null && ids.has(n.parentId)) {
        g.setParent(n.id, n.parentId);
      }
    }
  }

  for (const e of edges) {
    // Skip dangling edges: otherwise dagre auto-creates phantom nodes that
    // distort layout (especially compound clusters).
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    const hasExplicitBox = e.labelWidth != null || e.labelHeight != null;
    if (e.label || hasExplicitBox) {
      g.setEdge(e.source, e.target, {
        width: e.labelWidth ?? DEFAULT_LABEL_WIDTH,
        height: e.labelHeight ?? DEFAULT_LABEL_HEIGHT,
        labelpos: 'c',
      });
    } else {
      g.setEdge(e.source, e.target);
    }
  }

  layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const placed = g.node(n.id) as { x: number; y: number; width: number; height: number };
    // dagre positions by center; angflow by top-left. Use dagre's computed
    // width/height so cluster (group) nodes convert by their wrapping size
    // (for leaf nodes this equals the size we set, so flat output is unchanged).
    positions[n.id] = { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 };
  }
  return positions;
```

(This removes the old `dims` Map — the dimensions are computed inline for `setNode`, and the top-left conversion now reads dagre's post-layout box. Keep the existing `DEFAULT_*` constants.)

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `cd packages/angular && npx vitest run src/lib/layout/layout-nodes.spec.ts && npx tsc --noEmit`
Expected: PASS — the new compound tests AND all pre-existing flat tests (the flat-path output is byte-identical because dagre keeps leaf node dims, so `placed.width/height` equals the set dims).

- [ ] **Step 5: Update the docstring**

In the `layoutNodes` JSDoc, after the existing "Edge labels: pass `labelWidth`/`labelHeight` …" sentence (before the closing `*/`), append:

```
 *
 * Groups: a node with a `parentId` that is also in the input is clustered within
 * that parent (dagre compound layout); nesting is supported. Compound output is
 * in absolute coordinates — apply it with
 * `applyLayout(layoutNodes, { coordinateSpace: 'absolute' })` so parented nodes
 * are translated into their parent-relative space. Group boxes are laid out but
 * NOT resized to wrap their members (size them app-side, or see the auto-size
 * feature). Edges whose endpoints aren't in the node set are skipped.
```

- [ ] **Step 6: Full suite (no regressions)**

Run: `cd packages/angular && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/angular/src/lib/layout/layout-nodes.ts packages/angular/src/lib/layout/layout-nodes.spec.ts
git commit -m "feat(layout): compound (group-aware) layoutNodes clusters members by parentId

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Build, version bump, example regression

**Files:**
- Modify: `packages/angular/package.json` (version)

- [ ] **Step 1: Build the angular package**

Run (in `packages/angular`): `npm run build`
Expected: clean ngc + CSS bundle.

- [ ] **Step 2: Example regression (regression bar)**

Run: `cd packages/system && npm run build` then `cd packages/angular && npm run build` then `cd examples/angular && npm run build`
Expected: example builds clean (pre-existing bundle-budget + dagre-not-ESM warnings are fine).

- [ ] **Step 3: Version bump (patch — additive)**

Edit `packages/angular/package.json` `"version"` from `0.1.1` to `0.1.2`.

- [ ] **Step 4: Publish (USER ACTION — npm 2FA)**

> Do not run autonomously. Surface: `cd packages/angular && npm publish --access public`.

- [ ] **Step 5: Commit the version bump**

```bash
git add packages/angular/package.json
git commit -m "chore(angular): 0.1.2 — compound group-aware layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Feedback bookkeeping (#8)

**Files:**
- Modify: `C:\Users\shisu\CodeWeb\brainstorm_agentic_app\docs\angflow-feedback.md`

- [ ] **Step 1: Mark #8 ✅**

Change `## 8. ⛳ \`layoutNodes\`/\`applyLayout\` ignore group containment (no compound layout)` to `## 8. ✅ …` and append (use the real implementing commit hash from Task 1 — `git -C C:/Users/shisu/CodeWeb/angflow log --oneline -4`):

```markdown
- **✅ Fixed in angflow** (`<task1-hash>`): `layoutNodes` now reads each node's `parentId` and, when
  any parent is in the set, builds a `{ compound: true }` dagre graph and `setParent`s members so
  they cluster within their group (nesting-aware). Output is absolute — apply with
  `applyLayout(layoutNodes, { direction, coordinateSpace: 'absolute' })` (the #10 primitive
  translates grouped children to parent-relative space). Also skips dangling-edge endpoints. Shipped
  in `@angflow/angular@0.1.2`. Once the app is on it: delete the compound-dagre body of
  `web/src/app/canvas/tidy-layout.ts` and call `applyLayout` with `coordinateSpace:'absolute'`. Group
  box **sizing** stays app-side (`groupBounds`) until #9 — #8 lays out members only.
```

- [ ] **Step 2: Commit (in the brainstorm_agentic_app repo)**

```bash
cd /c/Users/shisu/CodeWeb/brainstorm_agentic_app
git add docs/angflow-feedback.md
git commit -m "docs(feedback): mark angflow #8 (compound group layout) fixed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Cluster detection = any parentId target; `parentId` on `LayoutNodeInput` → Task 1 (a)+(b). ✓
- Compound graph + setParent (guarded to in-set parents) → Task 1 (b). ✓
- Nesting → Task 1 (b) (setParent chains) + nested test. ✓
- Backward-compatible flat path (conditional compound; dagre-box conversion equals leaf dims) → Task 1 (b) + existing flat tests remain green (Step 4/6). ✓
- Dangling-edge guard → Task 1 (b) + dangling test. ✓
- dagre-box top-left conversion (correct for clusters) → Task 1 (b). ✓
- Pure (no DOM), no applyLayout/store/system change → Task 1 only touches layout-nodes.ts. ✓
- Docstring: compound output absolute, apply with coordinateSpace, box-size #9 boundary → Task 1 Step 5. ✓
- Rollout (build, version, feedback) → Task 2 + Task 3. ✓

**Type consistency:**
- `LayoutNodeInput.parentId?: string` — defined Task 1 (a), read in Task 1 (b). ✓
- `placed` typed `{ x; y; width; height }` for the conversion — consistent. ✓
- Return shape `Record<string,{x,y}>` unchanged — consistent with spec + callers. ✓

**Placeholder scan:** No TBD/TODO. Task 3 `<task1-hash>`/`@0.1.2` resolved at execution time (runtime values, per prior plans). ✓
