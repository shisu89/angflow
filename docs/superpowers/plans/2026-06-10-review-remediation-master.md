# Review Remediation Master Plan (2026-06-10)

> **For agentic workers:** This is the index/coordination document. Each sub-plan below is independently executable with superpowers:subagent-driven-development or superpowers:executing-plans. Execute sub-plans in the order given here; within a sub-plan, follow its own task order.

**Goal:** Remediate every finding from the 2026-06-10 full-repo review (security, correctness, performance, lifecycle/API, repo health) across `@angflow/angular`, `@angflow/system`, and `@angflow/mcp`.

**Architecture:** Six sub-plans, one per independent cluster. All work is trunk-based on `main` with frequent small commits (TDD per task). Plans that touch overlapping files are strictly ordered; the rest can interleave.

**Tech Stack:** Angular 21 signals (zoneless), vitest, pnpm workspaces, GitHub Actions, Node `ws`/`node:crypto`.

---

## Sub-plans

| ID | Plan file | Tasks | Theme |
|----|-----------|-------|-------|
| A | `2026-06-10-correctness-fixes.md` | 8 | Drag fast path, compound layout, collapse, deleteElements, bridge layout_nodes |
| B | `2026-06-10-security-hardening.md` | 6 | MCP WS Origin/token/timing-safe/maxPayload, selector escaping, style validation, payload caps, trust-model docs |
| C | `2026-06-10-performance.md` | 5 | Pan/zoom version bumps, node-input cache keys, edge memoization, bridge throttle, Set equality |
| D | `2026-06-10-lifecycle-api.md` | 11 | Transport stop, handle-registry leak, resizer reactivity, fitView race, [viewport], ng-flow-provider, selectable, SSR guard |
| E | `2026-06-10-repo-health.md` | 9 | CI replacement, workspace:^, peer range, lint, packaging metadata, gitignore, changelogs, CLAUDE.md |
| F | `2026-06-10-system-low-fixes.md` | 2 | inferSide NaN guard, hidden-node drop targets |

## Execution order

```
E1–E3 (clean tree, workspace:^, peers)   ← first: unblocks clean status + correct local linking
A (all 8 tasks)                          ← correctness before anything that touches the same files
E4–E5 (CI + lint)                        ← CI lands once the suite is green post-A, guards the rest
C (all 5 tasks)                          ← after A: both modify flow-store.service.ts + agent-bridge.service.ts
D (all 11 tasks)                         ← after C: both modify ng-flow.component.ts + edge-renderer.component.ts
B (all 6 tasks)                          ← B1–B2 (MCP server + transport) can actually run any time after A7;
                                            B3–B5 touch agent-bridge.service.ts/ng-flow.service.ts → after A & C
F (2 tasks) + E6–E9 (polish/docs)        ← any time; F is fully independent
```

Rationale for the hard orderings:
- **A before C/D/B(3-5):** A rewrites regions of `flow-store.service.ts`, `ng-flow.service.ts`, and `agent-bridge.service.ts` that C/D/B also touch. Running A first means later plans' cited line numbers drift, but their code anchors (function names, quoted context) still match; the reverse order would invalidate A's larger rewrites.
- **C before D:** C restructures the edge-renderer template (`@let` consolidation) that D Task 6 (edge `selectable`) edits; D's smaller edit is easy to apply on top of C, not vice versa.
- **E2 (workspace:^) early:** until it lands, `packages/angular` resolves `@angflow/system` from the npm registry, so Plan F's system changes would not even be visible to the angular suite's integration check.
- **E4 (CI) after A:** CI's local dry-run requires the full suite green; A is the plan most likely to surface pre-existing breakage.

## Global execution rules

1. **Line numbers in sub-plans are as of commit `b39eaa61d`** (plus the uncommitted working tree at planning time). Earlier tasks shift later line numbers — locate edits by the quoted code context, not the line number alone.
2. **After any `packages/system` change:** `pnpm -F @angflow/system build` before running the angular suite or example (CLAUDE.md rule).
3. **Any agent-bridge behavior change** updates `packages/angular/AGENT_BRIDGE.md` in the same commit; any `tool-schemas.ts` change regenerates the mcp snapshot (`pnpm -F @angflow/mcp run generate:schemas`) — both rules are already embedded in the relevant tasks; do not skip them.
4. **At each sub-plan boundary** run the full gate: `pnpm -F @angflow/system test && pnpm -F @angflow/angular test && pnpm -F @angflow/mcp test` plus `pnpm typecheck`. (After E4 lands, this is just the CI command set.)
5. **No publishing** in any plan. Version-bump notes (peer-range narrowing → minor bump) are recorded for the next manual release.
6. Trunk-based on `main`; conventional commits; one commit per task step as specified in each plan.

## Coverage map (review finding → plan.task)

**Security review:**
- MCP WS no Origin check / optional token / timing-unsafe compare / unbounded frames → B.1 (server) + B.2 (transport)
- Unescaped node id in querySelector (`updateNodeInternals`) → B.3
- Agent-supplied style/className unvalidated → B.4
- Bulk-tool payloads unbounded → B.5
- Prompt-injection trust model + WindowTransport production caveat undocumented → B.6

**Correctness review:**
- Drag fast path corrupts positionAbsolute (groups, origin) → A.1
- toRelativePositions uses pre-move parent position → A.2
- Compound layout crash on group-incident edges → A.3
- parentId cycles ≥2 throw → A.4
- Collapse merges unrelated parallel edges → A.5
- Collapse-rerouted edges keep stale handle ids → A.6
- Bridge layout_nodes strips parentId / wrong coordinate space → A.7
- deleteElements bypasses change pipeline → A.8
- sizeGroupToChildren double-tween workaround → folded into A.2 (single corrected map)

**Performance review:**
- bumpVersion on pan/zoom frames → C.1
- Node-inputs cache keyed on global version → C.2
- Edge inputs/path recomputed 3×/2× per pass → C.3
- watchFlow serializes whole graph per drag frame → C.4
- Per-frame Set rebuilds defeating equality → C.5

**Lifecycle/API review:**
- Dead XYMinimap field → D.1 · Node-toolbar stale transform → D.2 · selectKeyPressed SSR/listener accumulation → D.3 · Bridge transports never stopped → D.4 · Handle registry leak → D.5 · Edge/node `selectable` ignored (+ Ctrl+A) → D.6 · NodeResizer one-shot config → D.7 · fitView timeout race → D.8 · Dead `[viewport]` input → D.9 · `<ng-flow-provider>` broken → D.10 · Pan-zoom effect untracked `userSelectionActive` → D.11

**System review:** inferSide zero-size NaN → F.1 · getFloatingDropTarget hidden nodes → F.2

**Repo-health review:** screenshots/gitignore → E.1 · unbounded `>=` dep + stale lockfile → E.2 · peer-range lie → E.3 · broken CI/changesets → E.4 · broken lint → E.5 · LICENSE/repository/engines/declarationMap/browser-types → E.6 · .npmrc/preinstall pin → E.7 · changelogs → E.8 · CLAUDE.md drift → E.9

## Deferred (tracked, intentionally not planned)

| Item | Source finding | Why deferred |
|------|----------------|--------------|
| Rewire minimap to system `XYMinimap` (extent-respecting pan) | M8 | Substantial rework of working code; D.1 removes the dead field; revisit as its own change |
| Migrate node rendering to `injectNgFlowNode` fine-grained context | H3 follow-up | Architecture migration; C.2's cache-key fix captures most of the win |
| Visibility-predicate hook so collapse-hidden children can't be drop targets | LOW 7 (system) | Needs a cross-package API; F.2 covers the `hidden` flag case |
| `as any` cleanup on public seams (XYHandle.onPointerDown, panZoom update, drag callbacks, generic erasure on event outputs) | L5 | Diffuse typing work, no runtime defect; do as a dedicated typing pass |
| Selection-box dragging, autoPan outputs, minimap nodeComponent wiring | L6 | Feature parity roadmap, not defects |
| `setCenter` ignoring `options.interpolate`; EdgeToolbar O(E) `find` | L7 | Negligible impact; fold into the next touch of those files |
| Chat-harness tool-result "data, not instructions" framing | Sec #2 hardening tier | B.6 documents the trust model; framing changes need prompt-design iteration |
| Git history size (87 MiB inherited from xyflow) | Repo-health | Only fixable by history rewrite; accepted |
| System-package test coverage beyond F (XYDrag/XYPanZoom/XYResizer) | Repo-health | Byte-identical to upstream since fork; cover when first modified |
