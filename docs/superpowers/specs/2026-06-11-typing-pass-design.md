# Typing Pass — Design (Cluster 5 of the 2026-06-11 deferred-work round)

**Goal:** Zero `as any` in `packages/angular/src` production code, by fixing the system types the casts paper over. `as unknown as` survives only where TypeScript variance genuinely requires it, each with a one-line justification comment. Afterwards, `@typescript-eslint/no-explicit-any` turns on for the angular package to keep it that way.

**Part of:** `2026-06-11-deferred-work-master.md`. Closes deferred item L5. Runs AFTER clusters 3–4 so the seams it types are final.

## Inventory (production code, as of 2026-06-11)

| Site | Cast | Root cause |
|------|------|-----------|
| `handle.component.ts:174` | whole params object `as any` into `XYHandle.onPointerDown` | Angular passes fields `OnPointerDownParams` doesn't declare (and/or omits ones it requires) |
| `edge-renderer.component.ts:713` | same pattern (edge reconnect) | same |
| `ng-flow.component.ts:1043` | whole options object `as any` into `panZoomInstance.update` | pan-zoom update options type missing fields actually consumed (`userSelectionActive`, `lib`, `onTransformChange`, `paneClickDistance` — audit) |
| `flow-store.service.ts:449-450` | `(conn as any).fromNode` / `.fromHandle` | ConnectionState narrowing not expressed |
| `flow-store.service.ts:641` | `userNode as any` | position mirror writes to user node |
| `edge-toolbar.component.ts:62` | `(edge as any)?.zIndex` | fixed in Cluster 1 — verify gone, else fix here |
| `ng-flow.service.ts:53`, `ng-flow.component.ts:240-241` | `inject(FlowStore) as unknown as FlowStore<NodeType, EdgeType>` | generic erasure on the DI token |
| `ng-flow.service.ts:424,427,715,943,957,970` | `as unknown as` generic bridging in graph utils | util signatures not generic over Node/Edge types |
| `ng-flow.component.ts:278,281` | `[] as unknown as NodeType[]` | input default not typed |

## Design

### System type fixes (additive only — React/Svelte must compile unchanged)

- **`OnPointerDownParams`** (`xyhandle/types.ts`): audit field-by-field against what both Angular call sites pass (after Cluster 3 added `isNodeVisible`). Add missing optional fields; where Angular passes something genuinely wrong, fix the Angular call instead of widening the type. Both `as any` casts are deleted, not narrowed.
- **Pan-zoom update options**: same audit for `panZoomInstance.update(...)`; extend the system options type with the optional fields the implementation actually reads. Delete the cast.
- **ConnectionState**: if the system type already has a discriminated in-progress shape (`fromNode`/`fromHandle` on the in-progress variant), use narrowing in `flow-store.service.ts:449-450`; if not, add the optional fields to the type.

### Angular-side typing

- **`injectFlowStore<NodeType, EdgeType>()`** helper (new, `src/lib/utils/` or next to tokens): wraps `inject(FlowStore)` with the single documented variance cast inside. All 3+ inject-cast sites use it.
- **Graph-util generics**: `getConnectedEdges`/`getIncomers`/`getOutgoers` wrappers in `ng-flow.service.ts` get proper generic signatures so the six `as unknown as` casts collapse into typed flows (or, where variance forces it, move into one helper with the justification comment).
- **Input defaults**: `input<NodeType[]>([] as NodeType[])` style typed initializers replace `[] as unknown as NodeType[]` (use whatever form satisfies the signal-input generic cleanly).
- **`userNode as any`** (`flow-store.service.ts:641`): type the mirror write via the node generic or a scoped `Pick<>`.

### Enforcement

- `packages/angular/eslint.config.mjs`: flip `@typescript-eslint/no-explicit-any` from `off` to `error` for `src/**` production code (spec files may keep an override if the test idioms need it — decide in-plan based on actual violations; prefer fixing tests too if cheap).
- Exit gate: `pnpm -F @angflow/angular run lint` green with the rule on; `pnpm typecheck` green in all packages; full test gate green.

## Testing

Behavior must not change — the suites are the regression net. New tests only where a fix reveals an untested seam (e.g. if the ConnectionState narrowing exposes a real branch, pin it).

## Out of scope

Typing `packages/system` internals beyond the seams above; `packages/react`/`packages/svelte` (reference-only); enabling `no-explicit-any` for the mcp package.
