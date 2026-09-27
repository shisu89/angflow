# @angflow/angular

## Unreleased

### Fixed

- **Dragging no longer mutates the app's node objects.** The drag fast path used to
  assign `position`/`dragging` onto user-supplied objects, which threw on frozen state
  (NgRx / `@ngrx/signals` dev-mode freezing) and made controlled vetoes impossible.
  Moved nodes are now new objects (still O(changes) per frame), and
  `selectInternalNode` consumers update during a drag.
- **SSR-safe:** `<ng-flow>`, the node renderer, drag and resizer skip browser-only
  setup (ResizeObserver, MutationObserver, d3-zoom, XYDrag, matchMedia) on the server
  instead of throwing; position tweens jump to the target without
  `requestAnimationFrame`.
- Edges whose source/target node doesn't exist are no longer drawn to (0,0); edges
  naming an unknown handle id are skipped with error008 (React parity).
- Removed node elements are always unobserved by the ResizeObserver (leak).
- `updateNodeInternals` resolves only node elements inside its own flow (it could hit
  an edge `<g data-id>` or a nested flow's node with the same id).
- Box selection skips nodes hidden inside collapsed groups and selects edges connected
  to the swept nodes (React parity) instead of clearing edge selection.
- **`<ng-flow>` inputs that were accepted but ignored now work:**
  `defaultEdgeOptions` (merged into every rendered edge and its markers; applied to
  user-completed connections), `ariaLabelConfig`, `reconnectRadius`,
  `elevateEdgesOnSelect`, `nodeClickDistance`, `defaultMarkerColor`,
  `connectionLineStyle`, `connectionLineContainerStyle`, `attributionPosition`.
  In uncontrolled mode (`defaultEdges`) a completed connection now adds its edge.
- Edge `style` objects use React semantics: camelCase keys become kebab-case and
  unitless numbers get `px` where CSS needs it (`{ strokeWidth: 3 }` previously
  produced invalid CSS). Built-in edges honour `pathOptions`; `labelStyle`,
  `labelShowBg`, `labelBgStyle`, `labelBgPadding`, `labelBgBorderRadius` render.
  Edge labels get a themed background by default (`labelShowBg: false` removes it).
- Calling `updateNode` / `updateNodeData` / `updateEdge*` / `setNodes` /
  `setSelection` / `deleteElements` from inside an `effect()` no longer
  subscribes the effect to the state it writes — the `update-node` example
  froze the page in an infinite loop. Store write paths now run `untracked`.
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

- **Accessibility (React Flow parity, axe-clean):** nodes render as
  `role="group"` + `aria-roledescription="node"` (was `role="button"` with a
  disallowed `aria-selected`), edges as `role="group"` + `aria-roledescription="edge"`
  (was `role="img"` while focusable). Per-element `ariaRole` and `focusable` props,
  previously declared but ignored, are honoured. The minimap's labelled container
  gets `role="img"`.
- **Keyboard actions are scoped to their flow.** Delete, Ctrl/Cmd+A, Escape and
  arrow-key moves act only when the key event comes from inside the flow (or focus
  is on `<body>` and this flow was the last one clicked/focused). Previously the
  handler acted page-wide: arrow keys moved selected nodes and blocked page scroll
  from anywhere, Ctrl+A was hijacked everywhere, and every flow on the page reacted
  at once. Modifier/activation-key tracking stays page-wide.
- Arrow-key moves skip `draggable: false` nodes, respect `nodesDraggable`, and
  step 5px (Shift ×4) like React Flow — previously 1px.
- Select-all honours `selectable` / `elementsSelectable` and skips nodes hidden by
  a collapsed group.
- **`deleteElements` and the Delete key cascade to child nodes and honour
  `deletable: false`** (React Flow `getElementsToRemove` semantics); deleting a
  group no longer leaves children with a dangling `parentId`. `onBeforeDelete` may
  return a reduced `{ nodes, edges }` set as well as a boolean. `dissolveGroup`
  still keeps the children.
- Example agent proxies (`examples/angular/server/`) reject browser requests from
  non-localhost origins (extend with `ANGFLOW_ALLOWED_ORIGINS`) instead of sending
  wildcard CORS — a visited website could otherwise spend the developer's key. The
  Anthropic proxy enables prompt caching and defaults to `claude-opus-5`; the OpenAI
  proxy defaults to `gpt-5.6-luna`.

### Added

- `provideAgentChat({ source })` — provenance tag on every chat tool call
  (default `'agent:chat'`), visible to `canMutate`, the op-log and `flow.history`.
- `<ng-flow-agent-chat [colorMode]>` (`'light' | 'dark' | 'system'`); every colour is
  a `--ngf-chat-*` variable, and the panel turns dark automatically inside a `.dark`
  ancestor such as `<ng-flow colorMode="dark">`.
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
