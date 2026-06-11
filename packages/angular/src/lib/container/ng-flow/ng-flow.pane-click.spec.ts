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
});
