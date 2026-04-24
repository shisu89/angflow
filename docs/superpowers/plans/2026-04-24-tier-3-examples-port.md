# Tier 3 Examples Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the 3 Tier 3 React showcase examples to Angular: `figma`, `layouting` (dagre), `stress`. These are high-polish, README-worthy demos — more involved per-example than Tier 2.

**Architecture:** Same conventions as Tier 1/2a/2b — each example is a standalone Angular component at `examples/angular/src/app/examples/<kebab>/<kebab>.component.ts`, wrapped in `<app-example-card>`, registered in `HARNESS_ROUTES`. Zoneless, OnPush, signals throughout.

**Tech Stack:** Angular 21, `@angflow/angular`, `@angflow/system`, plus `dagre` (added in Task 2) for `layouting`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-examples-parity-port-design.md`
**Preceding plans:** `2026-04-20-tier-1-examples-port.md` (T1, merged), `2026-04-22-tier-2a-examples-port.md` (T2a, merged), `2026-04-22-tier-2b-examples-port.md` (T2b, merged).

---

## Conventions (apply to every task)

Same as T2a/T2b:

1. `addEdge` and `reconnectEdge` from **`@angflow/system`** (not `@angflow/angular`).
2. `onNodesChange(changes: NodeChange[])`, `onEdgesChange(changes: EdgeChange[])` — never `any[]`.
3. No template `&&` side-effects; use guarded wrapper methods.
4. `ChangeDetectionStrategy.OnPush` + `standalone: true` on every component.
5. `<app-example-card title="..." description="...">` wrapper from `@examples-shared/example-card.component`.
6. `:host { display: flex; flex: 1; min-width: 0; min-height: 0; }` on every example component's host.
7. No `NgZone`. Native event handlers and timers drive signal writes only.

## Up-front enrichment declarations

Per spec: "Enrichment is declared up-front per example, not added silently during port."

- **Figma:** No enrichment. Direct port preserving every input/output binding and the same `console.log` instrumentation used by the React source for demo-day debugging.
- **Layouting:** No enrichment. Drop the `<ReactFlowDevTools />` panel — devtools is its own React example not yet ported, and the showcase demonstrates dagre layout, not devtools.
- **Stress:** No enrichment. Port the FrameRecorder utilities and the same six interaction buttons. The React `key`-based remount maps to an Angular `@if`-toggle.

## File Structure

New files (5):

- `examples/angular/src/app/examples/figma/figma.component.ts`
- `examples/angular/src/app/examples/layouting/layouting.component.ts`
- `examples/angular/src/app/examples/stress/stress.component.ts`
- `examples/angular/src/app/examples/stress/utils.ts` — `getNodesAndEdges(x, y)` factory
- `examples/angular/src/app/examples/stress/perf-utils.ts` — `FrameRecorder`, `nextFrame`, `generateMouseEventParamsTargetingNode`

Modified (2):

- `examples/angular/src/app/app.routes.ts` — 3 imports + 3 HARNESS_ROUTES entries (appended end, before Kitchen sink)
- `examples/angular/package.json` — add `dagre` + `@types/dagre` deps (Task 2)
- `docs/examples-parity.md` — flip 3 rows from ➖ to ✅, update summary count, log API findings (Task 4 wrap-up)

## Verification commands (used after every task)

From `packages/angular/`:
```bash
npx tsc --noEmit
```
From `examples/angular/`:
```bash
npx tsc --noEmit -p tsconfig.json
```

Both must be clean (zero output) after every task. Vitest in `packages/angular` (`npm test`) is the additional Task 4 (final wrap-up) verification — should keep showing 127/127 passing.

---

## Task 1: `figma` example

Demonstrates the Figma-style multi-select-with-drag UX: hold modifier keys to multi-select, drag the canvas with mouse buttons 1–2, scroll-pan instead of scroll-zoom, lots of pane/move/selection event instrumentation.

**Files:**
- Create: `examples/angular/src/app/examples/figma/figma.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

**APIs used (all pre-verified to exist on `NgFlowComponent`):**
- Inputs: `[selectionOnDrag]`, `[selectionMode]` (uses `SelectionMode.Partial`), `[panOnDrag]` (number array `[1, 2]`), `[panOnScroll]`, `[paneClickDistance]`, `[zoomActivationKeyCode]`, `[multiSelectionKeyCode]`, `[fitView]`, `[selectNodesOnDrag]`.
- Outputs: `(paneContextMenu)`, `(selectionContextMenu)`, `(moveStart)`, `(move)`, `(moveEnd)`, `(paneClick)`, `(selectionStart)`, `(selectionEnd)`.
- `<ng-flow-background variant="cross" />` — `'cross'` is one of the three supported `BackgroundVariant` values.
- `<ng-flow-controls />`, `<ng-flow-panel position="top-right">`.

- [ ] **Step 1: Read the React source** at `examples/react/src/examples/Figma/index.tsx`. Note the constants at module level (`MULTI_SELECT_KEY = ['Meta', 'Shift']`, `panOnDrag = [1, 2]`) and the no-op `console.log` handlers used as demo instrumentation. The React `onPointerDown`/`onPointerUp`/`onClick` handlers are bound directly on `<ReactFlow>` — Angular doesn't expose those at the component level (it has equivalents like `paneClick`/`paneMouseMove`), so we drop those three.

- [ ] **Step 2: Verify-on-port — `paneContextMenu` and `selectionContextMenu` event payloads**

```bash
grep -n "paneContextMenu\|selectionContextMenu" packages/angular/src/lib/container/ng-flow/ng-flow.component.ts | head -10
```

Expected:
- `paneContextMenu = output<MouseEvent>(...)` — payload is the raw event.
- `selectionContextMenu = output<{ event: MouseEvent; nodes: Node[] }>(...)` — payload wraps event + selected nodes.

The React source uses the SAME handler (`onPaneContextMenu`) for both. We mirror that in Angular but the handler signature must accept both shapes — write a guarded wrapper:

```typescript
onPaneContextMenu(event: MouseEvent): void {
  event.preventDefault();
  console.log('context menu');
}
onSelectionContextMenu(payload: { event: MouseEvent; nodes: Node[] }): void {
  this.onPaneContextMenu(payload.event);
}
```

- [ ] **Step 3: Create the component** at `examples/angular/src/app/examples/figma/figma.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  SelectionMode,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, Viewport } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const MULTI_SELECT_KEY = ['Meta', 'Shift'];
const PAN_ON_DRAG = [1, 2];

@Component({
  selector: 'app-figma-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Figma"
      description="Figma-style canvas: hold ⌘ or Shift to multi-select, drag with the middle/right mouse button to pan, scroll to pan (not zoom). Watch the console — every pane / selection / move event is instrumented."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [selectionOnDrag]="true"
        [selectionMode]="SelectionMode.Partial"
        [panOnDrag]="panOnDrag"
        [panOnScroll]="true"
        [paneClickDistance]="100"
        [zoomActivationKeyCode]="'Meta'"
        [multiSelectionKeyCode]="multiSelectKey"
        [fitView]="true"
        [selectNodesOnDrag]="false"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (paneContextMenu)="onPaneContextMenu($event)"
        (selectionContextMenu)="onSelectionContextMenu($event)"
        (moveStart)="onMoveStart($event)"
        (move)="onMove($event)"
        (moveEnd)="onMoveEnd($event)"
        (paneClick)="onPaneClick($event)"
        (selectionStart)="onSelectionStart($event)"
        (selectionEnd)="onSelectionEnd($event)"
      >
        <ng-flow-background variant="cross" />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <input type="text" placeholder="name" class="figma-input" />
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .figma-input {
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 13px;
      background: #fff;
    }
    .figma-input:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
    }
  `],
})
export class FigmaExampleComponent {
  readonly SelectionMode = SelectionMode;
  readonly multiSelectKey = MULTI_SELECT_KEY;
  readonly panOnDrag = PAN_ON_DRAG;

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 }, className: 'light' },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 }, className: 'light' },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 }, className: 'light' },
    { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 }, className: 'light' },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3' },
  ];

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onPaneContextMenu(event: MouseEvent): void {
    event.preventDefault();
    console.log('context menu');
  }
  onSelectionContextMenu(payload: { event: MouseEvent; nodes: Node[] }): void {
    this.onPaneContextMenu(payload.event);
  }

  onMoveStart(payload: { event: MouseEvent | TouchEvent | null; viewport: Viewport }): void { console.log('move start', payload); }
  onMove(payload: { event: MouseEvent | TouchEvent | null; viewport: Viewport }): void { console.log('move', payload); }
  onMoveEnd(payload: { event: MouseEvent | TouchEvent | null; viewport: Viewport }): void { console.log('move end', payload); }
  onPaneClick(event: MouseEvent): void { console.log('pane click', event); }
  onSelectionStart(event: MouseEvent): void { console.log('on selection start', event); }
  onSelectionEnd(event: MouseEvent): void { console.log('on selection end', event); }
}
```

- [ ] **Step 4: Register in `app.routes.ts`**

CRITICAL convention: append at end, immediately before `Kitchen sink`. Match the column alignment used by surrounding T2b entries (wider path/component columns).

Import (place after the most recent example import — `ReconnectEdgeExampleComponent` — and before `KitchenSinkComponent`):
```typescript
import { FigmaExampleComponent } from './examples/figma/figma.component';
```

Route entry (place immediately after the `Reconnect edge` entry, immediately before `Kitchen sink`):
```typescript
{ name: 'Figma',                   path: 'figma',                   component: FigmaExampleComponent },
```

- [ ] **Step 5: Type-check**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/packages/angular" && npx tsc --noEmit
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/examples/angular" && npx tsc --noEmit -p tsconfig.json
```

Both must be clean.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples"
git add examples/angular/src/app/examples/figma examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add figma example"
```

---

## Task 2: `layouting` (dagre) example

Demonstrates auto-layout via the `dagre` graph library. Buttons trigger horizontal / vertical layout, fitView (full + partial), unselect, and edge-marker swap.

**Files:**
- Create: `examples/angular/src/app/examples/layouting/layouting.component.ts`
- Modify: `examples/angular/package.json` (add `dagre` + `@types/dagre`)
- Modify: `examples/angular/src/app/app.routes.ts`

**Verify-on-port (already pre-checked at planning time):**
- `dagre` IS in `examples/react/package.json` but NOT in `examples/angular/package.json` — must be added.
- `(init)` output exists on `NgFlowComponent` and emits `NgFlowService` — perfect for the React `onInit={() => onLayout('TB')}` pattern.
- `[nodeExtent]` input exists, takes `CoordinateExtent`.
- `NgFlowService.fitView(options?)` accepts `FitViewOptionsBase<NodeType>` so partial-fit `{ nodes: [...] }` works.

- [ ] **Step 1: Read the React sources** at `examples/react/src/examples/Layouting/index.tsx` and `initial-elements.ts`.

- [ ] **Step 2: Add dagre dependency**

Edit `examples/angular/package.json` and append to the `dependencies` block (alphabetical order — between `@types/d3-zoom` and `d3-drag`):
```json
"dagre": "^0.8.5",
```

And to the `devDependencies` block (alphabetical — between `@types/node` and `jsdom`):
```json
"@types/dagre": "^0.7.52",
```

Then install from the workspace root:
```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples"
pnpm install
```

Verify:
```bash
ls "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/node_modules/dagre" 2>&1 | head -3
```
Expect to see `dagre` directory listing.

- [ ] **Step 3: Create the component** at `examples/angular/src/app/examples/layouting/layouting.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import * as dagre from 'dagre';
import {
  NgFlowComponent,
  ControlsComponent,
  PanelComponent,
  NgFlowService,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange, CoordinateExtent, EdgeMarker } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const NODE_EXTENT: CoordinateExtent = [
  [0, 0],
  [1000, 1000],
];

const POSITION = { x: 0, y: 0 };

const INITIAL_NODES: Node[] = [
  { id: '1',  type: 'input',  data: { label: 'input'   }, position: POSITION },
  { id: '2',                  data: { label: 'node 2'  }, position: POSITION },
  { id: '2a',                 data: { label: 'node 2a' }, position: POSITION },
  { id: '2b',                 data: { label: 'node 2b' }, position: POSITION },
  { id: '2c',                 data: { label: 'node 2c' }, position: POSITION },
  { id: '2d',                 data: { label: 'node 2d' }, position: POSITION },
  { id: '3',                  data: { label: 'node 3'  }, position: POSITION },
  { id: '4',                  data: { label: 'node 4'  }, position: POSITION },
  { id: '5',                  data: { label: 'node 5'  }, position: POSITION },
  { id: '6',  type: 'output', data: { label: 'output'  }, position: POSITION },
  { id: '7',  type: 'output', data: { label: 'output'  }, position: { x: 400, y: 450 } },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e12',   source: '1',  target: '2',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e13',   source: '1',  target: '3',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e22a',  source: '2',  target: '2a', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e22b',  source: '2',  target: '2b', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e22c',  source: '2',  target: '2c', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e2c2d', source: '2c', target: '2d', type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e45',   source: '4',  target: '5',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e56',   source: '5',  target: '6',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
  { id: 'e57',   source: '5',  target: '7',  type: 'smoothstep', markerEnd: { type: MarkerType.Arrow } },
];

@Component({
  selector: 'app-layouting-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ControlsComponent, PanelComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Layouting (dagre)"
      description="Auto-layout the graph with dagre. Toggle vertical / horizontal direction, refit the view (whole graph or just the first two nodes), unselect, and swap arrow / arrow-closed markers on every edge."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeExtent]="nodeExtent"
        (init)="onInit()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <div class="lo-panel">
            <button (click)="layout('TB')">vertical layout</button>
            <button (click)="layout('LR')">horizontal layout</button>
            <button (click)="unselect()">unselect nodes</button>
            <button (click)="changeMarker()">change marker</button>
            <button (click)="fitAll()">fitView</button>
            <button (click)="fitFirstTwo()">fitView partially</button>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .lo-panel {
      display: flex; flex-direction: column; gap: 4px;
    }
    .lo-panel button {
      padding: 4px 10px; font-size: 12px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class LayoutingExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly nodeExtent = NODE_EXTENT;

  nodes: Node[] = [...INITIAL_NODES];
  edges: Edge[] = [...INITIAL_EDGES];

  onInit(): void { this.layout('TB'); }

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  layout(direction: 'TB' | 'LR'): void {
    const isHorizontal = direction === 'LR';
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: direction });

    for (const node of this.nodes) {
      graph.setNode(node.id, { width: 150, height: 50 });
    }
    for (const edge of this.edges) {
      graph.setEdge(edge.source, edge.target);
    }

    dagre.layout(graph);

    this.nodes = this.nodes.map((node) => {
      const positioned = graph.node(node.id);
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left  : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: { x: positioned.x, y: positioned.y },
      };
    });
  }

  unselect(): void {
    this.nodes = this.nodes.map((n) => ({ ...n, selected: false }));
  }

  changeMarker(): void {
    this.edges = this.edges.map((e) => ({
      ...e,
      markerEnd: {
        type: (e.markerEnd as EdgeMarker | undefined)?.type === MarkerType.Arrow
          ? MarkerType.ArrowClosed
          : MarkerType.Arrow,
      },
    }));
  }

  fitAll(): void { this.flow.fitView(); }

  fitFirstTwo(): void {
    this.flow.fitView({ nodes: this.nodes.slice(0, 2) });
  }
}
```

**Notes:**
- `import * as dagre from 'dagre';` — dagre's TypeScript types are namespace-exported, so star-import is the canonical form.
- The constant `POSITION = { x: 0, y: 0 }` is reused intentionally across the initial nodes; dagre overwrites `position` immediately on first layout, so the shared reference is harmless.
- `EdgeMarker` is exported from `@angflow/angular`. If your tsc complains the type can't be found, fall back to `(e.markerEnd as { type?: MarkerType } | undefined)`.

- [ ] **Step 4: Register in `app.routes.ts`**

Append at end, after `Figma`, before `Kitchen sink`:

Import (after the `FigmaExampleComponent` import added in Task 1, before `KitchenSinkComponent`):
```typescript
import { LayoutingExampleComponent } from './examples/layouting/layouting.component';
```

Route entry:
```typescript
{ name: 'Layouting',               path: 'layouting',               component: LayoutingExampleComponent },
```

Match neighbor column alignment.

- [ ] **Step 5: Type-check** — both must pass cleanly.

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/packages/angular" && npx tsc --noEmit
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/examples/angular" && npx tsc --noEmit -p tsconfig.json
```

If you see "Cannot find module 'dagre' or its corresponding type declarations", re-run `pnpm install` from Step 2 — Angular's tsconfig should pick the installed types up automatically.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples"
git add examples/angular/package.json examples/angular/pnpm-lock.yaml examples/angular/src/app/examples/layouting examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add layouting (dagre) example"
```

(If `pnpm-lock.yaml` lives at the workspace root rather than `examples/angular/`, adjust the `git add` accordingly — `git status` will tell you which lockfile changed.)

---

## Task 3: `stress` example

Demonstrates a 625-node / 624-edge flow with six performance-measuring buttons (select, drag-in-viewport, drag-outside-viewport, remount, change pos, update elements, add element) using a custom `FrameRecorder` to log frame durations.

**Files:**
- Create: `examples/angular/src/app/examples/stress/stress.component.ts`
- Create: `examples/angular/src/app/examples/stress/utils.ts` — `getNodesAndEdges(x, y)` factory
- Create: `examples/angular/src/app/examples/stress/perf-utils.ts` — `FrameRecorder`, `nextFrame`, `generateMouseEventParamsTargetingNode`
- Modify: `examples/angular/src/app/app.routes.ts`

**Pre-verified at planning time:**
- The `data-id` attribute is set on each node host at `packages/angular/src/lib/container/node-renderer/node-renderer.component.ts:61`. Querying `.xy-flow__node[data-id="..."]` works exactly like the React equivalent.
- `selectNodesOnDrag` / `minZoom` / `(connect)` / `(nodesChange)` / `(edgesChange)` / `(init)` all available — same as Tier 2.

- [ ] **Step 1: Read the React sources** — `examples/react/src/examples/Stress/index.tsx`, `utils.ts`, `performanceUtils.ts`.

- [ ] **Step 2: Create `examples/angular/src/app/examples/stress/utils.ts`**

```typescript
import type { Node, Edge } from '@angflow/angular';

export interface ElementsCollection {
  nodes: Node[];
  edges: Edge[];
}

export function getNodesAndEdges(xElements = 10, yElements = 10): ElementsCollection {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let nodeId = 1;
  let recentNodeId: number | null = null;

  for (let y = 0; y < yElements; y++) {
    for (let x = 0; x < xElements; x++) {
      const node: Node = {
        id: nodeId.toString(),
        style: { width: 50, height: 30, fontSize: 11 } as any,
        data: { label: `Node ${nodeId}` },
        position: { x: x * 100, y: y * 50 },
      };
      nodes.push(node);

      if (recentNodeId !== null && nodeId <= xElements * yElements) {
        edges.push({
          id: `${x}-${y}`,
          source: recentNodeId.toString(),
          target: nodeId.toString(),
        });
      }

      recentNodeId = nodeId;
      nodeId++;
    }
  }

  return { nodes, edges };
}
```

The `as any` cast on `style` is the same React-parity workaround used by `intersection` and `reconnect-edge` examples in T2b — `Node['style']` is typed for string CSS values but the React source passes numeric `width`/`height`/`fontSize`.

- [ ] **Step 3: Create `examples/angular/src/app/examples/stress/perf-utils.ts`**

```typescript
interface Frame {
  duration: number;
  stage: string;
}

/**
 * Measures the duration of every frame between construction and `endRecordingAsync()`.
 *
 * Usage:
 * ```ts
 * const recorder = new FrameRecorder();
 * // ...do perf-intensive work...
 * await recorder.endRecordingAsync();
 * console.log(recorder.getFrames());
 * ```
 */
export class FrameRecorder {
  private frames: Frame[] = [];
  private animationFrameId: number;
  private stage = '<no stage>';

  constructor() {
    let lastFrameTimestamp = performance.now();

    const measureFrame = () => {
      const timestamp = performance.now();

      // Annotate each frame in the Performance pane (collapsed "Timings" section).
      performance.measure(`frame (${this.stage})`, {
        start: lastFrameTimestamp,
        end: timestamp,
      });

      this.frames.push({
        duration: timestamp - lastFrameTimestamp,
        stage: this.stage,
      });

      lastFrameTimestamp = timestamp;
      this.animationFrameId = requestAnimationFrame(measureFrame);
    };

    this.animationFrameId = requestAnimationFrame(measureFrame);
  }

  /**
   * Method is `async` to remind callers to `await` it — otherwise some events get lost.
   */
  async endRecordingAsync(): Promise<void> {
    this.setStage('waiting for idle');
    await new Promise<void>((resolve) => requestIdleCallback(() => resolve()));
    requestAnimationFrame(() => cancelAnimationFrame(this.animationFrameId));
  }

  setStage(stage: string): void {
    this.stage = stage;
  }

  getFramesForObservable(): Array<Frame & { index: number }> {
    return this.frames.map((frame, index) => ({ ...frame, index }));
  }

  getFrames(): Record<string, number[]> {
    const framesPerStage: Record<string, number[]> = {};
    for (const frame of this.frames) {
      (framesPerStage[frame.stage] ??= []).push(frame.duration);
    }
    return framesPerStage;
  }
}

/**
 * Resolves on the next macrotask — equivalent to `setTimeout(..., 0)`.
 * Use to yield between synthesized DOM events so the previous one finishes processing.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Generates `MouseEvent` constructor params targeting a node DOM element.
 * Click/drag will land 5px inside the node's top-left corner.
 */
export function generateMouseEventParamsTargetingNode(node: Element): MouseEventInit & {
  clientX: number;
  clientY: number;
  movementX: number;
  movementY: number;
} {
  const rect = node.getBoundingClientRect();
  const inset = { left: 5, top: 5 };

  return {
    clientX: Math.round(rect.left + inset.left),
    clientY: Math.round(rect.top + inset.top),
    movementX: 0,
    movementY: 0,

    // Required boilerplate for a synthetic mouse event.
    altKey: false,
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    composed: true,
    ctrlKey: false,
    detail: 1,
    metaKey: false,
    shiftKey: false,
    view: window,
  };
}
```

**Notes:**
- `requestIdleCallback` is not declared in the default DOM lib in some TS configs. If tsc complains, add `// eslint-disable-next-line` and a tiny declare:
  ```typescript
  declare function requestIdleCallback(cb: () => void): number;
  ```
  …above the class. Verify by reading `lib.dom.d.ts` or just by running tsc.
- `MouseEventInit` is the standard DOM type for `new MouseEvent(type, init)`. Returning a typed init object means the consumer can pass it directly to the `MouseEvent` constructor.

- [ ] **Step 4: Create `examples/angular/src/app/examples/stress/stress.component.ts`**

```typescript
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  PanelComponent,
  NgFlowService,
  applyNodeChanges,
  applyEdgeChanges,
} from '@angflow/angular';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@angflow/angular';
import { addEdge } from '@angflow/system';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

import { getNodesAndEdges } from './utils';
import {
  FrameRecorder,
  nextFrame,
  generateMouseEventParamsTargetingNode,
} from './perf-utils';

const INITIAL = getNodesAndEdges(25, 25);

@Component({
  selector: 'app-stress-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    ControlsComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Stress"
      description="625-node / 624-edge flow for performance testing. Each button synthesizes pointer events and prints frame durations to the console — paste into observablehq.com/@iamakulov/long-frame-visualizer to inspect."
    >
      @if (mounted()) {
        <ng-flow
          [nodes]="nodes"
          [edges]="edges"
          [minZoom]="0.2"
          [fitView]="true"
          (nodesChange)="onNodesChange($event)"
          (edgesChange)="onEdgesChange($event)"
          (connect)="onConnect($event)"
        >
          <ng-flow-background />
          <ng-flow-controls />
          <ng-flow-panel position="top-right">
            <div class="st-panel">
              <button (click)="selectNode()">select node</button>
              <button (click)="dragInViewport()">drag node within the viewport</button>
              <button (click)="dragOutsideViewport()">drag node outside of the viewport</button>
              <button (click)="remount()">re-mount</button>
              <button (click)="updatePos()">change pos</button>
              <button (click)="updateElements()">update elements</button>
              <button (click)="addElement()">Add element</button>
            </div>
          </ng-flow-panel>
        </ng-flow>
      }
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .st-panel { display: flex; flex-direction: column; gap: 4px; }
    .st-panel button {
      font-size: 12px; padding: 4px 8px;
      background: #ffffffcc; backdrop-filter: blur(4px);
      border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;
    }
  `],
})
export class StressExampleComponent {
  private readonly flow = inject(NgFlowService);

  readonly mounted = signal(true);

  nodes: Node[] = INITIAL.nodes;
  edges: Edge[] = INITIAL.edges;

  onNodesChange(changes: NodeChange[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: EdgeChange[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  async selectNode(): Promise<void> {
    const idx = Math.floor(Math.random() * this.nodes.length);
    const el = document.querySelector(`.xy-flow__node[data-id="${this.nodes[idx].id}"]`);
    if (!el) { console.warn('Node not found'); return; }

    const recorder = new FrameRecorder();
    const params = generateMouseEventParamsTargetingNode(el);

    recorder.setStage('mousedown');
    el.dispatchEvent(new MouseEvent('mousedown', params));
    await nextFrame();

    recorder.setStage('click');
    el.dispatchEvent(new MouseEvent('click', params));
    await nextFrame();

    recorder.setStage('mouseup');
    el.dispatchEvent(new MouseEvent('mouseup', params));
    await nextFrame();

    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  /**
   * Hold mousedown on node 18, move 5px left per frame for 20 frames, then mouseup.
   * Node 18 lives in the right portion of the viewport, so dragging left
   * doesn't risk auto-scrolling the viewport.
   */
  async dragInViewport(): Promise<void> {
    const el = document.querySelector(`.xy-flow__node[data-id="18"]`);
    if (!el) { console.warn('Node 18 not found'); return; }

    const recorder = new FrameRecorder();
    const downParams = generateMouseEventParamsTargetingNode(el);

    recorder.setStage('mousedown');
    el.dispatchEvent(new MouseEvent('mousedown', downParams));
    await nextFrame();

    recorder.setStage('mousemove');
    let x = downParams.clientX;
    for (let i = 0; i < 20; i++) {
      const dx = -5;
      x += dx;
      el.dispatchEvent(new MouseEvent('mousemove', { ...downParams, clientX: x, screenX: x, movementX: dx }));
      await nextFrame();
    }

    recorder.setStage('mouseup');
    el.dispatchEvent(new MouseEvent('mouseup', { ...downParams, clientX: x, screenX: x }));
    await nextFrame();

    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  /**
   * Hold mousedown on a random node, wiggle near the top of the viewport so the
   * viewport scrolls. Tests the auto-pan-on-drag-out-of-bounds path.
   */
  async dragOutsideViewport(): Promise<void> {
    const idx = Math.floor(Math.random() * this.nodes.length);
    const el = document.querySelector(`.xy-flow__node[data-id="${this.nodes[idx].id}"]`);
    if (!el) { console.warn('Node not found'); return; }

    const recorder = new FrameRecorder();
    const downParams = generateMouseEventParamsTargetingNode(el);

    recorder.setStage('mousedown');
    el.dispatchEvent(new MouseEvent('mousedown', downParams));
    await nextFrame();

    recorder.setStage('mousemove');
    let y = 50;
    for (let i = 0; i < 20; i++) {
      const dy = Math.random() > 0.5 ? +2 : -2;
      y += dy;
      el.dispatchEvent(new MouseEvent('mousemove', { ...downParams, clientY: y, screenY: y, movementY: dy }));
      await nextFrame();
    }

    recorder.setStage('mouseup');
    el.dispatchEvent(new MouseEvent('mouseup', { ...downParams, clientY: y, screenY: y }));
    await nextFrame();

    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  /**
   * Toggle `mounted` off and on so Angular tears down and re-creates the
   * `<ng-flow>`. This is the Angular equivalent of React's `key`-based remount.
   * Uses a microtask boundary so the destroy and create phases land on
   * separate change-detection cycles.
   */
  async remount(): Promise<void> {
    const recorder = new FrameRecorder();
    this.mounted.set(false);
    await Promise.resolve();
    this.mounted.set(true);
    await recorder.endRecordingAsync();
    this.logFrames(recorder);
  }

  updatePos(): void {
    this.nodes = this.nodes.map((n) => ({
      ...n,
      position: {
        x: Math.random() * window.innerWidth * 4,
        y: Math.random() * window.innerHeight * 4,
      },
    }));
    this.flow.fitView();
  }

  updateElements(): void {
    const grid = Math.ceil(Math.random() * 10);
    const fresh = getNodesAndEdges(grid, grid);
    this.nodes = fresh.nodes;
    this.edges = fresh.edges;
  }

  addElement(): void {
    const id = (this.nodes.length + 1).toString();
    this.nodes = [...this.nodes, { id, position: { x: 0, y: 0 }, data: { label: `Node ${id}` } }];
  }

  private logFrames(recorder: FrameRecorder): void {
    console.log('Frame durations:', recorder.getFrames());
    console.log(
      'Frame durations for Observable (paste into https://observablehq.com/@iamakulov/long-frame-visualizer):',
      recorder.getFramesForObservable(),
    );
  }
}
```

**Notes:**
- `@if (mounted()) { <ng-flow>... </ng-flow> }` — the toggle re-mount pattern. Setting `mounted.set(false)` then `mounted.set(true)` after a microtask boundary gives Angular two separate change-detection cycles, which destroys and re-creates the `<ng-flow>` (and its child `FlowStore` injector). This mirrors the React `key`-prop trick.
- `INITIAL = getNodesAndEdges(25, 25)` is a module-level constant — 625 nodes constructed once on file load. Subsequent `updateElements()` calls produce fresh arrays.
- The `console.warn` fallbacks for `if (!el)` are defensive; under normal use the queries succeed.
- This component injects `NgFlowService` from the component-scoped `<ng-flow>` injector. After a `remount()`, the `<ng-flow>` is destroyed and re-created, and **the injected `flow` reference points to the OLD instance**. After remount, `this.flow.fitView()` would no-op silently. The `updatePos()` button calls `this.flow.fitView()` after re-mounting may no longer act on the live instance — but the button is independent (you only call `updatePos` in normal use). Acceptable for a stress demo.
  - If this becomes a real concern, switch to `(init)="onInit($event)"` to capture the live `NgFlowService` per mount, but the React example doesn't bother either, so keep parity.

- [ ] **Step 5: Register in `app.routes.ts`**

Append at end, after `Layouting`, before `Kitchen sink`:

Import:
```typescript
import { StressExampleComponent } from './examples/stress/stress.component';
```
Route entry:
```typescript
{ name: 'Stress',                  path: 'stress',                  component: StressExampleComponent },
```

- [ ] **Step 6: Type-check**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/packages/angular" && npx tsc --noEmit
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/examples/angular" && npx tsc --noEmit -p tsconfig.json
```

Both clean. If `requestIdleCallback` errors in `perf-utils.ts`, add the local `declare function` shim noted in Step 3.

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples"
git add examples/angular/src/app/examples/stress examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add stress example"
```

---

## Task 4: T3 wrap-up

- [ ] **Step 1: Update `docs/examples-parity.md`**

Flip these 3 Angular cells from ➖ to ✅ (find each row by its Concept text — leave React and Svelte columns untouched):

| Concept | New Angular cell |
|---|---|
| Figma-style | `✅ \`figma\`` |
| Layouting (dagre) | `✅ \`layouting\`` |
| Stress (perf) | `✅ \`stress\`` |

Note: the existing parity-doc row for `Stress (perf)` lists `✅ \`stress\`` for Svelte — leave that. Update only the Angular column.

Update the summary:
- Angular: **42 → 45**.
- "Angular is missing ~21 examples that exist in React, and ~1 that exists in Svelte." → "Angular is missing ~18 examples that exist in React, and ~1 that exists in Svelte."

- [ ] **Step 2: Rename + extend the API gaps section**

Find the heading `## API gaps surfaced during Tier 1–2b` and rename to `## API gaps surfaced during Tier 1–3` (keep the en-dash `–` U+2013).

Append a new bullet:

```
- **Tier 3 surfaced no new library gaps.** All 3 examples (`figma`, `layouting`, `stress`) ported using existing inputs/outputs/services. Confirmed during port: `[selectionOnDrag]`/`[selectionMode]`/`[panOnDrag: number[]]`/`[panOnScroll]`/`[paneClickDistance]`/`[zoomActivationKeyCode]`/`[multiSelectionKeyCode]`/`[nodeExtent]`, `(paneContextMenu)`/`(selectionContextMenu)`/`(moveStart)`/`(move)`/`(moveEnd)`/`(paneClick)`/`(selectionStart)`/`(selectionEnd)` outputs, `(init)` output emits live `NgFlowService` instance, `BackgroundVariant` includes `'cross'`. Stress example confirms the `data-id` attribute on `.xy-flow__node` host elements (used for synthesized DOM-event tests). External dep added: `dagre@^0.8.5` + `@types/dagre@^0.7.52` in `examples/angular/package.json`.
```

- [ ] **Step 3: Commit the doc update**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples"
git add docs/examples-parity.md
git commit -m "docs: update examples parity doc after Tier 3 port"
```

- [ ] **Step 4: Final verification**

```bash
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/packages/angular" && npx tsc --noEmit && npm test
cd "/c/Users/shisu/OneDrive/CodeWeb/reactflow-to-angular/angflow/.worktrees/tier-3-examples/examples/angular" && npx tsc --noEmit -p tsconfig.json
```

All three checks must be clean. Vitest should report `Tests  127 passed (127)` (no library-side regressions from this branch).

- [ ] **Step 5: Report**

4 new commits (3 examples + 1 wrap-up). All 3 examples shipped without library-side gaps. Tier 3 = `figma`, `layouting`, `stress` — Angular total now at 45 examples (up from 42). With Tier 1+2+3 done, the design spec's **API audit gate** is the next milestone before authoring the Tier 4 plan.

---

## Self-review

**Spec coverage:** Every Tier 3 example listed in the design spec (`figma`, `layouting`, `stress`) has a dedicated task with full code, route registration, type-check step, and commit instruction. The wrap-up updates the parity doc in a single commit per the established convention.

**Acceptance-bar coverage** (per spec section "Acceptance criteria (per example)"):
- (1) `examples/angular/src/app/examples/<kebab>/<kebab>.component.ts` — all 3 use this path.
- (2) HARNESS_ROUTES registration — all 3 in Step "Register in app.routes.ts".
- (3) Zero console errors/warnings — implicit in tsc clean + manual QA out of plan scope.
- (4) `npx tsc --noEmit` in both packages — explicit step in every task.
- (5) Zoneless-safe — no `NgZone` injection anywhere; `requestAnimationFrame` in `perf-utils.ts` is purely for measurement (rule 3 of CLAUDE.md zoneless contract); the `remount()` toggle is a signal write driving CD.
- (6) Description panel — all 3 use `<app-example-card title=… description=…>` per Tier 1/2 convention.
- (7) Basic a11y — focusable buttons get default focus rings; `<input>` in Figma example gets explicit `:focus` outline.
- (8) No dead code — no commented-out React snippets, no TODOs.

**Placeholder scan:** No TBD/TODO. The two `Verify-on-port` notes (in Tasks 1 and 2) are pre-resolved at planning time — the implementer just confirms with the documented grep commands. The optional `requestIdleCallback` shim in Task 3 is a defensive note, not a placeholder.

**Type consistency:**
- All `onNodesChange` / `onEdgesChange` use `NodeChange[]` / `EdgeChange[]`.
- All `addEdge` imports come from `@angflow/system`.
- `getNodesAndEdges` return type (`ElementsCollection`) consistent across `utils.ts` and `stress.component.ts`.
- `FrameRecorder` interface (`endRecordingAsync`, `setStage`, `getFrames`, `getFramesForObservable`) is defined once in `perf-utils.ts` and consumed in `stress.component.ts` only.
- `EdgeMarker` import in Task 2 layouting is type-only and used solely for the markerEnd cast in `changeMarker()`.

**Enrichment policy:** Up-front declarations cover all three examples — no enrichment, drop only the React-specific `<ReactFlowDevTools />` from the layouting source (devtools is its own React example, not yet ported, and is unrelated to the dagre showcase).

**API-audit gate:** This plan does NOT include the audit step. Per the design spec, the audit happens between Tier 3 merge and Tier 4 plan-writing. Task 4 Step 5 explicitly notes this as the next milestone.
