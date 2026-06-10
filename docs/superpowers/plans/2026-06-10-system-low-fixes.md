# System Package Low-Severity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two low-severity issues in `@angflow/system`: NaN classification in `inferSide` for zero-size rects, and invisible (`hidden`) nodes capturing floating connection drops.

**Architecture:** Two one-line guards with regression tests, in the fork-modified files of the system package. No API changes.

**Tech Stack:** TypeScript, vitest (`pnpm -F @angflow/system test`).

**Part of:** `2026-06-10-review-remediation-master.md` (Plan F). Fully independent — can run any time, in parallel with everything else. Note: changes to `packages/system` require `pnpm -F @angflow/system build` before the Angular package or example picks them up, and a patch version bump at the next publish.

---

### Task 1: `inferSide` — guard zero half-extents against NaN classification

**Files:**
- Modify: `packages/system/src/utils/edges/floating.ts` (lines 58-59)
- Test: `packages/system/src/utils/edges/floating.spec.ts` (inside the existing `describe('inferSide')`)

Why: with `width === 0` and `dx === 0`, `nx = 0/0 = NaN`; every `NaN` comparison is false, so classification falls through to Top regardless of where the point actually lies. Verified: `inferSide({x:15,y:10}, {x:10,y:10,width:0,height:0})` returns `Top` today instead of `Right`. (`getFloatingEndpoint` already handles its degenerate case correctly at line 30-32.)

- [ ] **Step 1: Write failing test.** Add to the `describe('inferSide')` block in `floating.spec.ts` (matches the file's existing flat `it` style with the shared `rect` constant left untouched):

```ts
  it('classifies points beside a zero-size rect without NaN fallout', () => {
    const degenerate = { x: 10, y: 10, width: 0, height: 0 };
    expect(inferSide({ x: 15, y: 10 }, degenerate)).toBe(Position.Right);
    expect(inferSide({ x: 5, y: 10 }, degenerate)).toBe(Position.Left);
    expect(inferSide({ x: 10, y: 15 }, degenerate)).toBe(Position.Bottom);
    expect(inferSide({ x: 10, y: 5 }, degenerate)).toBe(Position.Top);
  });

  it('classifies a point beside a zero-width rect (tall line) — regression guard', () => {
    const line = { x: 10, y: 0, width: 0, height: 100 };
    expect(inferSide({ x: 20, y: 60 }, line)).toBe(Position.Right);
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/system test src/utils/edges/floating.spec.ts`
  Expected: the first test fails — `Right` and `Left` assertions receive `Top` (NaN comparisons fall through). The Bottom/Top assertions and the second test pass already (±Infinity classifies "correctly" by accident); they stay as regression guards.

- [ ] **Step 3: Implement.** Replace lines 55-59 of `floating.ts` (the normalization comment and the two divisions) with:

```ts
  // Normalize by half-extents so the comparison identifies the border segment
  // the point actually lies on (matches getFloatingEndpoint's crossing-axis
  // choice); raw deltas misclassify top/bottom points on non-square nodes.
  // A half-extent of 0 (unmeasured/zero-size rect) would divide to NaN/Infinity
  // and fall through to Top — treat it as 1 so classification degrades to a
  // raw-delta comparison instead.
  const nx = (intersection.x - cx) / (nodeRect.width / 2 || 1);
  const ny = (intersection.y - cy) / (nodeRect.height / 2 || 1);
```

- [ ] **Step 4: Run, confirm green.**
  Command: `pnpm -F @angflow/system test src/utils/edges/floating.spec.ts`
  Expected: all tests pass (the existing wide/tall misclassification regression tests are the safety net for this change).

- [ ] **Step 5: Commit.**
  Command: `git add packages/system/src/utils/edges/floating.ts packages/system/src/utils/edges/floating.spec.ts` then
  `git commit -m "fix(system): inferSide guards zero half-extents - NaN comparisons fell through to Top"`

---

### Task 2: `getFloatingDropTarget` — skip hidden nodes

**Files:**
- Modify: `packages/system/src/xyhandle/utils.ts` (line 104, the per-node skip guards in the candidate loop)
- Test: `packages/system/src/xyhandle/utils.spec.ts` (inside the existing `describe('getFloatingDropTarget')`)

Why: explicitly hidden nodes (`node.hidden === true`) remain in `nodeLookup` (visibility filtering is render-level), so an invisible node can become the Stage-2 drop candidate and `onConnectionTargetChange` highlights an invisible node id. The connection is rejected later (no DOM handle found), so impact is cosmetic — but the highlight flicker is wrong. NOTE: collapse-hidden children do NOT set `node.hidden` (collapse hiding lives in the Angular package's `visibleNodes` computed); filtering those would need a visibility-predicate hook, which is intentionally deferred (see master plan's deferred list).

- [ ] **Step 1: Write failing tests.** Add to the `describe('getFloatingDropTarget')` block in `utils.spec.ts` (reuses the file's `makeNode`/`makeLookup` helpers; `hidden` is set post-construction since the factory doesn't expose it):

```ts
  it('skips hidden nodes even when the pointer is inside them', () => {
    const hiddenNode = makeNode('H', {
      x: 0, y: 0, width: 100, height: 50,
      floatingHandles: [{ id: 'auto', type: 'target', position: Position.Left }],
    });
    hiddenNode.hidden = true;
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      makeLookup(hiddenNode),
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result).toBeNull();
  });

  it('prefers a visible node over an overlapping hidden node with higher z', () => {
    const hiddenNode = makeNode('H', {
      x: 0, y: 0, width: 100, height: 50, zIndex: 10,
      floatingHandles: [{ id: 'h', type: 'target', position: Position.Left }],
    });
    hiddenNode.hidden = true;
    const visibleNode = makeNode('V', {
      x: 0, y: 0, width: 100, height: 50, zIndex: 1,
      floatingHandles: [{ id: 'v', type: 'target', position: Position.Left }],
    });
    const result = getFloatingDropTarget(
      { x: 50, y: 25 },
      makeLookup(hiddenNode, visibleNode),
      { nodeId: 'B', type: 'source', id: null },
    );
    expect(result?.nodeId).toBe('V');
  });
```

- [ ] **Step 2: Run, confirm failure.**
  Command: `pnpm -F @angflow/system test src/xyhandle/utils.spec.ts`
  Expected: first test fails (returns the hidden node's handle, not null); second fails (`result.nodeId` is `'H'` — higher z wins despite being hidden).

- [ ] **Step 3: Implement.** In `getFloatingDropTarget` (utils.ts), add one guard directly after the self-node skip at line 104:

```ts
  for (const node of nodeLookup.values()) {
    if (node.id === fromHandle.nodeId) continue;
    // Hidden nodes remain in nodeLookup (visibility filtering is render-level);
    // an invisible node must not capture connection drops or highlights.
    if (node.hidden) continue;
```

- [ ] **Step 4: Run, confirm green.**
  Command: `pnpm -F @angflow/system test src/xyhandle/utils.spec.ts`
  Expected: all tests pass.

- [ ] **Step 5: Rebuild system so dependents link the fix, run the angular suite as integration check.**
  Command: `pnpm -F @angflow/system build` then `pnpm -F @angflow/angular test`
  Expected: build succeeds; angular suite green.

- [ ] **Step 6: Commit.**
  Command: `git add packages/system/src/xyhandle/utils.ts packages/system/src/xyhandle/utils.spec.ts` then
  `git commit -m "fix(system): getFloatingDropTarget skips hidden nodes - invisible nodes captured connection drops"`
