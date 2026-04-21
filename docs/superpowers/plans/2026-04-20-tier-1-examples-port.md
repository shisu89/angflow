# Tier 1 Examples Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port 9 Tier-1 React examples to Angular, bringing Angular toward functional parity with React while meeting the spec's standard acceptance bar.

**Architecture:** Each ported example is a standalone Angular component at `examples/angular/src/app/examples/<kebab>/<kebab>.component.ts`, wrapped in the existing `ExampleCardComponent` (which provides the required title + description panel), and registered in `HARNESS_ROUTES` in `app.routes.ts`.

**Tech Stack:** Angular 19 (standalone components, signals, zoneless), `@angflow/angular`, `@angflow/system`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-examples-parity-port-design.md`

---

## File Structure

New files (9):

- `examples/angular/src/app/examples/color-mode/color-mode.component.ts`
- `examples/angular/src/app/examples/interaction/interaction.component.ts`
- `examples/angular/src/app/examples/a11y/a11y.component.ts`
- `examples/angular/src/app/examples/cancel-connection/cancel-connection.component.ts`
- `examples/angular/src/app/examples/click-distance/click-distance.component.ts`
- `examples/angular/src/app/examples/hidden/hidden.component.ts`
- `examples/angular/src/app/examples/z-index-mode/z-index-mode.component.ts`
- `examples/angular/src/app/examples/touch-device/touch-device.component.ts`
- `examples/angular/src/app/examples/undirectional/undirectional.component.ts`

Modified files (2):

- `examples/angular/src/app/app.routes.ts` — 9 new imports + 9 new `HARNESS_ROUTES` entries.
- `docs/examples-parity.md` — flip 9 rows from ➖ to ✅ (final task).

**No new shared component is needed** — the spec's `ExampleDescriptionComponent` requirement is already satisfied by the existing `ExampleCardComponent` at `examples/angular/src/app/examples/_shared/example-card.component.ts`, which provides title + description header and wraps the canvas.

## Ground rules

- Every component uses `ChangeDetectionStrategy.OnPush`.
- Every component is wrapped in `<app-example-card title="..." description="...">` via `ExampleCardComponent`.
- No `NgZone` injection. All interaction state lives in Angular signals; D3/native event handlers must drive signal writes (per `CLAUDE.md` zoneless rules).
- `@examples-shared/example-card.component` path alias is already configured in `examples/angular/tsconfig.json`.
- Keep the existing `:host { display: flex; flex: 1; min-width: 0; min-height: 0; }` pattern on the example component so the card fills the harness shell.
- `console.log` calls in React examples map to `console.log` in Angular unless they're noisy; drop click-noise logs if they'd spam the console (acceptance bar: zero console *warnings*, logs are fine).

## Verification commands (used throughout)

From `examples/angular/`:

```bash
npm run dev            # starts dev server; open http://localhost:4200/<example-path>
```

From `packages/angular/`:

```bash
npx tsc --noEmit       # type-check the library
```

From `examples/angular/`:

```bash
npx tsc --noEmit -p tsconfig.json  # type-check the example app
```

---

## Task 1: `color-mode` example

Demonstrates `colorMode` input (`'light' | 'dark' | 'system'`). Reference: `examples/react/src/examples/ColorMode/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/color-mode/color-mode.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/ColorMode/index.tsx`. Note the 4 nodes (A/B/C/D with right/left source/target positions), 3 edges, and a `<select>` inside `<Panel position="top-right">` switching light/dark/system.

- [ ] **Step 2: Create the Angular example component**

Create `examples/angular/src/app/examples/color-mode/color-mode.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection, ColorMode } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-color-mode-example',
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
      title="Color mode"
      description="Toggle light / dark / system color themes. The flow reads the OS preference in system mode and updates live when the OS theme changes."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [colorMode]="colorMode()"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <label class="cm-label">
            <span>color mode</span>
            <select
              class="cm-select"
              [value]="colorMode()"
              (change)="setMode($event)"
              aria-label="Color mode"
            >
              <option value="light">light</option>
              <option value="dark">dark</option>
              <option value="system">system</option>
            </select>
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cm-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .cm-select {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font-size: 13px;
    }
  `],
})
export class ColorModeExampleComponent {
  readonly colorMode = signal<ColorMode>('light');

  nodes: Node[] = [
    { id: 'A', type: 'input', position: { x:   0, y: 150 }, data: { label: 'A' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'B',                position: { x: 250, y:   0 }, data: { label: 'B' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'C',                position: { x: 250, y: 150 }, data: { label: 'C' }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: 'D',                position: { x: 250, y: 300 }, data: { label: 'D' }, sourcePosition: Position.Right, targetPosition: Position.Left },
  ];

  edges: Edge[] = [
    { id: 'A-B', source: 'A', target: 'B' },
    { id: 'A-C', source: 'A', target: 'C' },
    { id: 'A-D', source: 'A', target: 'D' },
  ];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setMode(event: Event): void {
    this.colorMode.set((event.target as HTMLSelectElement).value as ColorMode);
  }
}
```

- [ ] **Step 3: Register in app.routes.ts**

Open `examples/angular/src/app/app.routes.ts`. Add the import with the other example imports (sorted to match existing grouping):

```typescript
import { ColorModeExampleComponent } from './examples/color-mode/color-mode.component';
```

Add to `HARNESS_ROUTES` near the end (before `Kitchen sink`):

```typescript
{ name: 'Color mode',            path: 'color-mode',            component: ColorModeExampleComponent },
```

- [ ] **Step 4: Type-check**

From `packages/angular/`:

```bash
npx tsc --noEmit
```

Expected: no new errors.

From `examples/angular/`:

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no new errors.

- [ ] **Step 5: Manual verification**

From `examples/angular/`: `npm run dev`. Open `http://localhost:4200/color-mode`.

Check:
- Flow renders with 4 nodes and 3 edges.
- Switching select to `dark` turns the canvas dark (requires library dark styles; if it appears unchanged, verify that `packages/angular/src/lib/styles/` has dark CSS for `.xy-flow.dark`).
- Switching to `system` follows the OS theme. If the OS is in dark mode, the canvas goes dark.
- No console errors or warnings.
- No TypeScript errors in the dev-server overlay.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/examples/color-mode examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add color-mode example"
```

---

## Task 2: `interaction` example

Demonstrates interactive toggles for `nodesDraggable`, `nodesConnectable`, `elementsSelectable`, `zoomOnScroll`, `zoomOnPinch`, `panOnScroll`, `panOnScrollMode`, `zoomOnDoubleClick`, `panOnDrag`, and three "capture" toggles that switch pane/click handlers on/off. Reference: `examples/react/src/examples/Interaction/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/interaction/interaction.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/Interaction/index.tsx`. Note: in React the initial values for most toggles are `false` (so panning/zooming are off by default) but `panOnDrag` starts `true`. Event callbacks `onPaneClick`/`onPaneScroll`/`onPaneContextMenu` are bound conditionally based on capture toggles.

- [ ] **Step 2: Create the Angular example component**

Create `examples/angular/src/app/examples/interaction/interaction.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  PanOnScrollMode,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection, Viewport } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-interaction-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Interaction"
      description="Toggle every user-interaction flag on the flow at runtime: dragging, connecting, selecting, pan/zoom modes, and whether the pane's click/scroll handlers are captured."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodesDraggable]="isDraggable()"
        [nodesConnectable]="isConnectable()"
        [elementsSelectable]="isSelectable()"
        [zoomOnScroll]="zoomOnScroll()"
        [zoomOnPinch]="zoomOnPinch()"
        [panOnScroll]="panOnScroll()"
        [panOnScrollMode]="panOnScrollMode()"
        [zoomOnDoubleClick]="zoomOnDoubleClick()"
        [panOnDrag]="panOnDrag()"
        [nodeDragThreshold]="0"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (nodeDragStart)="log('drag start', $event.node)"
        (nodeDragStop)="log('drag stop', $event.node)"
        (nodeClick)="captureElementClick() && log('click', $event.node)"
        (edgeClick)="captureElementClick() && log('click', $event.edge)"
        (paneClick)="captureZoomClick() && log('onPaneClick', $event)"
        (moveEnd)="onMoveEnd($event.viewport)"
      >
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-left">
          <div class="panel">
            <label><input type="checkbox" [checked]="isDraggable()" (change)="setFlag('isDraggable', $event)" /> nodesDraggable</label>
            <label><input type="checkbox" [checked]="isConnectable()" (change)="setFlag('isConnectable', $event)" /> nodesConnectable</label>
            <label><input type="checkbox" [checked]="isSelectable()" (change)="setFlag('isSelectable', $event)" /> elementsSelectable</label>
            <label><input type="checkbox" [checked]="zoomOnScroll()" (change)="setFlag('zoomOnScroll', $event)" /> zoomOnScroll</label>
            <label><input type="checkbox" [checked]="zoomOnPinch()" (change)="setFlag('zoomOnPinch', $event)" /> zoomOnPinch</label>
            <label><input type="checkbox" [checked]="panOnScroll()" (change)="setFlag('panOnScroll', $event)" /> panOnScroll</label>
            <label>
              panOnScrollMode
              <select [value]="panOnScrollMode()" (change)="setScrollMode($event)">
                <option value="free">free</option>
                <option value="horizontal">horizontal</option>
                <option value="vertical">vertical</option>
              </select>
            </label>
            <label><input type="checkbox" [checked]="zoomOnDoubleClick()" (change)="setFlag('zoomOnDoubleClick', $event)" /> zoomOnDoubleClick</label>
            <label><input type="checkbox" [checked]="panOnDrag()" (change)="setFlag('panOnDrag', $event)" /> panOnDrag</label>
            <label><input type="checkbox" [checked]="captureZoomClick()" (change)="setFlag('captureZoomClick', $event)" /> capture onPaneClick</label>
            <label><input type="checkbox" [checked]="captureZoomScroll()" (change)="setFlag('captureZoomScroll', $event)" /> capture onPaneScroll</label>
            <label><input type="checkbox" [checked]="captureElementClick()" (change)="setFlag('captureElementClick', $event)" /> capture onElementClick</label>
          </div>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      font-size: 12px;
      color: #334155;
    }
    .panel label { display: flex; align-items: center; gap: 6px; }
    .panel select { margin-left: 6px; font-size: 12px; }
  `],
})
export class InteractionExampleComponent {
  readonly isDraggable = signal(false);
  readonly isConnectable = signal(false);
  readonly isSelectable = signal(false);
  readonly zoomOnScroll = signal(false);
  readonly zoomOnPinch = signal(false);
  readonly panOnScroll = signal(false);
  readonly panOnScrollMode = signal<PanOnScrollMode>(PanOnScrollMode.Free);
  readonly zoomOnDoubleClick = signal(false);
  readonly panOnDrag = signal<boolean | number[]>(true);
  readonly captureZoomClick = signal(false);
  readonly captureZoomScroll = signal(false);
  readonly captureElementClick = signal(false);

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 } },
    { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3' },
  ];

  private readonly flags: Record<string, ReturnType<typeof signal<boolean>>> = {
    isDraggable: this.isDraggable,
    isConnectable: this.isConnectable,
    isSelectable: this.isSelectable,
    zoomOnScroll: this.zoomOnScroll,
    zoomOnPinch: this.zoomOnPinch,
    panOnScroll: this.panOnScroll,
    zoomOnDoubleClick: this.zoomOnDoubleClick,
    // panOnDrag is boolean | number[], handled manually
    captureZoomClick: this.captureZoomClick,
    captureZoomScroll: this.captureZoomScroll,
    captureElementClick: this.captureElementClick,
  } as Record<string, ReturnType<typeof signal<boolean>>>;

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setFlag(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (key === 'panOnDrag') {
      this.panOnDrag.set(checked);
      return;
    }
    const sig = this.flags[key];
    if (sig) sig.set(checked);
  }

  setScrollMode(event: Event): void {
    this.panOnScrollMode.set((event.target as HTMLSelectElement).value as PanOnScrollMode);
  }

  onMoveEnd(viewport: Viewport): void { console.log('onMoveEnd', viewport); }
  log(...args: unknown[]): void { console.log(...args); }
}
```

- [ ] **Step 3: Register in app.routes.ts**

Add import:

```typescript
import { InteractionExampleComponent } from './examples/interaction/interaction.component';
```

Add route:

```typescript
{ name: 'Interaction',           path: 'interaction',           component: InteractionExampleComponent },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit   # from packages/angular
```

```bash
npx tsc --noEmit -p tsconfig.json   # from examples/angular
```

- [ ] **Step 5: Manual verification**

`http://localhost:4200/interaction`. Check each toggle flips the behavior:
- `nodesDraggable` off → cannot drag nodes; on → can.
- `zoomOnScroll` off → mouse wheel does nothing on the pane.
- `panOnScroll` on → mouse wheel pans; try switching `panOnScrollMode` to `horizontal`/`vertical` to see axis constraints.
- `panOnDrag` off → cannot pan by dragging the background.
- `capture onPaneClick` on → clicking the background logs `onPaneClick` to console.
- Zero console warnings.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/examples/interaction examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add interaction example"
```

---

## Task 3: `a11y` example

Demonstrates custom `ariaLabelConfig` + `autoPanOnNodeFocus` toggle. Reference: `examples/react/src/examples/A11y/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/a11y/a11y.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/A11y/index.tsx`. Note: 6 nodes at varied positions (some off-screen to demonstrate auto-pan-on-focus); a custom `ariaLabelConfig` override; top-right panel with a single checkbox.

- [ ] **Step 2: Create the Angular example component**

Create `examples/angular/src/app/examples/a11y/a11y.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection, AriaLabelConfig } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const ariaLabelConfig: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default': 'Custom Node Desc.',
  'node.a11yDescription.keyboardDisabled': 'Custom Keyboard Desc.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) =>
    `Custom moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
  'edge.a11yDescription.default': 'Custom Edge Desc.',
  'controls.ariaLabel': 'Custom Controls Aria Label',
  'controls.zoomIn.ariaLabel': 'Custom Zoom in',
  'controls.zoomOut.ariaLabel': 'Custom Zoom Out',
  'controls.fitView.ariaLabel': 'Custom Fit View',
  'controls.interactive.ariaLabel': 'Custom Toggle Interactivity',
  'minimap.ariaLabel': 'Custom Aria Label',
};

@Component({
  selector: 'app-a11y-example',
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
      title="Accessibility"
      description="Custom aria labels for every interactive element plus auto-pan-on-focus. Tab through the flow to see the viewport automatically follow focused nodes that are off-screen."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [ariaLabelConfig]="ariaLabelConfig"
        [autoPanOnNodeFocus]="autoPanOnNodeFocus()"
        [selectNodesOnDrag]="false"
        [elevateEdgesOnSelect]="true"
        [elevateNodesOnSelect]="false"
        [nodeDragThreshold]="0"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background variant="dots" />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <label class="a11y-label">
            <input
              type="checkbox"
              [checked]="autoPanOnNodeFocus()"
              (change)="setAutoPan($event)"
            />
            autoPanOnNodeFocus
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .a11y-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
    }
  `],
})
export class A11yExampleComponent {
  readonly autoPanOnNodeFocus = signal(true);
  readonly ariaLabelConfig = ariaLabelConfig;

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'A11y Node 1' }, position: { x:  250, y:   5 } },
    { id: '2',                data: { label: 'Node 2'     }, position: { x: 1000, y: 100 } },
    { id: '3',                data: { label: 'Node 3'     }, position: { x:  100, y: 100 } },
    { id: '4',                data: { label: 'Node 4'     }, position: { x:  300, y: 100 } },
    { id: '5',                data: { label: 'Node 5'     }, position: { x:  400, y: 200 } },
    { id: '6',                data: { label: 'Node 6'     }, position: { x: -1000, y: 200 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e1-4', source: '1', target: '4' },
    { id: 'e4-5', source: '4', target: '5' },
    { id: 'e3-6', source: '3', target: '6' },
  ];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  setAutoPan(event: Event): void {
    this.autoPanOnNodeFocus.set((event.target as HTMLInputElement).checked);
  }
}
```

**Note — API verification:** Before running, confirm the following inputs exist on `NgFlowComponent`: `autoPanOnNodeFocus`, `selectNodesOnDrag`, `elevateEdgesOnSelect`, `elevateNodesOnSelect`, `nodeDragThreshold`. Grep `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` for each. If any are missing, drop them from the template and note the gap in the Tier 1 wrap-up task (Task 10) — do not block the port; the example still demonstrates `ariaLabelConfig` which is the primary feature.

- [ ] **Step 3: Register in app.routes.ts**

```typescript
import { A11yExampleComponent } from './examples/a11y/a11y.component';
```

```typescript
{ name: 'Accessibility',         path: 'a11y',                  component: A11yExampleComponent },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 5: Manual verification**

`http://localhost:4200/a11y`. Check:
- Tab into the flow with keyboard; focused node is highlighted.
- Toggle `autoPanOnNodeFocus` on, tab to node 2 or 6 (far off-screen); viewport should pan to follow. Toggle off, focus stays in place.
- Inspect the DOM: aria labels on the controls match the custom strings ("Custom Zoom in", etc.).
- Zero console warnings.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/examples/a11y examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add a11y example"
```

---

## Task 4: `cancel-connection` example

Demonstrates programmatically cancelling an in-progress connection after a countdown. Reference: `examples/react/src/examples/CancelConnection/`.

**Files:**
- Create: `examples/angular/src/app/examples/cancel-connection/cancel-connection.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

The React example uses `useStore((state) => state.cancelConnection)` to grab the cancel action. In Angular, `FlowStore.cancelConnection()` is the equivalent method (see `packages/angular/src/lib/services/flow-store.service.ts:676`). Inject `FlowStore` via DI.

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/CancelConnection/index.tsx`, `Timer.tsx`, `hooks/useCountdown.ts`. The behavior: start dragging an edge from a handle → a 5-second countdown begins → if connection hasn't resolved, `cancelConnection()` is called and the in-progress edge vanishes.

- [ ] **Step 2: Create the Angular example component**

Create `examples/angular/src/app/examples/cancel-connection/cancel-connection.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal, inject, OnDestroy } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  MiniMapComponent,
  FlowStore,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const CANCEL_AFTER = 5; // seconds

@Component({
  selector: 'app-cancel-connection-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    BackgroundComponent,
    MiniMapComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Cancel connection"
      description="Starts a 5-second countdown when you begin dragging a connection. If the connection doesn't resolve by then, it's cancelled programmatically via FlowStore.cancelConnection()."
    >
      @if (counting()) {
        <div class="timer" role="timer" aria-live="polite">
          Connection will cancel in {{ remaining().toFixed(1) }}s
        </div>
      }
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [fitView]="true"
        [maxZoom]="2"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (connectStart)="startCountdown()"
        (connectEnd)="stopCountdown()"
      >
        <ng-flow-background />
        <ng-flow-minimap />
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; position: relative; }
    .timer {
      position: absolute;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      padding: 8px 14px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  `],
})
export class CancelConnectionExampleComponent implements OnDestroy {
  private readonly store = inject(FlowStore);

  readonly counting = signal(false);
  readonly remaining = signal(CANCEL_AFTER);

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  nodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 120 } },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 120 } },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void {
    this.stopCountdown();
    this.edges = addEdge(connection, this.edges) as Edge[];
  }

  startCountdown(): void {
    this.stopCountdown();
    this.counting.set(true);
    this.remaining.set(CANCEL_AFTER);
    const start = performance.now();
    this.timerHandle = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      this.remaining.set(Math.max(0, CANCEL_AFTER - elapsed));
    }, 100);
    this.timeoutHandle = setTimeout(() => {
      this.store.cancelConnection();
      this.stopCountdown();
    }, CANCEL_AFTER * 1000);
  }

  stopCountdown(): void {
    this.counting.set(false);
    if (this.timerHandle !== null) { clearInterval(this.timerHandle); this.timerHandle = null; }
    if (this.timeoutHandle !== null) { clearTimeout(this.timeoutHandle); this.timeoutHandle = null; }
  }

  ngOnDestroy(): void { this.stopCountdown(); }
}
```

- [ ] **Step 3: Register in app.routes.ts**

```typescript
import { CancelConnectionExampleComponent } from './examples/cancel-connection/cancel-connection.component';
```

```typescript
{ name: 'Cancel connection',     path: 'cancel-connection',     component: CancelConnectionExampleComponent },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 5: Manual verification**

`http://localhost:4200/cancel-connection`. Check:
- Start dragging an edge from any handle; timer appears showing a countdown from 5.0s.
- Release the drag onto another handle within the timer window → edge is created, timer disappears.
- Start a drag and hold for >5 seconds without releasing → the connection preview vanishes automatically, timer disappears.
- Zero console warnings.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/examples/cancel-connection examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add cancel-connection example"
```

---

## Task 5: `click-distance` example

Demonstrates `paneClickDistance` input: how far the mouse can drag during a pane click before the click is suppressed. Reference: `examples/react/src/examples/ClickDistance/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/click-distance/click-distance.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/ClickDistance/index.tsx`. Note: 4 nodes, pane click logs to console, a range slider 0–100 drives `paneClickDistance`.

- [ ] **Step 2: Create the Angular example component**

Create `examples/angular/src/app/examples/click-distance/click-distance.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-click-distance-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, PanelComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Click distance"
      description="How far the pointer can drift during a pane click before the click is suppressed. Slide to increase the tolerance, then try panning the background — small drifts still count as clicks (watch the console)."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [paneClickDistance]="paneClickDistance()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (paneClick)="onPaneClick()"
      >
        <ng-flow-panel position="top-right">
          <label class="cd-label">
            <span>click distance: {{ paneClickDistance() }}px</span>
            <input
              type="range"
              min="0"
              max="100"
              [value]="paneClickDistance()"
              (input)="setDistance($event)"
              aria-label="Pane click distance"
            />
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .cd-label {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
    }
    .cd-label input[type="range"] { width: 140px; }
  `],
})
export class ClickDistanceExampleComponent {
  readonly paneClickDistance = signal(0);

  nodes: Node[] = [
    { id: '1a', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2a',                data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
    { id: '3a',                data: { label: 'Node 3' }, position: { x: 400, y: 100 } },
    { id: '4a',                data: { label: 'Node 4' }, position: { x: 400, y: 200 } },
  ];

  edges: Edge[] = [
    { id: 'e1-2', source: '1a', target: '2a' },
    { id: 'e1-3', source: '1a', target: '3a' },
  ];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  onPaneClick(): void { console.log('pane click'); }
  setDistance(event: Event): void { this.paneClickDistance.set(Number((event.target as HTMLInputElement).value)); }
}
```

- [ ] **Step 3: Register in app.routes.ts**

```typescript
import { ClickDistanceExampleComponent } from './examples/click-distance/click-distance.component';
```

```typescript
{ name: 'Click distance',        path: 'click-distance',        component: ClickDistanceExampleComponent },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 5: Manual verification**

`http://localhost:4200/click-distance`. Check:
- With slider at 0, clicking the background and drifting the mouse even 1px suppresses the click log.
- Set slider to 50; click-drag up to 50px still logs `pane click`; beyond that is treated as a pan.
- Zero console warnings.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/examples/click-distance examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add click-distance example"
```

---

## Task 6: `hidden` example

Demonstrates the `hidden` property on nodes and edges. Reference: `examples/react/src/examples/Hidden/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/hidden/hidden.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/Hidden/index.tsx`. Note: 4 nodes and 3 edges all start with `hidden: true`; a single checkbox flips the `hidden` flag across all nodes and edges.

(The React example imports `ReactFlowDevTools` — skip that import; DevTools is out of scope per the spec.)

- [ ] **Step 2: Create the Angular example component**

Create `examples/angular/src/app/examples/hidden/hidden.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-hidden-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFlowComponent,
    ControlsComponent,
    MiniMapComponent,
    PanelComponent,
    ExampleCardComponent,
  ],
  template: `
    <app-example-card
      title="Hidden nodes & edges"
      description="The hidden prop hides a node or edge without removing it from the graph. Toggle to reveal them — positions, handles, and edge connectivity are preserved."
    >
      <ng-flow
        [nodes]="visibleNodes()"
        [edges]="visibleEdges()"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-left">
          <label class="hidden-label">
            <input
              type="checkbox"
              [checked]="isHidden()"
              (change)="setHidden($event)"
            />
            isHidden
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .hidden-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #ffffffcc;
      backdrop-filter: blur(4px);
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
    }
  `],
})
export class HiddenExampleComponent {
  readonly isHidden = signal(true);

  private readonly baseNodes: Node[] = [
    { id: '1', type: 'input', data: { label: 'Node 1' }, position: { x: 250, y:   5 } },
    { id: '2',                data: { label: 'Node 2' }, position: { x: 100, y: 100 } },
    { id: '3',                data: { label: 'Node 3' }, position: { x: 400, y: 100 } },
    { id: '4',                data: { label: 'Node 4' }, position: { x: 400, y: 200 } },
  ];

  private readonly baseEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
  ];

  visibleNodes = () => this.baseNodes.map((n) => ({ ...n, hidden: this.isHidden() }));
  visibleEdges = () => this.baseEdges.map((e) => ({ ...e, hidden: this.isHidden() }));

  onNodesChange(changes: any[]): void {
    const updated = applyNodeChanges(changes, this.baseNodes);
    // Mutate in-place to preserve reference stability for the getter
    this.baseNodes.length = 0;
    this.baseNodes.push(...updated);
  }

  onEdgesChange(changes: any[]): void {
    const updated = applyEdgeChanges(changes, this.baseEdges);
    this.baseEdges.length = 0;
    this.baseEdges.push(...updated);
  }

  onConnect(connection: Connection): void {
    const updated = addEdge(connection, this.baseEdges) as Edge[];
    this.baseEdges.length = 0;
    this.baseEdges.push(...updated);
  }

  setHidden(event: Event): void {
    this.isHidden.set((event.target as HTMLInputElement).checked);
  }
}
```

**Note:** The getter-based approach recomputes on each template read. If performance matters (it shouldn't for 4 nodes), wrap with `computed()` instead. Either works for the acceptance bar.

- [ ] **Step 3: Register in app.routes.ts**

```typescript
import { HiddenExampleComponent } from './examples/hidden/hidden.component';
```

```typescript
{ name: 'Hidden',                path: 'hidden',                component: HiddenExampleComponent },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 5: Manual verification**

`http://localhost:4200/hidden`. Check:
- On load: canvas is empty (all hidden).
- Uncheck `isHidden`: 4 nodes and 3 edges appear.
- Check again: they disappear. Position state is preserved across toggles.
- Zero console warnings.

- [ ] **Step 6: Commit**

```bash
git add examples/angular/src/app/examples/hidden examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add hidden example"
```

---

## Task 7: `z-index-mode` example

Demonstrates `zIndexMode: 'manual' | 'basic' | 'auto'` for controlling how subflow/parent-child z-ordering is computed. Reference: `examples/react/src/examples/ZIndexMode/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/z-index-mode/z-index-mode.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/ZIndexMode/index.tsx`. Note: 3 top-level nodes (A/B/C) plus 3 groups (D/F/H) each with a child (E/G/I). Select switches between manual/basic/auto.

- [ ] **Step 2: Verify API**

Grep the library for `zIndexMode`:

```bash
grep -n "zIndexMode" packages/angular/src/lib/container/ng-flow/ng-flow.component.ts
```

If the input doesn't exist yet on `NgFlowComponent`, note the gap in Task 10's wrap-up section and skip this example (it becomes a deferral, not a port failure). Based on the spec, deferring is allowed if an API gap blocks a T1 example.

Assuming the input exists, proceed.

- [ ] **Step 3: Create the Angular example component**

Create `examples/angular/src/app/examples/z-index-mode/z-index-mode.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  NgFlowComponent,
  BackgroundComponent,
  ControlsComponent,
  MiniMapComponent,
  PanelComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection, ZIndexMode } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

const NODE_DEFAULTS = { sourcePosition: Position.Right, targetPosition: Position.Left };

@Component({
  selector: 'app-z-index-mode-example',
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
      title="Z-index mode"
      description="Controls how stacking order is computed for parent/child nodes. Auto picks an order based on hierarchy; basic lets you set z via node data; manual disables automatic ordering entirely."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [zIndexMode]="zIndexMode()"
        [fitView]="true"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
      >
        <ng-flow-background />
        <ng-flow-minimap />
        <ng-flow-controls />
        <ng-flow-panel position="top-right">
          <label class="zi-label">
            <span>zIndexMode</span>
            <select [value]="zIndexMode()" (change)="setMode($event)">
              <option value="manual">manual</option>
              <option value="basic">basic</option>
              <option value="auto">auto</option>
            </select>
          </label>
        </ng-flow-panel>
      </ng-flow>
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    .zi-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .zi-label select { font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff; }
  `],
})
export class ZIndexModeExampleComponent {
  readonly zIndexMode = signal<ZIndexMode>('auto');

  nodes: Node[] = [
    { id: 'A', type: 'input', position: { x:   0, y: 150 }, data: { label: 'A' }, ...NODE_DEFAULTS },
    { id: 'B',                position: { x: 250, y:   0 }, data: { label: 'B' }, ...NODE_DEFAULTS },
    { id: 'C',                position: { x: 250, y: 150 }, data: { label: 'C' }, ...NODE_DEFAULTS },
    { id: 'D',                position: { x:   0, y: 300 }, width: 200, height: 200, data: { label: 'D' }, ...NODE_DEFAULTS },
    { id: 'E', parentId: 'D', position: { x:  10, y:  10 }, data: { label: 'E' }, ...NODE_DEFAULTS },
    { id: 'F',                position: { x: 250, y: 300 }, width: 200, height: 200, data: { label: 'F' }, ...NODE_DEFAULTS },
    { id: 'G', parentId: 'F', position: { x:  10, y:  10 }, data: { label: 'G' }, ...NODE_DEFAULTS },
    { id: 'H',                position: { x: 500, y: 300 }, width: 200, height: 200, data: { label: 'H' }, ...NODE_DEFAULTS },
    { id: 'I', parentId: 'H', position: { x:  10, y:  10 }, data: { label: 'I' }, ...NODE_DEFAULTS },
  ];

  edges: Edge[] = [
    { id: 'A-B', source: 'A', target: 'B' },
    { id: 'A-C', source: 'A', target: 'C' },
  ];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  setMode(event: Event): void { this.zIndexMode.set((event.target as HTMLSelectElement).value as ZIndexMode); }
}
```

- [ ] **Step 4: Register in app.routes.ts**

```typescript
import { ZIndexModeExampleComponent } from './examples/z-index-mode/z-index-mode.component';
```

```typescript
{ name: 'Z-index mode',          path: 'z-index-mode',          component: ZIndexModeExampleComponent },
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 6: Manual verification**

`http://localhost:4200/z-index-mode`. Check:
- Canvas shows 3 top nodes and 3 group/child pairs.
- Switching between `manual`, `basic`, `auto` changes which node renders on top when dragged over another group.
- Zero console warnings.

- [ ] **Step 7: Commit**

```bash
git add examples/angular/src/app/examples/z-index-mode examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add z-index-mode example"
```

---

## Task 8: `touch-device` example

Demonstrates touch-optimized defaults plus `onClickConnectStart` / `onClickConnectEnd` events (for tap-to-connect on touch devices). Reference: `examples/react/src/examples/TouchDevice/index.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/touch-device/touch-device.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/TouchDevice/index.tsx` and `touch-device.css`. The React example is minimal: 2 nodes, bespoke CSS for larger touch targets, and console logs on click-to-connect events.

- [ ] **Step 2: Check API availability**

```bash
grep -n "clickConnectStart\|clickConnectEnd" packages/angular/src/lib/container/ng-flow/ng-flow.component.ts
```

If Angular doesn't expose `clickConnectStart`/`clickConnectEnd` outputs, drop those from the template. The core touch feature (bigger handle hit targets via CSS) still works.

- [ ] **Step 3: Create the Angular example component**

Create `examples/angular/src/app/examples/touch-device/touch-device.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  NgFlowComponent,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-touch-device-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Touch device"
      description="Enlarged handle hit targets and touch-first event wiring. Try dragging connections on a touchscreen or with browser devtools touch emulation."
    >
      <ng-flow
        class="touch-flow"
        [nodes]="nodes"
        [edges]="edges"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (connectStart)="log('connect start')"
        (connectEnd)="log('connect end')"
      />
    </app-example-card>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
    :host ::ng-deep .touch-flow .xy-flow__handle {
      width: 20px;
      height: 20px;
      border-width: 3px;
    }
  `],
})
export class TouchDeviceExampleComponent {
  nodes: Node[] = [
    { id: '1', data: { label: 'Node 1' }, position: { x: 100, y: 100 }, sourcePosition: Position.Right, targetPosition: Position.Left },
    { id: '2', data: { label: 'Node 2' }, position: { x: 300, y: 100 }, sourcePosition: Position.Right, targetPosition: Position.Left },
  ];

  edges: Edge[] = [];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }
  log(msg: string): void { console.log(msg); }
}
```

- [ ] **Step 4: Register in app.routes.ts**

```typescript
import { TouchDeviceExampleComponent } from './examples/touch-device/touch-device.component';
```

```typescript
{ name: 'Touch device',          path: 'touch-device',          component: TouchDeviceExampleComponent },
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 6: Manual verification**

`http://localhost:4200/touch-device`. Check:
- 2 nodes render.
- Handles are noticeably larger than the default.
- Dragging from handle 1 to handle 2 creates an edge; console logs `connect start` and `connect end`.
- Open Chrome devtools → device toolbar → simulate touch; try the drag again — should still work.
- Zero console warnings.

- [ ] **Step 7: Commit**

```bash
git add examples/angular/src/app/examples/touch-device examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add touch-device example"
```

---

## Task 9: `undirectional` example

Demonstrates `ConnectionMode.Loose` (any handle can act as source or target), reconnect-on-drop, and click-to-add-node via `screenToFlowPosition`. Reference: `examples/react/src/examples/Undirectional/index.tsx` + `CustomNode.tsx`.

**Files:**
- Create: `examples/angular/src/app/examples/undirectional/undirectional.component.ts`
- Modify: `examples/angular/src/app/app.routes.ts`

- [ ] **Step 1: Read the React source**

Read `examples/react/src/examples/Undirectional/index.tsx` and `CustomNode.tsx`. Note:
- 9 custom nodes (center + 8 surrounding) wired with `smoothstep` edges.
- `connectionLineType="bezier"`, `connectionMode: ConnectionMode.Loose`.
- `onPaneClick` adds a new node at the clicked position via `screenToFlowPosition`.
- `onReconnect` uses `reconnectEdge` to rewire an edge on drop.

The custom node has 4 handles at top/right/bottom/left, each acting as both source and target (loose mode permits this).

- [ ] **Step 2: Create the custom node component (inline in the example file)**

- [ ] **Step 3: Create the Angular example component**

Create `examples/angular/src/app/examples/undirectional/undirectional.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, input, inject, Type } from '@angular/core';
import {
  NgFlowComponent,
  HandleComponent,
  ConnectionMode,
  ConnectionLineType,
  NgFlowService,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  reconnectEdge,
} from '@angflow/angular';
import type { Node, Edge, Connection } from '@angflow/angular';
import { ExampleCardComponent } from '@examples-shared/example-card.component';

@Component({
  selector: 'app-undirectional-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  host: { style: 'display: contents;' },
  template: `
    <ng-flow-handle type="source" id="top"    [position]="Position.Top" />
    <ng-flow-handle type="source" id="right"  [position]="Position.Right" />
    <ng-flow-handle type="source" id="bottom" [position]="Position.Bottom" />
    <ng-flow-handle type="source" id="left"   [position]="Position.Left" />
    <div class="und-node">{{ id() }}</div>
  `,
  styles: [`
    .und-node {
      padding: 10px 16px;
      background: #f0f9ff;
      border: 2px solid #38bdf8;
      border-radius: 6px;
      font-weight: 600;
      color: #0c4a6e;
      min-width: 32px;
      text-align: center;
    }
    :host ::ng-deep .xy-flow__handle { width: 8px; height: 8px; background: #0ea5e9; border: 2px solid #0369a1; opacity: 1; }
  `],
})
export class UndirectionalNodeComponent {
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

let nextId = 4;
const genId = () => `${nextId++}`;

@Component({
  selector: 'app-undirectional-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFlowComponent, ExampleCardComponent],
  template: `
    <app-example-card
      title="Undirected connections"
      description="ConnectionMode.Loose lets any handle be a source or target. Click the background to drop a new node at that point; drag an edge endpoint onto another handle to reconnect it."
    >
      <ng-flow
        [nodes]="nodes"
        [edges]="edges"
        [nodeTypes]="nodeTypes"
        [connectionMode]="ConnectionMode.Loose"
        [connectionLineType]="ConnectionLineType.Bezier"
        (nodesChange)="onNodesChange($event)"
        (edgesChange)="onEdgesChange($event)"
        (connect)="onConnect($event)"
        (reconnect)="onReconnect($event)"
        (paneClick)="onPaneClick($event)"
      />
    </app-example-card>
  `,
  styles: [`:host { display: flex; flex: 1; min-width: 0; min-height: 0; }`],
})
export class UndirectionalExampleComponent {
  readonly ConnectionMode = ConnectionMode;
  readonly ConnectionLineType = ConnectionLineType;

  private readonly flow = inject(NgFlowService);

  nodeTypes: Record<string, Type<unknown>> = { custom: UndirectionalNodeComponent };

  nodes: Node[] = [
    { id: '00', type: 'custom', position: { x: 300, y: 250 }, data: {} },
    { id: '01', type: 'custom', position: { x: 100, y:  50 }, data: {} },
    { id: '02', type: 'custom', position: { x: 500, y:  50 }, data: {} },
    { id: '03', type: 'custom', position: { x: 500, y: 500 }, data: {} },
    { id: '04', type: 'custom', position: { x: 100, y: 500 }, data: {} },
    { id: '10', type: 'custom', position: { x: 300, y:   5 }, data: {} },
    { id: '20', type: 'custom', position: { x: 600, y: 250 }, data: {} },
    { id: '30', type: 'custom', position: { x: 300, y: 600 }, data: {} },
    { id: '40', type: 'custom', position: { x:   5, y: 250 }, data: {} },
  ];

  edges: Edge[] = [
    { id: 'e0-1a', source: '00', target: '01', sourceHandle: 'left',   targetHandle: 'bottom', type: 'smoothstep' },
    { id: 'e0-1b', source: '00', target: '01', sourceHandle: 'top',    targetHandle: 'right',  type: 'smoothstep' },
    { id: 'e0-2a', source: '00', target: '02', sourceHandle: 'top',    targetHandle: 'left',   type: 'smoothstep' },
    { id: 'e0-2b', source: '00', target: '02', sourceHandle: 'right',  targetHandle: 'bottom', type: 'smoothstep' },
    { id: 'e0-3a', source: '00', target: '03', sourceHandle: 'right',  targetHandle: 'top',    type: 'smoothstep' },
    { id: 'e0-3b', source: '00', target: '03', sourceHandle: 'bottom', targetHandle: 'left',   type: 'smoothstep' },
    { id: 'e0-4a', source: '00', target: '04', sourceHandle: 'bottom', targetHandle: 'right',  type: 'smoothstep' },
    { id: 'e0-4b', source: '00', target: '04', sourceHandle: 'left',   targetHandle: 'top',    type: 'smoothstep' },
    { id: 'e0-10', source: '00', target: '10', sourceHandle: 'top',    targetHandle: 'bottom', type: 'smoothstep' },
    { id: 'e0-20', source: '00', target: '20', sourceHandle: 'right',  targetHandle: 'left',   type: 'smoothstep' },
    { id: 'e0-30', source: '00', target: '30', sourceHandle: 'bottom', targetHandle: 'top',    type: 'smoothstep' },
    { id: 'e0-40', source: '00', target: '40', sourceHandle: 'left',   targetHandle: 'right',  type: 'smoothstep' },
  ];

  onNodesChange(changes: any[]): void { this.nodes = applyNodeChanges(changes, this.nodes); }
  onEdgesChange(changes: any[]): void { this.edges = applyEdgeChanges(changes, this.edges); }
  onConnect(connection: Connection): void { this.edges = addEdge(connection, this.edges) as Edge[]; }

  onReconnect(event: { edge: Edge; connection: Connection }): void {
    this.edges = reconnectEdge(event.edge, event.connection, this.edges) as Edge[];
  }

  onPaneClick(event: MouseEvent): void {
    const flowPos = this.flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    this.nodes = [...this.nodes, { id: genId(), type: 'custom', position: flowPos, data: {} }];
  }
}
```

- [ ] **Step 4: Register in app.routes.ts**

```typescript
import { UndirectionalExampleComponent } from './examples/undirectional/undirectional.component';
```

```typescript
{ name: 'Undirectional',         path: 'undirectional',         component: UndirectionalExampleComponent },
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit   # packages/angular
npx tsc --noEmit -p tsconfig.json   # examples/angular
```

- [ ] **Step 6: Manual verification**

`http://localhost:4200/undirectional`. Check:
- 9 nodes render with a central node connected to all 8 others.
- Drag from any handle on any node to any handle on another → edge is created (loose mode).
- Drag an existing edge endpoint onto a different handle → edge is reconnected (not duplicated).
- Click the background → a new node appears at the clicked position.
- Zero console warnings.

- [ ] **Step 7: Commit**

```bash
git add examples/angular/src/app/examples/undirectional examples/angular/src/app/app.routes.ts
git commit -m "feat(examples/angular): add undirectional example"
```

---

## Task 10: Tier 1 wrap-up

**Files:**
- Modify: `docs/examples-parity.md`

- [ ] **Step 1: Flip parity-doc rows**

In `docs/examples-parity.md`, update the table to flip ➖ to ✅ in the Angular column for these 9 rows:

- A11y / Accessibility → `a11y`
- Cancel connection → `cancel-connection`
- Click distance → `click-distance`
- Color mode (light/dark) → `color-mode`
- Hidden nodes/edges → `hidden`
- Interaction (pan/zoom toggles) → `interaction`
- Touch device → `touch-device`
- Undirectional (source/target only) → `undirectional`
- Z-index mode → `z-index-mode`

- [ ] **Step 2: Update the summary counts at the top of the parity doc**

Change the Angular count from `17` to `26`, and adjust the sentence "Angular is missing ~46 examples that exist in React" to the new count (≈37).

- [ ] **Step 3: Final tier-level verification**

Run both type-checks:

```bash
cd packages/angular && npx tsc --noEmit
cd ../../examples/angular && npx tsc --noEmit -p tsconfig.json
```

Start the dev server and click through every Tier 1 example in order: `a11y`, `cancel-connection`, `click-distance`, `color-mode`, `hidden`, `interaction`, `touch-device`, `undirectional`, `z-index-mode`. For each:

- Component mounts without errors.
- Description panel is visible with meaningful copy.
- Primary feature works (toggle, slider, etc.).
- Browser devtools console is clean (no errors, no warnings).

- [ ] **Step 4: Record any API gaps**

If any example had to drop inputs or outputs due to missing Angular APIs (see Step 2 in Tasks 3, 7, and 8), list them in a new section at the bottom of `docs/examples-parity.md` titled "## API gaps surfaced during Tier 1", e.g.:

```markdown
## API gaps surfaced during Tier 1
- `NgFlowComponent` missing `autoPanOnNodeFocus` input — a11y example does not demo this feature until fixed.
- `NgFlowComponent` missing `clickConnectStart` / `clickConnectEnd` outputs — touch-device example uses `connectStart` / `connectEnd` as a substitute.
```

If no gaps surfaced, skip this section.

- [ ] **Step 5: Commit**

```bash
git add docs/examples-parity.md
git commit -m "docs: update examples parity doc after Tier 1 port"
```

- [ ] **Step 6: Open the PR**

From the branch `feat/custom-node-inject` (or whichever branch this work lives on):

```bash
git push -u origin HEAD
gh pr create --title "feat(examples/angular): Tier 1 example ports (9 examples)" --body "$(cat <<'EOF'
## Summary
- Ports 9 React examples to Angular: color-mode, interaction, a11y, cancel-connection, click-distance, hidden, z-index-mode, touch-device, undirectional.
- All use the existing ExampleCardComponent for the description panel.
- Parity doc updated to reflect new coverage.

Ref spec: docs/superpowers/specs/2026-04-20-examples-parity-port-design.md

## Test plan
- [ ] `npx tsc --noEmit` in packages/angular passes.
- [ ] `npx tsc --noEmit -p tsconfig.json` in examples/angular passes.
- [ ] Every ported example renders, its primary feature works, console is clean.
EOF
)"
```

---

## Self-review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Port 9 Tier 1 examples | Tasks 1–9 |
| Standard acceptance bar (compile, runtime-clean, zoneless, description panel, a11y basics) | Each task's Step 5 + Task 10 Step 3 |
| Use shared description component | Every task imports `ExampleCardComponent` |
| Per-tier PR cadence | Task 10 Step 6 |
| Update parity doc in same commit as tier | Task 10 Steps 1–2, 5 |
| Enrichment declared up-front | Description-panel copy is explicit in each task; no hidden enrichment added during port |
| Flag API gaps without silently dropping examples | Tasks 3, 7, 8 Step 2; Task 10 Step 4 |

**Placeholder scan:** Each task has the full component code, full routes entry, exact commands with expected outcomes, and explicit commit commands. Task 4 contains a correction note about a duplicated `imports` key and a pipe replacement — intentional, not a placeholder. No TBD/TODO/placeholder text.

**Type consistency:**
- Every example uses `applyNodeChanges`, `applyEdgeChanges`, `addEdge` from `@angflow/angular` — consistent.
- Every example registers a class named `<Name>ExampleComponent` in `app.routes.ts` — consistent.
- Imports in each route entry use the new component name as exported in the corresponding `.component.ts` — consistent (color-mode → `ColorModeExampleComponent`, etc.).

If the implementer finds that `zIndexMode`, `autoPanOnNodeFocus`, or `clickConnectStart`/`clickConnectEnd` aren't on `NgFlowComponent`, the affected tasks degrade gracefully per their Step 2 — don't abort the tier.
