/**
 * Regression tests for onPaneClick post-marquee selection guard.
 *
 * When the user performs a marquee drag and releases the mouse, the browser
 * synthesises a `click` event on the pane immediately after `mouseup`. Without
 * a guard, `onPaneClick` sees `nodesSelectionActive() === true` and clears it,
 * making the selection box vanish in the same frame it appeared.
 *
 * Ported from React's `selectionInProgress` ref pattern
 * (packages/react/src/container/Pane/index.tsx).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgFlowComponent } from './ng-flow.component';
import { PaneComponent } from '../pane/pane.component';
import { FlowStore } from '../../services/flow-store.service';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function makePaneClick(x = 0, y = 0): MouseEvent {
  // Create the event targeting a plain div so target.closest() works (not null).
  const el = document.createElement('div');
  const ev = new MouseEvent('click', { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'target', { value: el, writable: false });
  return ev;
}

describe('NgFlowComponent onPaneClick — post-marquee guard', () => {
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

  /**
   * Sequence:
   *  1. Marquee ends — pane sets nodesSelectionActive(true) + selectionInProgress(true)
   *  2. Synthesised pane click fires → nodesSelectionActive must STAY true (guard consumed)
   *  3. Second genuine pane click → nodesSelectionActive becomes false (normal deselect)
   */
  it('preserves nodesSelectionActive after the post-marquee synthesised click', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    fixture.detectChanges();

    const store = inst.store;

    // Simulate marquee end: PaneComponent.onMouseUp sets these two flags
    store.nodesSelectionActive.set(true);
    store.selectionInProgress.set(true);

    // Synthesised click — must NOT clear nodesSelectionActive
    inst.onPaneClick(makePaneClick());

    expect(store.nodesSelectionActive()).toBe(true);
    // Guard must be consumed so the NEXT click works normally
    expect(store.selectionInProgress()).toBe(false);
  });

  it('clears nodesSelectionActive on a genuine second pane click', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    fixture.detectChanges();

    const store = inst.store;

    // State after post-marquee synthesised click has already been absorbed
    store.nodesSelectionActive.set(true);
    store.selectionInProgress.set(false);

    inst.onPaneClick(makePaneClick());

    expect(store.nodesSelectionActive()).toBe(false);
  });

  it('does not clear nodesSelectionActive when selectionInProgress is true even if nodesSelectionActive was true', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    fixture.detectChanges();

    const store = inst.store;

    store.nodesSelectionActive.set(true);
    store.selectionInProgress.set(true);

    inst.onPaneClick(makePaneClick());

    // nodesSelectionActive preserved, flag consumed
    expect(store.nodesSelectionActive()).toBe(true);
    expect(store.selectionInProgress()).toBe(false);
  });

  /**
   * Empty marquee: user drags but no nodes fall inside the selection rect.
   * selectionInProgress must be set to guard the synthesised click, even
   * though selectedNodes().length === 0. Otherwise the click falls through
   * to resetSelectedElements + paneClick emission (React parity).
   *
   * This test documents the FIXED behavior: selectionInProgress should be set
   * whenever a marquee completes, regardless of selection count. The PaneComponent
   * onMouseUp should set it unconditionally (not guarded by selectedNodes().length > 0).
   */
  it('prevents paneClick emission and resetSelectedElements after an empty marquee', () => {
    const fixture = TestBed.createComponent(NgFlowComponent);
    const inst = fixture.componentInstance;
    fixture.detectChanges();

    const store = inst.store;

    // Simulate a completed empty marquee: selectionInProgress set but no nodes selected
    // (selectedNodes is computed, so it's empty by default with no nodes in the store)
    store.selectionInProgress.set(true);

    // Synthesised click must NOT emit paneClick and must NOT call resetSelectedElements
    const paneClickEmitSpy = vi.spyOn(inst.paneClick, 'emit');
    const resetSpy = vi.spyOn(store, 'resetSelectedElements');

    inst.onPaneClick(makePaneClick());

    expect(paneClickEmitSpy).not.toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
    // Guard must be consumed
    expect(store.selectionInProgress()).toBe(false);
  });

  /**
   * Unit test: PaneComponent sets selectionInProgress on the FIRST pointer move
   * of a marquee (even one that selects nothing), so the synthesised click is
   * guarded — but a zero-movement click leaves the flag false so click-to-
   * deselect / (paneClick) still fire. React parity: selectionInProgress is set
   * in onPointerMove, not unconditionally on pointerup.
   */
  it('PaneComponent sets selectionInProgress on first move, not on a zero-move click', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });

    const fixture = TestBed.createComponent(PaneComponent);
    const paneInst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);
    fixture.detectChanges();

    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    });
    store.domNode.set(container as HTMLDivElement);

    // Simulate an in-progress marquee.
    (paneInst as any).isSelecting = true;
    (paneInst as any).activePointerId = 1;
    (paneInst as any).startX = 100;
    (paneInst as any).startY = 100;
    expect(store.selectionInProgress()).toBe(false);

    // A pointer move (even selecting nothing) marks the marquee in progress.
    (paneInst as any).onPointerMove({ clientX: 150, clientY: 150, pointerId: 1 } as PointerEvent);
    expect(store.selectionInProgress()).toBe(true);
  });

  it('PaneComponent leaves selectionInProgress false for a click with no movement', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });

    const fixture = TestBed.createComponent(PaneComponent);
    const paneInst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);
    fixture.detectChanges();

    // Simulate a marquee gesture that ends with no move (a plain click).
    (paneInst as any).isSelecting = true;
    (paneInst as any).activePointerId = 1;
    (paneInst as any).onPointerUp({ clientX: 100, clientY: 100, pointerId: 1 } as PointerEvent);

    expect(store.selectionInProgress()).toBe(false);
  });
});
