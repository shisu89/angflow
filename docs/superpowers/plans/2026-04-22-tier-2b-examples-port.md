# Tier 2b Examples Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port 8 Tier 2 (second half) React examples to Angular: `add-node-on-edge-drop`, `custom-connection-line`, `detached-handle`, `easy-connect`, `edge-routing`, `intersection`, `moving-handles`, `reconnect-edge`.

**Architecture:** Same as Tier 1 / Tier 2a. Standalone Angular component per example, wrapped in `ExampleCardComponent`, registered in `HARNESS_ROUTES`. Zoneless, OnPush, signals.

**Tech Stack:** Angular 19, `@angflow/angular`, `@angflow/system`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-examples-parity-port-design.md`
**Preceding plans:** `2026-04-20-tier-1-examples-port.md` (T1, merged), `2026-04-22-tier-2a-examples-port.md` (T2a, in progress).

---

## Conventions (applied to every task)

Same as T2a:

1. `addEdge` and `reconnectEdge` from **`@angflow/system`**.
2. `onNodesChange(changes: NodeChange[])`, `onEdgesChange(changes: EdgeChange[])` — never `any[]`.
3. No template `&&` side-effects; use guarded wrapper methods.
4. `ChangeDetectionStrategy.OnPush` + standalone on every component.
5. `<app-example-card>` wrapper.
6. `:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`.
7. No `NgZone`. Signals drive rendering.

---

## File Structure

New files (8):

- `examples/angular/src/app/examples/add-node-on-edge-drop/add-node-on-edge-drop.component.ts`
- `examples/angular/src/app/examples/custom-connection-line/custom-connection-line.component.ts`
- `examples/angular/src/app/examples/detached-handle/detached-handle.component.ts`
- `examples/angular/src/app/examples/easy-connect/easy-connect.component.ts`
- `examples/angular/src/app/examples/edge-routing/edge-routing.component.ts`
- `examples/angular/src/app/examples/intersection/intersection.component.ts`
- `examples/angular/src/app/examples/moving-handles/moving-handles.component.ts`
- `examples/angular/src/app/examples/reconnect-edge/reconnect-edge.component.ts`

Modified:
- `examples/angular/src/app/app.routes.ts`
- `docs/examples-parity.md`

---

## Task 1: `add-node-on-edge-drop` example

Drop a connection onto the pane to auto-create a new node + edge at that position.

**Files:**
- Create: `examples/angular/src/app/examples/add-node-on-edge-drop/add-node-on-edge-drop.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**APIs used:** `(connectStart)`, `(connectEnd)`, `NgFlowService.screenToFlowPosition`.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/AddNodeOnEdgeDrop/index.tsx`. Note: on `connectStart` the source `nodeId` is stashed; on `connectEnd` if the drop target has class `react-flow__pane`, a new node is created at `screenToFlowPosition(event)` and an edge is added linking source → new node.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  NgFlowComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, OnConnectStartParams } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

let nextId = 1;
const getId = () => `${nextId++}`;

@Component({
  selector: 'app-add-node-on-edge-drop-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Add node on edge drop"
      description="Drag an edge from a node's handle and drop it on the empty pane to create a new connected node at that position. Uses connectStart / connectEnd plus NgFlowService.screenToFlowPosition."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (connectStart)="onConnectStart($event)"
        (connectEnd)="onConnectEnd($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class AddNodeOnEdgeDropExampleComponent {
  private readonly flow = inject(NgFlowService);

  private connectingNodeId: string | null = null;

  nodes: Node[] = [
    { id: '0', type: 'input', data: { label: 'Node' }, position: { x: 0, y: 50 } },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }

  onConnect(connection: Connection): void {
    this.connectingNodeId = null;
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  onConnectStart(event: { event: MouseEvent | TouchEvent; params: OnConnectStartParams }): void {
    this.connectingNodeId = event.params.nodeId ?? null;
  }

  onConnectEnd(event: MouseEvent | TouchEvent): void {
    if (!this.connectingNodeId) return;
    const target = event.target as Element | null;
    if (!target?.classList?.contains('xy-flow__pane')) return;

    if (!('clientX' in event)) return;
    const me = event as MouseEvent;
    const pos = this.flow.screenToFlowPosition({ x: me.clientX, y: me.clientY });

    const id = getId();
    const newNode: Node = {
      id,
      position: pos,
      data: { label: `Node ${id}` },
      origin: [0.5, 0.0] as [number, number],
    };
    const newEdge: Edge = { id, source: this.connectingNodeId, target: id };

    this.nodes = [...this.nodes, newNode];
    this.edges = [...this.edges, newEdge];
    this.connectingNodeId = null;
  }
}
```

**Verify-on-port:** The React example checks `target.classList.contains('react-flow__pane')`. In Angular/angflow the class is `xy-flow__pane`. Confirm by grepping `packages/angular/src/lib/` for the pane element's class name. If different, adapt.

- [ ] **Step 3: Register route**

```typescript
import { AddNodeOnEdgeDropExampleComponent } from './examples/add-node-on-edge-drop/add-node-on-edge-drop.component';
```
```typescript
{ name: 'Add node on edge drop', path: 'add-node-on-edge-drop', component: AddNodeOnEdgeDropExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/add-node-on-edge-drop examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add add-node-on-edge-drop example"
```

---

## Task 2: `custom-connection-line` example

Render a custom SVG path while the user is dragging a connection (before it's dropped).

**Files:**
- Create: `examples/angular/src/app/examples/custom-connection-line/custom-connection-line.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**API:** `NgFlowComponent` has a `[connectionLineComponent]` input taking a `Type<unknown>`. The custom component receives coordinates and renders an SVG path.

**Verify-on-port:** Confirm the exact input shape of a custom connection line. Grep `packages/angular/src/lib/components/connection-line/connection-line.component.ts` for the expected contract. The React props are `fromX`, `fromY`, `toX`, `toY`, `pointer` — Angular may call them the same or use different names.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/CustomConnectionLine/index.tsx` + `ConnectionLine.tsx`.

- [ ] **Step 2: Verify Angular connection-line API**

```bash
grep -n "readonly fromX\|readonly fromY\|readonly toX\|readonly toY" packages/angular/src/lib/components/connection-line/connection-line.component.ts
```

Adapt input names to match whatever the library uses (likely `fromX/fromY/toX/toY`).

- [ ] **Step 3: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-custom-connection-line',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents;' },
  template: `
    <svg:path
      fill="none"
      stroke="#222"
      stroke-width="1.5"
      class="animated"
      [attr.d]="path()"
    />
    <svg:circle [attr.cx]="toX()" [attr.cy]="toY()" fill="#fff" r="3" stroke="#222" stroke-width="1.5" />
  `,
})
export class CustomConnectionLineComponent {
  readonly fromX = input<number>(0);
  readonly fromY = input<number>(0);
  readonly toX = input<number>(0);
  readonly toY = input<number>(0);

  path = () => {
    const fx = this.fromX(), fy = this.fromY(), tx = this.toX(), ty = this.toY();
    return `M${fx},${fy} C ${fx} ${ty} ${fx} ${ty} ${tx},${ty}`;
  };
}

@Component({
  selector: 'app-custom-connection-line-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Custom connection line"
      description="Render your own SVG while the user drags a connection. The connection-line component receives live from/to coordinates; here we draw a cubic Bezier with a white dot at the pointer."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [connectionLineComponent]="connectionLine"
        [connectionDragThreshold]="25"
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
export class CustomConnectionLineExampleComponent {
  connectionLine: Type<unknown> = CustomConnectionLineComponent;

  nodes: Node[] = [
    { id: '1', type: 'default', data: { label: 'Node 1' }, position: { x: 250, y: 5 } },
  ];
  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
```

**Note:** The `<svg:path>` / `<svg:circle>` prefixes are required because the connection line renders inside the flow's root SVG element. If the library's connection-line contract expects a non-SVG host, adapt.

- [ ] **Step 4: Register route**

```typescript
import { CustomConnectionLineExampleComponent } from './examples/custom-connection-line/custom-connection-line.component';
```
```typescript
{ name: 'Custom connection line',path: 'custom-connection-line',component: CustomConnectionLineExampleComponent },
```

- [ ] **Step 5: Type-check** — both passes.

- [ ] **Step 6: Commit**

```
git add examples/angular/src/app/examples/custom-connection-line examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add custom-connection-line example"
```

---

## Task 3: `detached-handle` example

Demonstrates a handle rendered outside the node's boundary (attached via a small button). Connection still snaps to the button with `connectionRadius`.

**Files:**
- Create: `examples/angular/src/app/examples/detached-handle/detached-handle.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/DetachedHandle/index.tsx` + `style.css`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, input, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  HandleComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-detached-handle-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="target" [position]="Position.Left" />
    <div class="dh-body">Custom node</div>
    <ng-flow-handle type="source" [position]="Position.Right">
      <button class="detached-handle" aria-label="source handle">➡️</button>
    </ng-flow-handle>
  `,
  styles: [`
    .dh-body {
      padding: 10px 18px; background: #fff; border: 1px solid #cbd5e1;
      border-radius: 4px; font-size: 13px; color: #334155;
    }
    .detached-handle {
      position: relative; left: 24px;
      padding: 2px 6px; font-size: 14px;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 4px;
      cursor: pointer;
    }
  `],
})
export class DetachedHandleNodeComponent {
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
  selector: 'app-detached-handle-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, BackgroundComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Detached handle"
      description="Render a handle in arbitrary DOM — here as a button offset outside the node body. The flow still snaps connections to it via the connectionRadius setting."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [connectionRadius]="10"
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
export class DetachedHandleExampleComponent {
  nodeTypes: Record<string, Type<unknown>> = { default: DetachedHandleNodeComponent };

  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2', data: { label: 'Node 2' }, position: { x:  50, y: 100 } },
    { id: '3', data: { label: 'Node 3' }, position: { x: 450, y: 100 } },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
```

**Verify-on-port:** Confirm that the `<ng-flow-handle>` component supports projecting arbitrary content via `<ng-content>` (so we can nest the button inside). If not, the button needs to be a sibling with the handle positioned behind it.

- [ ] **Step 3: Register route**

```typescript
import { DetachedHandleExampleComponent } from './examples/detached-handle/detached-handle.component';
```
```typescript
{ name: 'Detached handle',       path: 'detached-handle',       component: DetachedHandleExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/detached-handle examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add detached-handle example"
```

---

## Task 4: `easy-connect` example

Demonstrates a hover-then-click connection UX: node body acts as connection start/target; during drag, potential targets highlight.

**Design note:** The React version uses `useConnection` + `useInternalNode` + `getEdgeParams` + custom floating edge. In Angular, the existing `floating-edges` example already demonstrates floating perimeter-slide endpoints via `[floating]="true"` on handles. We'll reuse that pattern and add connection-state highlighting via `NgFlowService.connection`.

**Files:**
- Create: `examples/angular/src/app/examples/easy-connect/easy-connect.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React sources** at `examples/react/src/examples/EasyConnect/` (6 files). Study `CustomNode.tsx` for the highlight logic and `floating-edges.component.ts` (already in our repo) for the Angular floating-handle pattern.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, input, computed, inject, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  NgFlowService,
  MarkerType,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-easy-connect-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <div class="ec-body" [class.ec-target]="isTarget()">
      {{ label() }}
      <ng-flow-handle type="source" id="auto" [position]="Position.Right" [floating]="true" />
      <ng-flow-handle type="target" id="auto" [position]="Position.Left"  [floating]="true" />
    </div>
  `,
  styles: [`
    .ec-body {
      padding: 18px 28px;
      border: 2px solid #334155;
      border-radius: 8px;
      background: #ccd9f6;
      font-size: 13px; font-weight: 600; color: #0f172a;
      user-select: none;
    }
    .ec-body.ec-target {
      border-style: dashed;
      background: #ffcce3;
    }
    :host ::ng-deep .xy-flow__handle { opacity: 0; }
  `],
})
export class EasyConnectNodeComponent {
  readonly Position = Position;
  private readonly flow = inject(NgFlowService);

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

  readonly isTarget = computed(() => {
    const c = this.flow.connection();
    return c.inProgress && (c as any).fromNode?.id !== this.id();
  });

  readonly label = computed(() => this.isTarget() ? 'Drop here' : 'Drag to connect');
}

@Component({
  selector: 'app-easy-connect-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Easy connect"
      description="Entire node body acts as connection target. While dragging, other nodes highlight to show they'll accept the drop. Uses floating handles for perimeter-slide endpoints."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [defaultEdgeOptions]="defaultEdgeOptions"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class EasyConnectExampleComponent {
  readonly MarkerType = MarkerType;

  nodeTypes: Record<string, Type<unknown>> = { custom: EasyConnectNodeComponent };

  defaultEdgeOptions = {
    style: { strokeWidth: 3, stroke: '#000' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#000' },
  };

  nodes: Node[] = [
    { id: '1', type: 'custom', position: { x:   0, y:   0 }, data: {} },
    { id: '2', type: 'custom', position: { x: 250, y: 320 }, data: {} },
    { id: '3', type: 'custom', position: { x:  40, y: 300 }, data: {} },
    { id: '4', type: 'custom', position: { x: 300, y:   0 }, data: {} },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
```

**Verify-on-port:**
1. The `NgFlowService.connection` signal's `fromNode` property shape — the cast to `any` on line `(c as any).fromNode?.id` should be replaced with the proper type if exposed. Grep `packages/system/src/types/connection.ts` for `ConnectionInProgress`.
2. `defaultEdgeOptions` input — confirm it exists on `NgFlowComponent`. If not, move the style into each individual edge.

- [ ] **Step 3: Register route**

```typescript
import { EasyConnectExampleComponent } from './examples/easy-connect/easy-connect.component';
```
```typescript
{ name: 'Easy connect',          path: 'easy-connect',          component: EasyConnectExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/easy-connect examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add easy-connect example"
```

---

## Task 5: `edge-routing` example

Demonstrates smoothstep edge routing with `pathOptions.offset`, `pathOptions.borderRadius`, `pathOptions.stepPosition`. Large scene: 20 nodes + 10 edges showing different routing configurations.

**Files:**
- Create: `examples/angular/src/app/examples/edge-routing/edge-routing.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/EdgeRouting/index.tsx`. 20 nodes, 10 edges demonstrating different `pathOptions` variants.

- [ ] **Step 2: Create the component**

The node and edge data is LARGE but mechanical. Copy the arrays verbatim from the React source, translating only `Position` imports and `MarkerType.ArrowClosed`.

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const NODE_BG = { background: 'rgba(255,255,255,0.5)' };

const NODES: Node[] = [
  { id:  '1', position: { x:  50, y: -100 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '2', position: { x: -100, y:   0 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id:  '3', position: { x: -100, y: 250 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '4', position: { x:  50, y: 150 }, data: { label: 'Target' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '5', position: { x: -100, y: 450 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '6', position: { x: 100, y: 400 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
  { id:  '7', position: { x: 100, y: 700 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id:  '8', position: { x: -100, y: 600 }, data: { label: 'Target' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id:  '9', position: { x: 300, y:   0 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id: '10', position: { x: 600, y: 150 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id: '11', position: { x: 300, y: 300 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id: '12', position: { x: 600, y: 450 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id: '13', position: { x: 300, y: 600 }, data: { label: 'Source' }, sourcePosition: Position.Right,  targetPosition: Position.Right,  style: NODE_BG },
  { id: '14', position: { x: 600, y: 750 }, data: { label: 'Target' }, sourcePosition: Position.Left,   targetPosition: Position.Left,   style: NODE_BG },
  { id: '15', position: { x: 800, y:   0 }, data: { label: 'Source' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id: '16', position: { x: 950, y: 150 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
  { id: '17', position: { x: 800, y: 300 }, data: { label: 'Source' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id: '18', position: { x: 950, y: 450 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
  { id: '19', position: { x: 800, y: 600 }, data: { label: 'Source' }, sourcePosition: Position.Bottom, targetPosition: Position.Bottom, style: NODE_BG },
  { id: '20', position: { x: 950, y: 750 }, data: { label: 'Target' }, sourcePosition: Position.Top,    targetPosition: Position.Top,    style: NODE_BG },
];

const EDGES: Edge[] = [
  { id:  'e1-2', source:  '1', target:  '2', pathOptions: { offset: 30 }, interactionWidth: 0 },
  { id:  'e3-4', source:  '3', target:  '4', pathOptions: { borderRadius: 2 }, interactionWidth: 0 },
  { id:  'e4-5', source:  '5', target:  '6' },
  { id:  'e7-8', source:  '7', target:  '8' },
  { id: 'e9-10', source:  '9', target: '10', label: 'stepPosition: 0.2', pathOptions: { stepPosition: 0.2 }, interactionWidth: 0 },
  { id: 'e11-12', source: '11', target: '12', label: 'stepPosition: 0.5 (default)', pathOptions: { stepPosition: 0.5 }, interactionWidth: 0 },
  { id: 'e13-14', source: '13', target: '14', label: 'stepPosition: 0.8', pathOptions: { stepPosition: 0.8 }, interactionWidth: 0 },
  { id: 'e15-16', source: '15', target: '16', label: 'stepPosition: 0.2', pathOptions: { stepPosition: 0.2 }, interactionWidth: 0 },
  { id: 'e17-18', source: '17', target: '18', label: 'stepPosition: 0.5', pathOptions: { stepPosition: 0.5 }, interactionWidth: 0 },
  { id: 'e19-20', source: '19', target: '20', label: 'stepPosition: 0.8', pathOptions: { stepPosition: 0.8 }, interactionWidth: 0 },
];

const DEFAULT_EDGE_OPTIONS = {
  label: 'Edge Label',
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 1 },
};

@Component({
  selector: 'app-edge-routing-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Edge routing"
      description="Fine-grained control over smoothstep edge routing: offset, borderRadius, and stepPosition (where the bend falls along the edge)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [defaultEdgeOptions]="defaultEdgeOptions"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class EdgeRoutingExampleComponent {
  defaultEdgeOptions = DEFAULT_EDGE_OPTIONS;
  nodes: Node[] = NODES;
  edges: Edge[] = EDGES;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
}
```

**Verify-on-port:** Confirm that `Edge.pathOptions` supports `offset`, `borderRadius`, and `stepPosition` — these should be on `SmoothStepPathOptions`. Grep `packages/system/src/types/edges.ts`.

- [ ] **Step 3: Register route**

```typescript
import { EdgeRoutingExampleComponent } from './examples/edge-routing/edge-routing.component';
```
```typescript
{ name: 'Edge routing',          path: 'edge-routing',          component: EdgeRoutingExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/edge-routing examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add edge-routing example"
```

---

## Task 6: `intersection` example

Demonstrates `NgFlowService.getIntersectingNodes()` — as a node is dragged, highlight any other node whose rect intersects the dragged node's rect.

**Files:**
- Create: `examples/angular/src/app/examples/intersection/intersection.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/Intersection/index.tsx` + `style.css`.

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-intersection-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    MiniMapComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Intersection"
      description="As you drag a node, other nodes it overlaps are highlighted. Also logs whether the node intersects an arbitrary fixed rect (0,0)-(100,100)."
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
        (nodeDrag)="onNodeDrag($event.node)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    :host ::ng-deep .xy-flow__node.highlight {
      box-shadow: 0 0 0 2px #f59e0b, 0 0 0 6px rgba(245, 158, 11, 0.25);
    }
  `],
})
export class IntersectionExampleComponent {
  private readonly flow = inject(NgFlowService);

  nodes: Node[] = [
    { id: '0', data: { label: 'rectangle' }, position: { x:   0, y:   0 }, width: 100, height: 100, draggable: false, style: { opacity: 0.5 } },
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x:   0, y:   0 }, width: 200, height: 100 },
    { id: '2', data: { label: 'Node 2' }, position: { x:   0, y: 150 } },
    { id: '3', data: { label: 'Node 3' }, position: { x: 250, y:   0 } },
    { id: '4', data: { label: 'Node'   }, position: { x: 350, y: 150 }, style: { width: 50, height: 50 } as any },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onNodeDrag(draggedNode: Node): void {
    const intersectingIds = new Set(this.flow.getIntersectingNodes(draggedNode).map((n) => n.id));
    const isIntersecting = this.flow.isNodeIntersecting(draggedNode, { x: 0, y: 0, width: 100, height: 100 });
    console.log('intersecting fixed rect:', isIntersecting);
    this.nodes = this.nodes.map((n) => ({
      ...n,
      className: intersectingIds.has(n.id) ? 'highlight' : '',
    }));
  }
}
```

**Verify-on-port:** Confirm `(nodeDrag)` output exists on `NgFlowComponent` (not just `nodeDragStart`/`nodeDragStop`). Grep `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts`. If `nodeDrag` emits mid-drag, use it; otherwise fall back to `nodeDragStop` (won't show real-time highlight but still demos the API).

- [ ] **Step 3: Register route**

```typescript
import { IntersectionExampleComponent } from './examples/intersection/intersection.component';
```
```typescript
{ name: 'Intersection',          path: 'intersection',          component: IntersectionExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/intersection examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add intersection example"
```

---

## Task 7: `moving-handles` example

Demonstrates handles that animate into view during an in-progress connection. Uses `NgFlowService.connection` signal (equivalent of React's `useConnection` hook) to detect drag state, and `NgFlowService.updateNodeInternals()` to re-measure handles after movement.

**Files:**
- Create: `examples/angular/src/app/examples/moving-handles/moving-handles.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**APIs used:** `NgFlowService.connection`, `NgFlowService.updateNodeInternals`.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/MovingHandles/` (two files).

- [ ] **Step 2: Create the component**

```typescript
import { Component, ChangeDetectionStrategy, input, computed, inject, effect, OnDestroy, Type } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  HandleComponent,
  NgFlowService,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-moving-handle-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <div class="mh-body">
      <ng-flow-handle
        type="target" id="a" [position]="Position.Left"
        [style.transform]="inProgress() ? 'translate(-20px, -50%)' : 'translate(-50%, -50%)'"
        class="mh-handle mh-handle-top"
      />
      <ng-flow-handle
        type="target" id="b" [position]="Position.Left"
        [style.transform]="inProgress() ? 'translate(-20px, 50%)' : 'translate(-50%, 50%)'"
        class="mh-handle mh-handle-bottom"
      />
      <div class="mh-label">moving handles</div>
      <ng-flow-handle type="source" id="s1" [position]="Position.Right" />
      <ng-flow-handle type="source" id="s2" [position]="Position.Right" />
    </div>
  `,
  styles: [`
    .mh-body { position: relative; background: #f4f4f4; padding: 10px 14px; border-radius: 4px; }
    .mh-label { font-size: 12px; color: #334155; }
    .mh-handle { transition: transform 0.5s; }
    .mh-handle-top    { top: 30%; }
    .mh-handle-bottom { top: 70%; }
  `],
})
export class MovingHandleNodeComponent {
  readonly Position = Position;
  private readonly flow = inject(NgFlowService);

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

  readonly inProgress = computed(() => this.flow.connection().inProgress);
}

@Component({
  selector: 'app-moving-handles-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Moving handles"
      description="Handles animate into a new position when a connection drag starts, giving users a clearer drop target. The node component reads NgFlowService.connection to react to drag state."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [minZoom]="0.2"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class MovingHandlesExampleComponent implements OnDestroy {
  private readonly flow = inject(NgFlowService);

  nodeTypes: Record<string, Type<unknown>> = { movingHandle: MovingHandleNodeComponent };

  nodes: Node[] = [
    { id: 'input', type: 'input', data: { label: 'input' }, position: { x: -300, y: 0 }, sourcePosition: Position.Right },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      type: 'movingHandle',
      position: { x: 0, y: i * 60 },
      data: {},
    })),
  ];

  edges: Edge[] = [];

  private rafHandle: number | null = null;

  constructor() {
    // Mirror the React example's updateNodeInternals loop:
    // when a connection starts, repeatedly re-measure for 500ms so handles
    // that just moved CSS-side get their bounding rects recomputed.
    effect(() => {
      const inProgress = this.flow.connection().inProgress;
      if (!inProgress) return;
      const nodeIds = this.nodes.filter((n) => n.type === 'movingHandle').map((n) => n.id);
      const startTime = performance.now();
      const tick = () => {
        if (performance.now() - startTime < 500) {
          this.flow.updateNodeInternals(nodeIds);
          this.rafHandle = requestAnimationFrame(tick);
        } else {
          this.rafHandle = null;
        }
      };
      tick();
    });
  }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void {
    this.edges = addEdge({ ...connection, animated: true }, this.edges) as Edge[];
  }

  ngOnDestroy(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
  }
}
```

**Note:** If `NgFlowService.connection` doesn't exist or has a different shape, grep `packages/angular/src/lib/services/ng-flow.service.ts` to find the actual signal. The `inProgress` boolean is standard across xyflow ports.

- [ ] **Step 3: Register route**

```typescript
import { MovingHandlesExampleComponent } from './examples/moving-handles/moving-handles.component';
```
```typescript
{ name: 'Moving handles',        path: 'moving-handles',        component: MovingHandlesExampleComponent },
```

- [ ] **Step 4: Type-check** — both passes.

- [ ] **Step 5: Commit**

```
git add examples/angular/src/app/examples/moving-handles examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add moving-handles example"
```

---

## Task 8: `reconnect-edge` example

Demonstrates `reconnectable: 'source' | 'target' | boolean` on Edge + `(reconnectStart)` / `(reconnectEnd)` / `(reconnect)` outputs.

**Files:**
- Create: `examples/angular/src/app/examples/reconnect-edge/reconnect-edge.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/ReconnectEdge/index.tsx`.

- [ ] **Step 2: Verify `reconnectable` is honored** by grepping `packages/system/src/types/edges.ts` for `reconnectable`. If missing, the edge still reconnects on both sides by default — drop the per-edge `reconnectable` property but keep the example demonstrating `(reconnect)` / `(reconnectStart)` / `(reconnectEnd)`.

- [ ] **Step 3: Create the component**

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, HandleType } from '@angflow/angular';
import { addEdge, reconnectEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-reconnect-edge-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ControlsComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Reconnect edge"
      description="Drag an existing edge endpoint onto a different handle to rewire it. Per-edge reconnectable lets you limit which side is rewireable (source, target, or both)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [snapToGrid]="true"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (reconnect)="onReconnect($event)"
        (reconnectStart)="onReconnectStart($event)"
        (reconnectEnd)="onReconnectEnd($event)"
      >
        <ng-flow-controls />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class ReconnectEdgeExampleComponent {
  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node A' }, position: { x: 250, y:   0 } },
    { id: '2',                data: { label: 'Node B' }, position: { x:  75, y:   0 } },
    { id: '3',                data: { label: 'Node C' }, position: { x: 400, y: 100 }, style: { background: '#D6D5E6', color: '#333', border: '1px solid #222138', width: 180 } as any },
    { id: '4',                data: { label: 'Node D' }, position: { x: -75, y: 100 } },
    { id: '5',                data: { label: 'Node E' }, position: { x: 150, y: 100 } },
    { id: '6',                data: { label: 'Node F' }, position: { x: 150, y: 250 } },
  ];

  edges: Edge[] = [
    { id: 'e1-3', source: '1', target: '3', label: 'This edge can only be updated from source', reconnectable: 'source' },
    { id: 'e2-4', source: '2', target: '4', label: 'This edge can only be updated from target', reconnectable: 'target' },
    { id: 'e5-6', source: '5', target: '6', label: 'This edge can be updated from both sides' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onReconnect(event: { edge: Edge; connection: Connection }): void {
    this.edges = reconnectEdge(event.edge, event.connection, this.edges) as Edge[];
  }

  onReconnectStart(event: { event: MouseEvent; edge: Edge; handleType: HandleType }): void {
    console.log(`start update ${event.handleType} handle`, event.edge);
  }

  onReconnectEnd(event: { event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType; connectionState: unknown }): void {
    console.log(`end update ${event.handleType} handle`, event.edge);
  }
}
```

- [ ] **Step 4: Register route**

```typescript
import { ReconnectEdgeExampleComponent } from './examples/reconnect-edge/reconnect-edge.component';
```
```typescript
{ name: 'Reconnect edge',        path: 'reconnect-edge',        component: ReconnectEdgeExampleComponent },
```

- [ ] **Step 5: Type-check** — both passes.

- [ ] **Step 6: Commit**

```
git add examples/angular/src/app/examples/reconnect-edge examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add reconnect-edge example"
```

---

## Task 9: T2b wrap-up

- [ ] **Step 1: Update `docs/examples-parity.md`**

Flip these Angular cells from ➖ to ✅:

| Concept | New Angular cell |
|---|---|
| Add node on edge drop | `✅ `add-node-on-edge-drop`` |
| Custom connection line | `✅ `custom-connection-line`` |
| Detached handle | `✅ `detached-handle`` |
| Easy connect (click to connect) | `✅ `easy-connect`` |
| Edge routing | `✅ `edge-routing`` |
| Intersection (`getIntersectingNodes`) | `✅ `intersection`` |
| Moving handles | `✅ `moving-handles`` |
| Reconnect edge | `✅ `reconnect-edge`` |

Update the summary: Angular 34 → 42. Missing count ~29 → ~21.

- [ ] **Step 2: Append to the API-gaps section** any gaps surfaced during T2b implementation. Expected candidates:
- Node renderer `nodeTypes.default` override behavior (T2a verify-on-port).
- Connection-line component input names (`fromX`/`toX` vs different).
- Edge `reconnectable` support.
- `<ng-flow-handle>` content projection support.

- [ ] **Step 3: Commit the doc update**

```
git add docs/examples-parity.md
git commit -m "docs: update examples parity doc after Tier 2b port"
```

- [ ] **Step 4: Final verification**

`cd packages/angular && npx tsc --noEmit`
`cd examples/angular && npx tsc --noEmit -p tsconfig.json`

Both clean.

- [ ] **Step 5: Report**

9 new commits (8 examples + wrap-up). Note all API gaps surfaced. At this point the full Tier 2 scope is merged — spec's "API audit gate" before Tier 3 is next.

---

## Self-review

**Spec coverage:** Every T2b example has full code, route registration, type-check step, and commit instructions. Several tasks include "Verify-on-port" notes that tell the implementer what to check before committing — these target known risk areas (custom connection line API, reconnectable edge property, ng-flow-handle content projection) without being placeholders.

**Placeholder scan:** No TBD / TODO / incomplete sections. "Verify-on-port" notes are explicit escalation triggers with specific files to grep.

**Type consistency:** Every `onNodesChange` / `onEdgesChange` uses `NodeChange[]` / `EdgeChange[]`. `addEdge` / `reconnectEdge` from `@angflow/system`. All components OnPush + standalone. Handler signatures match the `NgFlowComponent` output shapes established in T1 (e.g., `(reconnectStart)` emits `{ event, edge, handleType }`).
