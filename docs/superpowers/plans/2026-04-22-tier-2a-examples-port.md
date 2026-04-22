# Tier 2a Examples Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port 8 Tier 2 (first half) React examples to Angular: `controlled-viewport`, `drag-handle`, `interactive-minimap`, `multi-flows`, `update-node`, `node-type-change`, `default-overwrites`, `set-nodes-batching`.

**Architecture:** Same as Tier 1 — each ported example is a standalone Angular component at `examples/angular/src/app/examples/<kebab>/<kebab>.component.ts`, wrapped in `ExampleCardComponent`, and registered in `HARNESS_ROUTES`. Zoneless, OnPush, signals throughout.

**Tech Stack:** Angular 19 (standalone, signals, zoneless), `@angflow/angular`, `@angflow/system`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-examples-parity-port-design.md`
**Preceding plan:** `docs/superpowers/plans/2026-04-20-tier-1-examples-port.md` (T1, merged)

---

## Conventions learned from Tier 1 (apply to every task)

1. Import `addEdge` and `reconnectEdge` from **`@angflow/system`** (not `@angflow/angular`).
2. Type change handlers: `onNodesChange(changes: NodeChange[])`, `onEdgesChange(changes: EdgeChange[])` — NOT `any[]`. Both `NodeChange` and `EdgeChange` are exported from `@angflow/angular`.
3. No template `&&` side-effects. If a handler should only fire conditionally, write a guarded wrapper method.
4. `ChangeDetectionStrategy.OnPush` + standalone on every component.
5. Description panel via `<app-example-card title="..." description="...">` (import from `@examples-shared/example-card.component`).
6. `:host { display: flex; flex: 1; min-width: 0; min-height: 0; }` on the example component.
7. No `NgZone`. Native event handlers drive signal writes only.

---

## File Structure

New files (8):

- `examples/angular/src/app/examples/controlled-viewport/controlled-viewport.component.ts`
- `examples/angular/src/app/examples/drag-handle/drag-handle.component.ts`
- `examples/angular/src/app/examples/interactive-minimap/interactive-minimap.component.ts`
- `examples/angular/src/app/examples/multi-flows/multi-flows.component.ts`
- `examples/angular/src/app/examples/update-node/update-node.component.ts`
- `examples/angular/src/app/examples/node-type-change/node-type-change.component.ts`
- `examples/angular/src/app/examples/default-overwrites/default-overwrites.component.ts`
- `examples/angular/src/app/examples/set-nodes-batching/set-nodes-batching.component.ts`

Modified files (2):

- `examples/angular/src/app/app.routes.ts` — 8 new imports + 8 new `HARNESS_ROUTES` entries.
- `docs/examples-parity.md` — flip 8 rows from ➖ to ✅ in the wrap-up task.

## Verification commands (used throughout)

From `packages/angular/`:
```bash
npx tsc --noEmit
```
From `examples/angular/`:
```bash
npx tsc --noEmit -p tsconfig.json
```

Both must be clean after every task.

---

## Task 1: `controlled-viewport` example

Demonstrates two-way viewport binding: `[viewport]` input + `(viewportChange)` output, plus programmatic viewport manipulation via `NgFlowService.fitView()` / `setViewport()`.

**Files:**
- Create: `examples/angular/src/app/examples/controlled-viewport/controlled-viewport.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**API note:** `NgFlowComponent` exposes `viewport` as a two-way `model` (alias `viewport`). Use `[(viewport)]` or separate `[viewport]` + `(viewportChange)`. `NgFlowService.setViewport(v)` and `fitView()` both exist.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/ControlledViewport/index.tsx` — note two viewport states (`viewport`, `viewport2`), a toggle button, update/fitView buttons.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, Viewport, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-controlled-viewport-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Controlled viewport"
      description="Two-way viewport binding: the flow reports pan/zoom back via (viewportChange) and accepts a new viewport via [viewport]. Toggle between two stored viewports, nudge one by 10px, or fitView programmatically."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [viewport]="activeViewport()"
        (viewportChange)="onViewportChange($event)"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-left">
          <div class="cv-panel">
            <button (click)="nudge()">update viewport</button>
            <button (click)="fit()">fitView</button>
            <button (click)="toggle()">toggle viewport ({{ currentIndex() === 0 ? 'A' : 'B' }})</button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cv-panel {
      display: inline-flex; gap: 6px;
      padding: 8px 10px; background: #ffffffcc; backdrop-filter: blur(4px);
      border-radius: 6px;
    }
    .cv-panel button {
      font-size: 12px; padding: 4px 8px;
      border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;
    }
  `],
})
export class ControlledViewportExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly viewportA = signal<Viewport>({ x: 0, y: 0, zoom: 1 });
  readonly viewportB = signal<Viewport>({ x: 100, y: 100, zoom: 1.5 });
  readonly currentIndex = signal(0);

  readonly activeViewport = () => this.currentIndex() === 0 ? this.viewportA() : this.viewportB();

  nodes: Node[] = [
    { id: '1a', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 }, className: 'light', ariaLabel: 'Input Node 1' },
    { id: '2a',                data: { label: 'Node 2' }, position: { x: 100, y: 100 }, className: 'light', ariaLabel: 'Default Node 2' },
    { id: '3a',                data: { label: 'Node 3' }, position: { x: 400, y: 100 }, className: 'light' },
    { id: '4a',                data: { label: 'Node 4' }, position: { x: 400, y: 200 }, className: 'light' },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1a', target: '2a' },
    { id: 'e1-3', source: '1a', target: '3a' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onViewportChange(vp: Viewport): void {
    if (this.currentIndex() === 0) this.viewportA.set(vp);
    else this.viewportB.set(vp);
  }

  nudge(): void {
    const target = this.currentIndex() === 0 ? this.viewportA : this.viewportB;
    target.update((v) => ({ ...v, y: v.y + 10 }));
  }

  fit(): void { this.flow.fitView(); }

  toggle(): void { this.currentIndex.set(this.currentIndex() === 0 ? 1 : 0); }
}
```

- [ ] **Step 3: Register in `app.routes.ts`**

Import:
```typescript
import { ControlledViewportExampleComponent } from './examples/controlled-viewport/controlled-viewport.component';
```
Entry (before Kitchen sink):
```typescript
{ name: 'Controlled viewport',   path: 'controlled-viewport',   component: ControlledViewportExampleComponent },
```

- [ ] **Step 4: Type-check**

`cd packages/angular && npx tsc --noEmit` and `cd examples/angular && npx tsc --noEmit -p tsconfig.json` — both clean. If one-way `[viewport]` errors (because it's a `model`), switch to `[(viewport)]="..."` syntax or use `(viewportChange)` alone.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/controlled-viewport examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add controlled-viewport example"
```

---

## Task 2: `drag-handle` example

Demonstrates `dragHandle` property on a Node — restricts where on the node drag can start, via a CSS selector.

**Files:**
- Create: `examples/angular/src/app/examples/drag-handle/drag-handle.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/DragHandle/` (two files: `index.tsx`, `DragHandleNode.tsx`). Node has `dragHandle: '.custom-drag-handle'` — only elements matching that selector initiate drag.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-drag-handle-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="dh-body">
      <span>Only draggable here →</span>
      <span class="custom-drag-handle" aria-label="drag handle"></span>
    </div>
    <ng-flow-handle type="source" [position]="Position.Right" />
  `,
  styles: [`
    .dh-body {
      display: flex; align-items: center; gap: 8px;
      padding: 20px 40px;
      border: 1px solid #ddd; background: #fff;
      font-size: 12px; color: #334155;
    }
    .custom-drag-handle {
      display: inline-block; width: 24px; height: 24px;
      background: teal; border-radius: 50%;
      cursor: grab;
    }
    .custom-drag-handle:active { cursor: grabbing; }
  `],
})
export class DragHandleNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

@Component({
  selector: 'app-drag-handle-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Drag handle"
      description="Restrict where a node's drag starts using the dragHandle CSS selector. Clicking the body won't drag; only pressing the teal circle does."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [nodeDragThreshold]="0"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeClick)="onNodeClick($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class DragHandleExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { dragHandleNode: DragHandleNodeComponent };

  nodes: Node[] = [
    { id: '2', type: 'dragHandleNode', dragHandle: '.custom-drag-handle', position: { x: 200, y: 200 }, data: {} },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  onNodeClick(event: { event: MouseEvent; node: Node }): void { console.log('click', event.node); }
}
```

- [ ] **Step 3: Register in `app.routes.ts`**

```typescript
import { DragHandleExampleComponent } from './examples/drag-handle/drag-handle.component';
```
```typescript
{ name: 'Drag handle',           path: 'drag-handle',           component: DragHandleExampleComponent },
```

- [ ] **Step 4: Type-check** — both tsc passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/drag-handle examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add drag-handle example"
```

---

## Task 3: `interactive-minimap` example

Demonstrates MiniMap's `pannable`, `zoomable`, `inversePan` inputs and its click/node-click outputs, plus viewport manipulation via `NgFlowService.toObject()` / `setViewport()`.

**Files:**
- Create: `examples/angular/src/app/examples/interactive-minimap/interactive-minimap.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**API note:** `MiniMapComponent` exposes `pannable`, `zoomable`, `inversePan`. Outputs TBD — if `(minimapClick)` / `(minimapNodeClick)` don't exist, drop those buttons and note the gap.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/InteractiveMinimap/index.tsx`.

- [ ] **Step 2: Verify minimap outputs**

```bash
grep -n "output<" packages/angular/src/lib/components/minimap/minimap.component.ts
```

If `click` / `nodeClick` outputs exist on the minimap, use them; otherwise drop those bindings from the template.

- [ ] **Step 3: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const INITIAL_NODES: Node[] = Array.from({ length: 12 }, (_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    id: `${i + 1}`,
    data: { label: `Node ${i + 1}` },
    position: { x: col === 0 ? 0 : col === 1 ? 1000 : col === 2 ? 0 : 1000, y: row === 0 ? 0 : 1000 },
  };
});

@Component({
  selector: 'app-interactive-minimap-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Interactive minimap"
      description="Pan and zoom via the minimap, invert pan direction, and programmatically reset the viewport or toggle node classnames."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        [selectNodesOnDrag]="false"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-minimap
          [pannable]="true"
          [zoomable]="true"
          [inversePan]="invertPan()"
        />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="im-panel">
            <button (click)="resetViewport()">reset transform</button>
            <button (click)="scatter()">scatter positions</button>
            <button (click)="toggleTheme()">toggle classnames</button>
            <button (click)="logToObject()">toObject</button>
            <button (click)="toggleInvert()">
              {{ invertPan() ? 'un-invert pan' : 'invert pan' }}
            </button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .im-panel { display: flex; flex-direction: column; gap: 4px; }
    .im-panel button {
      font-size: 12px; padding: 4px 8px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class InteractiveMinimapExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly invertPan = signal(false);

  nodes: Node[] = [...INITIAL_NODES];
  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  resetViewport(): void { this.flow.setViewport({ x: 0, y: 0, zoom: 1 }); }

  scatter(): void {
    this.nodes = this.nodes.map((n) => ({
      ...n,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    }));
  }

  toggleTheme(): void {
    this.nodes = this.nodes.map((n) => ({
      ...n,
      className: (n as any).className === 'light' ? 'dark' : 'light',
    }));
  }

  toggleInvert(): void { this.invertPan.set(!this.invertPan()); }

  logToObject(): void { console.log(this.flow.toObject()); }
}
```

- [ ] **Step 4: Register in `app.routes.ts`**

```typescript
import { InteractiveMinimapExampleComponent } from './examples/interactive-minimap/interactive-minimap.component';
```
```typescript
{ name: 'Interactive minimap',   path: 'interactive-minimap',   component: InteractiveMinimapExampleComponent },
```

- [ ] **Step 5: Type-check** — both passes.

- [ ] **Step 6: Commit**

```
git add examples/angular/src/app/examples/interactive-minimap examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add interactive-minimap example"
```

---

## Task 4: `multi-flows` example

Demonstrates two independent flow instances side by side. Each has its own state.

**Files:**
- Create: `examples/angular/src/app/examples/multi-flows/multi-flows.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**Note:** Each `<ng-flow>` in Angular gets its own `FlowStore` via the component's injector (standalone component DI). No `Provider` wrapper needed.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/MultiFlows/index.tsx`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  MiniMapComponent,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const INITIAL_NODES = (): Node[] => [
  { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 }, className: 'light' },
  { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 }, className: 'light' },
  { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 }, className: 'light' },
  { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 }, className: 'light' },
];

const INITIAL_EDGES = (): Edge[] => [
  { id: 'e1-2', source: '1', target: '2', animated: true, markerEnd: { type: MarkerType.Arrow } },
  { id: 'e1-3', source: '1', target: '3' },
];

@Component({
  selector: 'app-single-mini-flow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, MiniMapComponent],
  template: `
    <ng-flow
      [nodes]="nodes"
      [edges]="edges"
      (nodesChange)="onNodesChange($event)"
      (edgesChange)="onEdgesChange($event)"
      (connect)="onConnect($event)"
    >
      <ng-flow-background />
      <ng-flow-minimap />
    </ng-flow>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class SingleMiniFlowComponent {
  nodes: Node[] = INITIAL_NODES();
  edges: Edge[] = INITIAL_EDGES();
  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}

@Component({
  selector: 'app-multi-flows-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SingleMiniFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Multi flows"
      description="Two independent ng-flow instances on the same page. Each has its own FlowStore (provided by the component's injector), so dragging nodes in one flow does not affect the other."
    >
      <div class="mf-grid">
        <app-single-mini-flow />
        <app-single-mini-flow />
      </div>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .mf-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      height: 100%; padding: 8px;
    }
    .mf-grid > * {
      border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;
    }
  `],
})
export class MultiFlowsExampleComponent {}
```

**Verify-on-port:** Confirm that `<ng-flow>` scopes `FlowStore` to its component injector (not a module-level singleton). If the second `<ng-flow>` doesn't render or they share state, report BLOCKED — the library would need to provide `FlowStore` on the `NgFlowComponent` providers array, which is outside this example's scope.

- [ ] **Step 3: Register in `app.routes.ts`**

```typescript
import { MultiFlowsExampleComponent } from './examples/multi-flows/multi-flows.component';
```
```typescript
{ name: 'Multi flows',           path: 'multi-flows',           component: MultiFlowsExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/multi-flows examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add multi-flows example"
```

---

## Task 5: `update-node` example

Demonstrates programmatic node updates via `NgFlowService.updateNode()` — change label, background, hidden, position.

**Files:**
- Create: `examples/angular/src/app/examples/update-node/update-node.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/UpdateNode/index.tsx`. The React version uses `useEffect` on state changes to call `setNodes(...)`. The Angular version uses `effect()` on signals, calling `updateNode()`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, signal, inject, effect } from '@angular/core';
import {
  NgFlowComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-update-node-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Update node"
      description="Edit a node's label, background, and hidden state through form controls. Demonstrates NgFlowService.updateNode() — mutations run through the store and keep reactivity intact."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <div class="un-panel">
          <label class="row"><span>label</span>
            <input [value]="nodeName()" (input)="setLabel($event)" />
          </label>
          <label class="row"><span>background</span>
            <input [value]="nodeBg()" (input)="setBg($event)" />
          </label>
          <label class="row"><span>hidden</span>
            <input type="checkbox" [checked]="nodeHidden()" (change)="setHidden($event)" />
          </label>
          <button (click)="bumpPosition()">update position</button>
        </div>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .un-panel {
      position: absolute; top: 10px; left: 10px; z-index: 4;
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 12px; background: #ffffffcc; backdrop-filter: blur(4px);
      border-radius: 6px; font-size: 12px; color: #334155;
    }
    .un-panel .row { display: flex; align-items: center; gap: 8px; }
    .un-panel .row span { min-width: 80px; }
    .un-panel input[type="text"],
    .un-panel input:not([type]) { padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; }
    .un-panel button { padding: 4px 8px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer; }
  `],
})
export class UpdateNodeExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly nodeName = signal('Node 1');
  readonly nodeBg = signal('#eee');
  readonly nodeHidden = signal(false);

  nodes: Node[] = [
    { id: '1', data: { label: '-' }, position: { x: 100, y: 100 } },
    { id: '2', data: { label: 'Node 2' }, position: { x: 100, y: 200 } },
  ];

  edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

  constructor() {
    effect(() => {
      const label = this.nodeName();
      this.flow.updateNode('1', (n) => ({ data: { ...n.data, label } }));
    });
    effect(() => {
      const bg = this.nodeBg();
      this.flow.updateNode('1', (n) => ({ style: { ...n.style, backgroundColor: bg } }));
    });
    effect(() => {
      const hidden = this.nodeHidden();
      this.flow.updateNode('1', () => ({ hidden }));
    });
  }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setLabel(event: Event): void { this.nodeName.set((event.target as HTMLInputElement).value); }
  setBg(event: Event): void { this.nodeBg.set((event.target as HTMLInputElement).value); }
  setHidden(event: Event): void { this.nodeHidden.set((event.target as HTMLInputElement).checked); }

  bumpPosition(): void {
    this.flow.updateNode('1', (n) => ({ position: { x: n.position.x + 10, y: n.position.y } }));
  }
}
```

- [ ] **Step 3: Register in `app.routes.ts`**

```typescript
import { UpdateNodeExampleComponent } from './examples/update-node/update-node.component';
```
```typescript
{ name: 'Update node',           path: 'update-node',           component: UpdateNodeExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/update-node examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add update-node example"
```

---

## Task 6: `node-type-change` example

Demonstrates swapping a node's `type` between `'default'` and `'output'` at runtime via a button.

**Files:**
- Create: `examples/angular/src/app/examples/node-type-change/node-type-change.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/NodeTypeChange/index.tsx`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-node-type-change-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Node type change"
      description="Programmatically swap a node's type at runtime. Click 'change type' to toggle the non-input node between 'default' and 'output'."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <button class="ntc-button" (click)="changeType()">change type</button>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .ntc-button {
      position: absolute; right: 10px; top: 10px; z-index: 4;
      padding: 6px 12px; font-size: 12px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class NodeTypeChangeExampleComponent {
  nodes: Node[] = [
    { id: '1', type: 'input',  sourcePosition: Position.Right, data: { label: 'Input' }, position: { x:   0, y:  80 } },
    { id: '2', type: 'output', sourcePosition: Position.Right, targetPosition: Position.Left, data: { label: 'A Node' }, position: { x: 250, y:   0 } },
  ];

  edges: Edge[] = [{ id: 'e1-2', source: '1', type: 'smoothstep', target: '2', animated: true }];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  changeType(): void {
    this.nodes = this.nodes.map((n) => {
      if (n.type === 'input') return n;
      return { ...n, type: n.type === 'default' ? 'output' : 'default' };
    });
  }
}
```

- [ ] **Step 3: Register in `app.routes.ts`**

```typescript
import { NodeTypeChangeExampleComponent } from './examples/node-type-change/node-type-change.component';
```
```typescript
{ name: 'Node type change',      path: 'node-type-change',      component: NodeTypeChangeExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/node-type-change examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add node-type-change example"
```

---

## Task 7: `default-overwrites` example

Demonstrates overriding the default node AND default edge type in a single combined example. Both React examples (`DefaultNodeOverwrite` and `DefaultEdgeOverwrite`) are merged here — a node with `type: 'unregistered'` falls back to the overridden default node; an edge with `type: 'unregistered'` falls back to the overridden default edge.

**Files:**
- Create: `examples/angular/src/app/examples/default-overwrites/default-overwrites.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**Verify-on-port:** Confirm that registering `nodeTypes: { default: CustomNodeComponent }` actually overrides the built-in default. Grep `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts` to confirm the lookup uses the `nodeTypes` input over built-ins. If not, this example may demonstrate a library gap.

- [ ] **Step 1: Read the React sources** at `examples/react/src/examples/DefaultNodeOverwrite/index.tsx` and `DefaultEdgeOverwrite/index.tsx`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  HandleComponent,
  BaseEdgeComponent,
  Position,
  getBezierPath,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-custom-default-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="target" [position]="Position.Top" />
    <div class="cdn">Custom default node</div>
    <ng-flow-handle type="source" [position]="Position.Bottom" />
  `,
  styles: [`
    .cdn {
      padding: 10px 14px; background: #fef3c7; border: 1px solid #f59e0b;
      border-radius: 4px; font-size: 13px; color: #78350f;
    }
  `],
})
export class CustomDefaultNodeComponent {
  readonly Position = Position;
  readonly id = input.required<string>();
  readonly data = input<any>();
  readonly selected = input(false);
  readonly type = input<string>();
  readonly dragging = input(false);
  readonly zIndex = input(0);
  readonly isConnectable = input(true);
  readonly positionAbsoluteX = input(0);
  readonly positionAbsoluteY = input(0);
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly dragHandle = input<string>();
}

@Component({
  selector: 'app-custom-default-edge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseEdgeComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-base-edge
      [path]="path()"
      [style.stroke]="'red'"
      [style.strokeWidth]="3"
      [style.strokeDasharray]="'5,5'"
    />
  `,
})
export class CustomDefaultEdgeComponent {
  readonly id = input.required<string>();
  readonly sourceX = input.required<number>();
  readonly sourceY = input.required<number>();
  readonly targetX = input.required<number>();
  readonly targetY = input.required<number>();
  readonly sourcePosition = input<any>();
  readonly targetPosition = input<any>();
  readonly source = input<string>();
  readonly target = input<string>();
  readonly selected = input(false);

  path = () => {
    const [d] = getBezierPath({
      sourceX: this.sourceX(),
      sourceY: this.sourceY(),
      targetX: this.targetX(),
      targetY: this.targetY(),
    });
    return d;
  };
}

@Component({
  selector: 'app-default-overwrites-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Default overwrites"
      description="Override the built-in default node and default edge types. Nodes and edges whose type isn't registered fall back to these custom versions — you can ship your own defaults for every flow in your app."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [edgeTypes]="edgeTypes"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="lines" />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class DefaultOverwritesExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { default: CustomDefaultNodeComponent };
  edgeTypes: Record<string, Type<unknown>> = { default: CustomDefaultEdgeComponent };

  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2', data: { label: 'Node 2' }, type: 'unregistered', position: { x: 100, y: 100 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'unregistered' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
```

**IMPORTANT — adapt to API:** If `BaseEdgeComponent` takes different inputs than `[path]`, or if `getBezierPath` returns tuple vs. array, adjust. See `examples/angular/src/app/examples/custom-edge/custom-edge.component.ts` for the existing library convention. If the library does NOT treat `nodeTypes.default` / `edgeTypes.default` as overrides of the built-ins (verify by checking `node-renderer.component.ts`), report BLOCKED and log the gap in the final parity doc update.

- [ ] **Step 3: Register in `app.routes.ts`**

```typescript
import { DefaultOverwritesExampleComponent } from './examples/default-overwrites/default-overwrites.component';
```
```typescript
{ name: 'Default overwrites',    path: 'default-overwrites',    component: DefaultOverwritesExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/default-overwrites examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add default-overwrites example"
```

---

## Task 8: `set-nodes-batching` example

Demonstrates that multiple rapid calls to `setNodes` / `updateNode` / `updateNodeData` / `updateEdge` are batched into a single render (showing the store's write batching). Combines the `SetNodesBatching` and `MultiSetNodes` React examples into one.

**Files:**
- Create: `examples/angular/src/app/examples/set-nodes-batching/set-nodes-batching.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**API note:** We'll use `NgFlowService.updateNode`, `updateNodeData`, `updateEdge`. For the `setNodes`-style test, Angular-side we mutate the `nodes` array directly (reassign) — equivalent batching occurs through Angular's change detection.

- [ ] **Step 1: Read the React sources** at `examples/react/src/examples/SetNodesBatching/index.tsx` and `MultiSetNodes/index.tsx`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const A: Node = { id: 'a', data: { label: 'A' }, position: { x: 250, y:   5 } };
const B: Node = { id: 'b', data: { label: 'B' }, position: { x: 100, y: 100 } };
const C: Node = { id: 'c', data: { label: 'C' }, position: { x: 400, y: 100 } };

@Component({
  selector: 'app-set-nodes-batching-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Set nodes batching"
      description="Dispatch many rapid node/edge mutations in a single synchronous burst. The store batches them into one render cycle so the flow stays responsive even under heavy programmatic updates."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [minZoom]="0.2"
        [maxZoom]="4"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="snb-panel">
            <button (click)="queueMultipleSetNodes()">queue multiple setNodes</button>
            <button (click)="queueMultipleUpdateNodes()">queue multiple updateNode</button>
            <button (click)="updateNodeDataBurst()">burst updateNodeData</button>
            <button (click)="updateEdgeBurst()">burst updateEdge</button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .snb-panel { display: flex; flex-direction: column; gap: 4px; }
    .snb-panel button {
      font-size: 12px; padding: 4px 8px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class SetNodesBatchingExampleComponent {
  private readonly flow = inject(NgFlowService);

  nodes: Node[] = [];
  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  queueMultipleSetNodes(): void {
    // Simulate the React example's 4 rapid setNodes by reassigning 4 times in a synchronous burst.
    this.nodes = [A];
    this.nodes = [...this.nodes, B];
    this.nodes = [...this.nodes, C];
    this.nodes = this.nodes.map((n) => n.id === 'a' ? { ...n, position: { x: n.position.x + 20, y: n.position.y + 20 } } : n);
    // Edges recreated (connect to form a path)
    this.edges = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-c', source: 'b', target: 'c' },
    ];
  }

  queueMultipleUpdateNodes(): void {
    this.queueMultipleSetNodes();
    this.flow.updateNode('a', (n) => ({ position: { x: n.position.x + 20, y: n.position.y + 20 } }));
    this.flow.updateNode('b', (n) => ({ position: { x: n.position.x + 20, y: n.position.y + 20 } }));
    this.flow.updateNode('c', (n) => ({ position: { x: n.position.x + 20, y: n.position.y + 20 } }));
    this.flow.updateNode('a', (n) => ({ data: { ...n.data, label: `A ${Date.now()}` } }));
    this.flow.updateNode('b', (n) => ({ data: { ...n.data, label: `B ${Date.now()}` } }));
    this.flow.updateNode('c', (n) => ({ data: { ...n.data, label: `C ${Date.now()}` } }));
  }

  updateNodeDataBurst(): void {
    this.nodes.forEach((n) => this.flow.updateNodeData(n.id, { label: 'node update' }));
  }

  updateEdgeBurst(): void {
    this.edges.forEach((e) => this.flow.updateEdge(e.id, { label: 'edge update' }));
  }
}
```

- [ ] **Step 3: Register in `app.routes.ts`**

```typescript
import { SetNodesBatchingExampleComponent } from './examples/set-nodes-batching/set-nodes-batching.component';
```
```typescript
{ name: 'Set nodes batching',    path: 'set-nodes-batching',    component: SetNodesBatchingExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/set-nodes-batching examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add set-nodes-batching example"
```

---

## Task 9: T2a wrap-up

- [ ] **Step 1: Update `docs/examples-parity.md`**

For each of these 8 Concept rows, flip the Angular ➖ to ✅ with the kebab name in backticks:

| Concept | New Angular cell |
|---|---|
| Controlled viewport | `✅ `controlled-viewport`` |
| Drag handle (restrict drag start) | `✅ `drag-handle`` |
| Interactive minimap | `✅ `interactive-minimap`` |
| Multi flows on one page | `✅ `multi-flows`` |
| Update node | `✅ `update-node`` |
| Node type change | `✅ `node-type-change`` |
| Default node overwrite | `✅ `default-overwrites`` |
| Default edge overwrite | `✅ `default-overwrites`` |
| Set nodes batching | `✅ `set-nodes-batching`` |
| Multi setNodes | `✅ `set-nodes-batching`` |

(The last four rows point to two combined Angular examples — fill both rows' Angular cells with the same kebab name.)

Update the summary: Angular 26 → 34. Missing count ~37 → ~29.

- [ ] **Step 2: Append to the "API gaps surfaced during Tier 1" section** (rename if needed to "API gaps surfaced during Tier 1–2a")

Add any gaps surfaced during T2a implementation (likely none based on API audit, but flag anything the implementer found).

- [ ] **Step 3: Commit the doc update**

```
git add docs/examples-parity.md
git commit -m "docs: update examples parity doc after Tier 2a port"
```

- [ ] **Step 4: Verification run**

`cd packages/angular && npx tsc --noEmit`
`cd examples/angular && npx tsc --noEmit -p tsconfig.json`

Both clean.

- [ ] **Step 5: Report**

Confirm 9 new commits (8 examples + 1 wrap-up). Note any API gaps surfaced. Hand control back for either opening the stacked PR or proceeding to T2b.

---

## Self-review

**Spec coverage:** Every T2a example has a concrete task with full code, route registration, type-check step, and commit instruction. The wrap-up task updates the parity doc in a single commit.

**Placeholder scan:** No TBD/TODO. Two `IMPORTANT — adapt to API` notes flag potentially missing or different library behaviors (multi-flows injector scope; default-overwrites lookup) — these are escalation triggers, not placeholders.

**Type consistency:** All `onNodesChange` / `onEdgesChange` typed `NodeChange[]` / `EdgeChange[]`. All `addEdge` imported from `@angflow/system`. All components use `ChangeDetectionStrategy.OnPush` + standalone. All example classes follow `<Name>ExampleComponent` naming + routes use matching kebab-case paths.
