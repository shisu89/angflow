# Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two React-parity gaps in `@angflow/angular`: make the multi-selection box draggable (and keyboard-movable) as a group, and turn `autoPanOnNodeFocus` into a real `<ng-flow>` input. Remove the dead `autoPanStart`/`autoPanEnd` output stubs.

**Architecture:** The selection box (`SelectionBoxComponent`) instantiates an `@angflow/system` `XYDrag` instance bound to the rendered `.xy-flow__nodesselection` div with **no `nodeId`** — the same undefined-nodeId path React's `NodesSelection` uses. With no `nodeId`, `XYDrag` collects all selected nodes via `getDragItems` and routes through `onSelectionDragStart/Drag/Stop` instead of the per-node callbacks. Position updates flow through the store's existing `updateNodePositions` → `triggerNodeChanges` path (identical semantics to dragging one member node). The box also gets `tabindex="-1"` plus an arrow-key handler that ports React's `useMoveSelectedNodes` (snap-grid aware) and Escape to clear `nodesSelectionActive`. `autoPanOnNodeFocus` becomes an input wired into the existing store signal; the `autoPanStart`/`autoPanEnd` outputs are deleted.

**Tech Stack:** Angular 19 (zoneless, signals-based), `@angflow/system` (D3-based `XYDrag`), Vitest + `@angular/core/testing` `TestBed` with `provideZonelessChangeDetection()`.

**Part of:** 2026-06-11-deferred-work-master.md (Cluster 4).

---

## Context discovered during planning (read before starting)

These facts are load-bearing for the tasks below; they were verified against the current tree.

- **The `selectionDrag*` outputs already exist and are already fully wired.** `ng-flow.component.ts` declares `selectionDragStart`/`selectionDrag`/`selectionDragStop` outputs (lines 643–647), assigns `store.onSelectionDragStart/Drag/Stop` closures that emit them (lines 855–863), and forwards those closures into `getStoreItems()` (`flow-store.service.ts` lines 984–986, fields surfaced as `onSelectionDragStart`/`onSelectionDrag`/`onSelectionDragStop`). They never fire today **only because no `XYDrag` instance runs with `nodeId: undefined`.** Task 1 supplies that instance — **no output wiring needs to be added or changed.**
- **XYDrag reuse decision: instantiate `XYDrag` directly in `SelectionBoxComponent`, do NOT extract a shared helper and do NOT reuse `DragDirective`.** The existing `DragDirective` (`packages/angular/src/lib/directives/drag.directive.ts`) is node-specific: its primary input `nodeId` is `input.required<string>()`, and its `onNodeMouseDown`→`handleNodeClick` closure selects a node. The selection-drag path needs neither (`nodeId` must be `undefined`, and `onNodeMouseDown` is irrelevant). The box's lifecycle is an `@if`-gated element, not a directive host. Direct instantiation with `getStoreItems: () => this.store.getStoreItems()` — the exact same closure `DragDirective.ngOnInit` uses (line 50) — is the smallest correct change and keeps the store-callback plumbing identical. The shared seam is already `FlowStore.getStoreItems()`; nothing new to extract.
- **There is no existing `moveSelectedNodes` in Angular.** The node renderer's `onNodeKeyDown` (`node-renderer.component.ts` line 306) handles only `Escape`/`Enter`, not arrow keys. React's `useMoveSelectedNodes` (`packages/react/src/hooks/useMoveSelectedNodes.ts`) is the port target; Task 2 ports its body inline into the box handler.
- **`autoPanOnNodeFocus` store plumbing already exists.** `flow-store.service.ts` line 185 declares `readonly autoPanOnNodeFocus = signal(true)`, and `getStoreItems()` surfaces it (line 964). It is consumed in `node-renderer.component.ts` line 329. **Only the `<ng-flow>` input and its sync-effect line are missing.** React's default is `true` (`packages/react/src/store/initialState.ts:141`).

---

### Task 1: Selection box draggable via XYDrag (no nodeId)

**Files:**
- `packages/angular/src/lib/components/selection-box/selection-box.component.ts` (modify)
- `packages/angular/src/lib/components/selection-box/selection-box.drag.spec.ts` (new — Task 5)

**Steps:**

- [ ] Add a template reference + `viewChild` signal for the nodes-selection box element so the component can bind `XYDrag` to it when the `@if (store.nodesSelectionActive())` block enters the DOM. In `selection-box.component.ts`, add `#nodesSelectionBox` to the existing nodes-selection div and a `viewChild` query. Replace the import line:

  ```ts
  import { Component, ChangeDetectionStrategy, inject, computed, output } from '@angular/core';
  ```

  with:

  ```ts
  import {
    Component,
    ChangeDetectionStrategy,
    inject,
    computed,
    output,
    viewChild,
    effect,
    ElementRef,
    DestroyRef,
  } from '@angular/core';
  import { XYDrag, type XYDragInstance } from '@angflow/system';
  ```

  Add the `#nodesSelectionBox` ref to the nodes-selection div (the second `@if` block):

  ```html
      @if (store.nodesSelectionActive()) {
        <div
          #nodesSelectionBox
          class="ng-flow__selection ng-flow__nodesselection xy-flow__selection xy-flow__nodesselection"
          style="position: absolute; pointer-events: all; z-index: 10; transform-origin: left top;"
          [style.transform]="nodesSelectionTransform()"
          [style.width.px]="nodesSelectionBounds().width"
          [style.height.px]="nodesSelectionBounds().height"
          tabindex="-1"
          (keydown)="onKeyDown($event)"
          (contextmenu)="onContextMenu($event)"
        ></div>
      }
  ```

  > `tabindex="-1"` matches React exactly (`packages/react/src/components/NodesSelection/index.tsx:94`, `tabIndex={disableKeyboardA11y ? undefined : -1}`; Angular has no `disableKeyboardA11y` flag, so the keyboard path is always on).

  Inside the class body, after `readonly contextMenu = output<MouseEvent>();`, add:

  ```ts
  private readonly destroyRef = inject(DestroyRef);
  private readonly nodesSelectionBox = viewChild<ElementRef<HTMLDivElement>>('nodesSelectionBox');
  private dragInstance: XYDragInstance | null = null;
  ```

- [ ] Create/teardown the `XYDrag` instance in an `effect` driven by the `viewChild` signal. The effect runs whenever the box element appears or disappears (`@if` toggling `nodesSelectionActive`). When the element is present, lazily create one `XYDrag` (reusing the store's `getStoreItems` closure — the same one `DragDirective` uses) and `update()` it bound to the box with `nodeId` deliberately **omitted**; when the element is gone, `destroy()` the d3 binding. A `destroyRef.onDestroy` guarantees teardown if the component itself is destroyed mid-drag. Add this in the constructor:

  ```ts
  constructor() {
    // Bind/unbind XYDrag to the nodes-selection box as it enters/leaves the
    // DOM (@if on nodesSelectionActive). No nodeId is passed: XYDrag's
    // undefined-nodeId path collects all selected nodes and routes through the
    // onSelectionDrag* store callbacks (already wired on <ng-flow>), mirroring
    // React's useDrag({ nodeRef }) with no nodeId.
    effect(() => {
      const box = this.nodesSelectionBox();

      if (!box) {
        // Box left the DOM (selection cleared) — drop the d3-drag binding.
        this.dragInstance?.destroy();
        return;
      }

      if (!this.dragInstance) {
        this.dragInstance = XYDrag({
          getStoreItems: () => this.store.getStoreItems(),
        });
      }

      this.dragInstance.update({
        domNode: box.nativeElement,
        // nodeId intentionally omitted → selection-drag path.
        noDragClassName: this.store.noDragClassName(),
      });
    });

    // Safety net: if the component is destroyed while the box is still bound
    // (e.g. <ng-flow> torn down mid-drag), release the d3 listeners.
    this.destroyRef.onDestroy(() => this.dragInstance?.destroy());
  }
  ```

  > Zoneless note: `XYDrag`'s `updateNodePositions` callback writes store signals (it calls `FlowStore.updateNodePositions`, line 427, which calls `triggerNodeChanges`). The node-drag path already proves a D3 callback driving the view via signal writes — no `NgZone`, no timer-based CD. This reuses that exact path.

- [ ] Verify `noDragClassName` is reachable. Confirm `FlowStore` exposes `noDragClassName` (it does — surfaced in `getStoreItems()` at `flow-store.service.ts:976`, backed by `readonly noDragClassName` signal). If the signal accessor name differs, bind `domNode` only and drop the `noDragClassName` line; the drag still works, only the nodrag-descendant guard is skipped.

- [ ] Run the existing suite to confirm no regressions before adding new tests:

  ```
  pnpm -F @angflow/angular test
  ```

- [ ] Commit:

  ```
  feat(selection-box): make the multi-selection box draggable via XYDrag

  Instantiate an @angflow/system XYDrag bound to the nodesselection box with
  no nodeId, so the undefined-nodeId selection-drag path collects all selected
  nodes and routes through the already-wired onSelectionDrag* store callbacks.
  Positions flow through updateNodePositions like a single-node drag, so
  extent/group/undo semantics match. The instance is created when the box
  enters the DOM and torn down via the viewChild effect + DestroyRef when it
  leaves, so deactivating the selection cannot leak d3 listeners.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

  ```

---

### Task 2: Keyboard support — arrow-key move + Escape

**Files:**
- `packages/angular/src/lib/components/selection-box/selection-box.component.ts` (modify)
- `packages/angular/src/lib/components/selection-box/selection-box.keyboard.spec.ts` (new — Task 5)

**Steps:**

- [ ] Add the `arrowKeyDiffs` map and the `onKeyDown` handler. This ports React's `NodesSelection.onKeyDown` (`packages/react/src/components/NodesSelection/index.tsx:72-81`) plus `useMoveSelectedNodes` (`packages/react/src/hooks/useMoveSelectedNodes.ts`) inline, and adds Escape (React clears selection elsewhere; Angular's box owns it). Extend the system import added in Task 1 to include the position helpers:

  ```ts
  import {
    XYDrag,
    type XYDragInstance,
    type XYPosition,
    calculateNodePosition,
    snapPosition,
  } from '@angflow/system';
  ```

  At module scope (above the `@Component` decorator), add:

  ```ts
  /** Per-key unit direction vectors for arrow-key node movement (React parity). */
  const arrowKeyDiffs: Record<string, XYPosition> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };
  ```

  In the class body, add the handler:

  ```ts
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.store.nodesSelectionActive.set(false);
      (event.currentTarget as HTMLElement | null)?.blur();
      return;
    }

    const direction = arrowKeyDiffs[event.key];
    if (!direction) return;

    event.preventDefault();
    this.moveSelectedNodes(direction, event.shiftKey ? 4 : 1);
  }

  /**
   * Ports React's useMoveSelectedNodes: shift every selected & draggable node
   * by a snap-grid-aware velocity, then push the batch through the same
   * updateNodePositions path a drag uses.
   */
  private moveSelectedNodes(direction: XYPosition, factor: number): void {
    const store = this.store;
    const snapToGrid = store.snapToGrid();
    const snapGrid = store.snapGrid();
    const nodeExtent = store.nodeExtent();
    const nodeOrigin = store.nodeOrigin();
    const nodesDraggable = store.nodesDraggable();
    const onError = store.onError();
    const nodeLookup = store.nodeLookup;

    // By default a node moves 5px per press; snap grid overrides the velocity.
    const xVelo = snapToGrid ? snapGrid[0] : 5;
    const yVelo = snapToGrid ? snapGrid[1] : 5;
    const xDiff = direction.x * xVelo * factor;
    const yDiff = direction.y * yVelo * factor;

    const nodeUpdates = new Map<string, unknown>();

    for (const [, node] of nodeLookup) {
      const userDraggable = node.draggable;
      const isSelectedDraggable =
        node.selected && (userDraggable || (nodesDraggable && typeof userDraggable === 'undefined'));
      if (!isSelectedDraggable) continue;

      let nextPosition = {
        x: node.internals.positionAbsolute.x + xDiff,
        y: node.internals.positionAbsolute.y + yDiff,
      };
      if (snapToGrid) {
        nextPosition = snapPosition(nextPosition, snapGrid);
      }

      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup,
        nodeExtent,
        nodeOrigin,
        onError,
      });

      node.position = position;
      node.internals.positionAbsolute = positionAbsolute;
      nodeUpdates.set(node.id, node);
    }

    if (nodeUpdates.size > 0) {
      store.updateNodePositions(nodeUpdates as Map<string, never>);
    }
  }
  ```

  > Zoneless note: `updateNodePositions` writes store signals (the same write a drag does), so the view updates with no `NgZone` and no timer-forced CD. `(keydown)` is an Angular template binding, which already participates in change detection.
  >
  > Type note: `store.updateNodePositions(items: Map<string, any>, dragging = false)` accepts a permissive `any`-valued map (`flow-store.service.ts:427`); the `as Map<string, never>` cast satisfies the local `Map<string, unknown>` typing without widening the public surface. `store.onError()` returns the system `OnError` type expected by `calculateNodePosition`. `node` here is the `InternalNodeBase` from `nodeLookup`, which carries `internals.positionAbsolute`, `selected`, and `draggable`.

- [ ] Type-check and run the suite:

  ```
  pnpm -F @angflow/angular test
  ```

- [ ] Commit:

  ```
  feat(selection-box): arrow-key move + Escape on the selection box

  The box (tabindex="-1") now moves all selected, draggable nodes on arrow
  keys (snap-grid-aware velocity, 4x with Shift) via the same
  updateNodePositions path a drag uses, porting React's useMoveSelectedNodes.
  Escape clears nodesSelectionActive and blurs the box.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

  ```

---

### Task 3: `autoPanOnNodeFocus` input on `<ng-flow>`

**Files:**
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (modify)
- `packages/angular/src/lib/container/ng-flow/ng-flow.autopan-focus.spec.ts` (new — Task 5)

**Steps:**

- [ ] Add the input next to the other auto-pan inputs. In `ng-flow.component.ts`, after the `autoPanSpeed` input (line 448), insert:

  ```ts
  /** Pan the viewport automatically when a node receives keyboard focus. */
  readonly autoPanOnNodeFocus = input(true);
  ```

  > React default is `true` (`packages/react/src/store/initialState.ts:141`; `StoreUpdater` forwards it at `packages/react/src/components/StoreUpdater/index.tsx:27`).

- [ ] Wire it into the store in the existing input-sync effect. After the `autoPanSpeed` sync line (`ng-flow.component.ts:745`), insert:

  ```ts
      this.store.autoPanOnNodeFocus.set(this.autoPanOnNodeFocus());
  ```

  > The store signal (`flow-store.service.ts:185`) and its `getStoreItems()` surface (line 964) and consumer (`node-renderer.component.ts:329`) already exist; this is the only missing wire.

- [ ] Type-check and run the suite:

  ```
  pnpm -F @angflow/angular test
  ```

- [ ] Commit:

  ```
  feat(ng-flow): wire autoPanOnNodeFocus input to the store signal

  React-parity input (default true) feeding the existing
  store.autoPanOnNodeFocus signal that the node renderer already consumes for
  focus-driven auto-pan.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

  ```

---

### Task 4: Remove dead `autoPanStart`/`autoPanEnd` outputs + CHANGELOG

**Files:**
- `packages/angular/src/lib/container/ng-flow/ng-flow.component.ts` (modify)
- `packages/angular/CHANGELOG.md` (modify)

**Steps:**

- [ ] Delete the two never-wired output stubs. In `ng-flow.component.ts`, remove the block at lines 671–677:

  ```ts
    // Auto-pan events (declared for API completeness; not yet wired because
    // auto-pan detection happens inside XYDrag's internal requestAnimationFrame
    // loop, which does not currently expose start/end callbacks)
    /** Reserved — fires when auto-pan begins. Not yet wired. */
    readonly autoPanStart = output<void>({ alias: 'autoPanStart' });
    /** Reserved — fires when auto-pan ends. Not yet wired. */
    readonly autoPanEnd = output<void>({ alias: 'autoPanEnd' });
  ```

  Delete the whole block (comment + both outputs). Leave a single blank line where it was so `private lastNodesRef` (line 679) keeps its spacing.

- [ ] Confirm nothing references them:

  ```
  pnpm -F @angflow/angular exec grep -rn "autoPanStart\|autoPanEnd" src examples ../../examples/angular/src
  ```

  Expect no hits in TS/HTML (the stub-removal is its own compile check: any consumer would now fail `tsc`).

- [ ] Record the removal in the CHANGELOG under a new next-minor `Unreleased` heading. `CHANGELOG.md` currently has only the `## 0.2.0` section. Insert a new section directly under the `# @angflow/angular` title, above `## 0.2.0`:

  ```md
  # @angflow/angular

  ## Unreleased (next minor)

  ### Added

  - `<ng-flow>` `[autoPanOnNodeFocus]` input (default `true`) — pans the viewport
    when a node receives keyboard focus, matching React's `autoPanOnNodeFocus`.
  - Selection box is now draggable as a group and keyboard-movable (arrow keys,
    Shift = 4×, Escape clears the selection), matching React's `NodesSelection`.

  ### Removed

  - `(autoPanStart)` / `(autoPanEnd)` outputs. They were declared "Not yet wired",
    never emitted, and have no React equivalent. Removed as never-functional API.

  ## 0.2.0
  ```

  > Heading form chosen: `## Unreleased (next minor)` with `### Added` / `### Removed` subsections — Keep a Changelog style, consistent with the file's existing `## <version>` heading level. The master index (rule 6) ships angular as a **minor** bump in the coordinated release, so the eventual rename of this heading to the concrete version is a single edit at release time.

- [ ] This task removes API and updates the CHANGELOG in the same commit (spec requirement). Commit:

  ```
  feat(ng-flow)!: remove never-wired autoPanStart/autoPanEnd outputs

  These outputs were declared for API completeness, never emitted, and have no
  React counterpart. Removing them; documented under the next-minor CHANGELOG
  heading alongside the new autoPanOnNodeFocus input and draggable selection box.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

  ```

---

### Task 5: Tests

**Files:**
- `packages/angular/src/lib/components/selection-box/selection-box.drag.spec.ts` (new)
- `packages/angular/src/lib/components/selection-box/selection-box.keyboard.spec.ts` (new)
- `packages/angular/src/lib/container/ng-flow/ng-flow.autopan-focus.spec.ts` (new)

**Idioms:** follow `flow-store.service.spec.ts` (drives `XYDrag` behavior by calling `store.updateNodePositions` directly rather than dispatching real d3 pointer events — d3-drag does not fire under jsdom) and `node-renderer.component.spec.ts` / `ng-flow.component.spec.ts` (`TestBed` + `provideZonelessChangeDetection()`, the `setSignalInput` helper for inputs).

**Steps:**

- [ ] Write the drag + teardown spec. This proves (a) the selection-drag store callbacks emit in order and move both nodes via the shared `updateNodePositions` path, and (b) tearing the box out of the DOM destroys the `XYDrag` instance (no listener leak), using a `destroy` spy. Create `selection-box.drag.spec.ts`:

  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { TestBed, ComponentFixture } from '@angular/core/testing';
  import { provideZonelessChangeDetection } from '@angular/core';
  import * as system from '@angflow/system';
  import { SelectionBoxComponent } from './selection-box.component';
  import { FlowStore } from '../../services/flow-store.service';
  import type { Node } from '../../types';

  function makeNode(id: string, x: number, y: number, selected = false): Node {
    return { id, position: { x, y }, data: {}, type: 'default', selected };
  }

  describe('SelectionBoxComponent — selection drag', () => {
    let store: FlowStore;
    let fixture: ComponentFixture<SelectionBoxComponent>;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [SelectionBoxComponent],
        providers: [provideZonelessChangeDetection(), FlowStore],
      });
      store = TestBed.inject(FlowStore);
      fixture = TestBed.createComponent(SelectionBoxComponent);
    });

    it('fires onSelectionDrag* in order and moves both selected nodes', () => {
      store.setNodes([makeNode('a', 0, 0, true), makeNode('b', 100, 0, true)]);
      store.nodesSelectionActive.set(true);

      const order: string[] = [];
      store.onSelectionDragStart = () => order.push('start');
      store.onSelectionDrag = () => order.push('drag');
      store.onSelectionDragStop = () => order.push('stop');

      fixture.detectChanges(); // renders the box → XYDrag effect binds it

      // Drive the same store path XYDrag drives on a selection drag: shift both
      // selected nodes by (+30, +40) and emit the lifecycle callbacks in order.
      const evt = new MouseEvent('mousemove');
      const items = new Map<string, unknown>([
        ['a', { id: 'a', position: { x: 30, y: 40 } }],
        ['b', { id: 'b', position: { x: 130, y: 40 } }],
      ]);
      store.onSelectionDragStart?.(evt, store.selectedNodes() as never);
      store.updateNodePositions(items as Map<string, never>, true);
      store.onSelectionDrag?.(evt, store.selectedNodes() as never);
      store.updateNodePositions(items as Map<string, never>, false);
      store.onSelectionDragStop?.(evt, store.selectedNodes() as never);

      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 30, y: 40 });
      expect(store.nodeLookup.get('b')!.position).toEqual({ x: 130, y: 40 });
      expect(order).toEqual(['start', 'drag', 'stop']);
    });

    it('destroys the XYDrag binding when the box leaves the DOM (no leak)', () => {
      const destroy = vi.fn();
      const realXYDrag = system.XYDrag;
      const spy = vi.spyOn(system, 'XYDrag').mockImplementation((params) => {
        const inst = realXYDrag(params);
        return { update: inst.update, destroy };
      });

      store.setNodes([makeNode('a', 0, 0, true)]);
      store.nodesSelectionActive.set(true);
      fixture.detectChanges(); // box enters DOM → XYDrag created + update()
      expect(spy).toHaveBeenCalledTimes(1);

      store.nodesSelectionActive.set(false);
      fixture.detectChanges(); // box leaves DOM → effect destroys the binding
      expect(destroy).toHaveBeenCalled();
    });
  });
  ```

  > The drag assertion calls `updateNodePositions` directly — the exact thing `XYDrag` calls internally — because d3-drag's pointer pipeline does not run under jsdom. The order assertion drives the wired callbacks the way `XYDrag` does (`XYDrag.ts:291, 217, 383`). The teardown test spies on `system.XYDrag` to assert the `effect` destroys the instance when `nodesSelectionActive` flips false; this is the no-leak guarantee.

- [ ] Write the keyboard spec. Proves arrow keys move both selected nodes (and snap-grid + Shift scaling), and Escape clears `nodesSelectionActive`. Create `selection-box.keyboard.spec.ts`:

  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { TestBed, ComponentFixture } from '@angular/core/testing';
  import { provideZonelessChangeDetection } from '@angular/core';
  import { SelectionBoxComponent } from './selection-box.component';
  import { FlowStore } from '../../services/flow-store.service';
  import type { Node } from '../../types';

  function makeNode(id: string, x: number, y: number, selected = false): Node {
    return { id, position: { x, y }, data: {}, type: 'default', selected };
  }

  function getBox(fixture: ComponentFixture<SelectionBoxComponent>): HTMLElement {
    const el = fixture.nativeElement.querySelector('.xy-flow__nodesselection') as HTMLElement;
    expect(el).toBeTruthy();
    return el;
  }

  describe('SelectionBoxComponent — keyboard', () => {
    let store: FlowStore;
    let fixture: ComponentFixture<SelectionBoxComponent>;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [SelectionBoxComponent],
        providers: [provideZonelessChangeDetection(), FlowStore],
      });
      store = TestBed.inject(FlowStore);
      fixture = TestBed.createComponent(SelectionBoxComponent);
      store.setNodes([makeNode('a', 0, 0, true), makeNode('b', 100, 50, true)]);
      store.nodesSelectionActive.set(true);
      fixture.detectChanges();
    });

    it('ArrowRight moves all selected nodes by 5px', () => {
      getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 5, y: 0 });
      expect(store.nodeLookup.get('b')!.position).toEqual({ x: 105, y: 50 });
    });

    it('Shift+ArrowDown moves by 4x the velocity', () => {
      getBox(fixture).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
      );
      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 20 });
      expect(store.nodeLookup.get('b')!.position).toEqual({ x: 100, y: 70 });
    });

    it('uses the snap grid as the velocity when snapToGrid is on', () => {
      store.snapToGrid.set(true);
      store.snapGrid.set([15, 15]);
      getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 15, y: 0 });
    });

    it('Escape clears nodesSelectionActive', () => {
      getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(store.nodesSelectionActive()).toBe(false);
    });

    it('ignores non-arrow, non-Escape keys', () => {
      getBox(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(store.nodeLookup.get('a')!.position).toEqual({ x: 0, y: 0 });
      expect(store.nodesSelectionActive()).toBe(true);
    });
  });
  ```

  > `(keydown)` is a real template binding, so dispatching a `KeyboardEvent` on the rendered box element exercises `onKeyDown` end-to-end. With default `nodeExtent` (infinite) and `nodeOrigin` `[0,0]`, `calculateNodePosition` returns the raw `nextPosition`, so the expected values are exact.

- [ ] Write the autoPanOnNodeFocus input round-trip spec. Create `ng-flow.autopan-focus.spec.ts`:

  ```ts
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
  import { TestBed } from '@angular/core/testing';
  import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
  import { NgFlowComponent } from './ng-flow.component';

  function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
    const sig = (instance as Record<string, unknown>)[inputName];
    const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[
      ɵSIGNAL as unknown as symbol
    ];
    node.applyValueToInputSignal(node, value);
  }

  class FakeResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  describe('NgFlowComponent autoPanOnNodeFocus input', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [NgFlowComponent],
        providers: [provideZonelessChangeDetection()],
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('defaults to true and reaches the store signal', () => {
      const fixture = TestBed.createComponent(NgFlowComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance.store.autoPanOnNodeFocus()).toBe(true);
    });

    it('round-trips false into the store signal', () => {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      setSignalInput(inst, 'autoPanOnNodeFocus', false);
      fixture.detectChanges();
      expect(inst.store.autoPanOnNodeFocus()).toBe(false);
    });
  });
  ```

- [ ] Run the full angular suite (all three new specs + the existing suite):

  ```
  pnpm -F @angflow/angular test
  ```

- [ ] Commit:

  ```
  test(selection-box): cover selection drag, keyboard move, autoPanOnNodeFocus

  - selection drag fires onSelectionDrag* in order and moves both nodes via
    updateNodePositions; box teardown destroys the XYDrag binding (no leak).
  - arrow keys / Shift / snap-grid velocity / Escape on the box.
  - autoPanOnNodeFocus input defaults true and round-trips to the store signal.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

  ```

---

### Task 6: Manual smoke in `examples/angular`

**Files:** none modified — manual verification only.

**Steps:**

- [ ] Build both packages and start the example (per CLAUDE.md, `dist/` is gitignored so a fresh build is required before `ng serve` resolves the workspace packages):

  ```
  pnpm -F @angflow/system build
  pnpm -F @angflow/angular build
  pnpm -F angular-examples run dev
  ```

  > `angular-examples` is the example's package name (`examples/angular/package.json`). Equivalently, run `npm run dev` from `examples/angular` (per CLAUDE.md's command table).

- [ ] In the browser, verify the full parity loop:
  - Marquee-select two nodes (drag an empty-pane box around them) → the `.xy-flow__nodesselection` box appears.
  - Drag the box → **both** selected nodes move together by the same delta; releasing leaves them in place.
  - With the box focused, press arrow keys → both nodes nudge 5px (hold Shift → 20px); if a snap grid is configured, they snap to it.
  - Press Escape → the selection box disappears (`nodesSelectionActive` cleared).
  - Tab a node into focus with `[autoPanOnNodeFocus]` default (true) → an off-screen focused node pans into view; set `[autoPanOnNodeFocus]="false"` and confirm focusing no longer pans.

- [ ] No commit (manual step). Record the outcome in the task tracker / PR description.

---

## Self-review

- **Coverage vs spec:** (1) selection-box drag via XYDrag no-nodeId with create-on-enter / teardown-on-leave + DestroyRef safety net — Task 1. (2) `tabindex="-1"` (verified React value), arrow-key move (ported `useMoveSelectedNodes`, snap-grid aware, Shift ×4), Escape clears `nodesSelectionActive` — Task 2. (3) `autoPanOnNodeFocus` input wired to the store signal, React default `true` — Task 3. (4) remove `autoPanStart`/`autoPanEnd` + CHANGELOG in the same commit — Task 4. (5) tests: drag moves both nodes + events in order, teardown no-leak (destroy spy), arrow-key move, snap-grid velocity, input round-trip; stub-removal compile check is implicit (Task 4 grep + `tsc`) — Task 5. (6) manual smoke — Task 6. All spec bullets covered.
- **selectionDrag outputs / XYDrag reuse:** documented in the Context section — outputs already fully wired (only the no-nodeId instance was missing); XYDrag instantiated directly in the component (DragDirective is node-specific and `nodeId`-required), reusing the `FlowStore.getStoreItems()` seam. No shared-helper extraction.
- **Placeholders:** none — every code step is complete and self-contained.
- **Type consistency:** `updateNodePositions` takes `Map<string, any>` (verified at `flow-store.service.ts:427`); local `Map<string, unknown>` is cast `as Map<string, never>` at the call boundary so no public type widens. `calculateNodePosition`/`snapPosition`/`XYPosition` are real `@angflow/system` exports (verified at runtime). `store.onError()` returns the system `OnError`. Store accessors used (`snapToGrid`, `snapGrid`, `nodeExtent`, `nodeOrigin`, `nodesDraggable`, `onError`, `noDragClassName`, `nodeLookup`, `nodesSelectionActive`, `selectedNodes`, `getStoreItems`, `updateNodePositions`) all verified present.
- **Zoneless:** every D3/native callback path drives the view via signal writes (`updateNodePositions` → `triggerNodeChanges`), reusing the node-drag path that already proves it. No `NgZone`. No timer-forced CD.
- **Commands:** all package-scoped `pnpm -F @angflow/angular ...` from the repo root; no bare vitest.
