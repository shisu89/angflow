# Minimap Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled minimap interaction code (`onMinimapMouseDown/Move/Up`, the wheel handler, and the rAF click-to-center animation) with the framework-agnostic `XYMinimap` class from `@angflow/system`, giving extent-respecting pan, functional `inversePan`, `zoomStep`, and `pannable`/`zoomable` gating for free. Simultaneously wire the declared-but-dead `nodeComponent` input via `NgComponentOutlet`, mirroring React's `MiniMapNode` prop contract. Closes deferred items **M8** and the minimap part of **L6**.

**Architecture:** `MiniMapComponent` (`packages/angular/src/lib/components/minimap/minimap.component.ts`) currently re-implements d3-zoom interactions by hand. This plan creates an `XYMinimap` instance once both the SVG element (`viewChild`) and `store.panZoom()` exist (mirroring how `ng-flow.component.ts` defers via `afterNextRender` + a guarded `effect`), feeds it an update-effect keyed on the React-parity inputs plus the store's `translateExtent`, and routes click-to-center through `minimap.pointer(event)` + `store.setCenter(...)`. The d3 callbacks `XYMinimap.update()` installs write through `panZoom.setViewportConstrained(...)` / `panZoom.scaleTo(...)`, which feed the `transform` signal the template already reads — so the zoneless invariant (rule 2: external callbacks drive views via signal writes) is satisfied inherently, and because those writes flow through the exact same panZoom path the main pane uses, the Cluster-1 contract (`transform.set()` never calls `bumpVersion()`) is preserved with no extra work. The custom node path renders each node through `NgComponentOutlet` with the React `MiniMapNode` prop set; the default `<rect>` path (unset `nodeComponent`) is byte-for-byte unchanged. `collapsedHiddenIds` exclusion is preserved in both paths.

**Tech Stack:** Angular 19 (zoneless, signals-based), `@angflow/system` (d3-zoom/d3-selection core), Vitest + jsdom for unit tests, pnpm monorepo.

**Part of:** 2026-06-11-deferred-work-master.md (Cluster 2).

---

## React defaults pinned (verified against source, not just doc-comments)

Read from `packages/react/src/additional-components/MiniMap/MiniMap.tsx:64-69` (the destructured prop defaults — the authoritative runtime values):

| Input | React runtime default | Source |
|-------|-----------------------|--------|
| `pannable` | `false` | `MiniMap.tsx:64` `pannable = false` |
| `zoomable` | `false` | `MiniMap.tsx:65` `zoomable = false` |
| `zoomStep` | **`1`** | `MiniMap.tsx:68` `zoomStep = 1` |
| `inversePan` | `undefined` (falsy → `false` in XYMinimap) | `MiniMap.tsx:67` — no default; passed through as-is |
| `nodeBorderRadius` | `5` | `MiniMap.tsx:48` |
| `offsetScale` | `5` | `MiniMap.tsx:69` |

> **AMBIGUITY RESOLVED — `zoomStep` default.** The spec text (`2026-06-11-minimap-rework-design.md:23`) says "match React's defaults exactly" and parenthetically suggests `zoomStep` default `10`. The React **doc-comment** in `types.ts:94` indeed says `@default 10`, but the **actual destructured runtime default** in `MiniMap.tsx:68` is `zoomStep = 1`. The existing Angular input also currently defaults to `10` (`minimap.component.ts:127`). The spec's binding instruction is "match React's defaults exactly (state them in the plan after reading React)" and explicitly says to verify. The verified React runtime default is **`1`**. **Decision: change the Angular `zoomStep` default from `10` to `1` to match React's real behavior**, and add a regression note in the commit body. This is the only behavioral default change; `pannable`/`zoomable` already default to `false` (matching React) and `inversePan` already defaults to `false` (XYMinimap treats missing/falsy `inversePan` as `false`, so passing `inversePan()` which is `false` by default is equivalent to React passing `undefined`).

## Approach to jsdom + d3-zoom (decided concretely — no interaction-gesture assertions)

jsdom has **no real d3-zoom gesture support**: `selection.call(zoom())` installs listeners, but synthesizing a `D3ZoomEvent` with a populated `sourceEvent` (the `wheel`/`mousemove`/`mousedown` the handlers branch on) does not happen from a plain `dispatchEvent` in jsdom, so the existing minimap spec never asserted at the gesture level — it called the component's **own methods** directly (`onMinimapWheel(...)`, `onMinimapMouseDown(...)`). After this rework those methods are deleted, so that approach is gone.

**Decision: test the `update()` wiring contract via a spied `XYMinimap`, plus the `pointer()`→`setCenter` click path and the `nodeComponent` rendering path which are pure DOM/Angular and need no d3 gesture.** Concretely:

- `vi.mock('@angflow/system', ...)` to replace `XYMinimap` with a factory returning a spy object `{ update: vi.fn(), destroy: vi.fn(), pointer: vi.fn(() => [123, 456]) }`, while re-exporting every other real symbol the component (and its transitive imports) need (`getBoundsOfRects`, types). This lets us assert: the instance is created only after `panZoom()` is set; `update()` is called with the exact `{ translateExtent, width, height, inversePan, zoomStep, pannable, zoomable }` object; changing an input re-invokes `update()` with the new values (extent-clamp, inversePan flip, pannable/zoomable disable, zoomStep are all asserted as **the values forwarded to `update()`**, since the actual clamping/flip lives in already-shipped, upstream-tested `XYMinimap`); and `destroy()` runs on teardown.
- The click-to-center test calls the component's `onMinimapClick(event)` and asserts `minimap.pointer` was called with the event and `store.setCenter` was called with the pointer's returned `[x, y]` (and a `duration`). `setCenter` is spied on the real `FlowStore`.
- The `nodeComponent` rendering test mounts a tiny stub component and asserts the rendered DOM contains it with the mirrored inputs; the default-path regression test asserts a bare `<rect class="xy-flow__minimap-node">` is rendered when `nodeComponent` is unset.

This mirrors the spirit of the existing spec's "drive inputs directly via ɵSIGNAL, assert the wiring contract" idiom while swapping gesture-level assertions (now impossible) for effect-input assertions.

---

### Task 1: Add the `XYMinimap` instance + create/update/destroy effects (interaction adoption)

Replace the hand-rolled handlers with `XYMinimap`. This is the core of the rework. TDD: write the failing wiring tests first.

**Files:**
- `packages/angular/src/lib/components/minimap/minimap.component.ts` (modify)
- `packages/angular/src/lib/components/minimap/minimap.component.spec.ts` (add a new `describe` block; keep existing color/collapse blocks; **delete** the three pan/zoom-interaction tests that call the now-removed methods)

#### Steps

- [ ] **Write the failing create/update/destroy-wiring tests.** Add this new `describe` block to `minimap.component.spec.ts` (append after the existing blocks). It mocks `@angflow/system` so `XYMinimap` is a spy. Add the mock at the top of the file (below the existing imports):

```ts
// ── Added at the TOP of minimap.component.spec.ts, after the existing imports ──
import { vi } from 'vitest';

// Spy handle the factory closes over, so each test can read the latest instance.
const minimapSpy = {
  update: vi.fn(),
  destroy: vi.fn(),
  pointer: vi.fn(() => [123, 456] as [number, number]),
};

vi.mock('@angflow/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angflow/system')>();
  return {
    ...actual,
    XYMinimap: vi.fn(() => minimapSpy),
  };
});
```

```ts
// ── Appended as a NEW describe block at the END of minimap.component.spec.ts ──
import { XYMinimap, type PanZoomInstance } from '@angflow/system';

/** Minimal panZoom stub: only the members XYMinimap/MiniMap touch. */
function fakePanZoom(): PanZoomInstance {
  return {
    setViewportConstrained: vi.fn(),
    scaleTo: vi.fn(),
    setViewport: vi.fn(),
    syncViewport: vi.fn(),
    setScaleExtent: vi.fn(),
    setTranslateExtent: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  } as unknown as PanZoomInstance;
}

describe('MiniMapComponent adopts XYMinimap', () => {
  let store: FlowStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never);
  });

  it('does NOT create the XYMinimap instance until panZoom exists', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      // panZoom() is still null → guard effect waits → factory not called.
      expect(XYMinimap).not.toHaveBeenCalled();
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('creates the XYMinimap instance once panZoom is set, and calls update()', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();

      expect(XYMinimap).toHaveBeenCalledTimes(1);
      const params = (XYMinimap as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(params.domNode).toBeInstanceOf(SVGSVGElement);
      expect(typeof params.getTransform).toBe('function');
      expect(typeof params.getViewScale).toBe('function');
      // getTransform returns the live store transform.
      store.transform.set([3, 4, 1.5]);
      expect(params.getTransform()).toEqual([3, 4, 1.5]);

      expect(minimapSpy.update).toHaveBeenCalled();
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('forwards the exact update params (defaults: pannable/zoomable false, zoomStep 1)', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.setTranslateExtent([[-100, -200], [300, 400]]);
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();

      const lastArgs = minimapSpy.update.mock.calls.at(-1)![0];
      expect(lastArgs).toEqual({
        translateExtent: [[-100, -200], [300, 400]],
        width: 800,
        height: 600,
        inversePan: false,
        zoomStep: 1,
        pannable: false,
        zoomable: false,
      });
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('re-invokes update() with the new value when an input changes (extent clamp / inversePan / pannable / zoomable / zoomStep)', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();
      minimapSpy.update.mockClear();

      setSignalInput(fixture.componentInstance, 'pannable', true);
      setSignalInput(fixture.componentInstance, 'zoomable', true);
      setSignalInput(fixture.componentInstance, 'inversePan', true);
      setSignalInput(fixture.componentInstance, 'zoomStep', 25);
      fixture.detectChanges();
      await fixture.whenStable();

      const lastArgs = minimapSpy.update.mock.calls.at(-1)![0];
      expect(lastArgs.pannable).toBe(true);
      expect(lastArgs.zoomable).toBe(true);
      expect(lastArgs.inversePan).toBe(true);
      expect(lastArgs.zoomStep).toBe(25);
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('re-invokes update() when the store translateExtent changes (extent clamp wiring)', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      fixture.detectChanges();
      await fixture.whenStable();
      minimapSpy.update.mockClear();

      store.setTranslateExtent([[0, 0], [500, 500]]);
      fixture.detectChanges();
      await fixture.whenStable();

      const lastArgs = minimapSpy.update.mock.calls.at(-1)![0];
      expect(lastArgs.translateExtent).toEqual([[0, 0], [500, 500]]);
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('tolerates a zero-size minimap (display:none) — update() still called, no throw', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    try {
      // Force the container to zero box.
      fixture.nativeElement.querySelector('.ng-flow__minimap')!.setAttribute('style', 'display:none');
      fixture.detectChanges();
      await fixture.whenStable();
      store.panZoom.set(fakePanZoom());
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
      await fixture.whenStable();
      expect(minimapSpy.update).toHaveBeenCalled();
    } finally {
      fixture.nativeElement.remove();
    }
  });

  it('calls destroy() on teardown', async () => {
    const fixture = createMinimap();
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    store.panZoom.set(fakePanZoom());
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();
    fixture.nativeElement.remove();
    expect(minimapSpy.destroy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Delete the obsolete pan/zoom-interaction `describe` block.** In `minimap.component.spec.ts`, remove the entire `describe('MiniMapComponent pan/zoom interactions do not bump the store version', ...)` block (the three tests that call `onMinimapWheel`, `onMinimapMouseDown`, and `onMinimapClick`'s rAF path, plus the `REGRESSION: viewport indicator still reacts to pure transform writes` test). Re-add **only** the viewport-indicator regression as a standalone test (it asserts the mask/viewBox still recompute on a pure transform write and is independent of the deleted handlers):

```ts
// ── Standalone replacement for the kept regression assertion ──
describe('MiniMapComponent viewport indicator reacts to transform writes', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never);
  });

  it('REGRESSION: viewport indicator still reacts to pure transform writes', () => {
    const fixture = createMinimap();
    fixture.detectChanges();
    const viewBoxBefore = fixture.componentInstance.viewBox();
    const maskBefore = fixture.componentInstance.maskPath();

    store.transform.set([-250, -180, 1.6]); // no bump involved

    expect(fixture.componentInstance.viewBox()).not.toBe(viewBoxBefore);
    expect(fixture.componentInstance.maskPath()).not.toBe(maskBefore);
  });
});
```

- [ ] **Run the new tests — confirm they FAIL** (the component does not yet create `XYMinimap`). From the repo root:

```
pnpm -F @angflow/angular test -- minimap.component.spec
```

- [ ] **Implement: rewrite the component class internals.** Edit `minimap.component.ts`:

  1. **Imports** — replace the `@angular/core` import block to add `afterNextRender`, `effect`, `DestroyRef`, and drop `AfterViewInit`/`OnDestroy`:

```ts
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  effect,
  afterNextRender,
  ElementRef,
  viewChild,
  DestroyRef,
  Type,
} from '@angular/core';
```

  And add `XYMinimap` + `type XYMinimapInstance` to the `@angflow/system` import:

```ts
import {
  getBoundsOfRects,
  XYMinimap,
  type XYMinimapInstance,
  type PanelPosition,
  type Rect,
} from '@angflow/system';
```

  2. **Add an SVG viewChild** next to the existing container ref:

```ts
  private minimapContainerRef = viewChild<ElementRef>('minimapContainer');
  private minimapSvgRef = viewChild<ElementRef<SVGSVGElement>>('minimapSvg');
```

  And add the template ref `#minimapSvg` to the `<svg>` element in the template:

```html
        <svg
          #minimapSvg
          class="xy-flow__minimap-svg"
          [attr.width]="mmWidth()"
          [attr.height]="mmHeight()"
          [attr.viewBox]="viewBox()"
        >
```

  3. **Change the `zoomStep` default to `1`** (React parity — see pinned defaults):

```ts
  /** Zoom step applied per wheel tick when `zoomable`. */
  readonly zoomStep = input(1);
```

  4. **Remove the hand-rolled state fields and the `(click)`/`(mousedown)`/`(wheel)` bindings** on the container `<div>`. The container `<div>` opening tag becomes:

```html
      <div
        class="ng-flow__minimap xy-flow__minimap"
        #minimapContainer
        [attr.aria-label]="ariaLabel()"
        [style.width.px]="mmWidth()"
        [style.height.px]="mmHeight()"
        style="border-radius: 4px; overflow: hidden; border: 1px solid #ddd; box-shadow: 0 1px 4px rgba(0,0,0,0.1); cursor: pointer;"
        (click)="onMinimapClick($event)"
      >
```

  (Keep `(click)` — click-to-center is now routed through `pointer()`+`setCenter`. Drop `(mousedown)` and `(wheel)` — `XYMinimap`'s d3-zoom binding on the SVG owns drag-pan and wheel-zoom.)

  5. **Delete these members entirely** (named for the checklist):
     - fields: `animationFrameId`, `isDragging`, `dragMoved`, `boundOnMouseMove`, `boundOnMouseUp`
     - methods: `ngAfterViewInit()`, `onMinimapMouseDown()`, `onMinimapMouseMove()`, `onMinimapMouseUp()`, `onMinimapWheel()`, `ngOnDestroy()`
     - the rAF easing block inside the old `onMinimapClick()` (the whole `animate` closure + `requestAnimationFrame` scheduling + `syncViewport` call)
     - the `implements AfterViewInit, OnDestroy` on the class declaration

  6. **Add the instance field + create/update/destroy wiring** in the class body. Place after the `output(...)` declarations:

```ts
  private minimap: XYMinimapInstance | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Defer creation until the view exists (SVG ref) AND panZoom is ready.
    // afterNextRender guarantees the viewChild is resolved; the inner effect
    // then waits for store.panZoom() to be non-null (mirrors how the main pane
    // defers its own d3-zoom wiring in ng-flow.component.ts).
    afterNextRender(() => {
      const create = effect(() => {
        const panZoom = this.store.panZoom();
        const svgEl = this.minimapSvgRef()?.nativeElement;
        if (!panZoom || !svgEl || this.minimap) return;

        this.minimap = XYMinimap({
          domNode: svgEl,
          panZoom,
          getTransform: () => this.store.transform(),
          getViewScale: () => this.viewBoxData().viewScale,
        });

        // Push the first update immediately so the d3-zoom handlers are bound
        // with the current inputs without waiting for the next change.
        this.pushMinimapUpdate();
      });
      destroyRef.onDestroy(() => create.destroy());
    });

    // Keep XYMinimap in sync with the React-parity inputs + the store extent.
    // The d3 callbacks XYMinimap installs write via panZoom → the transform
    // signal the template reads (zoneless rule 2 satisfied), and those writes
    // flow through the same panZoom path as the main pane, so the C1 contract
    // (no bumpVersion on transform writes) holds.
    effect(() => {
      if (!this.minimap) return;
      this.pushMinimapUpdate();
    });

    destroyRef.onDestroy(() => {
      this.minimap?.destroy();
      this.minimap = null;
    });
  }

  private pushMinimapUpdate(): void {
    this.minimap?.update({
      translateExtent: this.store.translateExtent(),
      width: this.store.width(),
      height: this.store.height(),
      inversePan: this.inversePan(),
      zoomStep: this.zoomStep(),
      pannable: this.pannable(),
      zoomable: this.zoomable(),
    });
  }
```

  7. **Rewrite `onMinimapClick`** to use `pointer()` + `setCenter` (delete the entire old body):

```ts
  onMinimapClick(event: MouseEvent): void {
    // minimap.pointer maps the click to flow coordinates using the SVG's
    // current viewBox (d3-selection pointer against the bound SVG element).
    const [x, y] = this.minimap ? this.minimap.pointer(event) : [0, 0];

    this.minimapClick.emit({ event, position: { x, y } });

    if (!this.pannable()) return;

    // setCenter (flow-store) honors interpolate/duration after Cluster 1; we
    // only depend on passing duration here.
    void this.store.setCenter(x, y, { zoom: this.store.transform()[2], duration: 300 });
  }
```

> Note: `XYMinimapInstance.pointer` is typed as `typeof pointer` from d3-selection, i.e. `(event, node?) => [number, number]`. Calling `this.minimap.pointer(event)` binds against the SVG element d3 already holds, returning `[flowX, flowY]`.

- [ ] **Run the tests — confirm GREEN.**

```
pnpm -F @angflow/angular test -- minimap.component.spec
```

- [ ] **Type-check the package.** From the repo root:

```
pnpm -F @angflow/angular exec tsc --noEmit
```

- [ ] **Commit.**

```
git add packages/angular/src/lib/components/minimap/minimap.component.ts packages/angular/src/lib/components/minimap/minimap.component.spec.ts

git commit -m @'
refactor(minimap): adopt system XYMinimap for pan/zoom/click

Replace the hand-rolled minimap interaction code (onMinimapMouseDown/
Move/Up, the wheel handler, and the rAF click-to-center animation) with
the system XYMinimap class: extent-respecting pan via
setViewportConstrained, functional inversePan, zoomStep, and
pannable/zoomable gating. The instance is created once the SVG ref and
store.panZoom() both exist (afterNextRender + guarded effect, mirroring
the main pane) and destroyed via DestroyRef. Click-to-center now routes
through minimap.pointer(event) + store.setCenter (honoring duration).

zoomStep default changed 10 -> 1 to match React MiniMap.tsx runtime
default. The d3 callbacks write through the same panZoom path as the
main pane, so the C1 contract (no bumpVersion on transform writes)
holds and the zoneless rule-2 invariant is satisfied inherently.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 2: Wire the `nodeComponent` input via `NgComponentOutlet`

Render each minimap node through a custom Angular component when `nodeComponent` is set, mirroring React's `MiniMapNode` prop contract. Default path (unset) keeps the `<rect>`. TDD first.

**Files:**
- `packages/angular/src/lib/components/minimap/minimap.component.ts` (modify)
- `packages/angular/src/lib/components/minimap/minimap.component.spec.ts` (add a `describe` block)

The exact inputs to pass (mirroring React's `NodeComponentWrapperInner` → `MiniMapNodeProps`, `MiniMapNodes.tsx:111-126` and `types.ts:116-131`): `id`, `x`, `y`, `width`, `height`, `selected`, `color`, `strokeColor`, `strokeWidth`, `borderRadius`, `shapeRendering`, `className`. (React also passes `style` and `onClick`; `style` derives from `node.style` and is folded into `color` resolution upstream — we pass the resolved `color`/`strokeColor`/`className` instead, and the click is handled by the component's own `(click)` wrapper, matching how the default `<rect>` already wires `onMinimapNodeClick`.)

#### Steps

- [ ] **Write the failing nodeComponent tests.** Append to `minimap.component.spec.ts`. Defines a stub custom node component that records its inputs:

```ts
// ── Stub custom minimap-node component (top-level in the spec file) ──
import { Component as NgComponent, input as ngInput } from '@angular/core';

@NgComponent({
  selector: 'test-mm-node',
  standalone: true,
  template: `<rect class="test-mm-node" [attr.x]="x()" [attr.y]="y()"
    [attr.width]="width()" [attr.height]="height()" [attr.rx]="borderRadius()"
    [attr.data-id]="id()" [attr.data-selected]="selected()"
    [attr.data-color]="color()" [attr.data-stroke]="strokeColor()"
    [attr.data-stroke-width]="strokeWidth()" [attr.data-class]="className()"
    [attr.shape-rendering]="shapeRendering()" />`,
})
class TestMiniMapNode {
  readonly id = ngInput<string>('');
  readonly x = ngInput<number>(0);
  readonly y = ngInput<number>(0);
  readonly width = ngInput<number>(0);
  readonly height = ngInput<number>(0);
  readonly selected = ngInput<boolean>(false);
  readonly color = ngInput<string | undefined>(undefined);
  readonly strokeColor = ngInput<string | undefined>(undefined);
  readonly strokeWidth = ngInput<number | undefined>(undefined);
  readonly borderRadius = ngInput<number>(5);
  readonly shapeRendering = ngInput<string>('');
  readonly className = ngInput<string>('');
}
```

```ts
// ── Appended describe block ──
describe('MiniMapComponent nodeComponent wiring', () => {
  let store: FlowStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MiniMapComponent, TestMiniMapNode],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    store = TestBed.inject(FlowStore);
    store.width.set(800);
    store.height.set(600);
    store.setNodes([
      { id: 'n1', type: 'orchestrator', position: { x: 10, y: 20 }, data: {}, selected: true },
    ] as never);
  });

  it('renders the default <rect> (no custom component) when nodeComponent is unset', () => {
    const fixture = createMinimap();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('rect.xy-flow__minimap-node')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('rect.test-mm-node')).toBeNull();
  });

  it('renders the custom nodeComponent with the React MiniMapNode prop set', () => {
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'nodeComponent', TestMiniMapNode);
    setSignalInput(fixture.componentInstance, 'nodeColor', '#abcdef');
    setSignalInput(fixture.componentInstance, 'nodeStrokeColor', '#112233');
    setSignalInput(fixture.componentInstance, 'nodeStrokeWidth', 3);
    setSignalInput(fixture.componentInstance, 'nodeBorderRadius', 7);
    setSignalInput(fixture.componentInstance, 'nodeClassName', 'my-node');
    fixture.detectChanges();

    const rect = fixture.nativeElement.querySelector('rect.test-mm-node') as SVGRectElement;
    expect(rect).toBeTruthy();
    // Default <rect> path must NOT also render.
    expect(fixture.nativeElement.querySelector('rect.xy-flow__minimap-node')).toBeNull();

    expect(rect.getAttribute('data-id')).toBe('n1');
    expect(rect.getAttribute('x')).toBe('10');
    expect(rect.getAttribute('y')).toBe('20');
    expect(rect.getAttribute('data-selected')).toBe('true');
    expect(rect.getAttribute('data-color')).toBe('#abcdef');
    expect(rect.getAttribute('data-stroke')).toBe('#112233');
    expect(rect.getAttribute('data-stroke-width')).toBe('3');
    expect(rect.getAttribute('rx')).toBe('7');
    expect(rect.getAttribute('data-class')).toBe('my-node');
    expect(rect.getAttribute('shape-rendering')).toBeTruthy();
  });

  it('excludes collapsed-hidden nodes from the custom-component path too', () => {
    store.setNodes([
      { id: 'g', position: { x: 0, y: 0 }, data: {}, collapsed: true },
      { id: 'a', position: { x: 0, y: 0 }, data: {}, parentId: 'g' },
      { id: 'x', position: { x: 0, y: 0 }, data: {} },
    ] as never);
    const fixture = createMinimap();
    setSignalInput(fixture.componentInstance, 'nodeComponent', TestMiniMapNode);
    fixture.detectChanges();

    const ids = Array.from(fixture.nativeElement.querySelectorAll('rect.test-mm-node'))
      .map((r) => (r as Element).getAttribute('data-id'))
      .sort();
    expect(ids).toEqual(['g', 'x']);
  });
});
```

- [ ] **Run — confirm FAIL** (the custom path does not exist yet).

```
pnpm -F @angflow/angular test -- minimap.component.spec
```

- [ ] **Implement.** Edit `minimap.component.ts`:

  1. Add `NgComponentOutlet` to imports:

```ts
import { NgComponentOutlet } from '@angular/common';
```

  And to the component's `imports` array:

```ts
  imports: [PanelComponent, NgComponentOutlet],
```

  2. Extend the `minimapNodes` computed to also expose the per-node resolved props the custom path needs (keep the existing `_userNode`). Replace the `return nodes.map(...)` block:

```ts
    return nodes.map((node) => ({
      id: node.id,
      x: node.internals?.positionAbsolute?.x ?? 0,
      y: node.internals?.positionAbsolute?.y ?? 0,
      width: node.measured?.width ?? node.width ?? 150,
      height: node.measured?.height ?? node.height ?? 40,
      selected: !!node.selected,
      _userNode: node.internals?.userNode,
    }));
```

  3. Add a `shapeRendering` constant and a `getNodeComponentInputs()` builder mirroring React's `MiniMapNodeProps`. Add after the `getNodeClassName(...)` method:

```ts
  // React uses 'crispEdges' under Chrome/SSR, 'geometricPrecision' otherwise
  // (MiniMapNodes.tsx:36). Browsers always have window; default to
  // geometricPrecision, matching React's non-Chrome branch.
  private readonly shapeRendering =
    typeof window === 'undefined' || !!(window as { chrome?: unknown }).chrome
      ? 'crispEdges'
      : 'geometricPrecision';

  /** Inputs object passed to a custom nodeComponent via NgComponentOutlet. */
  getNodeComponentInputs(node: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
    _userNode?: Node;
  }): Record<string, unknown> {
    return {
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      selected: node.selected,
      color: this.getNodeColor(node),
      strokeColor: this.getNodeStrokeColor(node),
      strokeWidth: this.nodeStrokeWidth(),
      borderRadius: this.nodeBorderRadius(),
      shapeRendering: this.shapeRendering,
      className: this.getNodeClassName(node),
    };
  }
```

  4. Update the template node loop to branch on `nodeComponent()`. Replace the `<!-- Nodes -->` `@for` block:

```html
          @for (node of minimapNodes(); track node.id) {
            @if (nodeComponent(); as nc) {
              <g (click)="onMinimapNodeClick($event, node)">
                <ng-container
                  *ngComponentOutlet="nc; inputs: getNodeComponentInputs(node)"
                />
              </g>
            } @else {
              <rect
                class="xy-flow__minimap-node"
                [class]="getNodeClassName(node)"
                [attr.x]="node.x"
                [attr.y]="node.y"
                [attr.width]="node.width"
                [attr.height]="node.height"
                [attr.rx]="nodeBorderRadius()"
                [style.fill]="getNodeColor(node)"
                [style.stroke]="getNodeStrokeColor(node)"
                [style.stroke-width]="nodeStrokeWidth()"
                (click)="onMinimapNodeClick($event, node)"
              />
            }
          }
```

  5. Update the `nodeComponent` input doc to drop "Not yet wired":

```ts
  /** Custom Angular component to render each minimap node (mirrors React's MiniMapNode). When unset, a default <rect> is rendered. */
  readonly nodeComponent = input<Type<unknown> | null>(null);
```

- [ ] **Run — confirm GREEN.**

```
pnpm -F @angflow/angular test -- minimap.component.spec
```

- [ ] **Type-check.**

```
pnpm -F @angflow/angular exec tsc --noEmit
```

- [ ] **Commit.**

```
git add packages/angular/src/lib/components/minimap/minimap.component.ts packages/angular/src/lib/components/minimap/minimap.component.spec.ts

git commit -m @'
feat(minimap): wire nodeComponent via NgComponentOutlet

Render each minimap node through a custom Angular component when the
nodeComponent input is set, passing the React MiniMapNode prop set
(id, x, y, width, height, selected, color, strokeColor, strokeWidth,
borderRadius, shapeRendering, className). The default <rect> path is
unchanged when nodeComponent is unset, and collapsedHiddenIds exclusion
is preserved in both paths.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 3: Full package gate + manual smoke

Run the whole Angular suite (not just the minimap spec) plus type-check and lint, then manually smoke the interaction in the example app. No code changes expected here; if the broader suite surfaces a regression, fix it under TDD before proceeding.

**Files:** none (verification only).

#### Steps

- [ ] **Run the full Angular test suite.** From the repo root:

```
pnpm -F @angflow/angular test
```

- [ ] **Type-check + lint the package.** From the repo root:

```
pnpm -F @angflow/angular exec tsc --noEmit
pnpm -F @angflow/angular lint
```

- [ ] **Build the package** (the example consumes `dist/`):

```
pnpm -F @angflow/angular build
```

- [ ] **Manual smoke in `examples/angular`.** Run the dev server from `examples/angular`:

```
npm run dev
```

  (directory: `examples/angular`). In the browser, on a flow that renders `<ng-flow-minimap pannable zoomable>`:
  - **Drag at the extent edge:** drag inside the minimap to pan; confirm the main viewport pans and **stays clamped** at the configured `translateExtent` edge (it must not run past the bounds — this is the `setViewportConstrained` win the old hand-rolled code lacked).
  - **Wheel zoom:** scroll over the minimap; confirm the main viewport zooms in/out and respects `minZoom`/`maxZoom`.
  - **Click-to-center:** click an empty spot in the minimap; confirm the main viewport recenters smoothly on that flow position (via `setCenter`, ~300ms).
  - **inversePan:** if a demo toggles `[inversePan]="true"`, confirm drag direction flips.
  - **Custom nodeComponent (if a demo wires one):** confirm custom node rects render; otherwise confirm the default `<rect>` nodes still render.

- [ ] **Capture a smoke screenshot** (optional but recommended) and confirm no console errors. If any step fails, return to the relevant task, add a failing test reproducing the gap, fix, and re-run the gate.

> No publishing in this cluster (master rule 6 — coordinated release after all six clusters). No agent-bridge/mcp changes (master rule 4) — the mcp snapshot must not need regeneration.

---

## Self-review notes (resolved inline)

- **Spec coverage.** Interaction adoption (Task 1): create-effect guarded on SVG ref + `panZoom()`, `getTransform`/`getViewScale` closures, update-effect forwarding `translateExtent`/`width`/`height`/`inversePan`/`zoomStep`/`pannable`/`zoomable`, `DestroyRef` destroy — all present. Click-to-center via `pointer()` + `setCenter` with `duration` — present, depends on `setCenter` only for passing `duration` (no dependency on the Cluster-1 interpolate work beyond that). All hand-rolled members named and deleted. `nodeComponent` via `NgComponentOutlet` with the enumerated React prop set, default `<rect>` unchanged, `collapsedHiddenIds` preserved (Task 2). Tests cover extent-clamp wiring, inversePan, pannable/zoomable disable, zoomStep, nodeComponent rendering + inputs, default-path regression, zero-size tolerance (Task 1/2). Manual smoke with exact `npm run dev` dir (Task 3).
- **jsdom limitation** handled explicitly: gesture-level assertions are replaced with `update()`-input assertions via a spied `XYMinimap` and a DOM-level click/`pointer` test — decided concretely, no hand-waving.
- **Zoneless rules:** no `NgZone`; the d3 callbacks drive the view through `panZoom` → `transform` signal writes (inherent, stated); transform writes never `bumpVersion` because they share the main pane's panZoom path (C1 contract, stated).
- **Type consistency:** `XYMinimapInstance`/`PanZoomInstance` imported from `@angflow/system`; `getNodeComponentInputs` returns `Record<string, unknown>` matching `ngComponentOutletInputs`; `pointer(event)` returns `[number, number]`.
- **Placeholder scan:** no TBD / "similar to" / ellipsis-code; every code block is complete.
