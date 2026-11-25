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
import { Position, type ConnectionInProgress } from '@angflow/system';

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

function makeInProgressConnection(): ConnectionInProgress {
  return {
    inProgress: true,
    isValid: null,
    from: { x: 0, y: 0 },
    fromHandle: { id: null, nodeId: '1', x: 0, y: 0, position: Position.Bottom, type: 'source', width: 10, height: 10 },
    fromPosition: Position.Bottom,
    fromNode: null as never,
    to: { x: 100, y: 100 },
    toHandle: null,
    toPosition: Position.Top,
    toNode: null,
    pointer: { x: 100, y: 100 },
  };
}

function makePanePointerUp(pointerType: string): PointerEvent {
  const paneEl = document.createElement('div');
  return { target: paneEl, currentTarget: paneEl, pointerType } as unknown as PointerEvent;
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
    (paneInst as any).marqueeActive = true;
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
    (paneInst as any).marqueeActive = true;
    (paneInst as any).activePointerId = 1;
    (paneInst as any).onPointerUp({ clientX: 100, clientY: 100, pointerId: 1 } as PointerEvent);

    expect(store.selectionInProgress()).toBe(false);
  });

  it('PaneComponent does not activate the nodes selection on a zero-move click with a node already selected', () => {
    // Upstream sets nodesSelectionActive only when a marquee actually ran (selectionInProgress);
    // otherwise a plain pane click with selectionOnDrag never reaches (paneClick).
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    const fixture = TestBed.createComponent(PaneComponent);
    const paneInst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);
    fixture.detectChanges();
    store.setNodes([{ id: '1', position: { x: 0, y: 0 }, data: {}, selected: true }]);
    expect(store.selectedNodes().length).toBe(1);

    (paneInst as any).marqueeActive = true;
    (paneInst as any).activePointerId = 1;
    (paneInst as any).onPointerUp({ clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' } as PointerEvent);

    expect(store.nodesSelectionActive()).toBe(false);
  });

  function endMovedMarquee(pointerType: string): FlowStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaneComponent],
      providers: [provideZonelessChangeDetection(), FlowStore],
    });
    const fixture = TestBed.createComponent(PaneComponent);
    const paneInst = fixture.componentInstance;
    const store = TestBed.inject(FlowStore);
    fixture.detectChanges();
    // A marquee that moved (moved=true, flag set), then release.
    (paneInst as any).marqueeActive = true;
    (paneInst as any).moved = true;
    (paneInst as any).activePointerId = 1;
    store.selectionInProgress.set(true);
    (paneInst as any).onPointerUp({ clientX: 150, clientY: 150, pointerId: 1, pointerType } as PointerEvent);
    return store;
  }

  it('keeps selectionInProgress set after a MOUSE marquee (synthesised click will consume it)', () => {
    const store = endMovedMarquee('mouse');
    expect(store.selectionInProgress()).toBe(true);
  });

  it('clears selectionInProgress after a TOUCH marquee (no synthesised click to consume it)', () => {
    // Regression: previously the flag stayed stuck on touch, swallowing the
    // next genuine pane tap's deselect/(paneClick).
    const store = endMovedMarquee('touch');
    expect(store.selectionInProgress()).toBe(false);
  });

  describe('upstream Pane onClick order', () => {
    const armedHandle = { nodeId: '1', type: 'source' as const, handleId: null };

    function setup() {
      const fixture = TestBed.createComponent(NgFlowComponent);
      const inst = fixture.componentInstance;
      fixture.detectChanges();
      const store = inst.store;
      const clickConnectEndSpy = vi.spyOn(inst.clickConnectEnd, 'emit');
      const paneClickSpy = vi.spyOn(inst.paneClick, 'emit');
      const resetSpy = vi.spyOn(store, 'resetSelectedElements');
      return { inst: Object.assign(inst, { fixtureRef: fixture.componentRef }), store, clickConnectEndSpy, paneClickSpy, resetSpy };
    }

    it('a pane click cancels a pending click-connect and emits (clickConnectEnd)', () => {
      const { inst, store, clickConnectEndSpy, paneClickSpy } = setup();
      store.connectionClickStartHandle.set(armedHandle);

      const ev = makePaneClick();
      inst.onPaneClick(ev);

      expect(clickConnectEndSpy).toHaveBeenCalledTimes(1);
      expect(clickConnectEndSpy).toHaveBeenCalledWith(ev);
      expect(store.connectionClickStartHandle()).toBeNull();
      expect(paneClickSpy).toHaveBeenCalledTimes(1);
    });

    it('the click that ends a marquee keeps a pending click-connect', () => {
      const { inst, store, clickConnectEndSpy, paneClickSpy } = setup();
      store.connectionClickStartHandle.set(armedHandle);
      store.selectionInProgress.set(true);

      inst.onPaneClick(makePaneClick());

      expect(store.connectionClickStartHandle()).toEqual(armedHandle);
      expect(clickConnectEndSpy).not.toHaveBeenCalled();
      expect(paneClickSpy).not.toHaveBeenCalled();
      expect(store.selectionInProgress()).toBe(false);
    });

    it('the click after a connection drag dropped on the pane is swallowed once', () => {
      const { inst, store, paneClickSpy, resetSpy } = setup();
      store.updateConnection({ ...makeInProgressConnection() });

      inst.onPanePointerUp(makePanePointerUp('mouse'));
      store.cancelConnection();
      inst.onPaneClick(makePaneClick());

      expect(paneClickSpy).not.toHaveBeenCalled();
      expect(resetSpy).not.toHaveBeenCalled();

      inst.onPaneClick(makePaneClick());
      expect(paneClickSpy).toHaveBeenCalledTimes(1);
    });

    it('a touch connection drop sets no flag (no synthesised click follows)', () => {
      const { inst, store, paneClickSpy } = setup();
      store.updateConnection({ ...makeInProgressConnection() });

      inst.onPanePointerUp(makePanePointerUp('touch'));
      store.cancelConnection();
      inst.onPaneClick(makePaneClick());

      expect(paneClickSpy).toHaveBeenCalledTimes(1);
    });

    it('swallows any click while a connection drag is in progress', () => {
      const { inst, store, paneClickSpy, resetSpy } = setup();
      store.updateConnection({ ...makeInProgressConnection() });

      inst.onPaneClick(makePaneClick());

      expect(paneClickSpy).not.toHaveBeenCalled();
      expect(resetSpy).not.toHaveBeenCalled();
    });

    it('an armed click-connect with a moved preview (inProgress) still cancels on a pane click', () => {
      const { inst, store, clickConnectEndSpy, paneClickSpy } = setup();
      store.connectionClickStartHandle.set(armedHandle);
      // What ClickConnectPreview writes on pointermove while a handle is armed.
      store.updateClickConnectPreview({ ...makeInProgressConnection() });

      inst.onPanePointerUp(makePanePointerUp('mouse'));
      inst.onPaneClick(makePaneClick());

      expect(clickConnectEndSpy).toHaveBeenCalledTimes(1);
      expect(paneClickSpy).toHaveBeenCalledTimes(1);
      expect(store.connectionClickStartHandle()).toBeNull();
    });
    it('a real handle drag started while click-connect is armed is still swallowed on a pane drop', () => {
      const { inst, store, clickConnectEndSpy, paneClickSpy, resetSpy } = setup();
      store.connectionClickStartHandle.set(armedHandle);
      // XYHandle's drag writes through updateConnection, not the click-connect preview.
      store.updateConnection({ ...makeInProgressConnection() });

      inst.onPanePointerUp(makePanePointerUp('mouse'));
      store.cancelConnection();
      inst.onPaneClick(makePaneClick());

      expect(clickConnectEndSpy).not.toHaveBeenCalled();
      expect(paneClickSpy).not.toHaveBeenCalled();
      expect(resetSpy).not.toHaveBeenCalled();
      expect(store.connectionClickStartHandle()).toEqual(armedHandle);
    });

    it('with paneClickDistance > 0, the click after a connection drop consumes its flag even past the distance', () => {
      const { inst, store, paneClickSpy } = setup();
      inst.fixtureRef.setInput('paneClickDistance', 5);
      // A stale pointerdown position (the start of an earlier pan): the handle
      // stops the connection drag's own pointerdown from reaching the pane.
      inst.onPanePointerDown({ clientX: 0, clientY: 0 } as PointerEvent);
      store.updateConnection({ ...makeInProgressConnection() });

      inst.onPanePointerUp(makePanePointerUp('mouse'));
      store.cancelConnection();
      inst.onPaneClick(makePaneClick(100, 100));
      expect(paneClickSpy).not.toHaveBeenCalled();
      expect((inst as any).connectionEndedOnPane).toBe(false);

      // The next genuine pane click is not swallowed.
      inst.onPanePointerDown({ clientX: 200, clientY: 200 } as PointerEvent);
      inst.onPaneClick(makePaneClick(200, 200));
      expect(paneClickSpy).toHaveBeenCalledTimes(1);
    });

    it('a pane pointerdown resets stale swallow flags', () => {
      const { inst, store } = setup();
      store.updateConnection({ ...makeInProgressConnection() });
      inst.onPanePointerUp(makePanePointerUp('mouse'));
      store.cancelConnection();
      store.selectionInProgress.set(true);
      expect((inst as any).connectionEndedOnPane).toBe(true);

      inst.onPanePointerDown({ clientX: 10, clientY: 10 } as PointerEvent);

      expect((inst as any).connectionEndedOnPane).toBe(false);
      expect(store.selectionInProgress()).toBe(false);
    });
  });
});
