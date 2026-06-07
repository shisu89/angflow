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

Create any Angular component and register it as a node type. Use the `nodrag` CSS class on interactive elements (inputs, dropdowns) to prevent drag interference.

```typescript
@Component({
  selector: 'app-form-node',
  standalone: true,
  imports: [HandleComponent],
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="my-node">
      <h3>{{ data()?.title }}</h3>
      <div class="nodrag">
        <input [value]="data()?.name" (input)="onNameChange($event)" />
        <select [value]="data()?.type" (change)="onTypeChange($event)">
          <option value="string">String</option>
          <option value="number">Number</option>
        </select>
      </div>
    </div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
})
export class FormNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  // ... other standard inputs: type, selected, dragging, zIndex, etc.

  private flowService = inject(NgFlowService);

  onNameChange(event: Event) {
    this.flowService.updateNodeData(this.id(), { name: (event.target as HTMLInputElement).value });
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
(default 50), `rankSep` (default 80). Node dimensions resolve from
`measured` → `width`/`height` → `initialWidth`/`initialHeight` → 150×40. Any
function with the same shape plugs
into `applyLayout` (elk, custom grids, …).

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
