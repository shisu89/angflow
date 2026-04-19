# angflow

An **Angular library for node-based UIs** — interactive flow charts, diagram editors, workflow canvases, and anything else that needs draggable nodes connected by edges.

Published on npm as [`@angflow/angular`](https://www.npmjs.com/package/@angflow/angular) and [`@angflow/system`](https://www.npmjs.com/package/@angflow/system).

---

## Packages

| Package | Path | npm | Description |
|---------|------|-----|-------------|
| **Angular Flow** `@angflow/angular` | [packages/angular](./packages/angular) | [`@angflow/angular`](https://www.npmjs.com/package/@angflow/angular) | Angular 17+ signals-based library for node-based UIs |
| Shared core `@angflow/system` | [packages/system](./packages/system) | [`@angflow/system`](https://www.npmjs.com/package/@angflow/system) | Framework-agnostic drag, pan/zoom, handles, resize |

## Features

- Drag & drop nodes with snap-to-grid
- Multiple edge types (bezier, straight, step, smooth-step)
- Custom node components (forms, charts, any Angular component)
- Custom edge components
- Connections (drag or click-to-connect)
- Selection (click, box select with partial mode, multi-select)
- Keyboard shortcuts (Delete, Ctrl+A, Escape, arrow keys)
- Pan & zoom (scroll, pinch, double-click)
- Plugins: minimap, background, controls, node toolbar, edge toolbar, node resizer
- Signal-based state management (Angular 17+ signals, no RxJS in the store)
- OnPush change detection throughout
- Dark mode support

See the [Angular Flow README](./packages/angular/README.md) for detailed API documentation and usage examples.

## Getting Started

### Installation

```sh
npm install @angflow/angular @angflow/system
```

### Basic usage

```typescript
import { Component } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  applyNodeChanges,
  applyEdgeChanges,
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

A demo app lives in this repo at [`examples/angular/`](./examples/angular). It's the best place to see Angular Flow in action and browse real, working source code for every feature.

### Running it

```bash
pnpm install       # from the repo root (first time only)
cd examples/angular
npm run dev        # or: npm start / npx ng serve
```

> **Note:** Use `pnpm install` (not `npm install`), and run it from the repo root — not from `examples/angular/` or any other subdirectory. npm doesn't understand the `workspace:*` protocol, and running an install inside a subdirectory bypasses the workspace, so either will fail with `EUNSUPPORTEDPROTOCOL`. Once installed, `npm run` and `pnpm run` are interchangeable for the scripts.

Then open http://localhost:4200. The app redirects to `/gallery/overview` by default.

### What's inside

The app is organized into three sections, reachable from the sidebar:

**Gallery** — focused examples, one feature per page. Each lives in its own directory under [`examples/angular/src/app/examples/`](./examples/angular/src/app/examples):

| Route | Source | Demonstrates |
|-------|--------|--------------|
| `/gallery/overview` | [overview/](./examples/angular/src/app/examples/overview) | Basic nodes, edges, plugins, `applyNodeChanges` / `applyEdgeChanges` |
| `/gallery/custom-node` | [custom-node/](./examples/angular/src/app/examples/custom-node) | Registering a custom Angular component as a node type |
| `/gallery/custom-edge` | [custom-edge/](./examples/angular/src/app/examples/custom-edge) | Custom edge components with path generators |
| `/gallery/edge-types` | [edge-types/](./examples/angular/src/app/examples/edge-types) | Built-in bezier, straight, step, and smooth-step edges |
| `/gallery/floating-edges` | [floating-edges/](./examples/angular/src/app/examples/floating-edges) | Edges that attach to the closest point on a node |
| `/gallery/connection-validation` | [connection-validation/](./examples/angular/src/app/examples/connection-validation) | `isValidConnection` gating drag-to-connect |
| `/gallery/drag-from-sidebar` | [drag-from-sidebar/](./examples/angular/src/app/examples/drag-from-sidebar) | HTML5 drag-and-drop from a palette, `screenToFlowPosition` |
| `/gallery/sub-flows` | [sub-flows/](./examples/angular/src/app/examples/sub-flows) | Parent/child nodes with `extent: 'parent'` |
| `/gallery/node-resizer` | [node-resizer/](./examples/angular/src/app/examples/node-resizer) | `NodeResizerComponent` with min/max constraints |
| `/gallery/node-toolbar` | [node-toolbar/](./examples/angular/src/app/examples/node-toolbar) | Contextual toolbars attached to nodes |
| `/gallery/edge-toolbar` | [edge-toolbar/](./examples/angular/src/app/examples/edge-toolbar) | Contextual toolbars attached to edges |
| `/gallery/minimap-custom` | [minimap-custom/](./examples/angular/src/app/examples/minimap-custom) | Styling the minimap and per-node colors |
| `/gallery/backgrounds-variants` | [backgrounds-variants/](./examples/angular/src/app/examples/backgrounds-variants) | Dots, lines, and cross background patterns |
| `/gallery/save-restore` | [save-restore/](./examples/angular/src/app/examples/save-restore) | `toObject()` / restore via `NgFlowService` |

**Showcase** — `/showcase` ([`src/app/showcase/`](./examples/angular/src/app/showcase)) — a richer end-to-end demo featuring custom color nodes, a form-input node, a result node, a node palette, an inspector panel, and a simulation service. Useful as a template for a real app.

**Kitchen Sink** — `/kitchen-sink` ([`src/app/kitchen-sink/`](./examples/angular/src/app/kitchen-sink)) — exercises nearly every feature together: seeded graphs, layout switching, and a live event log. Handy when verifying a change didn't regress anything.

### How it consumes the library

The example app depends on `@angflow/angular` and `@angflow/system` as pnpm `workspace:*` dependencies (see [`examples/angular/package.json`](./examples/angular/package.json)), so edits in `packages/angular/` and `packages/system/` are picked up immediately — no build, pack, or reinstall step needed. Just restart the dev server if the change doesn't hot-reload.

## Coming from React Flow?

If you already know React Flow, you know angflow. The public API is modeled on it deliberately, so most of your experience carries over:

| React Flow | Angular Flow | Notes |
|------------|--------------|-------|
| `<ReactFlow>` | `<ng-flow>` | Same props, same events |
| `<Handle>` | `<ng-flow-handle>` | Same `type` / `position` |
| `<Background>` / `<Controls>` / `<MiniMap>` | `<ng-flow-background>` / `<ng-flow-controls>` / `<ng-flow-minimap>` | Drop-in |
| `<NodeToolbar>` / `<NodeResizer>` / `<EdgeToolbar>` | `<ng-flow-node-toolbar>` / `<ng-flow-node-resizer>` / `<ng-flow-edge-toolbar>` | Drop-in |
| `useReactFlow()` | `inject(NgFlowService)` | `fitView()`, `zoomIn/Out()`, `setViewport()`, `addNodes/Edges()`, `screenToFlowPosition()`, `toObject()`, etc. |
| `useNodes()` / `useEdges()` / `useViewport()` | `flowService.nodes` / `.edges` / `.viewport` | Signals instead of hooks |
| `useNodesState()` / `useEdgesState()` | `applyNodeChanges()` / `applyEdgeChanges()` | Same change pipeline; wire via `(nodesChange)` / `(edgesChange)` |
| `useNodeConnections()` / `useHandleConnections()` | `flowService.selectNodeConnections()` / `.selectHandleConnections()` | Returns a `Signal<…>` |
| `onConnect`, `onNodeClick`, … (props) | `(connect)`, `(nodeClick)`, … (outputs) | Same payloads |
| `nodeTypes={...}` | `[nodeTypes]="{ custom: MyComponent }"` | Angular standalone components |

Use `applyNodeChanges` / `applyEdgeChanges` to mutate the arrays in your component in response to `(nodesChange)` / `(edgesChange)` — the same pattern as React Flow's `useNodesState`, without the hook.

## License

[MIT](./LICENSE)
