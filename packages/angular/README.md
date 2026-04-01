# @xyflow/angular

An Angular library for building node-based UIs, interactive flow charts, and diagrams. Built on top of `@xyflow/system` — the same framework-agnostic core that powers [React Flow](https://reactflow.dev/) and [Svelte Flow](https://svelteflow.dev/).

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
npm install @xyflow/angular @xyflow/system
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

## Architecture

- **Signal-based state** — Angular 17+ signals for fine-grained reactivity (no RxJS in the store)
- **OnPush everywhere** — all components use `ChangeDetectionStrategy.OnPush`
- **@xyflow/system core** — shares the same drag, pan/zoom, handle, and resize logic as React Flow and Svelte Flow
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

## Credits

Built on top of [xyflow](https://github.com/xyflow/xyflow) by [webkid GmbH](https://webkid.io/). The Angular port uses `@xyflow/system` for framework-agnostic core logic.

## License

MIT
