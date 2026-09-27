# @angflow/angular

## Unreleased

### Fixed

- Agent bridge: reject graph-corrupting or no-op agent calls with `-32602` —
  duplicate node/edge ids, edges whose `source`/`target` node doesn't exist,
  updates to unknown ids (previously `null` + a spurious undo entry), and patches
  that rewrite `id`, set a non-finite `position`, or create a `parentId` cycle.
  `set_viewport` now requires finite values and `zoom > 0`.
- Agent bridge: `delete_elements` (standalone and inside `apply_changes`) now
  deletes descendants of deleted group nodes instead of leaving them with a
  dangling `parentId`, and skips elements marked `deletable: false`.
- Agent bridge: `flow.state` is no longer suppressed for changes outside a
  curated field list (`collapsed`, `parentId`, `className`, `zIndex`, size, …).
- Agent bridge: op-log entries now contain bridge-minted ids (`add_node` without
  `id`, `group_nodes` without `groupId`) so logged ops can be replayed.
- Agent chat: a response cut off by `max_tokens` mid tool call no longer leaves
  an unanswered `tool_use` in history (which made every later request fail); the
  truncated calls are skipped and reported to the model as errors.
- `NgFlowService.setNodes` / `setEdges` now emit the equivalent diff through
  `(nodesChange)` / `(edgesChange)`, as documented. Controlled parents previously
  never heard about full replacements (including agent `set_nodes`, undo and
  redo) and reverted them on their next change.
- `NgFlowService.groupNodes` (and the `group_nodes` agent tool) now inserts the
  group node before its first member instead of appending it. Parents must
  precede children in the nodes array; the old order logged "Parent node … not
  found" on every subsequent update and resolved child positions late.
- `WebSocketTransport` no longer reconnects after close code `4000` (replaced by
  a newer canvas), which made two open tabs evict each other forever.

### Changed

- Example agent proxies (`examples/angular/server/`) reject browser requests from
  non-localhost origins (extend with `ANGFLOW_ALLOWED_ORIGINS`) instead of sending
  wildcard CORS — a visited website could otherwise spend the developer's key. The
  Anthropic proxy enables prompt caching and defaults to `claude-opus-5`.

### Added

- `provideAgentChat({ source })` — provenance tag on every chat tool call
  (default `'agent:chat'`), visible to `canMutate`, the op-log and `flow.history`.
- `CompleteFn` receives `{ signal }`; the chat's Stop button aborts it, so the
  in-flight model request is cancelled (pass it to `fetch`). Not reported as an error.
- Agent chat panel accessibility: live-region message log, labelled composer
  and send button, `role="alert"` errors.

## 0.3.2

### Changed

- Lowered the `@angular/core` / `@angular/common` peer range from `>=21.0.0` back
  to `>=19.0.0`. The published partial-Ivy output only requires linker 17.1+
  (its `minVersion` is set by the features used — signal inputs — not by the
  compiler that built it), so the library is consumable from Angular 19+ even
  though it is built and tested on Angular 21. Verified by building an Angular 19
  app against the packed output.

### Fixed

- `NgFlowService` now imports `DOCUMENT` from `@angular/common` instead of
  `@angular/core`. `@angular/core` only re-exports `DOCUMENT` on Angular 20+, so
  the previous import broke Angular 19 consumers at bundle time
  (`No matching export … for import "DOCUMENT"`). `@angular/common` exports it on
  both 19 and 21.

## 0.3.0

### Added

- `<ng-flow>` `[autoPanOnNodeFocus]` input (default `true`) — pans the viewport
  when a node receives keyboard focus, matching React's `autoPanOnNodeFocus`.
- Selection box is now draggable as a group and keyboard-movable (arrow keys,
  Shift = 4×, Escape clears the selection), matching React's `NodesSelection`.

### Changed

- Minimap wheel-zoom default changed: `zoomStep` now defaults to `1` (was `10`),
  matching React's runtime default. The minimap also gained functional
  `pannable`/`zoomable`/`inversePan` inputs (previously pan/zoom interactions
  were always-on and unclamped — they now respect `translateExtent` and the new
  inputs' React-parity defaults `pannable=false`/`zoomable=false`).
- `setCenter` now honors `options.interpolate` (`'smooth'` | `'linear'`);
  previously the option was accepted but ignored.

### Removed

- `(autoPanStart)` / `(autoPanEnd)` outputs. They were declared "Not yet wired",
  never emitted, and have no React equivalent. Removed as never-functional API.

## 0.2.0

Current release (group auto-size: `getGroupBounds` + `sizeGroupToChildren`).
For detailed history prior to this file's introduction, see
`git log --oneline -- packages/angular`. Future releases append entries here.
