# Deferred-Work Round — Master Index (2026-06-11)

**Goal:** Clear the items deferred from the 2026-06-10 review remediation (see the deferred table in `docs/superpowers/plans/2026-06-10-review-remediation-master.md`), plus the three follow-ups the remediation's task reviews surfaced.

**Structure:** Six clusters, each with its own spec (this directory) and implementation plan. Trunk-based on `main`, subagent-driven execution with model delegation (haiku/sonnet/opus by complexity), full gate at each cluster boundary.

## Clusters and execution order

| # | Spec | Theme |
|---|------|-------|
| 1 | `2026-06-11-quick-fixes-design.md` | fitView-on-init gap, node-Enter asymmetry, getNodesWithinDistance hidden guard, setCenter interpolate, EdgeToolbar O(E), chat-harness framing |
| 2 | `2026-06-11-minimap-rework-design.md` | Adopt system XYMinimap; wire nodeComponent |
| 3 | `2026-06-11-visibility-predicate-design.md` | isNodeVisible hook so collapse-hidden nodes can't capture connections |
| 4 | `2026-06-11-feature-parity-design.md` | Selection-box dragging; autoPanOnNodeFocus input; remove dead autoPan output stubs |
| 5 | `2026-06-11-typing-pass-design.md` | Eliminate `as any` on public seams by fixing system types |
| 6 | `2026-06-11-inject-ng-flow-node-design.md` | Migrate built-in nodes to injectNgFlowNode context |

**Ordering rationale:** The typing pass (5) runs after clusters 3–4 so it types the final seam surface (including the new `isNodeVisible` param and selection-drag wiring) once. Cluster 6 is the largest and most independent — last.

## Global rules

1. Any `packages/system` change: `pnpm -F @angflow/system build` before the angular suite runs. System API additions must be optional/additive — `packages/react` and `packages/svelte` stay source-compatible.
2. Zoneless rules (CLAUDE.md): no NgZone; D3/native callbacks drive views via signal writes; timers schedule logic only. The C1 contract holds: `transform.set()` never calls `bumpVersion()`.
3. Tests run from package dirs via `pnpm -F <pkg> test`, never bare vitest from the root.
4. No agent-bridge tool-schema changes are in scope; the mcp snapshot must not need regeneration. The chat-harness change (cluster 1) touches `src/lib/agent/chat/` plus a one-sentence AGENT_BRIDGE.md note in the same commit (CLAUDE.md rule).
5. Full gate at each cluster boundary: system + angular + mcp tests, `pnpm typecheck`, `pnpm lint`.
6. **No publishing until all six clusters land.** Then one coordinated release: system **minor** (new optional API), angular **minor** (new inputs, removed dead outputs, built-in node migration), mcp unchanged.

## Still deferred after this round

| Item | Why |
|------|-----|
| Git history size (87 MiB inherited from xyflow) | Only fixable by history rewrite; accepted |
| System test coverage for XYDrag/XYPanZoom/XYResizer | Byte-identical to upstream since fork; cover when first modified |
