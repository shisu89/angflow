/**
 * Regression tests for the pane mousedown target guard.
 *
 * When selectionOnDrag is enabled, the capture-phase mousedown handler must
 * NOT start a marquee if the event target is a child element (e.g. the
 * nodes-selection box, a node, an edge). Only a mousedown whose target IS
 * the pane element itself should initiate a selection marquee.
 *
 * Ported from React's Pane `onPointerDownCapture`:
 *   const eventTargetIsContainer = event.target === container.current;
 *   const isSelectionActive = (selectionOnDrag && eventTargetIsContainer) || selectionKeyPressed;
 *   if (!isSelectionActive || ...) return;
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ɵSIGNAL } from '@angular/core';
import { PaneComponent } from './pane.component';
import { FlowStore } from '../../services/flow-store.service';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** Set an input() signal's value directly without going through the template. */
function setSignalInput<T>(instance: unknown, inputName: string, value: T): void {
  const sig = (instance as Record<string, unknown>)[inputName];
  const node = (sig as Record<symbol, { applyValueToInputSignal(n: unknown, v: unknown): void }>)[ɵSIGNAL as unknown as symbol];
  node.applyValueToInputSignal(node, value);
}

/** Stub domNode on a store with a fake container that has getBoundingClientRect. */
function stubDomNode(store: FlowStore): void {
  const fakeContainer = document.createElement('div');
  Object.defineProperty(fakeContainer, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  });
  store.domNode.set(fakeContainer as HTMLDivElement);
}

/**
 * Dispatch a real left-button pointerdown on the given element.
 * The capture-phase pane listener receives this event with event.target === el.
 */
function fireMouseDown(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }));
}

describe('PaneComponent — selectionOnDrag target guard', () => {
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
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * The critical regression: mousedown on the .xy-flow__nodesselection box should
   * NOT be hijacked by the pane capture listener. The pane's capture handler fires
   * first (capture phase), so this confirms the target guard prevents the marquee.
   */
  it('does NOT start a marquee when selectionOnDrag mousedown targets the nodesselection box', () => {
    const fixture = TestBed.createComponent(PaneComponent);
    const inst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);

    // Enable selectionOnDrag; stub domNode so nothing bails out early for a different reason.
    setSignalInput(inst, 'selectionOnDrag', true);
    fixture.detectChanges();
    inst.initSelectionListener();
    stubDomNode(store);

    // Append a nodes-selection box as a real DOM child of the pane element.
    // Dispatching on it produces event.target === nodesSelectionEl in the capture handler.
    const nodesSelectionEl = document.createElement('div');
    nodesSelectionEl.className = 'xy-flow__nodesselection';
    (fixture.nativeElement as HTMLElement).appendChild(nodesSelectionEl);

    fireMouseDown(nodesSelectionEl);

    // Guard must have fired early — no marquee started, existing selection preserved
    expect(store.userSelectionActive()).toBe(false);
  });

  it('does NOT start a marquee when selectionOnDrag mousedown targets a node element', () => {
    const fixture = TestBed.createComponent(PaneComponent);
    const inst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);

    setSignalInput(inst, 'selectionOnDrag', true);
    fixture.detectChanges();
    inst.initSelectionListener();
    stubDomNode(store);

    const nodeEl = document.createElement('div');
    nodeEl.className = 'xy-flow__node';
    (fixture.nativeElement as HTMLElement).appendChild(nodeEl);

    fireMouseDown(nodeEl);

    expect(store.userSelectionActive()).toBe(false);
  });

  /**
   * Existing behavior pinned: a mousedown directly on the pane element itself
   * (no child target) must still start the marquee when selectionOnDrag is on.
   */
  it('DOES start a marquee when selectionOnDrag mousedown targets the pane element itself', () => {
    const fixture = TestBed.createComponent(PaneComponent);
    const inst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);

    setSignalInput(inst, 'selectionOnDrag', true);
    fixture.detectChanges();
    inst.initSelectionListener();
    stubDomNode(store);

    // Dispatch directly on the pane element — event.target === paneEl in capture handler
    const paneEl = fixture.nativeElement as HTMLElement;
    fireMouseDown(paneEl);

    expect(store.userSelectionActive()).toBe(true);
  });

  /**
   * React parity: when the selection key is active (Shift), the handler allows
   * mousedowns on ANY child, not just the pane itself. The target guard is
   * intentionally bypassed in key-based selection mode.
   */
  it('starts a marquee on a child when the selectionKey is active (key-based selection allows any target)', () => {
    const fixture = TestBed.createComponent(PaneComponent);
    const inst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);

    // Only selectionKey active, not selectionOnDrag
    store.selectionKeyActive.set(true);
    fixture.detectChanges();
    inst.initSelectionListener();
    stubDomNode(store);

    // mousedown targeting a plain child div — key-based selection should still fire
    const childEl = document.createElement('div');
    (fixture.nativeElement as HTMLElement).appendChild(childEl);

    fireMouseDown(childEl);

    expect(store.userSelectionActive()).toBe(true);
  });
});
