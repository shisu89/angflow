# xyflow + Angular

This is a fork of [xyflow](https://github.com/xyflow/xyflow) that adds an **Angular port** of React Flow. It builds on `@xyflow/system`, the same framework-agnostic core that powers React Flow and Svelte Flow.

---

## Packages

| Package | Path | Description |
|---------|------|-------------|
| **Angular Flow** `@xyflow/angular` | [packages/angular](./packages/angular) | Angular 17+ library for node-based UIs |
| React Flow 12 `@xyflow/react` | [packages/react](./packages/react) | Original React implementation |
| Svelte Flow `@xyflow/svelte` | [packages/svelte](./packages/svelte) | Svelte implementation |
| Shared core `@xyflow/system` | [packages/system](./packages/system) | Framework-agnostic drag, pan/zoom, handles, resize |

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

A standalone demo app lives at [`example-app/`](../example-app/) (sibling to this directory). It demonstrates:

- Custom form nodes with text inputs, number inputs, dropdowns, checkboxes, and textareas
- Color-coded nodes with styled headers
- Adding/removing nodes, edge connections
- All plugin components (background, controls, minimap)

To run it:

```bash
cd example-app
npm install
npx ng serve
```

## Getting Started

<details>
  <summary><strong>Angular Flow</strong> basic usage</summary>

  ### Installation

  ```sh
  npm install @xyflow/angular @xyflow/system
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
  } from '@xyflow/angular';
  import type { Node, Edge, Connection } from '@xyflow/angular';
  import { addEdge } from '@xyflow/system';

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

The Angular port lives in `packages/angular/` and `../example-app/`, which don't exist upstream, so merges are typically conflict-free. Updates to `@xyflow/system` from upstream are picked up automatically.

## Credits

Originally built by [xyflow / webkid GmbH](https://xyflow.com). Angular port built on top of `@xyflow/system`.

## License

[MIT](./LICENSE)
