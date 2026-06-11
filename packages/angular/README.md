# @angflow/angular

An Angular library for building node-based UIs, interactive flow charts, and diagrams. Angular 17+, signals-based, OnPush everywhere, no RxJS in the store.

Angular port of [xyflow](https://github.com/xyflow/xyflow) — the library behind [React Flow](https://reactflow.dev) and [Svelte Flow](https://svelteflow.dev). The framework-agnostic core (`@angflow/system`) is a republish of `@xyflow/system`, so drag, pan/zoom, handle routing, and resize logic are identical to what React Flow ships.

## Features

- **Drag & drop nodes** with snap-to-grid support
- **Multiple edge types** — bezier, straight, step, smooth-step, simple-bezier
- **Custom nodes** — render any Angular component as a node (forms, charts, etc.)
- **Custom edges** — build your own edge components
- **Connections** — drag between handles or click-to-connect
- **Selection** — click, shift-drag box select (partial mode), Ctrl/Cmd multi-select
- **Keyboard shortcuts** — Delete/Backspace, Ctrl+A, Escape, arrow keys
- **Pan & zoom** — scroll, pinch, double-click, or use the controls panel
- **Minimap** — interactive viewport preview with customizable node styling
- **Background** — dots, lines, or cross patterns with configurable gap/size
- **Controls** — zoom in/out, fit view, lock interactivity
- **Node toolbar** — context toolbars positioned relative to nodes
- **Edge toolbar** — context toolbars positioned on edges
- **Node resizer** — drag handles to resize nodes
- **Accessibility** — ARIA labels, keyboard navigation, screen reader announcements
- **Dark mode** — light/dark/system color mode support

## Requirements

- Angular 17+
- Standalone components (no NgModule needed)

## Installation

```bash
npm install @angflow/angular @angflow/system
```

## Quick Start

```typescript
import { Component } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
  Position,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { addEdge } from '@angflow/system';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgFlowComponent, BackgroundComponent, ControlsComponent, MiniMapComponent],
  template: `
    <div style="width: 100vw; height: 100vh;">
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-controls />
        <ng-flow-minimap />
      </ng-flow>
    </div>
  `,
})
export class App {
  nodes: Node[] = [
    { id: '1', type: 'input', position: { x: 250, y: 0 }, data: { label: 'Start' } },
    { id: '2', position: { x: 250, y: 150 }, data: { label: 'Process' } },
    { id: '3', type: 'output', position: { x: 250, y: 300 }, data: { label: 'End' } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
  ];

  onNodesChange(changes: any[]) {
    this.nodes = applyNodeChanges(changes, this.nodes);
  }

  onEdgesChange(changes: any[]) {
    this.edges = applyEdgeChanges(changes, this.edges);
  }

  onConnect(connection: Connection) {
    this.edges = addEdge(connection, this.edges) as Edge[];
  }
}
```

## Example App

A full example app lives at [`examples/angular/`](../../examples/angular) in this repo. It's the best place to see working code for every feature — custom nodes and edges, sub-flows, node/edge toolbars, drag-from-sidebar, save/restore, connection validation, and more.

```bash
pnpm install          # from the repo root (first time only)
cd examples/angular
npm run dev           # opens http://localhost:4200
```

The example consumes `@angflow/angular` and `@angflow/system` via pnpm `workspace:*`, so local edits in `packages/angular/` are picked up immediately — no rebuild or reinstall step needed.

The app ships three sections:

- **Gallery** ([`src/app/examples/`](../../examples/angular/src/app/examples)) — focused, one-feature-per-page demos (overview, custom node/edge, edge types, floating edges, node resizer, connection validation, drag-from-sidebar, sub-flows, node/edge toolbars, custom minimap, background variants, save/restore)
- **Showcase** ([`src/app/showcase/`](../../examples/angular/src/app/showcase)) — an end-to-end demo with a node palette, inspector panel, and simulation service; a good template for a real app
- **Kitchen Sink** ([`src/app/kitchen-sink/`](../../examples/angular/src/app/kitchen-sink)) — exercises nearly every feature together with a live event log

## Custom Nodes

Create any Angular component and register it as a node type. The preferred way to read per-node state is `injectNgFlowNode<TData>()`, which returns reactive read-only signals for every property the library tracks (`id`, `data`, `selected`, `dragging`, `zIndex`, `isConnectable`, `position`, `sourcePosition`, `targetPosition`, `dragHandle`, `type`, `collapsed`). Use the `nodrag` CSS class on interactive elements (inputs, dropdowns) to prevent drag interference.

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  HandleComponent,
  Position,
  NgFlowService,
  injectNgFlowNode,
} from '@angflow/angular';

interface FormData { title: string; name: string; type: string }

@Component({
  selector: 'app-form-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" [isConnectable]="node.isConnectable()" />
    <div class="my-node" [class.selected]="node.selected()">
      <h3>{{ node.data()?.title }}</h3>
      <div class="nodrag">
        <input [value]="node.data()?.name" (input)="onNameChange($event)" />
        <select [value]="node.data()?.type" (change)="onTypeChange($event)">
          <option value="string">String</option>
          <option value="number">Number</option>
        </select>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" [isConnectable]="node.isConnectable()" />
  `,
})
export class FormNodeComponent {
  readonly Position = Position;
  readonly node = injectNgFlowNode<FormData>();

  private flowService = inject(NgFlowService);

  onNameChange(event: Event) {
    this.flowService.updateNodeData(this.node.id(), {
      name: (event.target as HTMLInputElement).value,
    });
  }

  onTypeChange(event: Event) {
    this.flowService.updateNodeData(this.node.id(), {
      type: (event.target as HTMLSelectElement).value,
    });
  }
}
```

Register it:

```typescript
nodeTypes = { formNode: FormNodeComponent };
```

```html
<ng-flow [nodes]="nodes" [edges]="edges" [nodeTypes]="nodeTypes" ...>
```

#### Legacy: flat `@Input()`s

The original API — declaring one `@Input()` per tracked property — is still fully supported, so existing custom nodes keep working without changes:

```typescript
export class FormNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<FormData>();
  readonly selected = input(false);
  readonly isConnectable = input(true);
  // ...plus type, dragging, zIndex, positionAbsoluteX/Y,
  //    sourcePosition, targetPosition, dragHandle as needed
}
```

Prefer `injectNgFlowNode()` for new code: one injection call replaces ~13 input declarations, the signals are reactive in the same way, and you only pull the fields you actually use.

## Programmatic API

Inject `NgFlowService` for viewport control, node/edge manipulation, and spatial queries:

```typescript
const flowService = inject(NgFlowService);

flowService.fitView();
flowService.zoomIn();
flowService.addNodes({ id: '4', position: { x: 0, y: 0 }, data: { label: 'New' } });
flowService.updateNodeData('2', { label: 'Updated' });
flowService.deleteElements({ nodes: [{ id: '1' }] });
flowService.screenToFlowPosition({ x: event.clientX, y: event.clientY });
flowService.toObject(); // { nodes, edges, viewport }
```

## Floating Edges

Set `edgeMode="floating"` and edges attach wherever the line to the peer node's
center crosses each node's border — no handle declarations needed:

```html
<ng-flow [nodes]="nodes" [edges]="edges" edgeMode="floating" />
```

Works with nodes that declare zero handles, which makes it ideal for
programmatic / agent-driven graphs. Note: a node with no handles cannot
originate an interactive drag-connection — declared handles still work for
starting connections while rendering stays floating. For per-edge control in
the default mode, set `floating` on individual handles instead:
`<ng-flow-handle type="source" [floating]="true" />`.

## Auto-Layout

`layoutNodes` is a pure dagre wrapper — feed it your nodes and edges, get back
a map of top-left positions:

```ts
import { layoutNodes } from '@angflow/angular/layout'; // needs @dagrejs/dagre installed

const positions = layoutNodes(flow.getNodes(), flow.getEdges(), { direction: 'LR' });
flow.setNodePositions(positions);

// or in one call:
flow.applyLayout(layoutNodes, { direction: 'LR' });
```

Options: `direction` (`'TB' | 'LR' | 'BT' | 'RL'`, default `'TB'`), `nodeSep`
(default 50), `rankSep` (default 80). Node dimensions resolve from `measured` → `width`/`height` →
`initialWidth`/`initialHeight` → 150×40, and edge labels reserve dagre space from
`labelWidth`/`labelHeight` (auto-measured by `applyLayout`) or a default box when an
edge has a non-empty `label`. Any function with the same shape plugs into
`applyLayout` (elk, custom grids, …).

### Controlled mode and `measured`

In controlled mode (`[nodes]` bound, re-emitted from `(nodesChange)`), re-emitting
nodes that don't carry `measured` resets the stored dimensions. `applyLayout` reads
live DOM sizes so layout stays correct regardless — but floating edges and `fitView`
read the stored `measured` directly. If your app hand-handles only some changes (e.g.
keeps `position` authority in a journal), forward dimension changes with
`applyDimensionChanges` so `measured` stays current:

```ts
import { applyDimensionChanges } from '@angflow/angular';

onNodesChange(changes: NodeChange[]) {
  // keep measured flowing back: floating edges, fitView, layout stay correct
  this.nodes.update((ns) => applyDimensionChanges(changes, ns));
  // ...your own position/data handling on top...
}
```

## Animations

Turn on `[animate]` and the flow animates node entries (fade + scale) and
programmatic position changes (smooth tween, edges tracking mid-flight):

```html
<ng-flow [nodes]="nodes" [edges]="edges" [animate]="true" />
<!-- or tune the duration: -->
<ng-flow [animate]="{ duration: 200 }" />
```

Animated paths: `setNodePositions`, `applyLayout`, and the agent bridge's
`layout_nodes` tool. Dragging is never animated, a drag cancels any in-flight
tween on that node, and everything is disabled under `prefers-reduced-motion`.
Per-call override: `flow.setNodePositions(positions, { animate: false })`.

## Group Collapse

Set `collapsed: true` on a group/parent node and angflow folds it: descendants stop
rendering, the box drops to a header strip (`.collapsed` CSS class), and edges crossing
the boundary reroute onto the box (parallels merge). It is nesting-aware — edges reroute
to the outermost collapsed ancestor.

```ts
flow.setNodeCollapsed(groupId, true);   // or toggleNodeCollapsed(groupId)
```

`collapsed` lives on the node, so in controlled mode it round-trips through
`(nodesChange)` like any other field. A merged (deduped) display edge is render-only and
carries its underlying edge ids on `collapsedFrom`; a 1:1 rerouted edge keeps its original
identity. Rerouted edges attach to the box via the normal edge geometry — cleanest under
`edgeMode="floating"`. The collapsed box renders at `--xy-node-collapsed-height` (40px
default); auto-sizing the expanded box to its children is separate.

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

## Architecture

- **Signal-based state** — Angular 17+ signals for fine-grained reactivity (no RxJS in the store)
- **OnPush everywhere** — all components use `ChangeDetectionStrategy.OnPush`
- **`@angflow/system` core** — framework-agnostic drag, pan/zoom, handle, and resize logic
- **Standalone components** — no NgModule, tree-shakeable

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Delete / Backspace | Remove selected elements |
| Ctrl+A / Cmd+A | Select all |
| Escape | Deselect all |
| Arrow keys | Move selected nodes |
| Shift + drag | Box select |
| Ctrl/Cmd + click | Multi-select |

## Coming from React Flow?

The public API is modeled on React Flow deliberately. `<ng-flow>` mirrors `<ReactFlow>`, `<ng-flow-handle>` mirrors `<Handle>`, `inject(NgFlowService)` replaces `useReactFlow()`, and state hooks (`useNodes`, `useEdges`, `useViewport`) become signals on the service (`flowService.nodes`, `.edges`, `.viewport`). Use `applyNodeChanges` / `applyEdgeChanges` with `(nodesChange)` / `(edgesChange)` outputs the same way you'd use `useNodesState` / `useEdgesState`. See the [root README](../../README.md#coming-from-react-flow) for a full mapping table.

## Credits

Built on top of [xyflow](https://github.com/xyflow/xyflow) by [webkid GmbH](https://webkid.io/). The framework-agnostic core (`@angflow/system`) is a republish of `@xyflow/system`; upstream fixes and features flow through.

**Why xyflow as the base?** Pan/zoom, drag, handle routing, and resizer math are hard to get right — xyflow has years of production use shaking those edge cases out, and it deliberately splits that interaction layer from the framework-specific view layer. That split is what makes a faithful Angular port possible. Mirroring the React Flow API on top means the thousands of React Flow examples, Stack Overflow answers, and blog posts also work as documentation for angflow. See the [root README](../../README.md#why-build-on-xyflow) for the full rationale.

If you use angflow in production, please consider [sponsoring xyflow](https://github.com/sponsors/xyflow).

## License

MIT — inherited from xyflow.
