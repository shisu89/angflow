# Examples Parity

Side-by-side comparison of examples that exist in `examples/angular/`, `examples/react/`, and `examples/svelte/`.

Use this to identify gaps in Angular coverage and to decide what to port next.

- ✅ = example present in that framework
- ➖ = not present
- Names show the directory under each framework's examples folder

Some mappings are inferred from name similarity; a few may need verification against the actual code if you're porting.

## Summary

| Framework | Example count |
|---|---|
| React | 63 |
| Svelte | 27 |
| **Angular** | **34** |

Angular is missing ~29 examples that exist in React, and ~1 that exists in Svelte.

## Full table

| Concept | Angular | React | Svelte |
|---|---|---|---|
| A11y / Accessibility | ✅ `a11y` | ✅ `A11y` | ✅ `a11y` |
| Add node on edge drop | ➖ | ✅ `AddNodeOnEdgeDrop` | ✅ `add-node-on-drop` |
| Backgrounds | ✅ `backgrounds-variants` | ✅ `Backgrounds` | ➖ |
| Basic (minimal example) | ➖ | ✅ `Basic` | ➖ |
| Broken nodes (error handling) | ➖ | ✅ `BrokenNodes` | ➖ |
| Cancel connection | ✅ `cancel-connection` | ✅ `CancelConnection` | ➖ |
| Cardinal edges (four-side snapping) | ✅ `cardinal-edges` | ➖ | ➖ |
| Click distance | ✅ `click-distance` | ✅ `ClickDistance` | ➖ |
| Color mode (light/dark) | ✅ `color-mode` | ✅ `ColorMode` | ✅ `color-mode` |
| Connection validation | ✅ `connection-validation` | ✅ `Validation` | ✅ `validation` |
| Controlled / uncontrolled | ➖ | ✅ `ControlledUncontrolled` | ➖ |
| Controlled viewport | ✅ `controlled-viewport` | ✅ `ControlledViewport` | ✅ `two-way-viewport` |
| Custom connection line | ➖ | ✅ `CustomConnectionLine` | ✅ `custom-connection-line` |
| Custom edge | ✅ `custom-edge` | ✅ `EdgeRenderer` ¹ | ➖ |
| Custom minimap node | ✅ `minimap-custom` | ✅ `CustomMiniMapNode` | ✅ `custom-minimap` |
| Custom node | ✅ `custom-node` | ✅ `CustomNode` | ✅ `customnode` |
| Default edge overwrite | ✅ `default-overwrites` | ✅ `DefaultEdgeOverwrite` | ➖ |
| Default node overwrite | ✅ `default-overwrites` | ✅ `DefaultNodeOverwrite` | ➖ |
| Default nodes | ➖ | ✅ `DefaultNodes` | ➖ |
| Detached handle | ➖ | ✅ `DetachedHandle` | ✅ `detached-handle` |
| DevTools | ➖ | ✅ `DevTools` | ➖ |
| Drag from sidebar | ✅ `drag-from-sidebar` | ✅ `DragNDrop` | ✅ `drag-n-drop` |
| Drag handle (restrict drag start) | ✅ `drag-handle` | ✅ `DragHandle` | ➖ |
| Easy connect (click to connect) | ➖ | ✅ `EasyConnect` | ✅ `handle-connect` ² |
| Edge routing | ➖ | ✅ `EdgeRouting` | ➖ |
| Edge toolbar | ✅ `edge-toolbar` | ✅ `EdgeToolbar` | ✅ `edge-toolbar` |
| Edge types | ✅ `edge-types` | ✅ `EdgeTypes` | ✅ `edges` |
| Edges (generic) | ➖ | ✅ `Edges` | ➖ |
| Empty flow | ➖ | ✅ `Empty` | ➖ |
| Figma-style | ➖ | ✅ `Figma` | ✅ `figma` |
| Floating edges | ✅ `floating-edges` | ✅ `FloatingEdges` | ➖ |
| Hidden nodes/edges | ✅ `hidden` | ✅ `Hidden` | ➖ |
| Interaction (pan/zoom toggles) | ✅ `interaction` | ✅ `Interaction` | ✅ `interaction` |
| Interactive minimap | ✅ `interactive-minimap` | ✅ `InteractiveMinimap` | ➖ |
| Intersection (`getIntersectingNodes`) | ➖ | ✅ `Intersection` | ✅ `intersections` |
| Layouting (dagre) | ➖ | ✅ `Layouting` | ✅ `dagre` |
| Middlewares | ➖ | ✅ `Middlewares` | ➖ |
| Moving handles | ➖ | ✅ `MovingHandles` | ➖ |
| Multi flows on one page | ✅ `multi-flows` | ✅ `MultiFlows` | ➖ |
| Multi setNodes | ✅ `set-nodes-batching` | ✅ `MultiSetNodes` | ➖ |
| Node resizer | ✅ `node-resizer` | ✅ `NodeResizer` | ✅ `node-resizer` |
| Node selection bug repro | ➖ | ✅ `NodeSelectionBug` | ➖ |
| Node toolbar | ✅ `node-toolbar` | ✅ `NodeToolbar` | ✅ `node-toolbar` |
| Node type change | ✅ `node-type-change` | ✅ `NodeTypeChange` | ➖ |
| Node types object change | ➖ | ✅ `NodeTypesObjectChange` | ➖ |
| Overview (kitchen sink) | ✅ `overview` | ✅ `Overview` | ✅ `overview` |
| Provider (multi-instance state) | ➖ | ✅ `Provider` | ➖ |
| Reconnect edge | ➖ | ✅ `ReconnectEdge` | ➖ |
| Redux | ➖ | ✅ `Redux` | ➖ |
| Reset flow | ➖ | ➖ | ✅ `reset` |
| Save & restore | ✅ `save-restore` | ✅ `SaveRestore` | ➖ |
| Set nodes batching | ✅ `set-nodes-batching` | ✅ `SetNodesBatching` | ➖ |
| Stress (perf) | ➖ | ✅ `Stress` | ✅ `stress` |
| Sub flows | ✅ `sub-flows` | ✅ `Subflow` | ✅ `subflows` |
| Switch (conditional rendering) | ➖ | ✅ `Switch` | ➖ |
| Touch device | ✅ `touch-device` | ✅ `TouchDevice` | ➖ |
| Typed handles | ✅ `typed-handles` | ➖ | ➖ |
| Undirectional (source/target only) | ✅ `undirectional` | ✅ `Undirectional` | ➖ |
| Update node | ✅ `update-node` | ✅ `UpdateNode` | ➖ |
| `useConnection` hook | ➖ | ✅ `UseConnection` | ➖ |
| `useKeyPress` hook | ➖ | ✅ `UseKeyPress` | ➖ |
| `useNodeConnections` hook | ➖ | ✅ `UseNodeConnections` | ➖ |
| `useNodesData` hook | ➖ | ✅ `UseNodesData` | ✅ `usenodesdata` |
| `useNodesInit` hook | ➖ | ✅ `UseNodesInit` | ➖ |
| `useOnSelectionChange` hook | ➖ | ✅ `UseOnSelectionChange` | ➖ |
| `useReactFlow` / `useSvelteFlow` hook | ➖ | ✅ `UseReactFlow` | ✅ `usesvelteflow` |
| `useUpdateNodeInternals` hook | ➖ | ✅ `UseUpdateNodeInternals` | ✅ `useupdatenodeinternals` |
| Z-index mode | ✅ `z-index-mode` | ✅ `ZIndexMode` | ➖ |

¹ `EdgeRenderer` is the React name for the custom-edge-component demo. Likely maps to Angular's `custom-edge`, but worth confirming against the code.
² `handle-connect` in Svelte plausibly corresponds to both `EasyConnect` and `UseConnection` in React — verify on port.

## Angular-only examples

These don't yet exist in React or Svelte:

- `cardinal-edges` — four-side snapping edges
- `typed-handles` — strongly-typed handle IDs

## Suggested priorities for porting

Tier 1 (small, broad utility):

1. **color-mode** — light/dark toggle
2. **interaction** — pan/zoom/drag flag toggles
3. **add-node-on-edge-drop** — common UX pattern

Tier 2 (meatier, highly requested):

4. **layouting** (dagre) — auto-layout
5. **intersection** — `getIntersectingNodes` API
6. **stress** — performance showcase

Tier 3 (showcase):

7. **figma** — visually polished demo
8. **custom-connection-line** — completes the floating/cardinal set

Tier 4 (API hooks — require equivalent Angular APIs to exist first):

- `use-connection`, `use-on-selection-change`, `use-update-node-internals`, `use-nodes-data`, etc. — port once the Angular service equivalents are confirmed stable.

## API gaps surfaced during Tier 1–2a

- `NgFlowComponent` input **`autoPanOnNodeFocus`** — expected by the React A11y example but not yet implemented on `NgFlowComponent`. Dropped from the Angular `a11y` example; when added, wire a signal-driven `[autoPanOnNodeFocus]` binding and a checkbox toggle per the plan's scaffold.
- `NgFlowComponent` input **`[viewport]`** — declared as a two-way `model<Viewport>` but its value is never read by the pan/zoom instance (it's initialized from `defaultViewport()` and mutated by user gestures). Writing to the parent-side signal bound via `[viewport]` has no visual effect. `(viewportChange)` works as expected, and imperative `NgFlowService.setViewport()` / `fitView()` work by bypassing the input. Surfaced by the `controlled-viewport` example — the "update viewport" and "toggle viewport" buttons update the stored signal but don't move the canvas until the library wires the input into the pan/zoom initializer.
- **Unknown-type fallback for `nodeTypes` / `edgeTypes`** — the renderer's lookup is `customTypes[resolvedType] ?? builtInTypes[resolvedType] ?? HardcodedDefault`. xyflow/React's behavior is that unknown types fall through to `customTypes.default` (so registering `nodeTypes: { default: X }` applies X both to explicit `type: 'default'` and to unknown types). In angflow, unknown types hit the hardcoded default instead. Surfaced by the `default-overwrites` example — the prescribed React-port code used `type: 'unregistered'` on a node and edge to demonstrate unknown-fallback, but those would have rendered as built-ins; we adjusted the example to drop the `'unregistered'` markers so only the `'default'` override is demonstrated.
