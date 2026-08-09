# Box-Selection Auto-Pan and Activation Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing pan and zoom activation-key inputs functional, preserve pan/zoom after box selection, and automatically pan the viewport while a box selection reaches a canvas edge.

**Architecture:** Keep the D3 pan/zoom behavior attached during selection so programmatic viewport changes continue to update Angular signals. Track held activation keys in the existing document-level key directive, derive effective interaction options in `<ng-flow>`, and let `PaneComponent` own a single animation-frame auto-pan loop whose selection origin is anchored in flow coordinates.

**Tech Stack:** TypeScript, Angular signal inputs/state, D3 zoom, Vitest, jsdom, pnpm workspaces.

## Global Constraints

- Never inject `NgZone`; native events and animation-frame callbacks update the view through signal writes.
- `autoPanOnSelection` is a new `<ng-flow>` boolean input and defaults to `true`.
- Selection auto-pan uses the existing 40-pixel `calcAutoPan()` edge zone and existing `autoPanSpeed`; do not add a second speed or edge-width input.
- Activation matching accepts both `KeyboardEvent.key` and `KeyboardEvent.code`; arrays remain alternative keys, not key combinations.
- A pan activation key changes the next pointer gesture only; it does not transfer ownership of a gesture already in progress.
- Keep `SelectionMode.Full` and `SelectionMode.Partial`, non-selectable-node filtering, zoom scaling, and `translateExtent` behavior unchanged.
- Add no new outputs and no new `@angflow/system` public types.
- Use “box selection” in new user-facing documentation and test descriptions.
- Preserve the user-owned untracked `.agents/` directory and root `AGENTS.md`.

---

## File map

- `packages/system/src/xypanzoom/XYPanZoom.ts` — retain D3 listeners and transform callbacks while user selection is active.
- `packages/system/src/xypanzoom/XYPanZoom.spec.ts` — pin listener retention, programmatic transforms, and real lifecycle teardown.
- `packages/angular/src/lib/services/flow-store.service.ts` — hold activation-key and selection-auto-pan state, reset transient key state, and expose all three values through the store snapshot.
- `packages/angular/src/lib/types/store.ts` — declare the new booleans in `FlowStoreState`.
- `packages/angular/src/lib/directives/key-handler.directive.ts` — match key/code values and manage held pan/zoom activation state.
- `packages/angular/src/lib/directives/key-handler.directive.spec.ts` — cover keydown, keyup, editable targets, null inputs, blur, context menu, and default prevention.
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` — wire key inputs, derive effective gesture options, expose/sync `autoPanOnSelection`, and forward everything to pane/D3.
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts` — verify effective pan/selection/zoom options and public auto-pan wiring.
- `packages/angular/src/lib/container/pane/pane.component.ts` — anchor selection in flow coordinates and own auto-pan scheduling/cleanup.
- `packages/angular/src/lib/container/pane/pane.auto-pan.spec.ts` — test geometry, continuous edge pan, selection updates, constraints, pointer types, and cleanup.
- `packages/angular/src/lib/container/pane/pane.selection-target-guard.spec.ts` — keep existing target-ownership regression coverage passing.
- `examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts` — expose the new public input in the interactive settings harness.

---

### Task 1: Preserve XYPanZoom during box selection

**Files:**
- Create: `packages/system/src/xypanzoom/XYPanZoom.spec.ts`
- Modify: `packages/system/src/xypanzoom/XYPanZoom.ts:111-113`

**Interfaces:**
- Consumes: existing `XYPanZoom(params): PanZoomInstance` and `PanZoomInstance.update(PanZoomUpdateOptions)`.
- Produces: unchanged public interfaces; `update({ userSelectionActive: true })` no longer tears down the instance.

- [ ] **Step 1: Write the failing listener and transform regression tests**

Create a real jsdom element and inspect D3’s namespaced listener registry only inside the test:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PanOnScrollMode, type CoordinateExtent, type PanZoomUpdateOptions } from '../types';
import { XYPanZoom } from './XYPanZoom';

const extent: CoordinateExtent = [
  [-Infinity, -Infinity],
  [Infinity, Infinity],
];

function zoomListenerTypes(node: HTMLElement): string[] {
  const listeners = (node as HTMLElement & {
    __on?: Array<{ type: string; name: string }>;
  }).__on ?? [];
  return listeners
    .filter(({ name }) => name === 'zoom')
    .map(({ type }) => type)
    .sort();
}

function updateOptions(
  onTransformChange: PanZoomUpdateOptions['onTransformChange'],
  overrides: Partial<PanZoomUpdateOptions> = {}
): PanZoomUpdateOptions {
  return {
    noWheelClassName: 'nowheel',
    noPanClassName: 'nopan',
    preventScrolling: true,
    panOnScroll: false,
    panOnDrag: true,
    panOnScrollMode: PanOnScrollMode.Free,
    panOnScrollSpeed: 0.5,
    userSelectionActive: false,
    zoomOnPinch: true,
    zoomOnScroll: true,
    zoomOnDoubleClick: true,
    lib: 'ng',
    onTransformChange,
    paneClickDistance: 0,
    selectionOnDrag: true,
    ...overrides,
  };
}

function setup() {
  const domNode = document.createElement('div');
  vi.spyOn(domNode, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600,
    width: 800, height: 600, toJSON: () => ({}),
  });
  const onTransformChange = vi.fn();
  const panZoom = XYPanZoom({
    domNode,
    minZoom: 0.5,
    maxZoom: 2,
    translateExtent: extent,
    viewport: { x: 0, y: 0, zoom: 1 },
    onDraggingChange: vi.fn(),
  });
  panZoom.update(updateOptions(onTransformChange));
  return { domNode, onTransformChange, panZoom };
}

describe('XYPanZoom selection lifecycle', () => {
  it('keeps D3 DOM listeners attached while box selection is active', () => {
    const { domNode, panZoom } = setup();
    const before = zoomListenerTypes(domNode);
    expect(before).toContain('mousedown');
    expect(before).toContain('wheel');

    panZoom.update(updateOptions(vi.fn(), { userSelectionActive: true }));

    expect(zoomListenerTypes(domNode)).toEqual(before);
  });

  it('propagates programmatic transforms during box selection', async () => {
    const { onTransformChange, panZoom } = setup();
    panZoom.update(updateOptions(onTransformChange, { userSelectionActive: true }));

    await panZoom.setViewport({ x: 25, y: 30, zoom: 1 });

    expect(onTransformChange).toHaveBeenLastCalledWith([25, 30, 1]);
  });

  it('removes all D3 zoom listeners on real destroy', () => {
    const { domNode, panZoom } = setup();
    panZoom.destroy();
    expect(zoomListenerTypes(domNode)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused system test and confirm the regression**

Run:

```bash
pnpm -F @angflow/system exec vitest run src/xypanzoom/XYPanZoom.spec.ts
```

Expected: the active-selection listener test fails because `mousedown.zoom` and touch listeners disappear; the programmatic-transform assertion also exposes the missing callback path.

- [ ] **Step 3: Remove selection-triggered lifecycle teardown**

Delete only this branch from `XYPanZoom.update()`:

```ts
if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) {
  destroy();
}
```

Retain `destroy()` itself and all existing filter logic. Do not add reattachment logic.

- [ ] **Step 4: Run the focused test and system checks**

Run:

```bash
pnpm -F @angflow/system exec vitest run src/xypanzoom/XYPanZoom.spec.ts
pnpm -F @angflow/system run typecheck
pnpm -F @angflow/system run lint
```

Expected: all commands pass.

- [ ] **Step 5: Commit the system regression fix**

```bash
git add packages/system/src/xypanzoom/XYPanZoom.ts packages/system/src/xypanzoom/XYPanZoom.spec.ts
git commit -m "fix(system): preserve pan zoom during box selection"
```

---

### Task 2: Track pan and zoom activation keys

**Files:**
- Modify: `packages/angular/src/lib/services/flow-store.service.ts:141-156,207-210,990-1002,1043-1070`
- Modify: `packages/angular/src/lib/types/store.ts:46-55,94-98`
- Modify: `packages/angular/src/lib/services/flow-store.service.spec.ts`
- Modify: `packages/angular/src/lib/directives/key-handler.directive.ts`
- Modify: `packages/angular/src/lib/directives/key-handler.directive.spec.ts`

**Interfaces:**
- Produces: `FlowStore.panActivationKeyActive: WritableSignal<boolean>`, `FlowStore.zoomActivationKeyActive: WritableSignal<boolean>`, and `FlowStore.autoPanOnSelection: WritableSignal<boolean>`.
- Produces: directive inputs `panActivationKeyCode` and `zoomActivationKeyCode`, both `input<KeyCode | null>`.
- Produces: `matchesKey(event, configured)` semantics that compare every configured alternative with both `event.key` and `event.code`.

- [ ] **Step 1: Add failing store-state tests**

In `flow-store.service.spec.ts`, assert that the new state is present and snapshotted, transient key state resets, and configuration is retained:

```ts
it('snapshots activation-key and selection-auto-pan state', () => {
  store.panActivationKeyActive.set(true);
  store.zoomActivationKeyActive.set(true);
  store.autoPanOnSelection.set(false);

  expect(store.getStoreItems()).toMatchObject({
    panActivationKeyActive: true,
    zoomActivationKeyActive: true,
    autoPanOnSelection: false,
  });

  store.reset();

  expect(store.panActivationKeyActive()).toBe(false);
  expect(store.zoomActivationKeyActive()).toBe(false);
  // Configuration is retained across graph reset, matching the other
  // auto-pan options; the NgFlow input remains its source of truth.
  expect(store.autoPanOnSelection()).toBe(false);
});
```

- [ ] **Step 2: Run the store test and verify it fails on missing signals**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/services/flow-store.service.spec.ts
```

Expected: TypeScript/runtime failure because the three signals do not exist.

- [ ] **Step 3: Add the signals, snapshot fields, state type, and transient-key reset behavior**

Add these writable signals beside existing selection and auto-pan state:

```ts
readonly panActivationKeyActive = signal(false);
readonly zoomActivationKeyActive = signal(false);
readonly autoPanOnSelection = signal(true);
```

Add `panActivationKeyActive`, `zoomActivationKeyActive`, and `autoPanOnSelection` to `getStoreItems()`. Add matching `boolean` fields to `FlowStoreState`. In `reset()`, restore only the transient activation-key signals to `false`; retain `autoPanOnSelection` like the existing auto-pan configuration signals.

- [ ] **Step 4: Run the store test and verify it passes**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/services/flow-store.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Add failing directive tests for activation-key behavior**

Extend the test host and use the existing `setSignalInput()` pattern to cover these exact cases:

```ts
it('tracks the default literal-space pan key and prevents page scrolling', () => {
  const down = new KeyboardEvent('keydown', {
    key: ' ', code: 'Space', cancelable: true,
  });
  directive.onKeyDown(down);
  expect(store.panActivationKeyActive()).toBe(true);
  expect(down.defaultPrevented).toBe(true);

  directive.onKeyUp(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));
  expect(store.panActivationKeyActive()).toBe(false);
});

it('matches a configured Space value through KeyboardEvent.code', () => {
  setSignalInput(directive, 'panActivationKeyCode', 'Space');
  directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
  expect(store.panActivationKeyActive()).toBe(true);
});

it('treats activation-key arrays as alternatives', () => {
  setSignalInput(directive, 'panActivationKeyCode', ['Space', 'KeyP']);
  directive.onKeyDown(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP' }));
  expect(store.panActivationKeyActive()).toBe(true);
});

it('tracks and releases the zoom activation key', () => {
  directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft' }));
  expect(store.zoomActivationKeyActive()).toBe(true);
  directive.onKeyUp(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }));
  expect(store.zoomActivationKeyActive()).toBe(false);
});

it('ignores activation keys from editable targets', () => {
  const input = document.createElement('input');
  const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
  Object.defineProperty(event, 'target', { value: input });
  directive.onKeyDown(event);
  expect(store.panActivationKeyActive()).toBe(false);
});

it('honors null activation inputs', () => {
  setSignalInput(directive, 'panActivationKeyCode', null);
  setSignalInput(directive, 'zoomActivationKeyCode', null);
  directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
  directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft' }));
  expect(store.panActivationKeyActive()).toBe(false);
  expect(store.zoomActivationKeyActive()).toBe(false);
});

it('clears every held modifier on blur and context menu', () => {
  directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Shift' }));
  directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta' }));
  directive.onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
  directive.onWindowBlur();
  expect(store.selectionKeyActive()).toBe(false);
  expect(store.multiSelectionActive()).toBe(false);
  expect(store.panActivationKeyActive()).toBe(false);
  expect(store.zoomActivationKeyActive()).toBe(false);

  directive.onKeyDown(new KeyboardEvent('keydown', { key: 'Meta' }));
  directive.onContextMenu();
  expect(store.multiSelectionActive()).toBe(false);
  expect(store.zoomActivationKeyActive()).toBe(false);
});
```

- [ ] **Step 6: Run the directive test and verify the new cases fail**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/directives/key-handler.directive.spec.ts
```

Expected: failures for missing inputs/state, `Space` code matching, and cleanup.

- [ ] **Step 7: Implement key/code matching and held-state cleanup**

Add directive inputs and host cleanup:

```ts
readonly panActivationKeyCode = input<KeyCode | null>(' ');
readonly zoomActivationKeyCode = input<KeyCode | null>('Meta');

host: {
  '(document:keydown)': 'onKeyDown($event)',
  '(document:keyup)': 'onKeyUp($event)',
  '(document:contextmenu)': 'onContextMenu()',
  '(window:blur)': 'onWindowBlur()',
},
```

Use one matcher for existing and new shortcuts:

```ts
private matchesKey(event: KeyboardEvent, keyCode: KeyCode | null): boolean {
  if (keyCode === null) return false;
  const alternatives = Array.isArray(keyCode) ? keyCode : [keyCode];
  return alternatives.some((value) => value === event.key || value === event.code);
}
```

On activation-key `keydown`, set the corresponding store signal and call `event.preventDefault()`. On matching `keyup`, clear it. Replace the current blur-only branch logic with a private `resetHeldKeys()` that clears selection, multi-selection, pan activation, and zoom activation state; call it from both `onWindowBlur()` and `onContextMenu()`. Keep the editable-target return at the start of `onKeyDown()` and do not add it to `onKeyUp()`.

- [ ] **Step 8: Run focused Angular tests, typecheck, and lint**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/services/flow-store.service.spec.ts src/lib/directives/key-handler.directive.spec.ts
pnpm -F @angflow/angular run typecheck
pnpm -F @angflow/angular run lint
```

Expected: all commands pass.

- [ ] **Step 9: Commit activation-key state**

```bash
git add packages/angular/src/lib/types/store.ts packages/angular/src/lib/services/flow-store.service.ts packages/angular/src/lib/services/flow-store.service.spec.ts packages/angular/src/lib/directives/key-handler.directive.ts packages/angular/src/lib/directives/key-handler.directive.spec.ts
git commit -m "feat(angular): track pan and zoom activation keys"
```

---

### Task 3: Wire effective interaction options through NgFlowComponent

**Files:**
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts:180-199,390-470,760-780,840-860,1143-1162`
- Modify: `packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts`

**Interfaces:**
- Consumes: the three store signals from Task 2.
- Produces: `effectivePanOnDrag`, `effectivePanOnScroll`, and `effectiveSelectionOnDrag` computed signals used by both the pane and `XYPanZoom.update()`.
- Produces: public `autoPanOnSelection = input(true)` and pane inputs `autoPanOnSelection`/`autoPanSpeed`.

- [ ] **Step 1: Add failing NgFlow interaction-wiring tests**

Add a helper to query `PaneComponent`, then assert both pane inputs and the last D3 update call:

```ts
import { By } from '@angular/platform-browser';
import { PaneComponent } from '../pane/pane.component';

it('uses the held pan key for the next pan gesture instead of box selection', () => {
  const fixture = TestBed.createComponent(NgFlowComponent);
  const inst = fixture.componentInstance;
  setSignalInput(inst, 'panOnDrag', false);
  setSignalInput(inst, 'panOnScroll', false);
  setSignalInput(inst, 'selectionOnDrag', true);
  fixture.detectChanges();
  const panZoom = inst.store.panZoom()!;
  const update = vi.spyOn(panZoom, 'update');

  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: ' ', code: 'Space', bubbles: true, cancelable: true,
  }));
  fixture.detectChanges();

  const pane = fixture.debugElement.query(By.directive(PaneComponent))
    .componentInstance as PaneComponent;
  expect(pane.panOnDrag()).toBe(true);
  expect(pane.selectionOnDrag()).toBe(false);
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
    panOnDrag: true,
    panOnScroll: true,
    selectionOnDrag: false,
  }));
});

it('forwards zoom activation and restores configured options on keyup', () => {
  const fixture = TestBed.createComponent(NgFlowComponent);
  const inst = fixture.componentInstance;
  setSignalInput(inst, 'zoomOnScroll', false);
  fixture.detectChanges();
  const update = vi.spyOn(inst.store.panZoom()!, 'update');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', bubbles: true }));
  fixture.detectChanges();
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
    zoomActivationKeyPressed: true,
  }));

  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta', bubbles: true }));
  fixture.detectChanges();
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
    zoomActivationKeyPressed: false,
  }));
});

it('syncs and forwards selection auto-pan configuration', () => {
  const fixture = TestBed.createComponent(NgFlowComponent);
  const inst = fixture.componentInstance;
  setSignalInput(inst, 'autoPanOnSelection', false);
  setSignalInput(inst, 'autoPanSpeed', 9);
  fixture.detectChanges();

  const pane = fixture.debugElement.query(By.directive(PaneComponent))
    .componentInstance as PaneComponent;
  expect(inst.store.autoPanOnSelection()).toBe(false);
  expect(pane.autoPanOnSelection()).toBe(false);
  expect(pane.autoPanSpeed()).toBe(9);
});

it('does not switch ownership of a box selection already in progress', () => {
  const fixture = TestBed.createComponent(NgFlowComponent);
  const inst = fixture.componentInstance;
  setSignalInput(inst, 'panOnDrag', false);
  setSignalInput(inst, 'selectionOnDrag', true);
  fixture.detectChanges();
  const pane = fixture.debugElement.query(By.directive(PaneComponent));

  pane.nativeElement.dispatchEvent(new MouseEvent('pointerdown', {
    button: 0, clientX: 40, clientY: 40, bubbles: true, cancelable: true,
  }));
  expect(inst.store.userSelectionActive()).toBe(true);

  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: ' ', code: 'Space', bubbles: true, cancelable: true,
  }));
  fixture.detectChanges();
  expect(inst.store.userSelectionActive()).toBe(true);

  document.dispatchEvent(new MouseEvent('pointerup', {
    button: 0, clientX: 60, clientY: 60, bubbles: true,
  }));
  pane.nativeElement.dispatchEvent(new MouseEvent('pointerdown', {
    button: 0, clientX: 70, clientY: 70, bubbles: true, cancelable: true,
  }));
  expect(inst.store.userSelectionActive()).toBe(false);
});
```

- [ ] **Step 2: Run the focused component test and verify failure**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/container/ng-flow/ng-flow.component.spec.ts
```

Expected: missing pane inputs and missing key-derived `XYPanZoom.update()` options cause failures.

- [ ] **Step 3: Wire the directive, computed effective options, and auto-pan inputs**

Add these template bindings:

```html
[panActivationKeyCode]="panActivationKeyCode()"
[zoomActivationKeyCode]="zoomActivationKeyCode()"
```

Pass effective and auto-pan values to the pane:

```html
[panOnDrag]="effectivePanOnDrag()"
[selectionOnDrag]="effectiveSelectionOnDrag()"
[autoPanOnSelection]="autoPanOnSelection()"
[autoPanSpeed]="autoPanSpeed()"
```

Add the public input and computed values:

```ts
readonly autoPanOnSelection = input(true);

protected readonly effectivePanOnDrag = computed<boolean | number[]>(
  () => this.store.panActivationKeyActive() || this.panOnDrag()
);
protected readonly effectivePanOnScroll = computed(
  () => this.store.panActivationKeyActive() || this.panOnScroll()
);
protected readonly effectiveSelectionOnDrag = computed(
  () => !this.store.panActivationKeyActive() && this.selectionOnDrag()
);
```

Sync `autoPanOnSelection` in the configuration effect. In the pan/zoom effect, read the effective computed values plus `store.zoomActivationKeyActive()` so changes retrigger the effect. Forward the values exactly:

```ts
this.panZoomInstance?.update({
  panOnDrag: this.effectivePanOnDrag(),
  panOnScroll: this.effectivePanOnScroll(),
  panOnScrollMode: this.panOnScrollMode(),
  panOnScrollSpeed: this.panOnScrollSpeed(),
  zoomOnScroll: this.zoomOnScroll(),
  zoomOnPinch: this.zoomOnPinch(),
  zoomOnDoubleClick: this.zoomOnDoubleClick(),
  selectionOnDrag: this.effectiveSelectionOnDrag(),
  zoomActivationKeyPressed: this.store.zoomActivationKeyActive(),
  preventScrolling: this.preventScrolling(),
  noPanClassName: this.noPanClassName(),
  noWheelClassName: this.noWheelClassName(),
  userSelectionActive: this.store.userSelectionActive(),
  lib: 'ng',
  onTransformChange: (transform: Transform) => {
    this.store.transform.set(transform);
  },
  paneClickDistance: this.paneClickDistance(),
});
```

Do not inspect activation state inside `PaneComponent.shouldStartSelectionFor()`; locking gesture ownership comes from the effective `selectionOnDrag` value present at pointerdown and the component’s existing `isSelecting` state thereafter.

- [ ] **Step 4: Run NgFlow, key-handler, and target-guard tests**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/container/ng-flow/ng-flow.component.spec.ts src/lib/directives/key-handler.directive.spec.ts src/lib/container/pane/pane.selection-target-guard.spec.ts
pnpm -F @angflow/angular run typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit component wiring**

```bash
git add packages/angular/src/lib/container/ng-flow/ng-flow.component.ts packages/angular/src/lib/container/ng-flow/ng-flow.component.spec.ts
git commit -m "feat(angular): wire canvas activation keys"
```

---

### Task 4: Auto-pan while box selection continues

**Files:**
- Modify: `packages/angular/src/lib/container/pane/pane.component.ts`
- Create: `packages/angular/src/lib/container/pane/pane.auto-pan.spec.ts`
- Verify unchanged: `packages/angular/src/lib/container/pane/pane.selection-target-guard.spec.ts`

**Interfaces:**
- Consumes: `calcAutoPan(position, bounds, speed)`, `pointToRendererPoint(screenPoint, transform)`, `rendererPointToPoint(flowPoint, transform)`, and `FlowStore.panBy(delta): Promise<boolean>`.
- Produces: pane inputs `autoPanOnSelection = input(true)` and `autoPanSpeed = input(15)`.
- Produces: one private selection update function shared by pointermove and post-pan refresh, plus one cancellable animation-frame loop.

- [ ] **Step 1: Create failing geometry and auto-pan tests**

Use a deterministic requestAnimationFrame harness and synthetic pointer helper:

```ts
let nextFrameId = 1;
let frames = new Map<number, FrameRequestCallback>();

function installFrameHarness() {
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
}

async function flushFrame(): Promise<void> {
  const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!entry) throw new Error('Expected a scheduled animation frame');
  frames.delete(entry[0]);
  entry[1](performance.now());
  await Promise.resolve();
  await Promise.resolve();
}

function pointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  values: { x: number; y: number; id?: number; pointerType?: string }
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: values.x },
    clientY: { value: values.y },
    button: { value: 0 },
    isPrimary: { value: true },
    pointerId: { value: values.id ?? 1 },
    pointerType: { value: values.pointerType ?? 'mouse' },
  });
  return event;
}
```

Set the flow container bounds to `200x200`, enable `selectionOnDrag`, call `initSelectionListener()`, and mock `store.panBy()` to apply deltas to `store.transform`. Add these exact behaviors:

```ts
it.each([
  [{ x: 2, y: 100 }, { x: 1, y: 0 }],
  [{ x: 198, y: 100 }, { x: -1, y: 0 }],
  [{ x: 100, y: 2 }, { x: 0, y: 1 }],
  [{ x: 100, y: 198 }, { x: 0, y: -1 }],
])('pans in the expected direction at each edge', async (pointer, direction) => {
  startSelectionAt(100, 100);
  moveSelectionTo(pointer.x, pointer.y);
  await flushFrame();
  const delta = vi.mocked(store.panBy).mock.calls[0][0];
  expect(Math.sign(delta.x)).toBe(direction.x);
  expect(Math.sign(delta.y)).toBe(direction.y);
});

it('keeps panning while the pointer is stationary at an edge', async () => {
  startSelectionAt(100, 100);
  moveSelectionTo(198, 100);
  await flushFrame();
  await flushFrame();
  expect(store.panBy).toHaveBeenCalledTimes(2);
});

it('keeps the origin fixed in flow space while the viewport pans', async () => {
  store.transform.set([20, 10, 2]);
  startSelectionAt(120, 110); // flow origin = (50, 50)
  moveSelectionTo(198, 150);
  await flushFrame();
  const rect = store.userSelectionRect()!;
  const [tx, ty, zoom] = store.transform();
  expect(rect.startX).toBeCloseTo(50 * zoom + tx);
  expect(rect.startY).toBeCloseTo(50 * zoom + ty);
});

it('selects a node revealed by auto-pan without another pointermove', async () => {
  store.setNodes([{
    id: 'revealed', position: { x: 202, y: 90 },
    measured: { width: 6, height: 10 }, data: {},
  }]);
  startSelectionAt(100, 80);
  moveSelectionTo(198, 120);
  await flushFrame();
  expect(store.selectedNodes().map(({ id }) => id)).toContain('revealed');
});

it('does not pan when selection auto-pan is disabled', async () => {
  setSignalInput(pane, 'autoPanOnSelection', false);
  startSelectionAt(100, 100);
  moveSelectionTo(198, 100);
  expect(frames.size).toBe(0);
  expect(store.panBy).not.toHaveBeenCalled();
});

it('keeps selection active when translate extent rejects movement', async () => {
  vi.mocked(store.panBy).mockResolvedValue(false);
  startSelectionAt(100, 100);
  moveSelectionTo(198, 100);
  await flushFrame();
  expect(store.userSelectionActive()).toBe(true);
  expect(frames.size).toBe(1);
});

it('cancels the frame and clears transient state on pointercancel', () => {
  const selectionEnd = vi.fn();
  pane.selectionEnd.subscribe(selectionEnd);
  startSelectionAt(100, 100, 'pen');
  moveSelectionTo(198, 100, 'pen');
  document.dispatchEvent(pointerEvent('pointercancel', {
    x: 198, y: 100, pointerType: 'pen',
  }));
  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
  expect(store.userSelectionActive()).toBe(false);
  expect(store.userSelectionRect()).toBeNull();
  expect(selectionEnd).toHaveBeenCalledOnce();
});

it('preserves Full and Partial selection semantics', () => {
  store.setNodes([{
    id: 'overlap', position: { x: 90, y: 90 },
    measured: { width: 30, height: 30 }, data: {},
  }]);
  setSignalInput(pane, 'selectionMode', SelectionMode.Full);
  startSelectionAt(100, 100);
  moveSelectionTo(130, 130);
  expect(store.selectedNodes()).toHaveLength(0);
  endSelectionAt(130, 130);

  setSignalInput(pane, 'selectionMode', SelectionMode.Partial);
  startSelectionAt(100, 100);
  moveSelectionTo(130, 130);
  expect(store.selectedNodes().map(({ id }) => id)).toEqual(['overlap']);
});

it('never selects nodes whose selectable flag is false', () => {
  store.setNodes([{
    id: 'locked', position: { x: 110, y: 110 }, selectable: false,
    measured: { width: 10, height: 10 }, data: {},
  }]);
  startSelectionAt(100, 100);
  moveSelectionTo(130, 130);
  expect(store.selectedNodes()).toHaveLength(0);
});

it('stops viewport movement when the pointer returns to the center', async () => {
  startSelectionAt(100, 100);
  moveSelectionTo(198, 100);
  await flushFrame();
  vi.mocked(store.panBy).mockClear();
  moveSelectionTo(100, 100);
  await flushFrame();
  expect(store.panBy).toHaveBeenLastCalledWith({ x: 0, y: 0 });
});

it.each(['mouse', 'touch', 'pen'])('uses the same selection path for %s', (pointerType) => {
  startSelectionAt(80, 80, pointerType);
  moveSelectionTo(120, 120, pointerType);
  expect(store.userSelectionActive()).toBe(true);
  endSelectionAt(120, 120, pointerType);
  expect(store.userSelectionActive()).toBe(false);
});
```

Define `startSelectionAt`, `moveSelectionTo`, and `endSelectionAt` as thin wrappers around `pointerEvent()` and `dispatchEvent()`. For cleanup, spy on `document.addEventListener`/`removeEventListener` and assert pointerup, pointercancel, and `fixture.destroy()` remove the exact registered pointermove/up/cancel callbacks; destruction must not emit `selectionEnd`, while pointerup and pointercancel emit it once.

- [ ] **Step 2: Run the pane tests and verify the missing behavior**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/container/pane/pane.auto-pan.spec.ts src/lib/container/pane/pane.selection-target-guard.spec.ts
```

Expected: the new file fails because the pane inputs, flow-coordinate origin, animation-frame loop, and pointercancel cleanup do not exist.

- [ ] **Step 3: Anchor the selection origin and centralize selection recomputation**

Import the existing utilities and add gesture state:

```ts
import {
  calcAutoPan,
  getNodesInside,
  pointToRendererPoint,
  rendererPointToPoint,
  SelectionMode,
  type KeyCode,
  type XYPosition,
} from '@angflow/system';

readonly autoPanOnSelection = input(true);
readonly autoPanSpeed = input(15);

private selectionOrigin: XYPosition | null = null;
private pointerPosition: XYPosition | null = null;
private autoPanFrameId: number | null = null;
private boundOnPointerCancel: ((event: PointerEvent) => void) | null = null;
```

At pointerdown, convert the container-relative screen point using the current transform:

```ts
this.pointerPosition = {
  x: event.clientX - bounds.left,
  y: event.clientY - bounds.top,
};
this.selectionOrigin = pointToRendererPoint(
  this.pointerPosition,
  this.store.transform()
);
```

Replace duplicated pointermove geometry with this private method:

```ts
private updateSelectionFromPointer(): void {
  if (!this.selectionOrigin || !this.pointerPosition) return;
  const start = rendererPointToPoint(this.selectionOrigin, this.store.transform());
  const current = this.pointerPosition;
  const selectionRect = {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
    startX: start.x,
    startY: start.y,
  };
  this.store.userSelectionRect.set(selectionRect);
  const nodesInside = getNodesInside(
    this.store.nodeLookup,
    selectionRect,
    this.store.transform(),
    this.selectionMode() === SelectionMode.Partial,
    true
  );
  this.store.addSelectedNodes(nodesInside.map(({ id }) => id));
}
```

Pointermove updates `pointerPosition`, marks `selectionInProgress` on the first movement, calls `updateSelectionFromPointer()`, and schedules auto-pan.

- [ ] **Step 4: Implement a single in-flight auto-pan loop**

Use the latest signal/input values on every frame:

```ts
private scheduleAutoPan(): void {
  if (
    this.autoPanFrameId !== null ||
    !this.isSelecting ||
    !this.moved ||
    !this.autoPanOnSelection()
  ) return;
  this.autoPanFrameId = requestAnimationFrame(() => {
    this.autoPanFrameId = null;
    void this.runAutoPanFrame();
  });
}

private async runAutoPanFrame(): Promise<void> {
  if (!this.isSelecting || !this.pointerPosition || !this.autoPanOnSelection()) return;
  const container = this.store.domNode();
  if (!container) return;
  const [x, y] = calcAutoPan(
    this.pointerPosition,
    container.getBoundingClientRect(),
    this.autoPanSpeed()
  );
  const moved = await this.store.panBy({ x, y });
  if (!this.isSelecting) return;
  if (moved) this.updateSelectionFromPointer();
  this.scheduleAutoPan();
}
```

This deliberately awaits `panBy()` before scheduling another frame. A zero delta or constrained `false` result remains non-fatal; the active gesture continues and later frames observe pointer/configuration changes.

- [ ] **Step 5: Centralize pointerup, pointercancel, and destroy cleanup**

Register both document end events at pointerdown and route them through the existing pointer-id guard to one idempotent method:

```ts
this.boundOnPointerMove = (event) => this.onPointerMove(event);
this.boundOnPointerUp = (event) => this.onPointerEnd(event);
this.boundOnPointerCancel = (event) => this.onPointerEnd(event);
document.addEventListener('pointermove', this.boundOnPointerMove);
document.addEventListener('pointerup', this.boundOnPointerUp);
document.addEventListener('pointercancel', this.boundOnPointerCancel);

private onPointerEnd(event: PointerEvent): void {
  if (!this.isSelecting) return;
  if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
  this.finishSelection(event, true);
}
```

Use this cleanup implementation:

```ts
private finishSelection(event: PointerEvent | null, emitEnd: boolean): void {
  if (!this.isSelecting && this.activePointerId === null) return;
  const moved = this.moved;
  this.isSelecting = false;
  if (this.autoPanFrameId !== null) {
    cancelAnimationFrame(this.autoPanFrameId);
    this.autoPanFrameId = null;
  }
  if (this.activePointerId !== null) {
    try {
      this.el.nativeElement.releasePointerCapture(this.activePointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  }
  if (this.boundOnPointerMove) {
    document.removeEventListener('pointermove', this.boundOnPointerMove);
    this.boundOnPointerMove = null;
  }
  if (this.boundOnPointerUp) {
    document.removeEventListener('pointerup', this.boundOnPointerUp);
    this.boundOnPointerUp = null;
  }
  if (this.boundOnPointerCancel) {
    document.removeEventListener('pointercancel', this.boundOnPointerCancel);
    this.boundOnPointerCancel = null;
  }
  this.activePointerId = null;
  this.selectionOrigin = null;
  this.pointerPosition = null;
  this.store.userSelectionActive.set(false);
  this.store.userSelectionRect.set(null);
  if (moved && (!event || event.type === 'pointercancel' || event.pointerType !== 'mouse')) {
    this.store.selectionInProgress.set(false);
  }
  if (this.store.selectedNodes().length > 0) {
    this.store.nodesSelectionActive.set(true);
  }
  if (event && emitEnd) this.selectionEnd.emit(event);
}
```

Call `finishSelection(event, true)` from pointerup and pointercancel, and `finishSelection(null, false)` from `ngOnDestroy()` before removing the native pane listeners. An auto-pan promise that resolves after cleanup must hit the `!this.isSelecting` guard and neither update selection nor schedule a frame.

- [ ] **Step 6: Run all pane tests, then Angular typecheck and lint**

Run:

```bash
pnpm -F @angflow/angular exec vitest run src/lib/container/pane/pane.auto-pan.spec.ts src/lib/container/pane/pane.selection-target-guard.spec.ts src/lib/container/ng-flow/ng-flow.component.spec.ts
pnpm -F @angflow/angular run typecheck
pnpm -F @angflow/angular run lint
```

Expected: all commands pass with no Zone.js dependency.

- [ ] **Step 7: Commit selection auto-pan**

```bash
git add packages/angular/src/lib/container/pane/pane.component.ts packages/angular/src/lib/container/pane/pane.auto-pan.spec.ts
git commit -m "feat(angular): auto-pan during box selection"
```

---

### Task 5: Surface the option in the Angular example and verify the full change

**Files:**
- Modify: `examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts:55-70,140-155,208-218,270-285,450-470`

**Interfaces:**
- Consumes: `<ng-flow [autoPanOnSelection]="boolean">` from Task 3.
- Produces: a kitchen-sink checkbox that can disable selection auto-pan independently while retaining the shared speed control.

- [ ] **Step 1: Add the new setting, binding, and control**

Update the settings interface/default/category:

```ts
autoPanOnSelection: boolean;

autoPanOnSelection: true,

AutoPan: [
  'autoPanOnNodeDrag',
  'autoPanOnConnect',
  'autoPanOnSelection',
  'autoPanSpeed',
  'nodeDragThreshold',
],
```

Bind it on the kitchen-sink `<ng-flow>`:

```html
[autoPanOnSelection]="settings().autoPanOnSelection"
```

Add a checkbox next to the existing auto-pan toggles:

```html
<label class="ctrl ctrl--check">
  <span class="ctrl__label">autoPanOnSelection</span>
  <input
    type="checkbox"
    [checked]="settings().autoPanOnSelection"
    (change)="set('autoPanOnSelection', $any($event.target).checked)"
  />
</label>
```

- [ ] **Step 2: Build the library packages and Angular example**

Run in dependency order:

```bash
pnpm -F @angflow/system run build
pnpm -F @angflow/angular run build
pnpm -F angular-examples run build
```

Expected: all builds pass and the example template type-checks the new input.

- [ ] **Step 3: Run the complete relevant test and static-check suite**

Run:

```bash
pnpm -F @angflow/system run test
pnpm -F @angflow/angular run test
pnpm -F @angflow/system run typecheck
pnpm -F @angflow/angular run typecheck
pnpm -F @angflow/system run lint
pnpm -F @angflow/angular run lint
```

Expected: every command exits successfully. No MCP schema regeneration is needed because the agent tool catalog is unchanged.

- [ ] **Step 4: Perform the interaction smoke check**

Run:

```bash
pnpm -F angular-examples run dev
```

In the kitchen sink, verify these concrete sequences:

1. Enable `selectionOnDrag`, drag a box to each canvas edge, hold the pointer still, and confirm the viewport continues panning while newly revealed nodes join the box selection.
2. Release the pointer and immediately drag the empty pane; drag-pan still works.
3. Disable `panOnDrag` and `panOnScroll`, hold Space, and start a new gesture; the new gesture pans. Pressing Space after a box selection has already started does not convert that gesture.
4. Disable `zoomOnScroll`, hold Meta/Control as configured, and use the wheel; the viewport zooms.
5. Disable `autoPanOnSelection`; edge box selection no longer moves the viewport.
6. Repeat box selection with touch or pen input if the test device exposes it.

Stop the dev server after the smoke check.

- [ ] **Step 5: Commit the example coverage**

```bash
git add examples/angular/src/app/kitchen-sink/kitchen-sink.component.ts
git commit -m "docs(example): expose selection auto-pan control"
```

---

## Final review checklist

- [ ] Compare every behavior and out-of-scope item with `docs/superpowers/specs/2026-08-09-selection-auto-pan-and-activation-keys-design.md`.
- [ ] Confirm `git diff --check` is clean and `git status --short` contains no accidental changes to `.agents/` or root `AGENTS.md`.
- [ ] Confirm no production code injects `NgZone` and every native/animation callback updates template state only through signals.
- [ ] Confirm the implementation does not add key-combination parsing, a configurable edge width, a separate selection speed, or mid-gesture ownership switching.
- [ ] Use `superpowers:verification-before-completion` before reporting the work complete.
