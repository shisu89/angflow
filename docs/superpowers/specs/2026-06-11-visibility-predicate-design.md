# Visibility-Predicate Hook — Design (Cluster 3 of the 2026-06-11 deferred-work round)

**Goal:** Collapse-hidden nodes must not capture connection snapping or drops. The system layer gains an optional `isNodeVisible` predicate; the Angular package supplies one backed by `collapsedHiddenIds`.

**Part of:** `2026-06-11-deferred-work-master.md`. Closes the deferred LOW-7 item ("needs a cross-package API").

## Today

- Angular computes collapse-hiding outside the node objects: `collapsedHiddenIds` (`flow-store.service.ts:312-315`) and `visibleNodes` filter at render level. `node.hidden` is **not** set for collapse-hidden children, so the system layer cannot see them.
- System connection paths: `getFloatingDropTarget` skips `node.hidden` (F2); `getNodesWithinDistance`/`getClosestHandle` get the hidden guard in Cluster 1. None of the three can know about collapse-hiding.
- Angular passes the raw `nodeLookup` to `XYHandle.onPointerDown` at two call sites: `handle.component.ts:142-174` and the edge-reconnect site in `edge-renderer.component.ts:~700-713`.

## Design

### System (`packages/system`)

- `OnPointerDownParams` (`xyhandle/types.ts`) gains `isNodeVisible?: (node: InternalNodeBase) => boolean`. Optional — absent means "all non-hidden nodes are visible"; React/Svelte are unaffected (additive field).
- Candidate-eligibility semantics, applied identically in `getNodesWithinDistance`, `getClosestHandle`, and `getFloatingDropTarget`: a node is eligible iff `!node.hidden && (isNodeVisible?.(node) ?? true)`. The predicate **composes with** the built-in `hidden` check; it can only remove candidates, never resurrect a `hidden` one.
- `XYHandle.onPointerDown` threads the predicate from its params into every call of those three functions (including the pointer-move closure where snapping re-evaluates).

### Angular (`packages/angular`)

- Both `XYHandle.onPointerDown` call sites pass `isNodeVisible: (n) => !this.store.collapsedHiddenIds().has(n.id)`. The closure reads the signal at call time, so mid-drag collapse changes are honored on the next pointer-move evaluation.
- No public Angular API change: the predicate is internal wiring. (A user-facing visibility predicate input is out of scope — YAGNI until someone needs custom visibility semantics.)

## Error handling

- Predicate throwing: not guarded — it's first-party code; a throw is a bug we want loud, matching how other system callbacks behave.

## Testing

- System unit tests: for each of the three functions, a predicate-rejected node is never a candidate; predicate absent preserves current behavior; predicate cannot resurrect a `hidden` node.
- Angular integration test: a collapse-hidden child under the pointer is not highlighted/connected during a floating-connection drag (drive via the store with a collapsed group; assert the drop-target callback never names the hidden child).
- Rebuild system before the angular suite (global rule 1).

## Out of scope

A public `isNodeVisible` input on `<ng-flow>`; visibility predicates for drag/selection paths (connection paths only — the original finding's scope).
