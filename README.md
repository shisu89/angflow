# xyflow + Angular

This is a fork of [xyflow](https://github.com/xyflow/xyflow) that adds an **Angular port** of React Flow. It builds on `@angflow/system` (a republish of `@xyflow/system`), the same framework-agnostic core that powers React Flow and Svelte Flow.

Published on npm as [`@angflow/angular`](https://www.npmjs.com/package/@angflow/angular) and [`@angflow/system`](https://www.npmjs.com/package/@angflow/system). The `react/` and `svelte/` packages in this repo are kept intact to make it easier to pull upstream updates from xyflow and are **not** republished under the `@angflow` scope — consume those from `@xyflow/react` / `@xyflow/svelte` as usual.

---

## Packages

| Package | Path | npm | Description |
|---------|------|-----|-------------|
| **Angular Flow** `@angflow/angular` | [packages/angular](./packages/angular) | [`@angflow/angular`](https://www.npmjs.com/package/@angflow/angular) | Angular 17+ signals-based library for node-based UIs |
| Shared core `@angflow/system` | [packages/system](./packages/system) | [`@angflow/system`](https://www.npmjs.com/package/@angflow/system) | Framework-agnostic drag, pan/zoom, handles, resize (republish of `@xyflow/system`) |
| React Flow 12 `@xyflow/react` | [packages/react](./packages/react) | — | Original React implementation (kept for upstream merges, not republished) |
| Svelte Flow `@xyflow/svelte` | [packages/svelte](./packages/svelte) | — | Svelte implementation (kept for upstream merges, not republished) |

## Angular Flow

The Angular port provides full feature parity with React Flow:

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

See the [Angular Flow README](./packages/angular/README.md) for API documentation and usage examples.

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

## Getting Started

<details>
  <summary><strong>Angular Flow</strong> basic usage</summary>

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
</details>

<details>
  <summary><strong>React Flow</strong> basic usage</summary>

  ### Installation
  
  ```sh
npm install @xyflow/react
  ```

  ### Basic usage
  ```jsx
import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}

export default Flow;
```
</details>

<details>
  <summary><strong>Svelte Flow</strong> basic usage</summary>

  ### Installation
  
  ```sh
npm install @xyflow/svelte
  ```

  ### Basic usage
  ```svelte
<script lang="ts">
  import { writable } from 'svelte/store';
  import {
    SvelteFlow,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
  } from '@xyflow/svelte';

  import '@xyflow/svelte/dist/style.css'
  
  const nodes = writable([
    {
      id: '1',
      type: 'input',
      data: { label: 'Input Node' },
      position: { x: 0, y: 0 }
    },
    {
      id: '2',
      type: 'custom',
      data: { label: 'Node' },
      position: { x: 0, y: 150 }
    }
  ]);

  const edges = writable([
    {
      id: '1-2',
      type: 'default',
      source: '1',
      target: '2',
      label: 'Edge Text'
    }
  ]);
</script>

<SvelteFlow
  {nodes}
  {edges}
  fitView
  on:nodeclick={(event) => console.log('on node click', event)}
>
  <Controls />
  <Background variant={BackgroundVariant.Dots} />
  <MiniMap />
</SvelteFlow>
```
</details>

## Syncing with upstream

This repo tracks the original xyflow as `upstream`:

```bash
git fetch upstream
git merge upstream/main
```

The Angular port lives in `packages/angular/` and `examples/angular/`, which don't exist upstream, so merges are typically conflict-free. Updates to `@xyflow/system` from upstream are picked up automatically.

## Credits

Originally built by [xyflow / webkid GmbH](https://xyflow.com). Angular port built on top of `@xyflow/system`.

## License

[MIT](./LICENSE)
